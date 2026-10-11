import type { SupabaseClient } from '@supabase/supabase-js';
import { isPaid, stageOf, type PracticeStage } from '../../src/lib/practiceStages.js';
import { attachPracticeDocument, DocumentError, type IncomingDocument } from './vies-documents.js';

/**
 * Passages of a practice through the company flow:
 *   da lavorare -> (sent) in valutazione -> (deliberated) deliberata -> pagata -> (issued) emessa
 *                    |    ^                \-> (rejected) non deliberata
 *                    v    | (info_provided)
 *                 integrazioni richieste (info_requested)
 * One place applies them, whoever asks: the company's portal calling back, an administrator in the
 * portal, or the portal's own send. Every change leaves a line in the practice's history.
 */

export type WorkflowEvent =
  | { type: 'sent'; portalId: string; portalName?: string; reference?: string | null; at?: string }
  | { type: 'deliberated'; at?: string; paymentDueDate?: string | null; note?: string | null; draft?: IncomingDocument | null; documentHosts?: string[] }
  | { type: 'rejected'; reason: string; at?: string }
  | { type: 'info_requested'; message: string }
  | { type: 'info_provided'; message?: string | null }
  | { type: 'issued'; at?: string; document?: IncomingDocument | null; documentHosts?: string[] }
  | { type: 'reopened'; reason?: string | null };

export interface WorkflowContext {
  /** Who or what causes the change; shown in the history. */
  actor: { label: string; userId?: string | null };
  /** Administrator override of the passage rules. */
  force?: boolean;
}

export interface WorkflowResult {
  practiceId: string;
  practiceNumber: string;
  from: PracticeStage;
  to: PracticeStage;
  /** False when the practice was already there (the data is still updated). */
  changed: boolean;
  documentId?: string;
}

export class WorkflowError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Status = 'in_lavorazione' | 'in_attesa' | 'integrazioni' | 'approvata' | 'rifiutata' | 'completata';

interface Plan {
  toStatus: Status;
  /** False: the practice is already in the target status. */
  moves: boolean;
}

const BLOCKED = (message: string) => new WorkflowError(409, 'invalid_transition', message);

/** Pure rules: from the current status (and payment) to the target of the event. */
export function planTransition(status: string, paid: boolean, event: WorkflowEvent['type'], force = false): Plan {
  const current = status as Status;
  const fail = (message: string): never => {
    throw BLOCKED(message);
  };
  switch (event) {
    case 'sent':
      if (current === 'in_attesa') return { toStatus: 'in_attesa', moves: false };
      // Sending again after the company asked for more documents answers the request.
      if (current === 'in_lavorazione' || current === 'integrazioni' || force) return { toStatus: 'in_attesa', moves: true };
      return fail('La pratica non è più da lavorare: non può essere inviata al portale');
    case 'info_requested':
      if (current === 'integrazioni') return { toStatus: 'integrazioni', moves: false };
      if (current === 'in_attesa' || current === 'in_lavorazione' || force) return { toStatus: 'integrazioni', moves: true };
      return fail(current === 'approvata' ? 'La pratica è già stata deliberata' : current === 'rifiutata' ? 'La pratica risulta non deliberata' : 'La pratica è già emessa');
    case 'info_provided':
      if (current === 'in_attesa') return { toStatus: 'in_attesa', moves: false };
      if (current === 'integrazioni' || force) return { toStatus: 'in_attesa', moves: true };
      return fail('Per questa pratica non risultano integrazioni richieste');
    case 'deliberated':
      if (current === 'approvata' && !paid) return { toStatus: 'approvata', moves: false };
      if (current === 'in_attesa' || current === 'integrazioni' || current === 'in_lavorazione' || force) {
        return { toStatus: 'approvata', moves: current !== 'approvata' };
      }
      if (current === 'approvata') return fail('La pratica è già stata pagata: la deliberazione non si può cambiare');
      return fail(current === 'rifiutata' ? 'La pratica risulta non deliberata' : 'La pratica è già emessa');
    case 'rejected':
      if (current === 'rifiutata') return { toStatus: 'rifiutata', moves: false };
      if (current === 'in_lavorazione' || current === 'in_attesa' || current === 'integrazioni' || (current === 'approvata' && !paid) || force) {
        return { toStatus: 'rifiutata', moves: true };
      }
      return fail(current === 'completata' ? 'La pratica è già emessa' : 'La pratica è già stata pagata: non si può rifiutare');
    case 'issued':
      if (current === 'completata') return { toStatus: 'completata', moves: false };
      if (current === 'approvata' && (paid || force)) return { toStatus: 'completata', moves: true };
      if (force) return { toStatus: 'completata', moves: true };
      return fail(current === 'approvata' ? 'La pratica deve essere pagata prima dell\'emissione' : 'La pratica non è stata deliberata');
    case 'reopened':
      return { toStatus: 'in_lavorazione', moves: current !== 'in_lavorazione' };
  }
}

