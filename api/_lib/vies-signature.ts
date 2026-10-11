import * as crypto from 'crypto';

/**
 * Signature of the calls between this portal and its counterparts, in both directions:
 *   X-Timestamp   seconds since 1970; a call older than five minutes is refused
 *   X-Signature   "sha256=" + hex(HMAC-SHA256(secret, timestamp + "." + raw body))
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signCallback(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export type SignatureCheck = { ok: true } | { ok: false; code: 'bad_timestamp' | 'stale_timestamp' | 'bad_signature' };

export function verifyCallbackSignature(options: {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  nowSeconds?: number;
}): SignatureCheck {
  const { secret, timestamp, signature, rawBody } = options;
  if (!timestamp || !/^\d{9,12}$/.test(timestamp)) return { ok: false, code: 'bad_timestamp' };
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, code: 'stale_timestamp' };
  if (!signature) return { ok: false, code: 'bad_signature' };
  const expected = Buffer.from(signCallback(secret, timestamp, rawBody));
  const received = Buffer.from(signature.trim());
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return { ok: false, code: 'bad_signature' };
  return { ok: true };
}
