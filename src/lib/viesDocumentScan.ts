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

export type PdfTextScan = {
  hasText: boolean;
  vatNumbers: string[];
};

export const scanPdfForVatNumbers = (bytes: Uint8Array): PdfTextScan => {
  const raw = latin1.decode(bytes);
  const vatNumbers = new Set<string>();
  let textLength = 0;

  STREAM_KEYWORD.lastIndex = 0;
  for (let match = STREAM_KEYWORD.exec(raw); match; match = STREAM_KEYWORD.exec(raw)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;

    const objectStart = raw.lastIndexOf(" obj", match.index);
    const dictionary = raw.slice(Math.max(0, objectStart, match.index - 2000), match.index);
    const hasFilter = /\/Filter/.test(dictionary);
    if (!NON_TEXT_STREAM.test(dictionary) && (!hasFilter || /\/FlateDecode/.test(dictionary))) {
      const decoded = hasFilter ? inflate(bytes.subarray(start, end)) : bytes.subarray(start, end);
      if (decoded) {
        const content = latin1.decode(decoded);
        const text = (content.match(PDF_STRING_LITERAL) ?? []).map((literal) => literal.slice(1, -1)).join("");
        textLength += text.trim().length;
        for (const candidate of text.match(ELEVEN_DIGITS) ?? []) {
          if (isValidItalianVat(candidate)) vatNumbers.add(candidate);
        }
      }
    }
    STREAM_KEYWORD.lastIndex = end + "endstream".length;
  }

  return { hasText: textLength > 200, vatNumbers: [...vatNumbers] };
};
