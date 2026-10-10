import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, normalizeLanguage, sendAccessEmail } from './_lib/auth-emails.js';

/**
 * "Forgot password" for the sign-in page. Public endpoint, so:
 *  - the answer is always the same ({ ok: true }) whether the address exists or not;
 *  - the response time is padded so it does not reveal it either;
 *  - disabled accounts get nothing;
 *  - a recent request for the same address and bursts from the same IP are ignored.
 */

const MIN_RESPONSE_MS = 1500;
const COOLDOWN_PER_ADDRESS_MS = 120_000;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

function tooManyFromIp(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(key);
  return false;
}

const clientIp = (req: VercelRequest) =>
  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

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
  if (tooManyFromIp(clientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
  }

  const startedAt = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase.rpc('auth_user_for_email', { p_email: email });
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
