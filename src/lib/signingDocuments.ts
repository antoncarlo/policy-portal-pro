// Documenti da firmare di una pratica (flusso VIES) e modulo di polizza precompilato.
//
// - Il modulo "Polizza_VIES_*.pdf" generato alla creazione del lotto e' il modulo Annex III
//   precompilato PER LA COMPAGNIA: non e' una bozza. Resta visibile solo agli amministratori
//   e viaggia verso il portale della compagnia; al rappresentante fiscale non compare mai.
// - I documenti da firmare (MUP, set informativo, privacy, antiriciclaggio, polizza firmata)
//   hanno un modello caricato dagli amministratori (bucket `signing-templates`) e una copia
//   firmata caricata nella pratica (bucket `practice-documents`, document_type `<slot>_firmato`).
//
// Nessun import React ne' alias "@/": il modulo serve anche alle funzioni /api.

import type { PracticeStage } from "./practiceStages.js";

/** document_type del modulo di polizza precompilato (per la compagnia). */
export const PREFILLED_POLICY_MODULE_TYPE = "modulo_polizza_vies";
/** Prefisso storico del nome file del modulo, per le righe create prima del document_type. */
export const PREFILLED_POLICY_FILE_PREFIX = /^Polizza_VIES_.*\.pdf$/i;

export const SIGNING_TEMPLATES_BUCKET = "signing-templates";
export const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";

export type SigningSlotId = "mup" | "set_informativo" | "privacy" | "antiriciclaggio" | "polizza_firmata";

export interface SigningSlot {
  id: SigningSlotId;
  /** Etichetta italiana (usata anche dalle API; le altre lingue sono nei messaggi del portale). */
  label: string;
  description: string;
  /** document_type della copia firmata caricata nella pratica. */
  signedType: string;
  /** Da quale sezione del flusso il documento va firmato. */
  availableFrom: PracticeStage;
  /** Il modello e' caricato dagli amministratori (false: il documento da firmare e' la bozza della compagnia). */
  hasTemplate: boolean;
  /** Parole chiave nel nome file per riconoscere una copia firmata caricata in blocco. */
  keywords: RegExp[];
}

export const SIGNING_SLOTS: SigningSlot[] = [
  {
    id: "mup",
    label: "MUP - Modulo Unico Precontrattuale",
    description: "Informativa precontrattuale dell'intermediario (allegati 3, 4 e 4-ter IVASS), firmata per presa visione.",
    signedType: "mup_firmato",
    availableFrom: "da_lavorare",
    hasTemplate: true,
    keywords: [/\bmup\b/i, /precontrattual/i, /allegat[oi]_?(3|4)/i],
  },
  {
    id: "set_informativo",
    label: "Set informativo",
    description: "DIP, DIP aggiuntivo e condizioni di assicurazione del prodotto, firmati per presa visione.",
    signedType: "set_informativo_firmato",
    availableFrom: "da_lavorare",
    hasTemplate: true,
    keywords: [/set[ _-]?informativ/i, /\bdip\b/i, /condizioni[ _-]?di[ _-]?assicurazione/i],
  },
  {
    id: "privacy",
    label: "Informativa privacy e consensi (GDPR)",
    description: "Informativa sul trattamento dei dati personali e consensi, firmata dal contraente o dal rappresentante con procura.",
    signedType: "privacy_firmata",
    availableFrom: "da_lavorare",
    hasTemplate: true,
    keywords: [/privacy/i, /gdpr/i, /consens/i, /trattamento_?dati/i],
  },
  {
    id: "antiriciclaggio",
    label: "Questionario antiriciclaggio e adeguata verifica",
    description: "Adeguata verifica della clientela (D.Lgs. 231/2007) e dichiarazione di avvenuta identificazione del rappresentante fiscale.",
    signedType: "antiriciclaggio_firmato",
    availableFrom: "da_lavorare",
    hasTemplate: true,
    keywords: [/antiricicl/i, /\baml\b/i, /adeguata_?verifica/i, /kyc/i, /231/],
  },
  {
    id: "polizza_firmata",
    label: "Polizza firmata per accettazione",
    description: "La bozza deliberata dalla compagnia, firmata dal rappresentante fiscale con la procura speciale del contraente.",
    signedType: "polizza_firmata",
    availableFrom: "deliberata",
    hasTemplate: false,
    keywords: [/polizza/i, /bozza/i, /policy/i, /accettazion/i, /fideius/i],
  },
];

