import { callPortalAction } from "@/lib/portalActions";

export interface MergeClientsResult {
  keptId: string;
  merged: Array<{ id: string; name: string; email: string | null }>;
  practicesMoved: number;
  filled: string[];
}

export const mergeClients = (keepId: string, mergeIds: string[]) => callPortalAction<MergeClientsResult & { success: boolean }>("merge_clients", { keepId, mergeIds });

export const exportClientData = (clientId: string) => callPortalAction<{ success: boolean; export: Record<string, unknown> }>("export_client_data", { clientId });

/** Hands a JSON document to the browser as a download. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
