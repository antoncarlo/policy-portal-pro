import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Rate limiter (sliding window, per IP)
// ---------------------------------------------------------------------------

interface RateLimitEntry { count: number; windowStart: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
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
// Logging helper
// ---------------------------------------------------------------------------

async function logRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  data: {
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
): Promise<void> {
  await supabaseAdmin.from('api_logs').insert(data).then(({ error }) => {
    if (error) console.error('Failed to write api_log:', error.message);
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = '/api/get-practice-status';
  const method = req.method ?? 'UNKNOWN';
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare GET.' });
  }

  // Rate limit
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  // API Key
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: 'X-API-Key header mancante.' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const apiKeyMasked = `${apiKey.slice(0, 4)}****`;
  let resolvedKeyId: string | undefined;

  // Validate API key against DB
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: keyRecord, error: keyLookupError } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyLookupError) {
    console.error('api_keys lookup failed:', keyLookupError.message);
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!keyRecord) {
    // Legacy fallback
    const legacyKey = process.env.PORTAL_API_KEY;
    const legacyMatch = legacyKey
      ? (() => {
          const a = Buffer.from(legacyKey, 'utf8');
          const b = Buffer.from(apiKey, 'utf8');
          return a.length === b.length && crypto.timingSafeEqual(a, b);
        })()
      : false;
    if (!legacyMatch) return res.status(401).json({ error: 'API Key non valida.' });
  } else {
    if (!keyRecord.is_active) return res.status(401).json({ error: 'API Key disattivata.' });
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API Key scaduta.' });
    }
    resolvedKeyId = keyRecord.id;
    // Update last_used_at (fire-and-forget)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {})
      .catch((err: unknown) => console.error('Failed to update last_used_at:', err));
  }

  // Resolve practice
  const { practice_id, practice_number } = req.query as Record<string, string | undefined>;
  if (!practice_id && !practice_number) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number come query param.' });
  }

  const practiceSelect = `
    id, practice_number, practice_type, status, financial_status,
    client_name, client_email, client_phone, beneficiary,
    policy_number, policy_start_date, policy_end_date,
    premium_net, premium_taxable, premium_taxes, premium_gross,
    commission_percentage, commission_amount,
    notes, api_key_id, created_at, updated_at
  `.replace(/\s+/g, ' ').trim();

  const { data: practice, error: practiceError } = await (
    practice_id
      ? supabaseAdmin.from('practices').select(practiceSelect).eq('id', practice_id)
      : supabaseAdmin.from('practices').select(practiceSelect).eq('practice_number', practice_number as string)
  ).maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
      endpoint, method, status_code: 503, error_message: practiceError.message,
      request_body_size: 0, api_key_id: resolvedKeyId,
    });
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!practice) {
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
      endpoint, method, status_code: 404, error_message: 'Practice not found',
      request_body_size: 0, api_key_id: resolvedKeyId,
    });
    return res.status(404).json({ error: 'Pratica non trovata.' });
  }

  // Tenant isolation
  if (keyRecord) {
    if (practice.api_key_id !== keyRecord.id) {
      await logRequest(supabaseAdmin, {
        api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
        endpoint, method, status_code: 403, error_message: 'Tenant isolation: key mismatch',
        request_body_size: 0, api_key_id: resolvedKeyId,
      });
      return res.status(403).json({ error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' });
    }
  } else {
    if (practice.api_key_id !== null) {
      return res.status(403).json({ error: 'Accesso negato: questa pratica è gestita tramite chiave API dedicata.' });
    }
  }

  // Fetch practice events (timeline)
  const { data: events } = await supabaseAdmin
    .from('practice_events')
    .select('event_type, description, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: true })
    .limit(50);

  // Fetch documents metadata (no signed URLs here, use get-practice-documents for downloads)
  const { data: docs } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_size, mime_type, document_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Build response — expose financial data as "quote/preventivo" info
  const quote = (practice.premium_gross || practice.premium_net) ? {
    premium_net: practice.premium_net,
    premium_taxable: practice.premium_taxable,
    premium_taxes: practice.premium_taxes,
    premium_gross: practice.premium_gross,
    commission_percentage: practice.commission_percentage,
    commission_amount: practice.commission_amount,
  } : null;

  // Strip internal fields from notes (remove idempotency prefix)
  let cleanNotes = practice.notes ?? null;
  if (cleanNotes && cleanNotes.startsWith('idempotency:')) {
    const newlineIdx = cleanNotes.indexOf('\n');
    cleanNotes = newlineIdx >= 0 ? cleanNotes.slice(newlineIdx + 1).trim() || null : null;
  }

  // Log success
  await logRequest(supabaseAdmin, {
    api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
    endpoint, method, status_code: 200, practice_id: practice.id,
    request_body_size: 0, api_key_id: resolvedKeyId,
  });

  return res.status(200).json({
    practice_id: practice.id,
    practice_number: practice.practice_number,
    practice_type: practice.practice_type,
    status: practice.status,
    financial_status: practice.financial_status,
    client: {
      name: practice.client_name,
      email: practice.client_email,
      phone: practice.client_phone,
      beneficiary: practice.beneficiary,
    },
    policy: {
      number: practice.policy_number,
      start_date: practice.policy_start_date,
      end_date: practice.policy_end_date,
    },
    quote,
    notes: cleanNotes,
    documents_count: docs?.length ?? 0,
    documents: (docs ?? []).map(d => ({
      id: d.id,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      document_type: d.document_type,
      created_at: d.created_at,
    })),
    events: (events ?? []).map(e => ({
      event_type: e.event_type,
      description: e.description,
      created_at: e.created_at,
    })),
    created_at: practice.created_at,
    updated_at: practice.updated_at,
  });
}
