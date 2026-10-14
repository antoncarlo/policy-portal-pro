import { supabase } from "@/integrations/supabase/client";
import { chunk } from "@/lib/fetchAllRows";
import { LOT_CYCLE_DOCUMENT_TYPES, lotCycleOf, practiceStateOf, type LotCycleState, type LotFlowRow } from "@/lib/lotCycle";
import { safeName } from "@/lib/lotDocuments";
import { callWorkflow } from "@/lib/workflowApi";

const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";
export const LOT_DOCUMENTS_BUCKET = "vies-lot-documents";

export interface LotEventRow {
  id: number;
  event_type: string;
  description: string;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface LotDocumentRow {
  id: string;
  kind: "estratto_conto_firmato" | "bonifico" | "altro";
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface LotPracticeRow {
  id: string;
  practice_number: string;
  client_name: string;
  policy_number: string | null;
  status: string;
  financial_status: string | null;
  user_id: string;
  premium_gross: number | null;
}

export interface LotCycleData {
  flow: LotFlowRow | null;
  events: LotEventRow[];
  documents: LotDocumentRow[];
  practices: LotPracticeRow[];
  cycle: LotCycleState;
}

/** Tutto cio' che serve a mostrare il ciclo di un lotto, con il perimetro dell'utente (lo applica il database). */
export async function fetchLotCycle(batchId: string): Promise<LotCycleData> {
  const [practiceResult, flowResult, eventResult, documentResult] = await Promise.all([
    supabase.from("practices").select("id, practice_number, client_name, policy_number, status, financial_status, user_id, premium_gross").eq("vies_batch_id", batchId).order("practice_number"),
    supabase.from("vies_lot_flow").select("*").eq("batch_id", batchId).maybeSingle(),
    supabase.from("vies_lot_events").select("id, event_type, description, details, created_by, created_at").eq("batch_id", batchId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
    supabase.from("vies_lot_documents").select("id, kind, file_name, file_path, file_size, mime_type, uploaded_by, created_at").eq("batch_id", batchId).order("created_at", { ascending: false }),
  ]);
  if (practiceResult.error) throw new Error(practiceResult.error.message);
  const practices = (practiceResult.data ?? []) as LotPracticeRow[];

  const docsByPractice = new Map<string, Array<{ file_name: string; document_type: string | null; created_at: string; practice_id: string }>>();
  for (const part of chunk(practices.map((practice) => practice.id), 100)) {
    const { data } = await supabase.from("practice_documents").select("practice_id, file_name, document_type, created_at").in("practice_id", part).in("document_type", LOT_CYCLE_DOCUMENT_TYPES);
    for (const doc of data ?? []) docsByPractice.set(doc.practice_id, [...(docsByPractice.get(doc.practice_id) ?? []), doc]);
  }
  const flow = (flowResult.data as LotFlowRow | null) ?? null;
  const cycle = lotCycleOf(flow, practices.map((practice) => practiceStateOf(practice, docsByPractice.get(practice.id) ?? [])));
  return {
    flow,
    events: (eventResult.data ?? []) as unknown as LotEventRow[],
    documents: (documentResult.data ?? []) as LotDocumentRow[],
    practices,
    cycle,
  };
}

/** Salva un file nella cartella della pratica e restituisce come indicarlo al server. */
export async function uploadPracticeFile(practiceId: string, type: string, file: Blob, fileName: string, index = 0) {
  const mime = /\.zip$/i.test(fileName) ? "application/zip" : "application/pdf";
  const path = `${practiceId}/${type}-${Date.now()}-${index}-${safeName(fileName, "documento.pdf")}`;
  const { error } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return { path, document: { file_name: fileName, mime_type: mime, storage_path: path } };
}

/** Salva un file del lotto (estratto conto firmato, bonifico) nell'archivio dei documenti del lotto. */
export async function uploadLotFile(batchId: string, file: File, kind: LotDocumentRow["kind"]) {
  const path = `${batchId}/${kind}-${Date.now()}-${safeName(file.name, "documento")}`;
  const mime = file.type || (/\.p7m$/i.test(file.name) ? "application/pkcs7-mime" : "application/octet-stream");
  const { error } = await supabase.storage.from(LOT_DOCUMENTS_BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return { kind, storage_path: path, file_name: file.name, mime_type: mime, size: file.size };
}

export async function lotDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from(LOT_DOCUMENTS_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "link");
  return data.signedUrl;
}

export const callLot = callWorkflow;
