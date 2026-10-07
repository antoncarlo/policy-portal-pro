// Testo dei PDF con pdf.js (Mozilla): gestisce i PDF cifrati con password
// proprietario (visure e bilanci del Registro Imprese) e i font CID, che un
// parser fatto a mano non legge. Restituisce una riga per ogni riga di testo
// della pagina (elementi con la stessa ordinata, ordinati da sinistra).

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

const loadPdfjs = () => {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    return pdfjs;
  })();
  return pdfjsPromise;
};

export interface PdfTextResult {
  lines: string[];
  pages: number;
  /** false when the PDF cannot be opened (e.g. user password, corrupted). */
  readable: boolean;
}

export const extractPdfText = async (bytes: Uint8Array): Promise<PdfTextResult> => {
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    // pdf.js transfers the buffer to its worker: pass a copy.
    doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  } catch {
    return { lines: [], pages: 0, readable: false };
  }
  const lines: string[] = [];
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const rows: Array<{ y: number; items: Array<{ x: number; text: string }> }> = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
        if (row) row.items.push({ x, text: item.str });
        else rows.push({ y, items: [{ x, text: item.str }] });
      }
      rows
        .sort((a, b) => b.y - a.y)
        .forEach((row) => {
          const text = row.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (text) lines.push(text);
        });
      page.cleanup();
    }
    return { lines, pages: doc.numPages, readable: true };
  } finally {
    await doc.destroy();
  }
};
