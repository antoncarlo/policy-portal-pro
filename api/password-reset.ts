import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { getSupabaseAdmin, normalizeLanguage, sendAccessEmail } from './_lib/auth-emails.js';
import { getClientIp } from './_lib/partner-api.js';
import { hitRateLimit } from './_lib/rate-limit.js';

/**
 * "Forgot password" for the sign-in page. Public endpoint, so:
 *  - the answer is always the same ({ ok: true }) whether the address exists or not;
 *  - the response time is padded so it does not reveal it either;
 *  - disabled accounts get nothing;
 *  - a recent request for the same address, more than a few an hour for it, and bursts from the same IP
 *    are ignored (the counters are in the database, shared by every instance).
 */

const MIN_RESPONSE_MS = 1500;
const COOLDOWN_PER_ADDRESS_MS = 120_000;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const MAX_PER_ADDRESS_PER_HOUR = 3;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare POST.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Indirizzo email non valido' });
  const supabase = getSupabaseAdmin();
  const fromIp = await hitRateLimit(supabase, `password-reset:ip:${getClientIp(req)}`, { limit: MAX_PER_WINDOW, windowSeconds: WINDOW_MS / 1000 });
  if (!fromIp.allowed) {
    res.setHeader('Retry-After', String(fromIp.retryAfter));
    return res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
  }

  const startedAt = Date.now();
  try {
    // Too many for one address (from any number of IPs): same answer, nothing sent, nothing revealed.
    const addressHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
    const forAddress = await hitRateLimit(supabase, `password-reset:address:${addressHash}`, { limit: MAX_PER_ADDRESS_PER_HOUR, windowSeconds: 3600 });
    const { data: rows, error } = forAddress.allowed ? await supabase.rpc('auth_user_for_email', { p_email: email }) : { data: null, error: null };
    if (error) throw new Error(error.message);
    const user = (rows as Array<{ id: string; banned: boolean; recovery_sent_at: string | null }> | null)?.[0];

    const recentlySent = user?.recovery_sent_at ? Date.now() - Date.parse(user.recovery_sent_at) < COOLDOWN_PER_ADDRESS_MS : false;
    if (user && !user.banned && !recentlySent) {
      const { data: profile } = await supabase.from('profiles').select('full_name, language').eq('id', user.id).maybeSingle();
      const result = await sendAccessEmail(supabase, {
        kind: 'recovery',
        email,
        name: profile?.full_name ?? '',
        language: normalizeLanguage(profile?.language ?? body.language),
      });
      if (!result.sent) console.error('password-reset: email non inviata:', result.reason);
    }
  } catch (error) {
    // The person who asked gets the same answer: the cause stays in the server log.
    console.error('password-reset:', error instanceof Error ? error.message : error);
  }

  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
  return res.status(200).json({ ok: true });
}
