// Lettura dei documenti dello ZIP della pratica (licenza commerciale, documento del legale rappresentante,
// UBO) per compilare il questionario antiriciclaggio. Un agente (funzione `vies-aml-agent`) legge i file; il
// risultato e' una bozza da verificare, mai un dato certo: ogni dato viene controllato qui e quelli non
// verificabili (numeri di documento con cifra di controllo errata, date non valide) si scartano e si segnalano.

import type { AmlData, AmlOwner } from "./signingPrefill";
import { MAX_PREFILLED_OWNERS, readChineseId } from "./signingPrefill";

/** Tipi di documento dello ZIP (id di viesDocumentTypes) che servono al questionario. */
export const AML_DOCUMENT_TYPES = ["licenza_commerciale", "documento_identita", "ubo", "report_credito"] as const;
export const AML_MAX_DOCUMENTS = 5;
export const AML_MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface AgentPerson {
  name?: string;
  sex?: string;
  birth_date?: string;
  birth_place?: string;
  birth_country?: string;
  nationality?: string;
  residence?: string;
  residence_country?: string;
  id_number?: string;
  id_issue_date?: string;
  id_expiry_date?: string;
  id_authority?: string;
}

export interface AgentAmlResult {
  company?: { legal_form?: string; establishment_date?: string; registered_capital?: string };
  legal_representative?: AgentPerson;
  owners?: Array<AgentPerson & { share_percent?: string; control?: string }>;
  issues?: string[];
}

const clean = (value: unknown, max = 200) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Una data GG/MM/AAAA esistente; altrimenti vuoto e una segnalazione. */
function date(value: unknown, label: string, issues: string[]) {
  const text = clean(value, 20);
  if (!text) return "";
  const match = DATE.exec(text);
  const real = match ? new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`) : null;
  if (!match || !real || Number.isNaN(real.getTime()) || real.getUTCDate() !== Number(match[1])) {
    issues.push(`${label}: data non valida (“${text}”), lasciata in bianco`);
    return "";
  }
  return text;
}

const sex = (value: unknown) => {
  const text = clean(value, 5).toUpperCase();
  return text === "M" || text === "F" ? text : "";
};

/** Un numero di documento: se ha la forma di una carta d'identita' cinese deve avere la cifra di controllo giusta. */
function idNumber(value: unknown, label: string, issues: string[]) {
  const text = clean(value, 40).replace(/\s+/g, "").toUpperCase();
  if (!text) return "";
  if (/^\d{17}[\dX]$/.test(text) && !readChineseId(text).valid) {
    issues.push(`${label}: il numero ${text} non ha la cifra di controllo giusta, lasciato in bianco`);
    return "";
  }
  return text;
}

function person(source: AgentPerson | undefined, label: string, issues: string[]) {
  const s = source ?? {};
  return {
    nome: clean(s.name),
    sesso: sex(s.sex),
    data_nascita: date(s.birth_date, `${label}, data di nascita`, issues),
    luogo_nascita: clean(s.birth_place),
    nazione_nascita: clean(s.birth_country),
    cittadinanza: clean(s.nationality),
    residenza: clean(s.residence, 300),
    residenza_nazione: clean(s.residence_country),
    doc_numero: idNumber(s.id_number, `${label}, documento`, issues),
    doc_rilascio: date(s.id_issue_date, `${label}, rilascio del documento`, issues),
    doc_scadenza: date(s.id_expiry_date, `${label}, scadenza del documento`, issues),
    doc_ente: clean(s.id_authority),
  };
}

const quota = (value: unknown) => {
  const text = clean(value, 20).replace(/\s+/g, "");
  if (!text) return "";
  return /^\d+([.,]\d+)?$/.test(text) ? `${text.replace(".", ",")}%` : text;
};

/** Il risultato dell'agent in dati del questionario, con le segnalazioni (quelle dell'agent e quelle dei controlli). */
export function amlFromAgent(result: AgentAmlResult, today = new Date()): { aml: AmlData; issues: string[] } {
  const issues: string[] = (result.issues ?? []).map((item) => clean(item, 300)).filter(Boolean);
  const company = result.company ?? {};
  const rappresentante = person(result.legal_representative, "Legale rappresentante", issues);
  const owners = result.owners ?? [];
  const titolari: AmlOwner[] = owners.slice(0, MAX_PREFILLED_OWNERS).map((owner, index) => ({
    ...person(owner, `Titolare effettivo ${index + 1}`, issues),
    quota: quota(owner.share_percent),
    controllo: clean(owner.control),
  }));
  if (owners.length > MAX_PREFILLED_OWNERS) issues.push(`Titolari effettivi: ${owners.length} nei documenti, nel questionario ne entrano ${MAX_PREFILLED_OWNERS}; gli altri vanno aggiunti a mano`);

  const expiry = DATE.exec(rappresentante.doc_scadenza);
  if (expiry && new Date(`${expiry[3]}-${expiry[2]}-${expiry[1]}T23:59:59Z`) < today) issues.push(`Documento del legale rappresentante scaduto il ${rappresentante.doc_scadenza}`);

  const capital = clean(company.registered_capital, 80);
  return {
    aml: {
      contraente: {
        forma_giuridica: clean(company.legal_form),
        data_costituzione: date(company.establishment_date, "Data di costituzione", issues),
        capitale: capital,
      },
      rappresentante,
      titolari,
    },
    issues: [...new Set(issues)],
  };
}

/** Il nome del file riconosciuto dai tipi dello ZIP: solo PDF e immagini si possono leggere. */
export const READABLE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface IndexedZipDocument {
  file_name: string;
  file_path: string;
  file_extension: string | null;
  file_size: number | null;
  requirement_matches: string[] | null;
}

/** Quali documenti dello ZIP mandare all'agent: i tre che contano prima, poi il report di credito, al massimo 5. */
export function pickAmlDocuments(documents: IndexedZipDocument[]) {
  const order = (document: IndexedZipDocument) => {
    const index = AML_DOCUMENT_TYPES.findIndex((type) => (document.requirement_matches ?? []).includes(type));
    return index < 0 ? 99 : index;
  };
  const skipped: string[] = [];
  const picked = documents
    .filter((document) => order(document) < 99)
    .sort((a, b) => order(a) - order(b))
    .filter((document) => {
      const extension = (document.file_extension || document.file_name.split(".").pop() || "").toLowerCase();
      if (!READABLE_EXTENSIONS.has(extension)) {
        skipped.push(`${document.file_name}: formato non leggibile (${extension || "?"})`);
        return false;
      }
      if ((document.file_size ?? 0) > AML_MAX_FILE_BYTES) {
        skipped.push(`${document.file_name}: file troppo grande`);
        return false;
      }
      return true;
    })
    .slice(0, AML_MAX_DOCUMENTS);
  return { picked, skipped };
}

/** "<percorso dello ZIP>#<percorso nello ZIP>" come registrato nell'indice dei documenti del lotto. */
export function splitIndexedPath(filePath: string) {
  const index = filePath.indexOf("#");
  const zip = index < 0 ? filePath : filePath.slice(0, index);
  const inner = index < 0 ? "" : filePath.slice(index + 1);
  const prefix = "vies-batch-files://";
  if (zip.startsWith("zip-unarchived://")) return { zipPath: null, inner };
  return { zipPath: zip.startsWith(prefix) ? zip.slice(prefix.length) : zip, inner };
}
