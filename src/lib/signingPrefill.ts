// Documenti da firmare compilati con i dati che il portale ha gia' della pratica.
//
// Il documento da firmare (MUP unico: MUP, incarico, raccomandazione, consegna, privacy, antiriciclaggio) e' un PDF su carta intestata Tecno Advance MGA, generato da
// scripts/signing-templates/build.mjs in public/modelli-firma/ insieme a fields.json, che dice dove sta ogni
// campo precompilabile (pagina, posizione, misura). Qui si calcolano i valori e si scrivono sul modello.
// Cio' che il portale non sa resta in bianco: lo compila chi firma.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { extractNotesSections } from "./practiceSummary";
import { isValidChineseId } from "./viesCodes";

export type PrefillDocument = "mup";
export type PrefillValues = Record<string, string>;

/** Dati della pratica che servono a compilare i modelli. */
export interface PrefillPractice {
  practice_number: string;
  policy_number?: string | null;
  client_name: string;
  client_email?: string | null;
  owner_tax_code?: string | null;
  beneficiary?: string | null;
  notes?: string | null;
}

/** Dati letti dai documenti dello ZIP (licenza commerciale, documento del legale rappresentante, UBO). */
export interface AmlPerson {
  nome?: string;
  sesso?: string;
  data_nascita?: string;
  luogo_nascita?: string;
  nazione_nascita?: string;
  cittadinanza?: string;
  residenza?: string;
  residenza_nazione?: string;
  doc_numero?: string;
  doc_rilascio?: string;
  doc_scadenza?: string;
  doc_ente?: string;
}

export interface AmlOwner extends AmlPerson {
  quota?: string;
  controllo?: string;
}

export interface AmlData {
  contraente?: { forma_giuridica?: string; data_costituzione?: string; capitale?: string };
  rappresentante?: AmlPerson;
  titolari?: AmlOwner[];
}

export const PREFILL_PRODUCT = "Fideiussione VIES - art. 35, c. 7-quater, DPR 633/1972";
export const MAX_PREFILLED_OWNERS = 3;

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const isoToItalian = (year: string, month: string, day: string) => `${day}/${month}/${year}`;

/** Data di nascita e sesso scritti nel numero della carta d'identita' cinese (solo se il numero e' valido). */
export function readChineseId(value: string): { valid: boolean; birth: string; sex: string } {
  const code = value.replace(/\s+/g, "").toUpperCase();
  if (!isValidChineseId(code)) return { valid: false, birth: "", sex: "" };
  const year = code.slice(6, 10);
  const month = code.slice(10, 12);
  const day = code.slice(12, 14);
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const real = !Number.isNaN(date.getTime()) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day);
  return { valid: true, birth: real ? isoToItalian(year, month, day) : "", sex: Number(code[16]) % 2 === 1 ? "M" : "F" };
}

