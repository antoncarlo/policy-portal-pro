import * as crypto from 'crypto';

/**
 * Signature of the practice-creation webhook: `X-Signature: sha256=<hex HMAC-SHA256(secret, body)>`.
 *
 * The body is the exact bytes received. Until every integrator signs the bytes it sends, a signature
 * computed on the compact re-serialisation of the parsed body (what the portal used to check) is still
 * accepted and reported as `reencoded`, so the caller can warn; `allowReencoded: false` ends that.
 */
export type SignatureVerdict = 'exact' | 'reencoded' | 'invalid';

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

function matches(secret: string, body: string, provided: Buffer): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest();
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

export function verifyWebhookSignature(options: {
  secret: string;
  rawBody: string;
  header: string | undefined;
  allowReencoded?: boolean;
}): SignatureVerdict {
  const { secret, rawBody, header, allowReencoded = true } = options;
  const parts = SIGNATURE_PATTERN.exec((header ?? '').trim());
  if (!parts) return 'invalid';
  const provided = Buffer.from(parts[1], 'hex');
  if (matches(secret, rawBody, provided)) return 'exact';
  if (allowReencoded) {
    try {
      if (matches(secret, JSON.stringify(JSON.parse(rawBody)), provided)) return 'reencoded';
    } catch {
      // not JSON: nothing to re-encode
    }
  }
  return 'invalid';
}
