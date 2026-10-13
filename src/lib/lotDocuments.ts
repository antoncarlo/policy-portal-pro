import { supabase } from "@/integrations/supabase/client";
import { chunk, fetchAllRows } from "@/lib/fetchAllRows";
import { visibleToPartner } from "@/lib/signingDocuments";

/**
 * Everything of a VIES lot in one ZIP: the documents of every practice of the lot (a folder per practice)
 * and the files of the lot itself (the Excel, the ZIPs that were uploaded, the visura, whatever the
 * intermediary sent), as they are stored.
 *
 * The practices are read from the database by lot, not from the list on screen: a filter or a search
 * on the page never leaves a practice of the lot out of the file.
 */

const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";
const VIES_BATCH_FILES_BUCKET = "vies-batch-files";
const VIES_BATCH_FILES_PREFIX = `${VIES_BATCH_FILES_BUCKET}://`;

/** The file is built in the browser's memory: above this the lot is downloaded in parts, a practice at a time. */
export const MAX_LOT_ZIP_BYTES = 1024 * 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 4;
const ID_CHUNK = 100;
const LIST_PAGE = 1000;
const MAX_LIST_DEPTH = 6;
const MAX_LIST_FILES = 5000;

export class LotZipTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super("lot zip too large");
    this.name = "LotZipTooLargeError";
  }
}

interface LotPractice {
  id: string;
  practice_number: string;
}

interface LotDocument {
  id: string;
  practice_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  document_type: string | null;
}

/** One file to put in the ZIP. */
interface Entry {
  zipPath: string;
  bucket: string;
  path: string;
  size: number;
  /** Shown in the list of files that could not be read. */
  label: string;
}

export interface LotZipLabels {
  /** Folder with the documents of the practices. */
  practices: string;
  /** Folder with the files of the lot itself. */
  lotFiles: string;
  /** Subfolder of the lot files for what the intermediary sent. */
  received: string;
  /** Subfolder for the fiscal representative's visura. */
  visura: string;
  /** Name of the list of files that could not be read. */
  failedList: string;
}

export interface LotDocumentsResult {
  practices: number;
  /** Files found (documents of the practices and files of the lot). */
  files: number;
  /** Files of the lot itself among them. */
  lotFiles: number;
  downloaded: number;
  /** "VIES-2026-0001 / documento.pdf" for each file that could not be read. */
  failed: string[];
  fileName: string;
}

const storageReference = (filePath: string) =>
  filePath.startsWith(VIES_BATCH_FILES_PREFIX)
    ? { bucket: VIES_BATCH_FILES_BUCKET, path: filePath.slice(VIES_BATCH_FILES_PREFIX.length) }
    : { bucket: PRACTICE_DOCUMENTS_BUCKET, path: filePath };

/** A name that is safe inside a ZIP and on every file system. */
export const safeName = (value: string, fallback: string) => {
  const cleaned = Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || fallback;
};

