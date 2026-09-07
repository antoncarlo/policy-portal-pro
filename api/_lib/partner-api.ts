// Utility condivise dalle API partner (X-API-Key): autenticazione, rate limit,
// logging su api_logs e perimetro dati (tenant scope) della chiave.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Client Supabase (service role)
// ---------------------------------------------------------------------------

// Le Vercel Functions non usano i tipi generati del DB: client non tipizzato.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminClient = SupabaseClient<any, any, any>;

export function createAdminClient(): AdminClient {
  return createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as AdminClient;
}

// ---------------------------------------------------------------------------
// IP e rate limiter (sliding window, per IP, in-memory per istanza)
// ---------------------------------------------------------------------------

export function getClientIp(req: VercelRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );
}

interface RateLimitEntry { count: number; windowStart: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
export const RATE_LIMIT_MAX = 100;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export interface ApiLogData {
  api_key_masked: string;
  source: string;
  ip_address: string;
  endpoint: string;
  method: string;
  status_code: number;
  practice_id?: string;
  error_message?: string;
  request_body_size: number;
  api_key_id?: string;
}

export async function logApiRequest(supabaseAdmin: AdminClient, data: ApiLogData): Promise<void> {
  const { error } = await supabaseAdmin.from('api_logs').insert(data);
  if (error) console.error('Failed to write api_log:', error.message);
}

// ---------------------------------------------------------------------------
// Autenticazione API key
// ---------------------------------------------------------------------------

export interface ApiKeyRecord {
  id: string;
  is_active: boolean;
  expires_at: string | null;
  name?: string | null;
}

export interface ApiKeyContext {
  /** Record della chiave nel DB (null se chiave legacy da env PORTAL_API_KEY). */
  keyRecord: ApiKeyRecord | null;
  keyId: string | undefined;
  apiKeyMasked: string;
  /** Utente del portale associato alla chiave (api_key_user_mapping), se presente. */
  mappedUserId: string | null;
  isLegacy: boolean;
}

export type AuthResult =
  | { ok: true; ctx: ApiKeyContext }
  | { ok: false; status: number; body: { error: string } };

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Valida l'header X-API-Key contro la tabella api_keys (con fallback legacy su
 * PORTAL_API_KEY), aggiorna last_used_at e risolve l'utente mappato.
 */
export async function authenticateApiKey(req: VercelRequest, supabaseAdmin: AdminClient): Promise<AuthResult> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) return { ok: false, status: 401, body: { error: 'X-API-Key header mancante.' } };

  const apiKeyMasked = `${apiKey.slice(0, 4)}****`;
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { data: keyData, error: keyLookupError } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at, name')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyLookupError) {
    console.error('api_keys lookup failed:', keyLookupError.message);
    return { ok: false, status: 503, body: { error: 'Servizio temporaneamente non disponibile.' } };
  }

  if (!keyData) {
    const legacyKey = process.env.PORTAL_API_KEY;
    const legacyMatch = legacyKey ? timingSafeEqualString(legacyKey, apiKey) : false;
    if (!legacyMatch) return { ok: false, status: 401, body: { error: 'API Key non valida.' } };
    return {
      ok: true,
      ctx: { keyRecord: null, keyId: undefined, apiKeyMasked, mappedUserId: null, isLegacy: true },
    };
  }

  const keyRecord = keyData as ApiKeyRecord;
  if (!keyRecord.is_active) return { ok: false, status: 401, body: { error: 'API Key disattivata.' } };
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { ok: false, status: 401, body: { error: 'API Key scaduta.' } };
  }

  // last_used_at: fire-and-forget
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {}, (err: unknown) => console.error('Failed to update last_used_at:', err));

  let mappedUserId: string | null = null;
  const { data: mapping } = await supabaseAdmin
    .from('api_key_user_mapping')
    .select('user_id')
    .eq('api_key_id', keyRecord.id)
    .maybeSingle();
  if (mapping?.user_id) mappedUserId = mapping.user_id as string;

  return {
    ok: true,
    ctx: { keyRecord, keyId: keyRecord.id, apiKeyMasked, mappedUserId, isLegacy: false },
  };
}

