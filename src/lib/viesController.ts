// Controllo finale di un lotto VIES prima dell'invio al portale esterno.
//
// Rilegge dal database ciò che è stato davvero salvato (pratica, ZIP allegato,
// documento di polizza, documenti indicizzati) e lo confronta regola per regola:
// nessun dato viene preso dalla pagina. È deterministico, quindi dà sempre lo
// stesso esito sugli stessi dati: una pratica passa solo se tutte le regole
// sono rispettate, altrimenti resta bloccata con il motivo.

import { extractNotesSections } from "./practiceSummary.js";
import { isValidItalianTaxCode, isValidItalianVat, isValidUscc } from "./viesCodes.js";
import {
  VIES_ALLOW_DUPLICATE_PRACTICES,
  VIES_DURATION_MONTHS,
  VIES_GUARANTEED_AMOUNT,
  VIES_PREMIUM_GROSS,
  VIES_PREMIUM_TAXABLE,
  VIES_PREMIUM_TAXES,
} from "./viesTerms.js";

/** Tipologie di documento obbligatorie in ogni ZIP (id di viesDocumentTypes). */
export const VIES_REQUIRED_DOCUMENT_IDS = [
  "licenza_commerciale",
  "documento_identita",
  "report_credito",
  "dichiarazione_sostitutiva",
  "ubo",
  "mandato_rappresentanza",
  "visura_rappresentante",
  "bilancio_rappresentante",
  "statuto_rappresentante",
] as const;

const ZIP_NUMBER = /^([1-9]|1\d|20)$/;
// "processing": the worker re-runs the check on a job it has just taken, right before sending it.
const SENDABLE_STATUSES = new Set(["ready", "queued", "failed", "processing"]);

export interface ControllerJob {
  id: string;
  row_number: number;
  nome_zip: string | null;
  zip_file_name: string | null;
  contraente: string | null;
  partita_iva_contraente: string | null;
  status: string;
  last_error: string | null;
  validation_errors: unknown;
  reconciliation_errors: unknown;
  external_reference: string | null;
}

export interface ControllerPractice {
  id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  owner_tax_code: string | null;
  beneficiary: string | null;
  notes: string | null;
  premium_gross: number | null;
  premium_taxes: number | null;
  premium_net: number | null;
  premium_taxable: number | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
}

export interface ControllerDocument {
  practice_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
}

export interface ControllerIndexedDocument {
  practice_id: string | null;
  row_number: number | null;
  zip_file_name: string | null;
  requirement_matches: string[] | null;
  status: string | null;
}

/** Pratica VIES già presente nel portale, fuori da questo lotto. */
export interface ControllerExistingPractice {
  id: string;
  practice_number: string;
  created_at: string;
  uscc: string | null;
  vat: string | null;
}

export interface ControllerInput {
  batchId: string;
  jobs: ControllerJob[];
  practices: ControllerPractice[];
  documents: ControllerDocument[];
  indexedDocuments: ControllerIndexedDocument[];
  existingPractices: ControllerExistingPractice[];
}

export type ControllerOutcome = "ok" | "error" | "not_sendable";

export interface ControllerJobResult {
  jobId: string;
  rowNumber: number;
  nomeZip: string | null;
  contraente: string | null;
  practiceId: string | null;
  practiceNumber: string | null;
  /** ok = può essere inviata; error = regola violata; not_sendable = già bloccata, inviata o annullata. */
  outcome: ControllerOutcome;
  errors: string[];
}

export interface ControllerReport {
  batchId: string;
  checkedAt: string;
  rulesVersion: number;
  ok: number;
  errors: number;
  notSendable: number;
  jobs: ControllerJobResult[];
}

export const VIES_CONTROLLER_RULES_VERSION = 1;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => str(item)).filter(Boolean) : []);
const sameMoney = (value: number | null | undefined, expected: number) =>
  typeof value === "number" && Math.abs(value - expected) < 0.005;

const addMonths = (isoDate: string, months: number) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

const formatDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

/** Codici (USCC / P.IVA) della società di una pratica, dai campi VIES salvati. */
export const practiceCompanyCodes = (practice: Pick<ControllerPractice, "notes" | "owner_tax_code">) => {
  const fields = extractNotesSections(practice.notes).specificFields ?? {};
  return {
    uscc: str(fields.vies_uscc).toUpperCase() || null,
    vat: str(fields.vies_partita_iva) || str(practice.owner_tax_code) || null,
  };
};

