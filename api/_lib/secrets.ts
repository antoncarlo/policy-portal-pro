import * as crypto from 'crypto';

/** Compares the Authorization header with "Bearer <secret>" for each configured secret, in constant time. */
export function bearerMatches(header: string | undefined, secrets: Array<string | undefined>): boolean {
  if (typeof header !== 'string') return false;
  const provided = crypto.createHash('sha256').update(header).digest();
  let matched = false;
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = crypto.createHash('sha256').update(`Bearer ${secret}`).digest();
    // Both digests have the same length: timingSafeEqual never throws and never leaks where they differ.
    if (crypto.timingSafeEqual(provided, expected)) matched = true;
  }
  return matched;
}
