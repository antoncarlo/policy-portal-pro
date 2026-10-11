import type { SupabaseClient } from '@supabase/supabase-js';
import { isPaid } from '../../src/lib/practiceStages.js';
import { getMailProvider } from './mailer.js';
import { logActivity } from './audit.js';
import { attributeQueuedEvents, dispatchNotifications } from './notification-dispatch.js';
import {
  assertPublicHttpsUrl,
  emitLotEvent,
  emitPracticeEvent,
  processDueDeliveries,
  retryDeliveries,
  sendTestEvent,
  type OutboundKind,
} from './vies-outbound.js';
import * as crypto from 'crypto';
import { getPublicBaseUrl, isAdmin, readPortalRegistry } from './vies-orchestrator.js';
import { applyWorkflowEvent, defaultInfoDueDate, loadPractice, parseInfoDueDate, WorkflowError, type WorkflowEvent } from './vies-workflow.js';
import type { IncomingDocument } from './vies-documents.js';

/**
 * What an administrator does to a practice by hand, whether or not a portal is connected:
 * record the company's answer (deliberated with the draft, not deliberated, more documents asked
 * for, policy issued), the payment, or reopen the practice. The same engine as the portal's own
 * callbacks applies them, so the history reads the same either way.
 *
 * Large files are not sent here (the platform limits a request to 4.5 MB): the browser stores the
 * draft in the practice's folder first and names it as `draft.storage_path`; the server checks and
 * links it. A small one may still come as `draft.content_base64`.
 */

export const WORKFLOW_ACTIONS = [
  'workflow_deliberate',
  'workflow_reject',
  'workflow_request_info',
  'workflow_provide_info',
  'workflow_issue',
  'workflow_reopen',
  'workflow_mark_sent',
  'workflow_register_payment',
  'workflow_bulk_status',
  'portal_status',
  'intake_link',
  'intake_reject',
  'webhook_list',
  'webhook_set',
  'webhook_remove',
  'webhook_test',
  'portal_test',
  'deliveries_retry',
  'deliveries_process',
] as const;
export type WorkflowActionName = (typeof WORKFLOW_ACTIONS)[number];

export const isWorkflowAction = (value: unknown): value is WorkflowActionName =>
  typeof value === 'string' && (WORKFLOW_ACTIONS as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const required = (value: unknown, max: number, message: string): string => {
  const result = text(value, max);
  if (!result) throw new WorkflowError(422, 'invalid_payload', message);
  return result;
};
const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const optionalDate = (value: unknown, label: string): string | null => {
  const date = text(value, 10);
  if (!date) return null;
  if (!isValidDate(date)) throw new WorkflowError(422, 'invalid_payload', `${label} deve essere AAAA-MM-GG`);
  return date;
};

function parseDraft(value: unknown): IncomingDocument | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new WorkflowError(422, 'invalid_payload', 'draft: formato non valido');
  const fileName = required(value.file_name, 200, 'draft.file_name obbligatorio');
  const storagePath = text(value.storage_path, 500);
  const content = typeof value.content_base64 === 'string' ? value.content_base64 : undefined;
  if (!storagePath && !content) throw new WorkflowError(422, 'invalid_payload', 'draft: indicare storage_path oppure content_base64');
  return { file_name: fileName, mime_type: text(value.mime_type, 100), content_base64: storagePath ? undefined : content, storage_path: storagePath };
}

export const BULK_STATUSES = ['in_lavorazione', 'in_attesa', 'integrazioni', 'approvata', 'rifiutata', 'completata'] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];
/** Practices handled in one call: each one goes through the whole engine (history, flow, partners). */
export const BULK_MAX = 50;

export type BulkOutcome = 'changed' | 'unchanged' | 'blocked' | 'missing' | 'error';
export interface BulkResultRow {
  practiceId: string;
  practiceNumber: string | null;
  outcome: BulkOutcome;
  /** Why it was not changed (blocked and error) or the stage reached (changed). */
  message?: string;
  to?: string;
}

interface BulkPlan {
  event: WorkflowEvent;
  announce: { kind: OutboundKind; details?: { message?: string | null; reason?: string | null; dueDate?: string | null } };
}

