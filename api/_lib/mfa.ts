import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Second factor on the server routes that act for a signed-in user.
 *
 * The database decides who needs it (public.mfa_required_for_user: administrators and users with
 * a verified authenticator factor, once the deploy switch is on). The session token carries the
 * level reached: aal2 only after the user entered the code of the authenticator app.
 */

export class MfaRequiredError extends Error {
  constructor() {
    super('Verifica in due passaggi richiesta. Accedi di nuovo e inserisci il codice dell\'app.');
  }
}

/** Authenticator level written in the access token. The token signature is checked by auth.getUser. */
export function sessionLevel(accessToken: string): 'aal1' | 'aal2' {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return payload?.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

/** Throws MfaRequiredError when this user must use a second factor and the session did not. */
export async function assertSecondFactor(supabase: SupabaseClient, accessToken: string, userId: string): Promise<void> {
  if (sessionLevel(accessToken) === 'aal2') return;
  const { data, error } = await supabase.rpc('mfa_required_for_user', { p_user_id: userId });
  // If the check cannot be made, do not let the request through.
  if (error) throw new Error(`Verifica sicurezza non riuscita: ${error.message}`);
  if (data === true) throw new MfaRequiredError();
}