export const SIGNED_DOCUMENT_TYPES = SIGNING_SLOTS.map((slot) => slot.signedType);

export const getSigningSlot = (id: string | null | undefined): SigningSlot | null =>
  SIGNING_SLOTS.find((slot) => slot.id === id) ?? null;

export const getSigningSlotBySignedType = (documentType: string | null | undefined): SigningSlot | null =>
  SIGNING_SLOTS.find((slot) => slot.signedType === documentType) ?? null;

/** Percorso del modello nel bucket `signing-templates`. */
export const signingTemplatePath = (slot: SigningSlotId) => `vies/${slot}.pdf`;

/** Nome file della copia firmata caricata nella pratica. */
export const signedDocumentPath = (practiceId: string, slot: SigningSlotId, fileName: string) => {
  const safe = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "documento.pdf";
  return `${practiceId}/${slot}_firmato-${Date.now()}-${safe}`;
};

const STAGE_ORDER: PracticeStage[] = ["da_lavorare", "in_valutazione", "integrazioni", "deliberata", "da_emettere", "emessa"];

/** Il documento e' da firmare nella sezione corrente (una pratica non deliberata non ha nulla da firmare). */
export const isSlotAvailable = (slot: SigningSlot, stage: PracticeStage) => {
  if (stage === "non_deliberata") return false;
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(slot.availableFrom);
};

export interface DocumentLike {
  id?: string;
  file_name: string;
  file_path?: string;
  document_type?: string | null;
  created_at?: string;
}

/** Modulo di polizza precompilato per la compagnia (per tipo o, per le righe storiche, per nome file). */
export const isPrefilledPolicyModule = (document: DocumentLike) =>
  document.document_type === PREFILLED_POLICY_MODULE_TYPE ||
  (!document.document_type && PREFILLED_POLICY_FILE_PREFIX.test(document.file_name));

/** Documenti visibili a chi non e' amministratore: tutto tranne il modulo per la compagnia. */
export const visibleToPartner = <T extends DocumentLike>(documents: T[]) => documents.filter((document) => !isPrefilledPolicyModule(document));

export interface SigningSlotStatus<T extends DocumentLike = DocumentLike> {
  slot: SigningSlot;
  /** Da firmare nella sezione attuale. */
  available: boolean;
  /** Copia firmata piu' recente, se caricata. */
  signed: T | null;
}

/** Stato dei documenti da firmare: per ogni documento, se e' il momento di firmarlo e la copia firmata. */
export function signingStatus<T extends DocumentLike>(documents: T[], stage: PracticeStage): SigningSlotStatus<T>[] {
  const newestFirst = [...documents].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return SIGNING_SLOTS.map((slot) => ({
    slot,
    available: isSlotAvailable(slot, stage),
    signed: newestFirst.find((document) => document.document_type === slot.signedType) ?? null,
  }));
}

/** Documenti ancora da firmare nella sezione attuale. */
export const missingSignatures = <T extends DocumentLike>(documents: T[], stage: PracticeStage) =>
  signingStatus(documents, stage).filter((entry) => entry.available && !entry.signed).map((entry) => entry.slot);

/**
 * Riconosce a quale documento da firmare corrisponde un file caricato in blocco, dal nome.
 * Un nome che comincia con l'id del documento (es. "mup_firmato.pdf", "privacy-rossi.pdf") vince
 * sulle parole chiave; "polizza"/"bozza" indicano la polizza firmata.
 */
export function inferSigningSlotFromFileName(fileName: string): SigningSlot | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const normalized = base.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const byPrefix = SIGNING_SLOTS.find((slot) => normalized.startsWith(slot.id) || normalized.startsWith(slot.signedType));
  if (byPrefix) return byPrefix;
  for (const slot of SIGNING_SLOTS) {
    if (slot.keywords.some((pattern) => pattern.test(normalized))) return slot;
  }
  return null;
}

/** Riferimento allo storage per un file_path di practice_documents (anche quelli del bucket dei lotti). */
export const storageReferenceOf = (filePath: string) => {
  const viesPrefix = "vies-batch-files://";
  return filePath.startsWith(viesPrefix)
    ? { bucket: "vies-batch-files", path: filePath.slice(viesPrefix.length) }
    : { bucket: PRACTICE_DOCUMENTS_BUCKET, path: filePath };
};
