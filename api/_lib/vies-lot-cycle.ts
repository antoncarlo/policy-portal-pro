import type { SupabaseClient } from '@supabase/supabase-js';
import { isActiveInCycle, LOT_CYCLE_DOCUMENT_TYPES, lotCycleOf, practiceStateOf, type LotCycleState, type LotFlowRow } from '../../src/lib/lotCycle.js';
import { stageOf } from '../../src/lib/practiceStages.js';
import { alertUsers } from './admin-alerts.js';
import { portalUrl } from './auth-emails.js';
import { logActivity } from './audit.js';
import { lotAlertContent, lotLabel, type LotAlertKind } from './lot-copy.js';
import { suppressQueuedEvents } from './notification-dispatch.js';
import { registerPracticePayment } from './practice-payment.js';
import { WorkflowError } from './vies-workflow.js';

/**
 * The cycle of a lot, step by step (see src/lib/lotCycle.ts): every step checks who may do it and in which
 * state the lot is, writes its line in the lot's register (vies_lot_events) and in the audit log, and tells the
 * people who are next by email. The practices keep their own history too.
 */

export const LOT_ACTIONS = ['lot_record_step', 'lot_confirm_drafts', 'lot_submit_payment', 'lot_confirm_payment', 'lot_mark_sent', 'lot_silence_events'] as const;
export type LotActionName = (typeof LOT_ACTIONS)[number];
export const isLotAction = (value: unknown): value is LotActionName => typeof value === 'string' && (LOT_ACTIONS as readonly string[]).includes(value);

const LOT_DOCUMENTS_BUCKET = 'vies-lot-documents';
const MAX_LISTED = 50;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | undefined => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
const required = (value: unknown, max: number, message: string): string => {
  const result = text(value, max);
  if (!result) throw new WorkflowError(422, 'invalid_payload', message);
  return result;
};
const strings = (value: unknown, max = MAX_LISTED) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 200)).slice(0, max) : [];
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 100_000) : 0);

interface LotPracticeRow {
  id: string;
  practice_number: string;
  client_name: string;
  status: string;
  financial_status: string | null;
  user_id: string;
}

export interface LotContext {
  batch: { id: string; name: string; lot_number: number | null; user_id: string | null };
  representative: string | null;
  practices: LotPracticeRow[];
  flow: LotFlowRow | null;
  cycle: LotCycleState;
}

const chunks = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

