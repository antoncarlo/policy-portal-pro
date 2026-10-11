import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client address book operations that need the server:
 *   - merge duplicates: the practices of the merged clients move to the one that stays, the empty fields of
 *     the one that stays are filled from the others, the others are deleted;
 *   - export everything held about one client (data subject access, GDPR art. 15 and 20).
 */

export class ClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const MAX_MERGE = 20;
const FILLABLE = ['email', 'phone', 'mobile', 'tax_code', 'vat_number', 'company_name', 'address_street', 'address_city', 'address_province', 'address_postal_code', 'address_country'] as const;

interface ClientRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  notes: string | null;
  email: string | null;
  [key: string]: unknown;
}

const empty = (value: unknown) => value === null || value === undefined || String(value).trim() === '';
const label = (client: ClientRow) => `${client.first_name} ${client.last_name}`.trim();

async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  return Boolean(data);
}

/** The owner themselves, an administrator, or (to read only) the agent the owner works under. */
async function canAct(supabase: SupabaseClient, actorId: string, ownerId: string, options: { read: boolean }): Promise<boolean> {
  if (actorId === ownerId || (await isAdmin(supabase, actorId))) return true;
  if (!options.read) return false;
  const { data } = await supabase.from('user_roles').select('parent_agent_id').eq('user_id', ownerId).maybeSingle();
  return data?.parent_agent_id === actorId;
}

async function loadClients(supabase: SupabaseClient, ids: string[]): Promise<ClientRow[]> {
  const { data, error } = await supabase.from('clients').select('*').in('id', ids);
  if (error) throw new ClientError(500, 'database', `Lettura dei clienti non riuscita: ${error.message}`);
  return (data ?? []) as ClientRow[];
}

export interface MergeResult {
  keptId: string;
  merged: Array<{ id: string; name: string; email: string | null }>;
  practicesMoved: number;
  filled: string[];
}

export async function mergeClients(
  supabase: SupabaseClient,
  options: { keepId: string; mergeIds: string[]; actorId: string },
): Promise<MergeResult> {
  const mergeIds = [...new Set(options.mergeIds)].filter((id) => id !== options.keepId);
  if (!options.keepId || mergeIds.length === 0) throw new ClientError(400, 'nothing_to_merge', 'Indicare il cliente da tenere e almeno un altro da unire');
  if (mergeIds.length > MAX_MERGE) throw new ClientError(400, 'too_many', `Si possono unire al massimo ${MAX_MERGE} clienti per volta`);

  const rows = await loadClients(supabase, [options.keepId, ...mergeIds]);
  const keeper = rows.find((row) => row.id === options.keepId);
  const merged = mergeIds.map((id) => rows.find((row) => row.id === id));
  if (!keeper || merged.some((row) => !row)) throw new ClientError(404, 'client_not_found', 'Cliente non trovato');
  const others = merged as ClientRow[];

  for (const owner of new Set(rows.map((row) => row.user_id))) {
    if (!(await canAct(supabase, options.actorId, owner, { read: false }))) {
      throw new ClientError(403, 'forbidden', 'Puoi unire solo clienti della tua rubrica (o essere amministratore)');
    }
  }

  // 1. The one that stays gets what it lacks.
  const patch: Record<string, unknown> = {};
  const filled: string[] = [];
  for (const field of FILLABLE) {
    if (!empty(keeper[field])) continue;
    const source = others.find((row) => !empty(row[field]));
    if (source) {
      patch[field] = source[field];
      filled.push(field);
    }
  }
  const mergedNotes = others.filter((row) => !empty(row.notes)).map((row) => `[Unito da ${label(row)}] ${String(row.notes).trim()}`);
  if (mergedNotes.length > 0) {
    patch.notes = [keeper.notes, ...mergedNotes].filter((text) => !empty(text)).join('\n\n');
    filled.push('notes');
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('clients').update(patch).eq('id', keeper.id);
    if (error) throw new ClientError(500, 'database', `Aggiornamento del cliente non riuscito: ${error.message}`);
  }

  // 2. Their practices follow.
  const { data: moved, error: moveError } = await supabase.from('practices').update({ client_id: keeper.id }).in('client_id', mergeIds).select('id');
  if (moveError) throw new ClientError(500, 'database', `Spostamento delle pratiche non riuscito: ${moveError.message}`);

  // 3. Only now are the others removed (nothing points to them any more).
  const { error: deleteError } = await supabase.from('clients').delete().in('id', mergeIds);
  if (deleteError) throw new ClientError(500, 'database', `Eliminazione dei doppioni non riuscita: ${deleteError.message}`);

  return {
    keptId: keeper.id,
    merged: others.map((row) => ({ id: row.id, name: label(row), email: row.email })),
    practicesMoved: moved?.length ?? 0,
    filled,
  };
}

