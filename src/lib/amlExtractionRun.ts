import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  AML_DOCUMENT_TYPES,
  MEDIA_TYPE_BY_EXTENSION,
  amlFromAgent,
  pickAmlDocuments,
  splitIndexedPath,
  type AgentAmlResult,
  type IndexedZipDocument,
} from "@/lib/amlExtraction";
import type { AmlData } from "@/lib/signingPrefill";

const VIES_BUCKET = "vies-batch-files";

export interface StoredAml {
  aml: AmlData;
  files: string[];
  issues: string[];
  skipped: string[];
  extractedAt: string;
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
};

/** Bytes di un documento dello ZIP caricato, anche dentro ZIP annidati ("a.zip/b.pdf"). */
async function readZipEntry(zipBytes: ArrayBuffer, path: string): Promise<Uint8Array | null> {
  const { default: JSZip } = await import("jszip");
  const segments = path.split(/(?<=\.zip)\//i);
  let zip = await JSZip.loadAsync(zipBytes);
  for (const [index, segment] of segments.entries()) {
    const entry = zip.file(segment);
    if (!entry) return null;
    if (index === segments.length - 1) return entry.async("uint8array");
    zip = await JSZip.loadAsync(await entry.async("arraybuffer"));
  }
  return null;
}

/** I dati antiriciclaggio gia' letti per piu' pratiche. */
export async function loadAmlData(practiceIds: string[]): Promise<Map<string, StoredAml>> {
  const found = new Map<string, StoredAml>();
  for (let start = 0; start < practiceIds.length; start += 100) {
    const { data } = await supabase.from("practice_aml_data").select("practice_id, data, sources, extracted_at").in("practice_id", practiceIds.slice(start, start + 100));
    for (const row of data ?? []) {
      const sources = (row.sources ?? {}) as { files?: string[]; issues?: string[]; skipped?: string[] };
      found.set(row.practice_id, {
        aml: (row.data ?? {}) as AmlData,
        files: sources.files ?? [],
        issues: sources.issues ?? [],
        skipped: sources.skipped ?? [],
        extractedAt: row.extracted_at,
      });
    }
  }
  return found;
}

async function agentError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return new Error(String(body.error));
    } catch {
      // risposta non leggibile: vale il messaggio generico
    }
  }
  return error instanceof Error ? error : new Error("agent");
}

/**
 * Legge i documenti della pratica nello ZIP del lotto (licenza, documento del legale rappresentante, UBO),
 * li fa leggere all'agent e salva il risultato. Una pratica senza questi documenti nell'indice dà un errore chiaro.
 */
export async function readAmlDocuments(practiceId: string, userId: string): Promise<StoredAml> {
  const { data: rows, error } = await supabase
    .from("vies_batch_documents")
    .select("file_name, file_path, file_extension, file_size, requirement_matches")
    .eq("practice_id", practiceId)
    .overlaps("requirement_matches", [...AML_DOCUMENT_TYPES]);
  if (error) throw new Error(error.message);
  const { picked, skipped } = pickAmlDocuments((rows ?? []) as IndexedZipDocument[]);
  if (picked.length === 0) throw new Error(skipped.join("; ") || "no documents");

  const zips = new Map<string, ArrayBuffer>();
  const documents: Array<{ file_name: string; media_type: string; data: string }> = [];
  for (const document of picked) {
    const { zipPath, inner } = splitIndexedPath(document.file_path);
    if (!zipPath || !inner) {
      skipped.push(`${document.file_name}: ZIP non archiviato`);
      continue;
    }
    if (!zips.has(zipPath)) {
      const { data, error: downloadError } = await supabase.storage.from(VIES_BUCKET).download(zipPath);
      if (downloadError || !data) {
        skipped.push(`${document.file_name}: ZIP non scaricabile`);
        continue;
      }
      zips.set(zipPath, await data.arrayBuffer());
    }
    const bytes = await readZipEntry(zips.get(zipPath)!, inner);
    const extension = (document.file_extension || document.file_name.split(".").pop() || "").toLowerCase();
    if (!bytes) {
      skipped.push(`${document.file_name}: non trovato nello ZIP`);
      continue;
    }
    documents.push({ file_name: document.file_name, media_type: MEDIA_TYPE_BY_EXTENSION[extension], data: toBase64(bytes) });
  }
  if (documents.length === 0) throw new Error(skipped.join("; ") || "no documents");

  const { data, error: invokeError } = await supabase.functions.invoke("vies-aml-agent", { body: { documents } });
  if (invokeError) throw await agentError(invokeError);
  const { aml, issues } = amlFromAgent((data as { result: AgentAmlResult }).result);

  const files = documents.map((document) => document.file_name);
  const extractedAt = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("practice_aml_data")
    .upsert({ practice_id: practiceId, data: aml as never, sources: { files, issues, skipped } as never, extracted_at: extractedAt, extracted_by: userId });
  if (saveError) throw new Error(saveError.message);
  return { aml, files, issues, skipped, extractedAt };
}
