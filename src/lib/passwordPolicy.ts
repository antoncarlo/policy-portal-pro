// Regole delle password del portale (usate dal browser e dal server, quindi niente dipendenze del browser).

export const PASSWORD_MIN_LENGTH = 6;

export type PasswordProblem = "tooShort" | "needsUppercase" | "needsSpecial";

/**
 * Minimo 6 caratteri, almeno una maiuscola e almeno un numero o carattere speciale (cioe' un carattere
 * che non sia una lettera: una cifra o un simbolo come ! @ # $ %). Restituisce il primo problema trovato.
 */
export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (!/\p{Lu}/u.test(password)) return "needsUppercase";
  if (!/[\p{N}]|[^\p{L}\p{N}\s]/u.test(password)) return "needsSpecial";
  return null;
}

/** L'utente e' stato creato da un amministratore con una password provvisoria da cambiare al primo accesso. */
export const mustChangePassword = (user: { app_metadata?: Record<string, unknown> | null } | null | undefined) =>
  user?.app_metadata?.must_change_password === true;
