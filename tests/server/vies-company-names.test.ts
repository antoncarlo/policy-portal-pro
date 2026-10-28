import { describe, expect, it } from "vitest";
import { composeNotes } from "../../src/lib/practiceSummary";
import { companyNameKey, companyNameMatches } from "../../src/lib/viesCompanyNames";
import { verifyViesBatch, type ControllerInput } from "../../src/lib/viesController";

describe("VIES company names", () => {
  it("compares names without case, spacing, punctuation or legal form", () => {
    expect(companyNameMatches(["CLARITON INNOVATION CO., LIMITED"], ["Clariton Innovation Co., Limited"])).toBe(true);
    expect(companyNameMatches(["HengJia Housewares Co., Limited"], ["HENGJIA HOUSEWARES CO., LTD."])).toBe(true);
    expect(companyNameMatches(["Guangzhou Chao Ran Xin Xi Ke Ji Co.Ltd"], ["Guang Zhou Chao Ran Xin Xi Ke Ji You Xian Gong Si"])).toBe(true);
    expect(companyNameMatches(["Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si"], ["Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si 深圳市珠嬛新技术有限公司"])).toBe(false);
    expect(companyNameMatches(["", "深圳市珠嬛新技术有限公司"], ["深圳市珠嬛新技术有限公司"])).toBe(true);
  });

  it("never matches another company or a bare legal form", () => {
    expect(companyNameMatches(["Guangzhou Chao Ran Xin Xi Ke Ji Co.Ltd"], ["Guangzhou Hong Yu Trading Co., Ltd."])).toBe(false);
    expect(companyNameMatches(["Co., Ltd"], ["Limited"])).toBe(false);
    expect(companyNameMatches([""], [""])).toBe(false);
    expect(companyNameKey("ABC Ltd")).toBe("");
  });
});

describe("VIES controller identity check by company name", () => {
  const BATCH = "batch-1";
  const identityErrors = (fields: Record<string, unknown>) => {
    const input: ControllerInput = {
      batchId: BATCH,
      jobs: [{
        id: "job-1", row_number: 7, nome_zip: "CNTBA03724", zip_file_name: "CNTBA03724.zip", contraente: "CLARITON INNOVATION CO., LIMITED", partita_iva_contraente: "18678691009",
        status: "queued", last_error: null, validation_errors: [], reconciliation_errors: [], external_reference: "p-1",
      }],
      practices: [{
        id: "p-1", practice_number: "VIES-1", practice_type: "vies", client_name: "CLARITON INNOVATION CO., LIMITED", owner_tax_code: "18678691009", beneficiary: "Agenzia delle Entrate",
        notes: composeNotes({ specificFields: { vies_zip_file: "CNTBA03724.zip", vies_partita_iva: "18678691009", ...fields } }),
        premium_gross: null, premium_taxes: null, premium_net: null, premium_taxable: null, policy_start_date: null, policy_end_date: null,
      }],
      documents: [],
      indexedDocuments: [],
      existingPractices: [],
    };
    return verifyViesBatch(input).jobs[0].errors.filter((error) => /identità|ragione sociale|codice della società|altra società/.test(error));
  };

  it("accepts documents that carry the company's name instead of its codes", () => {
    expect(identityErrors({ vies_verifica_piva: "verified_by_name", vies_piva_trovate: [], vies_ragione_sociale_documenti: ["Clariton Innovation Co., Limited", "克萊通創新有限公司"] })).toEqual([]);
  });

  it("refuses a name check whose names are not the company's", () => {
    expect(identityErrors({ vies_verifica_piva: "verified_by_name", vies_piva_trovate: [], vies_ragione_sociale_documenti: ["HengJia Housewares Co., Limited"] })).toEqual([
      "La ragione sociale della società non compare nei documenti dello ZIP",
    ]);
  });

  it("still refuses an identity that was not verified", () => {
    expect(identityErrors({ vies_verifica_piva: "unverifiable", vies_piva_trovate: [], vies_ragione_sociale_documenti: ["Clariton Innovation Co., Limited"] })).toEqual([
      "L'identità della società non è stata verificata nei documenti dello ZIP",
      "Nei documenti dello ZIP non compare il codice della società (18678691009)",
    ]);
  });

  it("still requires the code when the identity was verified by code", () => {
    expect(identityErrors({ vies_verifica_piva: "verified", vies_piva_trovate: ["18678691009"] })).toEqual([]);
    expect(identityErrors({ vies_verifica_piva: "verified", vies_piva_trovate: [] })).toEqual([
      "Nei documenti dello ZIP non compare il codice della società (18678691009)",
    ]);
  });
});
