import { SIGNATURE_TOLERANCE_SECONDS, signCallback, verifyCallbackSignature } from './vies-signature.js';

export { SIGNATURE_TOLERANCE_SECONDS, signCallback, verifyCallbackSignature };
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncomingDocument } from './vies-documents.js';
import { dispatchNotifications } from './notification-dispatch.js';
import { emitPracticeEvent, type OutboundKind } from './vies-outbound.js';
import { portalDocumentHosts, type ViesPortal } from './vies-orchestrator.js';
import { applyWorkflowEvent, findPracticeForPortal, loadPractice, parseInfoDueDate, WorkflowError, type WorkflowEvent } from './vies-workflow.js';
import { recordPolicyNumber } from './policy-number.js';

/**
 * Answers from the company's portal: a practice received, more documents asked for, deliberated
 * (with the draft to pay), not deliberated, policy issued.
 *
 * Every call is signed. The portal sends
 *   X-Portal-Id    its id in VIES_PORTALS
 *   X-Timestamp    seconds since 1970; calls older than five minutes are refused
 *   X-Signature    "sha256=" + hex(HMAC-SHA256(secret, timestamp + "." + raw body))
 * and every event carries an `event_id`: the same event sent twice is applied once.
 */

export const MAX_CALLBACK_BODY_BYTES = 4 * 1024 * 1024;

export const CALLBACK_EVENT_TYPES = [
  'practice.received',
  'practice.info_requested',
  'practice.deliberated',
  'practice.rejected',
  'practice.issued',
] as const;
export type CallbackEventType = (typeof CALLBACK_EVENT_TYPES)[number];


// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface CallbackEvent {
  eventId: string;
  type: CallbackEventType;
  occurredAt?: string;
  practice: { id?: string; number?: string; reference?: string };
  paymentDueDate?: string | null;
  note?: string | null;
  reason?: string;
  message?: string;
  dueDate?: string;
  policyNumber?: string | null;
  document?: IncomingDocument | null;
  /** deliberated: the policy copy for the company, the one the representative signs. */
  companyCopy?: IncomingDocument | null;
  /** issued: every copy of the issued policy (data.documents). */
  documents?: IncomingDocument[];
}

const MAX_ISSUED_COPIES = 10;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/** The company's due date when it is a real day that is not past; otherwise none (the default term applies). */
function usableDueDate(value: string | undefined): string | null {
  try {
    return parseInfoDueDate(value);
  } catch {
    return null;
  }
}

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function parseDocument(value: unknown, label: string): IncomingDocument | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new Error(`${label}: formato non valido`);
  const fileName = text(value.file_name, 200);
  if (!fileName) throw new Error(`${label}: file_name obbligatorio`);
  const content = typeof value.content_base64 === 'string' ? value.content_base64 : undefined;
  const url = text(value.url, 2000);
  if (!content && !url) throw new Error(`${label}: indicare content_base64 oppure url`);
  return { file_name: fileName, mime_type: text(value.mime_type, 100), content_base64: content, url };
}

export function parseCallbackEvent(body: unknown): { ok: true; event: CallbackEvent } | { ok: false; message: string } {
  try {
    if (!isRecord(body)) throw new Error('il corpo deve essere un oggetto JSON');
    const eventId = text(body.event_id, 128);
    if (!eventId) throw new Error('event_id obbligatorio');
    const type = body.event_type;
    if (typeof type !== 'string' || !(CALLBACK_EVENT_TYPES as readonly string[]).includes(type)) {
      throw new Error(`event_type non valido (ammessi: ${CALLBACK_EVENT_TYPES.join(', ')})`);
    }
    const practice = isRecord(body.practice) ? body.practice : {};
    const ref = { id: text(practice.id, 64), number: text(practice.number, 64), reference: text(practice.reference, 128) };
    if (!ref.id && !ref.number && !ref.reference) throw new Error('practice: indicare id, number o reference');

    const data = isRecord(body.data) ? body.data : {};
    const event: CallbackEvent = { eventId, type: type as CallbackEventType, practice: ref };
    const occurred = text(body.occurred_at, 40);
    if (occurred) {
      const time = Date.parse(occurred);
      if (Number.isNaN(time)) throw new Error('occurred_at non è una data valida');
      if (time <= Date.now() + SIGNATURE_TOLERANCE_SECONDS * 1000) event.occurredAt = new Date(time).toISOString();
    }

    switch (event.type) {
      case 'practice.deliberated': {
        const due = text(data.payment_due_date, 10);
        if (due && !isValidDate(due)) throw new Error('data.payment_due_date deve essere AAAA-MM-GG');
        event.paymentDueDate = due ?? null;
        event.note = text(data.note, 1000) ?? null;
        // The policy number comes with the copy to sign: the documents to sign are filled in with it.
        event.policyNumber = text(data.policy_number, 100) ?? null;
        event.document = parseDocument(data.draft, 'data.draft');
        event.companyCopy = parseDocument(data.policy_copy, 'data.policy_copy');
        break;
      }
      case 'practice.rejected':
        event.reason = text(data.reason, 1000);
        if (!event.reason) throw new Error('data.reason obbligatorio');
        break;
      case 'practice.info_requested':
        event.message = text(data.message, 2000);
        if (!event.message) throw new Error('data.message obbligatorio');
        // Optional: the date the documents are due by; a missing or unusable one means the default term.
        event.dueDate = text(data.due_date, 10);
        break;
      case 'practice.issued': {
        event.policyNumber = text(data.policy_number, 100) ?? null;
        event.document = parseDocument(data.document, 'data.document');
        if (data.documents !== undefined && data.documents !== null) {
          if (!Array.isArray(data.documents)) throw new Error('data.documents deve essere un elenco');
          if (data.documents.length > MAX_ISSUED_COPIES) throw new Error(`data.documents: al massimo ${MAX_ISSUED_COPIES} copie`);
          event.documents = data.documents.map((item, index) => parseDocument(item, `data.documents[${index}]`)).filter((item): item is IncomingDocument => Boolean(item));
        }
        break;
      }
      case 'practice.received':
        if (!ref.reference) throw new Error('practice.reference obbligatorio: è il riferimento del portale');
        break;
    }
    return { ok: true, event };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'payload non valido' };
  }
}

