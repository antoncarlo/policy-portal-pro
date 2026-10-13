import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Records the insurer's policy number on the practice. A practice created from a lot carries the portal's own
 * reference ("VIES-<progressivo>") in that field: it counts as "no number yet", so the real one replaces it.
 * A number the insurer already gave is never overwritten.
 */
export async function recordPolicyNumber(supabase: SupabaseClient, practiceId: string, policyNumber: string | null | undefined) {
  const value = policyNumber?.trim();
  if (!value) return;
  await supabase
    .from('practices')
    .update({ policy_number: value })
    .eq('id', practiceId)
    .or('policy_number.is.null,policy_number.like.VIES-%');
}
