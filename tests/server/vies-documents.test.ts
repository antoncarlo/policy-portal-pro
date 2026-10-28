import { describe, expect, it } from "vitest";
import { composeNotes } from "../../src/lib/practiceSummary";
import { VIES_REQUIRED_DOCUMENT_IDS, verifyViesBatch, type ControllerInput } from "../../src/lib/viesController";
import { classifyDocumentText, missingRequiredDocuments } from "../../src/lib/viesDocumentTypes";

const CLIENT_DOCUMENTS = ["licenza_commerciale", "documento_identita", "report_credito", "dichiarazione_sostitutiva", "ubo", "mandato_rappresentanza"];
const missing = (types: string[]) => missingRequiredDocuments(types).map((type) => type.id);

describe("VIES required documents", () => {
  it("requires only the client's documents, not the fiscal representative's", () => {
    expect(VIES_REQUIRED_DOCUMENT_IDS).toEqual(CLIENT_DOCUMENTS);
    expect(missing(CLIENT_DOCUMENTS)).toEqual([]);
    expect(missing(["visura_rappresentante", "bilancio_rappresentante", "statuto_rappresentante"])).toEqual(CLIENT_DOCUMENTS);
  });

  it("lets a Hong Kong company's certificates stand in for the business licence and the credit report", () => {
    const others = ["documento_identita", "dichiarazione_sostitutiva", "ubo", "mandato_rappresentanza"];
    expect(missing([...others, "certificato_costituzione_hk"])).toEqual([]);
    expect(missing([...others, "certificato_registrazione_hk"])).toEqual([]);
    expect(missing([...others, "certificato_costituzione_hk", "certificato_registrazione_hk"])).toEqual([]);
    // The certificates replace only those two documents.
    expect(missing(["certificato_costituzione_hk", "documento_identita", "dichiarazione_sostitutiva", "mandato_rappresentanza"])).toEqual(["ubo"]);
    expect(missing(others)).toEqual(["licenza_commerciale", "report_credito"]);
  });

  it("recognises the Hong Kong certificates from the title of a text PDF", () => {
    expect(classifyDocumentText(["CERTIFICATE OF INCORPORATION", "公司註冊證明書"])).toBe("certificato_costituzione_hk");
    expect(classifyDocumentText(["商業登記證", "Business Registration Certificate"])).toBe("certificato_registrazione_hk");
    expect(classifyDocumentText(["营业执照"])).toBe("licenza_commerciale");
  });
});

describe("VIES controller documents check", () => {
  const BATCH = "batch-1";
  const documentErrors = (types: string[]) => {
    const input: ControllerInput = {
      batchId: BATCH,
      jobs: [{
        id: "job-1", row_number: 7, nome_zip: "CNTBA03724", zip_file_name: "CNTBA03724.zip", contraente: "Alfa Limited", partita_iva_contraente: "18678521008",
        status: "queued", last_error: null, validation_errors: [], reconciliation_errors: [], external_reference: "p-1",
      }],
      practices: [{
        id: "p-1", practice_number: "VIES-1", practice_type: "vies", client_name: "Alfa Limited", owner_tax_code: "18678521008", beneficiary: "Agenzia delle Entrate",
        notes: composeNotes({ specificFields: { vies_zip_file: "CNTBA03724.zip" } }),
        premium_gross: null, premium_taxes: null, premium_net: null, premium_taxable: null, policy_start_date: null, policy_end_date: null,
      }],
      documents: [],
      indexedDocuments: types.map((type) => ({ practice_id: "p-1", row_number: 7, zip_file_name: "CNTBA03724.zip", requirement_matches: [type], status: "indexed" })),
      existingPractices: [],
    };
    return verifyViesBatch(input).jobs[0].errors.filter((error) => error.startsWith("Documenti obbligatori"));
  };

  it("accepts a ZIP without the fiscal representative's documents", () => {
    expect(documentErrors(CLIENT_DOCUMENTS)).toEqual([]);
  });

  it("accepts a Hong Kong company with its Business Registration Certificate", () => {
    expect(documentErrors(["certificato_registrazione_hk", "documento_identita", "dichiarazione_sostitutiva", "ubo", "mandato_rappresentanza"])).toEqual([]);
  });

  it("still blocks a missing client document", () => {
    expect(documentErrors(["licenza_commerciale", "documento_identita", "report_credito", "dichiarazione_sostitutiva", "mandato_rappresentanza"])).toEqual([
      "Documenti obbligatori non trovati: ubo",
    ]);
  });
});