/**
 * The company-flow event a bulk change to `target` stands for. The same events the single-practice buttons
 * use, so the flow row, the history, the partners' notifications and the emails come out the same.
 */
function bulkPlanFor(target: BulkStatus, current: string, note: string | null): BulkPlan {
  switch (target) {
    case 'in_lavorazione':
      return { event: { type: 'reopened', reason: note }, announce: { kind: 'reopened', details: { reason: note } } };
    case 'in_attesa':
      // Back to the company's evaluation: it answers a request for more documents, or it is sent by hand.
      return current === 'integrazioni'
        ? { event: { type: 'info_provided', message: note }, announce: { kind: 'info_provided', details: { message: note } } }
        : { event: { type: 'sent', portalId: 'manuale', portalName: 'invio manuale', reference: null }, announce: { kind: 'sent' } };
    case 'integrazioni': {
      const dueDate = defaultInfoDueDate();
      return { event: { type: 'info_requested', message: note ?? '', dueDate }, announce: { kind: 'info_requested', details: { message: note, dueDate } } };
    }
    case 'approvata':
      return { event: { type: 'deliberated', note }, announce: { kind: 'deliberated' } };
    case 'rifiutata':
      return { event: { type: 'rejected', reason: note ?? '' }, announce: { kind: 'rejected', details: { reason: note } } };
    case 'completata':
      return { event: { type: 'issued' }, announce: { kind: 'issued' } };
  }
}

/**
 * Changes the status of several practices through the company-flow engine, one by one. A practice that
 * cannot make the passage (already issued, not yet paid...) is left as it is and reported with the reason;
 * the others go ahead. The partners hear of each change and the people concerned get one email per practice
 * group, as with a single change.
 */
async function runBulkStatus(supabase: SupabaseClient, userId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const target = body.status;
  if (typeof target !== 'string' || !(BULK_STATUSES as readonly string[]).includes(target)) {
    throw new WorkflowError(422, 'invalid_payload', 'Stato non valido');
  }
  const status = target as BulkStatus;
  const ids = Array.isArray(body.practiceIds) ? [...new Set(body.practiceIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))] : [];
  if (ids.length === 0) throw new WorkflowError(422, 'invalid_payload', 'Nessuna pratica selezionata');
  if (ids.length > BULK_MAX) throw new WorkflowError(422, 'invalid_payload', `Al massimo ${BULK_MAX} pratiche per volta`);
  const note = text(body.note, status === 'rifiutata' || status === 'integrazioni' ? 2000 : 1000) ?? null;
  if (status === 'rifiutata' && !note) throw new WorkflowError(422, 'invalid_payload', 'Indicare il motivo');
  if (status === 'integrazioni' && !note) throw new WorkflowError(422, 'invalid_payload', 'Indicare cosa serve');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const context = { actor: { label: (profile?.full_name as string | undefined)?.trim() || 'Amministratore', userId } };

  const results: BulkResultRow[] = [];
  const announce: Array<{ practiceId: string; plan: BulkPlan }> = [];
  for (const practiceId of ids) {
    let practiceNumber: string | null = null;
    try {
      const practice = await loadPractice(supabase, practiceId);
      practiceNumber = practice.practice_number;
      // Already there: nothing to record (and a second "sent" would overwrite the portal it really went to).
      if (practice.status === status) {
        results.push({ practiceId, practiceNumber, outcome: 'unchanged' });
        continue;
      }
      const plan = bulkPlanFor(status, practice.status, note);
      const done = await applyWorkflowEvent(supabase, practiceId, plan.event, context);
      results.push({ practiceId, practiceNumber, outcome: done.changed ? 'changed' : 'unchanged', to: done.to });
      if (done.changed) announce.push({ practiceId, plan });
    } catch (error) {
      if (error instanceof WorkflowError) {
        const outcome: BulkOutcome = error.code === 'practice_not_found' ? 'missing' : error.code === 'invalid_transition' || error.code === 'conflict' ? 'blocked' : 'error';
        results.push({ practiceId, practiceNumber, outcome, message: error.message });
      } else {
        results.push({ practiceId, practiceNumber, outcome: 'error', message: error instanceof Error ? error.message : 'Errore imprevisto' });
      }
    }
  }

  // The representatives' portals, then the emails (the database queued them as each status moved).
  await Promise.all([
    ...announce.map(({ practiceId, plan }) => emitPracticeEvent(supabase, { practiceId, kind: plan.announce.kind, origin: 'admin', details: plan.announce.details })),
  ]);
  await dispatchNotifications(supabase);

  const count = (outcome: BulkOutcome) => results.filter((row) => row.outcome === outcome).length;
  return {
    ok: true,
    status,
    requested: ids.length,
    changed: count('changed'),
    unchanged: count('unchanged'),
    blocked: count('blocked'),
    failed: count('error') + count('missing'),
    results,
  };
}