export function verifyViesBatch(input: ControllerInput): ControllerReport {
  const practicesById = new Map(input.practices.map((practice) => [practice.id, practice]));
  const documentsByPractice = new Map<string, ControllerDocument[]>();
  for (const document of input.documents) {
    documentsByPractice.set(document.practice_id, [...(documentsByPractice.get(document.practice_id) ?? []), document]);
  }
  const indexedByPractice = new Map<string, ControllerIndexedDocument[]>();
  for (const document of input.indexedDocuments) {
    if (!document.practice_id) continue;
    indexedByPractice.set(document.practice_id, [...(indexedByPractice.get(document.practice_id) ?? []), document]);
  }

  // Codici trovati in più ZIP dello stesso lotto: documenti comuni (es. quelli
  // del rappresentante fiscale), mai prova dell'identità di un singolo cliente.
  const codeOccurrences = new Map<string, number>();
  for (const practice of input.practices) {
    const fields = extractNotesSections(practice.notes).specificFields ?? {};
    for (const code of new Set(list(fields.vies_piva_trovate))) {
      codeOccurrences.set(code, (codeOccurrences.get(code) ?? 0) + 1);
    }
  }

  const activeJobs = input.jobs.filter((job) => SENDABLE_STATUSES.has(job.status));
  const results: ControllerJobResult[] = input.jobs
    .slice()
    .sort((a, b) => a.row_number - b.row_number)
    .map((job) => {
      const practice = job.external_reference ? practicesById.get(job.external_reference) ?? null : null;
      const base = {
        jobId: job.id,
        rowNumber: job.row_number,
        nomeZip: job.nome_zip,
        contraente: job.contraente,
        practiceId: practice?.id ?? null,
        practiceNumber: practice?.practice_number ?? null,
      };

      if (!SENDABLE_STATUSES.has(job.status)) {
        const reason =
          job.status === "blocked"
            ? `Bloccata: ${str(job.last_error) || "errori sui dati o sui documenti"}`
            : job.status === "completed"
              ? "Già inviata al portale"
              : "Annullata";
        return { ...base, outcome: "not_sendable" as const, errors: [reason] };
      }

      const errors: string[] = [];
      const fail = (message: string) => errors.push(message);

      // 1. Esito dei controlli fatti alla creazione.
      const creationErrors = [...new Set([...list(job.validation_errors), ...list(job.reconciliation_errors)])];
      if (creationErrors.length) fail(`Errori registrati alla creazione: ${creationErrors.join("; ")}`);

      // 2. Pratica collegata.
      if (!practice) {
        fail("Nessuna pratica collegata a questa riga");
        return { ...base, outcome: "error" as const, errors };
      }
      if (practice.practice_type !== "vies") fail("La pratica collegata non è di tipo VIES");
      if (str(practice.client_name) !== str(job.contraente)) {
        fail(`Il contraente della pratica (${str(practice.client_name)}) è diverso da quello della riga (${str(job.contraente)})`);
      }

      const fields = extractNotesSections(practice.notes).specificFields ?? {};
      const { uscc, vat } = practiceCompanyCodes(practice);

      // 3. Codici della società.
      if (!uscc && !vat) fail("Mancano sia il codice di credito sociale sia la P.IVA della società");
      if (uscc && !isValidUscc(uscc)) fail(`Codice di credito sociale non valido: ${uscc}`);
      if (vat && !isValidItalianVat(vat)) fail(`P.IVA non valida: ${vat}`);
      if (str(practice.owner_tax_code) !== (vat ?? "")) fail("La P.IVA della pratica non coincide con quella registrata");
      if (str(job.partita_iva_contraente) !== (vat ?? "")) fail("La P.IVA della riga non coincide con quella della pratica");

      // 4. I documenti dello ZIP sono di questa società, e solo di questa.
      const expectedCodes = [uscc, vat].filter((code): code is string => Boolean(code));
      const foundCodes = [...new Set(list(fields.vies_piva_trovate))];
      if (str(fields.vies_verifica_piva) !== "verified") {
        fail("L'identità della società non è stata verificata nei documenti dello ZIP");
      }
      if (!foundCodes.some((code) => expectedCodes.includes(code))) {
        fail(`Nei documenti dello ZIP non compare il codice della società (${expectedCodes.join(" / ") || "nessuno"})`);
      }
      const foreignCodes = foundCodes.filter((code) => !expectedCodes.includes(code) && (codeOccurrences.get(code) ?? 0) < 2);
      if (foreignCodes.length) fail(`Nello ZIP compaiono codici di un'altra società: ${foreignCodes.join(", ")}`);

      // 5. Numero ZIP coerente in riga, pratica e allegato.
      const nomeZip = str(job.nome_zip);
      const expectedZipName = `${nomeZip}.zip`;
      if (!ZIP_NUMBER.test(nomeZip)) fail(`Numero ZIP non valido: ${nomeZip || "mancante"}`);
      if (str(job.zip_file_name) !== expectedZipName) fail(`Lo ZIP della riga è ${str(job.zip_file_name) || "mancante"}, atteso ${expectedZipName}`);
      if (str(fields.vies_zip_file) !== expectedZipName) fail(`Lo ZIP registrato nella pratica è ${str(fields.vies_zip_file) || "mancante"}, atteso ${expectedZipName}`);

      // 6. Allegati della pratica: esattamente lo ZIP giusto e un documento di polizza.
      const attachments = documentsByPractice.get(practice.id) ?? [];
      const zipAttachments = attachments.filter((document) => /\.zip$/i.test(document.file_name));
      if (zipAttachments.length !== 1) {
        fail(zipAttachments.length ? `Alla pratica sono allegati ${zipAttachments.length} ZIP: ${zipAttachments.map((document) => document.file_name).join(", ")}` : "Lo ZIP non è allegato alla pratica");
      } else {
        const [zip] = zipAttachments;
        if (zip.file_name !== expectedZipName) fail(`Alla pratica è allegato ${zip.file_name} invece di ${expectedZipName}`);
        if (!zip.file_path.startsWith("vies-batch-files://") || !zip.file_path.endsWith(`/${input.batchId}/zip-nominativi/${expectedZipName}`)) {
          fail(`Lo ZIP allegato non è quello archiviato con questo lotto (${zip.file_path})`);
        }
        if (!zip.file_size) fail("Lo ZIP allegato risulta vuoto");
      }
      const policyAttachments = attachments.filter((document) => /^Polizza_VIES_.*\.pdf$/i.test(document.file_name));
      if (policyAttachments.length !== 1) {
        fail(policyAttachments.length ? `Alla pratica sono allegati ${policyAttachments.length} documenti di polizza` : "Manca il documento di polizza");
      } else if (!policyAttachments[0].file_path.startsWith(`${practice.id}/`)) {
        fail("Il documento di polizza non è archiviato nella cartella di questa pratica");
      }

      // 7. Documenti obbligatori, ricontati dall'indice dei documenti dello ZIP.
      const indexed = indexedByPractice.get(practice.id) ?? [];
      if (!indexed.length) fail("Nessun documento indicizzato per lo ZIP di questa pratica");
      const otherZip = indexed.find((document) => str(document.zip_file_name) !== expectedZipName);
      if (otherZip) fail(`Tra i documenti della pratica ce n'è uno di ${str(otherZip.zip_file_name) || "un altro ZIP"}`);
      if (indexed.some((document) => document.status === "error")) fail("Uno dei documenti dello ZIP non è leggibile");
      const covered = new Set(indexed.flatMap((document) => document.requirement_matches ?? []));
      const missing = VIES_REQUIRED_DOCUMENT_IDS.filter((id) => !covered.has(id));
      if (missing.length) fail(`Documenti obbligatori non trovati: ${missing.join(", ")}`);

      // 8. Condizioni economiche e durata.
      if (!sameMoney(practice.premium_gross, VIES_PREMIUM_GROSS)) fail(`Premio lordo ${practice.premium_gross ?? "mancante"}, atteso ${VIES_PREMIUM_GROSS}`);
      if (!sameMoney(practice.premium_taxes, VIES_PREMIUM_TAXES)) fail(`Imposte ${practice.premium_taxes ?? "mancanti"}, attese ${VIES_PREMIUM_TAXES}`);
      if (!sameMoney(practice.premium_taxable, VIES_PREMIUM_TAXABLE)) fail(`Imponibile ${practice.premium_taxable ?? "mancante"}, atteso ${VIES_PREMIUM_TAXABLE}`);
      if (!sameMoney(practice.premium_net, VIES_PREMIUM_TAXABLE)) fail(`Premio netto ${practice.premium_net ?? "mancante"}, atteso ${VIES_PREMIUM_TAXABLE}`);
      if (Number(fields.vies_importo_garantito) !== VIES_GUARANTEED_AMOUNT) fail(`Importo garantito ${str(fields.vies_importo_garantito) || "mancante"}, atteso ${VIES_GUARANTEED_AMOUNT}`);
      if (Number(fields.vies_durata_mesi) !== VIES_DURATION_MONTHS) fail(`Durata ${str(fields.vies_durata_mesi) || "mancante"} mesi, attesa ${VIES_DURATION_MONTHS}`);
      if (!practice.policy_start_date || !practice.policy_end_date) {
        fail("Mancano le date di decorrenza o scadenza");
      } else if (addMonths(practice.policy_start_date.slice(0, 10), VIES_DURATION_MONTHS) !== practice.policy_end_date.slice(0, 10)) {
        fail(`Scadenza ${formatDate(practice.policy_end_date)} non coerente con decorrenza ${formatDate(practice.policy_start_date)} e durata di ${VIES_DURATION_MONTHS} mesi`);
      }

      // 9. Beneficiario e rappresentante fiscale.
      if (!str(practice.beneficiary)) fail("Manca il beneficiario");
      if (!str(fields.vies_indirizzo_beneficiario)) fail("Manca l'indirizzo del beneficiario");
      if (!isValidItalianVat(str(fields.vies_codice_fiscale_beneficiario))) fail("Codice fiscale del beneficiario mancante o non valido");
      if (!str(fields.vies_rappresentante_fiscale)) fail("Manca il rappresentante fiscale");
      if (!isValidItalianVat(str(fields.vies_codice_fiscale_rappresentante))) fail("Codice fiscale del rappresentante fiscale mancante o non valido");
      if (!str(fields.vies_amministratore_rappresentante)) fail("Manca l'amministratore del rappresentante fiscale");
      const adminTaxCode = str(fields.vies_codice_fiscale_amministratore).toUpperCase();
      if (adminTaxCode && !isValidItalianTaxCode(adminTaxCode)) fail(`Codice fiscale dell'amministratore non valido: ${adminTaxCode}`);
      if (!str(fields.vies_domicilio_fiscale)) fail("Manca la sede del rappresentante fiscale (domicilio della società)");

      // 10. Doppioni: nello stesso lotto e tra le pratiche VIES già presenti.
      for (const other of activeJobs) {
        if (other.id === job.id) continue;
        const otherPractice = other.external_reference ? practicesById.get(other.external_reference) : undefined;
        if (str(other.nome_zip) === nomeZip) fail(`Il numero ZIP ${nomeZip} è usato anche dalla riga ${other.row_number}`);
        if (otherPractice) {
          const otherCodes = practiceCompanyCodes(otherPractice);
          if ((uscc && otherCodes.uscc === uscc) || (vat && otherCodes.vat === vat)) {
            fail(`La stessa società compare anche alla riga ${other.row_number}`);
          }
        }
      }
      // Test mode: practices already in the portal for the same company are allowed.
      for (const existing of VIES_ALLOW_DUPLICATE_PRACTICES ? [] : input.existingPractices) {
        if ((uscc && existing.uscc === uscc) || (vat && existing.vat === vat)) {
          fail(`Esiste già la pratica VIES ${existing.practice_number} per questa società (creata il ${formatDate(existing.created_at)})`);
        }
      }

      return { ...base, outcome: errors.length ? ("error" as const) : ("ok" as const), errors };
    });

  return {
    batchId: input.batchId,
    checkedAt: new Date().toISOString(),
    rulesVersion: VIES_CONTROLLER_RULES_VERSION,
    ok: results.filter((result) => result.outcome === "ok").length,
    errors: results.filter((result) => result.outcome === "error").length,
    notSendable: results.filter((result) => result.outcome === "not_sendable").length,
    jobs: results,
  };
}
