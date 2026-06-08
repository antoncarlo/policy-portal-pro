import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import * as tus from "tus-js-client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Workflow,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ExcelRecord = {
  rowNumber: number;
  progressivo: string;
  nomeZip: string;
  contraente: string;
  indirizzoRappresentanteFiscale: string;
  partitaIvaContraente: string;
  beneficiario: string;
  indirizzoBeneficiario: string;
  partitaIvaBeneficiario: string;
  pec: string;
  pagamento: string;
  documentiIndicati: string;
  raw: Record<string, string>;
};

type ZipDocument = {
  path: string;
  name: string;
  sourceZipKey: string;
  sourceZipName: string;
  extension: string;
  size: number;
  depth: number;
  isNestedZip: boolean;
};

type ViesBatchMonitor = {
  id: string;
  name: string;
  status: string;
  total_rows: number;
  ready_jobs: number;
  queued_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  blocked_jobs: number;
  cancelled_jobs: number;
  last_worker_run_at: string | null;
  last_worker_message: string | null;
  completed_at: string | null;
};

type ViesJobMonitor = {
  id: string;
  row_number: number;
  progressivo: string | null;
  contraente: string | null;
  external_reference: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  error_code: string | null;
};

type ViesReconciliationRow = {
  record: ExcelRecord;
  zipFile?: File;
  documents: ZipDocument[];
  errors: string[];
};

type WorkerSummary = {
  workerId: string;
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ jobId?: string; message: string }>;
};

type DocumentRequirement = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
};

const documentRequirements: DocumentRequirement[] = [
  {
    id: "documento_vies_principale",
    label: "Documento VIES principale",
    description: "Allegato principale della pratica VIES da caricare sul portale esterno.",
    keywords: ["vies", "pratica", "allegato", "保函"],
  },
  {
    id: "beneficiario_firmato",
    label: "Beneficiario firmato",
    description: "Documento del beneficiario o modulo firmato collegato alla garanzia.",
    keywords: ["beneficiario", "signed", "firmat"],
  },
  {
    id: "documento_identita",
    label: "Documento identità",
    description: "Documento identità di titolare effettivo o rappresentante legale.",
    keywords: ["identita", "identità", "documento", "titolare", "rappresentante legale"],
  },
  {
    id: "certificato_partita_iva",
    label: "Certificato partita IVA",
    description: "Certificato o attestazione della partita IVA del contraente.",
    keywords: ["partita iva", "piva", "iva"],
  },
  {
    id: "ubo_financials",
    label: "UBO e financials",
    description: "Modulo UBO, titolarità effettiva e informazioni finanziarie.",
    keywords: ["ubo", "financial", "financials"],
  },
  {
    id: "dichiarazione_sostitutiva",
    label: "Dichiarazione sostitutiva",
    description: "Dichiarazione sostitutiva o modulo equivalente richiesto per la pratica.",
    keywords: ["dichiarazione", "sostitutiva"],
  },
  {
    id: "licenza_commerciale",
    label: "Licenza commerciale",
    description: "Documento societario estero del cliente cinese venditore Amazon.",
    keywords: ["licenza", "commerciale", "business license"],
  },
  {
    id: "mandato_rappresentanza_fiscale",
    label: "Mandato rappresentanza fiscale",
    description: "Mandato del rappresentante fiscale collegato al contraente.",
    keywords: ["mandato", "rappresentanza fiscale", "rappresentante fiscale"],
  },
  {
    id: "cassetto_fiscale",
    label: "Cassetto fiscale",
    description: "Evidenza fiscale o dettaglio Agenzia delle Entrate quando richiesto.",
    keywords: ["cassetto", "agenzia", "entrate"],
  },
];

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const VIES_STORAGE_BUCKET = "vies-batch-files";
const VIES_PRACTICE_DOCUMENT_PATH_PREFIX = `${VIES_STORAGE_BUCKET}://`;
const VIES_RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;
const VIES_STORAGE_VERIFY_ATTEMPTS = 6;
const VIES_STORAGE_VERIFY_DELAY_MS = 750;
const VIES_ZIP_UPLOAD_CONCURRENCY = 2;
const VIES_DB_INSERT_CHUNK_SIZE = 250;
const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

type ViesUploadProgress = {
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
};

type ViesZipUploadPlan = {
  index: number;
  file: File;
  zipKey: string;
  storagePath: string;
};

type ViesZipUploadResult =
  | { ok: true; plan: ViesZipUploadPlan }
  | { ok: false; plan: ViesZipUploadPlan; message: string };

const getTusUploadErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Upload resumable non riuscito.";
};

const getSupabaseProjectId = () => {
  if (!SUPABASE_PROJECT_URL) throw new Error("URL Supabase non configurato.");

  try {
    const hostname = new URL(SUPABASE_PROJECT_URL).hostname;
    const projectId = hostname.split(".")[0];
    if (!projectId) throw new Error("Project ref assente.");
    return projectId;
  } catch {
    throw new Error("URL Supabase non valido per l'upload resumable VIES.");
  }
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const formatDurationSeconds = (startedAt: number) => ((performance.now() - startedAt) / 1000).toFixed(1) + "s";

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
};

const getStoragePathParts = (storagePath: string) => {
  const lastSlashIndex = storagePath.lastIndexOf("/");
  if (lastSlashIndex === -1) return { folderPath: "", objectName: storagePath };

  return {
    folderPath: storagePath.slice(0, lastSlashIndex),
    objectName: storagePath.slice(lastSlashIndex + 1),
  };
};

const getListedStorageObjectSize = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object") return null;
  const metadataRecord = metadata as Record<string, unknown>;
  const rawSize = metadataRecord.size ?? metadataRecord.contentLength ?? metadataRecord.content_length;
  const parsedSize = Number(rawSize);

  return Number.isFinite(parsedSize) ? parsedSize : null;
};

const verifyViesStorageObjectExists = async (storagePath: string, expectedSize?: number) => {
  const { folderPath, objectName } = getStoragePathParts(storagePath);
  let lastVerificationError = `oggetto ${objectName} non trovato nel bucket ${VIES_STORAGE_BUCKET}`;

  for (let attempt = 1; attempt <= VIES_STORAGE_VERIFY_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.storage
      .from(VIES_STORAGE_BUCKET)
      .list(folderPath, { limit: 100, search: objectName });

    if (error) {
      lastVerificationError = error.message;
    } else {
      const storageObject = data?.find((object) => object.name === objectName);
      if (storageObject) {
        const actualSize = getListedStorageObjectSize(storageObject.metadata);
        if (!expectedSize || actualSize === null || actualSize === expectedSize) return;

        lastVerificationError = `dimensione Storage ${formatBytes(actualSize)} diversa dal file locale ${formatBytes(expectedSize)}`;
      }
    }

    if (attempt < VIES_STORAGE_VERIFY_ATTEMPTS) {
      await wait(VIES_STORAGE_VERIFY_DELAY_MS * attempt);
    }
  }

  throw new Error(`Oggetto Storage non confermato per ${objectName}: ${lastVerificationError}.`);
};

