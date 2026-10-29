// Client of the "vies-document-agent" Supabase Edge Function (Claude). The
// agent classifies documents without readable text (scans, photos) and reads
// the codes printed on them. Its output is never trusted as is: every code is
// accepted only if its check character is valid.

import { FunctionsHttpError } from "@supabase/supabase-js";
import { isValidChineseId, isValidItalianVat, isValidUscc } from "./viesDocumentScan";

export interface AgentDocumentResult {
  document_type: string;
  /** Every document type in the file: a PDF can bundle several documents. */
  contained_document_types?: string[];
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
  /** excerpt: the agent read only the first pages and the last one of the document. */
  | { status: "ok"; result: AgentDocumentResult; excerpt?: boolean }
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

type AgentFailure = Exclude<AgentCallOutcome, { status: "ok" }> & { retryable?: boolean };

const toFailure = async (error: Error): Promise<AgentFailure> => {
  let payload: { error?: string; code?: string } | null = null;
  if (error instanceof FunctionsHttpError) {
    try {
      payload = await error.context.json();
    } catch {
      payload = null;
    }
  }
  const message = payload?.error ?? error.message ?? "Agent non raggiungibile.";
  // Function not deployed, deployed without its API key, or the API credit is used up: no document can be read.
  const unavailable =
    payload?.code === "AGENT_NOT_CONFIGURED" ||
    payload?.code === "AGENT_NO_CREDIT" ||
    (error instanceof FunctionsHttpError && error.context.status === 404);
  // Temporary problems (rate limit, gateway, network) are worth another attempt.
  const status = error instanceof FunctionsHttpError ? error.context.status : null;
  const retryable = !unavailable && (status === null || status === 429 || status >= 500);
  return unavailable ? { status: "unavailable", message } : { status: "error", message, retryable };
};

// With several readings in parallel the API may answer 429 for a while: three more attempts, spaced out.
const AGENT_RETRY_DELAYS_MS = [3000, 8000, 20000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The first reading of a PDF sends only its first pages and the last one (signature, stamp): the API bills
// every page it receives, and that is where a document says what it is and whose it is. The whole document
// is read only when its ZIP still misses a required document (second look).
const EXCERPT_FIRST_PAGES = 2;

export interface PdfExcerpt {
  bytes: Uint8Array;
  /** 1-based numbers of the pages kept; null when the document is sent whole. */
  pages: number[] | null;
  totalPages: number | null;
}

export const excerptPdf = async (bytes: Uint8Array): Promise<PdfExcerpt> => {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = source.getPageCount();
    if (totalPages <= EXCERPT_FIRST_PAGES + 1) return { bytes, pages: null, totalPages };
    const indices = [...Array.from({ length: EXCERPT_FIRST_PAGES }, (_, index) => index), totalPages - 1];
    const excerpt = await PDFDocument.create();
    for (const page of await excerpt.copyPages(source, indices)) excerpt.addPage(page);
    return { bytes: await excerpt.save(), pages: indices.map((index) => index + 1), totalPages };
  } catch {
    // A PDF pdf-lib cannot rewrite is sent as it is.
    return { bytes, pages: null, totalPages: null };
  }
};

// Readings already done in this tab, by file content: uploading the ZIPs again after adding the missing
// documents sends the agent only the new files. Kept in the browser tab (memory and sessionStorage, which
// survives a reload of the page), never on the server. The version changes with the agent's model and
// document types; an excerpt and the whole document are two readings.
const READING_CACHE_PREFIX = "vies-agent-reading:v3:";
// rechecked: the reading came from the rereading of a code with a wrong check character (never read a third time).
type CachedReading = AgentDocumentResult & { rechecked?: boolean };
const readingCache = new Map<string, CachedReading>();

const contentHash = async (bytes: Uint8Array) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readingKey = (hash: string, mediaType: string, excerpt: boolean) =>
  `${READING_CACHE_PREFIX}${mediaType}:${excerpt ? "excerpt:" : ""}${hash}`;

const cachedReading = (key: string) => {
  const cached = readingCache.get(key);
  if (cached) return cached;
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    const result = JSON.parse(stored) as CachedReading;
    readingCache.set(key, result);
    return result;
  } catch {
    return null;
  }
};

