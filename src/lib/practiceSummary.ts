// Riepilogo pratica condiviso tra frontend (pagina pratica) e API partner.
// Questo modulo non deve importare React ne' usare l'alias "@/" perche' viene
// bundlato anche dalle Vercel Functions in /api tramite import relativo.

import { policyFieldsConfig, type PolicyField } from "../types/policyFields.js";
import { getCoverageById, petCoverages, type PetCoverage } from "../data/petInsuranceData.js";

export const SPECIFIC_FIELDS_SEPARATOR = "--- Dati Specifici Polizza ---";
export const IDEMPOTENCY_PREFIX = "idempotency:";

export type SpecificFieldValue = string | number | boolean | null | string[];
export type SpecificFields = Record<string, unknown>;

export interface NotesSections {
  idempotencyKey: string | null;
  textualNotes: string;
  specificFields: SpecificFields | null;
}

/**
 * Scompone il campo `notes` di una pratica nelle sue parti logiche:
 * - chiave di idempotenza (prima riga `idempotency:<key>`, scritta dal webhook)
 * - note testuali (appunti per l'assuntore / il partner)
 * - dati specifici polizza (JSON dopo il separatore)
 */
export function extractNotesSections(notes: string | null | undefined): NotesSections {
  if (!notes) return { idempotencyKey: null, textualNotes: "", specificFields: null };

  let working = notes;
  let idempotencyKey: string | null = null;

  if (working.startsWith(IDEMPOTENCY_PREFIX)) {
    const newlineIdx = working.indexOf("\n");
    const firstLine = newlineIdx >= 0 ? working.slice(0, newlineIdx) : working;
    idempotencyKey = firstLine.slice(IDEMPOTENCY_PREFIX.length).trim() || null;
    working = newlineIdx >= 0 ? working.slice(newlineIdx + 1) : "";
  }

  const sepIndex = working.indexOf(SPECIFIC_FIELDS_SEPARATOR);
  if (sepIndex === -1) {
    return { idempotencyKey, textualNotes: working.trim(), specificFields: null };
  }

  const textualNotes = working.slice(0, sepIndex).trim();
  const jsonPart = working.slice(sepIndex + SPECIFIC_FIELDS_SEPARATOR.length).trim();

  try {
    const parsed = JSON.parse(jsonPart);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { idempotencyKey, textualNotes, specificFields: parsed as SpecificFields };
    }
  } catch {
    // JSON non valido: lo lasciamo nelle note testuali per non perdere informazioni
  }

  return {
    idempotencyKey,
    textualNotes: textualNotes ? `${textualNotes}\n${jsonPart}` : jsonPart,
    specificFields: null,
  };
}

/**
 * Ricompone il campo `notes` a partire dalle sue parti, preservando
 * chiave di idempotenza e dati specifici.
 */
