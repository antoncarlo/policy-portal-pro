import { supabase } from "@/integrations/supabase/client";
import { chunk, fetchAllRows } from "@/lib/fetchAllRows";
import { fetchLotPractices, safeName } from "@/lib/lotDocuments";
import { stageOf } from "@/lib/practiceStages";
import { callWorkflow } from "@/lib/workflowApi";
import {
  COMPANY_COPY_DOCUMENT_TYPE,
  PRACTICE_DOCUMENTS_BUCKET,
  SIGNED_DOCUMENT_TYPES,
  SIGNING_SLOTS,
  inferSigningSlotFromFileName,
  isSignedFileName,
  isSigningStage,
  practiceOfPath,
  signaturesComplete,
  signedDocumentPath,
  signedMimeType,
  storageReferenceOf,
} from "@/lib/signingDocuments";
import { saveBlob } from "@/lib/signingTemplates";
import { generateSigningDocument, loadPrefillInputs } from "@/lib/signingPrefillData";

/**
 * Documenti da firmare di un intero lotto VIES, in blocco:
 * - download: uno ZIP con una cartella per pratica deliberata (numero pratica) che contiene, nell'ordine
 *   di firma, la polizza nella copia per la Compagnia e i modelli di privacy, MUP e antiriciclaggio;
 * - upload: lo stesso ZIP firmato, letto cartella per cartella: ogni file finisce nella pratica della
 *   cartella, con il tipo riconosciuto dal nome; le pratiche con tutte le firme vengono trasmesse
 *   alla compagnia.
 */

const UPLOAD_CONCURRENCY = 3;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

interface LotPracticeRow {
  id: string;
  practice_number: string;
  status: string;
  financial_status: string | null;
}

interface StoredDocument {
  practice_id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
  created_at: string;
}

async function fetchLotPracticesWithStage(batchId: string): Promise<LotPracticeRow[]> {
  const rows = await fetchAllRows<LotPracticeRow>((from, to) =>
    supabase.from("practices").select("id, practice_number, status, financial_status").eq("vies_batch_id", batchId).order("id", { ascending: true }).range(from, to),
  );
  return [...rows].sort((a, b) => a.practice_number.localeCompare(b.practice_number));
}

/** Copie per la Compagnia e copie firmate delle pratiche indicate, le piu' recenti prima. */
async function fetchFlowDocuments(practiceIds: string[]): Promise<Map<string, StoredDocument[]>> {
  const byPractice = new Map<string, StoredDocument[]>();
  for (const ids of chunk(practiceIds, 100)) {
    const { data } = await supabase
      .from("practice_documents")
      .select("practice_id, file_name, file_path, document_type, created_at")
      .in("practice_id", ids)
      .in("document_type", [COMPANY_COPY_DOCUMENT_TYPE, ...SIGNED_DOCUMENT_TYPES])
      .order("created_at", { ascending: false });
    for (const row of (data ?? []) as StoredDocument[]) {
      const list = byPractice.get(row.practice_id) ?? [];
      list.push(row);
      byPractice.set(row.practice_id, list);
    }
  }
  return byPractice;
}

export interface SigningBundleLabels {
  readme: string;
  readmeText: string;
}

export interface SigningBundleResult {
  practices: number;
  files: number;
  fileName: string;
}

