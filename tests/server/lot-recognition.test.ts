import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { expandFiles, matchEntries, type LotFileEntry } from "../../src/lib/lotRecognition";

const entry = (path: string): LotFileEntry => ({ path, name: path.split("/").pop() ?? path, blob: new Blob(["x"]), size: 1 });
const practices = [
  { id: "p1", practice_number: "VIES-2026-1-AAAA1111", client_name: "Azienda 1 Srl" },
  { id: "p2", practice_number: "VIES-2026-12-BBBB2222", client_name: "Azienda 12 Srl" },
  { id: "p3", practice_number: "VIES-2026-3-CCCC3333", client_name: "Shenzhen Trading Co", policy_number: "POL-77881" },
];
const idOf = (path: string) => matchEntries([entry(path)], practices)[0];

describe("lot file recognition", () => {
  it("finds the practice by folder, by number in the name, or by number anywhere in the path", () => {
    expect(idOf("VIES-2026-1-AAAA1111/bozza.pdf")).toMatchObject({ practiceId: "p1", how: "number" });
    expect(idOf("VIES-2026-12-BBBB2222_bozza.pdf")).toMatchObject({ practiceId: "p2", how: "number" });
    expect(idOf("bozze/lotto/vies-2026-3-cccc3333 polizza.pdf")).toMatchObject({ practiceId: "p3", how: "number" });
  });

  it("falls back to the policy number the company gave", () => {
    expect(idOf("POL-77881.pdf")).toMatchObject({ practiceId: "p3", how: "policy" });
  });

  it("falls back to the client's name as whole words, never mixing 'Azienda 1' with 'Azienda 12'", () => {
    expect(idOf("Polizza Azienda 1 Srl.pdf")).toMatchObject({ practiceId: "p1", how: "name" });
    expect(idOf("polizza_azienda_12_srl.pdf")).toMatchObject({ practiceId: "p2", how: "name" });
    expect(idOf("Shenzhen-Trading-Co bozza.pdf")).toMatchObject({ practiceId: "p3", how: "name" });
    expect(idOf("Azienda 120 Srl.pdf")).toMatchObject({ practiceId: null, how: null });
  });

  it("leaves unrecognised files unassigned", () => {
    expect(idOf("scansione.pdf")).toMatchObject({ practiceId: null, how: null });
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
