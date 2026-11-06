// Large documents are made lighter, in the browser, before the document agent reads them: the agent only needs to see
// the pages, not the full resolution of a 100 MB scan. A PDF over the limit becomes a PDF of the same pages as JPEG
// images, an image over the limit a smaller JPEG; resolution is lowered step by step until it fits. The original file
// is never changed: it stays in the ZIP that is archived with the lot. Documents within the limits are sent as they are.

import { loadPdfjs } from "./pdfText";

/** A PDF up to this size is sent as it is (the agent's function accepts about 22 MB). */
export const AGENT_MAX_PDF_BYTES = 20 * 1024 * 1024;
/** An image up to this size is sent as it is (the API accepts 10 MB of base64 per image). */
export const AGENT_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
/** Largest side of an image the API accepts. */
const MAX_IMAGE_SIDE = 8000;

interface Step {
  /** Longest side in pixels. */
  maxSide: number;
  /** JPEG quality. */
  quality: number;
}

// From the sharpest. For a PDF page 2400 px is about 200 dpi on A4; an image keeps more pixels, up to the API's 8000.
const PDF_STEPS: Step[] = [
  { maxSide: 2400, quality: 0.85 },
  { maxSide: 2000, quality: 0.8 },
  { maxSide: 1600, quality: 0.75 },
  { maxSide: 1280, quality: 0.7 },
];
const IMAGE_STEPS: Step[] = [
  { maxSide: MAX_IMAGE_SIDE, quality: 0.85 },
  { maxSide: 4000, quality: 0.8 },
  { maxSide: 3000, quality: 0.75 },
  { maxSide: 2000, quality: 0.7 },
];

export interface AgentDocument {
  bytes: Uint8Array;
  mediaType: string;
  /** The agent reads a lighter copy, not the original file. */
  compressed: boolean;
}

const canvasToJpeg = async (canvas: HTMLCanvasElement, quality: number) => {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("JPEG non generato");
  return new Uint8Array(await blob.arrayBuffer());
};

const scaled = (width: number, height: number, maxSide: number) => {
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
};

/** The pages of a PDF as JPEG images in a new PDF, each page keeping its size on paper. */
const rasterizePdf = async (bytes: Uint8Array, step: Step) => {
  const pdfjs = await loadPdfjs();
  const { PDFDocument } = await import("pdf-lib");
  // pdf.js transfers the buffer to its worker: pass a copy.
  const source = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const output = await PDFDocument.create();
    for (let pageNo = 1; pageNo <= source.numPages; pageNo += 1) {
      const page = await source.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(step.maxSide / Math.max(base.width, base.height), 4);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas non disponibile");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const jpeg = await output.embedJpg(await canvasToJpeg(canvas, step.quality));
      output.addPage([base.width, base.height]).drawImage(jpeg, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    return new Uint8Array(await output.save());
  } finally {
    await source.destroy();
  }
};

const resizeImage = async (bytes: Uint8Array, mediaType: string, step: Step) => {
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mediaType }));
  try {
    const size = scaled(bitmap.width, bitmap.height, step.maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas non disponibile");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const jpeg = await canvasToJpeg(canvas, step.quality);
    canvas.width = 0;
    canvas.height = 0;
    return jpeg;
  } finally {
    bitmap.close();
  }
};

/** The document as the agent should receive it: the file itself, or a lighter copy when it is over the limits. */
export async function documentForAgent(bytes: Uint8Array, mediaType: string): Promise<AgentDocument> {
  const isPdf = mediaType === "application/pdf";
  const limit = isPdf ? AGENT_MAX_PDF_BYTES : AGENT_MAX_IMAGE_BYTES;
  if (bytes.length <= limit) return { bytes, mediaType, compressed: false };

  let smallest: Uint8Array | null = null;
  for (const step of isPdf ? PDF_STEPS : IMAGE_STEPS) {
    const light = isPdf ? await rasterizePdf(bytes, step) : await resizeImage(bytes, mediaType, step);
    if (!smallest || light.length < smallest.length) smallest = light;
    if (light.length <= limit) break;
  }
  return { bytes: smallest!, mediaType: isPdf ? mediaType : "image/jpeg", compressed: true };
}
