import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import * as tus from "tus-js-client";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, useLocale, useMessages } from "@/i18n";
import { viesMessages } from "@/i18n/messages/vies";
import { getDocumentTypeLabel, translateViesText, viesText } from "@/i18n/viesText";
import { composeNotes } from "@/lib/practiceSummary";
import {
  VIES_POLICY_MIME_TYPE,
  buildViesPolicyFileName,
  generateViesPolicyPdf,
  missingViesPolicyData,
  viesPolicyInputFromPractice,
  viesPolicyPdfToBytes,
} from "@/lib/viesPolicyPdf";
import { extractPdfText } from "@/lib/pdfText";
import type { ControllerReport } from "@/lib/viesController";
import {
  VIES_ALLOW_DUPLICATE_PRACTICES,
  VIES_DURATION_MONTHS,
  VIES_GUARANTEED_AMOUNT,
  VIES_MAX_PRACTICES_PER_SHEET,
  VIES_PREMIUM_GROSS,
  VIES_PREMIUM_TAXABLE,
  VIES_PREMIUM_TAXES,
} from "@/lib/viesTerms";
import {
  isValidChineseId,
  isValidItalianTaxCode,
  isValidItalianVat,
  isValidUscc,
  normalizeItalianVat,
  normalizeUscc,
  parseVisura,
  pickLegalRepresentative,
  scanPdf,
  type VisuraData,
} from "@/lib/viesDocumentScan";
import { VIES_DOCUMENT_TYPES, classifyDocumentText, type ViesDocumentType } from "@/lib/viesDocumentTypes";
import {
  agentMediaType,
  callViesDocumentAgent,
  probeViesDocumentAgent,
  verifiedAgentIdentifiers,
  type AgentCallOutcome,
} from "@/lib/viesDocumentAgent";

type ExcelRecord = {
  rowNumber: number;
  progressivo: string;
  nomeZip: string;
  contraente: string;
  denominazioneCn: string;
  /** Unified Social Credit Code (codice di credito sociale) of the Chinese company. */
  uscc: string;
  legaleRappresentante: string;
  documentoLegaleRappresentante: string;
  dataNascitaLegaleRappresentante: string;
  indirizzoContraente: string;
  rappresentanteFiscale: string;
  codiceFiscaleRappresentante: string;
  amministratoreRappresentante: string;
  codiceFiscaleAmministratore: string;
  indirizzoRappresentanteFiscale: string;
  partitaIvaContraente: string;
  beneficiario: string;
  indirizzoBeneficiario: string;
  partitaIvaBeneficiario: string;
  /** Optional PEC of the beneficiary office. */
  pecBeneficiario: string;
  // Effective PEC of the practice: the contraente's own, else the fiscal representative's.
  pec: string;
  pecRappresentante: string;
  pecFromRepresentative: boolean;
  email: string;
  telefono: string;
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
  vatNumbers: string[];
  usccs: string[];
  chineseIds: string[];
  hasText: boolean;
  /** Recognised from the content; null = not recognised (e.g. a scan for the agent). */
  documentType: string | null;
  /** Other document types bundled in the same file, read by the agent. */
  extraDocumentTypes: string[];
  /** How the type was recognised: from the text, or by the document agent. */
  recognisedBy: "testo" | "agent" | null;
  /** "pending" while the scan is being read by the agent. */
  agentStatus: "ok" | "error" | "unavailable" | "pending" | null;
  agentIssues: string[];
  /** Identity document expiry read by the agent (DD/MM/YYYY). */
  agentExpiryDate: string;
};

type AgentCandidate = {
  key: string;
  name: string;
  mediaType: string;
  bytes: Uint8Array;
};

const documentKey = (document: Pick<ZipDocument, "sourceZipKey" | "path">) => `${document.sourceZipKey}::${document.path}`;

const parseItalianDate = (value: string) => {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim());
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
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

type ExistingViesPractice = {
  id: string;
  practice_number: string;
  created_at: string;
  uscc: string | null;
  vat: string | null;
};

type ViesReconciliationRow = {
  record: ExcelRecord;
  zipFile?: File;
  documents: ZipDocument[];
  missingRequirements: DocumentRequirement[];
  linkedByVat: boolean;
  vatCheck: "verified" | "unverifiable" | "mismatch" | "not_applicable";
  zipVatNumbers: string[];
  /** Document types each document of the ZIP counts for (documentKey → types). */
  acceptedTypes: Map<string, string[]>;
  errors: string[];
};

type WorkerSummary = {
  workerId: string;
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ jobId?: string; message: string }>;
  notice?: string;
};

type ViesPortalOption = { id: string; name: string };

type ViesAccessStatus = "checking" | "allowed" | "denied";

type DocumentRequirement = ViesDocumentType;

// Required documents, recognised from their content (see viesDocumentTypes).
const documentRequirements: DocumentRequirement[] = VIES_DOCUMENT_TYPES;

const documentMatchesRequirement = (document: ZipDocument, requirement: DocumentRequirement) =>
  document.documentType === requirement.id || document.extraDocumentTypes.includes(requirement.id);

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
  return viesText().errors.resumableFailed;
};

const getSupabaseProjectId = () => {
  if (!SUPABASE_PROJECT_URL) throw new Error(viesText().errors.supabaseUrlMissing);

  try {
    const hostname = new URL(SUPABASE_PROJECT_URL).hostname;
    const projectId = hostname.split(".")[0];
    if (!projectId) throw new Error("Project ref assente.");
    return projectId;
  } catch {
    throw new Error(viesText().errors.supabaseUrlInvalid);
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
  let lastVerificationError = viesText().errors.storageObjectMissing(objectName, VIES_STORAGE_BUCKET);

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

        lastVerificationError = viesText().errors.storageSizeMismatch(formatBytes(actualSize), formatBytes(expectedSize));
      }
    }

    if (attempt < VIES_STORAGE_VERIFY_ATTEMPTS) {
      await wait(VIES_STORAGE_VERIFY_DELAY_MS * attempt);
    }
  }

  throw new Error(viesText().errors.storageNotConfirmed(objectName, lastVerificationError));
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
    throw new Error(viesText().errors.invalidSession);
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

const VIES_DEFAULT_BENEFICIARY = "Agenzia delle Entrate";
const VIES_POLICY_DOCUMENTS_BUCKET = "practice-documents";

// Beneficiary office and fiscal representative are fixed for one Excel sheet:
// entered once, applied to every row unless the row has its own Excel column.
type ViesSheetData = {
  beneficiario: string;
  indirizzoBeneficiario: string;
  codiceFiscaleBeneficiario: string;
  pecBeneficiario: string;
  rappresentanteFiscale: string;
  codiceFiscaleRappresentante: string;
  amministratoreRappresentante: string;
  codiceFiscaleAmministratore: string;
  indirizzoRappresentanteFiscale: string;
  pecRappresentante: string;
};

const initialSheetData: ViesSheetData = {
  beneficiario: VIES_DEFAULT_BENEFICIARY,
  indirizzoBeneficiario: "",
  codiceFiscaleBeneficiario: "",
  pecBeneficiario: "",
  rappresentanteFiscale: "",
  codiceFiscaleRappresentante: "",
  amministratoreRappresentante: "",
  codiceFiscaleAmministratore: "",
  indirizzoRappresentanteFiscale: "",
  pecRappresentante: "",
};

const normalizeTaxCode = (value: string) => value.replace(/\s+/g, "").toUpperCase();

const applySheetData = (record: ExcelRecord, sheet: ViesSheetData): ExcelRecord => ({
  ...record,
  beneficiario: record.beneficiario || sheet.beneficiario.trim(),
  indirizzoBeneficiario: record.indirizzoBeneficiario || sheet.indirizzoBeneficiario.trim(),
  partitaIvaBeneficiario: normalizeTaxCode(record.partitaIvaBeneficiario || sheet.codiceFiscaleBeneficiario),
  pecBeneficiario: record.pecBeneficiario || sheet.pecBeneficiario.trim(),
  rappresentanteFiscale: record.rappresentanteFiscale || sheet.rappresentanteFiscale.trim(),
  codiceFiscaleRappresentante: normalizeTaxCode(record.codiceFiscaleRappresentante || sheet.codiceFiscaleRappresentante),
  amministratoreRappresentante: record.amministratoreRappresentante || sheet.amministratoreRappresentante.trim(),
  codiceFiscaleAmministratore: normalizeTaxCode(record.codiceFiscaleAmministratore || sheet.codiceFiscaleAmministratore),
  indirizzoRappresentanteFiscale: record.indirizzoRappresentanteFiscale || sheet.indirizzoRappresentanteFiscale.trim(),
  ...resolvePec(record, record.pecRappresentante || sheet.pecRappresentante.trim()),
});

const resolvePec = (record: ExcelRecord, pecRappresentante: string) => ({
  pecRappresentante,
  pec: record.pec || pecRappresentante,
  pecFromRepresentative: !record.pec && Boolean(pecRappresentante),
});

const isPlausibleEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const VIES_GUARANTEE_OBJECT = "POLIZZA FIDEIUSSORIA AI SENSI DELL’ART. 35, COMMA 7-QUATER, DEL DPR 633/1972.";

const calculateViesPolicyEndDate = (policyStartDate: Date) => {
  const policyEndDate = new Date(policyStartDate);
  policyEndDate.setMonth(policyEndDate.getMonth() + VIES_DURATION_MONTHS);
  return policyEndDate;
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

// The request data lives in the practice's specific fields, shown in the
// Riepilogo Pratica; the notes stay free for the operator.
const describeVisura = (visura: VisuraData | null) =>
  visura?.documento || visura?.dataEstrazione
    ? `Visura${visura.documento ? ` n. ${visura.documento}` : ""}${visura.dataEstrazione ? ` estratta il ${visura.dataEstrazione}` : ""}`
    : null;

const buildViesSpecificFields = ({
  batchId,
  record,
  reconciliation,
  validationErrors,
  visura,
}: {
  batchId: string;
  record: ExcelRecord;
  reconciliation?: ViesReconciliationRow;
  validationErrors: string[];
  visura: VisuraData | null;
}) => ({
  vies_sede_contraente: record.indirizzoContraente || null,
  vies_denominazione_cn: record.denominazioneCn || null,
  vies_uscc: record.uscc || null,
  vies_partita_iva: record.partitaIvaContraente || null,
  vies_legale_rappresentante: record.legaleRappresentante || null,
  vies_documento_legale_rappresentante: record.documentoLegaleRappresentante || null,
  vies_data_nascita_legale_rappresentante: record.dataNascitaLegaleRappresentante || null,
  vies_email: record.email || null,
  vies_pec_fonte: record.pec ? (record.pecFromRepresentative ? "del rappresentante fiscale" : "del contraente") : null,
  vies_rappresentante_fiscale: record.rappresentanteFiscale || null,
  vies_codice_fiscale_rappresentante: record.codiceFiscaleRappresentante || null,
  vies_amministratore_rappresentante: record.amministratoreRappresentante || null,
  vies_codice_fiscale_amministratore: record.codiceFiscaleAmministratore || null,
  vies_visura_rappresentante: describeVisura(visura),
  vies_domicilio_fiscale: record.indirizzoRappresentanteFiscale || null,
  vies_pec_rappresentante: record.pecRappresentante || null,
  vies_indirizzo_beneficiario: record.indirizzoBeneficiario || null,
  vies_pec_beneficiario: record.pecBeneficiario || null,
  vies_codice_fiscale_beneficiario: record.partitaIvaBeneficiario || null,
  vies_importo_garantito: VIES_GUARANTEED_AMOUNT,
  vies_oggetto_garanzia: VIES_GUARANTEE_OBJECT,
  vies_durata_mesi: VIES_DURATION_MONTHS,
  vies_sezione_garante: "Da lasciare in bianco",
  vies_zip_file:
    reconciliation?.zipFile && reconciliation.vatCheck !== "mismatch" ? reconciliation.zipFile.name : null,
  vies_documenti_zip: reconciliation?.zipFile ? String(reconciliation.documents.length) : null,
  vies_verifica_piva: reconciliation?.vatCheck ?? "not_applicable",
  vies_piva_trovate: reconciliation?.zipVatNumbers ?? [],
  vies_documenti_mancanti: reconciliation?.missingRequirements.map((requirement) => requirement.label) ?? [],
  vies_avvisi: validationErrors.filter((error) => !error.startsWith("Requisito documentale mancante")),
  vies_note_documenti: (reconciliation?.documents ?? [])
    .filter((document) => document.agentIssues.length)
    .map((document) => `${document.name}: ${document.agentIssues.join("; ")}`),
  vies_riga_excel: `Riga ${record.rowNumber}${record.nomeZip ? `, ZIP ${record.nomeZip}` : ""}`,
  vies_batch_id: batchId,
  vies_dati_excel: record.raw,
});

const terminalJobStatuses = new Set(["completed", "failed", "blocked", "cancelled"]);

// Server actions of the VIES flow (api/vies-control): portals, final check, sending.
// A refused send still returns the final-check report, so the page can show why.
const callViesControl = async (body: Record<string, unknown>) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error(viesText().errors.invalidSession);
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
  if (!response.ok || (payload?.ok === false && !payload?.report)) {
    throw new Error(payload?.error ? translateViesText(payload.error) : viesText().errors.controlFailed);
  }

  return payload;
};


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

// Column header as the parser compares it: "P.IVA *" or "ZIP (1-20):" read as "p.iva" and "zip".
const normalizeHeader = (value: unknown) =>
  normalizeText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// The template's headers carry the column name in Italian, English and Chinese, one
// per line ("Ragione Sociale\nCompany name\n公司名称"): every line names the column.
const headerNames = (value: unknown) => {
  const names = String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeHeader)
    .filter(Boolean);
  return names.length ? names : [normalizeHeader(value)];
};

const isKnownHeader = (value: unknown) => headerNames(value).some((name) => KNOWN_COLUMN_HEADERS.has(name));

