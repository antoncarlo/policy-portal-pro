// Client of the "vies-document-agent" Supabase Edge Function (Claude). The
// agent classifies documents without readable text (scans, photos) and reads
// the codes printed on them. Its output is never trusted as is: every code is
// accepted only if its check character is valid.

import { FunctionsHttpError } from "@supabase/supabase-js";
import { isValidChineseId, isValidItalianVat, isValidUscc } from "./viesDocumentScan";

export interface AgentDocumentResult {
  document_type: string;
  company_name_latin: string;
  company_name_chinese: string;
  unified_social_credit_code: string;
  italian_vat_number: string;
  legal_representative_name: string;
  legal_representative_id_number: string;
  fiscal_representative_name: string;
  fiscal_representative_tax_code: string;
  document_date: string;
  expiry_date: string;
  has_italian_translation: boolean;
  is_signed: boolean;
  issues: string[];
}

export type AgentCallOutcome =
  | { status: "ok"; result: AgentDocumentResult }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

const AGENT_MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const agentMediaType = (extension: string) => AGENT_MEDIA_TYPES[extension.toLowerCase()] ?? null;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

const invokeAgent = async (body: Record<string, unknown>) => {
  // Loaded on call so the pure helpers below stay importable without a Supabase client.
  const { supabase } = await import("../integrations/supabase/client");
  return supabase.functions.invoke("vies-document-agent", { body });
};

const toFailure = async (error: Error): Promise<Exclude<AgentCallOutcome, { status: "ok" }>> => {
  let payload: { error?: string; code?: string } | null = null;
  if (error instanceof FunctionsHttpError) {
    try {
      payload = await error.context.json();
    } catch {
      payload = null;
    }
  }
  const message = payload?.error ?? error.message ?? "Agent non raggiungibile.";
  // Function not deployed, or deployed without its API key.
  const unavailable =
    payload?.code === "AGENT_NOT_CONFIGURED" || (error instanceof FunctionsHttpError && error.context.status === 404);
  return unavailable ? { status: "unavailable", message } : { status: "error", message };
};

/** Quick check, without any document, that the agent is deployed and has its API key. */
export const probeViesDocumentAgent = async (): Promise<{ ready: true } | Exclude<AgentCallOutcome, { status: "ok" }>> => {
  const { error } = await invokeAgent({ probe: true });
  return error ? toFailure(error) : { ready: true };
};

export const callViesDocumentAgent = async (bytes: Uint8Array, mediaType: string, fileName: string): Promise<AgentCallOutcome> => {
  const { data, error } = await invokeAgent({ file_name: fileName, media_type: mediaType, data: toBase64(bytes) });
  if (error) return toFailure(error);
  return { status: "ok", result: (data as { result: AgentDocumentResult }).result };
};

/** Codes read by the agent, kept only when their check character is valid. */
export const verifiedAgentIdentifiers = (result: AgentDocumentResult) => {
  const issues: string[] = [];
  const clean = (value: string) => value.replace(/\s+/g, "").toUpperCase();
  const uscc = clean(result.unified_social_credit_code);
  const vat = clean(result.italian_vat_number).replace(/^IT/, "");
  const chineseId = clean(result.legal_representative_id_number);
  const usccs = uscc && isValidUscc(uscc) ? [uscc] : [];
  const vatNumbers = vat && isValidItalianVat(vat) ? [vat] : [];
  const chineseIds = chineseId && isValidChineseId(chineseId) ? [chineseId] : [];
  if (uscc && !usccs.length) issues.push(`Codice di credito sociale letto non valido: ${uscc}`);
  if (vat && !vatNumbers.length) issues.push(`Partita IVA letta non valida: ${vat}`);
  if (chineseId && /^\d{17}[\dX]$/.test(chineseId) && !chineseIds.length) {
    issues.push(`Numero del documento d'identità letto non valido: ${chineseId}`);
  }
  return { usccs, vatNumbers, chineseIds, issues };
};
