import { supabase } from "@/integrations/supabase/client";

export type WorkflowActionName =
  | "workflow_deliberate"
  | "workflow_reject"
  | "workflow_request_info"
  | "workflow_provide_info"
  | "workflow_issue"
  | "workflow_reopen"
  | "workflow_mark_sent"
  | "workflow_register_payment"
  | "portal_status"
  | "intake_link";

/** Calls /api/vies-control with the user's session: the practice flow with the company, for administrators. */
export async function callWorkflow<T = Record<string, unknown>>(action: WorkflowActionName, payload: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessione non valida");

  const response = await fetch("/api/vies-control", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false || data?.error) {
    throw Object.assign(new Error(data?.error || `Errore ${response.status}`), { code: data?.code as string | undefined });
  }
  return data as T;
}

export interface PortalStatus {
  ok: true;
  public_url: string;
  email_ready: boolean;
  callback_url: string;
  intake_url: string;
  intake_status_url: string;
  portals: Array<{ id: string; name: string; host: string; can_send: boolean; can_receive: boolean }>;
}

export const getPortalStatus = () => callWorkflow<PortalStatus>("portal_status");
