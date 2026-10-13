// Documenti da firmare di una pratica (flusso VIES), modulo di polizza precompilato e copie firmate.
//
// - Il lotto NON genera nessun documento di polizza: finche' la compagnia non delibera la pratica
//   non ha bozza ne' proposta. Il vecchio modulo "Polizza_VIES_*.pdf" (pratiche create prima) o
//   quello che un amministratore genera a mano dalla pratica e' interno: visibile solo agli
//   amministratori, mai al rappresentante fiscale.
// - La bozza della compagnia (bozza_deliberata) si controlla, non si firma.
// - Si firmano, in quest'ordine e solo dopo la deliberazione: la polizza nella copia per la
//   Compagnia (polizza_copia_compagnia, inviata dalla compagnia o allegata dall'ufficio),
//   l'informativa privacy, il MUP e il questionario antiriciclaggio. I modelli di privacy, MUP e
//   antiriciclaggio li caricano gli amministratori (bucket `signing-templates`); le copie firmate
//   finiscono nella pratica (bucket `practice-documents`, document_type `<slot>_firmat[oa]`).
// - Con tutte le firme caricate, le copie firmate vengono trasmesse alla compagnia
//   (practice_workflow.signed_sent_at), che restituisce le copie della polizza emessa.
//
// Nessun import React ne' alias "@/": il modulo serve anche alle funzioni /api.

import type { PracticeStage } from "./practiceStages.js";

/** document_type del modulo di polizza precompilato (per la compagnia). */
export const PREFILLED_POLICY_MODULE_TYPE = "modulo_polizza_vies";
/** Prefisso storico del nome file del modulo, per le righe create prima del document_type. */
export const PREFILLED_POLICY_FILE_PREFIX = /^Polizza_VIES_.*\.pdf$/i;

/** document_type della bozza di polizza della compagnia: si controlla, non si firma. */
export const DRAFT_DOCUMENT_TYPE = "bozza_deliberata";
/** document_type della polizza nella copia per la Compagnia: e' questa che si firma. */
export const COMPANY_COPY_DOCUMENT_TYPE = "polizza_copia_compagnia";
/** document_type delle copie di polizza emessa restituite dalla compagnia. */
export const ISSUED_POLICY_DOCUMENT_TYPE = "polizza_emessa";

export const SIGNING_TEMPLATES_BUCKET = "signing-templates";
export const PRACTICE_DOCUMENTS_BUCKET = "practice-documents";

/** Sezione del flusso da cui si firma: dopo la deliberazione. */
export const SIGNING_STAGE: PracticeStage = "deliberata";

export type SigningSlotId = "polizza_firmata" | "privacy" | "mup" | "antiriciclaggio";

export interface SigningSlot {
  id: SigningSlotId;
  /** Posizione nell'ordine di firma (1 = prima). */
  order: number;
  /** Etichetta italiana (usata anche dalle API; le altre lingue sono nei messaggi del portale). */
  label: string;
  description: string;
  /** document_type della copia firmata caricata nella pratica. */
  signedType: string;
  /** Il modello e' caricato dagli amministratori (false: si firma la copia della polizza della compagnia). */
  hasTemplate: boolean;
  /** document_type del documento da firmare quando non c'e' un modello. */
  sourceType: string | null;
  /** Parole chiave nel nome file per riconoscere una copia firmata caricata in blocco. */
  keywords: RegExp[];
}

export const SIGNING_SLOTS: SigningSlot[] = [
  {
    id: "polizza_firmata",
    order: 1,
    label: "Polizza - copia per la Compagnia",
    description: "La polizza nella copia per la Compagnia, firmata dal rappresentante fiscale con la procura speciale del contraente. La bozza non si firma.",
    signedType: "polizza_firmata",
    hasTemplate: false,
    sourceType: COMPANY_COPY_DOCUMENT_TYPE,
    keywords: [/polizza/i, /policy/i, /copia[ _-]?compagnia/i, /accettazion/i, /fideius/i],
  },
  {
    id: "privacy",
    order: 2,
    label: "Informativa privacy e consensi (GDPR)",
    description: "Informativa sul trattamento dei dati personali e consensi, firmata dal rappresentante con procura.",
    signedType: "privacy_firmata",
    hasTemplate: true,
    sourceType: null,
    keywords: [/privacy/i, /gdpr/i, /consens/i, /trattamento[ _-]?dati/i],
  },
  {
    id: "mup",
    order: 3,
    label: "MUP - Modulo Unico Precontrattuale",
    description: "Informativa precontrattuale dell'intermediario (allegati 3, 4 e 4-ter IVASS), firmata per presa visione.",
    signedType: "mup_firmato",
    hasTemplate: true,
    sourceType: null,
    keywords: [/(^|[^a-z])mup(?![a-z])/i, /precontrattual/i, /allegat[oi][ _-]?(3|4)/i],
  },
  {
    id: "antiriciclaggio",
    order: 4,
    label: "Questionario antiriciclaggio e adeguata verifica",
    description: "Adeguata verifica della clientela (D.Lgs. 231/2007) e dichiarazione di avvenuta identificazione del rappresentante fiscale.",
    signedType: "antiriciclaggio_firmato",
    hasTemplate: true,
    sourceType: null,
    keywords: [/antiricicl/i, /(^|[^a-z])aml(?![a-z])/i, /adeguata[ _-]?verifica/i, /kyc/i, /231/],
  },
];

