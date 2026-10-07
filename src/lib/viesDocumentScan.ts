import { unzlibSync, inflateSync } from "fflate";

// Deterministic content checks for VIES documents. Only PDFs with a text layer
// can be read here; scanned PDFs yield no text and are reported as unreadable,
// never as verified.

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

// Codice fiscale: 16 characters for a person, 11 digits (same check as the P.IVA) for an entity.
export const isValidItalianTaxCode = (value: string) => {
  const code = value.replace(/\s+/g, "").toUpperCase();
  if (/^\d{11}$/.test(code)) return isValidItalianVat(code);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    sum += index % 2 === 0 ? TAX_CODE_ODD[code[index]] : taxCodeEvenValue(code[index]);
  }
  return String.fromCharCode(65 + (sum % 26)) === code[15];
};

// Excel stores a P.IVA typed as a number without its leading zeros.
export const normalizeItalianVat = (value: unknown) => {
  const digits = String(value ?? "").replace(/\s+/g, "").replace(/^IT/i, "");
  return /^\d{9,10}$/.test(digits) ? digits.padStart(11, "0") : digits;
};

const latin1 = new TextDecoder("latin1");
const STREAM_KEYWORD = /stream\r?\n/g;
const NON_TEXT_STREAM = /\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode|\/JBIG2Decode|\/Length1|\/Type\s*\/XRef|\/Type\s*\/Metadata/;
const PDF_STRING_LITERAL = /\((?:\\.|[^\\()])*\)/g;
const ELEVEN_DIGITS = /(?<!\d)\d{11}(?!\d)/g;

const inflate = (data: Uint8Array): Uint8Array | null => {
  try {
    return unzlibSync(data);
  } catch {
    try {
      return inflateSync(data.subarray(2));
    } catch {
      return null;
    }
  }
};

// Yields the decoded content of every stream that can carry text.
function* decodedContentStreams(bytes: Uint8Array): Generator<string> {
  const raw = latin1.decode(bytes);
  const keyword = new RegExp(STREAM_KEYWORD.source, "g");
  for (let match = keyword.exec(raw); match; match = keyword.exec(raw)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) return;

    const objectStart = raw.lastIndexOf(" obj", match.index);
    const dictionary = raw.slice(Math.max(0, objectStart, match.index - 2000), match.index);
    const hasFilter = /\/Filter/.test(dictionary);
    if (!NON_TEXT_STREAM.test(dictionary) && (!hasFilter || /\/FlateDecode/.test(dictionary))) {
      const decoded = hasFilter ? inflate(bytes.subarray(start, end)) : bytes.subarray(start, end);
      if (decoded) yield latin1.decode(decoded);
    }
    keyword.lastIndex = end + "endstream".length;
  }
}

const unescapePdfLiteral = (literal: string) =>
  literal
    .slice(1, -1)
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\(.)/g, "$1");

export type PdfTextScan = {
  hasText: boolean;
  vatNumbers: string[];
};

export const scanPdfForVatNumbers = (bytes: Uint8Array): PdfTextScan => {
  const vatNumbers = new Set<string>();
  let textLength = 0;

  for (const content of decodedContentStreams(bytes)) {
    const text = (content.match(PDF_STRING_LITERAL) ?? []).map((literal) => literal.slice(1, -1)).join("");
    textLength += text.trim().length;
    for (const candidate of text.match(ELEVEN_DIGITS) ?? []) {
      if (isValidItalianVat(candidate)) vatNumbers.add(candidate);
    }
  }

  return { hasText: textLength > 200, vatNumbers: [...vatNumbers] };
};