/** I valori da scrivere nei modelli, per chiave di campo (vedi fields.json). */
export function buildPrefillValues(practice: PrefillPractice, aml: AmlData = {}): PrefillValues {
  const fields = (extractNotesSections(practice.notes).specificFields ?? {}) as Record<string, unknown>;
  const uscc = text(fields.vies_uscc);
  const vat = text(practice.owner_tax_code);
  const taxCode = text(fields.vies_codice_fiscale_contraente);
  const representative = text(fields.vies_rappresentante_fiscale);
  const realPolicy = practice.policy_number && !/^VIES-/i.test(practice.policy_number) ? practice.policy_number : "";
  const chinese = Boolean(uscc);
  const idNumber = text(fields.vies_documento_legale_rappresentante).replace(/\s+/g, "").toUpperCase();
  const id = readChineseId(idNumber);
  const legal = aml.rappresentante ?? {};

  const values: PrefillValues = {
    polizza: realPolicy || practice.practice_number,
    email: text(fields.vies_email) || (practice.client_email && !/@placeholder\.local$/i.test(practice.client_email) ? practice.client_email : ""),
    dichiarante: text(fields.vies_amministratore_rappresentante) || representative,
    pratica: realPolicy ? `${practice.practice_number} · polizza ${realPolicy}` : practice.practice_number,
    contraente: text(practice.client_name),
    cf: [taxCode ? `C.F. ${taxCode}` : "", vat && vat !== taxCode ? `P.IVA ${vat}` : "", uscc ? `USCC ${uscc}` : ""].filter(Boolean).join(" · "),
    prodotto: PREFILL_PRODUCT,
    firmatario: representative,
    firmatario_cf: text(fields.vies_codice_fiscale_rappresentante),
    qualita: representative ? "Rappresentante fiscale con procura speciale" : "",
    forma: text(aml.contraente?.forma_giuridica),
    sede: text(fields.vies_sede_contraente),
    sede_nazione: chinese ? "Cina" : "",
    costituzione: text(aml.contraente?.data_costituzione),
    registro: uscc ? `USCC ${uscc}` : "",
    paese_attivita: chinese ? "Cina" : "",
    beneficiario: text(practice.beneficiary),
    beneficiario_cf: text(fields.vies_codice_fiscale_beneficiario),
    lr_nome: text(fields.vies_legale_rappresentante) || text(legal.nome),
    lr_sesso: text(legal.sesso) || id.sex,
    lr_nascita: text(legal.data_nascita) || id.birth || text(fields.vies_data_nascita_legale_rappresentante),
    lr_luogo: text(legal.luogo_nascita),
    lr_nazione_nascita: text(legal.nazione_nascita),
    lr_cittadinanza: text(legal.cittadinanza) || (id.valid ? "Cinese" : ""),
    lr_residenza: text(legal.residenza),
    lr_residenza_nazione: text(legal.residenza_nazione),
    lr_professione: text(fields.vies_legale_rappresentante) ? "Legale rappresentante" : "",
    lr_paese_attivita: chinese ? "Cina" : "",
    lr_doc_tipo: id.valid ? "Carta d'identità cinese" : "",
    // Il numero del file Excel, se valido, vale piu' di quello letto dal documento.
    lr_doc_numero: id.valid ? idNumber : text(legal.doc_numero) || idNumber,
    lr_doc_rilascio: text(legal.doc_rilascio),
    lr_doc_scadenza: text(legal.doc_scadenza),
    lr_doc_ente: text(legal.doc_ente),
  };

  (aml.titolari ?? []).slice(0, MAX_PREFILLED_OWNERS).forEach((owner, index) => {
    const prefix = `te${index + 1}_`;
    Object.assign(values, {
      [`${prefix}nome`]: text(owner.nome),
      [`${prefix}sesso`]: text(owner.sesso),
      [`${prefix}nascita`]: text(owner.data_nascita),
      [`${prefix}luogo`]: text(owner.luogo_nascita),
      [`${prefix}nazione_nascita`]: text(owner.nazione_nascita),
      [`${prefix}cittadinanza`]: text(owner.cittadinanza),
      [`${prefix}residenza`]: text(owner.residenza),
      [`${prefix}residenza_nazione`]: text(owner.residenza_nazione),
      [`${prefix}doc_numero`]: text(owner.doc_numero),
      [`${prefix}doc_rilascio`]: text(owner.doc_rilascio),
      [`${prefix}doc_scadenza`]: text(owner.doc_scadenza),
      [`${prefix}doc_ente`]: text(owner.doc_ente),
      [`${prefix}nascita_luogo`]: [text(owner.luogo_nascita), text(owner.data_nascita)].filter(Boolean).join(", "),
      [`${prefix}quota`]: [text(owner.quota), text(owner.controllo)].filter(Boolean).join(" · "),
    });
  });

  for (const key of Object.keys(values)) if (!values[key]) delete values[key];
  return values;
}

// ---------------------------------------------------------------------------------------------------
// Scrittura sul PDF
// ---------------------------------------------------------------------------------------------------

export interface TemplateField {
  key: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateSource {
  pdf: (document: PrefillDocument) => Promise<Uint8Array>;
  fields: () => Promise<Record<PrefillDocument, TemplateField[]>>;
}

/** Modelli serviti dal portale (public/modelli-firma). */
export const publicTemplateSource = (base = "/modelli-firma"): TemplateSource => {
  let fields: Promise<Record<PrefillDocument, TemplateField[]>> | null = null;
  return {
    pdf: async (document) => {
      const response = await fetch(`${base}/${document}.pdf`);
      if (!response.ok) throw new Error(`template ${document} not found`);
      return new Uint8Array(await response.arrayBuffer());
    },
    fields: () => {
      fields ??= fetch(`${base}/fields.json`).then((response) => {
        if (!response.ok) throw new Error("template fields not found");
        return response.json();
      });
      return fields;
    },
  };
};

const INK = rgb(0.05, 0.12, 0.45);
const MAX_SIZE = 9;
const MIN_SIZE = 5.5;

/** Tiene solo i caratteri che il carattere standard del PDF sa scrivere (niente ideogrammi). */
export function printable(font: PDFFont, value: string) {
  const supported = new Set(font.getCharacterSet());
  const cleaned = Array.from(value.normalize("NFC"))
    .map((char) => (char === "\n" || char === "\t" ? " " : char))
    .filter((char) => supported.has(char.codePointAt(0) ?? 0))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function fitText(font: PDFFont, value: string, width: number) {
  let size = MAX_SIZE;
  while (size > MIN_SIZE && font.widthOfTextAtSize(value, size) > width) size -= 0.5;
  let shown = value;
  while (shown.length > 1 && font.widthOfTextAtSize(shown, size) > width) shown = `${shown.slice(0, -2)}…`.replace("……", "…");
  return { size, shown };
}

/** Scrive i valori sul modello. I campi senza valore restano in bianco. */
export async function fillSigningDocument(
  document: PrefillDocument,
  values: PrefillValues,
  source: TemplateSource = publicTemplateSource(),
): Promise<Blob> {
  const [bytes, map] = await Promise.all([source.pdf(document), source.fields()]);
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  for (const field of map[document] ?? []) {
    const value = printable(font, values[field.key] ?? "");
    const page = pages[field.page];
    if (!value || !page) continue;
    const { size, shown } = fitText(font, value, field.w - 4);
    // Il riquadro del campo arriva fino alla riga: il testo sta appena sopra.
    page.drawText(shown, { x: field.x + 2, y: field.y + 3.4, size, font, color: INK });
  }
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}
