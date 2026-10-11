import { supabase } from "@/integrations/supabase/client";

/** A VIES lot as the practices list and the menu show it. */
export interface PracticeLot {
  batchId: string;
  /** Null for lots created before lots were numbered. */
  number: number | null;
  name: string;
  representative: string | null;
  createdAt: string;
  /** Practices of the lot the signed-in user can see. */
  practiceCount: number;
}

/**
 * The lots that have at least one practice the user can see, newest first. The database applies the same
 * perimeter as the practices themselves (own, collaborators' for an agent, everything for an administrator).
 */
export async function fetchPracticeLots(options: { batchIds?: string[]; limit?: number } = {}): Promise<PracticeLot[]> {
  const { data, error } = await supabase.rpc("get_practice_lots", {
    p_batch_ids: options.batchIds ?? null,
    p_limit: options.limit ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    batchId: row.batch_id,
    number: row.lot_number ?? null,
    name: row.name,
    representative: row.fiscal_representative_name ?? null,
    createdAt: row.created_at,
    practiceCount: row.practice_count,
  }));
}

/** "Lot 3", or the lot's own name when it has no number. */
export const lotTitle = (lot: Pick<PracticeLot, "number" | "name">, lotName: (number: number) => string) =>
  lot.number ? lotName(lot.number) : lot.name;
