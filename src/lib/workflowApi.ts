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
  | "intake_link"
  | "intake_reject"
  | "webhook_list"
  | "webhook_set"
  | "webhook_remove"
  | "webhook_test"
  | "portal_test"
  | "deliveries_retry"
  | "deliveries_process";

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
  portals: Array<{ id: string; name: string; host: string; can_send: boolean; can_receive: boolean; events_host: string }>;
}

export const getPortalStatus = () => callWorkflow<PortalStatus>("portal_status");

export interface PartnerKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  partner_email: string | null;
  is_active: boolean;
  /** Linked to a portal user: only then can the key send lots in. */
  mapped: boolean;
  webhook: { url: string; active: boolean; created_at: string; updated_at: string } | null;
  pending: number;
  failed: number;
}

export const listWebhooks = () => callWorkflow<{ ok: true; keys: PartnerKeyRow[] }>("webhook_list");

export const setWebhook = (payload: { apiKeyId: string; url?: string; active?: boolean; rotateSecret?: boolean }) =>
  callWorkflow<{ ok: true; secret: string | null; created: boolean }>("webhook_set", payload);

export const removeWebhook = (apiKeyId: string) => callWorkflow("webhook_remove", { apiKeyId });

export interface TestResult {
  ok: true;
  delivered: boolean;
  status: number | null;
  error: string | null;
}

export const testWebhook = (apiKeyId: string) => callWorkflow<TestResult>("webhook_test", { apiKeyId });
export const testPortal = (portalId: string) => callWorkflow<TestResult>("portal_test", { portalId });

export const retryDeliveries = (deliveryId?: string) =>
  callWorkflow<{ ok: true; attempted: number; delivered: number }>("deliveries_retry", deliveryId ? { deliveryId } : {});
