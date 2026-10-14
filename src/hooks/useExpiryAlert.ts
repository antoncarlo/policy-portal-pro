import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Un mese prima della scadenza di una polizza compare l'avviso nel menu. */
export const EXPIRY_ALERT_DAYS = 30;

/**
 * Quante polizze dell'utente (e, per un agente, dei suoi collaboratori) scadono entro 30 giorni: lo stesso
 * perimetro dello scadenzario, che lo calcola nel database. Si aggiorna ogni 10 minuti.
 */
export function useExpiryAlert() {
  return useQuery({
    queryKey: ["expiry-alert"],
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return 0;
      const { data, error } = await supabase.rpc("get_upcoming_expiries", {
        p_user_id: session.user.id,
        p_days_ahead: EXPIRY_ALERT_DAYS,
        p_practice_type: null,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).length;
    },
  });
}