// An exact header match wins over a partial one, so "cod" or "indirizzo" never
// resolve to a longer header such as "codice fiscale cn" by accident.
const getCellByAliases = (row: Record<string, string>, aliases: string[], { exactOnly = false } = {}) => {
  const entries = Object.entries(row).map(([header, value]) => [headerNames(header), value] as const);
  for (const alias of aliases) {
    const exact = entries.find(([names]) => names.includes(alias));
    if (exact) return exact[1];
  }
  if (exactOnly) return "";
  for (const alias of aliases) {
    const partial = entries.find(([names]) => names.some((name) => name.includes(alias)));
    if (partial) return partial[1];
  }
  return "";
};

const beneficiaryNameHeaders = ["beneficiario", "denominazione beneficiario", "nome beneficiario", "beneficiary", "受益人"];
const fiscalRepresentativeNameHeaders = [
  "rappresentante fiscale",
  "denominazione rappresentante fiscale",
  "nome rappresentante fiscale",
  "fiscal representative",
  "税务代表",
];

// Column names the parser knows. The header row is the row that contains the
// most of them, so title rows, a logo or notes above the table are skipped.
const KNOWN_COLUMN_HEADERS = new Set([
  "zip", "nome zip", "n. zip", "n zip", "numero zip", "file zip", "ragione sociale", "contraente", "denominazione cn",
  "p.iva", "p. iva", "partita iva",
  "partita iva ditta", "codice credito sociale", "codice fiscale cn", "sede legale estera", "indirizzo",
  "legale rappresentante", "legale rappre", "documento identita legale rappresentante", "carta identita n",
  "data di nascita legale rappresentante", "telefono", "email", "pec", "beneficiario", "indirizzo beneficiario",
  "rappresentante fiscale", "indirizzo rappresentante fiscale", "numero progressivo", "progressivo",
  // English and Chinese names of the template columns.
  "zip number", "company name", "chinese name", "italian vat number", "unified social credit code",
  "registered office abroad", "legal representative", "legal representative id number", "legal representative date of birth",
  "phone", "zip 编号", "公司名称", "中文名称", "意大利增值税号", "统一社会信用代码", "境外注册地址", "法定代表人",
  "法定代表人身份证号码", "法定代表人出生日期", "电话", "电子邮箱", "pec 认证邮箱",
]);
const MIN_HEADER_MATCHES = 3;

const findHeaderRowIndex = (rows: string[][]) => {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 40).forEach((row, index) => {
    const score = row.filter(isKnownHeader).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= MIN_HEADER_MATCHES ? bestIndex : -1;
};

// Excel often declares a range far larger than the data (e.g. A1:XFD1048576 after
// formatting whole columns). sheet_to_json materializes every cell in that range,
// which freezes the tab, so we read only up to the last non-empty cell.
const getUsedRange = (worksheet: XLSX.WorkSheet): string | undefined => {
  let maxRow = -1;
  let maxCol = -1;
  for (const address of Object.keys(worksheet)) {
    if (address.startsWith("!")) continue;
    const value = (worksheet[address] as XLSX.CellObject | undefined)?.v;
    if (value === undefined || value === null || String(value).trim() === "") continue;
    const { r, c } = XLSX.utils.decode_cell(address);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  if (maxRow < 0) return undefined;
  return XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
};

const SHEET_DATA_FIELDS: Array<[keyof ViesSheetData, string[]]> = [
  ["beneficiario", ["beneficiario", "denominazione beneficiario", "beneficiary", "受益人"]],
  ["indirizzoBeneficiario", ["indirizzo beneficiario", "beneficiary address", "受益人地址"]],
  ["codiceFiscaleBeneficiario", ["codice fiscale beneficiario", "beneficiary tax code", "受益人税号"]],
  ["pecBeneficiario", ["pec beneficiario", "beneficiary pec", "受益人 pec"]],
  ["rappresentanteFiscale", ["rappresentante fiscale", "denominazione rappresentante fiscale", "fiscal representative", "税务代表"]],
  [
    "codiceFiscaleRappresentante",
    ["codice fiscale rappresentante fiscale", "p.iva rappresentante fiscale", "fiscal representative tax code", "税务代表税号"],
  ],
  ["amministratoreRappresentante", ["amministratore rappresentante fiscale", "amministratore", "fiscal representative director", "税务代表董事"]],
  ["codiceFiscaleAmministratore", ["codice fiscale amministratore", "director tax code", "董事税号"]],
  [
    "indirizzoRappresentanteFiscale",
    ["sede rappresentante fiscale", "domicilio fiscale", "indirizzo rappresentante fiscale", "fiscal representative office", "税务代表地址"],
  ],
  ["pecRappresentante", ["pec rappresentante fiscale", "pec", "fiscal representative pec", "税务代表 pec"]],
];

// Example rows of the template: the company name starts with "ESEMPIO ·", "EXAMPLE ·" or "示例 ·".
const EXAMPLE_ROW_NAME = /^\s*(esempio|example|示例)\s*[·–—]/i;

// Optional "DATI FOGLIO" sheet (Campo | Valore): the beneficiary office and the
// fiscal representative shared by every practice of the workbook.
const parseSheetDataSheet = (worksheet: XLSX.WorkSheet | undefined): Partial<ViesSheetData> => {
  if (!worksheet) return {};
  const usedRange = getUsedRange(worksheet);
  if (!usedRange) return {};
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "", range: usedRange });
  const result: Partial<ViesSheetData> = {};
  for (const [field, labels] of SHEET_DATA_FIELDS) {
    const row = rows.find((candidate) =>
      String(candidate[0] ?? "")
        .split(/\r?\n/)
        .some((line) => labels.includes(normalizeText(line))),
    );
    const value = row ? String(row[1] ?? "").trim() : "";
    if (value) result[field] = value;
  }
  return result;
};

const parseExcelFile = async (file: File): Promise<{ records: ExcelRecord[]; sheetData: Partial<ViesSheetData> }> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  // Sheet names may carry translations after the Italian one ("PRATICHE · APPLICATIONS · 申请").
  const sheetDataName = workbook.SheetNames.find((name) => normalizeText(name).startsWith("dati foglio"));
  const firstSheetName =
    workbook.SheetNames.find((name) => normalizeText(name).startsWith("pratiche")) ??
    workbook.SheetNames.find((name) => name !== sheetDataName) ??
    workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const usedRange = getUsedRange(worksheet);
  if (!usedRange) {
    throw new Error(viesText().errors.emptySheet);
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "", range: usedRange });

  const headerIndex = findHeaderRowIndex(rows);

  if (headerIndex === -1) {
    throw new Error(viesText().errors.noHeaderRow);
  }

  const headers = rows[headerIndex].map((cell, index) => String(cell || `Colonna ${index + 1}`).trim());
  // In the original VIES template "Indirizzo" is the beneficiary's address; in the
  // client database (no beneficiary column) it is the contraente's registered office.
  const hasBeneficiaryColumn = headers.some((header) => headerNames(header).some((name) => beneficiaryNameHeaders.includes(name)));

  const parsedRecords = rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const raw = headers.reduce<Record<string, string>>((acc, header, headerPosition) => {
        acc[header] = String(row[headerPosition] ?? "").trim();
        return acc;
      }, {});

      const record: ExcelRecord = {
        rowNumber: headerIndex + index + 2,
        progressivo: getCellByAliases(raw, ["numero progressivo", "progressivo", "numero"]),
        nomeZip: getCellByAliases(raw, [
          "nome zip", "zip", "n. zip", "n zip", "numero zip", "file zip", "nome archivio", "zip nominativo", "zip number", "zip 编号",
        ]),
        contraente: getCellByAliases(raw, ["contraente", "ragione sociale", "nome ditta", "ditta", "company name", "公司名称"]),
        denominazioneCn: getCellByAliases(raw, ["denominazione cn", "denominazione cinese", "nome cinese", "chinese name", "中文名称"], {
          exactOnly: true,
        }),
        uscc: normalizeUscc(
          getCellByAliases(raw, [
            "codice credito sociale",
            "codice di credito sociale",
            "codice unificato di credito sociale",
            "unified social credit code",
            "uscc",
            "codice fiscale cn",
            "统一社会信用代码",
          ], { exactOnly: true }),
        ),
        legaleRappresentante: getCellByAliases(raw, ["legale rappresentante", "legale rappre", "legal representative", "法定代表人"], {
          exactOnly: true,
        }),
        documentoLegaleRappresentante: getCellByAliases(
          raw,
          [
            "documento identita legale rappresentante", "documento identita", "carta identita n", "passaporto",
            "legal representative id number", "法定代表人身份证号码",
          ],
          { exactOnly: true },
        ),
        dataNascitaLegaleRappresentante: getCellByAliases(
          raw,
          ["data di nascita legale rappresentante", "data di nascita", "data nascita", "legal representative date of birth", "法定代表人出生日期"],
          { exactOnly: true },
        ),
        indirizzoContraente: getCellByAliases(
          raw,
          hasBeneficiaryColumn
            ? ["sede legale estera", "indirizzo contraente", "indirizzo ditta", "registered office abroad", "境外注册地址"]
            : ["sede legale estera", "indirizzo contraente", "indirizzo ditta", "registered office abroad", "境外注册地址", "indirizzo"],
        ),
        rappresentanteFiscale: getCellByAliases(raw, fiscalRepresentativeNameHeaders, { exactOnly: true }),
        codiceFiscaleRappresentante: getCellByAliases(raw, [
          "codice fiscale rappresentante fiscale",
          "c.f. rappresentante fiscale",
          "cf rappresentante fiscale",
          "codice fiscale rappresentante",
        ]),
        amministratoreRappresentante: getCellByAliases(
          raw,
          ["amministratore rappresentante fiscale", "amministratore societa di rappresentanza"],
          { exactOnly: true },
        ),
        codiceFiscaleAmministratore: getCellByAliases(
          raw,
          ["codice fiscale amministratore", "c.f. amministratore", "cf amministratore"],
          { exactOnly: true },
        ),
        indirizzoRappresentanteFiscale: getCellByAliases(raw, ["indirizzo rappresentante fiscale", "domicilio fiscale"]),
        partitaIvaContraente: normalizeItalianVat(
          getCellByAliases(raw, ["partita iva ditta", "p iva ditta", "p.iva ditta", "p.iva", "p. iva", "piva", "italian vat number", "意大利增值税号"]),
        ),
        beneficiario: getCellByAliases(raw, beneficiaryNameHeaders, { exactOnly: true }),
        indirizzoBeneficiario: getCellByAliases(
          raw,
          hasBeneficiaryColumn ? ["indirizzo beneficiario", "indirizzo"] : ["indirizzo beneficiario"],
        ),
        partitaIvaBeneficiario: getCellByAliases(raw, [
          "partita iva beneficiario",
          "codice fiscale beneficiario",
          "c.f. beneficiario",
          "partita iva",
        ]),
        pecBeneficiario: getCellByAliases(raw, ["pec beneficiario", "beneficiary pec", "受益人 pec"], { exactOnly: true }),
        pec: getCellByAliases(raw, ["pec", "pec contraente", "indirizzo pec", "pec 认证邮箱"], { exactOnly: true }),
        pecRappresentante: getCellByAliases(raw, ["pec rappresentante fiscale", "pec rappresentante"], { exactOnly: true }),
        pecFromRepresentative: false,
        email: getCellByAliases(raw, ["email", "e-mail", "电子邮箱", "mail"]),
        telefono: getCellByAliases(raw, ["telefono", "tel", "tel.", "cellulare", "phone", "电话"], { exactOnly: true }),
        pagamento: getCellByAliases(raw, ["pagamento"]),
        documentiIndicati: getCellByAliases(raw, ["simpli", "document", "file", "zip", "allegat"]),
        raw,
      };

      return record;
    })
    // A practice row has a company name or code, or at least some data besides the
    // ZIP number: the template's pre-numbered empty rows (only "ZIP" filled), a
    // repeated header row or a note under the table are not practices.
    .filter((record) => {
      // The template ships with filled-in example rows ("ESEMPIO · …"): never practices.
      if (EXAMPLE_ROW_NAME.test(record.contraente)) return false;
      const values = Object.values(record.raw).map(normalizeHeader).filter(Boolean);
      const looksLikeHeader = Object.values(record.raw).filter(isKnownHeader).length >= MIN_HEADER_MATCHES;
      const hasDataBesidesZip = values.length > (record.nomeZip ? 1 : 0);
      return !looksLikeHeader && (Boolean(record.contraente || record.uscc || record.partitaIvaContraente) || hasDataBesidesZip);
    });

  if (parsedRecords.length > VIES_MAX_PRACTICES_PER_SHEET) {
    throw new Error(viesText().errors.tooManyRows(parsedRecords.length, VIES_MAX_PRACTICES_PER_SHEET));
  }

  return { records: parsedRecords, sheetData: parseSheetDataSheet(sheetDataName ? workbook.Sheets[sheetDataName] : undefined) };
};

// Files added by the operating system when zipping (macOS resource forks, Finder
// and Explorer metadata): never documents.
const isSystemZipEntry = (path: string) => {
  const name = path.split("/").pop() ?? path;
  return path.split("/").includes("__MACOSX") || name.startsWith("._") || name === ".DS_Store" || name.toLowerCase() === "thumbs.db";
};

const PRACTICE_NUMBER_PATTERN = /^([1-9]|1\d|20)$/;

/**
 * A single uploaded ZIP may contain the whole batch: the practice ZIPs 1.zip … 20.zip,
 * or folders 1 … 20 with each practice's documents. Such a bundle is split into one
 * File per practice ("3.zip"), so the rest of the flow sees one ZIP per practice.
 * A ZIP named with a practice number, or without practice ZIPs/folders inside, is kept as is.
 */
