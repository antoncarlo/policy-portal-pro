import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { expandFiles, matchEntries, type LotFileEntry } from "../../src/lib/lotRecognition";

const entry = (path: string): LotFileEntry => ({ path, name: path.split("/").pop() ?? path, blob: new Blob(["x"]), size: 1 });
const practices = [
  { id: "p1", practice_number: "VIES-2026-1-AAAA1111", client_name: "Azienda 1 Srl" },
  { id: "p2", practice_number: "VIES-2026-12-BBBB2222", client_name: "Azienda 12 Srl" },
  { id: "p3", practice_number: "VIES-2026-3-CCCC3333", client_name: "Shenzhen Trading Co", policy_number: "POL-77881", tax_code: "12345678903" },
  { id: "p4", practice_number: "VIES-2026-4-DDDD4444", client_name: "Hangzhou Export Ltd", uscc: "91330100MA2EXAMPL9" },
];
const idOf = (path: string) => matchEntries([entry(path)], practices)[0];

describe("lot file recognition", () => {
  it("finds the practice by folder, by number in the name, or by number anywhere in the path", () => {
    expect(idOf("VIES-2026-1-AAAA1111/bozza.pdf")).toMatchObject({ practiceId: "p1", how: "number_file" });
    expect(idOf("VIES-2026-12-BBBB2222_bozza.pdf")).toMatchObject({ practiceId: "p2", how: "number_file" });
    expect(idOf("bozze/lotto/vies-2026-3-cccc3333 polizza.pdf")).toMatchObject({ practiceId: "p3", how: "number_file" });
  });

  it("falls back to the policy number the company gave", () => {
    expect(idOf("POL-77881.pdf")).toMatchObject({ practiceId: "p3", how: "policy_file" });
  });

  it("falls back to the client's name as whole words, never mixing 'Azienda 1' with 'Azienda 12'", () => {
    expect(idOf("Polizza Azienda 1 Srl.pdf")).toMatchObject({ practiceId: "p1", how: "name_file" });
    expect(idOf("polizza_azienda_12_srl.pdf")).toMatchObject({ practiceId: "p2", how: "name_file" });
    expect(idOf("Shenzhen-Trading-Co bozza.pdf")).toMatchObject({ practiceId: "p3", how: "name_file" });
    expect(idOf("Azienda 120 Srl.pdf")).toMatchObject({ practiceId: null, how: null });
  });

  it("leaves unrecognised files unassigned", () => {
    expect(idOf("scansione.pdf")).toMatchObject({ practiceId: null, how: null });
  });

  it("recognises the practice from what is written inside the document, even with a meaningless file name", () => {
    const at = (name: string, text: string, options = {}) => matchEntries([entry(name)], practices, { texts: new Map([[name, text]]), ...options })[0];
    expect(at("scan_001.pdf", "Polizza fideiussoria. Contraente: SHENZHEN TRADING CO., sede a Shenzhen")).toMatchObject({ practiceId: "p3", how: "name_content" });
    expect(at("scan_002.pdf", "Contraente Azienda 12 S.r.l. - P.IVA 99999999999")).toMatchObject({ practiceId: "p2", how: "name_content" });
    expect(at("scan_003.pdf", "Pratica n. VIES-2026-1-AAAA1111 del 05/10/2026")).toMatchObject({ practiceId: "p1", how: "number_content" });
    expect(at("scan_004.pdf", "Codice fiscale / P.IVA 12345678903 - Società contraente")).toMatchObject({ practiceId: "p3", how: "tax_content" });
    expect(at("scan_005.pdf", "Unified social credit code 91330100MA2EXAMPL9")).toMatchObject({ practiceId: "p4", how: "tax_content" });
    expect(at("scan_006.pdf", "Polizza n. POL-77881")).toMatchObject({ practiceId: "p3", how: "policy_content" });
    // The number in the name wins; a file with no text keeps the name's answer; a name that says nothing stays unassigned.
    expect(at("VIES-2026-1-AAAA1111.pdf", "Contraente Azienda 12 S.r.l.")).toMatchObject({ practiceId: "p1", how: "number_file" });
    expect(at("Azienda 1 Srl.pdf", "")).toMatchObject({ practiceId: "p1", how: "name_file" });
    expect(at("scan_007.pdf", "Documento senza dati del cliente")).toMatchObject({ practiceId: null, how: null });
  });

  it("one file per practice: of two files for the same client the better recognised stays, the other goes to the hand", () => {
    const entries = [entry("scan_a.pdf"), entry("VIES-2026-3-CCCC3333_bozza.pdf"), entry("scan_c.pdf")];
    const texts = new Map([["scan_a.pdf", "Contraente Shenzhen Trading Co"], ["scan_c.pdf", "Contraente Azienda 1 Srl"]]);
    const result = matchEntries(entries, practices, { exclusive: true, texts });
    expect(result.map((match) => match.practiceId)).toEqual([null, "p3", "p1"]);
    expect(result[0]).toMatchObject({ how: null, duplicate: true });
    // Without exclusivity (issued policies, several copies) both stay with the practice.
    expect(matchEntries(entries, practices, { exclusive: false, texts }).map((match) => match.practiceId)).toEqual(["p3", "p3", "p1"]);
  });

  it("reads PDFs and ZIPs (also nested), and lists what it ignored", async () => {
    const inner = new JSZip();
    inner.file("VIES-2026-3-CCCC3333/copia.pdf", "%PDF-1.4");
    const zip = new JSZip();
    zip.file("VIES-2026-1-AAAA1111/bozza.pdf", "%PDF-1.4");
    zip.file("VIES-2026-1-AAAA1111/nota.txt", "x");
    zip.file("__MACOSX/._bozza.pdf", "x");
    zip.file("interno.zip", await inner.generateAsync({ type: "uint8array" }));
    const buffer = await zip.generateAsync({ type: "uint8array" });
    const files = [new File([buffer], "bozze.zip", { type: "application/zip" }), new File(["%PDF-1.4"], "singola.pdf"), new File(["x"], "foto.png")];
    const { entries, ignored } = await expandFiles(files);
    expect(entries.map((item) => item.path).sort()).toEqual(["VIES-2026-1-AAAA1111/bozza.pdf", "interno.zip/VIES-2026-3-CCCC3333/copia.pdf", "singola.pdf"]);
    expect(ignored.sort()).toEqual(["VIES-2026-1-AAAA1111/nota.txt", "foto.png"]);
  });
});
