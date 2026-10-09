import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml, getMailProvider, getSenderAddress, sendMail } from './_lib/mailer.js';

/**
 * Portal actions that need the service role, called by signed-in users with their session token.
 *
 * - create_user, disable_user, delete_user: administrators only.
 * - notify_new_practice: any user, for a practice of their own. The email goes out from the
 *   server, so the email provider key never reaches the browser.
 * - email_status, send_test_email: administrators only. Which channel sends the portal's emails
 *   and a real test message to the administrator's own address.
 */

type Action =
  | 'create_user'
  | 'disable_user'
  | 'delete_user'
  | 'notify_new_practice'
  | 'email_status'
  | 'send_test_email';

const ROLES = ['admin', 'agente', 'collaboratore'] as const;
type Role = (typeof ROLES)[number];

class HttpError extends Error {
  constructor(public status: number, message: string) {
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
  const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length).trim());
  if (error || !data.user) throw new HttpError(401, 'Sessione non valida o scaduta');
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
  });
  if (authError || !authData.user) throw new HttpError(400, `Errore creazione utente: ${authError?.message ?? 'nessun dato'}`);
  const newUserId = authData.user.id;

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

  return { user: { id: newUserId, email, full_name: fullName } };
}

async function disableOrDeleteUser(supabase: SupabaseClient, callerId: string, body: Record<string, unknown>, remove: boolean) {
  await requireAdmin(supabase, callerId);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) throw new HttpError(400, 'Utente mancante');
  if (userId === callerId) throw new HttpError(400, 'Non puoi disattivare o eliminare il tuo stesso account');

  if (remove) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new HttpError(400, error.message);
  } else {
    // About 100 years: the account stays, with its practices, but cannot sign in.
    const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (error) throw new HttpError(400, error.message);
  }
  return {};
}

async function notifyNewPractice(supabase: SupabaseClient, callerId: string, callerEmail: string, body: Record<string, unknown>) {
  const practiceId = typeof body.practiceId === 'string' ? body.practiceId : '';
  if (!practiceId) throw new HttpError(400, 'Pratica mancante');

  const { data: practice, error } = await supabase
    .from('practices')
    .select('practice_number, practice_type, client_name, client_email, user_id')
    .eq('id', practiceId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!practice || practice.user_id !== callerId) throw new HttpError(404, 'Pratica non trovata');

  if (getMailProvider() === 'none') return { sent: false, reason: 'Nessun servizio email configurato' };

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', callerId).maybeSingle();
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAILS || 'info@tecnomga.com,antoncarlo@tecnomga.com')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  const dateStr = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

  const rows: Array<[string, unknown]> = [
    ['Numero Pratica', practice.practice_number],
    ['Tipo Polizza', practice.practice_type],
    ['Cliente', practice.client_name],
    ['Email Cliente', practice.client_email],
    ['Caricata da', profile?.full_name || callerEmail],
    ['Email Agente', callerEmail],
    ['Data/Ora', dateStr],
  ];
  const html = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
      <tr><td style="background:#1a2744;padding:24px 32px">
        <h1 style="margin:0;color:#fff;font-size:20px">Nuova Pratica Caricata</h1>
        <p style="margin:4px 0 0;color:#a8b8d8;font-size:14px">Portale Tecno Advance MGA</p>
      </td></tr>
      <tr><td style="padding:32px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <tr style="background:#1a2744;color:#fff"><th style="padding:10px 14px;text-align:left">Campo</th><th style="padding:10px 14px;text-align:left">Valore</th></tr>
          ${rows
            .map(
              ([label, value], index) =>
                `<tr${index % 2 === 0 ? ' style="background:#f9fafb"' : ''}><td style="padding:10px 14px;font-weight:600;color:#374151">${escapeHtml(label)}</td><td style="padding:10px 14px;color:#111827">${escapeHtml(value)}</td></tr>`,
            )
            .join('')}
        </table>
      </td></tr>
      <tr><td style="background:#f4f6f8;padding:16px 32px;text-align:center">
        <p style="margin:0;font-size:12px;color:#6b7280">Portale Tecno Advance MGA — Notifica automatica</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const result = await sendMail({
    to: adminEmails,
    subject: `Nuova Pratica Caricata: ${practice.practice_number} — ${practice.practice_type}`,
    html,
  });
  if (!result.success) return { sent: false, reason: `Invio email non riuscito: ${result.error ?? 'errore sconosciuto'}` };
  return { sent: true };
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
  const result = await sendMail({
    to: callerEmail,
    subject: 'Prova invio email — Portale Tecno Advance MGA',
    html: `<p>Questa è un'email di prova inviata dal portale il ${escapeHtml(when)}.</p>
<p>Canale: <strong>${escapeHtml(status.provider === 'gmail' ? 'Gmail / Google Workspace' : 'Resend')}</strong><br>Mittente: <strong>${escapeHtml(status.sender)}</strong></p>
<p>Se la ricevi, i promemoria di scadenza e le notifiche agli amministratori partiranno correttamente.</p>`,
  });
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

    switch (action) {
      case 'create_user':
        return res.status(200).json({ success: true, ...(await createUser(supabase, caller.id, body)) });
      case 'disable_user':
        return res.status(200).json({ success: true, ...(await disableOrDeleteUser(supabase, caller.id, body, false)) });
      case 'delete_user':
        return res.status(200).json({ success: true, ...(await disableOrDeleteUser(supabase, caller.id, body, true)) });
      case 'notify_new_practice':
        return res.status(200).json({ success: true, ...(await notifyNewPractice(supabase, caller.id, caller.email ?? '', body)) });
      case 'email_status':
        await requireAdmin(supabase, caller.id);
        return res.status(200).json({ success: true, ...emailStatus() });
      case 'send_test_email':
        return res.status(200).json({ success: true, ...(await sendTestEmail(supabase, caller.id, caller.email ?? '')) });
      default:
        return res.status(400).json({ error: 'Azione non supportata' });
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Errore imprevisto' });
  }
}
