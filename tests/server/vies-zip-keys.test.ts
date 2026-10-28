import { describe, expect, it } from "vitest";
import { composeNotes } from "../../src/lib/practiceSummary";
import { verifyViesBatch, type ControllerInput } from "../../src/lib/viesController";
import { isPracticeZipName, isValidZipName, planZipBundle, practiceZipKeys, zipKeyOf } from "../../src/lib/viesZipKeys";

const keys = (...names: string[]) => practiceZipKeys(names);
const fileNames = (parts: ReturnType<typeof planZipBundle>) => parts?.map((part) => part.fileName).sort() ?? null;

describe("VIES ZIP names", () => {
  it("matches a row to its ZIP whatever the case, spaces, accents or extension", () => {
    expect(zipKeyOf("CNTBA03717")).toBe("cntba03717");
    expect(zipKeyOf(" cntba03717.ZIP ")).toBe("cntba03717");
    expect(zipKeyOf("CnTbA03717.zip")).toBe(zipKeyOf("CNTBA03717"));
    expect(zipKeyOf("Società Alfa")).toBe(zipKeyOf("societa-alfa.zip"));
    expect(zipKeyOf("1")).toBe(zipKeyOf("1.zip"));
    expect(zipKeyOf("CNTBA03717")).not.toBe(zipKeyOf("CNTBA03718"));
  });

  it("accepts numbers, client codes, acronyms and letters as ZIP names", () => {
    for (const name of ["1", "20", "21", "CNTBA03717", "cn0jd03745", "A", "b", "AZ-001", "Shenzhen Alfa"]) {
      expect(isValidZipName(name), name).toBe(true);
    }
    expect(isValidZipName("")).toBe(false);
    expect(isValidZipName(" .zip ")).toBe(false);
    expect(isValidZipName("公司")).toBe(false);
    expect(isValidZipName("X".repeat(81))).toBe(false);
  });

  it("recognises the practices of the Excel by name, and only 1 … 20 without an Excel", () => {
    const lot = keys("CNTBA03717", "a");
    expect(isPracticeZipName("cntba03717.zip", lot)).toBe(true);
    expect(isPracticeZipName("A", lot)).toBe(true);
    expect(isPracticeZipName("CNTBA03718", lot)).toBe(false);
    expect(isPracticeZipName("7.zip", new Set())).toBe(true);
    expect(isPracticeZipName("CNTBA03717.zip", new Set())).toBe(false);
  });
});

describe("VIES lot bundle", () => {
  const lot = keys("CNTBA03717", "CNTBA03718", "CN0JD03745");

  it("splits a bundle of client folders, with the folder names in any case", () => {
    const parts = planZipBundle("CNTBA03717.zip", [
      "cntba03717/licenza.pdf",
      "CNTBA03718/licenza.pdf",
      "CNTBA03718/sub/id.pdf",
      "CN0JD03745/licenza.pdf",
    ], lot);
    expect(fileNames(parts)).toEqual(["CN0JD03745.zip", "CNTBA03718.zip", "cntba03717.zip"]);
    const folder = parts?.find((part) => part.fileName === "CNTBA03718.zip");
    expect(folder && "folderEntries" in folder ? folder.folderEntries.map((item) => item.path) : null).toEqual(["licenza.pdf", "sub/id.pdf"]);
  });

  it("splits a bundle of client ZIPs zipped from their parent folder", () => {
    const parts = planZipBundle("lotto.zip", ["lotto/CNTBA03717.zip", "lotto/cntba03718.ZIP", "lotto/note.txt"], lot);
    expect(fileNames(parts)).toEqual(["CNTBA03717.zip", "cntba03718.zip"]);
  });

  it("keeps a single practice's ZIP as it is", () => {
    expect(planZipBundle("CNTBA03717.zip", ["CNTBA03717/licenza.pdf", "CNTBA03717/id.pdf"], lot)).toBeNull();
    expect(planZipBundle("CNTBA03717.zip", ["CNTBA03717/licenza.pdf", "report.pdf"], lot)).toBeNull();
    expect(planZipBundle("CNTBA03717.zip", ["licenza.pdf", "documenti.zip"], lot)).toBeNull();
  });

  it("still splits the numbered bundle when no Excel is loaded", () => {
    expect(fileNames(planZipBundle("lotto.zip", ["1.zip", "2/licenza.pdf"], new Set()))).toEqual(["1.zip", "2.zip"]);
  });
});

describe("VIES controller with named ZIPs", () => {
  const BATCH = "batch-1";
  const zipErrors = (input: ControllerInput) =>
    verifyViesBatch(input).jobs[0].errors.filter((error) => /ZIP (non valido|della riga|registrato|allegato)|Alla pratica è allegato|Tra i documenti|usato anche/.test(error));

  const input = (nomeZip: string, fileName: string, storedName: string): ControllerInput => ({
    batchId: BATCH,
    jobs: [{
      id: "job-1", row_number: 5, nome_zip: nomeZip, zip_file_name: fileName, contraente: "Alfa Ltd", partita_iva_contraente: "18678521008",
      status: "queued", last_error: null, validation_errors: [], reconciliation_errors: [], external_reference: "p-1",
    }],
    practices: [{
      id: "p-1", practice_number: "VIES-1", practice_type: "vies", client_name: "Alfa Ltd", owner_tax_code: "18678521008", beneficiary: "Agenzia delle Entrate",
      notes: composeNotes({ specificFields: { vies_zip_file: fileName } }),
      premium_gross: null, premium_taxes: null, premium_net: null, premium_taxable: null, policy_start_date: null, policy_end_date: null,
    }],
    documents: [{ practice_id: "p-1", file_name: fileName, file_path: `vies-batch-files://user/lotto/${BATCH}/zip-nominativi/${storedName}`, file_size: 10, mime_type: "application/zip" }],
    indexedDocuments: [{ practice_id: "p-1", row_number: 5, zip_file_name: fileName, requirement_matches: [], status: "indexed" }],
    existingPractices: [],
  });

  it("accepts a client code as ZIP name, archived in lowercase", () => {
    expect(zipErrors(input("CNTBA03717", "CNTBA03717.zip", "cntba03717.zip"))).toEqual([]);
  });

  it("accepts the name written in another case in the Excel", () => {
    expect(zipErrors(input("cntba03717", "CNTBA03717.zip", "cntba03717.zip"))).toEqual([]);
  });

  it("still accepts the numbered ZIPs", () => {
    expect(zipErrors(input("3", "3.zip", "3.zip"))).toEqual([]);
  });

  it("refuses another client's ZIP or an unusable name", () => {
    expect(zipErrors(input("CNTBA03717", "CNTBA03718.zip", "cntba03718.zip")).length).toBeGreaterThan(0);
    expect(zipErrors(input("公司", "公司.zip", "zip.zip")).length).toBeGreaterThan(0);
  });
});
