// Regole delle password del portale (usate dal browser e dal server, quindi niente dipendenze del browser).

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordProblem = "tooShort" | "needsUppercase" | "needsNumber";

/** Minimo 12 caratteri, almeno una maiuscola e una cifra. Restituisce il primo problema trovato. */
export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (!/[A-Z]/.test(password)) return "needsUppercase";
  if (!/[0-9]/.test(password)) return "needsNumber";
  return null;
}

/** L'utente e' stato creato da un amministratore con una password provvisoria da cambiare al primo accesso. */
export const mustChangePassword = (user: { app_metadata?: Record<string, unknown> | null } | null | undefined) =>
  user?.app_metadata?.must_change_password === true;
