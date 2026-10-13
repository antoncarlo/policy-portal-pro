import type { ApiKeyContext, AdminClient } from './partner-api.js';
import { getDocumentStorageReference, safeFileName } from './vies-documents.js';
import { stageOf } from '../../src/lib/practiceStages.js';

/**
 * Lots of VIES practices that another portal sends in (X-API-Key). The files are the ones a person
 * would upload by hand: the Excel sheet, one ZIP per company and, optionally, the fiscal
 * representative's visura. They go straight to storage through signed upload addresses (the
 * platform refuses request bodies over 4.5 MB) and wait as a "received lot" until an administrator
 * loads them into the usual VIES flow.
 *
 *   create_lot    announces the lot and its files, returns where to upload each file
 *   complete_lot  checks that every file arrived and closes the lot as received
 *   status        GET: state of a lot and, once processed, of its practices
 */

export const INTAKE_BUCKET = 'vies-batch-files';
export const MAX_LOT_FILES = 260;
const MAX_FILE_BYTES = 500 * 1024 * 1024;

export type IntakeFileKind = 'excel' | 'zip' | 'visura';

export interface IntakeFile {
  kind: IntakeFileKind;
  file_name: string;
  storage_path: string;
  size: number;
  uploaded: boolean;
}

export class IntakeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

const EXTENSIONS: Record<IntakeFileKind, RegExp> = {
  excel: /\.(xlsx|xlsm|xls)$/i,
  zip: /\.zip$/i,
  visura: /\.pdf$/i,
};

/** Who the lots of an API key belong to: the user it is mapped to, never an anonymous key. */
export function lotOwner(ctx: ApiKeyContext): { ownerUserId: string; sourcePortal: string } {
  if (ctx.isLegacy || !ctx.mappedUserId || !ctx.keyId) {
    throw new IntakeError(403, 'key_not_mapped', 'La chiave API non è associata a un utente del portale: chiedere all\'amministratore di associarla.');
  }
  const name = (ctx.keyRecord?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return { ownerUserId: ctx.mappedUserId, sourcePortal: name || `key-${ctx.keyId.slice(0, 8)}` };
}

interface DeclaredFile {
  kind: IntakeFileKind;
  fileName: string;
  size: number | null;
}

export function parseDeclaredFiles(value: unknown): DeclaredFile[] {
  if (!Array.isArray(value) || value.length === 0) throw new IntakeError(422, 'invalid_files', 'files: elencare i file del lotto');
  if (value.length > MAX_LOT_FILES) throw new IntakeError(422, 'invalid_files', `files: al massimo ${MAX_LOT_FILES} file per lotto`);
  const files: DeclaredFile[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) throw new IntakeError(422, 'invalid_files', `files[${index}]: formato non valido`);
    const kind = entry.kind;
    if (kind !== 'excel' && kind !== 'zip' && kind !== 'visura') {
      throw new IntakeError(422, 'invalid_files', `files[${index}].kind: ammessi excel, zip, visura`);
    }
    const fileName = safeFileName(text(entry.file_name, 200) ?? '');
    if (!EXTENSIONS[kind].test(fileName)) {
      throw new IntakeError(422, 'invalid_files', `files[${index}]: il nome "${fileName}" non ha l'estensione di un file ${kind}`);
    }
    const key = fileName.toLowerCase();
    if (seen.has(key)) throw new IntakeError(422, 'invalid_files', `files[${index}]: nome duplicato "${fileName}"`);
    seen.add(key);
    let size: number | null = null;
    if (entry.size !== undefined && entry.size !== null) {
      size = Number(entry.size);
      if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
        throw new IntakeError(422, 'invalid_files', `files[${index}].size: da 1 byte a 500 MB`);
      }
    }
    files.push({ kind, fileName, size });
  }
  if (files.filter((file) => file.kind === 'excel').length !== 1) throw new IntakeError(422, 'invalid_files', 'files: serve esattamente un file excel');
  if (files.filter((file) => file.kind === 'visura').length > 1) throw new IntakeError(422, 'invalid_files', 'files: al massimo una visura');
  return files;
}

