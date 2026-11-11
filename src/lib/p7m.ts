// Il documento dentro una busta di firma digitale CAdES (.p7m, anche "documento.pdf.p7m").
//
// La busta e' un ContentInfo PKCS#7/CMS di tipo signedData con il documento incluso (firma "attached"):
//   ContentInfo { contentType = signedData, [0] SignedData { version, digestAlgorithms,
//     encapContentInfo { eContentType, [0] eContent OCTET STRING }, ... } }
// I sistemi di firma la scrivono in DER (lunghezze definite) o in BER (lunghezze indefinite, documento spezzato
// in tanti OCTET STRING da 1000 byte: cosi' le polizze firmate della compagnia, Lotto 1, 10/11/2026), a volte
// in base64. Una busta firmata due volte in sequenza contiene un'altra busta: si apre fino al documento.
// La firma non viene verificata: serve solo leggere il documento per riconoscere a quale pratica appartiene.
//
// Nessun import: il modulo serve al browser e ai test.

interface Node {
  tag: number;
  constructed: boolean;
  /** Primo byte del contenuto. */
  valueStart: number;
  /** Fine del contenuto (esclusi i due byte 00 00 di chiusura di una lunghezza indefinita). */
  valueEnd: number;
  /** Primo byte dopo l'elemento. */
  end: number;
}

const OID_SIGNED_DATA = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
const MAX_DEPTH = 64;
const MAX_NESTED_ENVELOPES = 4;

class BerError extends Error {}

function readNode(bytes: Uint8Array, offset: number, limit: number, depth = 0): Node {
  if (depth > MAX_DEPTH) throw new BerError("troppi livelli");
  let pos = offset;
  if (pos >= limit) throw new BerError("fine dei dati");
  const first = bytes[pos++];
  const constructed = (first & 0x20) !== 0;
  let tag = first;
  if ((first & 0x1f) === 0x1f) {
    // Tag in piu' byte: non serve il numero, basta saltarlo.
    while (pos < limit && bytes[pos] & 0x80) pos += 1;
    pos += 1;
    tag = -1;
  }
  if (pos >= limit) throw new BerError("lunghezza mancante");
  const lengthByte = bytes[pos++];
  if (lengthByte === 0x80) {
    if (!constructed) throw new BerError("lunghezza indefinita su un elemento semplice");
    // Lunghezza indefinita: i figli fino ai due byte 00 00.
    const valueStart = pos;
    for (;;) {
      if (pos + 1 >= limit) throw new BerError("chiusura mancante");
      if (bytes[pos] === 0 && bytes[pos + 1] === 0) return { tag, constructed, valueStart, valueEnd: pos, end: pos + 2 };
      pos = readNode(bytes, pos, limit, depth + 1).end;
    }
  }
  let length = lengthByte;
  if (lengthByte & 0x80) {
    const count = lengthByte & 0x7f;
    if (count > 4) throw new BerError("lunghezza troppo grande");
    length = 0;
    for (let index = 0; index < count; index += 1) {
      if (pos >= limit) throw new BerError("lunghezza troncata");
      length = length * 256 + bytes[pos++];
    }
  }
  const end = pos + length;
  if (end > limit) throw new BerError("elemento troncato");
  return { tag, constructed, valueStart: pos, valueEnd: end, end };
}

function children(bytes: Uint8Array, node: Node, depth = 0): Node[] {
  const list: Node[] = [];
  for (let pos = node.valueStart; pos < node.valueEnd; ) {
    const child = readNode(bytes, pos, node.valueEnd, depth + 1);
    list.push(child);
    pos = child.end;
  }
  return list;
}

/** Il contenuto di un OCTET STRING, semplice o spezzato in piu' pezzi (anche annidati). */
function octets(bytes: Uint8Array, node: Node, depth = 0): Uint8Array[] {
  if (depth > MAX_DEPTH) throw new BerError("troppi livelli");
  if (!node.constructed) return [bytes.subarray(node.valueStart, node.valueEnd)];
  return children(bytes, node, depth).flatMap((child) => {
    if ((child.tag & 0x1f) !== 0x04) throw new BerError("pezzo del documento non valido");
    return octets(bytes, child, depth + 1);
  });
}

const concat = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
};

const sameBytes = (bytes: Uint8Array, node: Node, expected: number[]) =>
  node.valueEnd - node.valueStart === expected.length && expected.every((value, index) => bytes[node.valueStart + index] === value);

/** Una busta in base64 (con o senza le righe "-----BEGIN ...-----"): i byte DER. */
function fromBase64(bytes: Uint8Array): Uint8Array | null {
  const head = String.fromCharCode(...bytes.subarray(0, 16));
  if (!head.startsWith("MI") && !head.startsWith("-----BEGIN")) return null;
  const text = new TextDecoder("latin1").decode(bytes).replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(text)) return null;
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
    return out;
  } catch {
    return null;
  }
}

/** Il documento incluso in una sola busta, o null se i byte non sono una busta signedData con il documento. */
function openEnvelope(der: Uint8Array): Uint8Array | null {
  try {
    const root = readNode(der, 0, der.length);
    if (root.tag !== 0x30) return null;
    const [contentType, explicit] = children(der, root);
    if (!contentType || contentType.tag !== 0x06 || !sameBytes(der, contentType, OID_SIGNED_DATA)) return null;
    if (!explicit || explicit.tag !== 0xa0) return null;
    const [signedData] = children(der, explicit);
    if (!signedData || signedData.tag !== 0x30) return null;
    const encap = children(der, signedData).find((child, index) => index > 0 && child.tag === 0x30);
    if (!encap) return null;
    const [, contentHolder] = children(der, encap);
    // Firma "detached": il documento non e' nella busta.
    if (!contentHolder || contentHolder.tag !== 0xa0) return null;
    const [content] = children(der, contentHolder);
    if (!content || (content.tag & 0x1f) !== 0x04) return null;
    return concat(octets(der, content));
  } catch (error) {
    if (error instanceof BerError || error instanceof RangeError) return null;
    throw error;
  }
}

/**
 * Il documento originale dentro un file .p7m (DER, BER o base64; anche buste annidate), o null se il file non e'
 * una busta di firma con il documento incluso.
 */
export function p7mContent(bytes: Uint8Array): Uint8Array | null {
  let current = bytes[0] === 0x30 ? bytes : fromBase64(bytes);
  if (!current) return null;
  let content = openEnvelope(current);
  if (!content) return null;
  for (let level = 1; level < MAX_NESTED_ENVELOPES; level += 1) {
    current = content[0] === 0x30 ? content : fromBase64(content);
    const inner = current ? openEnvelope(current) : null;
    if (!inner) break;
    content = inner;
  }
  return content;
}

/** Il file e' una busta di firma digitale dal nome (".p7m", anche "documento.pdf.p7m"). */
export const isP7mName = (fileName: string) => /\.p7m$/i.test(fileName.trim());

/** Il PDF da leggere: quello del file, o quello dentro la busta .p7m. null se non c'e' un PDF. */
export function pdfBytesOf(bytes: Uint8Array): Uint8Array | null {
  const isPdf = (data: Uint8Array) => data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;
  if (isPdf(bytes)) return bytes;
  const inner = p7mContent(bytes);
  return inner && isPdf(inner) ? inner : null;
}
