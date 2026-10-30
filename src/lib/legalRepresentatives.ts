// Dati anagrafici dei legali rappresentanti di un lotto VIES, per la compagnia: un Excel a parte, nella cartella del
// lotto, con una riga per pratica. I dati vengono dalle letture dell'agent sui documenti d'identità dello ZIP (la carta
// d'identità cinese, la sua traduzione, o il passaporto): niente viene inventato, un dato che manca resta vuoto e la
// nota della riga dice cosa chiedere al cliente. Il codice fiscale è calcolato (vedi foreignTaxCode).

import { CHINA_STATE_CODE, foreignTaxCode } from "./foreignTaxCode.js";
import { isValidChineseId } from "./viesCodes.js";

/** What the document agent read on one identity document of the legal representative. */
export interface IdentityReading {
  fileName: string;
  surname: string;
  givenNames: string;
  sex: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  address: string;
  documentKind: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  authority: string;
}

/** The part of a reading of the document agent (vies-document-agent) used here. */
export interface AgentIdentityReading {
  document_type: string;
  contained_document_types?: string[];
  legal_representative_id_number: string;
  document_date: string;
  expiry_date: string;
  legal_representative_identity?: Partial<Record<
    | "surname" | "given_names" | "sex" | "birth_date" | "birth_place" | "nationality" | "residence_address"
    | "document_kind" | "document_number" | "issue_date" | "expiry_date" | "issuing_authority",
    string
  >>;
}

/** What the agent read on an identity document of the legal representative; null for any other document, or when nothing was read. */
export function identityReadingFromAgent(fileName: string, result: AgentIdentityReading): IdentityReading | null {
  const isIdentityFile = result.document_type === "documento_identita";
  if (!isIdentityFile && !(result.contained_document_types ?? []).includes("documento_identita")) return null;
  const details = result.legal_representative_identity ?? {};
  const field = (name: keyof typeof details) => text(details[name]);
  const reading: IdentityReading = {
    fileName,
    surname: field("surname"),
    givenNames: field("given_names"),
    sex: field("sex"),
    birthDate: field("birth_date"),
    birthPlace: field("birth_place"),
    nationality: field("nationality"),
    address: field("residence_address"),
    documentKind: field("document_kind"),
    documentNumber: field("document_number") || text(result.legal_representative_id_number),
    // The dates of the reading are the identity document's only when the file is just that document.
    issueDate: field("issue_date") || (isIdentityFile ? text(result.document_date) : ""),
    expiryDate: field("expiry_date") || (isIdentityFile ? text(result.expiry_date) : ""),
    authority: field("issuing_authority"),
  };
  const { fileName: _name, ...data } = reading;
  return Object.values(data).some(Boolean) ? reading : null;
}

export interface LegalRepresentativeRow {
  zip: string;
  company: string;
  vat: string;
  surname: string;
  givenNames: string;
  /** The name as in the Excel of the lot, when no document was read. */
  fullName: string;
  sex: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  taxCode: string;
  documentKind: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  authority: string;
  address: string;
  notes: string[];
}

export interface LotPracticeForRepresentative {
  zip: string;
  company: string;
  vat: string;
  /** Legal representative as written in the Excel of the lot. */
  excelName: string;
}

const CHINESE_ID_CARD = "Carta d'identità della Repubblica Popolare Cinese";
const PERMANENT = /^(illimitat[ao]|长期|長期|long[- ]?term|permanente?)$/i;
const LATIN = /^[\p{Script=Latin}\d\s.,'’"/#()\-–:;&]+$/u;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The first value among the readings, the Latin-script ones first when asked (the translation of a Chinese card). */
const pick = (readings: IdentityReading[], field: keyof IdentityReading, preferLatin = false) => {
  const values = readings.map((reading) => text(reading[field])).filter(Boolean);
  return (preferLatin ? values.find((value) => LATIN.test(value)) : undefined) ?? values[0] ?? "";
};

const normalizeSex = (value: string) => {
  const v = value.trim().toUpperCase();
  if (/^(M|MASCHIO|MALE|男)$/.test(v)) return "M";
  if (/^(F|FEMMINA|FEMALE|女)$/.test(v)) return "F";
  return "";
};

/** Date of birth (GG/MM/AAAA) and sex written in a Chinese identity card number with a valid check character. */
const fromChineseId = (number: string) => {
  const year = number.slice(6, 10);
  const month = number.slice(10, 12);
  const day = number.slice(12, 14);
  return { birthDate: `${day}/${month}/${year}`, sex: Number(number[16]) % 2 === 1 ? "M" : "F" };
};

const parseDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
};

