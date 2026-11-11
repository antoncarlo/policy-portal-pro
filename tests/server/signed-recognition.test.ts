import { describe, expect, it } from "vitest";
import { classifySignedFile, signedSlotOf, type SignedPractice } from "../../src/lib/signedRecognition";

const entry = (path: string) => ({ path, name: path.split("/").pop() ?? path, blob: new Blob(["x"]), size: 1 });
// Lot 1 (10/11/2026): the practice number is the portal's, the draft number the company's.
const practices: SignedPractice[] = [
  { id: "p8", practice_number: "VIES-2026-0008-4be40a00", client_name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", tax_code: "18678541006", policy_number: "B.2026.1514223", draft_number: "1514223", signing: true },
  { id: "p7", practice_number: "VIES-2026-0007-4be40a00", client_name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", tax_code: "18678521008", policy_number: "B.2026.1514572", draft_number: "1514572", signing: true },
  { id: "p9", practice_number: "VIES-2026-0009-4be40a00", client_name: "Shen Zhen Shi Xia Yi Shang Mao You Xian Gong Si", tax_code: "18678611007", policy_number: null, draft_number: "1514574", signing: false },
];
const classify = (path: string, text = "") => classifySignedFile(entry(path), practices, text);

describe("signed files: which practice and which document", () => {
  it("the company's copy signed by the collaborator, with the company's own file name, goes to its practice by the draft number", () => {
    for (const name of [
      "1514223_ViesCompagnia_Markel_2026.docx.pdf.p7m",
      "1514223_ViesCompagnia_Markel_2026.docx.pdf_signed.p7m",
      "1514223_ViesCompagnia_Markel_2026.docx.pdf.p7m.p7m",
      "firmati/1 GRUPPO COPIE COMPAGNIA/1514223_ViesCompagnia_Markel_2026.docx.pdf.p7m",
    ]) {
      expect(classify(name), name).toEqual({ practiceId: "p8", slotId: "polizza_firmata" });
    }
  });

  it("keeps recognising the names of the portal's ZIP and of the signing tools", () => {
    expect(classify("VIES-2026-0007-4be40a00/1_polizza_copia_compagnia_1514572_ViesCompagnia_Markel_2026.docx.pdf.p7m")).toEqual({ practiceId: "p7", slotId: "polizza_firmata" });
    expect(classify("VIES-2026-0007-4be40a00_polizza_copia_compagnia_1514572_ViesCompagnia_Markel_2026.docx.pdf_signed.p7m")).toEqual({ practiceId: "p7", slotId: "polizza_firmata" });
    expect(classify("VIES-2026-0007-4be40a00_mup_signed.p7m")).toEqual({ practiceId: "p7", slotId: "mup" });
    expect(classify("VIES-2026-0008-4be40a00/2_mup.pdf.p7m")).toEqual({ practiceId: "p8", slotId: "mup" });
  });

  it("a file whose name says nothing is recognised from what is written inside", () => {
    const companyCopy = "MARKEL INSURANCE SE\nCopia COMPAGNIA/CONTRAENTE\nGARANZIA FIDEIUSSORIA n.\nB.2026.1514572\nP.IVA\n18678521008";
    expect(classify("documento_firmato.p7m", companyCopy)).toEqual({ practiceId: "p7", slotId: "polizza_firmata" });
    const mup = "Allegato 3 · Modulo Unico Precontrattuale (MUP) per i prodotti assicurativi\nPRATICA / POLIZZA N.\nVIES-2026-0008-4be40a00 · bozza 1514223 · polizza B.2026.1514223";
    expect(classify("scansione_01.pdf", mup)).toEqual({ practiceId: "p8", slotId: "mup" });
  });

  it("never attaches a file it is not sure about: beneficiary's copy, unknown practice or type, practice not yet to sign", () => {
    expect(classify("1514223_ViesBeneficiario_Markel_2026.docx.pdf.p7m")).toMatchObject({ skip: "beneficiary_copy" });
    expect(classify("scan.p7m", "MARKEL INSURANCE SE\nCopia BENEFICIARIO\nB.2026.1514223")).toMatchObject({ skip: "beneficiary_copy" });
    expect(classify("9999999_ViesCompagnia_Markel_2026.pdf.p7m")).toMatchObject({ skip: "unknown_practice" });
    expect(classify("VIES-2026-0008-4be40a00/ricevuta.pdf")).toMatchObject({ skip: "unknown_type", practiceId: "p8" });
    expect(classify("1514574_ViesCompagnia_Markel_2026.docx.pdf.p7m")).toMatchObject({ skip: "not_signing", practiceId: "p9" });
    // The client's name alone is not enough to attach a signed document.
    expect(classify("polizza Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si.pdf.p7m")).toMatchObject({ skip: "unknown_practice" });
  });

  it("tells the document type from the name, then from the content", () => {
    expect(signedSlotOf("1514223_ViesCompagnia_Markel_2026.docx.pdf.p7m")).toBe("polizza_firmata");
    expect(signedSlotOf("1514223_ViesBeneficiario_Markel_2026.docx.pdf.p7m")).toBe("beneficiary");
    expect(signedSlotOf("x.p7m", "Copia COMPAGNIA/CONTRAENTE")).toBe("polizza_firmata");
    // As pdf.js reads the company's policy: "Copia" and "COMPAGNIA/CONTRAENTE" on different lines.
    expect(signedSlotOf("x.p7m", "RAPPRESENTANTE FISCALE\nCOMPAGNIA/CONTRAENTE Via/Piazza Via Ippolito Nievo 1\nagenziaentratepec@pce.agenziaentrate.it\nCopia\nFino alla concorrenza")).toBe("polizza_firmata");
    expect(signedSlotOf("x.p7m", "agenziaentratepec@pce.agenziaentrate.it\nCopia BENEFICIARIO\nFino alla concorrenza")).toBe("beneficiary");
    expect(signedSlotOf("x.p7m", "Modulo Unico Precontrattuale (MUP)")).toBe("mup");
    // As pdf.js reads the MUP template: letters split by spaces.
    expect(signedSlotOf("x.pdf", "Tecno Advance MGA Broker Srl\nA lleg a to 3 · M o d u l o U n ic o P r ec ontr a ttu a le  MUP  p e r i pro d ott i")).toBe("mup");
    expect(signedSlotOf("x.p7m", "")).toBeNull();
  });
});
