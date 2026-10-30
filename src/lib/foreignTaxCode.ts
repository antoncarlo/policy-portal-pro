// Codice fiscale italiano di una persona nata all'estero, calcolato con le regole del DM 23/12/1976: cognome, nome,
// data di nascita e sesso, e al posto del comune il codice dello Stato estero di nascita (Cina: Z210). È il codice
// che l'Agenzia delle Entrate attribuirebbe salvo omocodie: chi lo usa sa che è calcolato, non attribuito.

/** Codice dello Stato estero di nascita per la Repubblica Popolare Cinese. */
export const CHINA_STATE_CODE = "Z210";

const VOWELS = "AEIOU";
const MONTHS = "ABCDEHLMPRST";
const ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

/** Only the letters, upper case and without accents (J, K, W, X and Y count as consonants). */
const letters = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

const split = (text: string) => {
  const all = letters(text);
  return { consonants: [...all].filter((c) => !VOWELS.includes(c)), vowels: [...all].filter((c) => VOWELS.includes(c)) };
};

const surnamePart = (surname: string) => {
  const { consonants, vowels } = split(surname);
  return [...consonants, ...vowels, "X", "X", "X"].slice(0, 3).join("");
};

const namePart = (name: string) => {
  const { consonants, vowels } = split(name);
  if (consonants.length >= 4) return consonants[0] + consonants[2] + consonants[3];
  return [...consonants, ...vowels, "X", "X", "X"].slice(0, 3).join("");
};

const value = (character: string, odd: boolean) => {
  const digit = /\d/.test(character);
  const index = digit ? Number(character) : character.charCodeAt(0) - 65;
  return odd ? ODD[index] : index;
};

export interface ForeignTaxCodeInput {
  surname: string;
  givenNames: string;
  /** "M" or "F". */
  sex: string;
  /** GG/MM/AAAA. */
  birthDate: string;
  /** Codice dello Stato estero di nascita (es. Z210). */
  stateCode: string;
}

/** The tax code, or "" when a datum it needs is missing or invalid. */
export function foreignTaxCode({ surname, givenNames, sex, birthDate, stateCode }: ForeignTaxCodeInput): string {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthDate.trim());
  if (!date || !letters(surname) || !letters(givenNames) || !/^[A-Z]\d{3}$/.test(stateCode) || (sex !== "M" && sex !== "F")) return "";
  const [, day, month, year] = date;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return "";
  const partial = `${surnamePart(surname)}${namePart(givenNames)}${year.slice(2)}${MONTHS[Number(month) - 1]}${String(Number(day) + (sex === "F" ? 40 : 0)).padStart(2, "0")}${stateCode}`;
  const total = [...partial].reduce((sum, character, index) => sum + value(character, index % 2 === 0), 0);
  return partial + String.fromCharCode(65 + (total % 26));
}
