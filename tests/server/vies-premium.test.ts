import { describe, expect, it } from "vitest";
import { verifyViesBatch, type ControllerInput } from "../../src/lib/viesController";
import {
  VIES_PREMIUM_ACCESSORIES,
  VIES_PREMIUM_FEES,
  VIES_PREMIUM_GROSS,
  VIES_PREMIUM_NET,
  VIES_PREMIUM_TAXABLE,
  VIES_PREMIUM_TAXES,
} from "../../src/lib/viesTerms";

describe("VIES premium, as the company splits it", () => {
  it("matches the premium settlement of the Markel draft 1514223 (9/11/2026)", () => {
    // Premio Netto € 1.616,16 · Accessori € 161,62 · Diritti di emissione € 0,00 · Imponibile € 1.777,78 · Imposte € 222,22 · Premio finito € 2.000,00
    expect(VIES_PREMIUM_NET).toBe(1616.16);
    expect(VIES_PREMIUM_ACCESSORIES).toBe(161.62);
    expect(VIES_PREMIUM_FEES).toBe(0);
    expect(VIES_PREMIUM_TAXABLE).toBe(1777.78);
    expect(VIES_PREMIUM_TAXES).toBe(222.22);
    expect(VIES_PREMIUM_GROSS).toBe(2000);
  });

  it("adds up: net + accessories + fees = taxable, taxable + taxes = gross", () => {
    expect(Math.round((VIES_PREMIUM_NET + VIES_PREMIUM_ACCESSORIES + VIES_PREMIUM_FEES) * 100) / 100).toBe(VIES_PREMIUM_TAXABLE);
    expect(Math.round((VIES_PREMIUM_TAXABLE + VIES_PREMIUM_TAXES) * 100) / 100).toBe(VIES_PREMIUM_GROSS);
  });
});

describe("VIES final check of the premium", () => {
  const premiumErrors = (premium: { gross: number; taxes: number; taxable: number; net: number }) => {
    const input: ControllerInput = {
      batchId: "batch-1",
      jobs: [{
        id: "job-1", row_number: 1, nome_zip: "CNTBA03717", zip_file_name: "CNTBA03717.zip", contraente: "Alfa Ltd", partita_iva_contraente: "18678521008",
        status: "queued", last_error: null, validation_errors: [], reconciliation_errors: [], external_reference: "p-1",
      }],
      practices: [{
        id: "p-1", practice_number: "VIES-1", practice_type: "vies", client_name: "Alfa Ltd", owner_tax_code: "18678521008", beneficiary: "Agenzia delle Entrate",
        notes: null, premium_gross: premium.gross, premium_taxes: premium.taxes, premium_net: premium.net, premium_taxable: premium.taxable,
        policy_start_date: null, policy_end_date: null,
      }],
      documents: [],
      indexedDocuments: [],
      existingPractices: [],
    };
    return verifyViesBatch(input).jobs[0].errors.filter((error) => /^(Premio lordo|Imposte|Imponibile|Premio netto)/.test(error));
  };

  it("accepts the company's split", () => {
    expect(premiumErrors({ gross: 2000, taxes: 222.22, taxable: 1777.78, net: 1616.16 })).toEqual([]);
  });

  it("refuses the old split, with the net premium equal to the taxable", () => {
    expect(premiumErrors({ gross: 2000, taxes: 222.22, taxable: 1777.78, net: 1777.78 })).toEqual(["Premio netto 1777.78, atteso 1616.16"]);
  });
});
