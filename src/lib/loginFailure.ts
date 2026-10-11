/**
 * Tells the portal that a sign-in failed, so that it shows in the audit log (Settings › Logs) and the
 * administrators hear of repeated failures. Only the address typed is sent, never the password. It is
 * best effort: nothing waits for it and nothing the user sees depends on it.
 */
export function reportLoginFailure(email: string): void {
  try {
    const address = email.trim();
    if (!address) return;
    void fetch("/api/login-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // the report is optional
  }
}

/** Wrong address or password, as opposed to a network or server problem on the way. */
export const isInvalidCredentials = (error: { message?: string; code?: string; status?: number } | null | undefined): boolean =>
  Boolean(error) && (error?.code === "invalid_credentials" || error?.message === "Invalid login credentials");
