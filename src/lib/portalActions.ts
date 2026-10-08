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
  if (!response.ok || data?.error) throw new Error(data?.error || `Errore ${response.status}`);
  return data as T;
}

/** Emails the administrators about a new practice. The email is sent by the server. */
export const notifyAdminNewPractice = (practiceId: string) => callPortalAction("notify_new_practice", { practiceId });
