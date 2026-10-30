import { describe, expect, it } from "vitest";
import { agentReadingRecord, documentReadingRows, type ReadingDocument } from "../../src/lib/documentReadings";
import type { AgentDocumentResult } from "../../src/lib/viesDocumentAgent";

const AT = new Date("2026-10-30T10:00:00Z");
const reading: AgentDocumentResult = {
  document_type: "licenza_commerciale", contained_document_types: [], company_name_latin: "Shen Zhen Shi Zhu Huan", company_name_chinese: "",
  unified_social_credit_code: "91440300MA5GX639XR", italian_vat_number: "", legal_representative_name: "", legal_representative_id_number: "",
  fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "", expiry_date: "", has_italian_translation: true,
  is_signed: true, issues: [],
};

describe("Record of one reading of the document agent", () => {
  it("keeps purpose, time, model, what was read and the codes accepted by their check character", () => {
    const record = agentReadingRecord("lettura", { status: "ok", result: reading, model: "claude-sonnet-5-5", excerpt: true }, AT);
    expect(record).toEqual({
      purpose: "lettura", status: "ok", at: "2026-10-30T10:00:00.000Z", model: "claude-sonnet-5-5", excerpt: true, rechecked: false, reused: false,
      result: reading, verified: { usccs: ["91440300MA5GX639XR"], vatNumbers: [], chineseIds: [], issues: [] }, error: null,
    });
  });

  it("says when a code was misread, when the reading was redone by the more capable model and when it was reused from the tab", () => {
    const misread = agentReadingRecord("lettura", { status: "ok", result: { ...reading, unified_social_credit_code: "9144030MA5GX639XR" }, model: null }, AT);
    expect(misread.verified).toEqual({ usccs: [], vatNumbers: [], chineseIds: [], issues: ["Codice di credito sociale letto non valido: 9144030MA5GX639XR"] });
    const reread = agentReadingRecord("verifica_approfondita", { status: "ok", result: reading, model: "claude-opus-5-5", rechecked: true, cached: true }, AT);
    expect(reread).toMatchObject({ purpose: "verifica_approfondita", rechecked: true, reused: true, model: "claude-opus-5-5" });
  });

  it("keeps a failed reading with its reason and no result", () => {
    expect(agentReadingRecord("dati_anagrafici", { status: "error", message: "Documento non elaborabile." }, AT)).toEqual({
      purpose: "dati_anagrafici", status: "error", at: "2026-10-30T10:00:00.000Z", model: null, excerpt: false, rechecked: false, reused: false,
      result: null, verified: null, error: "Documento non elaborabile.",
    });
  });
});

describe("Rows of the register of the document checks of a lot", () => {
  const scanned: ReadingDocument = {
    path: "CNTBA03717/licenza.jpg", name: "licenza.jpg", size: 2048, contentHash: "a".repeat(64), recognisedBy: "agent",
    documentType: "licenza_commerciale", extraDocumentTypes: [], vatNumbers: [], usccs: ["91440300MA5GX639XR"], chineseIds: [],
    agentIssues: [], acceptedTypes: ["licenza_commerciale"],
    agentReadings: [agentReadingRecord("lettura", { status: "ok", result: reading, model: "claude-sonnet-5-5" }, AT)],
  };
  const text: ReadingDocument = {
    path: "CNTBA03717/mandato.pdf", name: "mandato.pdf", size: 4096, contentHash: "b".repeat(64), recognisedBy: "testo",
    documentType: "mandato_rappresentanza", extraDocumentTypes: ["ubo"], vatNumbers: ["18678521008"], usccs: [], chineseIds: [],
    agentIssues: [], acceptedTypes: ["mandato_rappresentanza", "ubo"], agentReadings: [],
  };

  it("writes one row per document, with the lot, the practice, the file fingerprint and everything that was checked", () => {
    const rows = documentReadingRows({
      batchId: "batch-1", lotNumber: 3, recordedBy: "user-1",
      rows: [{ rowNumber: 7, zipName: "CNTBA03717", zipFileName: "CNTBA03717.zip", practiceId: "p-1", practiceNumber: "VIES-2026-0007-abcd", documents: [scanned, text] }],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      batch_id: "batch-1", lot_number: 3, practice_id: "p-1", practice_number: "VIES-2026-0007-abcd", row_number: 7, zip_name: "CNTBA03717",
      zip_file_name: "CNTBA03717.zip", document_path: "CNTBA03717/licenza.jpg", file_name: "licenza.jpg", file_size: 2048,
      content_sha256: "a".repeat(64), recognised_by: "agent", document_type: "licenza_commerciale", extra_document_types: [],
      accepted_types: ["licenza_commerciale"], codes: { usccs: ["91440300MA5GX639XR"], vat_numbers: [], chinese_ids: [] },
      agent_readings: scanned.agentReadings, issues: [], recorded_by: "user-1",
    });
    expect(rows[1]).toMatchObject({ recognised_by: "testo", extra_document_types: ["ubo"], codes: { vat_numbers: ["18678521008"] }, agent_readings: [] });
  });

  it("keeps the documents of a row left out of the lot, without a practice", () => {
    const [row] = documentReadingRows({
      batchId: "batch-1", lotNumber: 3, recordedBy: "user-1",
      rows: [{ rowNumber: 8, zipName: "CNTBA03718", zipFileName: null, practiceId: null, practiceNumber: null, documents: [{ ...text, contentHash: null, recognisedBy: null }] }],
    });
    expect(row).toMatchObject({ practice_id: null, practice_number: null, zip_file_name: null, content_sha256: null, recognised_by: null });
  });
});
