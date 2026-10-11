import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendMailLogged } from './_lib/email-log.js';
import { escapeHtml, getMailProvider, getSenderAddress } from './_lib/mailer.js';
import { assertSecondFactor, MfaRequiredError } from './_lib/mfa.js';
import { getSupabaseAnon, normalizeLanguage, sendAccessEmail, type AccessEmailResult } from './_lib/auth-emails.js';
import { checkPassword } from '../src/lib/passwordPolicy.js';
import { dispatchNotifications, sendNotificationSample } from './_lib/notification-dispatch.js';
import { assertCanDelete, getUserFootprint, OffboardingError, reassignUserData } from './_lib/offboarding.js';
import { logActivity } from './_lib/audit.js';
import { RenewalError, renewPractice } from './_lib/renewals.js';

/**
 * Portal actions that need the service role, called by signed-in users with their session token.
 *
 * - create_user, disable_user, delete_user: administrators only.
 * - flush_notifications: any user. Sends the notification emails waiting in the queue (the database
 *   queues them when a practice is uploaded, changes status, gets documents or notes). The email goes out
 *   from the server, so the email provider key never reaches the browser.
 * - create_user also sends the welcome email and flags the account: the temporary password must be
 *   replaced at the first sign-in (app_metadata.must_change_password).
 * - set_password: any user, for their own account. The only way to clear that flag: the new password is
 *   checked and set by the server, so the change cannot be skipped from the browser.
 * - resend_access_email: administrators only. Welcome email (user never signed in) or reset link.
 * - send_test_notification: administrators only. A sample notification to the addresses chosen for a user.
 * - user_footprint, reassign_user_data: administrators only. What a user still owns, and handing it all to another user
 *   (so an account can be disabled or deleted without losing its practices).
 * - renew_practice: whoever can see the practice. Creates the renewal (a new practice linked to the expiring one).
 * - reset_mfa: administrators only. Removes the user's authenticator-app factors (lost phone).
 * - email_status, send_test_email: administrators only. Which channel sends the portal's emails
 *   and a real test message to the administrator's own address.
 */

type Action =
  | 'create_user'
  | 'disable_user'
  | 'delete_user'
  | 'user_footprint'
  | 'log_session_event'
  | 'reassign_user_data'
  | 'renew_practice'
  | 'flush_notifications'
  | 'notify_new_practice'
  | 'send_test_notification'
  | 'email_status'
  | 'send_test_email'
  | 'reset_mfa'
  | 'set_password'
  | 'resend_access_email';

const ROLES = ['admin', 'agente', 'collaboratore'] as const;
type Role = (typeof ROLES)[number];

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new HttpError(500, 'Configurazione server mancante');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function resolveCaller(req: VercelRequest, supabase: SupabaseClient) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Token di autorizzazione mancante');
  const token = header.slice('Bearer '.length).trim();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sessione non valida o scaduta');
  try {
    await assertSecondFactor(supabase, token, data.user.id);
  } catch (mfaError) {
    if (mfaError instanceof MfaRequiredError) throw new HttpError(403, mfaError.message);
    throw new HttpError(500, mfaError instanceof Error ? mfaError.message : 'Verifica sicurezza non riuscita');
  }
  return data.user;
}

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (error) throw new HttpError(500, `Errore verifica permessi: ${error.message}`);
  if (!data) throw new HttpError(403, 'Accesso riservato agli amministratori');
}