const expandZipBundles = async (files: File[]): Promise<{ files: File[]; bundles: string[] }> => {
  const expanded: File[] = [];
  const bundles: string[] = [];

  for (const file of files) {
    if (PRACTICE_NUMBER_PATTERN.test(file.name.replace(/\.zip$/i, "").trim())) {
      expanded.push(file);
      continue;
    }
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && !isSystemZipEntry(entry.name));
    // A bundle zipped from a parent folder ("lotto/1.zip") has one common root folder.
    const roots = new Set(entries.map((entry) => (entry.name.includes("/") ? entry.name.split("/")[0] : "")));
    const commonRoot = roots.size === 1 && !roots.has("") ? `${[...roots][0]}/` : "";
    const practiceZips = new Map<string, JSZip.JSZipObject>();
    const practiceFolders = new Map<string, JSZip.JSZipObject[]>();

    for (const entry of entries) {
      const relativePath = entry.name.slice(commonRoot.length);
      const segments = relativePath.split("/");
      const zipNumber = segments.length === 1 ? /^(\d{1,2})\.zip$/i.exec(segments[0].trim())?.[1] : undefined;
      if (zipNumber && PRACTICE_NUMBER_PATTERN.test(zipNumber)) {
        practiceZips.set(zipNumber, entry);
      } else if (segments.length > 1 && PRACTICE_NUMBER_PATTERN.test(segments[0].trim())) {
        const folder = segments[0].trim();
        practiceFolders.set(folder, [...(practiceFolders.get(folder) ?? []), entry]);
      }
    }

    if (!practiceZips.size && !practiceFolders.size) {
      expanded.push(file);
      continue;
    }

    bundles.push(file.name);
    for (const [number, entry] of practiceZips) {
      expanded.push(new File([await entry.async("uint8array")], `${number}.zip`, { type: "application/zip" }));
    }
    for (const [number, folderEntries] of practiceFolders) {
      if (practiceZips.has(number)) continue;
      const practiceZip = new JSZip();
      for (const entry of folderEntries) {
        const innerPath = entry.name.slice(commonRoot.length).split("/").slice(1).join("/");
        practiceZip.file(innerPath, await entry.async("uint8array"));
      }
      const bytes = await practiceZip.generateAsync({ type: "uint8array", compression: "STORE" });
      expanded.push(new File([bytes], `${number}.zip`, { type: "application/zip" }));
    }
  }

  expanded.sort((a, b) => a.name.localeCompare(b.name, "it", { numeric: true }));
  return { files: expanded, bundles };
};

const readZipRecursive = async (file: File): Promise<{ documents: ZipDocument[]; agentCandidates: AgentCandidate[] }> => {
  const rootZip = await JSZip.loadAsync(await file.arrayBuffer());
  const documents: ZipDocument[] = [];
  const agentCandidates: AgentCandidate[] = [];
  const sourceZipKey = getZipReconciliationKey(file.name);
  const sourceZipName = file.name;

  const walkZip = async (zip: JSZip, prefix = "", depth = 0) => {
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && !isSystemZipEntry(entry.name));

    for (const entry of entries) {
      const fullPath = `${prefix}${entry.name}`;
      const normalizedName = entry.name.split("/").pop() || entry.name;
      const extension = normalizedName.includes(".") ? normalizedName.split(".").pop()?.toLowerCase() || "" : "";
      const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      const isZip = extension === "zip";

      let vatNumbers: string[] = [];
      let usccs: string[] = [];
      let chineseIds: string[] = [];
      let hasText = false;
      let documentType: string | null = null;
      let bytes: Uint8Array | null = null;
      if (extension === "pdf") {
        try {
          bytes = await entry.async("uint8array");
          const scan = await scanPdf(bytes);
          vatNumbers = scan.vatNumbers;
          usccs = scan.usccs;
          chineseIds = scan.chineseIds;
          hasText = scan.hasText;
          documentType = scan.hasText ? classifyDocumentText(scan.lines) : null;
        } catch {
          vatNumbers = [];
        }
        // Let the page repaint between documents.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      // Documents the text could not classify (scans, photos) go to the agent.
      const mediaType = agentMediaType(extension);
      if (!documentType && mediaType) {
        agentCandidates.push({
          key: `${sourceZipKey}::${fullPath}`,
          name: normalizedName,
          mediaType,
          bytes: bytes ?? (await entry.async("uint8array")),
        });
      }

      documents.push({
        path: fullPath,
        name: normalizedName,
        sourceZipKey,
        sourceZipName,
        extension,
        size,
        depth,
        isNestedZip: depth > 0,
        vatNumbers,
        usccs,
        chineseIds,
        hasText,
        documentType,
        extraDocumentTypes: [],
        recognisedBy: documentType ? "testo" : null,
        agentStatus: null,
        agentIssues: [],
        agentExpiryDate: "",
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
            vatNumbers: [],
            usccs: [],
            chineseIds: [],
            hasText: false,
            documentType: null,
            extraDocumentTypes: [],
            recognisedBy: null,
            agentStatus: null,
            agentIssues: [],
            agentExpiryDate: "",
          });
        }
      }
    }
  };

  await walkZip(rootZip);
  return { documents, agentCandidates };
};

const AGENT_CONCURRENCY = 3;

/** Applies the agent's reading to a document; codes count only with a valid check character. */
// Second look: in a ZIP where a required document type was not found, the agent
// re-reads the documents it has not read yet, because one PDF can bundle several
// documents. Only documents that may hold the missing types are sent.
const REPRESENTATIVE_TYPE_IDS = new Set(VIES_DOCUMENT_TYPES.filter((type) => type.subject === "rappresentante").map((type) => type.id));

const findSecondLookDocuments = (documents: ZipDocument[]) => {
  const byZip = new Map<string, ZipDocument[]>();
  for (const document of documents) byZip.set(document.sourceZipKey, [...(byZip.get(document.sourceZipKey) ?? []), document]);
  const selected: ZipDocument[] = [];
  for (const zipDocuments of byZip.values()) {
    const found = new Set(zipDocuments.flatMap((document) => [document.documentType, ...document.extraDocumentTypes]));
    const missing = VIES_DOCUMENT_TYPES.filter((type) => !found.has(type.id));
    if (!missing.length) continue;
    const needsClient = missing.some((type) => !REPRESENTATIVE_TYPE_IDS.has(type.id));
    const needsRepresentative = missing.some((type) => REPRESENTATIVE_TYPE_IDS.has(type.id));
    for (const document of zipDocuments) {
      if (document.agentStatus === "ok" || !agentMediaType(document.extension) || document.isNestedZip && document.extension === "zip") continue;
      const isRepresentativeDocument = document.documentType ? REPRESENTATIVE_TYPE_IDS.has(document.documentType) : null;
      if (isRepresentativeDocument === true && !needsRepresentative) continue;
      if (isRepresentativeDocument === false && !needsClient) continue;
      selected.push(document);
    }
  }
  return selected;
};

