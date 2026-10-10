import { supabase } from "@/integrations/supabase/client";
import { mustChangePassword } from "@/lib/passwordPolicy";

/**
 * Dopo che il server ha salvato la nuova password, aggiorna la sessione per togliere il flag "password provvisoria".
 * Restituisce false se non e' stato possibile: in quel caso si esce, cosi' l'utente accede con la nuova password
 * invece di restare in un giro continuo verso la pagina di cambio.
 */
export async function refreshAfterPasswordChange(): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session && !mustChangePassword(data.session.user)) return true;
  await supabase.auth.signOut();
  return false;
}