export interface UploadTarget {
  kind: IntakeFileKind;
  file_name: string;
  storage_path: string;
  upload_url: string;
  /** Upload with PUT, the file as the body and its type in Content-Type. */
  method: 'PUT';
}

export async function createLot(supabase: AdminClient, ctx: ApiKeyContext, body: unknown) {
  const { ownerUserId, sourcePortal } = lotOwner(ctx);
  if (!isRecord(body)) throw new IntakeError(400, 'invalid_payload', 'Il corpo deve essere un oggetto JSON');

  const sourceReference = text(body.source_reference, 100);
  if (!sourceReference || !/^[\w.:/\- ]+$/.test(sourceReference)) {
    throw new IntakeError(422, 'invalid_source_reference', 'source_reference obbligatorio: il vostro identificativo del lotto (lettere, numeri e . _ : / -)');
  }
  const declared = parseDeclaredFiles(body.files);
  const representative = isRecord(body.fiscal_representative) ? body.fiscal_representative : {};
  let expectedRows: number | null = null;
  if (body.expected_rows !== undefined && body.expected_rows !== null) {
    expectedRows = Number(body.expected_rows);
    if (!Number.isInteger(expectedRows) || expectedRows < 1 || expectedRows > 5000) {
      throw new IntakeError(422, 'invalid_payload', 'expected_rows: da 1 a 5000');
    }
  }

  const { data: existing, error: lookupError } = await supabase
    .from('vies_intake_lots')
    .select('id, status')
    .eq('source_portal', sourcePortal)
    .eq('source_reference', sourceReference)
    .maybeSingle();
  if (lookupError) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');
  if (existing && existing.status !== 'uploading') {
    throw new IntakeError(409, 'lot_already_exists', 'Esiste già un lotto con questo source_reference.', { lot_id: existing.id, status: existing.status });
  }

  let lotId = existing?.id as string | undefined;
  const fields = {
    api_key_id: ctx.keyId,
    fiscal_representative_name: text(representative.name, 200) ?? null,
    fiscal_representative_tax_code: text(representative.tax_code, 40) ?? null,
    expected_rows: expectedRows,
    notes: text(body.notes, 1000) ?? null,
  };
  if (!lotId) {
    const { data, error } = await supabase
      .from('vies_intake_lots')
      .insert({ ...fields, source_portal: sourcePortal, source_reference: sourceReference, owner_user_id: ownerUserId, status: 'uploading', files: [] })
      .select('id')
      .single();
    if (error || !data) {
      // Two calls for the same lot at once: the second one finds the first.
      if (error?.code === '23505') throw new IntakeError(409, 'lot_already_exists', 'Esiste già un lotto con questo source_reference.');
      throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');
    }
    lotId = data.id as string;
  }

  // The owner's id must come first in the path: the storage rules read it from there.
  const targets: UploadTarget[] = [];
  const files: IntakeFile[] = [];
  for (const [index, file] of declared.entries()) {
    const path = `${ownerUserId}/intake/${lotId}/${String(index + 1).padStart(3, '0')}-${file.fileName}`;
    const { data: signed, error: signError } = await supabase.storage.from(INTAKE_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (signError || !signed?.signedUrl) throw new IntakeError(503, 'temporarily_unavailable', 'Indirizzi di caricamento non generati, riprovare.');
    targets.push({ kind: file.kind, file_name: file.fileName, storage_path: path, upload_url: signed.signedUrl, method: 'PUT' });
    files.push({ kind: file.kind, file_name: file.fileName, storage_path: path, size: file.size ?? 0, uploaded: false });
  }
  const { error: updateError } = await supabase.from('vies_intake_lots').update({ ...fields, files }).eq('id', lotId);
  if (updateError) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');

  return {
    lot_id: lotId,
    status: 'uploading',
    // Valid for two hours; calling create_lot again with the same source_reference issues new ones.
    uploads: targets,
    next: 'Caricare ogni file con PUT sull\'indirizzo indicato, poi chiamare complete_lot.',
  };
}

export async function completeLot(supabase: AdminClient, ctx: ApiKeyContext, body: unknown) {
  const { ownerUserId } = lotOwner(ctx);
  const lotId = isRecord(body) ? text(body.lot_id, 64) : undefined;
  if (!lotId) throw new IntakeError(422, 'invalid_payload', 'lot_id obbligatorio');

  const { data: lot, error } = await supabase
    .from('vies_intake_lots')
    .select('id, status, owner_user_id, api_key_id, source_portal, files')
    .eq('id', lotId)
    .maybeSingle();
  if (error) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');
  if (!lot || (lot.api_key_id !== ctx.keyId && lot.owner_user_id !== ownerUserId)) throw new IntakeError(404, 'lot_not_found', 'Lotto non trovato');
  if (lot.status !== 'uploading') {
    if (lot.status === 'received' || lot.status === 'processing' || lot.status === 'processed') {
      return { lot_id: lot.id, status: lot.status, already_completed: true };
    }
    throw new IntakeError(409, 'lot_closed', 'Il lotto non accetta più file', { status: lot.status });
  }

  const declared = (lot.files ?? []) as IntakeFile[];
  const prefix = `${lot.owner_user_id}/intake/${lot.id}`;
  const { data: stored, error: listError } = await supabase.storage.from(INTAKE_BUCKET).list(prefix, { limit: 1000 });
  if (listError) throw new IntakeError(503, 'temporarily_unavailable', 'Verifica dei file non riuscita, riprovare.');
  const sizes = new Map<string, number>();
  for (const entry of stored ?? []) {
    const size = Number((entry.metadata as { size?: number } | null)?.size ?? 0);
    sizes.set(`${prefix}/${entry.name}`, size);
  }

  const missing: string[] = [];
  const verified: IntakeFile[] = declared.map((file) => {
    const actual = sizes.get(file.storage_path) ?? 0;
    // A declared size is a promise: a different size means an upload that was cut short.
    if (actual <= 0 || (file.size > 0 && actual !== file.size)) missing.push(file.file_name);
    return { ...file, size: actual, uploaded: actual > 0 && (file.size === 0 || actual === file.size) };
  });
  if (missing.length) {
    throw new IntakeError(422, 'files_missing', 'Alcuni file non risultano caricati per intero.', { missing });
  }

  const now = new Date().toISOString();
  const { error: closeError } = await supabase
    .from('vies_intake_lots')
    .update({ files: verified, status: 'received', received_at: now })
    .eq('id', lot.id)
    .eq('status', 'uploading');
  if (closeError) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');

  await supabase.from('integration_events').insert({
    direction: 'inbound',
    portal_id: lot.source_portal,
    event_type: 'lot.received',
    external_event_id: `lot:${lot.id}`,
    status: 'processed',
    processed_at: now,
    payload: { lot_id: lot.id, files: verified.map((file) => ({ kind: file.kind, file_name: file.file_name, size: file.size })) },
  });

  return { lot_id: lot.id, status: 'received', files: verified.length, message: 'Lotto ricevuto: un amministratore lo caricherà nel flusso.' };
}

/** State of one lot and, once it is processed, of each of its practices. Or the key's latest lots. */
export async function lotStatus(supabase: AdminClient, ctx: ApiKeyContext, query: { lotId?: string; sourceReference?: string }) {
  const { ownerUserId, sourcePortal } = lotOwner(ctx);
  const columns = 'id, source_reference, status, expected_rows, rejected_reason, batch_id, created_at, received_at, processed_at, files';
  const scope = `api_key_id.eq.${ctx.keyId},owner_user_id.eq.${ownerUserId}`;

  if (!query.lotId && !query.sourceReference) {
    const { data, error } = await supabase.from('vies_intake_lots').select(columns).or(scope).order('created_at', { ascending: false }).limit(50);
    if (error) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');
    return { lots: (data ?? []).map(summarize) };
  }

  let request = supabase.from('vies_intake_lots').select(columns).or(scope);
  request = query.lotId ? request.eq('id', query.lotId) : request.eq('source_portal', sourcePortal).eq('source_reference', query.sourceReference as string);
  const { data: lot, error } = await request.maybeSingle();
  if (error) throw new IntakeError(503, 'temporarily_unavailable', 'Servizio temporaneamente non disponibile.');
  if (!lot) throw new IntakeError(404, 'lot_not_found', 'Lotto non trovato');

  const practices: Array<Record<string, unknown>> = [];
  if (lot.batch_id) {
    const { data: jobs } = await supabase
      .from('vies_jobs')
      .select('row_number, contraente, external_reference')
      .eq('batch_id', lot.batch_id)
      .order('row_number', { ascending: true })
      .limit(5000);
    const ids = (jobs ?? []).map((job) => job.external_reference).filter((id): id is string => Boolean(id));
    const byId = new Map<string, Record<string, unknown>>();
    for (let start = 0; start < ids.length; start += 200) {
      const slice = ids.slice(start, start + 200);
      const [{ data: rows }, { data: workflows }] = await Promise.all([
        supabase.from('practices').select('id, practice_number, status, financial_status').in('id', slice),
        supabase.from('practice_workflow').select('practice_id, payment_due_date, deliberation_note, rejection_reason').in('practice_id', slice),
      ]);
      const flows = new Map((workflows ?? []).map((row) => [row.practice_id as string, row]));
      for (const row of rows ?? []) {
        const flow = flows.get(row.id as string);
        byId.set(row.id as string, {
          practice_number: row.practice_number,
          stage: stageOf(row),
          payment_due_date: flow?.payment_due_date ?? null,
          note: flow?.deliberation_note ?? flow?.rejection_reason ?? null,
        });
      }
    }
    // The draft to pay and the issued policy, as links valid for a day.
    const withDocuments = ids.filter((id) => ['deliberata', 'da_emettere', 'emessa'].includes(String(byId.get(id)?.stage)));
    const documentsByPractice = new Map<string, Array<Record<string, unknown>>>();
    for (let start = 0; start < withDocuments.length; start += 100) {
      const { data: docs } = await supabase
        .from('practice_documents')
        .select('practice_id, file_name, file_path, mime_type, document_type')
        .in('practice_id', withDocuments.slice(start, start + 100))
        .in('document_type', ['bozza_deliberata', 'polizza_copia_compagnia', 'polizza_emessa'])
        .order('created_at', { ascending: false });
      for (const doc of docs ?? []) {
        const reference = getDocumentStorageReference(doc.file_path as string);
        const { data: signed } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, 24 * 3600);
        if (!signed?.signedUrl) continue;
        const list = documentsByPractice.get(doc.practice_id as string) ?? [];
        list.push({ document_type: doc.document_type, file_name: doc.file_name, mime_type: doc.mime_type, download_url: signed.signedUrl, expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
        documentsByPractice.set(doc.practice_id as string, list);
      }
    }
    for (const job of jobs ?? []) {
      const id = job.external_reference as string;
      practices.push({
        row_number: job.row_number,
        contraente: job.contraente,
        ...(byId.get(id) ?? { practice_number: null, stage: null }),
        ...(documentsByPractice.has(id) ? { documents: documentsByPractice.get(id) } : {}),
      });
    }
  }
  return { lot: summarize(lot), practices };
}

function summarize(lot: Record<string, unknown>) {
  const files = (lot.files ?? []) as IntakeFile[];
  return {
    lot_id: lot.id,
    source_reference: lot.source_reference,
    status: lot.status,
    expected_rows: lot.expected_rows ?? null,
    files: files.length,
    rejected_reason: lot.rejected_reason ?? null,
    created_at: lot.created_at,
    received_at: lot.received_at ?? null,
    processed_at: lot.processed_at ?? null,
  };
}
