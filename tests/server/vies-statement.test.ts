import { describe, expect, it } from "vitest";
import { generateViesStatementPdf } from "../../src/lib/viesStatementPdf";

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
