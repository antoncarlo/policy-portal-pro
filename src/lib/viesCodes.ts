// Check-character validation of the identifiers used in VIES practices:
// Italian P.IVA and codice fiscale, Chinese Unified Social Credit Code and
// resident ID. Pure functions, usable both in the browser and on the server.

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
export const PERSON_TAX_CODE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

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

// Resident identity card number of the People's Republic of China (ISO 7064 MOD 11-2).
const CHINESE_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];

export const isValidChineseId = (value: string) => {
  const code = value.replace(/\s+/g, "").toUpperCase();
  if (!/^\d{17}[\dX]$/.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < 17; index += 1) sum += Number(code[index]) * CHINESE_ID_WEIGHTS[index];
  return "10X98765432"[sum % 11] === code[17];
};

export const normalizeUscc = (value: unknown) => String(value ?? "").replace(/\s+/g, "").toUpperCase();

// Excel stores a P.IVA typed as a number without its leading zeros.
export const normalizeItalianVat = (value: unknown) => {
  const digits = String(value ?? "").replace(/\s+/g, "").replace(/^IT/i, "");
  return /^\d{9,10}$/.test(digits) ? digits.padStart(11, "0") : digits;
};