const isHongKong = (value: string) => /hong\s*kong|香港/i.test(value);
const isMacao = (value: string) => /maca[ou]|澳門|澳门/i.test(value);

/** One row of the workbook for a practice, from the readings of the identity documents in its ZIP. */
export function legalRepresentativeRow(practice: LotPracticeForRepresentative, readings: IdentityReading[], today = new Date()): LegalRepresentativeRow {
  const base = { zip: practice.zip, company: practice.company, vat: practice.vat };
  if (readings.length === 0) {
    return {
      ...base, surname: "", givenNames: "", fullName: practice.excelName, sex: "", birthDate: "", birthPlace: "", nationality: "",
      taxCode: "", documentKind: "", documentNumber: "", issueDate: "", expiryDate: "", authority: "", address: "",
      notes: ["Documento d'identità non letto: dati da completare con il documento del legale rappresentante."],
    };
  }

  const notes: string[] = [];
  const surname = pick(readings, "surname", true).toUpperCase();
  const givenNames = pick(readings, "givenNames", true).toUpperCase();

  // A Chinese card number counts only with a valid check character; a passport number is kept as read.
  const numbers = readings.map((reading) => text(reading.documentNumber).replace(/\s+/g, "").toUpperCase()).filter(Boolean);
  const chineseId = numbers.find((number) => isValidChineseId(number)) ?? "";
  const misread = numbers.find((number) => /^\d{17}[\dX]$/.test(number) && !isValidChineseId(number));
  const passport = numbers.find((number) => !/^\d{17}[\dX]$/.test(number)) ?? "";
  const documentNumber = chineseId || passport;
  if (!chineseId && misread) notes.push(`Numero del documento letto non valido: ${misread} (cifra di controllo errata): da verificare sul documento.`);

  let sex = normalizeSex(pick(readings, "sex", true));
  let birthDate = pick(readings, "birthDate", true);
  if (chineseId) {
    const written = fromChineseId(chineseId);
    if (birthDate && birthDate !== written.birthDate) notes.push(`Data di nascita letta (${birthDate}) diversa da quella del numero della carta: vale ${written.birthDate}.`);
    birthDate = written.birthDate;
    sex = written.sex;
  }

  const birthPlace = pick(readings, "birthPlace", true);
  const nationalityRead = pick(readings, "nationality", true);
  const nationality = chineseId || /chin|cines|中国|中國/i.test(nationalityRead) ? "Cinese" : nationalityRead;
  const documentKind = chineseId ? CHINESE_ID_CARD : pick(readings, "documentKind", true);
  const issueDate = pick(readings, "issueDate", true);
  const expiryRead = pick(readings, "expiryDate", true);
  const expiryDate = PERMANENT.test(expiryRead) ? "illimitata" : expiryRead;
  const authority = pick(readings, "authority", true);
  const address = pick(readings, "address", true);

  if (chineseId) notes.push("Il numero della carta d'identità cinese è anche il codice di identificazione fiscale cinese.");
  const expiry = parseDate(expiryDate);
  if (expiry && expiry.getTime() < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) {
    notes.push(`Documento scaduto il ${expiryDate}: richiedere il documento rinnovato.`);
  }
  if (!address) notes.push("Residenza non riportata sul documento: da richiedere al cliente.");

  // The tax code needs the State of birth: China (Z210) for a Chinese card or a person born in mainland China.
  let taxCode = "";
  if (isHongKong(birthPlace) || isMacao(birthPlace)) {
    notes.push(`Nato a ${isHongKong(birthPlace) ? "Hong Kong" : "Macao"}: codice fiscale da calcolare con il codice Stato estero confermato dall'Agenzia delle Entrate.`);
  } else if (nationality === "Cinese") {
    taxCode = foreignTaxCode({ surname, givenNames, sex, birthDate, stateCode: CHINA_STATE_CODE });
    if (taxCode && !birthPlace) notes.push("Luogo di nascita non riportato sul documento: per il codice fiscale si è considerata la Cina (Z210).");
  } else {
    notes.push("Stato di nascita da confermare: codice fiscale non calcolato.");
  }

  return {
    ...base, surname, givenNames, fullName: [surname, givenNames].filter(Boolean).join(" ") || practice.excelName, sex, birthDate,
    birthPlace: birthPlace || (nationality === "Cinese" ? "Cina" : ""), nationality, taxCode, documentKind, documentNumber, issueDate,
    expiryDate, authority, address, notes,
  };
}