async function runWorkflowActionInner(
  supabase: SupabaseClient,
  userId: string,
  action: WorkflowActionName,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!(await isAdmin(supabase, userId))) throw new WorkflowError(403, 'forbidden', 'Solo gli amministratori possono gestire il flusso delle pratiche');

  // Connections as configured on the server: what is ready, never a URL, key or secret.
  if (action === 'portal_status') {
    const base = getPublicBaseUrl();
    return {
      ok: true,
      public_url: base,
      email_ready: getMailProvider() !== 'none',
      callback_url: `${base}/api/vies-portal-callback`,
      intake_url: `${base}/api/vies-intake`,
      intake_status_url: `${base}/api/vies-intake-status`,
      portals: readPortalRegistry()
        .filter((portal) => portal.id)
        .map((portal) => {
          let host = '';
          try {
            host = new URL(portal.url).hostname;
          } catch {
            // No valid address: shown as not ready.
          }
          return {
            id: portal.id,
            name: portal.name,
            host,
            can_send: Boolean(host && portal.apiKey),
            can_receive: Boolean(portal.callbackSecret),
            events_host: (() => {
              try {
                return new URL(portal.eventsUrl || portal.url).hostname;
              } catch {
                return '';
              }
            })(),
          };
        }),
    };
  }

  // A received lot, once its practices exist: they record where they came from, the lot is closed.
  if (action === 'intake_link') {
    const lotId = required(body.lotId, 64, 'lotId obbligatorio');
    const batchId = required(body.batchId, 64, 'batchId obbligatorio');
    const { data: lot } = await supabase.from('vies_intake_lots').select('id, status, source_portal, source_reference, api_key_id').eq('id', lotId).maybeSingle();
    if (!lot) throw new WorkflowError(404, 'lot_not_found', 'Lotto non trovato');
    if (lot.status !== 'received' && lot.status !== 'processing') throw new WorkflowError(409, 'invalid_transition', 'Il lotto è già stato chiuso');
    const { data: batch } = await supabase.from('vies_batches').select('id').eq('id', batchId).maybeSingle();
    if (!batch) throw new WorkflowError(404, 'batch_not_found', 'Lotto VIES non trovato');
    const { data: jobs, error: jobsError } = await supabase.from('vies_jobs').select('external_reference').eq('batch_id', batchId).limit(5000);
    if (jobsError) throw new WorkflowError(500, 'database', jobsError.message);
    const practiceIds = (jobs ?? []).map((job) => job.external_reference as string | null).filter((id): id is string => Boolean(id));
    for (let start = 0; start < practiceIds.length; start += 200) {
      const rows = practiceIds.slice(start, start + 200).map((id) => ({ practice_id: id, source_portal: lot.source_portal, source_reference: lot.source_reference }));
      const { error } = await supabase.from('practice_workflow').upsert(rows, { onConflict: 'practice_id' });
      if (error) throw new WorkflowError(500, 'database', `Origine delle pratiche non registrata: ${error.message}`);
    }
    // The practices belong to the key that sent the lot too: the representative reads them (status,
    // documents) through the usual API with its own key.
    if (lot.api_key_id) {
      for (let start = 0; start < practiceIds.length; start += 200) {
        const { error } = await supabase.from('practices').update({ api_key_id: lot.api_key_id }).in('id', practiceIds.slice(start, start + 200)).is('api_key_id', null);
        if (error) throw new WorkflowError(500, 'database', `Pratiche non collegate alla chiave API: ${error.message}`);
      }
    }
    const { error: closeError } = await supabase
      .from('vies_intake_lots')
      .update({ status: 'processed', batch_id: batchId, processed_at: new Date().toISOString() })
      .eq('id', lot.id);
    if (closeError) throw new WorkflowError(500, 'database', closeError.message);
    const notified = await emitLotEvent(supabase, { lotId: lot.id as string, kind: 'processed' });
    return { ok: true, linked: practiceIds.length, notified: notified.queued > 0 };
  }

  // A received lot the administrator turns down: the representative is told with the reason.
  if (action === 'intake_reject') {
    const lotId = required(body.lotId, 64, 'lotId obbligatorio');
    const reason = required(body.reason, 1000, 'Indicare il motivo');
    const { data, error } = await supabase
      .from('vies_intake_lots')
      .update({ status: 'rejected', rejected_reason: reason })
      .eq('id', lotId)
      .in('status', ['received', 'processing'])
      .select('id');
    if (error) throw new WorkflowError(500, 'database', error.message);
    if (!data?.length) throw new WorkflowError(409, 'invalid_transition', 'Il lotto non è più da lavorare');
    const notified = await emitLotEvent(supabase, { lotId, kind: 'rejected' });
    return { ok: true, notified: notified.queued > 0 };
  }

  // Notifications going out to the representatives' portals (one address and secret per API key).
  if (action === 'webhook_list') {
    const [{ data: keys }, { data: hooks }, { data: pending }, { data: mappings }] = await Promise.all([
      supabase.from('api_keys').select('id, name, key_prefix, partner_email, is_active').order('created_at', { ascending: false }).limit(200),
      supabase.from('partner_webhooks').select('api_key_id, url, active, created_at, updated_at'),
      supabase.from('outbound_deliveries').select('target_id, status').eq('target_kind', 'source').in('status', ['pending', 'failed']).limit(5000),
      supabase.from('api_key_user_mapping').select('api_key_id'),
    ]);
    const hookByKey = new Map((hooks ?? []).map((hook) => [hook.api_key_id as string, hook]));
    const mapped = new Set((mappings ?? []).map((row) => row.api_key_id as string));
    const counts = new Map<string, { pending: number; failed: number }>();
    for (const row of pending ?? []) {
      const entry = counts.get(row.target_id as string) ?? { pending: 0, failed: 0 };
      if (row.status === 'pending') entry.pending += 1;
      else entry.failed += 1;
      counts.set(row.target_id as string, entry);
    }
    return {
      ok: true,
      keys: (keys ?? []).map((key) => ({
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        partner_email: key.partner_email,
        is_active: key.is_active,
        mapped: mapped.has(key.id as string),
        webhook: hookByKey.get(key.id as string) ?? null,
        pending: counts.get(key.id as string)?.pending ?? 0,
        failed: counts.get(key.id as string)?.failed ?? 0,
      })),
    };
  }

  if (action === 'webhook_set') {
    const apiKeyId = required(body.apiKeyId, 64, 'apiKeyId obbligatorio');
    const { data: key } = await supabase.from('api_keys').select('id, name').eq('id', apiKeyId).maybeSingle();
    if (!key) throw new WorkflowError(404, 'key_not_found', 'Chiave API non trovata');
    const { data: existing } = await supabase.from('partner_webhooks').select('api_key_id, url, active').eq('api_key_id', apiKeyId).maybeSingle();
    const url = text(body.url, 500) ?? (existing?.url as string | undefined);
    if (!url) throw new WorkflowError(422, 'invalid_payload', 'Indicare l\'indirizzo che riceve le notifiche');
    try {
      assertPublicHttpsUrl(url);
    } catch (error) {
      throw new WorkflowError(422, 'invalid_url', error instanceof Error ? error.message : 'Indirizzo non valido');
    }
    const active = typeof body.active === 'boolean' ? body.active : (existing?.active as boolean | undefined) ?? true;
    // The secret is shown once, when it is made: only the server keeps it afterwards.
    const secret = !existing || body.rotateSecret === true ? `whsec_${crypto.randomBytes(32).toString('hex')}` : null;
    const row = { api_key_id: apiKeyId, url, active, ...(secret ? { secret } : {}) };
    const { error } = await supabase.from('partner_webhooks').upsert(row, { onConflict: 'api_key_id' });
    if (error) throw new WorkflowError(500, 'database', error.message);
    return { ok: true, secret, created: !existing };
  }

  if (action === 'webhook_remove') {
    const apiKeyId = required(body.apiKeyId, 64, 'apiKeyId obbligatorio');
    const { error } = await supabase.from('partner_webhooks').delete().eq('api_key_id', apiKeyId);
    if (error) throw new WorkflowError(500, 'database', error.message);
    return { ok: true };
  }

  if (action === 'webhook_test') {
    const apiKeyId = required(body.apiKeyId, 64, 'apiKeyId obbligatorio');
    const { data: key } = await supabase.from('api_keys').select('id, name').eq('id', apiKeyId).maybeSingle();
    if (!key) throw new WorkflowError(404, 'key_not_found', 'Chiave API non trovata');
    const result = await sendTestEvent(supabase, { kind: 'source', id: apiKeyId, label: key.name as string });
    return { ok: true, ...result };
  }

  if (action === 'portal_test') {
    const portalId = required(body.portalId, 64, 'portalId obbligatorio');
    const portal = readPortalRegistry().find((candidate) => candidate.id === portalId);
    if (!portal) throw new WorkflowError(404, 'portal_not_found', 'Portale non configurato');
    const result = await sendTestEvent(supabase, { kind: 'portal', id: portal.id, label: portal.name });
    return { ok: true, ...result };
  }

  if (action === 'deliveries_retry') {
    const id = text(body.deliveryId, 64);
    const result = await retryDeliveries(supabase, id ? { id } : {});
    return { ok: true, ...result };
  }

  if (action === 'deliveries_process') {
    const result = await processDueDeliveries(supabase, { limit: 25 });
    return { ok: true, ...result };
  }

  if (action === 'workflow_bulk_status') return runBulkStatus(supabase, userId, body);

  const practiceId = required(body.practiceId, 64, 'practiceId obbligatorio');
  const force = body.force === true;
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const context = { actor: { label: (profile?.full_name as string | undefined)?.trim() || 'Amministratore', userId }, force };

  let event: WorkflowEvent;
  let announce: { kind: OutboundKind; details?: { message?: string | null; reason?: string | null; dueDate?: string | null } } | null = null;
  let policyNumber: string | undefined;

  switch (action) {
    case 'workflow_deliberate': {
      const paymentDueDate = optionalDate(body.paymentDueDate, 'paymentDueDate');
      const note = text(body.note, 1000) ?? null;
      event = { type: 'deliberated', paymentDueDate, note, draft: parseDraft(body.draft) };
      announce = { kind: 'deliberated' };
      break;
    }
    case 'workflow_reject': {
      const reason = required(body.reason, 1000, 'Indicare il motivo');
      event = { type: 'rejected', reason };
      announce = { kind: 'rejected', details: { reason } };
      break;
    }
    case 'workflow_request_info': {
      const message = required(body.message, 2000, 'Indicare cosa serve');
      const dueDate = parseInfoDueDate(body.dueDate) ?? defaultInfoDueDate();
      event = { type: 'info_requested', message, dueDate };
      announce = { kind: 'info_requested', details: { message, dueDate } };
      break;
    }
    case 'workflow_provide_info': {
      const message = text(body.message, 1000) ?? null;
      event = { type: 'info_provided', message };
      announce = { kind: 'info_provided', details: { message } };
      break;
    }
    case 'workflow_issue':
      event = { type: 'issued', document: parseDraft(body.document) };
      announce = { kind: 'issued' };
      policyNumber = text(body.policyNumber, 100);
      break;
    case 'workflow_reopen': {
      const reason = text(body.reason, 500) ?? null;
      event = { type: 'reopened', reason };
      announce = { kind: 'reopened', details: { reason } };
      break;
    }
    case 'workflow_mark_sent':
      event = { type: 'sent', portalId: 'manuale', portalName: text(body.portalName, 100) ?? 'invio manuale', reference: text(body.reference, 128) ?? null };
      announce = { kind: 'sent' };
      break;
    case 'workflow_register_payment': {
      const startedAt = new Date();
      const practice = await loadPractice(supabase, practiceId);
      if (practice.status !== 'approvata') throw new WorkflowError(409, 'invalid_transition', 'Il pagamento si registra su una pratica deliberata');
      const paidAt = optionalDate(body.paymentDate, 'paymentDate') ?? new Date().toISOString().slice(0, 10);
      if (isPaid(practice.financial_status)) return { ok: true, changed: false, practiceId: practice.id };
      const { data, error } = await supabase
        .from('practices')
        .update({ financial_status: 'incassata', payment_date: paidAt })
        .eq('id', practice.id)
        .eq('status', 'approvata')
        .select('id');
      if (error) throw new WorkflowError(500, 'database', `Registrazione del pagamento non riuscita: ${error.message}`);
      if (!data?.length) throw new WorkflowError(409, 'conflict', 'La pratica è stata modificata nel frattempo: riprova');
      await supabase.from('practice_events').insert({
        practice_id: practice.id,
        event_type: 'workflow_paid',
        description: `Pagamento registrato (${paidAt.split('-').reverse().join('/')}) · ${context.actor.label}`,
        created_by: userId,
      });
      await attributeQueuedEvents(supabase, practice.id, userId, startedAt);
      // The company learns that the payment is in: it can issue the policy.
      await Promise.all([emitPracticeEvent(supabase, { practiceId: practice.id, kind: 'paid', origin: 'admin' }), dispatchNotifications(supabase)]);
      return { ok: true, changed: true, practiceId: practice.id, stage: 'da_emettere' };
    }
    default:
      throw new WorkflowError(400, 'invalid_action', 'Azione non supportata');
  }

  const result = await applyWorkflowEvent(supabase, practiceId, event, context);
  if (policyNumber) {
    // The number is recorded only where the practice has none yet.
    await supabase.from('practices').update({ policy_number: policyNumber }).eq('id', practiceId).is('policy_number', null);
  }
  // A second answer for a practice already deliberated (new draft, new date) is passed on to the company too.
  const changed = result.changed || action === 'workflow_deliberate';
  await Promise.all([
    announce && changed ? emitPracticeEvent(supabase, { practiceId, kind: announce.kind, origin: 'admin', details: announce.details }) : null,
    // The people concerned by email: the queue was filled by the database when the status changed.
    dispatchNotifications(supabase),
  ]);
  return { ok: true, ...result };
}