async function createUser(supabase: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  await requireAdmin(supabase, callerId);

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const language = normalizeLanguage(body.language);
  const sendWelcome = body.send_welcome !== false;
  const role = body.role as Role;
  if (!email || !password || !fullName || !ROLES.includes(role)) throw new HttpError(400, 'Campi obbligatori mancanti');

  const bonusTiers = (Array.isArray(body.commission_bonus_tiers) ? body.commission_bonus_tiers : [])
    .map((tier: { threshold?: unknown; bonus_percentage?: unknown; label?: unknown }) => ({
      threshold: Number(tier?.threshold) || 0,
      bonus_percentage: Number(tier?.bonus_percentage) || 0,
      label: typeof tier?.label === 'string' ? tier.label.trim() : '',
    }))
    .filter((tier) => tier.threshold > 0 && tier.bonus_percentage > 0)
    .sort((a, b) => a.threshold - b.threshold);
  const products = Array.isArray(body.allowed_products)
    ? body.allowed_products.filter((product): product is string => typeof product === 'string')
    : [];

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
    // Only the server can write app_metadata: the user cannot clear this flag from the browser.
    app_metadata: { must_change_password: true },
  });
  if (authError || !authData.user) throw new HttpError(400, `Errore creazione utente: ${authError?.message ?? 'nessun dato'}`);
  const newUserId = authData.user.id;
  if (authData.user.app_metadata?.must_change_password !== true) {
    const { error: flagError } = await supabase.auth.admin.updateUserById(newUserId, { app_metadata: { must_change_password: true } });
    if (flagError) {
      await supabase.auth.admin.deleteUser(newUserId);
      throw new HttpError(400, `Errore creazione utente: ${flagError.message}`);
    }
  }

  const rollback = async () => {
    await supabase.from('user_product_permissions').delete().eq('user_id', newUserId);
    await supabase.from('user_roles').delete().eq('user_id', newUserId);
    await supabase.from('profiles').delete().eq('id', newUserId);
    await supabase.auth.admin.deleteUser(newUserId);
  };

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: newUserId,
      email,
      full_name: fullName,
      phone: phone || null,
      language,
      default_commission_percentage: Number(body.default_commission_percentage) || 0,
      commission_bonus_tiers: bonusTiers,
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    await rollback();
    throw new HttpError(400, `Errore creazione profilo: ${profileError.message}`);
  }

  const { error: roleError } = await supabase.from('user_roles').upsert({ user_id: newUserId, role }, { onConflict: 'user_id,role' });
  if (roleError) {
    await rollback();
    throw new HttpError(400, `Errore assegnazione ruolo: ${roleError.message}`);
  }

  if ((role === 'agente' || role === 'collaboratore') && products.length > 0) {
    const { error: permissionsError } = await supabase
      .from('user_product_permissions')
      .insert(products.map((practiceType) => ({ user_id: newUserId, practice_type: practiceType, created_by: callerId })));
    if (permissionsError) {
      await rollback();
      throw new HttpError(400, `Errore assegnazione prodotti: ${permissionsError.message}`);
    }
  }

  const welcome: AccessEmailResult = sendWelcome
    ? await sendAccessEmail(supabase, { kind: 'welcome', email, name: fullName, language })
    : { sent: false, reason: 'Non richiesta' };

  return { user: { id: newUserId, email, full_name: fullName }, welcome };
}

async function resendAccessEmail(supabase: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  await requireAdmin(supabase, callerId);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new HttpError(400, 'Utente mancante');

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user?.email) throw new HttpError(404, 'Utente non trovato');
  const { data: profile } = await supabase.from('profiles').select('full_name, language').eq('id', userId).maybeSingle();

  // Never signed in: it is still the welcome message; otherwise a password reset link.
  const result = await sendAccessEmail(supabase, {
    kind: data.user.last_sign_in_at ? 'recovery' : 'welcome',
    email: data.user.email,
    name: profile?.full_name ?? '',
    language: normalizeLanguage(profile?.language),
  });
  return { sent: result.sent, reason: result.reason, to: data.user.email };
}

async function setPassword(supabase: SupabaseClient, caller: { id: string; email?: string | null }, body: Record<string, unknown>) {
  const password = typeof body.password === 'string' ? body.password : '';
  const problem = checkPassword(password);
  if (problem) throw new HttpError(400, 'La password non rispetta le regole: almeno 6 caratteri, una maiuscola e un numero o carattere speciale', 'weak_password');
  if (!caller.email) throw new HttpError(400, 'Il tuo account non ha un indirizzo email');

  // The new password must differ from the current one (the temporary one): if signing in with it works, it is the same.
  const probe = getSupabaseAnon();
  const { data: attempt } = await probe.auth.signInWithPassword({ email: caller.email, password });
  if (attempt?.session) {
    // Solo la sessione di controllo: un signOut globale chiuderebbe anche quella aperta dall'utente nel browser.
    await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw new HttpError(400, 'La nuova password deve essere diversa da quella attuale', 'same_password');
  }

  const { error } = await supabase.auth.admin.updateUserById(caller.id, {
    password,
    app_metadata: { must_change_password: false },
  });
  if (error) throw new HttpError(400, error.message);
  return {};
}