export const LEGAL_REPRESENTATIVE_HEADERS = [
  "N.", "ZIP / codice cliente", "Società (ragione sociale)", "P.IVA italiana", "Legale rappresentante – Cognome", "Nome",
  "Sesso", "Data di nascita", "Luogo / Stato di nascita", "Cittadinanza", "Codice fiscale italiano (calcolato)",
  "Tipo documento", "Numero documento", "Data rilascio", "Data scadenza", "Autorità di rilascio",
  "Indirizzo di residenza (dal documento)", "Note",
];
const WIDTHS = [5, 14, 40, 14, 18, 14, 7, 13, 18, 12, 20, 34, 22, 12, 12, 42, 60, 60];
const TECNO_BLUE = "FF103657";
const TECNO_BRONZE = "FFAC7E59";
const STRIPE = "FFF2F4F7";
const MISSING = "FFFFF4D6";
const HEADER_ROW = 8;
const LOGO_HEIGHT = 72;

/** Width and height of a PNG, from its header. */
const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return bytes.length > 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : { width: 1, height: 1 };
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

export interface WorkbookOptions {
  /** "Lotto 3 VIES – Dati anagrafici dei legali rappresentanti". */
  title: string;
  /** The Tecno Advance MGA logo (PNG), at the top left. */
  logo?: Uint8Array | null;
}

/** The workbook (.xlsx bytes): logo, title, how the data were obtained, one row per practice. */
export async function buildLegalRepresentativesWorkbook(rows: LegalRepresentativeRow[], { title, logo }: WorkbookOptions): Promise<Uint8Array> {
  const module = await import("exceljs");
  const ExcelJS = ((module as { default?: unknown }).default ?? module) as typeof import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Legali rappresentanti", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}` },
    views: [{ state: "frozen", xSplit: 5, ySplit: HEADER_ROW }],
  });
  WIDTHS.forEach((width, index) => (sheet.getColumn(index + 1).width = width));

  if (logo && logo.length > 0) {
    const size = pngSize(logo);
    const image = book.addImage({ base64: toBase64(logo), extension: "png" });
    sheet.addImage(image, { tl: { col: 0, row: 0 }, ext: { width: Math.round((size.width * LOGO_HEIGHT) / size.height), height: LOGO_HEIGHT } });
  }
  for (const row of [1, 2, 3]) sheet.getRow(row).height = 20;

  const titleCell = sheet.getCell("A5");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: TECNO_BLUE } };
  for (let col = 1; col <= LEGAL_REPRESENTATIVE_HEADERS.length; col += 1) {
    sheet.getRow(5).getCell(col).border = { bottom: { style: "medium", color: { argb: TECNO_BRONZE } } };
  }
  sheet.mergeCells(6, 1, 6, LEGAL_REPRESENTATIVE_HEADERS.length);
  const intro = sheet.getCell("A6");
  intro.value =
    "Dati letti dai documenti d'identità contenuti negli ZIP del lotto (carta d'identità cinese con traduzione, o passaporto). " +
    "Il codice fiscale italiano è calcolato con le regole del DM 23/12/1976 per le persone nate all'estero: non è attribuito dall'Agenzia delle Entrate.";
  intro.font = { italic: true, size: 9, color: { argb: "FF475467" } };
  intro.alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(6).height = 30;

  const thin = { style: "thin" as const, color: { argb: "FFD0D5DD" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const header = sheet.getRow(HEADER_ROW);
  header.values = LEGAL_REPRESENTATIVE_HEADERS;
  header.height = 32;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TECNO_BLUE } };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    cell.border = border;
  });

  rows.forEach((row, index) => {
    const incomplete = !row.documentNumber;
    const values = [
      index + 1, row.zip, row.company, row.vat, row.surname || row.fullName, row.givenNames, row.sex, row.birthDate, row.birthPlace,
      row.nationality, row.taxCode, row.documentKind, row.documentNumber, row.issueDate, row.expiryDate, row.authority, row.address,
      row.notes.join(" "),
    ];
    const line = sheet.getRow(HEADER_ROW + 1 + index);
    line.values = values;
    for (let col = 1; col <= values.length; col += 1) {
      const cell = line.getCell(col);
      cell.alignment = { wrapText: true, vertical: "top" };
      cell.border = border;
      if (col === 4 || col === 11 || col === 13) cell.numFmt = "@";
      const fill = incomplete ? MISSING : index % 2 ? STRIPE : null;
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
  });
  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: LEGAL_REPRESENTATIVE_HEADERS.length } };

  return new Uint8Array(await book.xlsx.writeBuffer());
}
