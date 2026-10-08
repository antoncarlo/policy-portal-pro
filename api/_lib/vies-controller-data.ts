import type { SupabaseClient } from '@supabase/supabase-js';
import {
  practiceCompanyCodes,
  verifyViesBatch,
  type ControllerDocument,
  type ControllerExistingPractice,
  type ControllerIndexedDocument,
  type ControllerJob,
  type ControllerPractice,
  type ControllerReport,
} from '../../src/lib/viesController.js';

const PRACTICE_COLUMNS =
  'id, practice_number, practice_type, client_name, owner_tax_code, beneficiary, notes, premium_gross, premium_taxes, premium_net, premium_taxable, policy_start_date, policy_end_date, status, created_at';
const IN_CHUNK = 100;

type CompanyCodes = { uscc: string | null; vat: string | null };

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

/**
 * VIES practices already in the portal for the given companies, outside the
 * excluded ones. A practice does not count as a duplicate when it was never
 * sendable (its job is blocked or cancelled), when it was refused, or when its
 * policy has expired (a renewal is allowed).
 */
export async function findExistingViesPractices(
  supabase: SupabaseClient,
  companies: CompanyCodes[],
  excludePracticeIds: Set<string> = new Set(),
): Promise<ControllerExistingPractice[]> {
  const usccs = [...new Set(companies.map((company) => company.uscc).filter((code): code is string => Boolean(code)))];
  const vats = [...new Set(companies.map((company) => company.vat).filter((code): code is string => Boolean(code)))];
  // Codes are checked before use: only letters and digits reach the filter.
  const safe = (code: string) => /^[0-9A-Z]+$/.test(code);
  const filters = [
    ...usccs.filter(safe).map((code) => `notes.ilike.*${code}*`),
    ...vats.filter(safe).map((code) => `owner_tax_code.eq.${code}`),
  ];
  if (!filters.length) return [];

  const candidates = new Map<string, ControllerPractice & { status: string; created_at: string }>();
  for (const part of chunk(filters, 40)) {
    const { data, error } = await supabase.from('practices').select(PRACTICE_COLUMNS).eq('practice_type', 'vies').or(part.join(','));
    if (error) throw new Error(`Ricerca pratiche VIES esistenti non riuscita: ${error.message}`);
    for (const practice of data ?? []) candidates.set(practice.id, practice);
  }
  for (const id of excludePracticeIds) candidates.delete(id);
  if (!candidates.size) return [];

  // Practices whose job never became sendable are not duplicates.
  const notSendable = new Set<string>();
  for (const ids of chunk([...candidates.keys()], IN_CHUNK)) {
    const { data, error } = await supabase.from('vies_jobs').select('external_reference, status').in('external_reference', ids);
    if (error) throw new Error(`Verifica stato pratiche VIES non riuscita: ${error.message}`);
    for (const job of data ?? []) {
      if (job.external_reference && (job.status === 'blocked' || job.status === 'cancelled')) notSendable.add(job.external_reference);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const wanted = new Set([...usccs, ...vats]);
  return [...candidates.values()]
    .filter((practice) => !notSendable.has(practice.id))
    .filter((practice) => practice.status !== 'rifiutata')
    .filter((practice) => !practice.policy_end_date || practice.policy_end_date.slice(0, 10) >= today)
    .map((practice) => ({ practice, codes: practiceCompanyCodes(practice) }))
    .filter(({ codes }) => (codes.uscc && wanted.has(codes.uscc)) || (codes.vat && wanted.has(codes.vat)))
    .map(({ practice, codes }) => ({
      id: practice.id,
      practice_number: practice.practice_number,
      created_at: practice.created_at,
      uscc: codes.uscc,
      vat: codes.vat,
    }));
}

/** Reads everything the final check needs for a batch, straight from the database. */
export async function runBatchController(supabase: SupabaseClient, batchId: string): Promise<ControllerReport> {
  const { data: jobs, error: jobsError } = await supabase
    .from('vies_jobs')
    .select('id, row_number, nome_zip, zip_file_name, contraente, partita_iva_contraente, status, last_error, validation_errors, reconciliation_errors, external_reference')
    .eq('batch_id', batchId);
  if (jobsError) throw new Error(`Lettura job del lotto non riuscita: ${jobsError.message}`);

  const practiceIds = [...new Set((jobs ?? []).map((job) => job.external_reference).filter((id): id is string => Boolean(id)))];
  const practices: ControllerPractice[] = [];
  const documents: ControllerDocument[] = [];
  for (const ids of chunk(practiceIds, IN_CHUNK)) {
    const { data, error } = await supabase.from('practices').select(PRACTICE_COLUMNS).in('id', ids);
    if (error) throw new Error(`Lettura pratiche del lotto non riuscita: ${error.message}`);
    practices.push(...((data ?? []) as ControllerPractice[]));
    const { data: attached, error: documentsError } = await supabase
      .from('practice_documents')
      .select('practice_id, file_name, file_path, file_size, mime_type')
      .in('practice_id', ids);
    if (documentsError) throw new Error(`Lettura allegati non riuscita: ${documentsError.message}`);
    documents.push(...((attached ?? []) as ControllerDocument[]));
  }

  const { data: indexed, error: indexedError } = await supabase
    .from('vies_batch_documents')
    .select('practice_id, row_number, zip_file_name, requirement_matches, status')
    .eq('batch_id', batchId);
  if (indexedError) throw new Error(`Lettura documenti indicizzati non riuscita: ${indexedError.message}`);

  const existingPractices = await findExistingViesPractices(
    supabase,
    practices.map((practice) => practiceCompanyCodes(practice)),
    new Set(practiceIds),
  );

  return verifyViesBatch({
    batchId,
    jobs: (jobs ?? []) as ControllerJob[],
    practices,
    documents,
    indexedDocuments: (indexed ?? []) as ControllerIndexedDocument[],
    existingPractices,
  });
}
