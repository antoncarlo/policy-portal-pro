import type { SupabaseClient } from '@supabase/supabase-js';
import { isPaid } from '../../src/lib/practiceStages.js';
import { attributeQueuedEvents, dispatchNotifications, suppressQueuedEvents } from './notification-dispatch.js';
import { emitPracticeEvent } from './vies-outbound.js';
import { loadPractice, WorkflowError } from './vies-workflow.js';

/**
 * Records the payment of an approved practice: it moves to "Pagate · in emissione", the history gets its line,
 * the company learns it can issue the policy. Used by the single button and by the lot's payment confirmation.
 */
export async function registerPracticePayment(
  supabase: SupabaseClient,
  userId: string,
  actorLabel: string,
  practiceId: string,
  paidAt: string,
  options: { quiet?: boolean } = {},
): Promise<Record<string, unknown>> {
  const startedAt = new Date();
  const practice = await loadPractice(supabase, practiceId);
  if (practice.status !== 'approvata') throw new WorkflowError(409, 'invalid_transition', 'Il pagamento si registra su una pratica deliberata');
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
    description: `Pagamento registrato (${paidAt.split('-').reverse().join('/')}) · ${actorLabel}`,
    created_by: userId,
  });
  // The company learns that the payment is in: it can issue the policy. A payment confirmed for the whole lot sends
  // one email for the lot, not one per practice.
  if (options.quiet) {
    await suppressQueuedEvents(supabase, practice.id, startedAt);
    await emitPracticeEvent(supabase, { practiceId: practice.id, kind: 'paid', origin: 'admin' });
  } else {
    await attributeQueuedEvents(supabase, practice.id, userId, startedAt);
    await Promise.all([emitPracticeEvent(supabase, { practiceId: practice.id, kind: 'paid', origin: 'admin' }), dispatchNotifications(supabase)]);
  }
  return { ok: true, changed: true, practiceId: practice.id, stage: 'da_emettere' };
}