const uploadViesFileResumable = async ({
  file,
  storagePath,
  onProgress,
}: {
  file: File;
  storagePath: string;
  onProgress?: (progress: ViesUploadProgress) => void;
}) => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Sessione non valida. Effettua nuovamente l'accesso e riprova.");
  }

  const projectId = getSupabaseProjectId();

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "true",
        ...(SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : {}),
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: VIES_STORAGE_BUCKET,
        objectName: storagePath,
        contentType: file.type || "application/zip",
        cacheControl: "3600",
      },
      fingerprint: async () =>
        `vies:${VIES_STORAGE_BUCKET}:${storagePath}:${file.name}:${file.size}:${file.lastModified}`,
      chunkSize: VIES_RESUMABLE_CHUNK_SIZE,
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.({
          fileName: file.name,
          bytesUploaded,
          bytesTotal,
          percentage: bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0,
        });
      },
      onError: (error) => reject(new Error(getTusUploadErrorMessage(error))),
      onSuccess: () => resolve(),
    });

    upload.start();
  });
};

const VIES_GUARANTEED_AMOUNT = 50000;
const VIES_GUARANTEE_OBJECT = "Garanzia richiesta per iscrizione/operatività VIES ai sensi dell’art. 35, comma 7-quater, DPR 633/1972.";
const VIES_DURATION_MONTHS = 36;