async function disableOrDeleteUser(supabase: SupabaseClient, callerId: string, body: Record<string, unknown>, remove: boolean) {
  await requireAdmin(supabase, callerId);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new HttpError(400, 'Utente mancante');
  if (userId === callerId) throw new HttpError(400, 'Non puoi disattivare o eliminare il tuo stesso account');

  if (remove) {
    // Deleting an account must never take its practices and clients with it.
    await assertCanDelete(supabase, userId);
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new HttpError(400, error.message);
  } else {
    // About 100 years: the account stays, with its practices, but cannot sign in.
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (error) throw new HttpError(400, error.message);
  }
  return {};
}

async function resetMfa(supabase: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  await requireAdmin(supabase, callerId);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new HttpError(400, 'Utente mancante');
  if (userId === callerId) throw new HttpError(400, 'Non puoi reimpostare la tua verifica da qui: usa le Impostazioni');

  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (error) throw new HttpError(400, error.message);
  const factors = data?.factors ?? [];
  for (const factor of factors) {
    const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
    if (deleteError) throw new HttpError(400, deleteError.message);
  }
  return { removed: factors.length };
}

/** Gap between two runs asked by the same person: the queue is shared, a second run would find it empty. */
const FLUSH_COOLDOWN_MS = 1500;
const lastFlush = new Map<string, number>();

/**
 * Sends the notification emails waiting in the queue (new practice, documents, notes...). The browser calls
 * this right after the user's action, so the people concerned hear about it at once; the daily run
 * catches whatever was missed. The queue is filled by the database, never by the caller.
 */
async function flushNotifications(supabase: SupabaseClient, callerId: string) {
  const now = Date.now();
  if (now - (lastFlush.get(callerId) ?? 0) < FLUSH_COOLDOWN_MS) return { flushed: false };
  lastFlush.set(callerId, now);
  if (lastFlush.size > 500) for (const [key, at] of lastFlush) if (now - at > 60_000) lastFlush.delete(key);
  const summary = await dispatchNotifications(supabase);
  return { flushed: true, ...summary };
}

function emailStatus() {
  return { provider: getMailProvider(), sender: getSenderAddress() };
}