// ---------------------------------------------------------------------------
// Perimetro dati (tenant scope)
// ---------------------------------------------------------------------------

/**
 * Una chiave DB vede le pratiche create con la chiave stessa e, se la chiave e'
 * associata a un utente del portale, anche le pratiche di quell'utente
 * (cosi' il partner ha la dashboard completa delle proprie pratiche).
 * La chiave legacy vede solo le pratiche senza api_key_id.
 */
export function practiceBelongsToTenant(
  practice: { api_key_id: string | null; user_id?: string | null },
  ctx: ApiKeyContext
): boolean {
  if (ctx.isLegacy) return practice.api_key_id === null;
  if (practice.api_key_id === ctx.keyId) return true;
  if (ctx.mappedUserId && practice.user_id === ctx.mappedUserId) return true;
  return false;
}

/** Filtro PostgREST equivalente a practiceBelongsToTenant, da usare con `.or()`. */
export function tenantScopeFilter(ctx: ApiKeyContext): string {
  if (ctx.isLegacy) return 'api_key_id.is.null';
  const clauses = [`api_key_id.eq.${ctx.keyId}`];
  if (ctx.mappedUserId) clauses.push(`user_id.eq.${ctx.mappedUserId}`);
  return clauses.join(',');
}

// ---------------------------------------------------------------------------
// Helper per endpoint GET standard
// ---------------------------------------------------------------------------

export interface GetEndpointContext {
  supabaseAdmin: AdminClient;
  ctx: ApiKeyContext;
  ip: string;
  endpoint: string;
  method: string;
  respond: (statusCode: number, body: object, extra?: { practice_id?: string; error_message?: string }) => Promise<VercelResponse>;
}

/**
 * Gestisce CORS, metodo, rate limit e autenticazione per un endpoint GET di
 * lettura. Restituisce null se la risposta e' gia' stata inviata.
 */
export async function prepareGetEndpoint(
  req: VercelRequest,
  res: VercelResponse,
  endpoint: string
): Promise<GetEndpointContext | null> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }

  const method = req.method ?? 'UNKNOWN';
  if (method !== 'GET') {
    res.status(405).json({ error: 'Metodo non consentito. Utilizzare GET.' });
    return null;
  }

  const ip = getClientIp(req);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
    return null;
  }

  const supabaseAdmin = createAdminClient();
  const auth = await authenticateApiKey(req, supabaseAdmin);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return null;
  }

  const source = endpoint.replace(/^\/api\//, '');
  const respond = async (
    statusCode: number,
    body: object,
    extra?: { practice_id?: string; error_message?: string }
  ) => {
    await logApiRequest(supabaseAdmin, {
      api_key_masked: auth.ctx.apiKeyMasked,
      source,
      ip_address: ip,
      endpoint,
      method,
      status_code: statusCode,
      practice_id: extra?.practice_id,
      error_message: extra?.error_message,
      request_body_size: 0,
      api_key_id: auth.ctx.keyId,
    });
    return res.status(statusCode).json(body);
  };

  return { supabaseAdmin, ctx: auth.ctx, ip, endpoint, method, respond };
}

// ---------------------------------------------------------------------------
// Parsing query
// ---------------------------------------------------------------------------

export function queryString(req: VercelRequest, name: string): string | undefined {
  const raw = req.query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function queryInt(req: VercelRequest, name: string, fallback: number, min: number, max: number): number {
  const raw = queryString(req, name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function queryBool(req: VercelRequest, name: string, fallback = false): boolean {
  const raw = queryString(req, name);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'si'].includes(raw.toLowerCase());
}

/** Valida una data YYYY-MM-DD (o ISO); restituisce undefined se assente/non valida. */
export function queryDate(req: VercelRequest, name: string): string | undefined {
  const raw = queryString(req, name);
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : raw;
}

export const PRACTICE_STATUSES = ['in_lavorazione', 'in_attesa', 'approvata', 'rifiutata', 'completata'] as const;
export const FINANCIAL_STATUSES = ['non_incassata', 'incassata', 'provvigioni_ricevute'] as const;

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
