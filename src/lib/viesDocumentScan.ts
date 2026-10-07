// Deterministic content checks for VIES documents: identifiers found in the
// text of each PDF (Italian P.IVA and codice fiscale, Chinese Unified Social
// Credit Code) and the representation company's visura. Every identifier is
// accepted only if its check character is valid. Scanned PDFs yield no text:
// they are reported as unreadable here and left to the document agent.

import { extractPdfText } from "./pdfText";

export const isValidItalianVat = (value: string) => {
  if (!/^\d{11}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    let digit = Number(value[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
};

const TAX_CODE_ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const taxCodeEvenValue = (char: string) => (/\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65);
const PERSON_TAX_CODE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

// Codice fiscale: 16 characters for a person, 11 digits (same check as the P.IVA) for an entity.
export const isValidItalianTaxCode = (value: string) => {
  const code = value.replace(/\s+/g, "").toUpperCase();
  if (/^\d{11}$/.test(code)) return isValidItalianVat(code);
  if (!PERSON_TAX_CODE.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    sum += index % 2 === 0 ? TAX_CODE_ODD[code[index]] : taxCodeEvenValue(code[index]);
  }
  return String.fromCharCode(65 + (sum % 26)) === code[15];
};

// Unified Social Credit Code of Chinese companies (GB 32100-2015).
const USCC_CHARSET = "0123456789ABCDEFGHJKLMNPQRTUWXY";
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

export const isValidUscc = (value: string) => {
  const code = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < 17; index += 1) sum += USCC_CHARSET.indexOf(code[index]) * USCC_WEIGHTS[index];
  return USCC_CHARSET[(31 - (sum % 31)) % 31] === code[17];
};

export const normalizeUscc = (value: unknown) => String(value ?? "").replace(/\s+/g, "").toUpperCase();

// Excel stores a P.IVA typed as a number without its leading zeros.
export const normalizeItalianVat = (value: unknown) => {
  const digits = String(value ?? "").replace(/\s+/g, "").replace(/^IT/i, "");
  return /^\d{9,10}$/.test(digits) ? digits.padStart(11, "0") : digits;
};

// ---------------------------------------------------------------------------
// Identifiers in a document
// ---------------------------------------------------------------------------

export interface DocumentIdentifiers {
  vatNumbers: string[];
  usccs: string[];
  taxCodes: string[];
}

export const findIdentifiers = (lines: string[]): DocumentIdentifiers => {
  const text = lines.join("\n").toUpperCase();
  const unique = (values: Iterable<string>) => [...new Set(values)];
  return {
    vatNumbers: unique([...text.matchAll(/(?<!\d)\d{11}(?!\d)/g)].map((m) => m[0]).filter(isValidItalianVat)),
    usccs: unique([...text.matchAll(/(?<![0-9A-Z])[0-9A-Z]{18}(?![0-9A-Z])/g)].map((m) => m[0]).filter(isValidUscc)),
    taxCodes: unique(
      [...text.matchAll(/(?<![0-9A-Z])[A-Z0-9]{16}(?![0-9A-Z])/g)]
        .map((m) => m[0])
        .filter((code) => PERSON_TAX_CODE.test(code) && isValidItalianTaxCode(code)),
    ),
  };
};

export interface PdfScan extends DocumentIdentifiers {
  readable: boolean;
  hasText: boolean;
  pages: number;
  lines: string[];
}

export const scanPdf = async (bytes: Uint8Array): Promise<PdfScan> => {
  const { lines, pages, readable } = await extractPdfText(bytes);
  const textLength = lines.join("").replace(/\s+/g, "").length;
  return { readable, pages, lines, hasText: textLength > 40 * Math.max(pages, 1), ...findIdentifiers(lines) };
};

// ---------------------------------------------------------------------------
// Visura camerale (Registro Imprese / InfoCamere)
// ---------------------------------------------------------------------------

export type VisuraAdministrator = {
  role: string;
  name: string;
  taxCode: string | null;
  legalRepresentative: boolean;
};

export type VisuraData = {
  denominazione: string | null;
  codiceFiscale: string | null;
  sedeLegale: string | null;
  pec: string | null;
  documento: string | null;
  dataEstrazione: string | null;
  amministratori: VisuraAdministrator[];
};

const SEDE_STOP = /^(Telefono|Domicilio digitale|E-?mail|Partita IVA|Numero (REA|repertorio)|Codice fiscale|Forma giuridica|Data )/i;
const LEGAL_REPRESENTATIVE_MARK = /\s*Rappresentante dell'impresa\s*/i;
const ROLE_PRIORITY = [/amministratore unico/i, /presidente/i, /amministratore delegato/i];

const cleanAddress = (value: string) =>
  value
    .replace(/\s+DAL \d{2}\/\d{2}\/\d{4}.*$/i, "")
    .replace(/\s+IVI\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const EMPTY_VISURA: VisuraData = {
  denominazione: null,
  codiceFiscale: null,
  sedeLegale: null,
  pec: null,
  documento: null,
  dataEstrazione: null,
  amministratori: [],
};

export const parseVisura = (lines: string[]): VisuraData => {
  const text = lines.join("\n");
  if (!/Registro Imprese/i.test(text) || !/Codice Fiscale\s+\d{11}/i.test(text)) return { ...EMPTY_VISURA };

  const codiceFiscale = text.match(/Codice Fiscale\s+(\d{11})/i)?.[1] ?? null;
  const documento = text.match(/Documento n\s*\.\s*([A-Z]\s*[A-Z0-9]+)/)?.[1]?.replace(/\s+/g, " ") ?? null;
  const dataEstrazione = text.match(/estratto dal Registro Imprese in data (\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
  const pec = text.match(/Domicilio digitale\/PEC\s*\n?\s*([^\s@]+@[^\s@]+\.[A-Za-z]{2,})/i)?.[1] ?? null;

  // Company name: the page header "Registro Imprese <NAME>", continued on the
  // line after "Archivio ufficiale della CCIAA" when it wraps.
  let denominazione: string | null = null;
  const headerIndex = lines.findIndex((line) => /^Registro Imprese\s+\S/i.test(line) && !/Archivio/i.test(line));
  if (headerIndex >= 0) {
    const parts = [lines[headerIndex].replace(/^Registro Imprese\s+/i, "")];
    const next = lines[headerIndex + 1];
    const continuation = lines[headerIndex + 2];
    if (next && /^Archivio ufficiale/i.test(next) && continuation && !/^(Documento n|Visura|estratto)/i.test(continuation)) {
      parts.push(continuation);
    }
    denominazione = parts
      .join(" ")
      .replace(/\s*Codice Fiscale\s+\d{11}.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    const titleIndex = lines.findIndex((line) => /^DATI ANAGRAFICI$/i.test(line));
    const candidate = titleIndex >= 0 ? lines[titleIndex + 1] : undefined;
    if (candidate && !/Indirizzo/i.test(candidate)) denominazione = candidate;
  }

  // Registered office: the last "Indirizzo Sede legale" (detailed section),
  // continued on the following lines until the next label.
  let sedeLegale: string | null = null;
  let sedeIndex = -1;
  lines.forEach((line, index) => {
    if (/^Indirizzo Sede legale/i.test(line)) sedeIndex = index;
  });
  if (sedeIndex >= 0) {
    const parts = [lines[sedeIndex].replace(/^Indirizzo Sede legale\s*/i, "")];
    if (!/CAP \d{5}/.test(parts[0])) {
      for (const line of lines.slice(sedeIndex + 1, sedeIndex + 4)) {
        if (SEDE_STOP.test(line)) break;
        parts.push(line);
        if (/CAP \d{5}/.test(line)) break;
      }
    }
    sedeLegale = cleanAddress(parts.join(" ")) || null;
  }

  // Administrators: the last "N Amministratori" heading (the first one is the
  // table of contents), up to the next numbered section.
  let sectionStart = -1;
  lines.forEach((line, index) => {
    if (/^\d+\s+Amministratori$/i.test(line)) sectionStart = index;
  });
  const sectionEnd =
    sectionStart >= 0 ? lines.findIndex((line, index) => index > sectionStart && /^\d+\s+[A-Z]/.test(line)) : -1;
  const section = sectionStart >= 0 ? lines.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined) : [];
  const listStart = Math.max(0, section.findIndex((line) => /^Elenco amministratori$/i.test(line)));

  const amministratori: VisuraAdministrator[] = [];
  let previousEnd = listStart;
  section.forEach((line, index) => {
    const born = line.match(/^(.*?)\s*\bNat[oa] a\b/i);
    if (!born || index <= listStart) return;
    let name = born[1].trim();
    let roleEnd = index;
    if (!name) {
      name = section[index - 1] ?? "";
      roleEnd = index - 1;
    }
    const legalRepresentative = LEGAL_REPRESENTATIVE_MARK.test(name);
    name = name.replace(LEGAL_REPRESENTATIVE_MARK, " ").replace(/\s+/g, " ").trim();
    // The role is the line right above the name ("Consigliera", "Amministratore
    // Unico"), or two lines when it wraps ("Presidente Consiglio" / "Amministrazione").
    const roleLines = section
      .slice(previousEnd + 1, roleEnd)
      .filter((part) => !/^(Codice fiscale|domicilio|carica|Data |Durata|poteri|Telefono|Indirizzo|Paese|Registro Imprese|Archivio|Documento n|estratto|Visura)/i.test(part))
      .filter((part) => part !== part.toUpperCase() || part.length < 3);
    const lastRole = roleLines[roleLines.length - 1] ?? "";
    const role = (/^Amministrazione$/i.test(lastRole) ? roleLines.slice(-2) : [lastRole]).join(" ").trim();
    const taxCodeLine = section.slice(index, index + 4).find((next) => /Codice fiscale:/i.test(next));
    const taxCode = taxCodeLine?.replace(/^.*Codice fiscale:\s*/i, "").replace(/\s+/g, "").toUpperCase() || null;
    if (name && !amministratori.some((admin) => admin.name === name)) {
      amministratori.push({ role, name, taxCode, legalRepresentative });
    }
    const end = section.findIndex((next, nextIndex) => nextIndex > index && /Codice fiscale:/i.test(next));
    previousEnd = end >= 0 ? end : index;
  });

  return { denominazione, codiceFiscale, sedeLegale, pec, documento, dataEstrazione, amministratori };
};

// The administrator who represents the company: the one marked "Rappresentante
// dell'impresa", else sole administrator, chairman, managing director, else the first.
export const pickLegalRepresentative = (amministratori: VisuraAdministrator[]) => {
  const marked = amministratori.findIndex((admin) => admin.legalRepresentative);
  if (marked >= 0) return marked;
  for (const role of ROLE_PRIORITY) {
    const index = amministratori.findIndex((admin) => role.test(admin.role));
    if (index >= 0) return index;
  }
  return amministratori.length ? 0 : -1;
};