export async function downloadSigningBundle(options: {
  batchId: string;
  fileLabel: string;
  labels: SigningBundleLabels;
  onProgress?: (done: number, total: number) => void;
}): Promise<SigningBundleResult> {
  const fileName = `${safeName(options.fileLabel, "lotto")}.zip`;
  const practices = (await fetchLotPracticesWithStage(options.batchId)).filter((practice) => isSigningStage(stageOf(practice)));
  const documents = practices.length > 0 ? await fetchFlowDocuments(practices.map((practice) => practice.id)) : new Map<string, StoredDocument[]>();

  // I tre documenti da firmare sono compilati per ogni pratica con i dati che il portale ha.
  const prefill = await loadPrefillInputs(practices.map((practice) => practice.id));

  // Per ogni pratica deliberata, i documenti da firmare nell'ordine di firma.
  const entries: Array<{ zipPath: string; blob?: Blob; storagePath?: string }> = [];
  for (const practice of practices) {
    const folder = safeName(practice.practice_number, "pratica");
    for (const slot of [...SIGNING_SLOTS].sort((a, b) => a.order - b.order)) {
      if (slot.hasTemplate) {
        const blob = await generateSigningDocument(slot.id, prefill.get(practice.id) ?? null);
        entries.push({ zipPath: `${folder}/${slot.order}_${slot.id}.pdf`, blob });
      } else {
        const copy = (documents.get(practice.id) ?? []).find((document) => document.document_type === slot.sourceType);
        if (copy) entries.push({ zipPath: `${folder}/${slot.order}_${COMPANY_COPY_DOCUMENT_TYPE}_${safeName(copy.file_name, "polizza.pdf")}`, storagePath: copy.file_path });
      }
    }
  }
  if (entries.length === 0) return { practices: practices.length, files: 0, fileName };

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(options.labels.readme, `${options.labels.readmeText}\n`);
  let done = 0;
  options.onProgress?.(0, entries.length);
  for (const entry of entries) {
    if (entry.blob) zip.file(entry.zipPath, entry.blob);
    else if (entry.storagePath) {
      const reference = storageReferenceOf(entry.storagePath);
      const { data } = await supabase.storage.from(reference.bucket).download(reference.path);
      if (data) zip.file(entry.zipPath, data);
    }
    done += 1;
    options.onProgress?.(done, entries.length);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
  saveBlob(blob, fileName);
  return { practices: practices.length, files: entries.length, fileName };
}

export interface SignedUploadResult {
  uploaded: number;
  practices: number;
  /** Pratiche con tutte le firme, trasmesse alla compagnia. */
  sent: number;
  /** File non attribuiti: cartella senza numero pratica, tipo non riconosciuto o pratica non deliberata. */
  skipped: string[];
}

export async function uploadSignedBundle(options: {
  batchId: string;
  file: File;
  onProgress?: (done: number, total: number) => void;
}): Promise<SignedUploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not authenticated");
  const practices = await fetchLotPracticesWithStage(options.batchId);

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(options.file);
  const files = Object.values(zip.files).filter((entry) => !entry.dir && isSignedFileName(entry.name) && !/(^|\/)__MACOSX\//.test(entry.name) && !/(^|\/)\./.test(entry.name));

  const skipped: string[] = [];
  const jobs: Array<{ practice: LotPracticeRow; slotId: (typeof SIGNING_SLOTS)[number]["id"]; signedType: string; name: string; entry: (typeof files)[number] }> = [];
  for (const entry of files) {
    const practice = practiceOfPath(entry.name, practices);
    const slot = inferSigningSlotFromFileName(entry.name);
    if (!practice || !slot || !isSigningStage(stageOf(practice))) {
      skipped.push(entry.name);
      continue;
    }
    jobs.push({ practice, slotId: slot.id, signedType: slot.signedType, name: entry.name.split("/").pop() ?? entry.name, entry });
  }

  let done = 0;
  let uploaded = 0;
  const touched = new Set<string>();
  options.onProgress?.(0, jobs.length);
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const blob = await job.entry.async("blob");
        if (blob.size > MAX_FILE_BYTES) throw new Error("too big");
        const path = signedDocumentPath(job.practice.id, job.slotId, job.name);
        const { error: uploadError } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).upload(path, blob, { contentType: signedMimeType(job.name), upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { error: insertError } = await supabase.from("practice_documents").insert({
          practice_id: job.practice.id,
          file_name: job.name,
          file_path: path,
          file_size: blob.size,
          mime_type: signedMimeType(job.name),
          uploaded_by: session.user.id,
          document_type: job.signedType,
        });
        if (insertError) {
          await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
          throw new Error(insertError.message);
        }
        uploaded += 1;
        touched.add(job.practice.id);
      } catch {
        skipped.push(job.entry.name);
      }
      done += 1;
      options.onProgress?.(done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, jobs.length) }, worker));

  // Le pratiche ora complete di firme: le copie partono verso la compagnia (il server salta quelle gia' trasmesse).
  let sent = 0;
  if (touched.size > 0) {
    const documents = await fetchFlowDocuments([...touched]);
    for (const practice of practices) {
      if (!touched.has(practice.id)) continue;
      if (!signaturesComplete(documents.get(practice.id) ?? [], stageOf(practice))) continue;
      try {
        const result = await callWorkflow<{ changed?: boolean }>("workflow_send_signed", { practiceId: practice.id });
        if (result.changed) sent += 1;
      } catch {
        // La trasmissione si puo' ripetere dalla pratica: il caricamento resta valido.
      }
    }
  }
  return { uploaded, practices: touched.size, sent, skipped };
}
