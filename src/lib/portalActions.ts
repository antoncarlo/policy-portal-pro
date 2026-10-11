import { supabase } from "@/integrations/supabase/client";

/** Calls /api/portal-actions with the user's session: actions that need the server's rights. */
export async function callPortalAction<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessione non valida");

  const response = await fetch("/api/portal-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw Object.assign(new Error(data?.error || `Errore ${response.status}`), { code: data?.code as string | undefined });
  return data as T;
}

/**
 * Asks the server to send the notification emails waiting in the queue (new practice, documents, notes,
 * status changes). Call it right after the user's action; it never throws: the daily run catches up.
 */
export const requestNotificationFlush = () => {
  void callPortalAction("flush_notifications").catch((error) => console.error("Notification flush failed:", error));
};

export interface EmailStatus {
  provider: "gmail" | "resend" | "none";
  sender: string | null;
}

/** Which channel sends the portal's emails (administrators only). */
export const getEmailStatus = () => callPortalAction<EmailStatus>("email_status");

/** Sends a real test email to the administrator's own address. */
export const sendTestEmail = () =>
  callPortalAction<EmailStatus & { sent: boolean; reason?: string; to?: string }>("send_test_email");
