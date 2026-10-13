import { supabase } from "@/integrations/supabase/client";
import { chunk, fetchAllRows } from "@/lib/fetchAllRows";
import { fetchLotPractices, safeName } from "@/lib/lotDocuments";
import { stageOf } from "@/lib/practiceStages";
import {
  PRACTICE_DOCUMENTS_BUCKET,
  SIGNING_SLOTS,
  inferSigningSlotFromFileName,
  isSlotAvailable,
  signedDocumentPath,
  storageReferenceOf,
} from "@/lib/signingDocuments";
import { downloadSigningTemplate, listSigningTemplates, saveBlob } from "@/lib/signingTemplates";

/**
 * Documenti da firmare di un intero lotto VIES, in blocco:
 * - download: uno ZIP con una cartella per pratica (numero pratica) che contiene i modelli da firmare
 *   e, se la pratica e' deliberata, la bozza della compagnia;
 * - upload: lo stesso ZIP firmato, letto cartella per cartella: ogni file finisce nella pratica della
 *   cartella, con il tipo riconosciuto dal nome (mup, set informativo, privacy, antiriciclaggio, polizza).
 */

const UPLOAD_CONCURRENCY = 3;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

interface LotPracticeRow {
  id: string;
  practice_number: string;
  status: string;
  financial_status: string | null;
}

async function fetchLotPracticesWithStage(batchId: string): Promise<LotPracticeRow[]> {
  const rows = await fetchAllRows<LotPracticeRow>((from, to) =>
    supabase.from("practices").select("id, practice_number, status, financial_status").eq("vies_batch_id", batchId).order("id", { ascending: true }).range(from, to),
  );
  return [...rows].sort((a, b) => a.practice_number.localeCompare(b.practice_number));
}

async function fetchDrafts(practiceIds: string[]): Promise<Map<string, { file_name: string; file_path: string }>> {
  const drafts = new Map<string, { file_name: string; file_path: string }>();
  for (const ids of chunk(practiceIds, 100)) {
    const { data } = await supabase
      .from("practice_documents")
      .select("practice_id, file_name, file_path, created_at")
      .in("practice_id", ids)
      .eq("document_type", "bozza_deliberata")
      .order("created_at", { ascending: false });
    for (const row of data ?? []) {
      if (!drafts.has(row.practice_id)) drafts.set(row.practice_id, { file_name: row.file_name, file_path: row.file_path });
    }
  }
  return drafts;
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
  const practices = await fetchLotPracticesWithStage(options.batchId);
  const templates = await listSigningTemplates();
  const drafts = practices.length > 0 ? await fetchDrafts(practices.map((practice) => practice.id)) : new Map();

  const templateBlobs = new Map<string, Blob>();
  for (const [slot] of templates) templateBlobs.set(slot, await downloadSigningTemplate(slot));

  // Un file per ogni documento da firmare nella sezione attuale della pratica.
  const entries: Array<{ zipPath: string; blob?: Blob; storagePath?: string }> = [];
  for (const practice of practices) {
    const stage = stageOf(practice);
    const folder = safeName(practice.practice_number, "pratica");
    for (const slot of SIGNING_SLOTS) {
      if (!isSlotAvailable(slot, stage)) continue;
      if (slot.hasTemplate) {
        const blob = templateBlobs.get(slot.id);
        if (blob) entries.push({ zipPath: `${folder}/${slot.id}.pdf`, blob });
      } else {
        const draft = drafts.get(practice.id);
        if (draft) entries.push({ zipPath: `${folder}/${slot.id}_${safeName(draft.file_name, "bozza.pdf")}`, storagePath: draft.file_path });
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
  /** File non attribuiti: cartella senza numero pratica o tipo non riconosciuto. */
  skipped: string[];
}

/** Numero pratica di una voce dello ZIP: la prima cartella del percorso che corrisponde a una pratica del lotto. */
const practiceOfEntry = (path: string, byNumber: Map<string, LotPracticeRow>) => {
  const parts = path.split("/").filter(Boolean);
  for (const part of parts.slice(0, -1)) {
    const match = byNumber.get(part.trim().toLowerCase());
    if (match) return match;
  }
  return null;
};

export async function uploadSignedBundle(options: {
  batchId: string;
  file: File;
  onProgress?: (done: number, total: number) => void;
}): Promise<SignedUploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not authenticated");
  const practices = await fetchLotPractices(options.batchId);
  const byNumber = new Map(practices.map((practice) => [practice.practice_number.toLowerCase(), { ...practice, status: "", financial_status: null } as LotPracticeRow]));

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(options.file);
  const files = Object.values(zip.files).filter((entry) => !entry.dir && /\.pdf$/i.test(entry.name) && !/(^|\/)__MACOSX\//.test(entry.name) && !/(^|\/)\./.test(entry.name));

  const skipped: string[] = [];
  const jobs: Array<{ practiceId: string; slotId: (typeof SIGNING_SLOTS)[number]["id"]; signedType: string; name: string; entry: (typeof files)[number] }> = [];
  for (const entry of files) {
    const practice = practiceOfEntry(entry.name, byNumber);
    const slot = inferSigningSlotFromFileName(entry.name);
    if (!practice || !slot) {
      skipped.push(entry.name);
      continue;
    }
    jobs.push({ practiceId: practice.id, slotId: slot.id, signedType: slot.signedType, name: entry.name.split("/").pop() ?? entry.name, entry });
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
        const path = signedDocumentPath(job.practiceId, job.slotId, job.name);
        const { error: uploadError } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { error: insertError } = await supabase.from("practice_documents").insert({
          practice_id: job.practiceId,
          file_name: job.name,
          file_path: path,
          file_size: blob.size,
          mime_type: "application/pdf",
          uploaded_by: session.user.id,
          document_type: job.signedType,
        });
        if (insertError) {
          await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
          throw new Error(insertError.message);
        }
        uploaded += 1;
        touched.add(job.practiceId);
      } catch {
        skipped.push(job.entry.name);
      }
      done += 1;
      options.onProgress?.(done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, jobs.length) }, worker));
  return { uploaded, practices: touched.size, skipped };
}
