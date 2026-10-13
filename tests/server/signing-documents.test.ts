import { describe, expect, it } from "vitest";
import {
  companyCopyOf,
  draftOf,
  inferSigningSlotFromFileName,
  isPrefilledPolicyModule,
  isSlotAvailable,
  issuedCopiesOf,
  missingSignatures,
  SIGNING_SLOTS,
  signaturesComplete,
  signingStatus,
  visibleToPartner,
} from "../../src/lib/signingDocuments";

describe("documenti da firmare", () => {
  it("ordine di firma: polizza copia Compagnia, privacy, MUP, antiriciclaggio; la bozza non e' tra i documenti da firmare", () => {
    const ordered = [...SIGNING_SLOTS].sort((a, b) => a.order - b.order).map((s) => s.id);
    expect(ordered).toEqual(["polizza_firmata", "privacy", "mup", "antiriciclaggio"]);
    expect(SIGNING_SLOTS.find((s) => s.id === "polizza_firmata")!.sourceType).toBe("polizza_copia_compagnia");
    expect(SIGNING_SLOTS.find((s) => s.id === "polizza_firmata")!.hasTemplate).toBe(false);
    expect(SIGNING_SLOTS.filter((s) => s.hasTemplate).map((s) => s.id)).toEqual(["privacy", "mup", "antiriciclaggio"]);
  });

  it("il modulo precompilato per la compagnia e' riconosciuto per tipo e, per le righe storiche, per nome", () => {
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_Azienda_Uno.pdf", document_type: "modulo_polizza_vies" })).toBe(true);
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_Azienda_Uno.pdf", document_type: null })).toBe(true);
    expect(isPrefilledPolicyModule({ file_name: "bozza.pdf", document_type: "bozza_deliberata" })).toBe(false);
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_x.pdf", document_type: "polizza_firmata" })).toBe(false);
  });

  it("chi non e' amministratore non vede il modulo, ma vede bozza, copia per la Compagnia e copie firmate", () => {
    const docs = [
      { file_name: "Polizza_VIES_Azienda.pdf", document_type: "modulo_polizza_vies" },
      { file_name: "bozza.pdf", document_type: "bozza_deliberata" },
      { file_name: "copia-compagnia.pdf", document_type: "polizza_copia_compagnia" },
      { file_name: "mup.pdf", document_type: "mup_firmato" },
      { file_name: "1.zip", document_type: null },
    ];
    expect(visibleToPartner(docs).map((d) => d.file_name)).toEqual(["bozza.pdf", "copia-compagnia.pdf", "mup.pdf", "1.zip"]);
  });

  it("si firma solo dopo la deliberazione, niente se non deliberata", () => {
    const mup = SIGNING_SLOTS.find((s) => s.id === "mup")!;
    const policy = SIGNING_SLOTS.find((s) => s.id === "polizza_firmata")!;
    for (const stage of ["da_lavorare", "in_valutazione", "integrazioni", "non_deliberata"] as const) {
      expect(isSlotAvailable(mup, stage)).toBe(false);
      expect(isSlotAvailable(policy, stage)).toBe(false);
    }
    for (const stage of ["deliberata", "da_emettere", "emessa"] as const) {
      expect(isSlotAvailable(mup, stage)).toBe(true);
      expect(isSlotAvailable(policy, stage)).toBe(true);
    }
  });

  it("lo stato indica la copia da firmare, la copia firmata piu' recente e cosa manca", () => {
    const docs = [
      { file_name: "bozza.pdf", document_type: "bozza_deliberata", created_at: "2026-10-01T09:00:00Z" },
      { file_name: "copia-compagnia.pdf", document_type: "polizza_copia_compagnia", created_at: "2026-10-01T09:00:00Z" },
      { file_name: "mup-vecchio.pdf", document_type: "mup_firmato", created_at: "2026-10-01T10:00:00Z" },
      { file_name: "mup-nuovo.pdf", document_type: "mup_firmato", created_at: "2026-10-05T10:00:00Z" },
      { file_name: "privacy.pdf", document_type: "privacy_firmata", created_at: "2026-10-02T10:00:00Z" },
    ];
    const status = signingStatus(docs, "deliberata");
    expect(status.map((s) => s.slot.id)).toEqual(["polizza_firmata", "privacy", "mup", "antiriciclaggio"]);
    expect(status[0].source!.file_name).toBe("copia-compagnia.pdf");
    expect(status.find((s) => s.slot.id === "mup")!.signed!.file_name).toBe("mup-nuovo.pdf");
    expect(missingSignatures(docs, "deliberata").map((s) => s.id)).toEqual(["polizza_firmata", "antiriciclaggio"]);
    expect(signaturesComplete(docs, "deliberata")).toBe(false);
    expect(missingSignatures(docs, "in_valutazione")).toEqual([]);
    expect(signaturesComplete(docs, "in_valutazione")).toBe(false);
    const all = [...docs, { file_name: "polizza-firmata.pdf", document_type: "polizza_firmata", created_at: "2026-10-06T10:00:00Z" }, { file_name: "aml.pdf", document_type: "antiriciclaggio_firmato", created_at: "2026-10-06T10:00:00Z" }];
    expect(signaturesComplete(all, "deliberata")).toBe(true);
    expect(draftOf(docs)!.file_name).toBe("bozza.pdf");
    expect(companyCopyOf(docs)!.file_name).toBe("copia-compagnia.pdf");
    expect(issuedCopiesOf([...docs, { file_name: "c1.pdf", document_type: "polizza_emessa", created_at: "2026-11-01T10:00:00Z" }, { file_name: "c2.pdf", document_type: "polizza_emessa", created_at: "2026-11-01T10:01:00Z" }]).map((d) => d.file_name)).toEqual(["c2.pdf", "c1.pdf"]);
  });

  it("riconosce il documento dal nome del file caricato in blocco", () => {
    expect(inferSigningSlotFromFileName("VIES-2026-0001/3_mup.pdf")?.id).toBe("mup");
    expect(inferSigningSlotFromFileName("mup_firmato-rossi.pdf")?.id).toBe("mup");
    expect(inferSigningSlotFromFileName("2_privacy.pdf")?.id).toBe("privacy");
    expect(inferSigningSlotFromFileName("informativa-privacy-GDPR.pdf")?.id).toBe("privacy");
    expect(inferSigningSlotFromFileName("questionario antiriciclaggio.pdf")?.id).toBe("antiriciclaggio");
    expect(inferSigningSlotFromFileName("adeguata_verifica.pdf")?.id).toBe("antiriciclaggio");
    expect(inferSigningSlotFromFileName("1_polizza_copia_compagnia_Azienda.pdf")?.id).toBe("polizza_firmata");
    expect(inferSigningSlotFromFileName("Polizza copia compagnia firmata.pdf")?.id).toBe("polizza_firmata");
    expect(inferSigningSlotFromFileName("visura.pdf")).toBeNull();
    expect(inferSigningSlotFromFileName("bozza.pdf")).toBeNull();
  });
});
