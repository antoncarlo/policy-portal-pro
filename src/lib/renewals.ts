import { supabase } from "@/integrations/supabase/client";
import { callPortalAction } from "@/lib/portalActions";

export interface RenewalLink {
  id: string;
  practice_number: string;
}

export interface RenewalResult {
  practiceId: string;
  practiceNumber: string;
  renewalOf: string;
}

/** Creates the renewal of a practice (a new practice linked to it). The server checks who may do it. */
export const renewPractice = (practiceId: string) => callPortalAction<RenewalResult & { success: boolean }>("renew_practice", { practiceId });

/** For each of the practices, the practice that renewed it (if any). Row level security limits it to what the person can see. */
export async function fetchRenewals(practiceIds: string[]): Promise<Map<string, RenewalLink>> {
  const renewals = new Map<string, RenewalLink>();
  if (practiceIds.length === 0) return renewals;
  const chunk = 100;
  for (let index = 0; index < practiceIds.length; index += chunk) {
    const { data, error } = await supabase
      .from("practices")
      .select("id, practice_number, renewal_of")
      .in("renewal_of", practiceIds.slice(index, index + chunk));
    if (error) throw error;
    for (const row of data ?? []) if (row.renewal_of) renewals.set(row.renewal_of, { id: row.id, practice_number: row.practice_number });
  }
  return renewals;
}

/** Start dates of the policies, so the dialog states the period the server will give the renewal. */
export async function fetchPolicyStarts(practiceIds: string[]): Promise<Map<string, string | null>> {
  const starts = new Map<string, string | null>();
  const chunk = 100;
  for (let index = 0; index < practiceIds.length; index += chunk) {
    const { data, error } = await supabase.from("practices").select("id, policy_start_date").in("id", practiceIds.slice(index, index + chunk));
    if (error) throw error;
    for (const row of data ?? []) starts.set(row.id, row.policy_start_date);
  }
  return starts;
}

/** The practice a renewal comes from. */
export async function fetchRenewalSource(practiceId: string | null): Promise<RenewalLink | null> {
  if (!practiceId) return null;
  const { data } = await supabase.from("practices").select("id, practice_number").eq("id", practiceId).maybeSingle();
  return data ?? null;
}

export interface RenewalStats {
  expired: number;
  expiredRenewed: number;
  upcoming: number;
  upcomingRenewed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Renewal rate of the policies that expired in the last 12 months, and of those expiring in the next 90 days. */
export async function fetchRenewalStats(now = Date.now()): Promise<RenewalStats> {
  const { data, error } = await supabase.rpc("get_renewal_stats", { p_from: isoDay(now - 365 * DAY_MS), p_to: isoDay(now + 90 * DAY_MS) });
  if (error) throw error;
  const stats = (data ?? {}) as Record<string, number>;
  return {
    expired: Number(stats.expired ?? 0),
    expiredRenewed: Number(stats.expired_renewed ?? 0),
    upcoming: Number(stats.upcoming ?? 0),
    upcomingRenewed: Number(stats.upcoming_renewed ?? 0),
  };
}