const EVENT_COLUMNS: Record<WorkflowEvent['type'], string> = {
  sent: 'sent',
  deliberated: 'deliberated',
  rejected: 'rejected',
  info_requested: 'info_requested',
  info_provided: 'info_provided',
  issued: 'issued',
  reopened: 'reopened',
};

const formatItalianDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

function describe(event: WorkflowEvent, actor: string): string {
  switch (event.type) {
    case 'sent':
      return `Inviata al portale ${event.portalName ?? event.portalId}${event.reference ? ` (riferimento ${event.reference})` : ''}`;
    case 'deliberated': {
      const parts = [`Deliberata dalla compagnia: bozza da pagare${actor ? ` (${actor})` : ''}`];
      if (event.paymentDueDate) parts.push(`pagamento entro il ${formatItalianDate(event.paymentDueDate)}`);
      if (event.note) parts.push(event.note);
      return parts.join(' · ');
    }
    case 'rejected':
      return `Non deliberata dalla compagnia: ${event.reason}`;
    case 'info_requested':
      return `Integrazioni richieste dalla compagnia: ${event.message}`;
    case 'info_provided':
      return `Integrazioni inviate alla compagnia${event.message ? `: ${event.message}` : ''}`;
    case 'issued':
      return `Polizza emessa${actor ? ` (${actor})` : ''}`;
    case 'reopened':
      return `Pratica riaperta${event.reason ? `: ${event.reason}` : ''}`;
  }
}

const nowIso = () => new Date().toISOString();

function workflowColumns(event: WorkflowEvent): Record<string, unknown> {
  switch (event.type) {
    case 'sent':
      return {
        target_portal: event.portalId,
        ...(event.reference ? { target_reference: event.reference } : {}),
        sent_at: event.at ?? nowIso(),
      };
    case 'deliberated':
      return {
        deliberated_at: event.at ?? nowIso(),
        deliberation_note: event.note ?? null,
        payment_due_date: event.paymentDueDate ?? null,
        rejected_at: null,
        rejection_reason: null,
      };
    case 'rejected':
      return { rejected_at: event.at ?? nowIso(), rejection_reason: event.reason };
    // The request itself stays in the practice's history; the workflow row only records that it exists.
    case 'info_requested':
    case 'info_provided':
      return {};
    case 'issued':
      return { issued_at: event.at ?? nowIso() };
    case 'reopened':
      return {
        deliberated_at: null,
        deliberation_note: null,
        payment_due_date: null,
        rejected_at: null,
        rejection_reason: null,
        issued_at: null,
      };
  }
}

export interface PracticeRow {
  id: string;
  practice_number: string;
  practice_type: string;
  status: string;
  financial_status: string | null;
  user_id: string;
  client_name: string;
}

const PRACTICE_COLUMNS = 'id, practice_number, practice_type, status, financial_status, user_id, client_name';

