import type { SupabaseClient } from '@supabase/supabase-js';
import { isPaid } from '../../src/lib/practiceStages.js';
import { getMailProvider } from './mailer.js';
import { notifyPracticeOwner, type NotifyKind } from './vies-notify.js';
import { getPublicBaseUrl, isAdmin, readPortalRegistry } from './vies-orchestrator.js';
import { applyWorkflowEvent, loadPractice, WorkflowError, type WorkflowEvent } from './vies-workflow.js';
import type { IncomingDocument } from './vies-documents.js';

/**
 * What an administrator does to a practice by hand, whether or not a portal is connected:
 * record the company's answer (deliberated with the draft, not deliberated, more documents asked
 * for, policy issued), the payment, or reopen the practice. The same engine as the portal's own
 * callbacks applies them, so the history reads the same either way.
 *
 * Large files are not sent here (the platform limits a request to 4.5 MB): the browser stores the
 * draft in the practice's folder first, and a small one may still come as `draft.content_base64`.
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
  'portal_status',
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
  const content = typeof value.content_base64 === 'string' ? value.content_base64 : undefined;
  if (!content) throw new WorkflowError(422, 'invalid_payload', 'draft.content_base64 obbligatorio');
  return { file_name: fileName, mime_type: text(value.mime_type, 100), content_base64: content };
}

export async function runWorkflowAction(
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
          };
        }),
    };
  }

  const practiceId = required(body.practiceId, 64, 'practiceId obbligatorio');
  const force = body.force === true;
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const context = { actor: { label: (profile?.full_name as string | undefined)?.trim() || 'Amministratore', userId }, force };

  let event: WorkflowEvent;
  let notify: NotifyKind | null = null;
  let notifyDetails: { dueDate?: string | null; note?: string | null } = {};

  switch (action) {
    case 'workflow_deliberate': {
      const paymentDueDate = optionalDate(body.paymentDueDate, 'paymentDueDate');
      const note = text(body.note, 1000) ?? null;
      event = { type: 'deliberated', paymentDueDate, note, draft: parseDraft(body.draft) };
      notify = 'deliberated';
      notifyDetails = { dueDate: paymentDueDate, note };
      break;
    }
    case 'workflow_reject': {
      const reason = required(body.reason, 1000, 'Indicare il motivo');
      event = { type: 'rejected', reason };
      notify = 'rejected';
      notifyDetails = { note: reason };
      break;
    }
    case 'workflow_request_info': {
      const message = required(body.message, 2000, 'Indicare cosa serve');
      event = { type: 'info_requested', message };
      notify = 'info_requested';
      notifyDetails = { note: message };
      break;
    }
    case 'workflow_provide_info':
      event = { type: 'info_provided', message: text(body.message, 1000) ?? null };
      break;
    case 'workflow_issue':
      event = { type: 'issued', document: parseDraft(body.document) };
      notify = 'issued';
      break;
    case 'workflow_reopen':
      event = { type: 'reopened', reason: text(body.reason, 500) ?? null };
      break;
    case 'workflow_mark_sent':
      event = { type: 'sent', portalId: 'manuale', portalName: text(body.portalName, 100) ?? 'invio manuale', reference: text(body.reference, 128) ?? null };
      break;
    case 'workflow_register_payment': {
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
      return { ok: true, changed: true, practiceId: practice.id, stage: 'da_emettere' };
    }
  }

  const result = await applyWorkflowEvent(supabase, practiceId, event, context);
  if (notify && (result.changed || notify === 'deliberated')) await notifyPracticeOwner(supabase, practiceId, notify, notifyDetails);
  return { ok: true, ...result };
}
