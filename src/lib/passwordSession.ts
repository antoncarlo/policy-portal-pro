import { supabase } from "@/integrations/supabase/client";
import { mustChangePassword } from "@/lib/passwordPolicy";

/**
 * Quando il server cambia la password, Supabase annulla la sessione in corso (il refresh token non vale piu').
 * L'utente non deve rifare il login a mano: si rientra con l'email e la password appena scelta, e la nuova
 * sessione porta anche il flag "password provvisoria" gia' tolto.
 * Restituisce false se non e' stato possibile: in quel caso si esce e l'utente accede dalla pagina di accesso.
 */
export async function signInAfterPasswordChange(email: string | undefined, password: string): Promise<boolean> {
  if (email) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session && !mustChangePassword(data.session.user)) return true;
  }
  await supabase.auth.signOut();
  return false;
}

/** Email dell'utente con la sessione corrente (da leggere PRIMA di cambiare la password). */
export async function currentSessionEmail(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.email ?? undefined;
}
