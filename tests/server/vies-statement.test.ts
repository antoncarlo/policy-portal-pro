import { describe, expect, it } from "vitest";
import { draftNumberFromFileName, generateViesStatementPdf, latestDraftNumbers } from "../../src/lib/viesStatementPdf";

const base = {
  lotNumber: 3,
  lotDate: "2026-10-01T10:00:00Z",
  representative: { name: "Colcerasa Servizi Fiscali Srl", taxCode: "12345678901" },
  policies: [{ contraente: "Azienda Uno Srl", policyNumber: null, practiceNumber: "VIES-2026-1-AAAA1111", date: "2026-10-05", premiumGross: 1000, premiumNet: 800 }],
};
const image = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", width: 1, height: 1 };

describe("lot statement signature", () => {
  it("the client statement is signed by the fiscal representative who pays, not by the agency", () => {
    const output = generateViesStatementPdf({ ...base, kind: "cliente", signature: image }).output();
    expect(output).toContain("Per accettazione e conferma del saldo");
    expect(output).toContain("Firma del rappresentante fiscale");
    expect(output).not.toMatch(/\(Firma\) Tj/);
    // The agency's signature image is not drawn on it, even if one is passed.
    expect(output).not.toContain("/Subtype /Image");
  });

  it("the internal commission statement keeps the agency's signature", () => {
    const output = generateViesStatementPdf({ ...base, kind: "provvigioni", companyName: "Compagnia", commissionPercentage: 10, withholdingPercentage: 11.5, commissionsReceivedAt: null, signature: image }).output();
    expect(output).toContain("Tecno Advance MGA Broker Srl");
    expect(output).toContain("/Subtype /Image");
    expect(output).not.toContain("Per accettazione e conferma del saldo");
  });
});

describe("draft number on the lot statement", () => {
  it("reads the draft number the company puts at the start of the draft's file name", () => {
    // The drafts of Lot 1, uploaded on 9/11/2026.
    expect(draftNumberFromFileName("1514223_ViesBozza_Markel_2026.docx-3.pdf")).toBe("1514223");
    expect(draftNumberFromFileName("1514651_ViesBozza_Markel_2026.docx.pdf")).toBe("1514651");
    expect(draftNumberFromFileName("Bozza n. 1514572.pdf")).toBe("1514572");
    expect(draftNumberFromFileName("bozza_deliberata.pdf")).toBeNull();
    expect(draftNumberFromFileName("2026_bozza.pdf")).toBeNull();
    expect(draftNumberFromFileName("VIES-2026-0008-4be40a00.pdf")).toBeNull();
  });

  it("takes the number of the latest draft of each practice that has one", () => {
    const numbers = latestDraftNumbers([
      { practice_id: "p1", file_name: "1514223_ViesBozza_Markel_2026.pdf", created_at: "2026-11-09T16:29:00Z" },
      { practice_id: "p1", file_name: "1514999_ViesBozza_Markel_2026.pdf", created_at: "2026-11-10T09:00:00Z" },
      { practice_id: "p1", file_name: "allegato.pdf", created_at: "2026-11-11T09:00:00Z" },
      { practice_id: "p2", file_name: "bozza.pdf", created_at: "2026-11-09T16:29:00Z" },
    ]);
    expect(numbers.get("p1")).toBe("1514999");
    expect(numbers.has("p2")).toBe(false);
  });

  it("shows the draft number on each row, ordered by it, to reconcile the payment with the right draft", () => {
    const output = generateViesStatementPdf({
      ...base,
      kind: "cliente",
      policies: [
        { contraente: "Seconda Srl", policyNumber: null, draftNumber: "1514651", practiceNumber: "VIES-2026-0011-4be40a00", date: "2026-11-09", premiumGross: 1000, premiumNet: 800 },
        { contraente: "Prima Srl", policyNumber: null, draftNumber: "1514223", practiceNumber: "VIES-2026-0008-4be40a00", date: "2026-11-09", premiumGross: 1000, premiumNet: 800 },
        { contraente: "Senza Bozza Srl", policyNumber: null, draftNumber: null, practiceNumber: "VIES-2026-0007-4be40a00", date: "2026-11-09", premiumGross: 1000, premiumNet: 800 },
      ],
    }).output();
    expect(output).toContain("BOZZA N. 1514223");
    expect(output).toContain("BOZZA N. 1514651");
    expect(output).toContain("PRATICA N. VIES-2026-0007-4be40a00");
    expect(output.indexOf("BOZZA N. 1514223")).toBeLessThan(output.indexOf("BOZZA N. 1514651"));
    expect(output.indexOf("BOZZA N. 1514651")).toBeLessThan(output.indexOf("PRATICA N. VIES-2026-0007-4be40a00"));
  });

  it("keeps the policy number next to the draft number once the policy is issued", () => {
    const output = generateViesStatementPdf({
      ...base,
      kind: "cliente",
      policies: [{ contraente: "Prima Srl", policyNumber: "MKL-123", draftNumber: "1514223", practiceNumber: "VIES-2026-0008-4be40a00", date: "2026-11-09", premiumGross: 1000, premiumNet: 800 }],
    }).output();
    expect(output).toContain("BOZZA N. 1514223");
    expect(output).toContain("POLIZZA N. MKL-123");
  });
});