export const SIGNED_DOCUMENT_TYPES = SIGNING_SLOTS.map((slot) => slot.signedType);

/** Tipi di documento che viaggiano nel flusso con la compagnia (oltre ai documenti del lotto). */
export const FLOW_DOCUMENT_TYPES = [DRAFT_DOCUMENT_TYPE, COMPANY_COPY_DOCUMENT_TYPE, ISSUED_POLICY_DOCUMENT_TYPE];

export const getSigningSlot = (id: string | null | undefined): SigningSlot | null =>
  SIGNING_SLOTS.find((slot) => slot.id === id) ?? null;

export const getSigningSlotBySignedType = (documentType: string | null | undefined): SigningSlot | null =>
  SIGNING_SLOTS.find((slot) => slot.signedType === documentType) ?? null;

/** Percorso del modello nel bucket `signing-templates`. */
export const signingTemplatePath = (slot: SigningSlotId) => `vies/${slot}.pdf`;

const safeFileName = (fileName: string) =>
  fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "documento.pdf";

/** Nome file della copia firmata caricata nella pratica. */
export const signedDocumentPath = (practiceId: string, slot: SigningSlotId, fileName: string) =>
  `${practiceId}/${slot}_firmato-${Date.now()}-${safeFileName(fileName)}`;

/** Nome file della copia per la Compagnia caricata dall'ufficio. */
export const companyCopyPath = (practiceId: string, fileName: string) =>
  `${practiceId}/${COMPANY_COPY_DOCUMENT_TYPE}-${Date.now()}-${safeFileName(fileName)}`;

const STAGE_ORDER: PracticeStage[] = ["da_lavorare", "in_valutazione", "integrazioni", "deliberata", "da_emettere", "emessa"];

/** Le firme si fanno dalla deliberazione in poi (una pratica non deliberata non ha nulla da firmare). */
export const isSigningStage = (stage: PracticeStage) =>
  stage !== "non_deliberata" && STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(SIGNING_STAGE);

/** Il documento e' da firmare nella sezione corrente. */
export const isSlotAvailable = (_slot: SigningSlot, stage: PracticeStage) => isSigningStage(stage);

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

const newestFirst = <T extends DocumentLike>(documents: T[]) => [...documents].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

export interface SigningSlotStatus<T extends DocumentLike = DocumentLike> {
  slot: SigningSlot;
  /** Da firmare nella sezione attuale. */
  available: boolean;
  /** Il documento da firmare (modello a parte): la copia per la Compagnia, se arrivata. */
  source: T | null;
  /** Copia firmata piu' recente, se caricata. */
  signed: T | null;
}

/** Stato dei documenti da firmare, nell'ordine di firma: cosa firmare, se e' il momento, la copia firmata. */
export function signingStatus<T extends DocumentLike>(documents: T[], stage: PracticeStage): SigningSlotStatus<T>[] {
  const sorted = newestFirst(documents);
  return [...SIGNING_SLOTS]
    .sort((a, b) => a.order - b.order)
    .map((slot) => ({
      slot,
      available: isSlotAvailable(slot, stage),
      source: slot.sourceType ? sorted.find((document) => document.document_type === slot.sourceType) ?? null : null,
      signed: sorted.find((document) => document.document_type === slot.signedType) ?? null,
    }));
}

/** Documenti ancora da firmare nella sezione attuale. */
export const missingSignatures = <T extends DocumentLike>(documents: T[], stage: PracticeStage) =>
  signingStatus(documents, stage).filter((entry) => entry.available && !entry.signed).map((entry) => entry.slot);

/** Tutte le copie firmate sono caricate (e si e' nella fase di firma). */
export const signaturesComplete = <T extends DocumentLike>(documents: T[], stage: PracticeStage) =>
  isSigningStage(stage) && missingSignatures(documents, stage).length === 0;

/** La bozza della compagnia, se arrivata. */
export const draftOf = <T extends DocumentLike>(documents: T[]) =>
  newestFirst(documents).find((document) => document.document_type === DRAFT_DOCUMENT_TYPE) ?? null;

/** La copia per la Compagnia da firmare, se arrivata. */
export const companyCopyOf = <T extends DocumentLike>(documents: T[]) =>
  newestFirst(documents).find((document) => document.document_type === COMPANY_COPY_DOCUMENT_TYPE) ?? null;

/** Le copie della polizza emessa restituite dalla compagnia. */
export const issuedCopiesOf = <T extends DocumentLike>(documents: T[]) =>
  newestFirst(documents).filter((document) => document.document_type === ISSUED_POLICY_DOCUMENT_TYPE);

/**
 * Riconosce a quale documento da firmare corrisponde un file caricato in blocco, dal nome.
 * Un nome che comincia con l'id del documento (es. "mup_firmato.pdf", "privacy-rossi.pdf") vince
 * sulle parole chiave; "polizza" indica la copia per la Compagnia firmata.
 */
export function inferSigningSlotFromFileName(fileName: string): SigningSlot | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const normalized = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Prefisso d'ordine dei file nello ZIP ("3_mup.pdf"): il numero non deve influenzare il riconoscimento.
    .replace(/^\d+[ _-]+/, "");
  const byPrefix = SIGNING_SLOTS.find((slot) => normalized.startsWith(slot.id) || normalized.startsWith(slot.signedType));
  if (byPrefix) return byPrefix;
  for (const slot of [...SIGNING_SLOTS].sort((a, b) => a.order - b.order)) {
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