// Bytes of one document of an uploaded ZIP, also inside nested ZIPs ("a.zip/b.pdf").
const readZipEntryBytes = async (file: File, path: string): Promise<Uint8Array | null> => {
  const segments = path.split(/(?<=\.zip)\//i);
  let zip = await JSZip.loadAsync(await file.arrayBuffer());
  for (const [index, segment] of segments.entries()) {
    const entry = zip.file(segment);
    if (!entry) return null;
    if (index === segments.length - 1) return entry.async("uint8array");
    zip = await JSZip.loadAsync(await entry.async("arraybuffer"));
  }
  return null;
};

const SECOND_LOOK_FAILED = "Verifica approfondita dell'agent non riuscita";

// What the user has to do for each reason a row is blocked: nothing is created
// for that row until the missing document or data is provided.
// The errors are matched in Italian (the form they are generated and stored in); the
// instruction is given in the operator's language.
type FixMessages = ReturnType<typeof viesText>["fix"];
const FIX_INSTRUCTIONS: Array<[RegExp, (fix: FixMessages, match: RegExpMatchArray) => string]> = [
  [/^ZIP (.+)\.zip non caricato/, (fix, match) => fix.uploadZip(match[1])],
  [/^Numero ZIP mancante/, (fix) => fix.writeZipNumber],
  [/^Numero ZIP non valido/, (fix) => fix.fixZipNumber(VIES_MAX_PRACTICES_PER_SHEET)],
  [/è indicato su più righe/, (fix) => fix.uniqueZipNumber],
  [/^ZIP duplicato/, (fix) => fix.singleZip],
  [/sono di un'altra società/, (fix) => fix.replaceZip],
  [/compaiono anche codici di un'altra società/, (fix) => fix.removeForeign],
  [/nessun codice leggibile/, (fix) => fix.readableCodes],
  [/non verificati dall'agent/, (fix) => fix.reloadZips],
  [new RegExp(`^${SECOND_LOOK_FAILED}`), (fix) => fix.reloadForAgent],
  [/letto non valid/, (fix) => fix.checkCode],
  [/legale rappresentante non corrispondente/, (fix) => fix.fixIdDocument],
  [/Documento d'identità scaduto/, (fix) => fix.validId],
  [/^Esiste già la pratica VIES/, (fix) => fix.alreadyExists],
  [/beneficiario/i, (fix) => fix.beneficiary],
  [/rappresentante fiscale|amministratore|Domicilio fiscale/i, (fix) => fix.representative],
  [/^PEC/, (fix) => fix.pec],
  [/mancante|non valid/i, (fix) => fix.fixData],
];

const describeFix = (error: string) => {
  const fix = viesText().fix;
  for (const [pattern, instruction] of FIX_INSTRUCTIONS) {
    const match = error.match(pattern);
    if (match) return instruction(fix, match);
  }
  return fix.generic;
};

const describeMissingDocumentsFix = (requirements: DocumentRequirement[], zipName: string) => {
  const fix = viesText().fix;
  const labels = (representative: boolean) =>
    requirements
      .filter((requirement) => (requirement.subject === "rappresentante") === representative)
      .map((requirement) => getDocumentTypeLabel(requirement.id))
      .join(fix.listSeparator);
  const client = labels(false);
  const representative = labels(true);
  return [client ? fix.askClient(client) : null, representative ? fix.addRepresentative(representative) : null]
    .filter(Boolean)
    .join(fix.partsSeparator)
    .replace(/^./, (first) => first.toUpperCase())
    .concat(fix.insertInto(zipName));
};

const applyAgentOutcome = (document: ZipDocument, outcome: AgentCallOutcome): ZipDocument => {
  if (outcome.status !== "ok") {
    return { ...document, agentStatus: outcome.status, agentIssues: [outcome.message] };
  }
  const { result } = outcome;
  const verified = verifiedAgentIdentifiers(result);
  const isKnown = (id: string) => VIES_DOCUMENT_TYPES.some((type) => type.id === id);
  const known = isKnown(result.document_type);
  const primaryType = known ? result.document_type : document.documentType ?? "altro";
  return {
    ...document,
    // A document already classified from its text keeps that type; the agent adds what else the file contains.
    documentType: document.documentType ?? primaryType,
    extraDocumentTypes: [
      ...new Set(
        [result.document_type, ...(result.contained_document_types ?? [])].filter(
          (id) => isKnown(id) && id !== (document.documentType ?? primaryType),
        ),
      ),
    ],
    recognisedBy: document.documentType ? document.recognisedBy : "agent",
    agentStatus: "ok",
    usccs: [...new Set([...document.usccs, ...verified.usccs])],
    vatNumbers: [...new Set([...document.vatNumbers, ...verified.vatNumbers])],
    chineseIds: [...new Set([...document.chineseIds, ...verified.chineseIds])],
    agentIssues: [...result.issues, ...verified.issues],
    agentExpiryDate: result.expiry_date,
  };
};

const SheetField = ({
  id,
  label,
  value,
  placeholder,
  isTaxCode = false,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  isTaxCode?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => {
  const taxCodeValid = isTaxCode && value.trim() ? isValidItalianTaxCode(value) : null;
  const messages = useMessages(viesMessages).step2;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={isTaxCode ? "font-mono uppercase" : undefined}
      />
      {taxCodeValid !== null && (
        <p className={taxCodeValid ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {taxCodeValid ? messages.codeValid : messages.codeInvalid}
        </p>
      )}
    </div>
  );
};

const Vies = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const m = useMessages(viesMessages);
  const locale = useLocale();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<File[]>([]);
  const [parsedRecords, setRecords] = useState<ExcelRecord[]>([]);
  const [sheetData, setSheetData] = useState<ViesSheetData>(initialSheetData);
  const [visuraFile, setVisuraFile] = useState<File | null>(null);
  const [visuraData, setVisuraData] = useState<VisuraData | null>(null);
  const [visuraAdminIndex, setVisuraAdminIndex] = useState(-1);
  const records = useMemo(
    () => parsedRecords.map((record) => applySheetData(record, sheetData)),
    [parsedRecords, sheetData],
  );
  const companyCodesKey = useMemo(
    () => JSON.stringify(parsedRecords.map((record) => ({ uscc: normalizeUscc(record.uscc), vat: record.partitaIvaContraente }))),
    [parsedRecords],
  );
  const [documents, setDocuments] = useState<ZipDocument[]>([]);
  const [agentProgress, setAgentProgress] = useState<{ done: number; failed: number; total: number; unavailable: string | null } | null>(null);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [zipProcessingStatus, setZipProcessingStatus] = useState<string | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchUploadStatus, setBatchUploadStatus] = useState<string | null>(null);
  const [batchUploadProgress, setBatchUploadProgress] = useState(0);
  const [persistedBatchId, setPersistedBatchId] = useState<string | null>(null);
  const [lastCreatedPracticeIds, setLastCreatedPracticeIds] = useState<string[]>([]);
  // VIES practices already in the portal for the companies of the sheet.
  const [existingPractices, setExistingPractices] = useState<ExistingViesPractice[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [duplicateCheckRun, setDuplicateCheckRun] = useState(0);

  useEffect(() => {
    const companies = (JSON.parse(companyCodesKey) as Array<{ uscc: string; vat: string }>).filter(
      (company) => company.uscc || company.vat,
    );
    if (!companies.length) {
      setExistingPractices([]);
      setDuplicateCheck("idle");
      return;
    }
    let cancelled = false;
    setDuplicateCheck("checking");
    callViesControl({ action: "check_duplicates", companies })
      .then((payload) => {
        if (cancelled) return;
        setExistingPractices((payload?.existing ?? []) as ExistingViesPractice[]);
        setDuplicateCheck("done");
      })
      .catch(() => {
        if (!cancelled) setDuplicateCheck("error");
      });
    return () => {
      cancelled = true;
    };
  }, [companyCodesKey, duplicateCheckRun]);
  const [batchMonitor, setBatchMonitor] = useState<ViesBatchMonitor | null>(null);
  const [jobMonitor, setJobMonitor] = useState<ViesJobMonitor[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [lastWorkerSummary, setLastWorkerSummary] = useState<WorkerSummary | null>(null);
  const [portals, setPortals] = useState<ViesPortalOption[] | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState("");
  const [controllerReport, setControllerReport] = useState<ControllerReport | null>(null);
  const [controllerLoading, setControllerLoading] = useState(false);
  const [accessStatus, setAccessStatus] = useState<ViesAccessStatus>("checking");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const documentMatches = useMemo(() => {
    return documentRequirements.map((requirement) => {
      const matchedDocuments = documents.filter((document) => documentMatchesRequirement(document, requirement));
      const coveredZips = new Set(matchedDocuments.map((document) => document.sourceZipName));
      const zipsMissing = zipFiles.map((file) => file.name).filter((name) => !coveredZips.has(name));

      return {
        ...requirement,
        matchedDocuments,
        coveredZipCount: coveredZips.size,
        zipsMissing,
        completed: zipFiles.length > 0 && zipsMissing.length === 0,
      };
    });
  }, [documents, zipFiles]);

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

    // Company identifiers found in each ZIP: Chinese credit codes and Italian VAT numbers.
    const identifiersByZipKey = new Map<string, Set<string>>();
    for (const document of documents) {
      const identifiers = identifiersByZipKey.get(document.sourceZipKey) ?? new Set<string>();
      document.usccs.forEach((code) => identifiers.add(code));
      document.vatNumbers.forEach((vatNumber) => identifiers.add(vatNumber));
      identifiersByZipKey.set(document.sourceZipKey, identifiers);
    }
    const codeZipCount = new Map<string, number>();
    for (const identifiers of identifiersByZipKey.values()) {
      for (const code of identifiers) codeZipCount.set(code, (codeZipCount.get(code) ?? 0) + 1);
    }

    return records.map((record) => {
      const nameZipKey = getZipReconciliationKey(record.nomeZip);
      let zipKey = nameZipKey;
      let matchedZipFiles = nameZipKey ? zipFilesByKey.get(nameZipKey) ?? [] : [];
      let linkedByVat = false;
      const errors: string[] = [];

      const expectedIdentifiers = [record.uscc, record.partitaIvaContraente].filter(Boolean);
      // The representative's and the beneficiary's codes appear in every ZIP: never evidence of the client.
      const sharedIdentifiers = new Set([record.codiceFiscaleRappresentante, record.partitaIvaBeneficiario].filter(Boolean));

      // No ZIP with the expected name: accept the one ZIP whose documents carry this company's codes.
      if (matchedZipFiles.length === 0 && expectedIdentifiers.length) {
        const candidateKeys = [...identifiersByZipKey.entries()]
          .filter(([, identifiers]) => expectedIdentifiers.some((identifier) => identifiers.has(identifier)))
          .map(([key]) => key);
        if (candidateKeys.length === 1) {
          zipKey = candidateKeys[0];
          matchedZipFiles = zipFilesByKey.get(zipKey) ?? [];
          linkedByVat = matchedZipFiles.length > 0;
        }
      }

      if (!record.nomeZip) {
        errors.push(
          linkedByVat && matchedZipFiles[0]
            ? `Numero ZIP mancante nella colonna ZIP: i documenti della società sono in ${matchedZipFiles[0].name}`
            : "Numero ZIP mancante nella colonna ZIP",
        );
      }
      if (nameZipKey && records.filter((other) => getZipReconciliationKey(other.nomeZip) === nameZipKey).length > 1) {
        errors.push(`Il numero ZIP ${record.nomeZip} è indicato su più righe`);
      }
      if (record.nomeZip && matchedZipFiles.length === 0) errors.push(`ZIP ${record.nomeZip}.zip non caricato`);
      if (matchedZipFiles.length > 1) errors.push("ZIP duplicato");

      const rowDocuments = zipKey && matchedZipFiles.length
        ? documents.filter((document) => document.sourceZipKey === zipKey)
        : [];
      const zipVatNumbers = [...(identifiersByZipKey.get(zipKey) ?? [])].filter((identifier) => !sharedIdentifiers.has(identifier));
      let vatCheck: ViesReconciliationRow["vatCheck"] = "not_applicable";
      if (matchedZipFiles.length && expectedIdentifiers.length) {
        if (expectedIdentifiers.some((identifier) => zipVatNumbers.includes(identifier))) {
          vatCheck = "verified";
        } else if (zipVatNumbers.length) {
          vatCheck = "mismatch";
          errors.push(
            `I documenti dello ZIP sono di un'altra società: ${expectedIdentifiers.join(" / ")} non compare, trovati ${zipVatNumbers.join(", ")}`,
          );
        } else {
          vatCheck = "unverifiable";
          errors.push("Nei documenti dello ZIP non compare nessun codice leggibile della società: identità non verificabile");
        }
      }
      // Only this company's codes may appear: codes found in several ZIPs of the upload
      // are common documents (e.g. the fiscal representative's), never another client.
      if (vatCheck === "verified") {
        const foreignCodes = zipVatNumbers.filter(
          (code) => !expectedIdentifiers.includes(code) && (codeZipCount.get(code) ?? 0) < 2,
        );
        if (foreignCodes.length) {
          errors.push(`Nello ZIP compaiono anche codici di un'altra società: ${foreignCodes.join(", ")}`);
        }
      }
      // Documents nobody could read (agent not configured or failed) are reported as such.
      const unreadDocuments = rowDocuments.filter(
        (document) => !document.documentType && (document.agentStatus === "unavailable" || document.agentStatus === "error"),
      );
      if (unreadDocuments.length) {
        errors.push(`${unreadDocuments.length} documenti non verificati dall'agent: ${unreadDocuments[0].agentIssues[0] ?? "errore"}`);
      }
      // Codes the agent read with a wrong check character: the document must be checked by hand.
      for (const document of rowDocuments) {
        for (const issue of document.agentIssues.filter((text) => /letto non valid/i.test(text))) {
          errors.push(`${document.name}: ${issue}`);
        }
      }
      // Legal representative: the identity card in the documents must be the one in the Excel.
      const expectedId = record.documentoLegaleRappresentante.replace(/\s+/g, "").toUpperCase();
      const idsInDocuments = [...new Set(rowDocuments.flatMap((document) => document.chineseIds))];
      if (expectedId && isValidChineseId(expectedId) && idsInDocuments.length && !idsInDocuments.includes(expectedId)) {
        errors.push(`Documento del legale rappresentante non corrispondente: nei documenti ${idsInDocuments.join(", ")}`);
      }
      // Expired identity document (expiry read by the agent).
      for (const document of rowDocuments.filter((candidate) => candidate.documentType === "documento_identita")) {
        const expiry = parseItalianDate(document.agentExpiryDate);
        if (expiry && expiry < new Date()) errors.push(`Documento d'identità scaduto il ${document.agentExpiryDate}`);
      }

      // A type the agent found bundled in a file counts only if that document carries
      // the code of the company it belongs to: this client's, or the representative's.
      const representativeCode = record.codiceFiscaleRappresentante.replace(/\s+/g, "").toUpperCase();
      const acceptedTypes = new Map<string, string[]>();
      for (const document of rowDocuments) {
        const codes = new Set([...document.usccs, ...document.vatNumbers]);
        const extras = document.extraDocumentTypes.filter((type) =>
          REPRESENTATIVE_TYPE_IDS.has(type)
            ? Boolean(representativeCode) && codes.has(representativeCode)
            : expectedIdentifiers.some((code) => codes.has(code)),
        );
        acceptedTypes.set(
          documentKey(document),
          [...new Set([document.documentType, ...extras])].filter((type): type is string => Boolean(type) && type !== "altro"),
        );
      }
      if (rowDocuments.some((document) => document.agentIssues.some((issue) => issue.startsWith(SECOND_LOOK_FAILED)))) {
        errors.push(`${SECOND_LOOK_FAILED}: i documenti mancanti non sono stati ricercati di nuovo`);
      }

      // Checked per ZIP: a document in another client's ZIP must not hide a gap in this one.
      const missingRequirements = matchedZipFiles.length
        ? documentRequirements.filter(
            (requirement) => !rowDocuments.some((document) => acceptedTypes.get(documentKey(document))?.includes(requirement.id)),
          )
        : [];

      return {
        record,
        zipFile: matchedZipFiles[0],
        documents: rowDocuments,
        missingRequirements,
        linkedByVat,
        vatCheck,
        zipVatNumbers,
        acceptedTypes,
        errors,
      };
    });
  }, [documents, records, zipFiles]);

  const readyReconciliations = reconciliationRows.filter((row) => row.errors.length === 0);

  const sheetSharedIdentifiers = useMemo(
    () => new Set([normalizeTaxCode(sheetData.codiceFiscaleRappresentante), normalizeTaxCode(sheetData.codiceFiscaleBeneficiario)].filter(Boolean)),
    [sheetData.codiceFiscaleBeneficiario, sheetData.codiceFiscaleRappresentante],
  );

  const unmatchedZips = useMemo(() => {
    const linkedZipNames = new Set(reconciliationRows.flatMap((row) => (row.zipFile ? [row.zipFile.name] : [])));
    return zipFiles
      .filter((file) => !linkedZipNames.has(file.name))
      .map((file) => {
        const key = getZipReconciliationKey(file.name);
        const vatNumbers = new Set(
          documents
            .filter((document) => document.sourceZipKey === key)
            .flatMap((document) => [...document.usccs, ...document.vatNumbers])
            .filter((identifier) => !sheetSharedIdentifiers.has(identifier)),
        );
        return { file, vatNumbers: [...vatNumbers] };
      });
  }, [documents, reconciliationRows, sheetSharedIdentifiers, zipFiles]);

  // New Excel or new ZIPs: a new batch, to be checked again for duplicates.
  const startNewLot = () => {
    setPersistedBatchId(null);
    setLastCreatedPracticeIds([]);
    setDuplicateCheckRun((run) => run + 1);
  };

  const updateSheetData = (field: keyof ViesSheetData) => (value: string) => {
    setSheetData((current) => ({ ...current, [field]: value }));
  };

  const applyVisuraAdministrator = (visura: VisuraData, index: number) => {
    const admin = visura.amministratori[index];
    setVisuraAdminIndex(index);
    setSheetData((current) => ({
      ...current,
      amministratoreRappresentante: admin?.name ?? current.amministratoreRappresentante,
      codiceFiscaleAmministratore: admin?.taxCode ?? current.codiceFiscaleAmministratore,
    }));
  };

  // The visura of the representation company fills the whole fiscal
  // representative section; every value stays editable and is checked again.
  const handleVisuraUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const visura = parseVisura((await extractPdfText(new Uint8Array(await file.arrayBuffer()))).lines);
      if (!visura.codiceFiscale && !visura.denominazione) {
        setVisuraFile(null);
        setVisuraData(null);
        toast({
          variant: "destructive",
          title: viesText().toast.visuraUnreadableTitle,
          description: viesText().toast.visuraUnreadableText,
        });
        return;
      }
      setVisuraFile(file);
      setVisuraData(visura);
      setSheetData((current) => ({
        ...current,
        rappresentanteFiscale: visura.denominazione ?? current.rappresentanteFiscale,
        codiceFiscaleRappresentante: visura.codiceFiscale ?? current.codiceFiscaleRappresentante,
        indirizzoRappresentanteFiscale: visura.sedeLegale ?? current.indirizzoRappresentanteFiscale,
        pecRappresentante: visura.pec ?? current.pecRappresentante,
      }));
      applyVisuraAdministrator(visura, pickLegalRepresentative(visura.amministratori));
      toast({
        title: viesText().toast.visuraReadTitle,
        description: viesText().toast.visuraReadText(visura.denominazione ?? viesText().toast.company, visura.amministratori.length),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: viesText().toast.visuraErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.fileUnreadable,
      });
    }
  };

  const handleExcelUpload = async (file: File | undefined) => {
    if (!file) return;
    setExcelFile(file);
    setLoadingExcel(true);

    try {
      const { records: parsedRecords, sheetData: workbookSheetData } = await parseExcelFile(file);
      setRecords(parsedRecords);
      if (Object.keys(workbookSheetData).length) {
        setSheetData((current) => ({ ...current, ...workbookSheetData }));
      }
      toast({
        title: viesText().toast.excelReadTitle,
        description: viesText().toast.excelReadText(parsedRecords.length),
      });
    } catch (error) {
      setRecords([]);
      toast({
        variant: "destructive",
        title: viesText().toast.excelErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.fileUnreadable,
      });
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleZipUpload = async (files: FileList | File[] | null | undefined) => {
    const uploadedFiles = Array.from(files ?? []).filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (!uploadedFiles.length) return;

    let selectedFiles: File[];
    let bundles: string[];
    setLoadingZip(true);
    setZipProcessingStatus(viesText().status.openingZips);
    try {
      ({ files: selectedFiles, bundles } = await expandZipBundles(uploadedFiles));
    } catch (error) {
      setLoadingZip(false);
      setZipProcessingStatus(null);
      toast({
        variant: "destructive",
        title: viesText().toast.zipUnreadableTitle,
        description: error instanceof Error ? error.message : viesText().toast.zipUnreadableText,
      });
      return;
    }
    if (selectedFiles.length > VIES_MAX_PRACTICES_PER_SHEET) {
      setLoadingZip(false);
      setZipProcessingStatus(null);
      toast({
        variant: "destructive",
        title: viesText().toast.tooManyZipsTitle,
        description: viesText().toast.tooManyZipsText(selectedFiles.length, VIES_MAX_PRACTICES_PER_SHEET),
      });
      return;
    }

    setZipFiles(selectedFiles);
    setDocuments([]);
    setLoadingZip(true);
    setZipProcessingStatus(viesText().status.zipsIndexed(selectedFiles.length));

    try {
      let parsedDocuments: ZipDocument[] = [];
      const agentCandidates: AgentCandidate[] = [];
      setAgentProgress(null);

      for (const [index, file] of selectedFiles.entries()) {
        setZipProcessingStatus(viesText().status.readingZip(index + 1, selectedFiles.length, file.name, formatBytes(file.size)));

        try {
          const result = await readZipRecursive(file);
          parsedDocuments.push(...result.documents);
          agentCandidates.push(...result.agentCandidates);
          setDocuments([...parsedDocuments]);
        } catch (error) {
          const message = error instanceof Error ? error.message : viesText().errors.archiveUnreadable;
          throw new Error(viesText().errors.zipRead(file.name, message));
        }

        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      // Document agent (Claude). The availability check runs once, before any upload.
      let agentUnavailable: string | null | undefined;
      const ensureAgentChecked = async () => {
        if (agentUnavailable !== undefined) return;
        setZipProcessingStatus(viesText().status.agentCheck);
        const probe = await probeViesDocumentAgent().catch(
          (error: unknown): AgentCallOutcome => ({
            status: "error",
            message: error instanceof Error ? error.message : "Agent non raggiungibile.",
          }),
        );
        agentUnavailable = "status" in probe && probe.status === "unavailable" ? probe.message : null;
      };
      const runAgentPass = async (candidates: AgentCandidate[], label: string) => {
        await ensureAgentChecked();
        const outcomes = new Map<string, AgentCallOutcome>();
        let done = 0;
        let failed = 0;
        setAgentProgress({ done, failed, total: candidates.length, unavailable: agentUnavailable ?? null });
        await runWithConcurrency(candidates, AGENT_CONCURRENCY, async (candidate) => {
          setZipProcessingStatus(viesText().status.agentPass(label, done, candidates.length));
          const outcome: AgentCallOutcome = agentUnavailable
            ? { status: "unavailable", message: agentUnavailable }
            : await callViesDocumentAgent(candidate.bytes, candidate.mediaType, candidate.name).catch(
                (error: unknown): AgentCallOutcome => ({
                  status: "error",
                  message: error instanceof Error ? error.message : "Agent non raggiungibile.",
                }),
              );
          if (outcome.status === "unavailable") agentUnavailable = outcome.message;
          outcomes.set(candidate.key, outcome);
          done += 1;
          if (outcome.status !== "ok") failed += 1;
          setAgentProgress({ done, failed, total: candidates.length, unavailable: agentUnavailable ?? null });
          return outcome;
        });
        return outcomes;
      };
      const markPending = (keys: Set<string>) =>
        setDocuments(
          parsedDocuments.map((document) => (keys.has(documentKey(document)) ? { ...document, agentStatus: "pending" } : document)),
        );

      // 1. Scans and photos: classified and read by the agent.
      if (agentCandidates.length) {
        markPending(new Set(agentCandidates.map((candidate) => candidate.key)));
        const outcomes = await runAgentPass(agentCandidates, viesText().status.agentScans);
        parsedDocuments = parsedDocuments.map((document) => {
          const outcome = outcomes.get(documentKey(document));
          return outcome ? applyAgentOutcome(document, outcome) : document;
        });
      }

      // 2. Second look where a required document is still missing: the agent
      // re-reads the other documents of that ZIP (a PDF can bundle several).
      if (agentUnavailable === undefined || !agentUnavailable) {
        const secondLook = findSecondLookDocuments(parsedDocuments);
        if (secondLook.length) {
          const filesByKey = new Map(selectedFiles.map((file) => [getZipReconciliationKey(file.name), file]));
          const candidates: AgentCandidate[] = [];
          for (const document of secondLook) {
            const file = filesByKey.get(document.sourceZipKey);
            const mediaType = agentMediaType(document.extension);
            const bytes = file && mediaType ? await readZipEntryBytes(file, document.path) : null;
            if (bytes && mediaType) candidates.push({ key: documentKey(document), name: document.name, mediaType, bytes });
          }
          if (candidates.length) {
            markPending(new Set(candidates.map((candidate) => candidate.key)));
            const outcomes = await runAgentPass(candidates, viesText().status.agentSecondLook);
            parsedDocuments = parsedDocuments.map((document) => {
              const outcome = outcomes.get(documentKey(document));
              if (!outcome) return document;
              if (outcome.status === "ok") return applyAgentOutcome(document, outcome);
              // A failed second look must not pass for "document missing": the row says why.
              return { ...document, agentIssues: [...document.agentIssues, `${SECOND_LOOK_FAILED}: ${outcome.message}`] };
            });
          }
        }
      }

      setDocuments(parsedDocuments);
      toast({
        title: viesText().toast.zipIndexedTitle,
        description: viesText().toast.zipIndexedText(
          bundles.join(", "),
          selectedFiles.length,
          formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0)),
          parsedDocuments.length,
        ),
      });
    } catch (error) {
      setDocuments([]);
      toast({
        variant: "destructive",
        title: viesText().toast.zipErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.zipErrorText,
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
          .select("id,row_number,progressivo,contraente,external_reference,status,attempts,max_attempts,last_error,error_code")
          .eq("batch_id", batchId)
          .eq("status", "failed")
          .order("row_number", { ascending: true });

        if (jobsError) throw new Error(jobsError.message);

        setBatchMonitor(batch as ViesBatchMonitor);
        setJobMonitor((jobs ?? []) as ViesJobMonitor[]);
      } catch (error) {
        toast({
          variant: "destructive",
          title: viesText().toast.monitorErrorTitle,
          description: error instanceof Error ? error.message : viesText().toast.monitorErrorText,
        });
      } finally {
        setMonitorLoading(false);
      }
    },
    [persistedBatchId, toast],
  );


  // Final check on the data saved in the database: what can be sent, and why the rest cannot.
  const runFinalCheck = useCallback(
    async (batchId: string) => {
      setControllerLoading(true);
      try {
        const payload = await callViesControl({ action: "verify_batch", batchId });
        setControllerReport(payload.report as ControllerReport);
      } catch (error) {
        toast({
          variant: "destructive",
          title: viesText().toast.finalCheckErrorTitle,
          description: error instanceof Error ? error.message : viesText().toast.finalCheckErrorText,
        });
      } finally {
        setControllerLoading(false);
      }
    },
    [toast],
  );

  const handleSendBatch = async () => {
    if (!persistedBatchId || !selectedPortalId) return;
    const portalName = portals?.find((portal) => portal.id === selectedPortalId)?.name ?? viesText().step6.defaultPortal;
    setControlLoading("send_batch");
    try {
      const payload = await callViesControl({ action: "send_batch", batchId: persistedBatchId, portalId: selectedPortalId });
      if (payload.report) setControllerReport(payload.report as ControllerReport);
      if (payload.summary) setLastWorkerSummary(payload.summary as WorkerSummary);
      if (payload.ok === false) {
        toast({ variant: "destructive", title: viesText().toast.nothingSentTitle, description: translateViesText(String(payload.error ?? "")) });
      } else {
        const summary = payload.summary as WorkerSummary | undefined;
        toast({
          title: viesText().toast.sentTitle(portalName),
          description: summary?.notice
            ? translateViesText(summary.notice)
            : viesText().toast.sentText(summary?.completed ?? 0, summary?.failed ?? 0, summary?.skipped ?? 0),
        });
      }
      await refreshBatchMonitor();
    } catch (error) {
      toast({
        variant: "destructive",
        title: viesText().toast.sendErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.sendErrorText,
      });
    } finally {
      setControlLoading(null);
    }
  };

  const handleCancelBatch = async () => {
    if (!persistedBatchId) return;
    if (!window.confirm(viesText().step6.cancelConfirm)) return;
    setControlLoading("cancel_batch");
    try {
      await callViesControl({ action: "cancel_batch", batchId: persistedBatchId });
      toast({ title: viesText().toast.cancelledTitle, description: viesText().toast.cancelledText });
      await refreshBatchMonitor();
      await runFinalCheck(persistedBatchId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: viesText().toast.cancelErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.cancelErrorText,
      });
    } finally {
      setControlLoading(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setControlLoading(`retry-${jobId}`);
    try {
      await callViesControl({ action: "retry_job", jobId });
      toast({ title: viesText().toast.retryTitle, description: viesText().toast.retryText });
      await refreshBatchMonitor();
    } catch (error) {
      toast({
        variant: "destructive",
        title: viesText().toast.retryErrorTitle,
        description: error instanceof Error ? error.message : viesText().toast.retryErrorText,
      });
    } finally {
      setControlLoading(null);
    }
  };

  const checkViesAccess = useCallback(async () => {
    setAccessStatus("checking");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error(viesText().errors.invalidSession);
      }

      const userId = userData.user.id;
      const { data: adminRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) throw new Error(roleError.message);

      if (adminRole) {
        setAccessStatus("allowed");
        setAccessMessage(null);
        return;
      }

      const { data: viesPermission, error: permissionError } = await supabase
        .from("user_product_permissions")
        .select("practice_type")
        .eq("user_id", userId)
        .eq("practice_type", "vies")
        .maybeSingle();

      if (permissionError) throw new Error(permissionError.message);

      if (!viesPermission) {
        setAccessStatus("denied");
        setAccessMessage(viesText().access.noPermission);
        return;
      }

      setAccessStatus("allowed");
      setAccessMessage(null);
    } catch (error) {
      setAccessStatus("denied");
      setAccessMessage(error instanceof Error ? error.message : viesText().access.checkFailed);
    }
  }, []);

  useEffect(() => {
    void checkViesAccess();
  }, [checkViesAccess]);

  useEffect(() => {
    if (!persistedBatchId) {
      setControllerReport(null);
      return;
    }
    void runFinalCheck(persistedBatchId);
    callViesControl({ action: "list_portals" })
      .then((payload) => {
        const list = (payload.portals ?? []) as ViesPortalOption[];
        setPortals(list);
        setSelectedPortalId((current) => current || (list.length === 1 ? list[0].id : ""));
      })
      .catch(() => setPortals([]));
  }, [persistedBatchId, runFinalCheck]);

  useEffect(() => {
    if (!persistedBatchId) return;

    refreshBatchMonitor(persistedBatchId);
    const interval = window.setInterval(() => refreshBatchMonitor(persistedBatchId), 15000);
    return () => window.clearInterval(interval);
  }, [persistedBatchId, refreshBatchMonitor]);

  const getRecordValidationErrors = (record: ExcelRecord) => {
    const errors: string[] = [];

    if (!record.contraente) errors.push("Contraente mancante");
    if (record.nomeZip && !/^([1-9]|1\d|20)$/.test(record.nomeZip.trim())) {
      errors.push(`Numero ZIP non valido (${record.nomeZip}): atteso un numero da 1 a ${VIES_MAX_PRACTICES_PER_SHEET}`);
    }
    if (record.partitaIvaContraente && !isValidItalianVat(record.partitaIvaContraente)) {
      errors.push("Partita IVA contraente non valida");
    }
    // An 18-character code is a Chinese Unified Social Credit Code and must pass its check;
    // other foreign formats (e.g. Hong Kong BR numbers) are kept as given.
    if (record.uscc.length === 18 && !isValidUscc(record.uscc)) errors.push("Codice di credito sociale non valido");
    if (!record.partitaIvaContraente && !record.uscc) {
      errors.push("Identificativo fiscale mancante (P.IVA o codice di credito sociale)");
    }
    if (!record.beneficiario) errors.push("Beneficiario mancante");
    if (!record.indirizzoBeneficiario) errors.push("Indirizzo beneficiario mancante");
    if (!record.partitaIvaBeneficiario) errors.push("Codice fiscale beneficiario mancante");
    else if (!isValidItalianTaxCode(record.partitaIvaBeneficiario)) errors.push("Codice fiscale beneficiario non valido");
    if (record.pecBeneficiario && !isPlausibleEmail(record.pecBeneficiario)) errors.push("PEC beneficiario non valida");
    if (!record.rappresentanteFiscale) errors.push("Rappresentante fiscale mancante");
    if (!record.codiceFiscaleRappresentante) errors.push("Codice fiscale rappresentante fiscale mancante");
    else if (!isValidItalianTaxCode(record.codiceFiscaleRappresentante)) {
      errors.push("Codice fiscale rappresentante fiscale non valido");
    }
    if (!record.amministratoreRappresentante) errors.push("Amministratore del rappresentante fiscale mancante");
    if (!record.codiceFiscaleAmministratore) errors.push("Codice fiscale amministratore mancante");
    else if (!isValidItalianTaxCode(record.codiceFiscaleAmministratore)) errors.push("Codice fiscale amministratore non valido");
    if (!record.indirizzoRappresentanteFiscale) errors.push("Domicilio fiscale del rappresentante mancante");
    if (!record.pec) errors.push("PEC mancante (né del contraente né del rappresentante fiscale)");
    else if (!isPlausibleEmail(record.pec)) errors.push("PEC non valida");

    return errors;
  };

  // The practices just created by this page are not duplicates of themselves.
  const getExistingForRecord = (record: ExcelRecord) =>
    existingPractices.filter(
      (existing) =>
        !lastCreatedPracticeIds.includes(existing.id) &&
        ((record.uscc && existing.uscc === normalizeUscc(record.uscc)) ||
          (record.partitaIvaContraente && existing.vat === record.partitaIvaContraente)),
    );

  const getRowBlockingErrors = (reconciliation: ViesReconciliationRow) => [
    ...new Set([
      ...reconciliation.errors,
      ...getRecordValidationErrors(reconciliation.record),
      ...(VIES_ALLOW_DUPLICATE_PRACTICES ? [] : getExistingForRecord(reconciliation.record)).map(
        (existing) =>
          `Esiste già la pratica VIES ${existing.practice_number} per questa società (creata il ${new Date(existing.created_at).toLocaleDateString("it-IT")})`,
      ),
    ]),
  ];

  const sheetLocked = savingBatch || Boolean(persistedBatchId);
  const creationBlockedReason = persistedBatchId
    ? null
    : duplicateCheck === "checking"
      ? m.step5.duplicateChecking
      : duplicateCheck === "error"
        ? m.step5.duplicateFailed
        : null;

  const getPendingScanCount = (reconciliation: ViesReconciliationRow) =>
    reconciliation.documents.filter((document) => document.agentStatus === "pending").length;

  // The only rows that become practices: ZIP present and verified, every document
  // found and read, no error. Everything else is left out of the batch entirely.
  const isRowReady = (reconciliation: ViesReconciliationRow) =>
    Boolean(reconciliation.zipFile) &&
    reconciliation.vatCheck === "verified" &&
    reconciliation.missingRequirements.length === 0 &&
    getPendingScanCount(reconciliation) === 0 &&
    getRowBlockingErrors(reconciliation).length === 0;

  const readyRows = reconciliationRows.filter(isRowReady);
  const readyRowCount = readyRows.length;
  const excludedRows = reconciliationRows.filter((reconciliation) => !isRowReady(reconciliation));

  const handlePrepareBatch = async () => {
    if (accessStatus !== "allowed") {
      toast({
        variant: "destructive",
        title: viesText().toast.accessDeniedTitle,
        description: viesText().access.notEnabled,
      });
      return;
    }

    // A batch is created once: after that, a new Excel or new ZIPs start a new one.
    if (persistedBatchId || creationBlockedReason) {
      toast({
        variant: "destructive",
        title: persistedBatchId ? viesText().toast.alreadyCreatedTitle : viesText().toast.creationImpossibleTitle,
        description: persistedBatchId ? viesText().toast.alreadyCreatedText : creationBlockedReason,
      });
      return;
    }

    if (!excelFile || !zipFiles.length || !records.length || !documents.length) {
      toast({
        variant: "destructive",
        title: viesText().toast.incompleteTitle,
        description: viesText().toast.incompleteText,
      });
      return;
    }

    // Only complete and correct rows become practices: a row with missing or wrong
    // documents gets no practice, no archived ZIP and no policy document.
    const batchRows = reconciliationRows.filter(isRowReady);
    const excludedBatchRows = reconciliationRows.filter((reconciliation) => !isRowReady(reconciliation));
    if (!batchRows.length) {
      toast({
        variant: "destructive",
        title: viesText().toast.nothingToCreateTitle,
        description: viesText().toast.nothingToCreateText,
      });
      return;
    }
    const batchRecords = batchRows.map((reconciliation) => reconciliation.record);
    const batchZipFiles = batchRows.map((reconciliation) => reconciliation.zipFile as File);
    const batchDocumentCount = batchRows.reduce((total, reconciliation) => total + reconciliation.documents.length, 0);

    setSavingBatch(true);
    let batchId: string | null = null;
    let batchPersisted = false;
    let batchFinalized = false;
    const createdPracticeIdsForRollback: string[] = [];

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error(viesText().errors.invalidSession);
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
      const status = viesText().status;
      const errors = viesText().errors;
      setBatchUploadStatus(status.uploadExcel(excelFile.name, formatBytes(excelFile.size)));
      await uploadViesFileResumable({
        file: excelFile,
        storagePath: excelStoragePath,
        onProgress: ({ percentage, bytesUploaded, bytesTotal }) => {
          setBatchUploadProgress(percentage);
          setBatchUploadStatus(status.uploadExcelProgress(excelFile.name, formatBytes(bytesUploaded), formatBytes(bytesTotal), percentage));
        },
      });
      setBatchUploadStatus(status.verifyExcel(excelFile.name));
      await verifyViesStorageObjectExists(excelStoragePath, excelFile.size);

      // The representation company's visura is shared by every practice of the sheet.
      let visuraStoragePath: string | null = null;
      if (visuraFile) {
        visuraStoragePath = `${storageBasePath}/visura-rappresentante/${buildSafeStorageName(visuraFile.name)}`;
        setBatchUploadStatus(status.uploadVisura(visuraFile.name, formatBytes(visuraFile.size)));
        await uploadViesFileResumable({
          file: visuraFile,
          storagePath: visuraStoragePath,
          onProgress: ({ percentage }) => setBatchUploadProgress(percentage),
        });
        await verifyViesStorageObjectExists(visuraStoragePath, visuraFile.size);
      }

      const zipUploadPlans: ViesZipUploadPlan[] = batchZipFiles.map((zip, index) => {
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
      const totalZipUploadBytes = batchZipFiles.reduce((total, zip) => total + zip.size, 0);
      let completedZipUploads = 0;

      setBatchUploadProgress(0);
      setBatchUploadStatus(status.uploadZipStart(zipUploadPlans.length, VIES_ZIP_UPLOAD_CONCURRENCY));

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
              status.uploadZipProgress(
                completedZipUploads,
                zipUploadPlans.length,
                formatBytes(uploadedBytes),
                formatBytes(totalZipUploadBytes),
                Math.min(100, percentage),
              ),
            );
          };

          try {
            updateAggregateProgress(zipProgressByPath.get(plan.storagePath) ?? 0);
            await uploadViesFileResumable({
              file: plan.file,
              storagePath: plan.storagePath,
              onProgress: ({ bytesUploaded }) => updateAggregateProgress(bytesUploaded),
            });
            setBatchUploadStatus(status.verifyZip(plan.index + 1, batchZipFiles.length, plan.file.name));
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
        throw new Error(errors.zipUploadIncomplete(zipStorageFailures.join(" | ")));
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
      const reconciliationByRow = new Map(batchRows.map((row) => [row.record.rowNumber, row]));
      const jobPreparationRows = batchRecords.map((record) => {
        const validationErrors = getRecordValidationErrors(record);
        const reconciliation = reconciliationByRow.get(record.rowNumber);
        const reconciliationValidationErrors = [
          ...(reconciliation?.errors ?? []),
          ...(reconciliation?.missingRequirements ?? []).map(
            (requirement) => `Requisito documentale mancante: ${requirement.label}`,
          ),
        ];
        const allValidationErrors = [...validationErrors, ...reconciliationValidationErrors];

        return {
          record,
          reconciliation,
          validationErrors,
          reconciliationValidationErrors,
          allValidationErrors,
          isBlocked: allValidationErrors.length > 0,
        };
      });
      if (jobPreparationRows.some((job) => job.isBlocked)) {
        throw new Error(errors.rowWithErrors);
      }
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

      // Fiscal representative of the sheet, registered (or updated) in the VIES
      // registry; the batch becomes its next "Excel Lotto N".
      const representativeSource = batchRecords[0];
      const representativeTaxCode = normalizeTaxCode(representativeSource.codiceFiscaleRappresentante);
      if (!representativeTaxCode || !representativeSource.rappresentanteFiscale) {
        throw new Error(errors.representativeMissing);
      }
      // Empty fields never erase what the registry already holds for the representative.
      const administratorTaxCode = normalizeTaxCode(representativeSource.codiceFiscaleAmministratore);
      const { data: representative, error: representativeError } = await supabase
        .from("vies_fiscal_representatives")
        .upsert(
          {
            user_id: userId,
            tax_code: representativeTaxCode,
            name: representativeSource.rappresentanteFiscale,
            ...(representativeSource.amministratoreRappresentante ? { administrator_name: representativeSource.amministratoreRappresentante } : {}),
            ...(administratorTaxCode ? { administrator_tax_code: administratorTaxCode } : {}),
            ...(representativeSource.indirizzoRappresentanteFiscale ? { address: representativeSource.indirizzoRappresentanteFiscale } : {}),
            ...(representativeSource.pecRappresentante ? { pec: representativeSource.pecRappresentante } : {}),
            ...(visuraStoragePath
              ? { visura_reference: describeVisura(visuraData), visura_storage_path: `${VIES_STORAGE_BUCKET}://${visuraStoragePath}` }
              : {}),
          },
          { onConflict: "user_id,tax_code" },
        )
        .select("id")
        .single();
      if (representativeError || !representative) {
        throw new Error(errors.representativeFailed(representativeError?.message ?? errors.noData));
      }
      // The database numbers the lot (assign_vies_lot_number): the next number among all
      // the lots of this representative's tax code, whoever uploaded them.
      const { data: createdBatch, error: batchError } = await supabase.from("vies_batches").insert({
        id: batchId,
        user_id: userId,
        name: `Excel Lotto 0 · ${batchName}`,
        fiscal_representative_id: representative.id,
        source_excel_file_name: excelFile.name,
        source_zip_file_name: `${batchZipFiles.length} ZIP nominativi (${archivedZipCount} archiviati)`,
        excel_storage_path: excelStoragePath,
        zip_storage_path: zipStorageBasePath,
        total_rows: batchRecords.length,
        total_documents: batchDocumentCount,
        ready_jobs: 0,
        queued_jobs: 0,
        blocked_jobs: 0,
        matched_requirements: completedRequirements,
        // Rows left out of the batch, with the reason: they have no practice.
        missing_requirements: excludedBatchRows.map((row) => ({
          id: `riga-${row.record.rowNumber}`,
          label: `Esclusa – ZIP ${row.record.nomeZip || "?"} ${row.record.contraente || "riga VIES"}: ${[
            ...getRowBlockingErrors(row),
            ...row.missingRequirements.map((requirement) => `manca ${requirement.label}`),
          ].join("; ")}`,
        })),
        status: "draft",
        queued_at: null,
        notes: "Batch VIES in preparazione: materializzazione pratiche, job e documenti in corso.",
      }).select("lot_number").single();
      if (batchError || !createdBatch) throw new Error(errors.batchFailed(batchError?.message ?? errors.noData));
      batchPersisted = true;
      const lotNumber = createdBatch.lot_number;
      if (!lotNumber) throw new Error(errors.lotNumberFailed(errors.noData));

      const practiceNumbersByRow = new Map<number, string>();
      const jobPreparationByRow = new Map(jobPreparationRows.map((job) => [job.record.rowNumber, job]));
      const practiceRows = batchRecords.map((record) => {
        const validationErrors =
          jobPreparationByRow.get(record.rowNumber)?.allValidationErrors ?? getRecordValidationErrors(record);
        const practiceNumber = `VIES-${batchCreatedAt.getFullYear()}-${String(record.rowNumber).padStart(4, "0")}-${batchId.slice(0, 8)}`;
        practiceNumbersByRow.set(record.rowNumber, practiceNumber);

        return {
          user_id: userId,
          practice_number: practiceNumber,
          practice_type: "vies" as const,
          status: "in_lavorazione" as const,
          client_name: record.contraente || `Riga VIES ${record.rowNumber}`,
          client_email: record.pec || `vies-riga-${record.rowNumber}@placeholder.local`,
          client_phone: record.telefono || "N/D",
          beneficiary: record.beneficiario || null,
          // Column sized for Italian codes (max 16): the 18-character USCC stays in vies_uscc.
          owner_tax_code: record.partitaIvaContraente || null,
          policy_number: record.progressivo ? `VIES-${record.progressivo}` : null,
          policy_start_date: policyStartDate,
          policy_end_date: policyEndDate,
          premium_gross: VIES_PREMIUM_GROSS,
          premium_net: VIES_PREMIUM_TAXABLE,
          premium_taxable: VIES_PREMIUM_TAXABLE,
          premium_taxes: VIES_PREMIUM_TAXES,
          notes: composeNotes({
            specificFields: buildViesSpecificFields({
              batchId,
              record,
              reconciliation: reconciliationByRow.get(record.rowNumber),
              validationErrors,
              visura: visuraData,
            }),
          }),
        };
      });

      const createdPractices: Array<{ id: string; practice_number: string }> = [];
      for (let start = 0; start < practiceRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
        const chunk = practiceRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
        setBatchUploadStatus(
          status.creatingPractices(Math.min(start + chunk.length, practiceRows.length), practiceRows.length, formatDurationSeconds(batchStartedAt)),
        );
        const { data: createdPracticeChunk, error: practicesError } = await supabase
          .from("practices")
          .insert(chunk)
          .select("id, practice_number");
        if (practicesError) throw new Error(errors.practicesFailed(practicesError.message));
        createdPractices.push(...((createdPracticeChunk ?? []) as Array<{ id: string; practice_number: string }>));
      }

      const createdPracticeIdsByNumber = new Map((createdPractices ?? []).map((practice) => [practice.practice_number, practice.id]));
      const createdPracticesByIndex = new Map<number, string>();
      batchRecords.forEach((record) => {
        const practiceNumber = practiceNumbersByRow.get(record.rowNumber);
        const practiceId = practiceNumber ? createdPracticeIdsByNumber.get(practiceNumber) : undefined;
        if (practiceId) {
          createdPracticesByIndex.set(record.rowNumber, practiceId);
          createdPracticeIdsForRollback.push(practiceId);
        }
      });

      if (createdPracticesByIndex.size !== batchRecords.length) {
        throw new Error(errors.practicesIncomplete);
      }

      const practiceDocumentRows = [];
      for (const reconciliation of batchRows) {
        const practiceId = createdPracticesByIndex.get(reconciliation.record.rowNumber);
        if (practiceId && visuraFile && visuraStoragePath) {
          practiceDocumentRows.push({
            practice_id: practiceId,
            file_name: visuraFile.name,
            file_path: `${VIES_PRACTICE_DOCUMENT_PATH_PREFIX}${visuraStoragePath}`,
            file_size: visuraFile.size,
            mime_type: visuraFile.type || "application/pdf",
            uploaded_by: userId,
          });
        }

        const zipFile = reconciliation.zipFile;
        // A ZIP carrying another company's P.IVA must never reach this practice.
        if (!practiceId || !zipFile || reconciliation.vatCheck === "mismatch") continue;

        const zipKey = getZipReconciliationKey(zipFile.name);
        const stagedZipPath = zipStoragePathsByKey.get(zipKey);
        if (!stagedZipPath) {
          throw new Error(errors.zipNotArchived(zipFile.name));
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
            status.linkingDocuments(
              Math.min(start + chunk.length, practiceDocumentRows.length),
              practiceDocumentRows.length,
              formatDurationSeconds(batchStartedAt),
            ),
          );
          const { error: practiceDocumentsError } = await supabase.from("practice_documents").insert(chunk);
          if (practiceDocumentsError) throw new Error(errors.linkFailed(practiceDocumentsError.message));
        }
      }

      // Policy document (front page + guarantee text) for every practice, before the
      // batch is finalized: if one cannot be produced, the whole creation is undone,
      // so no practice is ever left without its policy document.
      let policyDocumentsAttached = 0;
      for (const [index, record] of batchRecords.entries()) {
        const practiceId = createdPracticesByIndex.get(record.rowNumber);
        if (!practiceId) throw new Error(errors.practiceNotFound(record.rowNumber));
        const input = viesPolicyInputFromPractice(practiceRows[index]);
        const missingPolicyData = missingViesPolicyData(input);
        if (missingPolicyData.length) {
          throw new Error(errors.policyNotGenerable(record.contraente, missingPolicyData.join(", ")));
        }
        setBatchUploadStatus(status.policyDocument(index + 1, batchRecords.length, record.contraente));
        const blob = new Blob([viesPolicyPdfToBytes(generateViesPolicyPdf(input)) as BlobPart], {
          type: VIES_POLICY_MIME_TYPE,
        });
        const fileName = buildViesPolicyFileName(input);
        const filePath = `${practiceId}/${Date.now()}-${fileName}`;
        // Temporary storage errors are retried before giving up on the whole creation.
        let uploadError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt) await new Promise((resolve) => window.setTimeout(resolve, 2000 * attempt));
          ({ error: uploadError } = await supabase.storage
            .from(VIES_POLICY_DOCUMENTS_BUCKET)
            .upload(filePath, blob, { contentType: VIES_POLICY_MIME_TYPE, upsert: true }));
          if (!uploadError) break;
        }
        if (uploadError) throw new Error(errors.policyNotArchived(record.contraente, uploadError.message));
        const { error: insertError } = await supabase.from("practice_documents").insert({
          practice_id: practiceId,
          file_name: fileName,
          file_path: filePath,
          file_size: blob.size,
          mime_type: VIES_POLICY_MIME_TYPE,
          uploaded_by: userId,
        });
        if (insertError) throw new Error(errors.policyNotLinked(record.contraente, insertError.message));
        policyDocumentsAttached += 1;
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
          pec_beneficiario: record.pecBeneficiario || null,
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
          status.creatingJobs(Math.min(start + chunk.length, jobRows.length), jobRows.length, formatDurationSeconds(batchStartedAt)),
        );
        const { error: jobsError } = await supabase.from("vies_jobs").insert(chunk);
        if (jobsError) throw new Error(errors.jobsFailed(jobsError.message));
      }

      const documentRows = batchRows.flatMap((reconciliation) => reconciliation.documents.map((document) => {
        const archivedZipPath = zipStoragePathsByKey.get(document.sourceZipKey);
        const zipFileName = reconciliation.zipFile?.name ?? document.sourceZipName;
        const zipDocumentBasePath = archivedZipPath ?? `zip-unarchived://${encodeURIComponent(zipFileName || document.sourceZipKey)}`;

        return {
          batch_id: batchId,
          user_id: userId,
          row_number: reconciliation.record.rowNumber,
          nome_zip: reconciliation.record.nomeZip || null,
          practice_id:
            reconciliation.vatCheck === "mismatch"
              ? null
              : createdPracticesByIndex.get(reconciliation.record.rowNumber) ?? null,
          zip_file_name: zipFileName,
          file_name: document.name,
          file_path: `${zipDocumentBasePath}#${document.path}`,
          file_extension: document.extension || null,
          file_size: document.size,
          depth: document.depth,
          is_nested_zip: document.isNestedZip,
          requirement_matches: reconciliation.acceptedTypes.get(documentKey(document)) ?? [],
          status: document.extension === "errore" ? "error" : "indexed",
        };
      }));

      for (let start = 0; start < documentRows.length; start += VIES_DB_INSERT_CHUNK_SIZE) {
        const chunk = documentRows.slice(start, start + VIES_DB_INSERT_CHUNK_SIZE);
        setBatchUploadStatus(
          status.indexingDocuments(Math.min(start + chunk.length, documentRows.length), documentRows.length, formatDurationSeconds(batchStartedAt)),
        );
        const { error: documentsError } = await supabase.from("vies_batch_documents").insert(chunk);
        if (documentsError) throw new Error(errors.indexingFailed(documentsError.message));
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
      if (finalizeBatchError) throw new Error(errors.finalizeFailed(finalizeBatchError.message));
      batchFinalized = true;

      setBatchUploadProgress(100);
      setBatchUploadStatus(status.created(formatDurationSeconds(batchStartedAt)));
      setPersistedBatchId(batchId);
      setLastCreatedPracticeIds(createdPractices?.map((practice) => practice.id) ?? []);
      setDuplicateCheckRun((run) => run + 1);
      await refreshBatchMonitor(batchId);
      toast({
        title: viesText().toast.lotCreatedTitle(lotNumber),
        description: viesText().toast.lotCreatedText(
          representativeSource.rappresentanteFiscale,
          createdPractices.length,
          formatDurationSeconds(batchStartedAt),
          excludedBatchRows.length,
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : viesText().toast.batchErrorText;
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
        title: viesText().toast.batchErrorTitle,
        description: message,
      });
    } finally {
      setSavingBatch(false);
      if (!batchFinalized) {
        setBatchUploadProgress(0);
      }
    }
  };

  if (accessStatus === "checking") {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {m.access.checkingTitle}
              </CardTitle>
              <CardDescription>
                {m.access.checkingText}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (accessStatus !== "allowed") {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Card className="w-full max-w-xl border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {m.access.deniedTitle}
              </CardTitle>
              <CardDescription>
                {accessMessage ?? m.access.deniedText}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => navigate("/dashboard")}>
                {m.access.backToDashboard}
              </Button>
              <Button variant="outline" onClick={() => void checkViesAccess()}>
                {m.access.recheck}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

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
                  {m.header.subtitle(VIES_MAX_PRACTICES_PER_SHEET)}
                </p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 text-sm">
            {m.header.guaranteed(
              VIES_GUARANTEED_AMOUNT.toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
              VIES_DURATION_MONTHS / 12,
            )}
          </Badge>
        </div>

        {VIES_ALLOW_DUPLICATE_PRACTICES && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{m.header.testModeTitle}</span> {m.header.testModeText}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.stats.rows}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{records.length}</div>
              <p className="text-xs text-muted-foreground">{m.stats.rowsHint(rowsWithCoreData)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.stats.pdfs}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pdfCount}</div>
              <p className="text-xs text-muted-foreground">{m.stats.pdfsHint}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.stats.nested}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{nestedZipCount}</div>
              <p className="text-xs text-muted-foreground">{m.stats.nestedHint}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.stats.validation}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{validationProgress}%</div>
              <Progress value={validationProgress} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5" />
              {m.step1.title}
            </CardTitle>
            <CardDescription>
              {m.step1.description(VIES_MAX_PRACTICES_PER_SHEET)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  {m.step1.excel}
                </div>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    startNewLot();
                    handleExcelUpload(event.target.files?.[0]);
                  }}
                  disabled={loadingExcel || savingBatch}
                />
                <p className="text-sm text-muted-foreground">
                  {loadingExcel ? m.step1.reading : excelFile?.name || m.step1.noExcel}
                </p>
                <a href="/vies/VIES_modello.xlsx" download className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                  {m.step1.template}
                </a>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-2 font-medium">
                  <FileArchive className="h-5 w-5 text-primary" />
                  {m.step1.zips}
                </div>
                <Input
                  type="file"
                  accept=".zip"
                  multiple
                  onChange={(event) => {
                    startNewLot();
                    handleZipUpload(Array.from(event.target.files ?? []));
                  }}
                  disabled={loadingZip || savingBatch}
                />
                <p className="break-words text-sm text-muted-foreground">
                  {loadingZip
                    ? zipProcessingStatus ?? m.step1.indexing
                    : zipFiles.length
                      ? m.step1.zipsSelected(zipFiles.length, formatBytes(selectedZipTotalSize), zipFiles.map((file) => file.name).join(", "))
                      : m.step1.noZip}
                </p>
                {agentProgress && (
                  <p className={agentProgress.unavailable ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {agentProgress.unavailable
                      ? m.step1.agentUnavailable(translateViesText(agentProgress.unavailable))
                      : agentProgress.failed
                        ? m.step1.agentFailed(agentProgress.done - agentProgress.failed, agentProgress.total, agentProgress.failed)
                        : m.step1.agentDone(agentProgress.done, agentProgress.total)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {m.step2.title}
            </CardTitle>
            <CardDescription>
              {m.step2.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <section className="space-y-4">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{m.step2.beneficiary}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <SheetField
                    id="vies-beneficiario"
                    label={m.step2.name}
                    value={sheetData.beneficiario}
                    placeholder={m.step2.beneficiaryPlaceholder}
                    disabled={sheetLocked}
                    onChange={updateSheetData("beneficiario")}
                  />
                  <SheetField
                    id="vies-cf-beneficiario"
                    label={m.step2.taxCode}
                    value={sheetData.codiceFiscaleBeneficiario}
                    placeholder={m.step2.digits11}
                    isTaxCode
                    disabled={sheetLocked}
                    onChange={updateSheetData("codiceFiscaleBeneficiario")}
                  />
                </div>
                <SheetField
                  id="vies-indirizzo-beneficiario"
                  label={m.step2.address}
                  value={sheetData.indirizzoBeneficiario}
                  placeholder={m.step2.addressPlaceholder}
                  disabled={sheetLocked}
                  onChange={updateSheetData("indirizzoBeneficiario")}
                />
                <SheetField
                  id="vies-pec-beneficiario"
                  label={m.step2.beneficiaryPec}
                  value={sheetData.pecBeneficiario}
                  placeholder={m.step2.beneficiaryPecPlaceholder}
                  disabled={sheetLocked}
                  onChange={updateSheetData("pecBeneficiario")}
                />
              </section>

              <section className="space-y-4">
                <h3 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{m.step2.representative}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="vies-visura">{m.step2.visura}</Label>
                    <Input
                      id="vies-visura"
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={sheetLocked}
                      onChange={(event) => handleVisuraUpload(event.target.files?.[0])}
                    />
                    {visuraData ? (
                      <p className="text-xs text-muted-foreground">
                        {m.step2.visuraFills(translateViesText(describeVisura(visuraData) ?? "") || m.step2.visuraRead)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {m.step2.visuraHint}
                      </p>
                    )}
                  </div>
                  {visuraData && visuraData.amministratori.length > 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="vies-visura-amministratore">{m.step2.visuraAdmin}</Label>
                      <select
                        id="vies-visura-amministratore"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={visuraAdminIndex}
                        disabled={sheetLocked}
                        onChange={(event) => applyVisuraAdministrator(visuraData, Number(event.target.value))}
                      >
                        {visuraData.amministratori.map((admin, index) => (
                          <option key={`${admin.name}-${index}`} value={index}>
                            {admin.name} — {admin.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <SheetField
                    id="vies-rappresentante"
                    label={m.step2.companyName}
                    value={sheetData.rappresentanteFiscale}
                    placeholder={m.step2.companyNamePlaceholder}
                    disabled={sheetLocked}
                    onChange={updateSheetData("rappresentanteFiscale")}
                  />
                  <SheetField
                    id="vies-cf-rappresentante"
                    label={m.step2.companyTaxCode}
                    value={sheetData.codiceFiscaleRappresentante}
                    placeholder={m.step2.digits11}
                    isTaxCode
                    disabled={sheetLocked}
                    onChange={updateSheetData("codiceFiscaleRappresentante")}
                  />
                  <SheetField
                    id="vies-amministratore"
                    label={m.step2.administrator}
                    value={sheetData.amministratoreRappresentante}
                    placeholder={m.step2.administratorPlaceholder}
                    disabled={sheetLocked}
                    onChange={updateSheetData("amministratoreRappresentante")}
                  />
                  <SheetField
                    id="vies-cf-amministratore"
                    label={m.step2.administratorTaxCode}
                    value={sheetData.codiceFiscaleAmministratore}
                    placeholder={m.step2.chars16}
                    isTaxCode
                    disabled={sheetLocked}
                    onChange={updateSheetData("codiceFiscaleAmministratore")}
                  />
                  <SheetField
                    id="vies-domicilio-rappresentante"
                    label={m.step2.seat}
                    value={sheetData.indirizzoRappresentanteFiscale}
                    placeholder={m.step2.addressPlaceholder}
                    disabled={sheetLocked}
                    onChange={updateSheetData("indirizzoRappresentanteFiscale")}
                  />
                  <SheetField
                    id="vies-pec-rappresentante"
                    label={m.step2.pec}
                    value={sheetData.pecRappresentante}
                    placeholder={m.step2.pecPlaceholder}
                    disabled={sheetLocked}
                    onChange={updateSheetData("pecRappresentante")}
                  />
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.step3.title}</CardTitle>
            <CardDescription>
              {m.step3.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {m.step3.empty}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary">{m.step3.inSheet(reconciliationRows.length)}</Badge>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                    {m.step3.ready(readyRowCount)}
                  </Badge>
                  {reconciliationRows.length - readyRowCount > 0 && (
                    <Badge variant="destructive">{m.step3.blocked(reconciliationRows.length - readyRowCount)}</Badge>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">{m.step3.colZip}</TableHead>
                        <TableHead className="min-w-48">{m.step3.colClient}</TableHead>
                        <TableHead className="whitespace-nowrap">{m.step3.colDocuments}</TableHead>
                        <TableHead className="whitespace-nowrap">{m.step3.colIdentity}</TableHead>
                        <TableHead className="text-right">{m.step3.colStatus}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliationRows.map((reconciliation) => {
                        const pendingScans = getPendingScanCount(reconciliation);
                        const rowErrors = getRowBlockingErrors(reconciliation);
                        // While the agent is reading, a type may still be found: not "missing" yet.
                        const missing = reconciliation.zipFile && !pendingScans ? reconciliation.missingRequirements : [];
                        const ready = isRowReady(reconciliation);
                        return (
                          <Fragment key={`reconciliation-${reconciliation.record.rowNumber}`}>
                            <TableRow className={ready ? undefined : "border-b-0"}>
                              <TableCell className="font-mono text-base font-semibold">{reconciliation.record.nomeZip || "—"}</TableCell>
                              <TableCell className="min-w-48">
                                <p className="break-words font-medium">{reconciliation.record.contraente || m.step3.toComplete}</p>
                                {VIES_ALLOW_DUPLICATE_PRACTICES && getExistingForRecord(reconciliation.record).length > 0 && (
                                  <p className="text-xs text-amber-800">
                                    {m.step3.alreadyPresent(getExistingForRecord(reconciliation.record).map((existing) => existing.practice_number).join(", "))}
                                  </p>
                                )}
                                <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-muted-foreground">
                                  {reconciliation.record.partitaIvaContraente && <span>P.IVA {reconciliation.record.partitaIvaContraente}</span>}
                                  {reconciliation.record.uscc && <span>USCC {reconciliation.record.uscc}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <p>{reconciliation.zipFile?.name ?? m.step3.zipNotUploaded}</p>
                                <p className="text-xs text-muted-foreground">
                                  {reconciliation.zipFile
                                    ? `${m.step3.documentsCount(reconciliation.documents.length)}${reconciliation.linkedByVat ? m.step3.linkedByVat : ""}`
                                    : "—"}
                                </p>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {reconciliation.vatCheck === "verified" && <Badge variant="secondary">{m.step3.verified}</Badge>}
                                {reconciliation.vatCheck === "mismatch" && <Badge variant="destructive">{m.step3.mismatch}</Badge>}
                                {reconciliation.vatCheck === "unverifiable" && (
                                  <Badge variant="outline" className="border-amber-300 text-amber-900">
                                    {m.step3.unverifiable}
                                  </Badge>
                                )}
                                {reconciliation.vatCheck === "not_applicable" && <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {pendingScans ? (
                                  <Badge variant="outline" className="border-amber-300 text-amber-900">
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    {m.step3.checking}
                                  </Badge>
                                ) : ready ? (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-600">{m.step3.readyBadge}</Badge>
                                ) : (
                                  <Badge variant="destructive">{m.step3.blockedBadge}</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {!ready && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={5} className="pt-0">
                                  <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
                                    {pendingScans > 0 && (
                                      <div className="flex gap-2 text-amber-900">
                                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                                        <p className="min-w-0 break-words">
                                          {m.step3.scansReading(pendingScans)}
                                        </p>
                                      </div>
                                    )}
                                    {missing.length > 0 && (
                                      <div className="flex gap-2 text-amber-900">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0 break-words">
                                          <p>
                                            <span className="font-medium">{m.step3.missingDocuments}</span>
                                            {missing.map((requirement) => getDocumentTypeLabel(requirement.id)).join(m.fix.listSeparator)}
                                          </p>
                                          <p className="text-xs text-foreground">
                                            <span className="font-medium">{m.step3.whatToDo}</span>
                                            {describeMissingDocumentsFix(missing, reconciliation.zipFile?.name ?? `${reconciliation.record.nomeZip}.zip`)}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {rowErrors.map((error) => (
                                      <div key={error} className="flex gap-2 text-destructive">
                                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0 break-words">
                                          <p>{translateViesText(error)}</p>
                                          <p className="text-xs text-foreground">
                                            <span className="font-medium">{m.step3.whatToDo}</span>
                                            {describeFix(error)}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                    {!pendingScans && (
                                      <p className="text-xs text-muted-foreground">
                                        {m.step3.rowNotCreated}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {unmatchedZips.length > 0 && (
                  <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {m.step3.unmatchedZips(unmatchedZips.length)}
                      </p>
                      {unmatchedZips.map(({ file, vatNumbers }) => (
                        <p key={file.name}>
                          <span className="font-mono">{file.name}</span>
                          {vatNumbers.length
                            ? m.step3.unmatchedWithCodes(vatNumbers.join(", "))
                            : m.step3.unmatchedNoCodes}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.step4.title}</CardTitle>
            <CardDescription>
              {m.step4.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {documentMatches.map((requirement) => (
              <div key={requirement.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {requirement.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <p className="font-medium">{getDocumentTypeLabel(requirement.id)}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {requirement.subject === "rappresentante" ? m.step4.representativeDocument : m.step4.clientDocument}
                  </p>
                  {zipFiles.length > 0 && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {m.step4.presentIn(requirement.coveredZipCount, zipFiles.length)}
                      {requirement.zipsMissing.length > 0 && m.step4.missingIn(requirement.zipsMissing.join(", "))}
                    </p>
                  )}
                </div>
                <Badge variant={requirement.completed ? "secondary" : "destructive"} className="shrink-0">
                  {requirement.completed ? m.step4.ok : m.step4.missing}
                </Badge>
              </div>
            ))}

            {missingRequirements.length > 0 && documents.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 md:col-span-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">
                  {m.step4.missingTypes(missingRequirements.length)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              {m.step5.title}
            </CardTitle>
            <CardDescription>
              {m.step5.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {persistedBatchId && !savingBatch ? (
                <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-950 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <div className="text-sm">
                      <p className="font-semibold">{m.step5.closedTitle}</p>
                      <p>{m.step5.closedText(lastCreatedPracticeIds.length, excludedRows.length, VIES_ALLOW_DUPLICATE_PRACTICES)}</p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => navigate("/practices?type=vies")}>
                    {m.step5.goToPractices}
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    disabled={
                      !readyRowCount || !documents.length || loadingExcel || loadingZip || savingBatch || Boolean(creationBlockedReason)
                    }
                    className="w-full md:w-auto"
                    onClick={handlePrepareBatch}
                  >
                    {loadingExcel || loadingZip || savingBatch || duplicateCheck === "checking" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="mr-2 h-4 w-4" />
                    )}
                    {savingBatch ? m.step5.creating : m.step5.create(readyRowCount)}
                  </Button>
                  {records.length > 0 && excludedRows.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      <p className="font-medium">
                        {m.step5.excluded(excludedRows.length)}
                      </p>
                      <ul className="list-inside list-disc">
                        {excludedRows.map((reconciliation) => (
                          <li key={reconciliation.record.rowNumber} className="break-words">
                            {m.step5.excludedRow(reconciliation.record.nomeZip || "—", reconciliation.record.contraente || m.step5.row(reconciliation.record.rowNumber))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {creationBlockedReason && (
                    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{creationBlockedReason}</p>
                    </div>
                  )}
                </>
              )}

              {(savingBatch || (batchUploadStatus && !persistedBatchId)) && (
                <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <div className="flex items-center justify-between gap-3">
                    <span>{batchUploadStatus ?? m.step5.preparing}</span>
                    <span className="font-mono">{batchUploadProgress}%</span>
                  </div>
                  <Progress value={batchUploadProgress} />
                </div>
              )}

            </div>
          </CardContent>
        </Card>


        {persistedBatchId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {m.step6.title}
              </CardTitle>
              <CardDescription>
                {m.step6.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{m.step6.finalCheck}</h3>
                  <Button variant="outline" size="sm" onClick={() => runFinalCheck(persistedBatchId)} disabled={controllerLoading}>
                    {controllerLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {m.step6.repeat}
                  </Button>
                </div>
                {!controllerReport ? (
                  <p className="text-sm text-muted-foreground">{controllerLoading ? m.step6.checking : m.step6.notRun}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">{m.step6.readyToSend(controllerReport.ok)}</Badge>
                      {controllerReport.errors > 0 && <Badge variant="destructive">{m.step6.withErrors(controllerReport.errors)}</Badge>}
                      {controllerReport.notSendable > 0 && (
                        <Badge variant="secondary">{m.step6.notSendable(controllerReport.notSendable)}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {m.step6.checkedAt(formatDateTime(controllerReport.checkedAt))}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-12">{m.step3.colZip}</TableHead>
                            <TableHead className="min-w-48">{m.step3.colClient}</TableHead>
                            <TableHead className="whitespace-nowrap">{m.step6.colPractice}</TableHead>
                            <TableHead className="text-right">{m.step6.colOutcome}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {controllerReport.jobs.map((result) => (
                            <Fragment key={result.jobId}>
                              <TableRow className={result.errors.length ? "border-b-0" : undefined}>
                                <TableCell className="font-mono text-base font-semibold">{result.nomeZip || "—"}</TableCell>
                                <TableCell className="min-w-48 break-words font-medium">{result.contraente || "—"}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {result.practiceId ? (
                                    <Button variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => navigate(`/practices/${result.practiceId}`)}>
                                      {result.practiceNumber}
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {result.outcome === "ok" ? (
                                    <Badge className="bg-emerald-600 hover:bg-emerald-600">{m.step6.outcomeReady}</Badge>
                                  ) : result.outcome === "error" ? (
                                    <Badge variant="destructive">{m.step6.outcomeErrors}</Badge>
                                  ) : (
                                    <Badge variant="secondary">{m.step6.outcomeNotSendable}</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                              {result.errors.length > 0 && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={4} className="pt-0">
                                    <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
                                      {result.errors.map((error) => (
                                        <div key={error} className={result.outcome === "error" ? "flex gap-2 text-destructive" : "flex gap-2 text-muted-foreground"}>
                                          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                          <p className="min-w-0 break-words">{translateViesText(error)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{m.step6.destination}</h3>
                {portals === null ? (
                  <p className="text-sm text-muted-foreground">{m.step6.readingPortals}</p>
                ) : portals.length === 0 ? (
                  <div className="flex gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{m.step6.noPortals}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="space-y-1.5 md:w-80">
                      <Label htmlFor="vies-portal">{m.step6.portal}</Label>
                      <select
                        id="vies-portal"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedPortalId}
                        onChange={(event) => setSelectedPortalId(event.target.value)}
                        disabled={Boolean(controlLoading)}
                      >
                        <option value="">{m.step6.choosePortal}</option>
                        {portals.map((portal) => (
                          <option key={portal.id} value={portal.id}>
                            {portal.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={handleSendBatch}
                      disabled={!selectedPortalId || !controllerReport?.ok || Boolean(controlLoading) || controllerLoading}
                    >
                      {controlLoading === "send_batch" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {m.step6.send(controllerReport?.ok ?? 0)}
                    </Button>
                  </div>
                )}
              </section>

              {batchMonitor && (
                <section className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{m.step6.sendStatus}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => refreshBatchMonitor()} disabled={monitorLoading}>
                        {monitorLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {m.step6.refresh}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={handleCancelBatch}
                        disabled={Boolean(controlLoading) || terminalJobStatuses.has(batchMonitor.status)}
                      >
                        {controlLoading === "cancel_batch" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {m.step6.cancelBatch}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      [m.step6.counters.toSend, batchMonitor.ready_jobs + batchMonitor.queued_jobs],
                      [m.step6.counters.sending, batchMonitor.processing_jobs],
                      [m.step6.counters.sent, batchMonitor.completed_jobs],
                      [m.step6.counters.failed, batchMonitor.failed_jobs],
                      [m.step6.counters.blocked, batchMonitor.blocked_jobs],
                      [m.step6.counters.cancelled, batchMonitor.cancelled_jobs],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
                        <p className="mt-1 text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                  {lastWorkerSummary?.notice && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{translateViesText(lastWorkerSummary.notice)}</div>
                  )}
                  {jobMonitor.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="min-w-48">{m.step3.colClient}</TableHead>
                            <TableHead>{m.step6.colAttempts}</TableHead>
                            <TableHead className="min-w-64">{m.step6.colPortalError}</TableHead>
                            <TableHead className="text-right">{m.step6.colAction}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobMonitor.map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="min-w-48 break-words font-medium">{job.contraente || m.step6.rowLabel(job.row_number)}</TableCell>
                              <TableCell>
                                {job.attempts}/{job.max_attempts}
                              </TableCell>
                              <TableCell className="min-w-64 break-words text-muted-foreground">{job.last_error ? translateViesText(job.last_error) : job.error_code || "—"}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => handleRetryJob(job.id)} disabled={Boolean(controlLoading)}>
                                  {controlLoading === `retry-${job.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {m.step6.retry}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{m.documentsMap.title}</CardTitle>
            <CardDescription>
              {m.documentsMap.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {m.documentsMap.empty}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{m.step3.colZip}</TableHead>
                      <TableHead className="min-w-48">{m.documentsMap.colDocument}</TableHead>
                      <TableHead>{m.documentsMap.colRecognised}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{m.documentsMap.colSize}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.slice(0, 20).map((document) => (
                      <TableRow key={documentKey(document)}>
                        <TableCell className="whitespace-nowrap font-mono">{document.sourceZipName}</TableCell>
                        <TableCell className="min-w-48">
                          <p className="break-words font-medium">{document.name}</p>
                          {document.depth > 0 && (
                            <p className="break-words text-xs text-muted-foreground">{document.path}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {document.documentType ? (
                            <>
                              <p>{getDocumentTypeLabel(document.documentType)}</p>
                              <p className="text-xs text-muted-foreground">
                                {document.recognisedBy === "agent" ? m.documentsMap.byAgent : m.documentsMap.byText}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{document.isNestedZip ? m.documentsMap.nestedZip : m.documentsMap.notRecognised}</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatBytes(document.size)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {documents.length > 20 && (
                  <p className="mt-3 text-sm text-muted-foreground">{m.documentsMap.shown(20, documents.length)}</p>
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
