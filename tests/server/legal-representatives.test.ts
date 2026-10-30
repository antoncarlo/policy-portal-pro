import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { foreignTaxCode } from "../../src/lib/foreignTaxCode";
import {
  LEGAL_REPRESENTATIVE_HEADERS,
  buildLegalRepresentativesWorkbook,
  identityReadingFromAgent,
  legalRepresentativeRow,
  type AgentIdentityReading,
  type IdentityReading,
} from "../../src/lib/legalRepresentatives";

const TODAY = new Date("2026-10-30T12:00:00Z");
const blank: IdentityReading = {
  fileName: "", surname: "", givenNames: "", sex: "", birthDate: "", birthPlace: "", nationality: "", address: "",
  documentKind: "", documentNumber: "", issueDate: "", expiryDate: "", authority: "",
};
const practice = { zip: "CNTBA03717", company: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", excelName: "Liu Yuzhen" };

describe("Italian tax code of a person born abroad", () => {
  it("follows the rules of DM 23/12/1976 (known case)", () => {
    expect(foreignTaxCode({ surname: "ROSSI", givenNames: "MARIO", sex: "M", birthDate: "01/01/1980", stateCode: "H501" })).toBe("RSSMRA80A01H501U");
  });

  it("gives the codes checked by hand for lot 1, with Y as a consonant and +40 on the day for women", () => {
    expect(foreignTaxCode({ surname: "Liu", givenNames: "Yuzhen", sex: "F", birthDate: "01/09/1977", stateCode: "Z210" })).toBe("LIUYHN77P41Z210P");
    expect(foreignTaxCode({ surname: "YUEN", givenNames: "WING CHIU", sex: "M", birthDate: "22/06/1983", stateCode: "Z210" })).toBe("YNUWGC83H22Z210O");
    expect(foreignTaxCode({ surname: "YU", givenNames: "QIONG", sex: "F", birthDate: "26/02/1985", stateCode: "Z210" })).toBe("YUXQNG85B66Z210G");
  });

  it("gives nothing without a complete date or sex", () => {
    expect(foreignTaxCode({ surname: "LIU", givenNames: "YUZHEN", sex: "", birthDate: "01/09/1977", stateCode: "Z210" })).toBe("");
    expect(foreignTaxCode({ surname: "LIU", givenNames: "YUZHEN", sex: "F", birthDate: "1977", stateCode: "Z210" })).toBe("");
  });
});

describe("Identity reading from the document agent", () => {
  const emptyDetails = {
    surname: "", given_names: "", sex: "", birth_date: "", birth_place: "", nationality: "", residence_address: "",
    document_kind: "", document_number: "", issue_date: "", expiry_date: "", issuing_authority: "",
  };
  const reading: AgentIdentityReading = {
    document_type: "documento_identita", legal_representative_id_number: "362401197709014447", document_date: "26/01/2026", expiry_date: "illimitata",
    legal_representative_identity: {
      ...emptyDetails, surname: "Liu", given_names: "Yuzhen", sex: "F", birth_date: "01/09/1977",
      residence_address: "No.13 Zhaotang Fangyuan Village, Changtang Town", issuing_authority: "Ufficio del Distretto di Jizhou",
    },
  };

  it("takes the personal data of the identity document, and its number and dates from the reading when not repeated", () => {
    expect(identityReadingFromAgent("身份证翻译件.pdf", reading)).toEqual({
      fileName: "身份证翻译件.pdf", surname: "Liu", givenNames: "Yuzhen", sex: "F", birthDate: "01/09/1977", birthPlace: "", nationality: "",
      address: "No.13 Zhaotang Fangyuan Village, Changtang Town", documentKind: "", documentNumber: "362401197709014447",
      issueDate: "26/01/2026", expiryDate: "illimitata", authority: "Ufficio del Distretto di Jizhou",
    });
  });

  it("ignores every document that is not an identity document", () => {
    expect(identityReadingFromAgent("ubo.pdf", { ...reading, document_type: "ubo" })).toBeNull();
  });

  it("takes from a file bundling the identity document only the data of that document, not the dates of the file", () => {
    const bundled = identityReadingFromAgent("documenti.pdf", { ...reading, document_type: "dichiarazione_sostitutiva", contained_document_types: ["documento_identita"] });
    expect(bundled).toMatchObject({ surname: "Liu", documentNumber: "362401197709014447", issueDate: "", expiryDate: "" });
  });

  it("gives nothing when the agent read nothing on the identity document", () => {
    expect(identityReadingFromAgent("scan.jpg", { ...reading, legal_representative_id_number: "", document_date: "", expiry_date: "", legal_representative_identity: emptyDetails })).toBeNull();
  });
});

describe("Legal representative row from the readings of the identity documents", () => {
  const original: IdentityReading = {
    ...blank, fileName: "身份证.pdf", surname: "刘", givenNames: "玉珍", documentNumber: "362401197709014447",
    address: "江西省吉安市吉州区长塘镇", expiryDate: "长期",
  };
  const translation: IdentityReading = {
    ...blank, fileName: "身份证翻译件.pdf", surname: "Liu", givenNames: "Yuzhen", sex: "F", birthDate: "01/09/1977",
    address: "No.13 Zhaotang Fangyuan Village, Changtang Town, Ji'an District, Jiangxi Province", documentNumber: "362401197709014447",
    issueDate: "26/01/2026", expiryDate: "illimitata", authority: "Ufficio del Distretto di Jizhou, Agenzia di Pubblica Sicurezza di Ji'an",
  };

  it("joins the card and its translation, preferring the Latin script", () => {
    const row = legalRepresentativeRow(practice, [original, translation], TODAY);
    expect(row).toMatchObject({
      surname: "LIU", givenNames: "YUZHEN", sex: "F", birthDate: "01/09/1977", nationality: "Cinese",
      address: "No.13 Zhaotang Fangyuan Village, Changtang Town, Ji'an District, Jiangxi Province",
      documentKind: "Carta d'identità della Repubblica Popolare Cinese", documentNumber: "362401197709014447",
      issueDate: "26/01/2026", expiryDate: "illimitata", taxCode: "LIUYHN77P41Z210P",
    });
    expect(row.notes.join(" ")).not.toMatch(/scaduto/);
  });

  it("takes birth date and sex from a valid Chinese card number when the reading misses them", () => {
    const row = legalRepresentativeRow(practice, [{ ...translation, sex: "", birthDate: "" }], TODAY);
    expect(row.birthDate).toBe("01/09/1977");
    expect(row.sex).toBe("F");
  });

  it("never uses a card number with a wrong check character", () => {
    const row = legalRepresentativeRow(practice, [{ ...translation, documentNumber: "362401197709014448" }], TODAY);
    expect(row.documentNumber).toBe("");
    expect(row.notes.join(" ")).toMatch(/Numero del documento letto non valido: 362401197709014448/);
  });

  it("notes an expired document", () => {
    const row = legalRepresentativeRow(practice, [{ ...translation, issueDate: "10/03/2006", expiryDate: "10/03/2026" }], TODAY);
    expect(row.notes.join(" ")).toMatch(/Documento scaduto il 10\/03\/2026/);
  });

  it("notes a passport without residence and a person born in Hong Kong, without inventing a tax code", () => {
    const passport: IdentityReading = {
      ...blank, fileName: "passport.pdf", surname: "LI", givenNames: "WAI CHING", sex: "M", birthDate: "29/07/1960", birthPlace: "HONG KONG",
      nationality: "CHINESE", documentKind: "Passaporto RAS di Hong Kong", documentNumber: "HJ2002477", issueDate: "23/05/2019",
      expiryDate: "23/05/2029", authority: "Immigration Department, Hong Kong Special Administrative Region",
    };
    const row = legalRepresentativeRow({ ...practice, excelName: "WAI CHING LI" }, [passport], TODAY);
    expect(row).toMatchObject({ surname: "LI", givenNames: "WAI CHING", documentNumber: "HJ2002477", taxCode: "", address: "" });
    expect(row.notes.join(" ")).toMatch(/Residenza non riportata/);
    expect(row.notes.join(" ")).toMatch(/Hong Kong/);
  });

  it("keeps the name of the Excel and says what is missing when no identity document was read", () => {
    const row = legalRepresentativeRow(practice, [], TODAY);
    expect(row).toMatchObject({ surname: "", givenNames: "", fullName: "Liu Yuzhen", documentNumber: "", taxCode: "" });
    expect(row.notes.join(" ")).toMatch(/Documento d'identità non letto/);
  });
});

describe("Legal representatives workbook", () => {
  it("has the logo, the title and one row per practice under the headers", async () => {
    const translation: IdentityReading = {
      ...blank, surname: "Sun", givenNames: "Jiandong", sex: "M", birthDate: "08/09/1989", documentNumber: "510723198909080970",
      address: "Group 15, Sanxingxujiaqiao Village, Yulong Town, Yanting County, Sichuan Province", issueDate: "12/01/2017", expiryDate: "12/01/2037",
      authority: "Ufficio di Pubblica Sicurezza della Contea di Yanting",
    };
    const rows = [
      legalRepresentativeRow({ zip: "CNTBA03718", company: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", excelName: "Sun Jiandong" }, [translation], TODAY),
      legalRepresentativeRow(practice, [], TODAY),
    ];
    // 1×1 PNG.
    const logo = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const bytes = await buildLegalRepresentativesWorkbook(rows, { title: "Lotto 3 VIES – Dati anagrafici dei legali rappresentanti", logo });

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const sheet = book.worksheets[0];
    expect(sheet.getImages()).toHaveLength(1);
    expect(sheet.getCell("A5").value).toBe("Lotto 3 VIES – Dati anagrafici dei legali rappresentanti");
    expect(sheet.getRow(8).values).toEqual([undefined, ...LEGAL_REPRESENTATIVE_HEADERS]);
    const first = sheet.getRow(9).values as unknown[];
    expect(first.slice(1, 8)).toEqual([1, "CNTBA03718", "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", "18678541006", "SUN", "JIANDONG", "M"]);
    expect(first[11]).toBe("SNUJDN89P08Z210W");
    expect(sheet.getRow(10).getCell(2).value).toBe("CNTBA03717");
  });
});
