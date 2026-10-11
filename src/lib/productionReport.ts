import type { Database } from "@/integrations/supabase/types";

/** One row of the production report, as get_production_details returns it. */
export type ProductionDetailRow = Database["public"]["Functions"]["get_production_details"]["Returns"][number];