const calculateViesPolicyEndDate = (policyStartDate: Date) => {
  const policyEndDate = new Date(policyStartDate);
  policyEndDate.setFullYear(policyEndDate.getFullYear() + 3);
  return policyEndDate;
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const buildViesPracticeNotes = ({
  batchId,
  record,
  policyStartDate,
  policyEndDate,
  validationErrors,
}: {
  batchId: string;
  record: ExcelRecord;
  policyStartDate: string;
  policyEndDate: string;
  validationErrors: string[];
}) => [
  "Origine: import massivo VIES.",
  `Batch VIES: ${batchId}.`,
  `Riga Excel: ${record.rowNumber}${record.progressivo ? ` - Progressivo ${record.progressivo}` : ""}.`,
  `NOME ZIP: ${record.nomeZip || "da riconciliare"}.`,
  `Importo garantito fisso: € ${VIES_GUARANTEED_AMOUNT.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
  `Oggetto garanzia: ${VIES_GUARANTEE_OBJECT}`,
  `Durata: ${VIES_DURATION_MONTHS} mesi, decorrenza ${policyStartDate}, scadenza ${policyEndDate}.`,
  "Pratica prodotto VIES: compilare automaticamente i dati del contraente e del beneficiario; mantenere distinta da Fidejussioni.",
  `Contraente: ${record.contraente || "da completare"}.`,
  `Indirizzo contraente/rappresentante fiscale: ${record.indirizzoRappresentanteFiscale || "da completare"}.`,
  `Partita IVA contraente: ${record.partitaIvaContraente || "da completare"}.`,
  `Beneficiario: ${record.beneficiario || "da completare"}.`,
  `Indirizzo beneficiario: ${record.indirizzoBeneficiario || "da completare"}.`,
  `Partita IVA beneficiario: ${record.partitaIvaBeneficiario || "da completare"}.`,
  `PEC: ${record.pec || "da completare"}.`,
  validationErrors.length ? `Avvisi validazione: ${validationErrors.join("; ")}.` : "Validazione riga: dati minimi presenti.",
].join("\n");

const terminalJobStatuses = new Set(["completed", "failed", "blocked", "cancelled"]);

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const getZipReconciliationKey = (fileName: string) =>
  normalizeText(fileName)
    .replace(/\.zip$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getSafeFileNameParts = (fileName: string) => {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const baseName = fileName.replace(extension, "");
  const normalizedBaseName = normalizeText(baseName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return { normalizedBaseName, extension: extension.toLowerCase() };
};

const buildSafeStorageName = (fileName: string) => {
  const { normalizedBaseName, extension } = getSafeFileNameParts(fileName);
  return `${normalizedBaseName || "file"}-${Date.now()}${extension}`;
};

const buildStableZipStorageName = (fileName: string, occurrence = 1) => {
  const { normalizedBaseName, extension } = getSafeFileNameParts(fileName);
  const safeBaseName = normalizedBaseName || "zip";
  const duplicateSuffix = occurrence > 1 ? `-${occurrence}` : "";
  const safeExtension = extension || ".zip";

  return `${safeBaseName}${duplicateSuffix}${safeExtension}`;
};

const getCellByAliases = (row: Record<string, string>, aliases: string[]) => {
  const entries = Object.entries(row);
  const found = entries.find(([header]) => aliases.some((alias) => normalizeText(header).includes(alias)));
  return found?.[1] ?? "";
};

const parseExcelFile = async (file: File): Promise<ExcelRecord[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });

  const headerIndex = rows.findIndex((row) => {
    const normalizedRow = row.map(normalizeText).join(" ");
    return normalizedRow.includes("contraente") || normalizedRow.includes("beneficiario") || normalizedRow.includes("partita iva");
  });

  if (headerIndex === -1) {
    throw new Error("Non ho trovato una riga intestazione valida nell'Excel.");
  }

  const headers = rows[headerIndex].map((cell, index) => String(cell || `Colonna ${index + 1}`).trim());

  return rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const raw = headers.reduce<Record<string, string>>((acc, header, headerPosition) => {
        acc[header] = String(row[headerPosition] ?? "").trim();
        return acc;
      }, {});

      const record: ExcelRecord = {
        rowNumber: headerIndex + index + 2,
        progressivo: getCellByAliases(raw, ["numero progressivo", "progressivo", "numero"]),
        nomeZip: getCellByAliases(raw, ["nome zip", "nome archivio", "zip nominativo", "zip"]),
        contraente: getCellByAliases(raw, ["contraente", "nome ditta", "ditta"]),
        indirizzoRappresentanteFiscale: getCellByAliases(raw, ["indirizzo rappresentante fiscale", "rappresentante fiscale"]),
        partitaIvaContraente: getCellByAliases(raw, ["partita iva ditta", "p iva ditta", "p.iva ditta"]),
        beneficiario: getCellByAliases(raw, ["beneficiario"]),
        indirizzoBeneficiario: getCellByAliases(raw, ["indirizzo"]),
        partitaIvaBeneficiario: getCellByAliases(raw, ["partita iva"]),
        pec: getCellByAliases(raw, ["pec"]),
        pagamento: getCellByAliases(raw, ["pagamento"]),
        documentiIndicati: getCellByAliases(raw, ["simpli", "document", "file", "zip", "allegat"]),
        raw,
      };

      return record;
    })
    .filter((record) => Object.values(record.raw).some((value) => normalizeText(value).length > 0));
};

const readZipRecursive = async (file: File): Promise<ZipDocument[]> => {
  const rootZip = await JSZip.loadAsync(await file.arrayBuffer());
  const documents: ZipDocument[] = [];
  const sourceZipKey = getZipReconciliationKey(file.name);
  const sourceZipName = file.name;

  const walkZip = async (zip: JSZip, prefix = "", depth = 0) => {
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    for (const entry of entries) {
      const fullPath = `${prefix}${entry.name}`;
      const normalizedName = entry.name.split("/").pop() || entry.name;
      const extension = normalizedName.includes(".") ? normalizedName.split(".").pop()?.toLowerCase() || "" : "";
      const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      const isZip = extension === "zip";

      documents.push({
        path: fullPath,
        name: normalizedName,
        sourceZipKey,
        sourceZipName,
        extension,
        size,
        depth,
        isNestedZip: depth > 0,
      });

      if (isZip) {
        try {
          const nestedBuffer = await entry.async("arraybuffer");
          const nestedZip = await JSZip.loadAsync(nestedBuffer);
          await walkZip(nestedZip, `${fullPath}/`, depth + 1);
        } catch {
          documents.push({
            path: `${fullPath}/ERRORE_LETTURA_ZIP`,
            name: "ERRORE_LETTURA_ZIP",
            sourceZipKey,
            sourceZipName,
            extension: "errore",
            size: 0,
            depth: depth + 1,
            isNestedZip: true,
          });
        }
      }
    }
  };

  await walkZip(rootZip);
  return documents;
};

const Vies = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<File[]>([]);
  const [records, setRecords] = useState<ExcelRecord[]>([]);
  const [documents, setDocuments] = useState<ZipDocument[]>([]);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [zipProcessingStatus, setZipProcessingStatus] = useState<string | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchUploadStatus, setBatchUploadStatus] = useState<string | null>(null);
  const [batchUploadProgress, setBatchUploadProgress] = useState(0);
  const [persistedBatchId, setPersistedBatchId] = useState<string | null>(null);
  const [lastCreatedPracticeIds, setLastCreatedPracticeIds] = useState<string[]>([]);
  const [batchMonitor, setBatchMonitor] = useState<ViesBatchMonitor | null>(null);
  const [jobMonitor, setJobMonitor] = useState<ViesJobMonitor[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [lastWorkerSummary, setLastWorkerSummary] = useState<WorkerSummary | null>(null);

  const documentMatches = useMemo(() => {
    return documentRequirements.map((requirement) => {
      const matchedDocuments = documents.filter((document) => {
        const searchable = normalizeText(`${document.name} ${document.path}`);
        return requirement.keywords.some((keyword) => searchable.includes(normalizeText(keyword)));
      });

      return {
        ...requirement,
        matchedDocuments,
        completed: matchedDocuments.length > 0,
      };
    });
  }, [documents]);

  const completedRequirements = documentMatches.filter((requirement) => requirement.completed).length;
  const validationProgress = documentRequirements.length
    ? Math.round((completedRequirements / documentRequirements.length) * 100)
    : 0;

  const rowsWithCoreData = records.filter(
    (record) => record.contraente || record.partitaIvaContraente || record.beneficiario,
  ).length;
  const nestedZipCount = documents.filter((document) => document.extension === "zip").length;
  const pdfCount = documents.filter((document) => document.extension === "pdf").length;
  const selectedZipTotalSize = useMemo(() => zipFiles.reduce((total, file) => total + file.size, 0), [zipFiles]);

  const reconciliationRows = useMemo<ViesReconciliationRow[]>(() => {
    const zipFilesByKey = new Map<string, File[]>();
    for (const file of zipFiles) {
      const key = getZipReconciliationKey(file.name);
      if (!key) continue;
      zipFilesByKey.set(key, [...(zipFilesByKey.get(key) ?? []), file]);
    }

    return records.map((record) => {
      const normalizedNomeZip = getZipReconciliationKey(record.nomeZip);
      const matchedZipFiles = normalizedNomeZip ? zipFilesByKey.get(normalizedNomeZip) ?? [] : [];
      const errors: string[] = [];

      if (!record.nomeZip) errors.push("Nome ZIP mancante");
      if (record.nomeZip && matchedZipFiles.length === 0) errors.push("ZIP mancante");
      if (matchedZipFiles.length > 1) errors.push("ZIP duplicato");

      return {
        record,
        zipFile: matchedZipFiles[0],
        documents: normalizedNomeZip ? documents.filter((document) => document.sourceZipKey === normalizedNomeZip) : [],
        errors,
      };
    });
  }, [documents, records, zipFiles]);

  const reconciliationErrors = reconciliationRows.flatMap((row) => row.errors);
  const readyReconciliations = reconciliationRows.filter((row) => row.errors.length === 0);

  const handleExcelUpload = async (file: File | undefined) => {
    if (!file) return;
    setExcelFile(file);
    setLoadingExcel(true);

    try {
      const parsedRecords = await parseExcelFile(file);
      setRecords(parsedRecords);
      toast({
        title: "Excel letto correttamente",
        description: `Rilevate ${parsedRecords.length} righe utili nel tracciato VIES.`,
      });
    } catch (error) {
      setRecords([]);
      toast({
        variant: "destructive",
        title: "Errore lettura Excel",
        description: error instanceof Error ? error.message : "Il file non può essere letto.",
      });
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleZipUpload = async (files: FileList | File[] | null | undefined) => {
    const selectedFiles = Array.from(files ?? []).filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (!selectedFiles.length) return;

    setZipFiles(selectedFiles);
    setDocuments([]);
    setLoadingZip(true);
    setZipProcessingStatus(`0/${selectedFiles.length} ZIP indicizzati`);

    try {
      const parsedDocuments: ZipDocument[] = [];

      for (const [index, file] of selectedFiles.entries()) {
        setZipProcessingStatus(`Lettura ${index + 1}/${selectedFiles.length}: ${file.name} (${formatBytes(file.size)})`);

        try {
          const fileDocuments = await readZipRecursive(file);
          parsedDocuments.push(...fileDocuments);
          setDocuments([...parsedDocuments]);
        } catch (error) {
          const message = error instanceof Error ? error.message : "archivio non leggibile";
          throw new Error(`Errore lettura ZIP ${file.name}: ${message}`);
        }

        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      setDocuments(parsedDocuments);
      toast({
        title: "ZIP nominativi indicizzati correttamente",
        description: `Rilevati ${selectedFiles.length} ZIP (${formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))}) e ${parsedDocuments.length} elementi documentali riconciliabili per NOME ZIP.`,
      });
    } catch (error) {
      setDocuments([]);
      toast({
        variant: "destructive",
        title: "Errore lettura ZIP",
        description: error instanceof Error ? error.message : "Uno degli archivi non può essere letto.",
      });
    } finally {
      setLoadingZip(false);
      setZipProcessingStatus(null);
    }
  };

  const missingRequirements = documentMatches.filter((requirement) => !requirement.completed);

  const refreshBatchMonitor = useCallback(
    async (batchId = persistedBatchId) => {
      if (!batchId) return;

      setMonitorLoading(true);
      try {
        const { data: batch, error: batchError } = await supabase
          .from("vies_batches")
          .select(
            "id,name,status,total_rows,ready_jobs,queued_jobs,processing_jobs,completed_jobs,failed_jobs,blocked_jobs,cancelled_jobs,last_worker_run_at,last_worker_message,completed_at",
          )
          .eq("id", batchId)
          .maybeSingle();

        if (batchError) throw new Error(batchError.message);
        if (!batch) return;

        const { data: jobs, error: jobsError } = await supabase
          .from("vies_jobs")
          .select("id,row_number,progressivo,contraente,status,attempts,max_attempts,last_error,error_code")
          .eq("batch_id", batchId)
          .in("status", ["failed", "blocked", "processing", "queued"])
          .order("updated_at", { ascending: false })
          .limit(12);

        if (jobsError) throw new Error(jobsError.message);

        setBatchMonitor(batch as ViesBatchMonitor);
        setJobMonitor((jobs ?? []) as ViesJobMonitor[]);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Monitoraggio VIES non aggiornato",
          description: error instanceof Error ? error.message : "Non è stato possibile leggere lo stato del batch.",
        });
      } finally {
        setMonitorLoading(false);
      }
    },
    [persistedBatchId, toast],
  );

  const callViesControl = async (body: Record<string, unknown>) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error("Sessione non valida. Effettua nuovamente l'accesso e riprova.");
    }

    const response = await fetch("/api/vies-control", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || "Azione orchestratore non completata.");
    }

    return payload;
  };

  const handleBatchControl = async (action: "enqueue_batch" | "cancel_batch" | "run_worker_once") => {
    if (!persistedBatchId && action !== "run_worker_once") return;

    setControlLoading(action);
    try {
      const payload = await callViesControl({ action, batchId: persistedBatchId, limit: 5 });
      if (payload?.summary) setLastWorkerSummary(payload.summary as WorkerSummary);
      toast({
        title: "Azione VIES completata",
        description:
          action === "run_worker_once"
            ? "Eseguito un ciclo manuale del worker VIES."
            : action === "cancel_batch"
              ? "Batch annullato correttamente."
              : "Batch accodato per il worker VIES.",
      });
      await refreshBatchMonitor();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Azione VIES non riuscita",
        description: error instanceof Error ? error.message : "Errore durante il controllo orchestratore.",
      });
    } finally {
      setControlLoading(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setControlLoading(`retry-${jobId}`);
    try {
      await callViesControl({ action: "retry_job", jobId });
      toast({ title: "Job riaccodato", description: "Il job selezionato verrà ripreso dal prossimo ciclo worker." });
      await refreshBatchMonitor();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Retry non riuscito",
        description: error instanceof Error ? error.message : "Non è stato possibile riaccodare il job.",
      });
    } finally {
      setControlLoading(null);
    }
  };

  useEffect(() => {
    if (!persistedBatchId) return;

    refreshBatchMonitor(persistedBatchId);
    const interval = window.setInterval(() => refreshBatchMonitor(persistedBatchId), 15000);
    return () => window.clearInterval(interval);
  }, [persistedBatchId, refreshBatchMonitor]);

  const getRequirementMatches = (document: ZipDocument) => {
    const searchable = normalizeText(`${document.name} ${document.path}`);
    return documentRequirements
      .filter((requirement) => requirement.keywords.some((keyword) => searchable.includes(normalizeText(keyword))))
      .map((requirement) => requirement.id);
  };

  const getRecordValidationErrors = (record: ExcelRecord) => {
    const errors: string[] = [];

    if (!record.contraente) errors.push("Contraente mancante");
    if (!record.partitaIvaContraente) errors.push("Partita IVA contraente mancante");
    if (!record.beneficiario) errors.push("Beneficiario mancante");
    if (!record.pec) errors.push("PEC mancante");

    return errors;
  };

  const handlePrepareBatch = async () => {
    if (!excelFile || !zipFiles.length || !records.length || !documents.length) {
      toast({
        variant: "destructive",
        title: "Dati incompleti",
        description: "Carica Excel e tutti gli ZIP nominativi prima di preparare il batch per l'orchestratore.",
      });
      return;
    }

    setSavingBatch(true);
    let batchId: string | null = null;
    let batchPersisted = false;
    let batchFinalized = false;
    const createdPracticeIdsForRollback: string[] = [];

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Sessione non valida. Effettua nuovamente l'accesso e riprova.");
      }

      const userId = userData.user.id;
      batchId = crypto.randomUUID();
      const storageBasePath = `${userId}/${batchId}`;
      const excelStoragePath = `${storageBasePath}/${buildSafeStorageName(excelFile.name)}`;
      const zipStorageBasePath = `${storageBasePath}/zip-nominativi`;
      const zipStoragePathsByKey = new Map<string, string>();
      const zipStoragePathByFileName = new Map<string, string>();
      const zipStorageNameOccurrences = new Map<string, number>();
      const zipStorageFailures: string[] = [];

      const batchStartedAt = performance.now();
      setBatchUploadProgress(0);
      setBatchUploadStatus(`Upload Excel ${excelFile.name} (${formatBytes(excelFile.size)})`);
      await uploadViesFileResumable({
        file: excelFile,
        storagePath: excelStoragePath,
        onProgress: ({ percentage, bytesUploaded, bytesTotal }) => {
          setBatchUploadProgress(percentage);
          setBatchUploadStatus(
            `Upload Excel ${excelFile.name}: ${formatBytes(bytesUploaded)} / ${formatBytes(bytesTotal)} (${percentage}%)`,
          );
        },
      });
      setBatchUploadStatus(`Verifica archiviazione Excel ${excelFile.name}`);
      await verifyViesStorageObjectExists(excelStoragePath, excelFile.size);

      const zipUploadPlans: ViesZipUploadPlan[] = zipFiles.map((zip, index) => {
        const zipKey = getZipReconciliationKey(zip.name);
        const stableZipStorageName = buildStableZipStorageName(zip.name);
        const zipStorageNameOccurrence = (zipStorageNameOccurrences.get(stableZipStorageName) ?? 0) + 1;
        zipStorageNameOccurrences.set(stableZipStorageName, zipStorageNameOccurrence);
        const zipStorageName = buildStableZipStorageName(zip.name, zipStorageNameOccurrence);

        return {
          index,
          file: zip,
          zipKey,
          storagePath: `${zipStorageBasePath}/${zipStorageName}`,
        };
      });
      const zipProgressByPath = new Map<string, number>();
      const totalZipUploadBytes = zipFiles.reduce((total, zip) => total + zip.size, 0);
      let completedZipUploads = 0;

      setBatchUploadProgress(0);
      setBatchUploadStatus(
        `Upload ZIP parallelo controllato: 0/${zipUploadPlans.length} completati, massimo ${VIES_ZIP_UPLOAD_CONCURRENCY} alla volta`,
      );

      const zipUploadResults = await runWithConcurrency(
        zipUploadPlans,
        VIES_ZIP_UPLOAD_CONCURRENCY,
        async (plan): Promise<ViesZipUploadResult> => {
          const updateAggregateProgress = (bytesUploaded: number) => {
            zipProgressByPath.set(plan.storagePath, bytesUploaded);
            const uploadedBytes = Array.from(zipProgressByPath.values()).reduce((total, value) => total + value, 0);
            const percentage = totalZipUploadBytes ? Math.round((uploadedBytes / totalZipUploadBytes) * 100) : 0;
            setBatchUploadProgress(Math.min(100, percentage));
            setBatchUploadStatus(
              `Upload ZIP parallelo: ${completedZipUploads}/${zipUploadPlans.length} completati, ${formatBytes(uploadedBytes)} / ${formatBytes(totalZipUploadBytes)} (${Math.min(100, percentage)}%)`,
            );
          };

          try {
            updateAggregateProgress(zipProgressByPath.get(plan.storagePath) ?? 0);
            await uploadViesFileResumable({
              file: plan.file,
              storagePath: plan.storagePath,
              onProgress: ({ bytesUploaded }) => updateAggregateProgress(bytesUploaded),
            });
            setBatchUploadStatus(`Verifica archiviazione ZIP ${plan.index + 1}/${zipFiles.length}: ${plan.file.name}`);
            await verifyViesStorageObjectExists(plan.storagePath, plan.file.size);
            completedZipUploads += 1;
            updateAggregateProgress(plan.file.size);

            return { ok: true, plan };
          } catch (zipUploadError) {
            return {
              ok: false,
              plan,
              message: `${plan.file.name} (${formatBytes(plan.file.size)}): ${getTusUploadErrorMessage(zipUploadError)}`,
            };
          }
        },
      );

      for (const result of zipUploadResults) {
        if (!result.ok) {
          zipStorageFailures.push(result.message);
          continue;
        }

        zipStoragePathsByKey.set(result.plan.zipKey, result.plan.storagePath);
        zipStoragePathByFileName.set(result.plan.file.name, result.plan.storagePath);
      }

      if (zipStorageFailures.length) {
        throw new Error(
          `Upload ZIP incompleto: ${zipStorageFailures.join(" | ")}. Nessuna pratica VIES è stata creata; riprova dopo aver verificato connessione e dimensione dei file.`,
        );
      }

      const batchCreatedAt = new Date();
      const policyStartDate = formatIsoDate(batchCreatedAt);
      const policyEndDate = formatIsoDate(calculateViesPolicyEndDate(batchCreatedAt));
      const batchName = `VIES ${batchCreatedAt.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      const archivedZipCount = zipStoragePathByFileName.size;
      const reconciliationByRow = new Map(reconciliationRows.map((row) => [row.record.rowNumber, row]));
      const globalBatchValidationErrors = [
        ...missingRequirements.map((requirement) => `Requisito documentale mancante: ${requirement.label}`),
        ...reconciliationErrors,
      ];
      const jobPreparationRows = records.map((record) => {
        const validationErrors = getRecordValidationErrors(record);
        const reconciliation = reconciliationByRow.get(record.rowNumber);
        const reconciliationValidationErrors = reconciliation?.errors ?? [];
        const allValidationErrors = [
          ...validationErrors,
          ...reconciliationValidationErrors,
          ...globalBatchValidationErrors,
        ];

        return {
          record,
          reconciliation,
          validationErrors,
          reconciliationValidationErrors,
          allValidationErrors,
          isBlocked: allValidationErrors.length > 0,
        };
      });
      const validJobCount = jobPreparationRows.filter((job) => !job.isBlocked).length;
      const blockedJobCount = jobPreparationRows.length - validJobCount;
      const finalBatchStatus = validJobCount > 0 ? "queued" : "draft";
      const finalQueuedAt = validJobCount > 0 ? new Date().toISOString() : null;
      const baseBatchNotes = blockedJobCount
        ? validJobCount
          ? `Batch VIES creato con ${validJobCount} job in coda e ${blockedJobCount} righe bloccate da validare.`
          : "Batch creato in bozza: correggere i dati e i documenti bloccanti prima dell'orchestrazione."
        : "Batch VIES pronto per orchestratore e agent operativi.";
      const storageWarningNotes = zipStorageFailures.length
        ? ` Archiviazione ZIP originale non completata per ${zipStorageFailures.length} file: ${zipStorageFailures.join("; ")}. Il batch non potrà proseguire finché gli ZIP non saranno caricati correttamente.`
        : "";

      const { error: batchError } = await supabase.from("vies_batches").insert({
        id: batchId,
        user_id: userId,
        name: batchName,
        source_excel_file_name: excelFile.name,
        source_zip_file_name: `${zipFiles.length} ZIP nominativi (${archivedZipCount} archiviati)`,
        excel_storage_path: excelStoragePath,
        zip_storage_path: zipStorageBasePath,
        total_rows: records.length,
        total_documents: documents.length,
        ready_jobs: 0,
        queued_jobs: 0,
        blocked_jobs: 0,
        matched_requirements: completedRequirements,
        missing_requirements: [
          ...missingRequirements.map((requirement) => ({
            id: requirement.id,
            label: requirement.label,
          })),
          ...reconciliationRows
            .filter((row) => row.errors.length)
            .map((row) => ({
              id: `riga-${row.record.rowNumber}`,
              label: `${row.record.contraente || "Riga VIES"}: ${row.errors.join(", ")}`,
            })),
        ],
        status: "draft",
        queued_at: null,
        notes: "Batch VIES in preparazione: materializzazione pratiche, job e documenti in corso.",
      });
      if (batchError) throw new Error(`Creazione batch non riuscita: ${batchError.message}`);
      batchPersisted = true;

      const practiceNumbersByRow = new Map<number, string>();
      const practiceRows = records.map((record) => {
        const validationErrors = getRecordValidationErrors(record);
        const practiceNumber = `VIES-${batchCreatedAt.getFullYear()}-${String(record.rowNumber).padStart(4, "0")}-${batchId.slice(0, 8)}`;
        practiceNumbersByRow.set(record.rowNumber, practiceNumber);

        return {
          user_id: userId,
          practice_number: practiceNumber,
          practice_type: "vies" as const,
          status: "in_lavorazione" as const,
          client_name: record.contraente || `Riga VIES ${record.rowNumber}`,
          client_email: record.pec || `vies-riga-${record.rowNumber}@placeholder.local`,
          client_phone: "N/D",
          beneficiary: record.beneficiario || null,
          owner_tax_code: record.partitaIvaContraente || null,
          policy_number: record.progressivo ? `VIES-${record.progressivo}` : null,
          policy_start_date: policyStartDate,
          policy_end_date: policyEndDate,
          premium_gross: VIES_GUARANTEED_AMOUNT,
          premium_net: VIES_GUARANTEED_AMOUNT,
          premium_taxable: VIES_GUARANTEED_AMOUNT,
          premium_taxes: 0,
          notes: buildViesPracticeNotes({ batchId, record, policyStartDate, policyEndDate, validationErrors }),
        };
      });

      const createdPractices: Array<{ id: string; practice_number: string }> = [];
      for (let start = 0; start < practiceRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
        const chunk = practiceRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
        setBatchUploadStatus(
          `Creazione pratiche VIES ${Math.min(start + chunk.length, practiceRows.length)}/${practiceRows.length} (${formatDurationSeconds(batchStartedAt)})`,
        );
        const { data: createdPracticeChunk, error: practicesError } = await supabase
          .from("practices")
          .insert(chunk)
          .select("id, practice_number");
        if (practicesError) throw new Error(`Creazione pratiche VIES non riuscita: ${practicesError.message}`);
        createdPractices.push(...((createdPracticeChunk ?? []) as Array<{ id: string; practice_number: string }>));
      }

      const createdPracticeIdsByNumber = new Map((createdPractices ?? []).map((practice) => [practice.practice_number, practice.id]));
      const createdPracticesByIndex = new Map<number, string>();
      records.forEach((record) => {
        const practiceNumber = practiceNumbersByRow.get(record.rowNumber);
        const practiceId = practiceNumber ? createdPracticeIdsByNumber.get(practiceNumber) : undefined;
        if (practiceId) {
          createdPracticesByIndex.set(record.rowNumber, practiceId);
          createdPracticeIdsForRollback.push(practiceId);
        }
      });

      if (createdPracticesByIndex.size !== records.length) {
        throw new Error("Creazione pratiche VIES incompleta: non è stato possibile riconciliare tutte le pratiche create con le righe Excel.");
      }

      const practiceDocumentRows = [];
      for (const reconciliation of reconciliationRows) {
        const practiceId = createdPracticesByIndex.get(reconciliation.record.rowNumber);
        const zipFile = reconciliation.zipFile;
        if (!practiceId || !zipFile) continue;

        const zipKey = getZipReconciliationKey(zipFile.name);
        const stagedZipPath = zipStoragePathsByKey.get(zipKey);
        if (!stagedZipPath) {
          throw new Error(`ZIP pratica ${zipFile.name} non archiviato nel bucket VIES: impossibile collegarlo alla pratica.`);
        }

        practiceDocumentRows.push({
          practice_id: practiceId,
          file_name: zipFile.name,
          file_path: `${VIES_PRACTICE_DOCUMENT_PATH_PREFIX}${stagedZipPath}`,
          file_size: zipFile.size,
          mime_type: zipFile.type || "application/zip",
          uploaded_by: userId,
        });
      }

      if (practiceDocumentRows.length) {
        for (let start = 0; start < practiceDocumentRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
          const chunk = practiceDocumentRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
          setBatchUploadStatus(
            `Collegamento documenti pratica ${Math.min(start + chunk.length, practiceDocumentRows.length)}/${practiceDocumentRows.length} (${formatDurationSeconds(batchStartedAt)})`,
          );
          const { error: practiceDocumentsError } = await supabase.from("practice_documents").insert(chunk);
          if (practiceDocumentsError) throw new Error(`Collegamento documenti pratica non riuscito: ${practiceDocumentsError.message}`);
        }
      }

      const jobRows = jobPreparationRows.map(({ record, reconciliation, reconciliationValidationErrors, allValidationErrors, isBlocked }) => {
        return {
          batch_id: batchId,
          user_id: userId,
          row_number: record.rowNumber,
          progressivo: record.progressivo || null,
          nome_zip: record.nomeZip || null,
          zip_file_name: reconciliation?.zipFile?.name ?? null,
          contraente: record.contraente || null,
          indirizzo_rappresentante_fiscale: record.indirizzoRappresentanteFiscale || null,
          partita_iva_contraente: record.partitaIvaContraente || null,
          beneficiario: record.beneficiario || null,
          indirizzo_beneficiario: record.indirizzoBeneficiario || null,
          partita_iva_beneficiario: record.partitaIvaBeneficiario || null,
          pec: record.pec || null,
          pagamento: record.pagamento || null,
          documenti_indicati: record.documentiIndicati || null,
          raw_payload: record.raw,
          validation_errors: allValidationErrors,
          reconciliation_errors: reconciliationValidationErrors,
          external_reference: createdPracticesByIndex.get(record.rowNumber) ?? null,
          status: isBlocked ? "blocked" : "queued",
          last_error: isBlocked ? allValidationErrors.join("; ") : null,
          error_code: isBlocked ? "BLOCKED_VALIDATION" : null,
        };
      });

      for (let start = 0; start < jobRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
        const chunk = jobRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
        setBatchUploadStatus(
          `Creazione job VIES ${Math.min(start + chunk.length, jobRows.length)}/${jobRows.length} (${formatDurationSeconds(batchStartedAt)})`,
        );
        const { error: jobsError } = await supabase.from("vies_jobs").insert(chunk);
        if (jobsError) throw new Error(`Creazione job non riuscita: ${jobsError.message}`);
      }

      const documentRows = reconciliationRows.flatMap((reconciliation) => reconciliation.documents.map((document) => {
        const archivedZipPath = zipStoragePathsByKey.get(document.sourceZipKey);
        const zipFileName = reconciliation.zipFile?.name ?? document.sourceZipName;
        const zipDocumentBasePath = archivedZipPath ?? `zip-unarchived://${encodeURIComponent(zipFileName || document.sourceZipKey)}`;

        return {
          batch_id: batchId,
          user_id: userId,
          row_number: reconciliation.record.rowNumber,
          nome_zip: reconciliation.record.nomeZip || null,
          practice_id: createdPracticesByIndex.get(reconciliation.record.rowNumber) ?? null,
          zip_file_name: zipFileName,
          file_name: document.name,
          file_path: `${zipDocumentBasePath}#${document.path}`,
          file_extension: document.extension || null,
          file_size: document.size,
          depth: document.depth,
          is_nested_zip: document.isNestedZip,
          requirement_matches: getRequirementMatches(document),
          status: document.extension === "errore" ? "error" : "indexed",
        };
      }));

      for (let start = 0; start < documentRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
        const chunk = documentRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
        setBatchUploadStatus(
          `Indicizzazione documenti VIES ${Math.min(start + chunk.length, documentRows.length)}/${documentRows.length} (${formatDurationSeconds(batchStartedAt)})`,
        );
        const { error: documentsError } = await supabase.from("vies_batch_documents").insert(chunk);
        if (documentsError) throw new Error(`Indicizzazione documenti non riuscita: ${documentsError.message}`);
      }

      const { error: finalizeBatchError } = await supabase
        .from("vies_batches")
        .update({
          ready_jobs: validJobCount,
          queued_jobs: validJobCount,
          blocked_jobs: blockedJobCount,
          status: finalBatchStatus,
          queued_at: finalQueuedAt,
          notes: `${baseBatchNotes}${storageWarningNotes}`,
        })
        .eq("id", batchId);
      if (finalizeBatchError) throw new Error(`Finalizzazione batch non riuscita: ${finalizeBatchError.message}`);
      batchFinalized = true;

      setBatchUploadProgress(100);
      setBatchUploadStatus(`Upload completato. Batch VIES salvato e job creati in ${formatDurationSeconds(batchStartedAt)}.`);
      setPersistedBatchId(batchId);
      setLastCreatedPracticeIds(createdPractices?.map((practice) => practice.id) ?? []);
      await refreshBatchMonitor(batchId);
      toast({
        title: zipStorageFailures.length ? "Batch VIES creato con avviso" : "Batch VIES creato",
        description: `${records.length} job (${validJobCount} in coda, ${blockedJobCount} bloccati), ${createdPractices.length} pratiche VIES e ${documents.length} documenti indicizzati in ${formatDurationSeconds(batchStartedAt)}. Stato: ${finalBatchStatus === "queued" ? "in coda" : "bozza"}.${zipStorageFailures.length ? " Alcuni ZIP originali non sono stati archiviati: verifica il bucket VIES prima dell'orchestrazione." : ""}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Non è stato possibile salvare il batch.";
      if (!batchFinalized && createdPracticeIdsForRollback.length) {
        await supabase.from("practices").delete().in("id", createdPracticeIdsForRollback);
      }
      if (batchPersisted && batchId) {
        await supabase
          .from("vies_batches")
          .update({
            status: "failed",
            notes: `Creazione batch interrotta: ${message}`,
          })
          .eq("id", batchId);
      }

      toast({
        variant: "destructive",
        title: "Errore creazione batch VIES",
        description: message,
      });
    } finally {
      setSavingBatch(false);
      if (!batchFinalized) {
        setBatchUploadProgress(0);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">VIES</h1>
                <p className="text-muted-foreground mt-1">
                  Import massivo per clienti cinesi Amazon, documenti obbligatori e preparazione agent sul portale esterno.
                </p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-sm">
            Prima versione operativa
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Righe Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{records.length}</div>
              <p className="text-xs text-muted-foreground">{rowsWithCoreData} con dati principali</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documenti PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pdfCount}</div>
              <p className="text-xs text-muted-foreground">rilevati negli ZIP</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ZIP annidati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{nestedZipCount}</div>
              <p className="text-xs text-muted-foreground">letti ricorsivamente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Validazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{validationProgress}%</div>
              <Progress value={validationProgress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5" />
                Caricamento batch VIES
              </CardTitle>
              <CardDescription>
                Carica il tracciato Excel e il pacchetto ZIP dei documenti. Il sistema prepara la pre-validazione prima dell'invio agli agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-dashed p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    File Excel
                  </div>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => {
                      setPersistedBatchId(null);
                      handleExcelUpload(event.target.files?.[0]);
                    }}
                    disabled={loadingExcel || savingBatch}
                  />
                  <p className="text-sm text-muted-foreground">
                    {loadingExcel ? "Lettura in corso..." : excelFile?.name || "Nessun Excel selezionato"}
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-dashed p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <FileArchive className="h-5 w-5 text-primary" />
                    ZIP nominativi
                  </div>
                  <Input
                    type="file"
                    accept=".zip"
                    multiple
                    onChange={(event) => {
                      setPersistedBatchId(null);
                      handleZipUpload(Array.from(event.target.files ?? []));
                    }}
                    disabled={loadingZip || savingBatch}
                  />
                  <p className="text-sm text-muted-foreground">
                    {loadingZip
                      ? zipProcessingStatus ?? "Indicizzazione in corso..."
                      : zipFiles.length
                        ? `${zipFiles.length} ZIP selezionati (${formatBytes(selectedZipTotalSize)}): ${zipFiles.map((file) => file.name).join(", ")}`
                        : "Nessuno ZIP selezionato"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Stato batch</p>
                  <p className="mt-1 font-semibold">{persistedBatchId ? "Salvato" : "Pre-validazione"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Orchestratore</p>
                  <p className="mt-1 font-semibold">{persistedBatchId ? "Coda creata" : "Pronto"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Agent</p>
                  <p className="mt-1 font-semibold">{persistedBatchId ? "Job generati" : "In attesa coda"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Portale esterno</p>
                  <p className="mt-1 font-semibold">Da collegare</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  disabled={!records.length || !documents.length || loadingExcel || loadingZip || savingBatch}
                  className="w-full md:w-auto"
                  onClick={handlePrepareBatch}
                >
                  {loadingExcel || loadingZip || savingBatch ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  {savingBatch ? "Creazione batch in corso..." : "Prepara batch per orchestratore"}
                </Button>

                {(savingBatch || batchUploadStatus) && (
                  <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <div className="flex items-center justify-between gap-3">
                      <span>{batchUploadStatus ?? "Preparazione batch in corso..."}</span>
                      <span className="font-mono">{batchUploadProgress}%</span>
                    </div>
                    <Progress value={batchUploadProgress} />
                  </div>
                )}

                {persistedBatchId && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                    Batch salvato su Supabase con ID <span className="font-mono">{persistedBatchId}</span>. La coda è pronta per il worker/agent.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Flusso agent previsto
              </CardTitle>
              <CardDescription>
                La pagina è la cabina di regia. La fase successiva collegherà coda, log e compilazione del portale esterno.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Validazione Excel e documenti obbligatori",
                "Creazione batch e suddivisione in pratiche",
                "Assegnazione a un agent operativo a rotazione",
                "Compilazione portale esterno e upload allegati",
                "Esito, retry e report errori per riga",
              ].map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{step}</p>
                    <p className="text-sm text-muted-foreground">
                      {index === 2 ? "Gestione agent predisposta per lavoro in parallelo controllato." : "Controllo tracciato in cabina di regia VIES."}
                    </p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Bot className="h-5 w-5 text-primary" />
                  Nota operativa
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  L'agent di compilazione verrà collegato solo dopo aver definito accesso, credenziali, limiti e schermate del portale esterno.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {persistedBatchId && batchMonitor && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Monitor orchestratore VIES
                  </CardTitle>
                  <CardDescription>
                    Stato operativo del batch, coda job, retry e ultimo ciclo worker rilevato su Supabase.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refreshBatchMonitor()} disabled={monitorLoading}>
                  {monitorLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Aggiorna
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Pronti", batchMonitor.ready_jobs],
                  ["In coda", batchMonitor.queued_jobs],
                  ["In lavoro", batchMonitor.processing_jobs],
                  ["Completati", batchMonitor.completed_jobs],
                  ["Falliti", batchMonitor.failed_jobs],
                  ["Bloccati", batchMonitor.blocked_jobs],
                  ["Annullati", batchMonitor.cancelled_jobs],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">Stato batch: <span className="font-mono">{batchMonitor.status}</span></p>
                  <p className="text-sm text-muted-foreground">
                    {batchMonitor.last_worker_message || "Nessun messaggio worker registrato."}
                    {batchMonitor.last_worker_run_at ? ` Ultimo ciclo: ${new Date(batchMonitor.last_worker_run_at).toLocaleString("it-IT")}.` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleBatchControl("enqueue_batch")} disabled={!!controlLoading || batchMonitor.status === "cancelled"}>
                    {controlLoading === "enqueue_batch" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Accoda
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleBatchControl("run_worker_once")} disabled={!!controlLoading}>
                    {controlLoading === "run_worker_once" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Esegui ciclo
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleBatchControl("cancel_batch")} disabled={!!controlLoading || terminalJobStatuses.has(batchMonitor.status)}>
                    {controlLoading === "cancel_batch" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Annulla
                  </Button>
                </div>
              </div>

              {lastWorkerSummary && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                  Worker {lastWorkerSummary.workerId}: claim {lastWorkerSummary.claimed}, completati {lastWorkerSummary.completed}, falliti {lastWorkerSummary.failed}.
                </div>
              )}

              {jobMonitor.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Riga</TableHead>
                        <TableHead>Contraente</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Tentativi</TableHead>
                        <TableHead>Ultimo errore</TableHead>
                        <TableHead>Pratica</TableHead>
                        <TableHead>Azione</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobMonitor.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>{job.row_number}</TableCell>
                          <TableCell className="min-w-48 font-medium">{job.contraente || job.progressivo || "N/D"}</TableCell>
                          <TableCell><Badge variant={job.status === "failed" || job.status === "blocked" ? "destructive" : "secondary"}>{job.status}</Badge></TableCell>
                          <TableCell>{job.attempts}/{job.max_attempts}</TableCell>
                          <TableCell className="max-w-96 truncate text-muted-foreground">{job.last_error || job.error_code || "—"}</TableCell>
                          <TableCell>
                            {job.external_reference ? (
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/practices/${job.external_reference}`)}>
                                Apri pratica
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(job.status === "failed" || job.status === "blocked") && (
                              <Button size="sm" variant="outline" onClick={() => handleRetryJob(job.id)} disabled={!!controlLoading}>
                                {controlLoading === `retry-${job.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {lastCreatedPracticeIds.length > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-green-950">Pratiche VIES create: {lastCreatedPracticeIds.length}</p>
                <p className="text-sm text-green-900">Sono disponibili nella sezione Pratiche con tipo VIES separato da Fidejussioni per il controllo massivo.</p>
              </div>
              <Button variant="secondary" onClick={() => navigate("/practices?type=vies")}>
                Vai alle pratiche VIES
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Documenti obbligatori VIES</CardTitle>
              <CardDescription>
                Controllo iniziale basato sul pacchetto reale fornito come esempio. I nomi file vengono normalizzati anche se contengono caratteri cinesi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documentMatches.map((requirement) => (
                <div key={requirement.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {requirement.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <p className="font-medium">{requirement.label}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{requirement.description}</p>
                    {requirement.matchedDocuments.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Trovato: {requirement.matchedDocuments.map((document) => document.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge variant={requirement.completed ? "secondary" : "destructive"}>
                    {requirement.completed ? "OK" : "Manca"}
                  </Badge>
                </div>
              ))}

              {missingRequirements.length > 0 && documents.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    Mancano {missingRequirements.length} tipologie documento. Potrebbero essere assenti oppure nominate in modo non riconoscibile.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anteprima righe Excel</CardTitle>
              <CardDescription>
                Prime righe utili che formeranno la coda di pratiche VIES da lavorare.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Carica un Excel per visualizzare l'anteprima delle pratiche.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Riga</TableHead>
                        <TableHead>Contraente</TableHead>
                        <TableHead>P. IVA contraente</TableHead>
                        <TableHead>Beneficiario</TableHead>
                        <TableHead>PEC</TableHead>
                        <TableHead>NOME ZIP</TableHead>
                        <TableHead>Documenti indicati</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.slice(0, 8).map((record) => (
                        <TableRow key={`${record.rowNumber}-${record.contraente}-${record.beneficiario}`}>
                          <TableCell>{record.rowNumber}</TableCell>
                          <TableCell className="min-w-48 font-medium">{record.contraente || "Da completare"}</TableCell>
                          <TableCell>{record.partitaIvaContraente || "Da completare"}</TableCell>
                          <TableCell>{record.beneficiario || "Da completare"}</TableCell>
                          <TableCell>{record.pec || "Da completare"}</TableCell>
                          <TableCell>{record.nomeZip || "Da completare"}</TableCell>
                          <TableCell className="max-w-64 truncate">{record.documentiIndicati || "Non indicati"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {records.length > 8 && (
                    <p className="mt-3 text-sm text-muted-foreground">Mostrate 8 righe su {records.length}. La tabella completa sarà gestita nel batch persistente.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Controllore riconciliazione ZIP</CardTitle>
            <CardDescription>
              Ogni riga Excel viene abbinata allo ZIP nominativo indicato dal campo NOME ZIP. Gli errori bloccano il batch finché non sono risolti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Carica l'Excel per vedere il controllo di riconciliazione.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Riga</TableHead>
                      <TableHead>Contraente</TableHead>
                      <TableHead>NOME ZIP</TableHead>
                      <TableHead>ZIP collegato</TableHead>
                      <TableHead>Documenti</TableHead>
                      <TableHead>Errori</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationRows.slice(0, 20).map((reconciliation) => (
                      <TableRow key={`reconciliation-${reconciliation.record.rowNumber}`}>
                        <TableCell>{reconciliation.record.rowNumber}</TableCell>
                        <TableCell className="min-w-48 font-medium">{reconciliation.record.contraente || "Da completare"}</TableCell>
                        <TableCell>{reconciliation.record.nomeZip || "—"}</TableCell>
                        <TableCell>{reconciliation.zipFile?.name || "Non collegato"}</TableCell>
                        <TableCell>{reconciliation.documents.length}</TableCell>
                        <TableCell>
                          {reconciliation.errors.length ? (
                            <Badge variant="destructive">{reconciliation.errors.join(", ")}</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reconciliationRows.length > 20 && (
                  <p className="mt-3 text-sm text-muted-foreground">Mostrate 20 riconciliazioni su {reconciliationRows.length}.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documenti rilevati negli ZIP</CardTitle>
            <CardDescription>
              Elenco dei file indicizzati, inclusi quelli contenuti dentro ZIP secondari.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Carica gli ZIP nominativi per visualizzare la mappa documentale.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome file</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Livello</TableHead>
                      <TableHead>Dimensione</TableHead>
                      <TableHead>Percorso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.slice(0, 20).map((document) => (
                      <TableRow key={document.path}>
                        <TableCell className="min-w-72 font-medium">{document.name}</TableCell>
                        <TableCell>{document.extension || "file"}</TableCell>
                        <TableCell>{document.depth === 0 ? "ZIP nominativo" : `ZIP annidato ${document.depth}`}</TableCell>
                        <TableCell>{formatBytes(document.size)}</TableCell>
                        <TableCell className="max-w-96 truncate text-muted-foreground">{document.path}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {documents.length > 20 && (
                  <p className="mt-3 text-sm text-muted-foreground">Mostrati 20 documenti su {documents.length}.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Vies;
