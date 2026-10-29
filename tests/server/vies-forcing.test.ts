import { describe, expect, it } from "vitest";
import { buildPracticeSummary, composeNotes } from "../../src/lib/practiceSummary";
import { verifyViesBatch, type ControllerInput } from "../../src/lib/viesController";
import { isForceableError, readViesForcing, type ViesForcingRecord } from "../../src/lib/viesForcing";

const FORCING: ViesForcingRecord = {
  operatore: "operatore@tecnomga.com",
  data: "2026-10-29T11:50:00.000Z",
  motivo: "agent_misread",
  nota: "Carta d'identità rinnovata, letta male",
  blocchi: ["Documento d'identità scaduto il 10/03/2026", "Nei documenti dello ZIP non compare nessun codice leggibile della società: identità non verificabile"],
};

describe("VIES forced sending: what the operator may force", () => {
  it("lets the operator force the blocks that come from reading the documents", () => {
    for (const error of [
      "Documento d'identità scaduto il 10/03/2026",
      "Business Registration Certificate di Hong Kong scaduto il 01/02/2026",
      "Nei documenti dello ZIP non compare nessun codice leggibile della società: identità non verificabile",
      "Nei documenti dello ZIP non compaiono né la partita IVA italiana né la ragione sociale della società: identità non verificabile",
      "Documento del legale rappresentante non corrispondente: nei documenti 110101199003077777",
      "2 documenti non verificati dall'agent: errore",
      "Verifica approfondita dell'agent non riuscita: i documenti mancanti non sono stati ricercati di nuovo",
    ]) {
      expect(isForceableError(error), error).toBe(true);
    }
  });

  it("never lets the operator force a missing ZIP, wrong Excel data, a duplicate practice or another company's documents", () => {
    for (const error of [
      "I documenti dello ZIP sono di un'altra società: 18678521008 non compare, trovati 91440300MA5GX0J87E",
      "Nello ZIP compaiono i codici di più società: 91440300MA5GX639XR, 91440300MA5GX0J87E",
      "Nello ZIP compaiono anche codici di un'altra società: 91440300MA5GX0J87E",
      "ZIP CNTBA03717.zip non caricato",
      "ZIP duplicato",
      "Il numero ZIP CNTBA03717 è indicato su più righe",
      "PEC mancante (né del contraente né del rappresentante fiscale)",
      "Domicilio fiscale del rappresentante mancante",
      "Esiste già la pratica VIES VIES-2026-0007-abcd1234 per questa società (creata il 28/10/2026)",
    ]) {
      expect(isForceableError(error), error).toBe(false);
    }
  });
});

describe("VIES forced sending: the record kept in the practice", () => {
  it("reads a complete record", () => {
    expect(readViesForcing(FORCING)).toEqual(FORCING);
  });

  it("ignores a record without who forced it, why, or what was forced", () => {
    expect(readViesForcing(undefined)).toBeNull();
    expect(readViesForcing("forzata")).toBeNull();
    expect(readViesForcing({ ...FORCING, operatore: "" })).toBeNull();
    expect(readViesForcing({ ...FORCING, motivo: "perché sì" })).toBeNull();
    expect(readViesForcing({ ...FORCING, blocchi: [] })).toBeNull();
  });
});

describe("VIES controller: a forced practice", () => {
  const errorsFor = (forcing: unknown, foundCodes: string[] = []) => {
    const input: ControllerInput = {
      batchId: "batch-1",
      jobs: [{
        id: "job-1", row_number: 7, nome_zip: "CNTBA03717", zip_file_name: "CNTBA03717.zip", contraente: "Alfa Limited", partita_iva_contraente: "18678521008",
        status: "queued", last_error: null, validation_errors: [], reconciliation_errors: [], external_reference: "p-1",
      }],
      practices: [{
        id: "p-1", practice_number: "VIES-1", practice_type: "vies", client_name: "Alfa Limited", owner_tax_code: "18678521008", beneficiary: "Agenzia delle Entrate",
        notes: composeNotes({
          specificFields: {
            vies_zip_file: "CNTBA03717.zip",
            vies_verifica_piva: "unverifiable",
            vies_piva_trovate: foundCodes,
            ...(forcing === undefined ? {} : { vies_forzatura: forcing }),
          },
        }),
        premium_gross: null, premium_taxes: null, premium_net: null, premium_taxable: null, policy_start_date: null, policy_end_date: null,
      }],
      documents: [],
      indexedDocuments: [
        ...["licenza_commerciale", "documento_identita", "report_credito", "dichiarazione_sostitutiva", "mandato_rappresentanza"].map((type) => ({
          practice_id: "p-1", row_number: 7, zip_file_name: "CNTBA03717.zip", requirement_matches: [type], status: "indexed",
        })),
        { practice_id: "p-1", row_number: 7, zip_file_name: "CNTBA03717.zip", requirement_matches: [], status: "error" },
      ],
      existingPractices: [],
    };
    return verifyViesBatch(input).jobs[0].errors;
  };
  const DOCUMENT_CHECKS = [
    "L'identità della società non è stata verificata nei documenti dello ZIP",
    "Nei documenti dello ZIP non compare il codice della società (18678521008)",
    "Uno dei documenti dello ZIP non è leggibile",
    "Documenti obbligatori non trovati: ubo",
  ];

  it("blocks a practice that is not forced on identity and documents", () => {
    expect(errorsFor(undefined)).toEqual(expect.arrayContaining(DOCUMENT_CHECKS));
  });

  it("lets a forced practice through the checks on identity and documents, and only those", () => {
    const errors = errorsFor(FORCING);
    for (const check of DOCUMENT_CHECKS) expect(errors).not.toContain(check);
    expect(errors).toContain("Manca l'indirizzo del beneficiario");
    expect(errors).toContain("Manca il rappresentante fiscale");
  });

  it("still blocks a forced practice whose ZIP carries another company's code", () => {
    const errors = errorsFor(FORCING, ["91440300MA5GX0J87E"]);
    expect(errors).toContain("Nello ZIP compaiono codici di un'altra società: 91440300MA5GX0J87E");
  });

  it("does not count an incomplete forcing record", () => {
    expect(errorsFor({ ...FORCING, operatore: "" })).toEqual(expect.arrayContaining(DOCUMENT_CHECKS));
  });
});

describe("VIES practice summary: a forced practice", () => {
  it("says who forced it, when, why, and which blocks were ignored", () => {
    const summary = buildPracticeSummary({ practice_type: "vies", client_name: "Alfa Limited", specific_fields: { vies_forzatura: FORCING } });
    const item = summary.sections.flatMap((section) => section.items).find((entry) => entry.key === "vies_forzatura");
    expect(item?.label).toBe("Invio forzato");
    expect(item?.value.split("\n")).toEqual([
      "Forzato da operatore@tecnomga.com il 29/10/2026, 12:50",
      "Motivo: Lettura dell'agent errata",
      "Nota: Carta d'identità rinnovata, letta male",
      "Blocco ignorato: Documento d'identità scaduto il 10/03/2026",
      "Blocco ignorato: Nei documenti dello ZIP non compare nessun codice leggibile della società: identità non verificabile",
    ]);
  });

  it("shows no forced sending for a practice that passed its checks", () => {
    const summary = buildPracticeSummary({ practice_type: "vies", client_name: "Alfa Limited", specific_fields: {} });
    expect(summary.sections.flatMap((section) => section.items).some((entry) => entry.key === "vies_forzatura")).toBe(false);
  });
});