/** The payload as stored in the log: documents' content is left out. */
export function redactForLog(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(redactForLog);
  if (!isRecord(body)) return body;
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      key === 'content_base64' && typeof value === 'string' ? `[omesso: ${value.length} caratteri]` : redactForLog(value),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface CallbackRequest {
  headers: Record<string, string | undefined>;
  rawBody: string;
  nowSeconds?: number;
}

export interface CallbackResponse {
  status: number;
  body: Record<string, unknown>;
}

const reply = (status: number, body: Record<string, unknown>): CallbackResponse => ({ status, body });

/**
 * Where a practice went: the flow row says so; for practices sent before the flow existed, the
 * completed send in the lot's queue does. A practice that was never sent to the portal is not its to change.
 */
async function wasSentTo(supabase: SupabaseClient, practiceId: string, portalId: string): Promise<boolean> {
  const { data: workflow } = await supabase.from('practice_workflow').select('target_portal').eq('practice_id', practiceId).maybeSingle();
  if (workflow?.target_portal) return workflow.target_portal === portalId;
  const { data: jobs } = await supabase.from('vies_jobs').select('agent_result').eq('external_reference', practiceId).eq('status', 'completed').limit(20);
  return (jobs ?? []).some((job) => (job.agent_result as { portal_id?: string } | null)?.portal_id === portalId);
}

export async function handlePortalCallback(
  supabase: SupabaseClient,
  portals: ViesPortal[],
  request: CallbackRequest,
): Promise<CallbackResponse> {
  const portal = portals.find((candidate) => candidate.id && candidate.id === request.headers['x-portal-id']?.trim());
  // Same answer for an unknown portal, one without a secret and a wrong signature.
  if (!portal || !portal.callbackSecret) return reply(401, { ok: false, error: 'unauthorized', message: 'Portale o firma non validi' });
  const check = verifyCallbackSignature({
    secret: portal.callbackSecret,
    timestamp: request.headers['x-timestamp'],
    signature: request.headers['x-signature'],
    rawBody: request.rawBody,
    nowSeconds: request.nowSeconds,
  });
  if (!check.ok) return reply(401, { ok: false, error: 'unauthorized', code: check.code, message: 'Portale o firma non validi' });

  let json: unknown;
  try {
    json = JSON.parse(request.rawBody);
  } catch {
    return reply(400, { ok: false, error: 'invalid_json', message: 'Il corpo non è un JSON valido' });
  }
  const parsed = parseCallbackEvent(json);
  if (!parsed.ok) return reply(400, { ok: false, error: 'invalid_payload', message: parsed.message });
  const { event } = parsed;

  // Log first: the unique index on (portal, event id) is what makes a repeated event harmless.
  const { data: logged, error: logError } = await supabase
    .from('integration_events')
    .insert({
      direction: 'inbound',
      portal_id: portal.id,
      event_type: event.type,
      external_event_id: event.eventId,
      status: 'received',
      payload: redactForLog(json),
    })
    .select('id')
    .single();

  let logId: string | undefined = logged?.id as string | undefined;
  if (logError) {
    if (logError.code !== '23505') return reply(503, { ok: false, error: 'temporarily_unavailable', message: 'Registro non disponibile, riprovare' });
    const { data: existing } = await supabase
      .from('integration_events')
      .select('id, status, practice_id')
      .eq('portal_id', portal.id)
      .eq('external_event_id', event.eventId)
      .eq('direction', 'inbound')
      .maybeSingle();
    if (!existing) return reply(503, { ok: false, error: 'temporarily_unavailable', message: 'Registro non disponibile, riprovare' });
    if (existing.status === 'processed' || existing.status === 'ignored') {
      return reply(200, { ok: true, duplicate: true, event_id: event.eventId, practice_id: existing.practice_id });
    }
    // Received or failed before: apply it again.
    logId = existing.id as string;
    await supabase.from('integration_events').update({ status: 'received', error: null, processed_at: null }).eq('id', logId);
  }

  const settle = async (status: 'processed' | 'ignored' | 'failed', practiceId: string | null, error?: string) => {
    if (!logId) return;
    await supabase
      .from('integration_events')
      .update({ status, practice_id: practiceId, error: error ?? null, processed_at: new Date().toISOString() })
      .eq('id', logId);
  };

  let practiceId: string | null = null;
  try {
    practiceId = await findPracticeForPortal(supabase, portal.id, {
      practice_id: event.practice.id,
      practice_number: event.practice.number,
      reference: event.practice.reference,
    });
    if (!practiceId) throw new WorkflowError(404, 'practice_not_found', 'Pratica non trovata');

    // A portal answers only for the practices that went to it.
    if (!(await wasSentTo(supabase, practiceId, portal.id))) {
      throw new WorkflowError(403, 'practice_not_assigned', 'La pratica non è stata inviata a questo portale');
    }

    const hosts = portalDocumentHosts(portal);
    const context = { actor: { label: portal.name } };
    const at = event.occurredAt;
    let workflowEvent: WorkflowEvent | null = null;
    switch (event.type) {
      case 'practice.received': {
        const practice = await loadPractice(supabase, practiceId);
        const { error } = await supabase
          .from('practice_workflow')
          .upsert({ practice_id: practice.id, target_portal: portal.id, target_reference: event.practice.reference }, { onConflict: 'practice_id' });
        if (error) throw new WorkflowError(500, 'database', error.message);
        await supabase.from('practice_events').insert({
          practice_id: practice.id,
          event_type: 'workflow_received',
          description: `Presa in carico dal portale ${portal.name} (riferimento ${event.practice.reference})`,
          created_by: practice.user_id,
        });
        await settle('processed', practice.id);
        return reply(200, { ok: true, event_id: event.eventId, practice_id: practice.id, practice_number: practice.practice_number });
      }
      case 'practice.info_requested':
        workflowEvent = { type: 'info_requested', message: event.message ?? '', dueDate: usableDueDate(event.dueDate) };
        break;
      case 'practice.deliberated':
        workflowEvent = { type: 'deliberated', at, paymentDueDate: event.paymentDueDate, note: event.note, draft: event.document, companyCopy: event.companyCopy, documentHosts: hosts };
        break;
      case 'practice.rejected':
        workflowEvent = { type: 'rejected', at, reason: event.reason ?? '' };
        break;
      case 'practice.issued':
        workflowEvent = { type: 'issued', at, document: event.document, documents: event.documents, documentHosts: hosts };
        break;
    }
    if (!workflowEvent) throw new WorkflowError(400, 'invalid_payload', 'Evento non gestito');

    const result = await applyWorkflowEvent(supabase, practiceId, workflowEvent, context);
    if (event.type === 'practice.issued' || event.type === 'practice.deliberated') await recordPolicyNumber(supabase, practiceId, event.policyNumber);
    await settle(result.changed ? 'processed' : 'ignored', practiceId);
    const kind: Record<string, OutboundKind> = {
      'practice.deliberated': 'deliberated',
      'practice.info_requested': 'info_requested',
      'practice.rejected': 'rejected',
      'practice.issued': 'issued',
    };
    if (result.changed || event.type === 'practice.deliberated') {
      // The representative who sent the practice in by notification; the people concerned by email
      // (the database queued the status change).
      await Promise.all([
        emitPracticeEvent(supabase, {
          practiceId,
          kind: kind[event.type],
          origin: 'portal',
          details: { message: event.message, reason: event.reason },
        }),
        dispatchNotifications(supabase),
      ]);
    }
    return reply(200, {
      ok: true,
      event_id: event.eventId,
      practice_id: result.practiceId,
      practice_number: result.practiceNumber,
      stage: result.to,
      changed: result.changed,
    });
  } catch (error) {
    if (error instanceof WorkflowError) {
      await settle('failed', practiceId, error.message);
      return reply(error.status, { ok: false, error: error.code, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    await settle('failed', practiceId, message);
    return reply(500, { ok: false, error: 'internal_error', message: 'Elaborazione non riuscita, riprovare' });
  }
}
