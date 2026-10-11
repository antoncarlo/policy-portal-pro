import type { User } from "@supabase/supabase-js";
import { callPortalAction } from "@/lib/portalActions";

/**
 * Tells the server that the person signed in or out, for the audit log. Never throws: a failure here must
 * not get in the way of signing in or out.
 */
export const recordSessionEvent = async (event: "login" | "logout"): Promise<void> => {
  try {
    await callPortalAction("log_session_event", { event });
  } catch (error) {
    console.error("Audit session event:", error);
  }
};

/** One "login" line per sign-in, however many times the sign-in page routes the person onwards. */
export const recordLoginOnce = (user: User) => {
  const key = `audit-login-${user.id}-${user.last_sign_in_at ?? ""}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Without session storage the line may repeat: better than none.
  }
  void recordSessionEvent("login");
};