export function composeNotes(sections: {
  idempotencyKey?: string | null;
  textualNotes?: string | null;
  specificFields?: SpecificFields | null;
}): string | null {
  const parts: string[] = [];
  if (sections.idempotencyKey) parts.push(`${IDEMPOTENCY_PREFIX}${sections.idempotencyKey}`);
  const textual = sections.textualNotes?.trim();
  if (textual) parts.push(textual);
  if (sections.specificFields && Object.keys(sections.specificFields).length > 0) {
    parts.push(`${SPECIFIC_FIELDS_SEPARATOR}\n${JSON.stringify(sections.specificFields, null, 2)}`);
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// ---------------------------------------------------------------------------
// Etichette
// ---------------------------------------------------------------------------

export const PRACTICE_TYPE_LABELS: Record<string, string> = {
  fidejussioni: "Fidejussioni",
  car: "CAR",
  postuma_decennale: "Postuma Decennale",
  all_risk: "All Risk",
  responsabilita_civile: "Responsabilità Civile",
  responsabilita: "Responsabilità Civile",
  pet: "Pet",
  fotovoltaico: "Fotovoltaico",
  catastrofali: "Catastrofali",
  azienda: "Azienda",
  casa: "Casa",
  risparmio: "Risparmio",
  salute: "Salute",
  auto: "Auto",
  vita: "Vita",
  vies: "VIES",
  altro: "Altro",
};

// practice_type (enum DB) -> chiave di policyFieldsConfig (Title Case usata dal form)
const POLICY_FIELDS_KEY_BY_TYPE: Record<string, string> = {
  car: "Car",
  casa: "Casa",
  fidejussioni: "Fidejussioni",
  responsabilita_civile: "RC",
  responsabilita: "RC",
  pet: "Pet",
  fotovoltaico: "Fotovoltaico",
  catastrofali: "Catastrofali",
  azienda: "Azienda",
  postuma_decennale: "Postuma Decennale",
  all_risk: "All Risk",
  risparmio: "Risparmio",
  vita: "Risparmio",
  salute: "Salute",
};

export const PET_ANIMAL_TYPE_LABELS: Record<string, string> = {
  gatti: "Gatto",
  gatto: "Gatto",
  cani_0_20kg: "Cane fino a 20 kg",
  cani_oltre_20kg: "Cane oltre 20 kg",
  cane: "Cane",
};

export const PET_COVERAGE_TYPE_LABELS: Record<string, string> = {
  rct: "Solo RC Terzi (RCT)",
  rsv: "Solo Spese Veterinarie (RSV)",
  rct_rsv: "RC Terzi + Spese Veterinarie",
  completa: "Copertura Completa (RCT + RSV + TL)",
};

export const PET_COVERAGE_CATEGORY_LABELS: Record<PetCoverage["category"], string> = {
  assistenza: "Assistenza",
  rsv: "Rimborso Spese Veterinarie",
  rct: "Responsabilità Civile verso Terzi",
  tl: "Tutela Legale",
};

// Campi pet che vengono gestiti in modo dedicato nella sezione "Animale" e "Coperture"
const PET_ANIMAL_FIELD_ORDER = [
  "pet_name",
  "pet_species",
  "animal_type",
  "pet_breed",
  "pet_birth_date",
  "pet_age",
  "pet_gender",
  "pet_microchip",
  "pet_sterilized",
  "pet_weight",
  "pet_previous_diseases",
];

const PET_QUOTE_FIELDS = [
  "coverage_type",
  "selected_coverages",
  "coverages",
  "total_annual",
  "total_monthly",
  "plan_name",
  "plan_id",
];

const EXTRA_FIELD_LABELS: Record<string, string> = {
  animal_type: "Categoria Animale",
  pet_age: "Età Animale",
  selected_coverages: "Coperture Selezionate",
  coverages: "Coperture Selezionate",
  total_annual: "Premio Annuale (€)",
  total_monthly: "Premio Mensile (€)",
  plan_name: "Piano",
  plan_id: "Piano",
  owner_tax_code: "Codice Fiscale Contraente",
  pet_microchip: "Numero Microchip",
  client_address: "Indirizzo Cliente",
  address: "Indirizzo",
  city: "Città",
  zip_code: "CAP",
  province: "Provincia",
  tax_code: "Codice Fiscale",
  birth_date: "Data di Nascita",
  pet_owner_name: "Proprietario",
};

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFieldDefinitions(practiceType: string | null | undefined): PolicyField[] {
  const key = practiceType ? POLICY_FIELDS_KEY_BY_TYPE[practiceType] : undefined;
  return key ? policyFieldsConfig[key] ?? [] : [];
}

export function getSpecificFieldLabel(practiceType: string | null | undefined, key: string): string {
  const def = getFieldDefinitions(practiceType).find((f) => f.name === key);
  if (def) return def.label;
  return EXTRA_FIELD_LABELS[key] ?? humanizeKey(key);
}

function formatFieldValue(
  practiceType: string | null | undefined,
  key: string,
  raw: unknown
): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  const def = getFieldDefinitions(practiceType).find((f) => f.name === key);

  if (typeof raw === "boolean") return raw ? "Sì" : "No";

  if (Array.isArray(raw)) {
    const rendered = raw
      .map((item) => (typeof item === "string" ? getCoverageById(item)?.name ?? item : String(item)))
      .filter(Boolean);
    return rendered.length > 0 ? rendered.join(", ") : null;
  }

  if (typeof raw === "object") {
    return JSON.stringify(raw);
  }

  const value = String(raw);

  if (def?.type === "select" && def.options) {
    const opt = def.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }

  if (key === "animal_type") return PET_ANIMAL_TYPE_LABELS[value] ?? value;
  if (key === "coverage_type" && practiceType === "pet") return PET_COVERAGE_TYPE_LABELS[value] ?? value;
  if (key === "pet_species") return PET_ANIMAL_TYPE_LABELS[value] ?? value;

  if (def?.type === "date" || /_date$/.test(key)) {
    const d = parseDateFlexible(value);
    if (d) return d.toLocaleDateString("it-IT");
  }

  return value;
}

// ---------------------------------------------------------------------------
// Riepilogo
// ---------------------------------------------------------------------------

export interface SummaryItem {
  key: string;
  label: string;
  value: string;
}

export interface SummarySection {
  id: string;
  title: string;
  items: SummaryItem[];
}

export interface PetCoverageSummary {
  id: string;
  name: string;
  category: PetCoverage["category"];
  category_label: string;
  description: string;
  price: number;
}

export interface PetSummary {
  name: string | null;
  species: string | null;
  animal_type: string | null;
  animal_type_label: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  microchip: string | null;
  sterilized: boolean | null;
  weight_kg: number | null;
  previous_diseases: string | null;
  owner_tax_code: string | null;
  coverage_type: string | null;
  coverage_type_label: string | null;
  coverages: PetCoverageSummary[];
  total_annual: number | null;
  total_monthly: number | null;
}

export interface PracticeSummaryInput {
  practice_type: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  beneficiary?: string | null;
  owner_tax_code?: string | null;
  pet_microchip?: string | null;
  policy_number?: string | null;
  policy_start_date?: string | null;
  policy_end_date?: string | null;
  premium_net?: number | null;
  premium_taxable?: number | null;
  premium_taxes?: number | null;
  premium_gross?: number | null;
  commission_percentage?: number | null;
  commission_amount?: number | null;
  specific_fields?: SpecificFields | null;
}

export interface PracticeSummary {
  practice_type: string | null;
  practice_type_label: string;
  sections: SummarySection[];
  pet: PetSummary | null;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (["true", "1", "si", "sì", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  return null;
};

/**
 * Interpreta una data in formato ISO (YYYY-MM-DD) oppure italiano (DD/MM/YYYY,
 * DD-MM-YYYY): alcuni partner inviano le date gia' in formato italiano e
 * `new Date("05/07/2022")` le leggerebbe come mese/giorno.
 */
export function parseDateFlexible(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  const it = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (it) {
    const d = new Date(Number(it[3]), Number(it[2]) - 1, Number(it[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Durata per calendario (anni/mesi interi), non per giorni / 365: una polizza
 * di 3 anni che attraversa un anno bisestile dura 1096 giorni, non "4 anni".
 */
export function formatPolicyDuration(start: string | null | undefined, end: string | null | undefined): string | null {
  const startDate = parseDateFlexible(start);
  const endDate = parseDateFlexible(end);
  if (!startDate || !endDate) return null;
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (endDate.getDate() < startDate.getDate()) months -= 1;
  if (months <= 0) {
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
    return days > 0 ? `${days} giorni` : null;
  }
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? "anno" : "anni"}`;
  }
  return `${months} mesi`;
}

function formatDateIt(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = parseDateFlexible(value);
  return d ? d.toLocaleDateString("it-IT") : value;
}

/** Deduce la categoria tariffaria pet (gatti / cani per peso) quando non e' indicata esplicitamente. */
export function inferPetAnimalType(fields: SpecificFields | null | undefined): string | null {
  if (!fields) return null;
  const explicit = toStringOrNull(fields.animal_type);
  if (explicit && PET_ANIMAL_TYPE_LABELS[explicit]) return explicit;

  const species = toStringOrNull(fields.pet_species)?.toLowerCase();
  if (species === "gatto" || species === "gatti") return "gatti";
  if (species === "cane" || species === "cani") {
    const weight = toNumber(fields.pet_weight);
    if (weight === null) return null;
    return weight > 20 ? "cani_oltre_20kg" : "cani_0_20kg";
  }
  return null;
}

/** Elenco coperture pet selezionate: da id espliciti oppure dedotte da coverage_type. */
export function resolvePetCoverages(fields: SpecificFields | null | undefined): PetCoverageSummary[] {
  if (!fields) return [];

  const rawIds = Array.isArray(fields.selected_coverages)
    ? fields.selected_coverages
    : Array.isArray(fields.coverages)
      ? fields.coverages
      : typeof fields.selected_coverages === "string"
        ? fields.selected_coverages.split(",").map((s) => s.trim())
        : [];

  const ids = rawIds.map((id) => String(id)).filter((id) => petCoverages.some((c) => c.id === id));

  const resolved = ids
    .map((id) => getCoverageById(id))
    .filter((c): c is PetCoverage => Boolean(c));

  return resolved.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    category_label: PET_COVERAGE_CATEGORY_LABELS[c.category],
    description: c.description,
    price: c.price,
  }));
}

export function buildPetSummary(input: PracticeSummaryInput): PetSummary | null {
  if (input.practice_type !== "pet") return null;
  const f = input.specific_fields ?? {};

  const animalType = inferPetAnimalType(f);
  const coverages = resolvePetCoverages(f);
  const coverageType = toStringOrNull(f.coverage_type);

  const totalAnnual =
    toNumber(f.total_annual) ??
    (coverages.length > 0 ? coverages.reduce((sum, c) => sum + c.price, 0) : null) ??
    input.premium_gross ??
    null;
  const totalMonthly =
    toNumber(f.total_monthly) ?? (totalAnnual !== null ? Math.round((totalAnnual / 12) * 100) / 100 : null);

  return {
    name: toStringOrNull(f.pet_name),
    species: toStringOrNull(f.pet_species),
    animal_type: animalType,
    animal_type_label: animalType ? PET_ANIMAL_TYPE_LABELS[animalType] ?? animalType : null,
    breed: toStringOrNull(f.pet_breed),
    birth_date: toStringOrNull(f.pet_birth_date),
    gender: toStringOrNull(f.pet_gender),
    microchip: toStringOrNull(input.pet_microchip) ?? toStringOrNull(f.pet_microchip),
    sterilized: toBooleanOrNull(f.pet_sterilized),
    weight_kg: toNumber(f.pet_weight),
    previous_diseases: toStringOrNull(f.pet_previous_diseases),
    owner_tax_code: toStringOrNull(input.owner_tax_code) ?? toStringOrNull(f.owner_tax_code),
    coverage_type: coverageType,
    coverage_type_label: coverageType ? PET_COVERAGE_TYPE_LABELS[coverageType] ?? coverageType : null,
    coverages,
    total_annual: totalAnnual,
    total_monthly: totalMonthly,
  };
}

function pushItem(items: SummaryItem[], key: string, label: string, value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  items.push({ key, label, value });
}

const VIES_VAT_CHECK_LABELS: Record<string, string> = {
  verified: "Verificata: la P.IVA compare nei documenti dello ZIP",
  mismatch: "Non corrisponde: lo ZIP contiene documenti di un'altra società",
  unverifiable: "Non verificabile: documenti solo scansionati",
  not_applicable: "Non eseguita (nessuno ZIP collegato)",
};

const listOrNull = (value: unknown): string | null => {
  if (!Array.isArray(value)) return toStringOrNull(value);
  const items = value.map((item) => toStringOrNull(item)).filter((item): item is string => item !== null);
  return items.length ? items.join("\n") : null;
};

/**
 * Riepilogo delle pratiche VIES: i dati della richiesta arrivano dall'import
 * massivo (Excel + dati del foglio + verifica ZIP) e sono salvati nei dati
 * specifici, cosi' le note restano libere per gli appunti dell'operatore.
 */
function buildViesSummary(input: PracticeSummaryInput): PracticeSummary {
  const f = input.specific_fields ?? {};
  const str = (key: string) => toStringOrNull(f[key]);
  const sections: SummarySection[] = [];

  const contraente: SummaryItem[] = [];
  pushItem(contraente, "client_name", "Ragione sociale", input.client_name);
  pushItem(contraente, "owner_tax_code", "Partita IVA", input.owner_tax_code);
  pushItem(contraente, "vies_domicilio_fiscale_contraente", "Domicilio fiscale in Italia", str("vies_domicilio_fiscale"));
  pushItem(contraente, "vies_sede_contraente", "Sede legale (estero)", str("vies_sede_contraente"));
  pushItem(contraente, "client_phone", "Telefono", input.client_phone && input.client_phone !== "N/D" ? input.client_phone : null);
  pushItem(contraente, "vies_email", "Email", str("vies_email"));
  const pecSource = str("vies_pec_fonte");
  pushItem(
    contraente,
    "client_email",
    "PEC della pratica",
    input.client_email && !input.client_email.endsWith("@placeholder.local")
      ? `${input.client_email}${pecSource ? ` (${pecSource})` : ""}`
      : null,
  );
  sections.push({ id: "contraente", title: "Contraente", items: contraente });

  const rappresentante: SummaryItem[] = [];
  pushItem(rappresentante, "vies_rappresentante_fiscale", "Società", str("vies_rappresentante_fiscale"));
  pushItem(rappresentante, "vies_codice_fiscale_rappresentante", "Codice fiscale / P.IVA", str("vies_codice_fiscale_rappresentante"));
  pushItem(rappresentante, "vies_domicilio_fiscale", "Sede", str("vies_domicilio_fiscale"));
  pushItem(rappresentante, "vies_amministratore_rappresentante", "Amministratore", str("vies_amministratore_rappresentante"));
  pushItem(rappresentante, "vies_codice_fiscale_amministratore", "Codice fiscale amministratore", str("vies_codice_fiscale_amministratore"));
  pushItem(rappresentante, "vies_visura_rappresentante", "Fonte", str("vies_visura_rappresentante"));
  pushItem(rappresentante, "vies_pec_rappresentante", "PEC", str("vies_pec_rappresentante"));
  if (rappresentante.length) sections.push({ id: "rappresentante", title: "Rappresentante fiscale", items: rappresentante });

  const beneficiario: SummaryItem[] = [];
  pushItem(beneficiario, "beneficiary", "Denominazione", input.beneficiary);
  pushItem(beneficiario, "vies_indirizzo_beneficiario", "Indirizzo", str("vies_indirizzo_beneficiario"));
  pushItem(beneficiario, "vies_codice_fiscale_beneficiario", "Codice fiscale", str("vies_codice_fiscale_beneficiario"));
  if (beneficiario.length) sections.push({ id: "beneficiario", title: "Beneficiario", items: beneficiario });

  const garanzia: SummaryItem[] = [];
  // Never fall back to premium_gross: the guaranteed amount is not the premium.
  const amount = toNumber(f.vies_importo_garantito);
  pushItem(garanzia, "vies_importo_garantito", "Importo garantito", amount !== null ? formatCurrency(amount) : null);
  pushItem(garanzia, "vies_oggetto_garanzia", "Oggetto della garanzia", str("vies_oggetto_garanzia"));
  pushItem(garanzia, "vies_durata", "Durata", formatPolicyDuration(input.policy_start_date, input.policy_end_date));
  pushItem(garanzia, "policy_start_date", "Decorrenza", formatDateIt(input.policy_start_date));
  pushItem(garanzia, "policy_end_date", "Scadenza", formatDateIt(input.policy_end_date));
  pushItem(garanzia, "vies_sezione_garante", "Sezione compagnia/garante", str("vies_sezione_garante"));
  sections.push({ id: "garanzia", title: "Garanzia", items: garanzia });

  const premio: SummaryItem[] = [];
  const money = (value: number | null | undefined) =>
    value !== null && value !== undefined ? formatCurrency(value) : null;
  pushItem(premio, "premium_gross", "Premio lordo", money(input.premium_gross));
  pushItem(premio, "premium_taxes", "Imposte", money(input.premium_taxes));
  pushItem(premio, "premium_taxable", "Imponibile", money(input.premium_taxable));
  pushItem(premio, "premium_net", "Premio netto", money(input.premium_net));
  if (premio.length) sections.push({ id: "premio", title: "Premio di polizza", items: premio });

  const documentazione: SummaryItem[] = [];
  pushItem(documentazione, "vies_zip_file", "Pacchetto ZIP", str("vies_zip_file") ?? "Nessuno ZIP collegato");
  pushItem(documentazione, "vies_documenti_zip", "Documenti nello ZIP", str("vies_documenti_zip"));
  const vatCheck = str("vies_verifica_piva");
  pushItem(documentazione, "vies_verifica_piva", "Verifica P.IVA", vatCheck ? VIES_VAT_CHECK_LABELS[vatCheck] ?? vatCheck : null);
  pushItem(documentazione, "vies_piva_trovate", "P.IVA trovate nei documenti", listOrNull(f.vies_piva_trovate));
  pushItem(
    documentazione,
    "vies_documenti_mancanti",
    "Documenti mancanti (controllo sul nome file)",
    listOrNull(f.vies_documenti_mancanti) ?? (str("vies_zip_file") ? "Nessuno" : null),
  );
  pushItem(documentazione, "vies_avvisi", "Avvisi di validazione", listOrNull(f.vies_avvisi));
  pushItem(documentazione, "vies_riga_excel", "Riga Excel / colonna ZIP", str("vies_riga_excel"));
  pushItem(documentazione, "vies_batch_id", "Lotto VIES", str("vies_batch_id"));
  sections.push({ id: "documentazione", title: "Documentazione e controlli", items: documentazione });

  const excel: SummaryItem[] = [];
  const raw = f.vies_dati_excel;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [header, value] of Object.entries(raw as Record<string, unknown>)) {
      pushItem(excel, `vies_excel_${header}`, header, toStringOrNull(value));
    }
  }
  if (excel.length) sections.push({ id: "dati_excel", title: "Dati Excel originali", items: excel });

  return { practice_type: "vies", practice_type_label: PRACTICE_TYPE_LABELS.vies, sections, pet: null };
}

/**
 * Costruisce il riepilogo completo della pratica: contraente, polizza,
 * dati specifici della tipologia (con etichette leggibili), coperture e premio.
 */
export function buildPracticeSummary(input: PracticeSummaryInput): PracticeSummary {
  if (input.practice_type === "vies") return buildViesSummary(input);
  const practiceType = input.practice_type ?? null;
  const fields = input.specific_fields ?? {};
  const sections: SummarySection[] = [];

  // 1. Contraente
  const contraente: SummaryItem[] = [];
  pushItem(contraente, "client_name", "Nome / Ragione Sociale", input.client_name);
  pushItem(contraente, "owner_tax_code", practiceType === "pet" ? "Codice Fiscale Proprietario" : "Codice Fiscale / P.IVA", input.owner_tax_code ?? toStringOrNull(fields.owner_tax_code));
  pushItem(contraente, "client_email", "Email", input.client_email);
  pushItem(contraente, "client_phone", "Telefono", input.client_phone);
  pushItem(contraente, "client_address", "Indirizzo", toStringOrNull(fields.client_address) ?? toStringOrNull(fields.address));
  pushItem(contraente, "beneficiary", "Beneficiario", input.beneficiary);
  if (contraente.length) sections.push({ id: "contraente", title: "Contraente", items: contraente });

  // 2. Polizza
  const polizza: SummaryItem[] = [];
  pushItem(polizza, "practice_type", "Tipologia", PRACTICE_TYPE_LABELS[practiceType ?? ""] ?? practiceType);
  pushItem(polizza, "policy_number", "Numero Polizza", input.policy_number);
  pushItem(polizza, "policy_start_date", "Decorrenza", formatDateIt(input.policy_start_date));
  pushItem(polizza, "policy_end_date", "Scadenza", formatDateIt(input.policy_end_date));
  pushItem(polizza, "duration", "Durata", formatPolicyDuration(input.policy_start_date, input.policy_end_date));
  if (polizza.length) sections.push({ id: "polizza", title: "Polizza", items: polizza });

  const consumedKeys = new Set<string>(["owner_tax_code", "client_address", "address"]);

  // 3. Pet: animale e coperture
  const pet = buildPetSummary(input);
  if (pet) {
    const animale: SummaryItem[] = [];
    pushItem(animale, "pet_name", "Nome Animale", pet.name);
    pushItem(animale, "pet_species", "Specie", pet.species ? PET_ANIMAL_TYPE_LABELS[pet.species.toLowerCase()] ?? pet.species : null);
    pushItem(animale, "animal_type", "Categoria Tariffaria", pet.animal_type_label);
    pushItem(animale, "pet_breed", "Razza", pet.breed);
    pushItem(animale, "pet_birth_date", "Data di Nascita", formatDateIt(pet.birth_date));
    pushItem(animale, "pet_age", "Età", toStringOrNull(fields.pet_age));
    pushItem(animale, "pet_gender", "Sesso", pet.gender ? formatFieldValue("pet", "pet_gender", pet.gender) : null);
    pushItem(animale, "pet_microchip", "Numero Microchip", pet.microchip);
    pushItem(animale, "pet_sterilized", "Sterilizzato", pet.sterilized === null ? null : pet.sterilized ? "Sì" : "No");
    pushItem(animale, "pet_weight", "Peso", pet.weight_kg !== null ? `${pet.weight_kg} kg` : null);
    pushItem(animale, "pet_previous_diseases", "Malattie Pregresse", pet.previous_diseases);
    if (animale.length) sections.push({ id: "animale", title: "Animale Assicurato", items: animale });
    PET_ANIMAL_FIELD_ORDER.forEach((k) => consumedKeys.add(k));

    const coperture: SummaryItem[] = [];
    pushItem(coperture, "coverage_type", "Coperture Richieste", pet.coverage_type_label);
    pushItem(coperture, "plan_name", "Piano", toStringOrNull(fields.plan_name) ?? toStringOrNull(fields.plan_id));
    pet.coverages.forEach((c) => {
      pushItem(coperture, `coverage_${c.id}`, c.category_label, `${c.name} (${formatCurrency(c.price)}/anno)`);
    });
    if (pet.total_annual !== null) pushItem(coperture, "total_annual", "Premio Annuale", formatCurrency(pet.total_annual));
    if (pet.total_monthly !== null) pushItem(coperture, "total_monthly", "Premio Mensile", formatCurrency(pet.total_monthly));
    if (coperture.length) sections.push({ id: "coperture", title: "Coperture e Preventivo", items: coperture });
    PET_QUOTE_FIELDS.forEach((k) => consumedKeys.add(k));
  }

  // 4. Altri dati specifici della tipologia (ordinati come nel form, poi extra)
  const definitions = getFieldDefinitions(practiceType);
  const specifici: SummaryItem[] = [];
  const orderedKeys = [
    ...definitions.map((d) => d.name),
    ...Object.keys(fields).filter((k) => !definitions.some((d) => d.name === k)),
  ];
  for (const key of orderedKeys) {
    if (consumedKeys.has(key)) continue;
    if (!(key in fields)) continue;
    pushItem(specifici, key, getSpecificFieldLabel(practiceType, key), formatFieldValue(practiceType, key, fields[key]));
  }
  if (specifici.length) {
    sections.push({
      id: "dati_specifici",
      title: `Dati Specifici ${PRACTICE_TYPE_LABELS[practiceType ?? ""] ?? ""}`.trim(),
      items: specifici,
    });
  }

  // 5. Premio
  const premio: SummaryItem[] = [];
  if (input.premium_net !== null && input.premium_net !== undefined) pushItem(premio, "premium_net", "Premio Netto", formatCurrency(input.premium_net));
  if (input.premium_taxable !== null && input.premium_taxable !== undefined) pushItem(premio, "premium_taxable", "Imponibile", formatCurrency(input.premium_taxable));
  if (input.premium_taxes !== null && input.premium_taxes !== undefined) pushItem(premio, "premium_taxes", "Imposte", formatCurrency(input.premium_taxes));
  if (input.premium_gross !== null && input.premium_gross !== undefined) pushItem(premio, "premium_gross", "Premio Lordo", formatCurrency(input.premium_gross));
  if (premio.length) sections.push({ id: "premio", title: "Premio", items: premio });

  return {
    practice_type: practiceType,
    practice_type_label: PRACTICE_TYPE_LABELS[practiceType ?? ""] ?? practiceType ?? "",
    sections,
    pet,
  };
}
