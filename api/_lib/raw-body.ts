import type { VercelRequest } from '@vercel/node';

export class RawBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body larger than ${maxBytes} bytes`);
  }
}

/**
 * The body exactly as received. Functions that check a signature export `config = { api: { bodyParser: false } }`
 * and read it here: re-serialising a parsed body changes bytes (spacing, key order, number and unicode
 * escaping) and a valid signature would no longer match.
 */
export async function readRawBody(req: VercelRequest, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > maxBytes) throw new RawBodyTooLargeError(maxBytes);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
