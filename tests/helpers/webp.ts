// Width and height of a WebP file, read from its header (lossy, lossless and extended formats).
import { readFileSync } from "node:fs";

export function webpSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error(`${file}: not a WebP file`);
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}
