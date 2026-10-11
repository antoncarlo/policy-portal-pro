import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Offboarding of a user without losing what they own. Deleting an account used to delete its practices,
 * documents and clients with it (cascade): an insurance intermediary keeps them for ten years. Now the
 * portfolio is handed to another user first, and an account that still has any cannot be deleted
 * (the database refuses as well: migration 20261016).
 */

export class OffboardingError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface Footprint {
  practices: number;
  clients: number;
  collaborators: number;
  batches: number;
  apiKeys: number;
}

const PAGE = 500;
const MAX_PAGES = 400;
const OWNER_TABLES: Array<{ table: string; column: string }> = [
  { table: 'clients', column: 'user_id' },
  { table: 'vies_batches', column: 'user_id' },
  { table: 'vies_jobs', column: 'user_id' },
  { table: 'vies_batch_documents', column: 'user_id' },
  { table: 'vies_fiscal_representatives', column: 'user_id' },
  { table: 'vies_intake_lots', column: 'owner_user_id' },
  { table: 'api_key_user_mapping', column: 'user_id' },
];

async function countRows(supabase: SupabaseClient, table: string, column: string, userId: string): Promise<number> {
  const { count, error } = await supabase.from(table).select(column, { count: 'exact', head: true }).eq(column, userId);
  if (error) throw new OffboardingError(500, 'database', `Lettura di ${table} non riuscita: ${error.message}`);
  return count ?? 0;
}

/** What the user still owns: the reason an account cannot simply be deleted. */
export async function getUserFootprint(supabase: SupabaseClient, userId: string): Promise<Footprint> {
  const [practices, clients, collaborators, batches, apiKeys] = await Promise.all([
    countRows(supabase, 'practices', 'user_id', userId),
    countRows(supabase, 'clients', 'user_id', userId),
    countRows(supabase, 'user_roles', 'parent_agent_id', userId),
    countRows(supabase, 'vies_batches', 'user_id', userId),
    countRows(supabase, 'api_key_user_mapping', 'user_id', userId),
  ]);
  return { practices, clients, collaborators, batches, apiKeys };
}

/** Throws when the account still has practices, clients or collaborators: the caller must hand them over first. */
export async function assertCanDelete(supabase: SupabaseClient, userId: string): Promise<void> {
  const footprint = await getUserFootprint(supabase, userId);
  if (footprint.practices > 0 || footprint.clients > 0 || footprint.collaborators > 0) {
    throw new OffboardingError(
      409,
      'user_has_data',
      `L'utente ha ancora ${footprint.practices} pratiche, ${footprint.clients} clienti e ${footprint.collaborators} collaboratori: vanno riassegnati prima di eliminarlo (oppure l'utente può essere solo disattivato).`,
    );
  }
}

export interface ReassignResult extends Footprint {
  /** Practices handed over (with a line in each one's history). */
  moved: number;
}

/**
 * Hands everything the user owns to another user: practices (each with a history line), clients, VIES lots
 * and their documents, fiscal representatives, received lots, the partner API keys mapped to the user, and
 * the collaborators of an agent. The new owner must exist; collaborators can only go to an agent or an
 * administrator.
 */
export async function reassignUserData(
  supabase: SupabaseClient,
  params: { fromUserId: string; toUserId: string; actorId: string; actorLabel: string },
): Promise<ReassignResult> {
  const { fromUserId, toUserId, actorId, actorLabel } = params;
  if (fromUserId === toUserId) throw new OffboardingError(400, 'same_user', 'Scegli un utente diverso da quello da riassegnare');

  const { data: target, error: targetError } = await supabase.from('profiles').select('id, full_name').eq('id', toUserId).maybeSingle();
  if (targetError) throw new OffboardingError(500, 'database', targetError.message);
  if (!target) throw new OffboardingError(404, 'target_not_found', 'Utente di destinazione non trovato');
  const { data: targetRole } = await supabase.from('user_roles').select('role').eq('user_id', toUserId).maybeSingle();
  if (!targetRole) throw new OffboardingError(422, 'target_without_role', "L'utente di destinazione non ha un ruolo");
  const { data: source } = await supabase.from('profiles').select('id, full_name').eq('id', fromUserId).maybeSingle();
  if (!source) throw new OffboardingError(404, 'user_not_found', 'Utente da riassegnare non trovato');

  const before = await getUserFootprint(supabase, fromUserId);
  if (before.collaborators > 0 && !['agente', 'admin'].includes(String(targetRole.role))) {
    throw new OffboardingError(422, 'target_not_agent', 'I collaboratori possono passare solo a un agente o a un amministratore');
  }

  // Practices, a page at a time: each moved practice gets a line in its history.
  const fromName = (source.full_name as string | null) || fromUserId;
  const toName = (target.full_name as string | null) || toUserId;
  let moved = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data: batch, error } = await supabase.from('practices').select('id').eq('user_id', fromUserId).order('id').limit(PAGE);
    if (error) throw new OffboardingError(500, 'database', `Lettura delle pratiche non riuscita: ${error.message}`);
    const ids = (batch ?? []).map((row) => row.id as string);
    if (ids.length === 0) break;
    const { error: updateError } = await supabase.from('practices').update({ user_id: toUserId }).in('id', ids).eq('user_id', fromUserId);
    if (updateError) throw new OffboardingError(500, 'database', `Riassegnazione delle pratiche non riuscita: ${updateError.message}`);
    const { error: historyError } = await supabase.from('practice_events').insert(
      ids.map((id) => ({
        practice_id: id,
        event_type: 'reassigned',
        description: `Pratica riassegnata da ${fromName} a ${toName} · ${actorLabel}`,
        created_by: actorId,
      })),
    );
    if (historyError) console.error('offboarding: storico non scritto:', historyError.message);
    moved += ids.length;
  }

  for (const { table, column } of OWNER_TABLES) {
    const { error } = await supabase.from(table).update({ [column]: toUserId }).eq(column, fromUserId);
    if (error) throw new OffboardingError(500, 'database', `Riassegnazione di ${table} non riuscita: ${error.message}`);
  }
  if (before.collaborators > 0) {
    const { error } = await supabase.from('user_roles').update({ parent_agent_id: toUserId }).eq('parent_agent_id', fromUserId);
    if (error) throw new OffboardingError(500, 'database', `Riassegnazione dei collaboratori non riuscita: ${error.message}`);
  }

  return { ...before, moved };
}