const PRACTICE_ACTIONS = new Set<WorkflowActionName>([
  'workflow_deliberate', 'workflow_reject', 'workflow_request_info', 'workflow_provide_info', 'workflow_issue', 'workflow_reopen', 'workflow_mark_sent', 'workflow_register_payment',
]);

/**
 * Runs the action and leaves a line in the audit log: who decided what on which practice (the database
 * only sees the service role here), who changed a partner's notification address, who rejected a lot.
 */
export async function runWorkflowAction(
  supabase: SupabaseClient,
  userId: string,
  action: WorkflowActionName,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await runWorkflowActionInner(supabase, userId, action, body);
  const id = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : null);
  if (action === 'workflow_bulk_status') {
    // One line for the operation (the database's own audit rows carry each practice's change).
    await logActivity(supabase, {
      actorId: userId,
      action: 'practice.bulk_status',
      target: { table: 'practices', id: null },
      details: { status: result.status, requested: result.requested, changed: result.changed, unchanged: result.unchanged, blocked: result.blocked, failed: result.failed },
    });
  } else if (PRACTICE_ACTIONS.has(action)) {
    await logActivity(supabase, {
      actorId: userId,
      action: `practice.${action.replace('workflow_', '')}`,
      target: { table: 'practices', id: id('practiceId') },
      details: { changed: result.changed ?? null, to: result.to ?? result.stage ?? null },
    });
  } else if (action === 'webhook_set' || action === 'webhook_remove') {
    await logActivity(supabase, { actorId: userId, action: `partner.${action}`, target: { table: 'partner_webhooks', id: id('apiKeyId') }, details: { rotated_secret: body.rotateSecret === true } });
  } else if (action === 'intake_reject' || action === 'intake_link') {
    await logActivity(supabase, { actorId: userId, action: `lot.${action.replace('intake_', '')}`, target: { table: 'vies_intake_lots', id: id('lotId') } });
  }
  return result;
}