// Text of a text-layer PDF, one entry per text line (split on text positioning).
export const extractPdfTextLines = (bytes: Uint8Array): string[] => {
  const lines: string[] = [];
  const token = /\((?:\\.|[^\\()])*\)|\bT[dD*]\b|\bTm\b|\bET\b|\bBT\b|'/g;
  for (const content of decodedContentStreams(bytes)) {
    let current = "";
    for (const match of content.matchAll(token)) {
      if (match[0].startsWith("(")) {
        current += unescapePdfLiteral(match[0]);
      } else if (current) {
        lines.push(current);
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Visura camerale (Registro Imprese / InfoCamere)
// ---------------------------------------------------------------------------

export type VisuraAdministrator = {
  role: string;
  name: string;
  taxCode: string | null;
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

const VISURA_PAGE_HEADER = /^(Registro Imprese|Archivio ufficiale della CCIAA|Documento n|estratto dal Registro Imprese|Visura |Codice Fiscale \d{11}$|\d{1,3}$)/i;
const VISURA_LABELS = /^(Domicilio digitale\/PEC|Numero REA|Codice fiscale e n|Partita IVA|Forma giuridica)/i;
const LEGAL_REPRESENTATIVE_ROLES = [
  /amministratore unico/i,
  /presidente/i,
  /amministratore delegato/i,
  /legale rappresentante|rappresentante dell'impresa/i,
];

export const parseVisura = (lines: string[]): VisuraData => {
  const headerIndex = lines.findIndex((line) => /^Codice Fiscale \d{11}$/.test(line));
  const codiceFiscale =
    headerIndex >= 0 ? lines[headerIndex].replace(/\D/g, "") : lines.join(" ").match(/Registro Imprese\s+(\d{11})/)?.[1] ?? null;
  const denominazione = headerIndex > 0 && !VISURA_PAGE_HEADER.test(lines[headerIndex - 1]) ? lines[headerIndex - 1] : null;

  const joined = lines.join("\n");
  const documento = joined.match(/Documento n\s*\.\s*(T\s*\d+)/)?.[1] ?? null;
  const dataEstrazione = joined.match(/estratto dal Registro Imprese in data (\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;

  let sedeLegale: string | null = null;
  const sedeIndex = lines.findIndex((line) => /^Indirizzo Sede legale$/i.test(line));
  if (sedeIndex >= 0) {
    const parts: string[] = [];
    for (const line of lines.slice(sedeIndex + 1, sedeIndex + 6)) {
      if (VISURA_LABELS.test(line)) break;
      parts.push(line);
    }
    sedeLegale =
      parts
        .join(" ")
        .replace(/\s+DAL \d{2}\/\d{2}\/\d{4}$/i, "")
        .replace(/\s+IVI$/i, "")
        .trim() || null;
  }

  const pecIndex = lines.findIndex((line) => /^Domicilio digitale\/PEC$/i.test(line));
  const pecCandidate = pecIndex >= 0 ? lines[pecIndex + 1] : undefined;
  const pec = pecCandidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pecCandidate) ? pecCandidate : null;

  // Only the "Amministratori" section: from its numbered heading to the next one.
  // The heading also appears in the table of contents, so take the last occurrence.
  let sectionStart = -1;
  lines.forEach((line, index) => {
    if (/^\d+\s+Amministratori$/i.test(line)) sectionStart = index;
  });
  const sectionEnd =
    sectionStart >= 0 ? lines.findIndex((line, index) => index > sectionStart && /^\d+\s+\S/.test(line) && !/^\d+\s*$/.test(line)) : -1;
  const section = sectionStart >= 0 ? lines.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined) : lines;

  const amministratori: VisuraAdministrator[] = [];
  section.forEach((line, index) => {
    if (!/^Nat[oa] a /i.test(line) || index < 2) return;
    const name = section[index - 1];
    const role = section[index - 2];
    if (VISURA_PAGE_HEADER.test(name) || VISURA_PAGE_HEADER.test(role)) return;
    const taxCodeLine = section.slice(index + 1, index + 4).find((next) => /^Codice fiscale:/i.test(next));
    const taxCode = taxCodeLine?.replace(/^Codice fiscale:\s*/i, "").replace(/\s+/g, "").toUpperCase() || null;
    if (!amministratori.some((admin) => admin.name === name && admin.taxCode === taxCode)) {
      amministratori.push({ role, name, taxCode });
    }
  });

  return { denominazione, codiceFiscale, sedeLegale, pec, documento, dataEstrazione, amministratori };
};

// The administrator who represents the company: sole administrator, chairman,
// managing director, otherwise the first one listed.
export const pickLegalRepresentative = (amministratori: VisuraAdministrator[]) => {
  for (const role of LEGAL_REPRESENTATIVE_ROLES) {
    const index = amministratori.findIndex((admin) => role.test(admin.role));
    if (index >= 0) return index;
  }
  return amministratori.length ? 0 : -1;
};
