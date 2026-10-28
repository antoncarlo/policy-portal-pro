import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { excerptPdf } from "../../src/lib/viesDocumentAgent";

const pdfOf = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) doc.addPage([595, 842]);
  return doc.save();
};
const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe("VIES agent excerpt", () => {
  it("keeps the first two pages and the last one of a long PDF", async () => {
    const excerpt = await excerptPdf(await pdfOf(6));
    expect(excerpt.pages).toEqual([1, 2, 6]);
    expect(excerpt.totalPages).toBe(6);
    expect(await pageCount(excerpt.bytes)).toBe(3);
  });

  it("sends a PDF of up to three pages whole", async () => {
    const bytes = await pdfOf(3);
    const excerpt = await excerptPdf(bytes);
    expect(excerpt.pages).toBeNull();
    expect(excerpt.bytes).toBe(bytes);
  });

  it("sends whole a file it cannot read as a PDF", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const excerpt = await excerptPdf(bytes);
    expect(excerpt).toEqual({ bytes, pages: null, totalPages: null });
  });
});
