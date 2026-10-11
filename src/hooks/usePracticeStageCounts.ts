import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { applyStageFilter, PRACTICE_STAGES, type FilterableQuery, type PracticeStage } from "@/lib/practiceStages";

// The few methods of the query builder used here, so the types stay shallow.
interface CountQuery extends FilterableQuery<CountQuery>, PromiseLike<{ count: number | null }> {}

export interface StageCounts {
  total: number;
  counts: Record<PracticeStage, number>;
  /** Deliberated practices whose payment is due within a week (or already late). */
  dueSoon: number;
}

const DUE_SOON_DAYS = 7;

async function loadCounts(): Promise<StageCounts> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const empty: StageCounts = { total: 0, counts: Object.fromEntries(PRACTICE_STAGES.map((stage) => [stage, 0])) as Record<PracticeStage, number>, dueSoon: 0 };
  if (!session) return empty;

  // The same practices the list shows: administrators see everything, the others their products.
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
  let allowedTypes: Enums<"practice_type">[] | null = null;
  if (!role) {
    const { data: permissions } = await supabase.from("user_product_permissions").select("practice_type").eq("user_id", session.user.id);
    if (!permissions?.length) return empty;
    allowedTypes = permissions.map((permission) => permission.practice_type);
  }

  const base = (): CountQuery => {
    const query = supabase.from("practices").select("id", { count: "exact", head: true });
    return (allowedTypes ? query.in("practice_type", allowedTypes) : query) as unknown as CountQuery;
  };

  const limit = new Date();
  limit.setDate(limit.getDate() + DUE_SOON_DAYS);
  const limitDate = limit.toISOString().slice(0, 10);

  const [total, ...stageResults] = await Promise.all([
    base(),
    ...PRACTICE_STAGES.map((stage) => applyStageFilter(base(), stage)),
  ]);
  const dueSoon = await supabase
    .from("practice_workflow")
    .select("practice_id, practices!inner(status, financial_status, practice_type)", { count: "exact", head: true })
    .lte("payment_due_date", limitDate)
    .eq("practices.status", "approvata")
    .or("financial_status.is.null,financial_status.eq.non_incassata", { referencedTable: "practices" });

  const counts = { ...empty.counts };
  PRACTICE_STAGES.forEach((stage, index) => {
    counts[stage] = stageResults[index].count ?? 0;
  });
  return { total: total.count ?? 0, counts, dueSoon: dueSoon.count ?? 0 };
}

/** Number of practices in each section, for the menu and the tabs of the practices page. */
export function usePracticeStageCounts() {
  return useQuery({
    queryKey: ["practice-stage-counts"],
    queryFn: loadCounts,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
