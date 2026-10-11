import type { SupabaseClient } from '@supabase/supabase-js';
import { renewalPeriod } from '../../src/lib/renewalPeriod.js';
import { attributeQueuedEvents } from './notification-dispatch.js';

export { renewalPeriod };

/**
 * Renewal of a policy that is about to expire: a new practice, linked to the old one (`renewal_of`),
 * with the client's data and a policy period that starts the day the old one ends. The new practice
 * starts "in lavorazione" and without premium or documents: those belong to the new policy. A practice
 * is renewed once (unique index); the expiry reminders of a renewed policy stop.
 */

export class RenewalError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Statuses of a policy that is in force (or about to be): the ones the expiry list shows. */
const RENEWABLE_STATUSES = ['completata', 'approvata', 'in_lavorazione'];
/** How far past the end date a renewal is still proposed. */
const MAX_DAYS_AFTER_EXPIRY = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const COLUMNS =
  'id, practice_number, practice_type, status, client_name, client_phone, client_email, client_id, user_id, beneficiary, owner_tax_code, pet_microchip, policy_start_date, policy_end_date, notes, api_key_id';

interface PracticeRow {
  id: string;
  practice_number: string;
  practice_type: string;
  status: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_id: string | null;
  user_id: string;
  beneficiary: string | null;
  owner_tax_code: string | null;
  pet_microchip: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  notes: string | null;
  api_key_id: string | null;
}

const parseDay = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);

async function canRenew(supabase: SupabaseClient, callerId: string, practice: PracticeRow): Promise<boolean> {
  if (practice.user_id === callerId) return true;
  const { data: roles } = await supabase.from('user_roles').select('user_id, role, parent_agent_id').in('user_id', [callerId, practice.user_id]);
  const rows = (roles ?? []) as Array<{ user_id: string; role: string; parent_agent_id: string | null }>;
  if (rows.some((row) => row.user_id === callerId && row.role === 'admin')) return true;
  return rows.some((row) => row.user_id === practice.user_id && row.role === 'collaboratore' && row.parent_agent_id === callerId);
}

export async function renewPractice(
  supabase: SupabaseClient,
  options: { practiceId: string; actorId: string; actorLabel: string; now?: Date },
): Promise<{ practiceId: string; practiceNumber: string; renewalOf: string }> {
  const now = options.now ?? new Date();
  const startedAt = new Date();

  const { data, error } = await supabase.from('practices').select(COLUMNS).eq('id', options.practiceId).maybeSingle();
  if (error) throw new RenewalError(500, 'database', `Lettura della pratica non riuscita: ${error.message}`);
  const practice = data as PracticeRow | null;
  if (!practice) throw new RenewalError(404, 'practice_not_found', 'Pratica non trovata');
  if (!(await canRenew(supabase, options.actorId, practice))) throw new RenewalError(403, 'forbidden', 'Non puoi rinnovare questa pratica');

  if (practice.practice_type === 'vies') throw new RenewalError(422, 'not_renewable', 'Le pratiche VIES non si rinnovano');
  if (!RENEWABLE_STATUSES.includes(practice.status)) throw new RenewalError(422, 'not_renewable', 'Solo una pratica in corso o emessa può essere rinnovata');
  if (!practice.policy_end_date) throw new RenewalError(422, 'no_end_date', 'La pratica non ha una data di scadenza: impostala prima di rinnovare');
  const sinceExpiry = (now.getTime() - parseDay(practice.policy_end_date)) / DAY_MS;
  if (sinceExpiry > MAX_DAYS_AFTER_EXPIRY) throw new RenewalError(422, 'too_late', 'La polizza è scaduta da troppo tempo: carica una nuova pratica');

  const { data: existing } = await supabase.from('practices').select('id, practice_number').eq('renewal_of', practice.id).maybeSingle();
  if (existing) throw new RenewalError(409, 'already_renewed', `La pratica è già stata rinnovata (${(existing as { practice_number: string }).practice_number})`);

  const period = renewalPeriod(practice.policy_start_date, practice.policy_end_date);
  const { data: created, error: insertError } = await supabase
    .from('practices')
    .insert({
      practice_type: practice.practice_type,
      client_name: practice.client_name,
      client_phone: practice.client_phone,
      client_email: practice.client_email,
      client_id: practice.client_id,
      user_id: practice.user_id,
      beneficiary: practice.beneficiary,
      owner_tax_code: practice.owner_tax_code,
      pet_microchip: practice.pet_microchip,
      policy_start_date: period.start,
      policy_end_date: period.end,
      notes: `Rinnovo della pratica ${practice.practice_number}`,
      status: 'in_lavorazione',
      renewal_of: practice.id,
    })
    .select('id, practice_number')
    .single();
  if (insertError || !created) {
    // Two people renewing at the same moment: the unique index lets only one through.
    if (insertError?.code === '23505') throw new RenewalError(409, 'already_renewed', 'La pratica è già stata rinnovata');
    throw new RenewalError(500, 'database', `Creazione del rinnovo non riuscita: ${insertError?.message ?? 'nessun dato'}`);
  }
  const renewal = created as { id: string; practice_number: string };

  // The history of both practices says what happened and who did it.
  const events = [
    { practice_id: renewal.id, event_type: 'renewal_of', description: `Rinnovo della pratica ${practice.practice_number} · ${options.actorLabel}`, created_by: options.actorId },
    { practice_id: practice.id, event_type: 'renewal_started', description: `Rinnovo avviato: pratica ${renewal.practice_number} · ${options.actorLabel}`, created_by: options.actorId },
  ];
  const { error: historyError } = await supabase.from('practice_events').insert(events);
  if (historyError) console.error('rinnovo: storico non scritto:', historyError.message);

  // The service role inserted it: say who, so the person is not written to about their own action.
  await attributeQueuedEvents(supabase, renewal.id, options.actorId, startedAt);
  return { practiceId: renewal.id, practiceNumber: renewal.practice_number, renewalOf: practice.id };
}