const rememberReading = (key: string, result: CachedReading) => {
  readingCache.set(key, result);
  try {
    sessionStorage.setItem(key, JSON.stringify(result));
  } catch {
    // Storage full or blocked: the reading stays in memory for this page.
  }
};

/** Quick check, without any document, that the agent is deployed and has its API key. */
export const probeViesDocumentAgent = async (): Promise<{ ready: true } | Exclude<AgentCallOutcome, { status: "ok" }>> => {
  const { error } = await invokeAgent({ probe: true });
  if (!error) return { ready: true };
  const failure = await toFailure(error);
  return failure.status === "unavailable" ? { status: "unavailable", message: failure.message } : { status: "error", message: failure.message };
};

type AgentRequest = { file_name: string; media_type: string; data: string; excerpt?: { pages: number[]; total_pages: number | null } };

const buildRequest = async (bytes: Uint8Array, mediaType: string, fileName: string, mayExcerpt: boolean) => {
  const sent = mayExcerpt ? await excerptPdf(bytes) : { bytes, pages: null, totalPages: null };
  const body: AgentRequest = { file_name: fileName, media_type: mediaType, data: toBase64(sent.bytes) };
  if (sent.pages) body.excerpt = { pages: sent.pages, total_pages: sent.totalPages };
  return { body, excerpt: sent.pages !== null };
};

const readWithRetries = async (body: AgentRequest & { recheck?: boolean }): Promise<AgentCallOutcome> => {
  for (let attempt = 0; ; attempt += 1) {
    const { data, error } = await invokeAgent(body);
    if (!error) return { status: "ok", result: (data as { result: AgentDocumentResult }).result };
    const failure = await toFailure(error);
    if (!failure.retryable || attempt >= AGENT_RETRY_DELAYS_MS.length) {
      return failure.status === "unavailable"
        ? { status: "unavailable", message: failure.message }
        : { status: "error", message: attempt ? `${failure.message} (dopo ${attempt + 1} tentativi)` : failure.message };
    }
    await wait(AGENT_RETRY_DELAYS_MS[attempt]);
  }
};

// A code read with a wrong check character (a 0 of "00" missed on a small, rotated scan): the same pages are read
// once more by the more capable model. A failed rereading leaves the first reading, and the next upload tries again.
const withRecheck = async (first: CachedReading, body: AgentRequest, key: string | null, excerpt: boolean): Promise<AgentCallOutcome> => {
  if (first.rechecked || verifiedAgentIdentifiers(first).issues.length === 0) {
    if (key) rememberReading(key, first);
    return { status: "ok", result: first, excerpt };
  }
  const reread = await readWithRetries({ ...body, recheck: true });
  if (reread.status !== "ok") {
    if (key) rememberReading(key, first);
    return { status: "ok", result: first, excerpt };
  }
  if (key) rememberReading(key, { ...reread.result, rechecked: true });
  return { status: "ok", result: reread.result, excerpt };
};

/** wholeDocument: send every page of a PDF (second look); otherwise only its first pages and the last one. */
export const callViesDocumentAgent = async (
  bytes: Uint8Array,
  mediaType: string,
  fileName: string,
  wholeDocument = false,
): Promise<AgentCallOutcome> => {
  const hash = await contentHash(bytes).catch(() => null);
  const mayExcerpt = mediaType === "application/pdf" && !wholeDocument;
  // A reading done earlier in this tab: of the whole file first, else (first reading) of its excerpt.
  for (const excerpt of mayExcerpt ? [false, true] : [false]) {
    const key = hash ? readingKey(hash, mediaType, excerpt) : null;
    const cached = key ? cachedReading(key) : null;
    if (!cached) continue;
    if (cached.rechecked || verifiedAgentIdentifiers(cached).issues.length === 0) return { status: "ok", result: cached, excerpt };
    // Kept from before a rereading was possible or had succeeded: the same pages are sent for it.
    const request = await buildRequest(bytes, mediaType, fileName, excerpt);
    return withRecheck(cached, request.body, key, request.excerpt);
  }
  const { body, excerpt } = await buildRequest(bytes, mediaType, fileName, mayExcerpt);
  const key = hash ? readingKey(hash, mediaType, excerpt) : null;
  const outcome = await readWithRetries(body);
  return outcome.status === "ok" ? withRecheck(outcome.result, body, key, excerpt) : outcome;
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