export interface ClientExport {
  generated_at: string;
  controller: string;
  note: string;
  client: ClientRow;
  practices: Array<Record<string, unknown>>;
  practice_events: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  emails_sent: Array<Record<string, unknown>>;
}

const CONTROLLER = 'Tecno Advance MGA Broker Srl · info@tecnomga.com';

export async function exportClientData(supabase: SupabaseClient, options: { clientId: string; actorId: string; now?: Date }): Promise<ClientExport> {
  const [client] = await loadClients(supabase, [options.clientId]);
  if (!client) throw new ClientError(404, 'client_not_found', 'Cliente non trovato');
  if (!(await canAct(supabase, options.actorId, client.user_id, { read: true }))) throw new ClientError(403, 'forbidden', 'Non puoi esportare i dati di questo cliente');

  const { data: practices, error } = await supabase.from('practices').select('*').eq('client_id', client.id).order('created_at', { ascending: true });
  if (error) throw new ClientError(500, 'database', `Lettura delle pratiche non riuscita: ${error.message}`);
  const practiceRows = (practices ?? []) as Array<Record<string, unknown> & { id: string }>;
  const practiceIds = practiceRows.map((practice) => practice.id);

  let events: Array<Record<string, unknown>> = [];
  let documents: Array<Record<string, unknown>> = [];
  if (practiceIds.length > 0) {
    const [eventsResult, documentsResult] = await Promise.all([
      supabase.from('practice_events').select('practice_id, event_type, description, created_at').in('practice_id', practiceIds).order('created_at', { ascending: true }),
      supabase.from('practice_documents').select('practice_id, file_name, document_type, mime_type, file_size, created_at').in('practice_id', practiceIds).order('created_at', { ascending: true }),
    ]);
    if (eventsResult.error) throw new ClientError(500, 'database', `Lettura dello storico non riuscita: ${eventsResult.error.message}`);
    if (documentsResult.error) throw new ClientError(500, 'database', `Lettura dei documenti non riuscita: ${documentsResult.error.message}`);
    events = (eventsResult.data ?? []) as Array<Record<string, unknown>>;
    documents = (documentsResult.data ?? []) as Array<Record<string, unknown>>;
  }

  const addresses = [...new Set([client.email, ...practiceRows.map((practice) => practice.client_email)].filter((value): value is string => typeof value === 'string' && value.trim() !== '').map((value) => value.trim()))];
  let emails: Array<Record<string, unknown>> = [];
  if (addresses.length > 0) {
    const { data: logs, error: logError } = await supabase
      .from('email_logs')
      .select('recipient_email, subject, template_used, status, created_at')
      .in('recipient_email', addresses)
      .order('created_at', { ascending: true });
    if (logError) throw new ClientError(500, 'database', `Lettura delle email non riuscita: ${logError.message}`);
    emails = (logs ?? []) as Array<Record<string, unknown>>;
  }

  return {
    generated_at: (options.now ?? new Date()).toISOString(),
    controller: CONTROLLER,
    note: 'Dati personali del cliente conservati dal portale: anagrafica, pratiche, storico, elenco dei documenti (i file non sono inclusi) ed email inviate. I dati contrattuali sono conservati per il tempo previsto dalla normativa assicurativa.',
    client,
    practices: practiceRows,
    practice_events: events,
    documents,
    emails_sent: emails,
  };
}