export async function loadPractice(supabase: SupabaseClient, practiceId: string): Promise<PracticeRow> {
  const { data, error } = await supabase.from('practices').select(PRACTICE_COLUMNS).eq('id', practiceId).maybeSingle();
  if (error) throw new WorkflowError(500, 'database', `Lettura della pratica non riuscita: ${error.message}`);
  if (!data) throw new WorkflowError(404, 'practice_not_found', 'Pratica non trovata');
  return data as PracticeRow;
}

export async function applyWorkflowEvent(
  supabase: SupabaseClient,
  practiceId: string,
  event: WorkflowEvent,
  context: WorkflowContext,
): Promise<WorkflowResult> {
  const practice = await loadPractice(supabase, practiceId);
  const paid = isPaid(practice.financial_status);
  const from = stageOf(practice);
  const plan = planTransition(practice.status, paid, event.type, context.force === true);

  // Documents first: if it cannot be stored, nothing else changes.
  let documentId: string | undefined;
  const document = event.type === 'deliberated' ? event.draft : event.type === 'issued' ? event.document : null;
  if (document) {
    try {
      const stored = await attachPracticeDocument(supabase, practice, document, event.type === 'deliberated' ? 'bozza_deliberata' : 'polizza_emessa', {
        documentHosts: 'documentHosts' in event ? event.documentHosts : undefined,
        uploadedBy: context.actor.userId ?? null,
      });
      documentId = stored.id;
    } catch (error) {
      if (error instanceof DocumentError) throw new WorkflowError(422, 'invalid_document', error.message);
      throw error;
    }
  }

  if (plan.moves) {
    const { data, error } = await supabase
      .from('practices')
      .update({ status: plan.toStatus })
      .eq('id', practice.id)
      .eq('status', practice.status)
      .select('id');
    if (error) throw new WorkflowError(500, 'database', `Aggiornamento dello stato non riuscito: ${error.message}`);
    // Somebody else changed the practice in the meantime.
    if (!data?.length) throw new WorkflowError(409, 'conflict', 'La pratica è stata modificata nel frattempo: riprova');
  }

  const { error: workflowError } = await supabase
    .from('practice_workflow')
    .upsert({ practice_id: practice.id, ...workflowColumns(event) }, { onConflict: 'practice_id' });
  if (workflowError) throw new WorkflowError(500, 'database', `Salvataggio del flusso non riuscito: ${workflowError.message}`);

  const { error: historyError } = await supabase.from('practice_events').insert({
    practice_id: practice.id,
    event_type: `workflow_${EVENT_COLUMNS[event.type]}`,
    description: describe(event, context.actor.label),
    created_by: context.actor.userId ?? practice.user_id,
  });
  if (historyError) console.error('workflow: storico non scritto:', historyError.message);

  const to = plan.toStatus === practice.status ? from : stageOf({ status: plan.toStatus, financial_status: practice.financial_status });
  return { practiceId: practice.id, practiceNumber: practice.practice_number, from, to, changed: plan.moves, documentId };
}

/** Finds the practice a portal is talking about: our id, our number, or the reference the portal itself gave. */
export async function findPracticeForPortal(
  supabase: SupabaseClient,
  portalId: string,
  ref: { practice_id?: unknown; practice_number?: unknown; reference?: unknown },
): Promise<string | null> {
  const id = typeof ref.practice_id === 'string' ? ref.practice_id.trim() : '';
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await supabase.from('practices').select('id').eq('id', id).maybeSingle();
    if (data) return data.id as string;
  }
  const number = typeof ref.practice_number === 'string' ? ref.practice_number.trim() : '';
  if (number) {
    const { data } = await supabase.from('practices').select('id').eq('practice_number', number).maybeSingle();
    if (data) return data.id as string;
  }
  const reference = typeof ref.reference === 'string' ? ref.reference.trim() : '';
  if (reference) {
    const { data } = await supabase.from('practice_workflow').select('practice_id').eq('target_portal', portalId).eq('target_reference', reference).maybeSingle();
    if (data) return data.practice_id as string;
  }
  return null;
}
