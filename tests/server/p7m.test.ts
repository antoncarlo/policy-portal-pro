import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isP7mName, p7mContent, pdfBytesOf } from "../../src/lib/p7m";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/p7m/${name}`, import.meta.url)));
const PDF = fixture("copia-compagnia.pdf");

// A minimal BER writer, to build envelopes the way the signing systems do (lengths, chunks, nesting).
const len = (n: number) => (n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff]);
const definite = (tag: number, body: Uint8Array) => new Uint8Array([tag, ...len(body.length), ...body]);
const indefinite = (tag: number, body: Uint8Array) => new Uint8Array([tag, 0x80, ...body, 0, 0]);
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
};
const OID_SIGNED = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
const OID_DATA = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);
const SHA256 = definite(0x31, definite(0x30, new Uint8Array([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])));
const SIGNER_INFOS = definite(0x31, new Uint8Array());

/** An envelope with the document inside: definite lengths (DER) or indefinite with the document in chunks (BER). */
function envelope(content: Uint8Array | null, mode: "der" | "ber" = "ber", chunk = 1000) {
  const wrap = mode === "der" ? definite : indefinite;
  let eContent: Uint8Array | null = null;
  if (content) {
    if (mode === "der") eContent = definite(0x04, content);
    else {
      const pieces: Uint8Array[] = [];
      for (let pos = 0; pos < content.length; pos += chunk) pieces.push(definite(0x04, content.subarray(pos, pos + chunk)));
      eContent = indefinite(0x24, join(...pieces));
    }
  }
  const encap = wrap(0x30, eContent ? join(OID_DATA, wrap(0xa0, eContent)) : OID_DATA);
  const signedData = wrap(0x30, join(new Uint8Array([0x02, 0x01, 0x01]), SHA256, encap, SIGNER_INFOS));
  return wrap(0x30, join(OID_SIGNED, wrap(0xa0, signedData)));
}
const same = (a: Uint8Array | null, b: Uint8Array) => a !== null && a.length === b.length && a.every((value, index) => value === b[index]);

describe("p7m: the document inside a digital signature envelope", () => {
  it("opens the envelopes written by a real signing tool, in DER and in BER", () => {
    expect(same(p7mContent(fixture("copia-compagnia-der.pdf.p7m")), PDF)).toBe(true);
    expect(same(p7mContent(fixture("copia-compagnia-ber.pdf.p7m")), PDF)).toBe(true);
  });

  it("joins the document split in 1000-byte pieces, as in the company's signed policies", () => {
    expect(same(p7mContent(envelope(PDF, "ber", 1000)), PDF)).toBe(true);
    expect(same(p7mContent(envelope(PDF, "ber", 7)), PDF)).toBe(true);
    expect(same(p7mContent(envelope(PDF, "der")), PDF)).toBe(true);
  });

  it("opens an envelope signed twice in a row and one written as base64 text", () => {
    expect(same(p7mContent(envelope(envelope(PDF, "der"), "ber")), PDF)).toBe(true);
    const base64 = Buffer.from(envelope(PDF, "der")).toString("base64");
    expect(same(p7mContent(new TextEncoder().encode(base64)), PDF)).toBe(true);
    const pem = `-----BEGIN PKCS7-----\n${base64.replace(/(.{64})/g, "$1\n")}\n-----END PKCS7-----\n`;
    expect(same(p7mContent(new TextEncoder().encode(pem)), PDF)).toBe(true);
  });

  it("returns null for what is not an envelope with the document: detached signature, a PDF, damaged or cut files", () => {
    expect(p7mContent(envelope(null, "der"))).toBeNull();
    expect(p7mContent(PDF)).toBeNull();
    expect(p7mContent(new Uint8Array([0x30, 0x80, 0x06]))).toBeNull();
    const whole = envelope(PDF, "ber");
    expect(p7mContent(whole.subarray(0, whole.length - 300))).toBeNull();
    expect(p7mContent(new TextEncoder().encode("MIIB non è base64 valido!"))).toBeNull();
    expect(p7mContent(new Uint8Array())).toBeNull();
  });

  it("gives the PDF to read: the file itself, or the one inside the envelope", () => {
    expect(same(pdfBytesOf(PDF), PDF)).toBe(true);
    expect(same(pdfBytesOf(fixture("copia-compagnia-ber.pdf.p7m")), PDF)).toBe(true);
    expect(pdfBytesOf(envelope(new TextEncoder().encode("<xml/>"), "der"))).toBeNull();
    expect(isP7mName("1514223_ViesCompagnia_Markel_2026.docx.pdf.p7m")).toBe(true);
    expect(isP7mName("1514223_ViesCompagnia_Markel_2026.P7M ")).toBe(true);
    expect(isP7mName("polizza.pdf")).toBe(false);
  });
});
