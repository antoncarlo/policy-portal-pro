import { describe, expect, it } from "vitest";
import {
  inferSigningSlotFromFileName,
  isPrefilledPolicyModule,
  isSlotAvailable,
  missingSignatures,
  SIGNING_SLOTS,
  signingStatus,
  visibleToPartner,
} from "../../src/lib/signingDocuments";

describe("documenti da firmare", () => {
  it("il modulo precompilato per la compagnia e' riconosciuto per tipo e, per le righe storiche, per nome", () => {
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_Azienda_Uno.pdf", document_type: "modulo_polizza_vies" })).toBe(true);
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_Azienda_Uno.pdf", document_type: null })).toBe(true);
    expect(isPrefilledPolicyModule({ file_name: "bozza.pdf", document_type: "bozza_deliberata" })).toBe(false);
    expect(isPrefilledPolicyModule({ file_name: "Polizza_VIES_x.pdf", document_type: "polizza_firmata" })).toBe(false);
  });

  it("chi non e' amministratore non vede il modulo, ma vede bozza e copie firmate", () => {
    const docs = [
      { file_name: "Polizza_VIES_Azienda.pdf", document_type: "modulo_polizza_vies" },
      { file_name: "bozza.pdf", document_type: "bozza_deliberata" },
      { file_name: "mup.pdf", document_type: "mup_firmato" },
      { file_name: "1.zip", document_type: null },
    ];
    expect(visibleToPartner(docs).map((d) => d.file_name)).toEqual(["bozza.pdf", "mup.pdf", "1.zip"]);
  });

  it("i modelli si firmano da subito, la polizza solo dopo la deliberazione, niente se non deliberata", () => {
    const mup = SIGNING_SLOTS.find((s) => s.id === "mup")!;
    const policy = SIGNING_SLOTS.find((s) => s.id === "polizza_firmata")!;
    expect(isSlotAvailable(mup, "da_lavorare")).toBe(true);
    expect(isSlotAvailable(policy, "da_lavorare")).toBe(false);
    expect(isSlotAvailable(policy, "in_valutazione")).toBe(false);
    expect(isSlotAvailable(policy, "deliberata")).toBe(true);
    expect(isSlotAvailable(policy, "emessa")).toBe(true);
    expect(isSlotAvailable(mup, "non_deliberata")).toBe(false);
  });

  it("lo stato indica la copia firmata piu' recente e cosa manca", () => {
    const docs = [
      { file_name: "mup-vecchio.pdf", document_type: "mup_firmato", created_at: "2026-10-01T10:00:00Z" },
      { file_name: "mup-nuovo.pdf", document_type: "mup_firmato", created_at: "2026-10-05T10:00:00Z" },
      { file_name: "privacy.pdf", document_type: "privacy_firmata", created_at: "2026-10-02T10:00:00Z" },
    ];
    const status = signingStatus(docs, "deliberata");
    expect(status.find((s) => s.slot.id === "mup")!.signed!.file_name).toBe("mup-nuovo.pdf");
    expect(missingSignatures(docs, "deliberata").map((s) => s.id)).toEqual(["set_informativo", "antiriciclaggio", "polizza_firmata"]);
    expect(missingSignatures(docs, "in_valutazione").map((s) => s.id)).toEqual(["set_informativo", "antiriciclaggio"]);
  });

  it("riconosce il documento dal nome del file caricato in blocco", () => {
    expect(inferSigningSlotFromFileName("Pratiche/VIES-2026-0001/mup.pdf")?.id).toBe("mup");
    expect(inferSigningSlotFromFileName("mup_firmato-rossi.pdf")?.id).toBe("mup");
    expect(inferSigningSlotFromFileName("Set informativo firmato.pdf")?.id).toBe("set_informativo");
    expect(inferSigningSlotFromFileName("informativa-privacy-GDPR.pdf")?.id).toBe("privacy");
    expect(inferSigningSlotFromFileName("questionario antiriciclaggio.pdf")?.id).toBe("antiriciclaggio");
    expect(inferSigningSlotFromFileName("adeguata_verifica.pdf")?.id).toBe("antiriciclaggio");
    expect(inferSigningSlotFromFileName("polizza_firmata_bozza-compagnia.pdf")?.id).toBe("polizza_firmata");
    expect(inferSigningSlotFromFileName("Bozza polizza firmata.pdf")?.id).toBe("polizza_firmata");
    expect(inferSigningSlotFromFileName("visura.pdf")).toBeNull();
  });
});