async function sendTestEmail(supabase: SupabaseClient, callerId: string, callerEmail: string) {
  await requireAdmin(supabase, callerId);
  if (!callerEmail) throw new HttpError(400, 'Il tuo account non ha un indirizzo email');
  const status = emailStatus();
  if (status.provider === 'none') {
    return { sent: false, ...status, reason: 'Nessun servizio email configurato su Vercel (GMAIL_USER e GMAIL_APP_PASSWORD oppure RESEND_API_KEY)' };
  }
  const when = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const result = await sendMailLogged(supabase, {
    to: callerEmail,
    subject: 'Prova invio email — Portale Tecno Advance MGA',
    html: `<p>Questa è un'email di prova inviata dal portale il ${escapeHtml(when)}.</p>
<p>Canale: <strong>${escapeHtml(status.provider === 'gmail' ? 'Gmail / Google Workspace' : 'Resend')}</strong><br>Mittente: <strong>${escapeHtml(status.sender)}</strong></p>
<p>Se la ricevi, i promemoria di scadenza e le notifiche agli amministratori partiranno correttamente.</p>`,
  }, { template: 'smtp_test', recipientName: null });
  if (!result.success) return { sent: false, ...status, reason: result.error ?? 'Errore sconosciuto' };
  return { sent: true, ...status, to: callerEmail };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare POST.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const caller = await resolveCaller(req, supabase);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as Action | undefined;
    // What an administrator did to an account goes in the audit log, with who, when and from where.
    const audit = (name: string, targetId: string | null, details?: Record<string, unknown>) =>
      logActivity(supabase, { actorId: caller.id, action: name, target: { table: 'profiles', id: targetId }, details, req });
    const targetUserId = typeof body.userId === 'string' ? body.userId : null;

    switch (action) {
      case 'create_user': {
        const created = await createUser(supabase, caller.id, body);
        await audit('user.create', created.user.id, { email: created.user.email, full_name: created.user.full_name, role: body.role, welcome_sent: created.welcome?.sent ?? null });
        return res.status(200).json({ success: true, ...created });
      }
      case 'disable_user': {
        const result = await disableOrDeleteUser(supabase, caller.id, body, false);
        await audit('user.disable', targetUserId);
        return res.status(200).json({ success: true, ...result });
      }
      case 'delete_user': {
        // The person's name and email are noted first: after the deletion they cannot be looked up.
        const { data: gone } = targetUserId ? await supabase.from('profiles').select('full_name, email').eq('id', targetUserId).maybeSingle() : { data: null };
        const result = await disableOrDeleteUser(supabase, caller.id, body, true);
        await audit('user.delete', targetUserId, { full_name: gone?.full_name ?? null, email: gone?.email ?? null });
        return res.status(200).json({ success: true, ...result });
      }
      case 'user_footprint': {
        await requireAdmin(supabase, caller.id);
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!userId) throw new HttpError(400, 'Utente mancante');
        return res.status(200).json({ success: true, footprint: await getUserFootprint(supabase, userId) });
      }
      case 'reassign_user_data': {
        await requireAdmin(supabase, caller.id);
        const fromUserId = typeof body.fromUserId === 'string' ? body.fromUserId : '';
        const toUserId = typeof body.toUserId === 'string' ? body.toUserId : '';
        if (!fromUserId || !toUserId) throw new HttpError(400, 'Utenti mancanti');
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', caller.id).maybeSingle();
        const result = await reassignUserData(supabase, {
          fromUserId,
          toUserId,
          actorId: caller.id,
          actorLabel: (profile?.full_name as string | undefined)?.trim() || 'Amministratore',
        });
        await audit('user.reassign', fromUserId, { to_user_id: toUserId, practices: result.moved, clients: result.clients, collaborators: result.collaborators, lots: result.batches, api_keys: result.apiKeys });
        return res.status(200).json({ success: true, ...result });
      }
      case 'renew_practice': {
        const practiceId = typeof body.practiceId === 'string' ? body.practiceId : '';
        if (!practiceId) throw new HttpError(400, 'Pratica mancante');
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', caller.id).maybeSingle();
        const renewal = await renewPractice(supabase, {
          practiceId,
          actorId: caller.id,
          actorLabel: (profile?.full_name as string | undefined)?.trim() || 'Utente',
        });
        await logActivity(supabase, { actorId: caller.id, action: 'practice.renew', target: { table: 'practices', id: practiceId }, details: { renewal_id: renewal.practiceId, renewal_number: renewal.practiceNumber }, req });
        // The administrators hear about the new practice like about any other.
        await dispatchNotifications(supabase).catch((error: unknown) => console.error('rinnovo: notifiche non inviate:', error));
        return res.status(200).json({ success: true, ...renewal });
      }
      // 'notify_new_practice' is the name the previous version of the browser app uses.
      case 'flush_notifications':
      case 'notify_new_practice':
        return res.status(200).json({ success: true, ...(await flushNotifications(supabase, caller.id)) });
      case 'send_test_notification': {
        await requireAdmin(supabase, caller.id);
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!userId) throw new HttpError(400, 'Utente mancante');
        return res.status(200).json({ success: true, ...(await sendNotificationSample(supabase, userId)) });
      }
      case 'set_password': {
        const result = await setPassword(supabase, caller, body);
        await audit('user.password_changed', caller.id);
        return res.status(200).json({ success: true, ...result });
      }
      case 'resend_access_email': {
        const result = await resendAccessEmail(supabase, caller.id, body);
        await audit('user.access_email', targetUserId, { sent: result.sent });
        return res.status(200).json({ success: true, ...result });
      }
      case 'reset_mfa': {
        const result = await resetMfa(supabase, caller.id, body);
        await audit('user.reset_mfa', targetUserId, { factors_removed: result.removed });
        return res.status(200).json({ success: true, ...result });
      }
      case 'log_session_event': {
        // The browser says a person signed in or out: only those two events, only for the caller.
        const event = body.event === 'logout' ? 'session.logout' : body.event === 'login' ? 'session.login' : null;
        if (!event) throw new HttpError(400, 'Evento non valido');
        await logActivity(supabase, { actorId: caller.id, action: event, target: { table: 'profiles', id: caller.id }, req });
        return res.status(200).json({ success: true });
      }
      case 'email_status':
        await requireAdmin(supabase, caller.id);
        return res.status(200).json({ success: true, ...emailStatus() });
      case 'send_test_email':
        return res.status(200).json({ success: true, ...(await sendTestEmail(supabase, caller.id, caller.email ?? '')) });
      default:
        return res.status(400).json({ error: 'Azione non supportata' });
    }
  } catch (error) {
    const status = error instanceof HttpError || error instanceof OffboardingError || error instanceof RenewalError ? error.status : 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'Errore imprevisto',
      ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
      ...(error instanceof OffboardingError || error instanceof RenewalError ? { code: error.code } : {}),
    });
  }
}