/** "a.pdf", then "a (2).pdf", "a (3).pdf" for a name already taken in the folder. */
export const uniqueName = (name: string, taken: Set<string>) => {
  let candidate = name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${stem} (${n})${extension}`;
  taken.add(candidate.toLowerCase());
  return candidate;
};

export async function fetchLotPractices(batchId: string): Promise<LotPractice[]> {
  const rows = await fetchAllRows<LotPractice>((from, to) =>
    supabase.from("practices").select("id, practice_number").eq("vies_batch_id", batchId).order("id", { ascending: true }).range(from, to),
  );
  return [...rows].sort((a, b) => a.practice_number.localeCompare(b.practice_number));
}

export async function fetchLotDocuments(practiceIds: string[]): Promise<LotDocument[]> {
  const documents: LotDocument[] = [];
  for (const ids of chunk(practiceIds, ID_CHUNK)) {
    const rows = await fetchAllRows<LotDocument>((from, to) =>
      supabase.from("practice_documents").select("id, practice_id, file_name, file_path, file_size, document_type").in("practice_id", ids).order("id", { ascending: true }).range(from, to),
    );
    documents.push(...rows);
  }
  return documents;
}

/** Every file under a folder of the bucket, with the folders below it (storage lists one level at a time). */
async function listFiles(bucket: string, folder: string, depth = 0, found: Array<{ path: string; size: number }> = []): Promise<Array<{ path: string; size: number }>> {
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (found.length >= MAX_LIST_FILES) return found;
      const path = `${folder}/${item.name}`;
      // Folders come back without an id.
      if (item.id) found.push({ path, size: Number((item.metadata as { size?: number } | null)?.size ?? 0) });
      else if (depth < MAX_LIST_DEPTH) await listFiles(bucket, path, depth + 1, found);
    }
    if (!data || data.length < LIST_PAGE) return found;
  }
}

interface IntakeFile {
  file_name: string;
  storage_path: string;
  size?: number;
}

/** What belongs to the lot itself, apart from its practices. A lookup that fails only leaves its part out. */
async function collectLotFiles(batchId: string, labels: LotZipLabels): Promise<Entry[]> {
  const entries: Entry[] = [];
  const add = (relative: string, path: string, size: number) =>
    entries.push({ zipPath: relative, bucket: VIES_BATCH_FILES_BUCKET, path, size, label: relative });

  const { data: batch } = await supabase
    .from("vies_batches")
    .select("user_id, excel_storage_path, source_excel_file_name, fiscal_representative_id")
    .eq("id", batchId)
    .maybeSingle();

  if (batch?.user_id) {
    const prefix = `${batch.user_id}/${batchId}`;
    try {
      for (const file of await listFiles(VIES_BATCH_FILES_BUCKET, prefix)) {
        const relative = file.path.slice(prefix.length + 1).split("/").map((part) => safeName(part, "file")).join("/");
        add(`${labels.lotFiles}/${relative}`, file.path, file.size);
      }
    } catch {
      // The Excel is still added below from the lot record.
    }
  }
  if (batch?.excel_storage_path) {
    const excelPath = storageReference(batch.excel_storage_path).path;
    add(`${labels.lotFiles}/${safeName(batch.source_excel_file_name ?? excelPath.split("/").pop() ?? "excel", "excel")}`, excelPath, 0);
  }

  const { data: intakeLots } = await supabase.from("vies_intake_lots").select("id, files").eq("batch_id", batchId);
  for (const lot of intakeLots ?? []) {
    for (const file of (Array.isArray(lot.files) ? lot.files : []) as unknown as IntakeFile[]) {
      if (file?.storage_path) add(`${labels.lotFiles}/${labels.received}/${safeName(file.file_name ?? "", "file")}`, file.storage_path, Number(file.size ?? 0));
    }
  }

  if (batch?.fiscal_representative_id) {
    const { data: representative } = await supabase.from("vies_fiscal_representatives").select("visura_storage_path").eq("id", batch.fiscal_representative_id).maybeSingle();
    const visura = representative?.visura_storage_path;
    if (visura) {
      const reference = storageReference(visura);
      add(`${labels.lotFiles}/${labels.visura}/${safeName(reference.path.split("/").pop() ?? "visura", "visura")}`, reference.path, 0);
    }
  }
  return entries;
}

interface Options {
  batchId: string;
  /** Name of the ZIP without extension, e.g. "Lotto 2 - documenti". */
  fileLabel: string;
  labels: LotZipLabels;
  /** Also the internal files (the pre-filled policy module for the insurer): administrators only. */
  includeInternal?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Builds the ZIP and hands it to the browser as a download. Resolves with what was put in it; a file that cannot
 * be read is listed in `failed` (and in a text file inside the ZIP) instead of stopping the others.
 */
export async function downloadLotDocuments({ batchId, fileLabel, labels, includeInternal = false, onProgress }: Options): Promise<LotDocumentsResult> {
  const fileName = `${safeName(fileLabel, "lotto")}.zip`;
  const practices = await fetchLotPractices(batchId);
  const numberOf = new Map(practices.map((practice) => [practice.id, practice.practice_number]));
  const allDocuments = practices.length > 0 ? await fetchLotDocuments(practices.map((practice) => practice.id)) : [];
  const documents = includeInternal ? allDocuments : visibleToPartner(allDocuments);

  // A file is put in the ZIP once, whichever list it comes from.
  const seen = new Set<string>();
  const taken = new Map<string, Set<string>>();
  const entries: Entry[] = [];
  for (const doc of documents) {
    const reference = storageReference(doc.file_path);
    const key = `${reference.bucket}/${reference.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const practiceNumber = numberOf.get(doc.practice_id) ?? doc.practice_id;
    const folder = `${labels.practices}/${safeName(practiceNumber, "pratica")}`;
    const names = taken.get(folder) ?? new Set<string>();
    taken.set(folder, names);
    entries.push({
      zipPath: `${folder}/${uniqueName(safeName(doc.file_name, "documento"), names)}`,
      bucket: reference.bucket,
      path: reference.path,
      size: doc.file_size ?? 0,
      label: `${practiceNumber} / ${doc.file_name}`,
    });
  }
  const practiceFiles = entries.length;
  for (const entry of await collectLotFiles(batchId, labels)) {
    const key = `${entry.bucket}/${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const folder = entry.zipPath.includes("/") ? entry.zipPath.slice(0, entry.zipPath.lastIndexOf("/")) : "";
    const names = taken.get(folder) ?? new Set<string>();
    taken.set(folder, names);
    const base = entry.zipPath.slice(folder.length + (folder ? 1 : 0));
    entries.push({ ...entry, zipPath: `${folder}/${uniqueName(base, names)}` });
  }

  const empty = { practices: practices.length, files: entries.length, lotFiles: entries.length - practiceFiles, downloaded: 0, failed: [] as string[], fileName };
  if (entries.length === 0) return empty;

  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (totalBytes > MAX_LOT_ZIP_BYTES) throw new LotZipTooLargeError(totalBytes);

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const failed: string[] = [];
  let done = 0;
  onProgress?.(0, entries.length);

  const queue = [...entries];
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try {
        const { data, error } = await supabase.storage.from(entry.bucket).download(entry.path);
        if (error || !data) throw error ?? new Error("empty file");
        zip.file(entry.zipPath, data);
      } catch {
        failed.push(entry.label);
      }
      done += 1;
      onProgress?.(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, entries.length) }, worker));

  const downloaded = entries.length - failed.length;
  if (downloaded === 0) return { ...empty, failed };
  if (failed.length > 0) zip.file(labels.failedList, `${failed.join("\n")}\n`);

  // PDFs, images and ZIPs are already compressed: storing them is as small and much faster.
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return { ...empty, downloaded, failed };
}