export async function loadLot(supabase: SupabaseClient, batchId: string): Promise<LotContext> {
  const { data: batch, error } = await supabase
    .from('vies_batches')
    .select('id, name, lot_number, user_id, fiscal_representative_id')
    .eq('id', batchId)
    .maybeSingle();
  if (error) throw new WorkflowError(500, 'database', `Lettura del lotto non riuscita: ${error.message}`);
  if (!batch) throw new WorkflowError(404, 'lot_not_found', 'Lotto non trovato');

  const [{ data: practiceRows }, { data: flow }, representative] = await Promise.all([
    supabase.from('practices').select('id, practice_number, client_name, status, financial_status, user_id').eq('vies_batch_id', batchId).order('practice_number'),
    supabase.from('vies_lot_flow').select('*').eq('batch_id', batchId).maybeSingle(),
    batch.fiscal_representative_id
      ? supabase.from('vies_fiscal_representatives').select('name').eq('id', batch.fiscal_representative_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const practices = (practiceRows ?? []) as LotPracticeRow[];

  const docsByPractice = new Map<string, Array<{ file_name: string; document_type: string | null; created_at: string }>>();
  for (const part of chunks(practices.map((practice) => practice.id), 100)) {
    const { data: docs } = await supabase
      .from('practice_documents')
      .select('practice_id, file_name, document_type, created_at')
      .in('practice_id', part)
      .in('document_type', LOT_CYCLE_DOCUMENT_TYPES);
    for (const doc of (docs ?? []) as Array<{ practice_id: string; file_name: string; document_type: string | null; created_at: string }>) {
      docsByPractice.set(doc.practice_id, [...(docsByPractice.get(doc.practice_id) ?? []), doc]);
    }
  }

  const states = practices.map((practice) => practiceStateOf(practice, docsByPractice.get(practice.id) ?? []));

  const flowRow = (flow as LotFlowRow | null) ?? null;
  return {
    batch: { id: batch.id, name: batch.name, lot_number: batch.lot_number, user_id: batch.user_id },
    representative: (representative.data as { name?: string } | null)?.name ?? null,
    practices,
    flow: flowRow,
    cycle: lotCycleOf(flowRow, states),
  };
}

async function actorLabel(supabase: SupabaseClient, userId: string, admin: boolean) {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  return (data?.full_name as string | undefined)?.trim() || (admin ? 'Amministratore' : 'Rappresentante fiscale');
}

const owners = (lot: LotContext) => [...new Set([lot.batch.user_id, ...lot.practices.map((practice) => practice.user_id)].filter((id): id is string => Boolean(id)))];

/** One line in the lot's register and in the audit log. */
export async function recordLotEvent(
  supabase: SupabaseClient,
  batchId: string,
  userId: string,
  type: string,
  description: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from('vies_lot_events').insert({ batch_id: batchId, event_type: type, description, details, created_by: userId });
  await logActivity(supabase, { actorId: userId, action: `lot.${type}`, target: { table: 'vies_batches', id: batchId }, details });
}

async function setFlow(supabase: SupabaseClient, batchId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('vies_lot_flow').upsert({ batch_id: batchId, ...patch }, { onConflict: 'batch_id' });
  if (error) throw new WorkflowError(500, 'database', `Registrazione del passaggio non riuscita: ${error.message}`);
}

/** The practice's own history gets a line too, so each practice tells the whole story. */
async function practiceLine(supabase: SupabaseClient, practiceIds: string[], userId: string, type: string, description: string) {
  if (practiceIds.length === 0) return;
  await supabase.from('practice_events').insert(practiceIds.map((id) => ({ practice_id: id, event_type: type, description, created_by: userId })));
}

/**
 * One email for the whole step, only to the lot's fiscal representative (not to the administrators, who see what is
 * waiting for them in the lot, and not one email per practice).
 */
async function tellOwners(supabase: SupabaseClient, lot: LotContext, kind: LotAlertKind, params: { count?: number; actor?: string }) {
  const url = `${portalUrl()}/practices?lot=${lot.batch.id}`;
  const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  const adminIds = new Set((admins ?? []).map((row: { user_id: string }) => row.user_id));
  const recipients = owners(lot).filter((id) => !adminIds.has(id));
  if (recipients.length === 0) return;
  await alertUsers(supabase, recipients, (language) => lotAlertContent(kind, language, { lot: lotLabel(language, lot.batch.lot_number, lot.batch.name), representative: lot.representative, url, ...params }), { template: `lot_${kind}` });
}

const lotName = (lot: LotContext) => (lot.batch.lot_number ? `Lotto ${lot.batch.lot_number}` : lot.batch.name);

function assertAdmin(admin: boolean) {
  if (!admin) throw new WorkflowError(403, 'forbidden', 'Solo gli amministratori possono eseguire questo passaggio');
}

function assertOwnerOrAdmin(lot: LotContext, userId: string, admin: boolean) {
  if (!admin && !owners(lot).includes(userId)) throw new WorkflowError(403, 'forbidden', 'Solo chi gestisce il lotto o un amministratore può eseguire questo passaggio');
}

function assertStep(lot: LotContext, step: 'drafts' | 'verify' | 'payment' | 'payment_check' | 'copies' | 'sign' | 'send' | 'issued', force: boolean, message: string) {
  const index = lot.cycle.steps.findIndex((entry) => entry.id === step);
  const blocking = lot.cycle.steps.slice(0, index).find((entry) => !entry.done && entry.id !== 'sign');
  if (blocking && !force) throw new WorkflowError(409, 'invalid_transition', message);
}

const summarise = (body: Record<string, unknown>) => {
  const summary = isRecord(body.summary) ? body.summary : {};
  return { files: count(summary.files), attached: count(summary.attached), unmatched: strings(summary.unmatched), failed: strings(summary.failed) };
};

const describeUpload = (what: string, s: ReturnType<typeof summarise>, who: string) =>
  `${what}: ${s.attached} ${s.attached === 1 ? 'pratica collegata' : 'pratiche collegate'} su ${s.files} file${s.unmatched.length ? `, ${s.unmatched.length} non riconosciuti` : ''}${s.failed.length ? `, ${s.failed.length} non riusciti` : ''} · ${who}`;

export async function runLotAction(
  supabase: SupabaseClient,
  userId: string,
  admin: boolean,
  action: LotActionName,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const batchId = required(body.batchId, 64, 'batchId obbligatorio');
  const lot = await loadLot(supabase, batchId);
  const who = await actorLabel(supabase, userId, admin);
  const force = admin && body.force === true;
  const now = new Date().toISOString();

  switch (action) {
    case 'lot_record_step': {
      assertAdmin(admin);
      const step = required(body.step, 40, 'step obbligatorio');
      const s = summarise(body);
      if (step === 'drafts_uploaded') {
        if (s.attached === 0) throw new WorkflowError(422, 'nothing_attached', 'Nessuna bozza collegata alle pratiche');
        // New drafts replace what the collaborator checked: the confirmation is asked again, unless the payment has gone on.
        const reset = lot.flow?.drafts_confirmed_at && !lot.flow?.payment_submitted_at;
        await setFlow(supabase, batchId, { drafts_uploaded_at: now, drafts_uploaded_by: userId, ...(reset ? { drafts_confirmed_at: null, drafts_confirmed_by: null } : {}) });
        await recordLotEvent(supabase, batchId, userId, 'drafts_uploaded', describeUpload('Bozze della compagnia caricate', s, who), { ...s, confirmation_reset: Boolean(reset) });
        await tellOwners(supabase, lot, 'drafts_uploaded', { count: s.attached });
        return { ok: true, changed: true, batchId, step };
      }
      if (step === 'copies_uploaded') {
        if (s.attached === 0) throw new WorkflowError(422, 'nothing_attached', 'Nessuna copia collegata alle pratiche');
        if (!lot.flow?.payment_confirmed_at && !force) throw new WorkflowError(409, 'invalid_transition', 'Le copie per la compagnia si caricano dopo la conferma del pagamento');
        await setFlow(supabase, batchId, { copies_uploaded_at: now, copies_uploaded_by: userId });
        await recordLotEvent(supabase, batchId, userId, 'copies_uploaded', describeUpload('Polizze copia Compagnia caricate', s, who), s);
        await tellOwners(supabase, lot, 'copies_uploaded', { count: s.attached });
        return { ok: true, changed: true, batchId, step };
      }
      if (step === 'issued_uploaded') {
        if (s.attached === 0) throw new WorkflowError(422, 'nothing_attached', 'Nessuna polizza emessa collegata alle pratiche');
        const fresh = await loadLot(supabase, batchId);
        const allIssued = fresh.cycle.active.length > 0 && fresh.cycle.active.every((practice) => practice.issuedCopies > 0);
        await setFlow(supabase, batchId, { issued_uploaded_at: now, issued_uploaded_by: userId, ...(allIssued ? { closed_at: now } : {}) });
        await recordLotEvent(supabase, batchId, userId, 'issued_uploaded', describeUpload('Polizze emesse caricate', s, who), s);
        if (allIssued) await recordLotEvent(supabase, batchId, userId, 'closed', `${lotName(lot)} chiuso: tutte le polizze sono emesse e disponibili · ${who}`, { practices: fresh.cycle.active.length });
        await tellOwners(supabase, lot, 'issued_uploaded', { count: s.attached });
        return { ok: true, changed: true, batchId, step, closed: allIssued };
      }
      throw new WorkflowError(422, 'invalid_payload', 'step non valido');
    }

    case 'lot_confirm_drafts': {
      assertOwnerOrAdmin(lot, userId, admin);
      if (lot.flow?.drafts_confirmed_at) return { ok: true, changed: false, batchId, confirmedAt: lot.flow.drafts_confirmed_at };
      const active = lot.cycle.active;
      if (active.length === 0) throw new WorkflowError(409, 'invalid_transition', 'Nessuna pratica del lotto è ancora deliberata');
      const withoutDraft = lot.cycle.missing.drafts ?? [];
      if (withoutDraft.length > 0 && !force) throw new WorkflowError(409, 'drafts_missing', `Mancano le bozze di: ${withoutDraft.slice(0, 10).join(', ')}${withoutDraft.length > 10 ? '…' : ''}`);
      await setFlow(supabase, batchId, { drafts_confirmed_at: now, drafts_confirmed_by: userId });
      await recordLotEvent(supabase, batchId, userId, 'drafts_confirmed', `Bozze verificate e confermate: ${active.length} pratiche · ${who}`, { practices: active.length, without_draft: withoutDraft.length });
      await practiceLine(supabase, active.map((practice) => practice.id), userId, 'lot_drafts_confirmed', `Bozza verificata e confermata (${who})`);
      return { ok: true, changed: true, batchId, confirmedAt: now, practices: active.length };
    }

    case 'lot_submit_payment': {
      assertOwnerOrAdmin(lot, userId, admin);
      if (!lot.flow?.drafts_confirmed_at && !force) throw new WorkflowError(409, 'invalid_transition', 'Prima si confermano le bozze verificate');
      if (lot.flow?.payment_confirmed_at) return { ok: true, changed: false, batchId, submittedAt: lot.flow.payment_submitted_at };
      const list = Array.isArray(body.documents) ? body.documents : [];
      if (list.length === 0 || list.length > 10) throw new WorkflowError(422, 'invalid_payload', 'Servono l’estratto conto firmato e il bonifico');
      const rows = list.map((item) => {
        if (!isRecord(item)) throw new WorkflowError(422, 'invalid_payload', 'documents: formato non valido');
        const kind = required(item.kind, 40, 'documents.kind obbligatorio');
        if (kind !== 'estratto_conto_firmato' && kind !== 'bonifico' && kind !== 'altro') throw new WorkflowError(422, 'invalid_payload', 'documents.kind non valido');
        const path = required(item.storage_path, 500, 'documents.storage_path obbligatorio');
        if (!path.startsWith(`${batchId}/`) || path.split('/').some((part) => part === '..' || part === '')) throw new WorkflowError(422, 'invalid_payload', 'Percorso del documento non valido');
        return { kind, path, file_name: required(item.file_name, 200, 'documents.file_name obbligatorio'), mime_type: text(item.mime_type, 100) ?? null, size: count(item.size) };
      });
      if (!rows.some((row) => row.kind === 'estratto_conto_firmato') || !rows.some((row) => row.kind === 'bonifico')) {
        throw new WorkflowError(422, 'documents_missing', 'Servono l’estratto conto firmato e la copia del bonifico');
      }
      for (const row of rows) {
        const { data, error } = await supabase.storage.from(LOT_DOCUMENTS_BUCKET).createSignedUrl(row.path, 60);
        if (error || !data?.signedUrl) throw new WorkflowError(422, 'document_not_found', `Il file ${row.file_name} non risulta caricato`);
      }
      const { error } = await supabase.from('vies_lot_documents').insert(
        rows.map((row) => ({ batch_id: batchId, kind: row.kind, file_name: row.file_name, file_path: row.path, file_size: row.size, mime_type: row.mime_type, uploaded_by: userId })),
      );
      if (error) throw new WorkflowError(500, 'database', `Registrazione dei documenti non riuscita: ${error.message}`);
      const resubmitted = Boolean(lot.flow?.payment_submitted_at);
      await setFlow(supabase, batchId, { payment_submitted_at: now, payment_submitted_by: userId });
      await recordLotEvent(
        supabase,
        batchId,
        userId,
        resubmitted ? 'payment_resubmitted' : 'payment_submitted',
        `Estratto conto pagato: ${rows.map((row) => row.file_name).join(', ')} · ${who}`,
        { files: rows.map((row) => ({ kind: row.kind, file_name: row.file_name })) },
      );
      return { ok: true, changed: true, batchId, submittedAt: now };
    }

    case 'lot_confirm_payment': {
      assertAdmin(admin);
      if (lot.flow?.payment_confirmed_at) return { ok: true, changed: false, batchId, confirmedAt: lot.flow.payment_confirmed_at };
      if (!lot.flow?.payment_submitted_at && !force) throw new WorkflowError(409, 'invalid_transition', 'Il rappresentante non ha ancora inviato il pagamento');
      const paidAt = typeof body.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate) ? body.paymentDate : now.slice(0, 10);
      const toPay = lot.practices.filter((practice) => stageOf(practice) === 'deliberata');
      const failed: string[] = [];
      let registered = 0;
      for (const practice of toPay) {
        try {
          const result = await registerPracticePayment(supabase, userId, who, practice.id, paidAt, { quiet: true });
          if (result.changed) registered += 1;
        } catch (error) {
          failed.push(`${practice.practice_number}: ${error instanceof Error ? error.message : 'errore'}`);
        }
      }
      if (failed.length > 0 && registered === 0) throw new WorkflowError(409, 'payment_not_registered', failed.slice(0, 3).join('; '));
      await setFlow(supabase, batchId, { payment_confirmed_at: now, payment_confirmed_by: userId });
      await supabase.from('vies_batches').update({ paid_at: paidAt }).eq('id', batchId);
      await recordLotEvent(supabase, batchId, userId, 'payment_confirmed', `Pagamento confermato (${paidAt.split('-').reverse().join('/')}): ${registered} pratiche pagate${failed.length ? `, ${failed.length} non registrate` : ''} · ${who}`, { paid_at: paidAt, registered, failed });
      await tellOwners(supabase, lot, 'payment_confirmed', { count: registered });
      return { ok: true, changed: true, batchId, confirmedAt: now, registered, failed };
    }

    case 'lot_silence_events': {
      // After a bulk operation done by the browser (the signed files of the whole lot): the documents added to each practice
      // do not mail anyone one by one, the lot's step does.
      assertOwnerOrAdmin(lot, userId, admin);
      const since = new Date(Date.now() - 30 * 60 * 1000);
      for (const practice of lot.practices) await suppressQueuedEvents(supabase, practice.id, since);
      return { ok: true, changed: true, batchId, practices: lot.practices.length };
    }

    case 'lot_mark_sent': {
      assertAdmin(admin);
      if (lot.flow?.sent_to_company_at && body.resend !== true) return { ok: true, changed: false, batchId, sentAt: lot.flow.sent_to_company_at };
      assertStep(lot, 'send', force, 'Prima si caricano le copie per la compagnia e si ricevono le firme');
      const unsigned = lot.cycle.missing.sign ?? [];
      if (unsigned.length > 0 && !force) throw new WorkflowError(409, 'signatures_missing', `Mancano le firme di: ${unsigned.slice(0, 10).join(', ')}${unsigned.length > 10 ? '…' : ''}`);
      const reference = text(body.reference, 200) ?? null;
      const active = lot.cycle.active.map((practice) => practice.id);
      for (const practiceId of active) await supabase.from('practice_workflow').upsert({ practice_id: practiceId, signed_sent_at: now }, { onConflict: 'practice_id' });
      await setFlow(supabase, batchId, { sent_to_company_at: now, sent_to_company_by: userId });
      await recordLotEvent(supabase, batchId, userId, 'sent_to_company', `Documenti firmati inviati alla compagnia: ${active.length} pratiche${reference ? ` (${reference})` : ''} · ${who}`, { practices: active.length, reference });
      await practiceLine(supabase, active, userId, 'workflow_signed_sent', `Copie firmate inviate alla compagnia (${who})`);
      return { ok: true, changed: true, batchId, sentAt: now, practices: active.length };
    }
  }
}

/**
 * After a practice's signed copies are in: when every practice of its lot has them, the lot is ready to be sent to the
 * company and the administrators are told once. Never throws: the practice's own step already succeeded.
 */
export async function afterSignaturesComplete(supabase: SupabaseClient, practiceId: string, userId: string): Promise<void> {
  try {
    const { data: practice } = await supabase.from('practices').select('vies_batch_id').eq('id', practiceId).maybeSingle();
    const batchId = practice?.vies_batch_id as string | null | undefined;
    if (!batchId) return;
    const lot = await loadLot(supabase, batchId);
    if (lot.flow?.sent_to_company_at || !lot.flow?.copies_uploaded_at) return;
    if (lot.cycle.active.length === 0 || (lot.cycle.missing.sign ?? []).length > 0) return;
    const { data: already } = await supabase.from('vies_lot_events').select('id').eq('batch_id', batchId).eq('event_type', 'signatures_complete').limit(1);
    if (already && already.length > 0) return;
    await recordLotEvent(supabase, batchId, userId, 'signatures_complete', `Firme caricate per tutte le pratiche del lotto (${lot.cycle.active.length})`, { practices: lot.cycle.active.length });
  } catch (error) {
    console.error('Passaggio del lotto dopo le firme non riuscito:', error instanceof Error ? error.message : error);
  }
}

export { isActiveInCycle };
