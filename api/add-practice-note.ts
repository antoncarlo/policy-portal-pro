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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = '/api/add-practice-note';
  const method = req.method ?? 'UNKNOWN';
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare POST.' });
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
  let keyRecord: { id: string; is_active: boolean; expires_at: string | null } | null = null;

  // Validate API key against DB
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: keyData, error: keyLookupError } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyLookupError) {
    console.error('api_keys lookup failed:', keyLookupError.message);
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!keyData) {
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
    keyRecord = keyData;
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

  // Parse body
  const body = req.body;
  const practiceId = body?.practice_id as string | undefined;
  const practiceNumber = body?.practice_number as string | undefined;
  const message = body?.message as string | undefined;
  const authorName = body?.author_name as string | undefined;

  if (!practiceId && !practiceNumber) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number nel body.' });
  }
  if (!message || message.trim().length === 0) {
    return res.status(422).json({ error: 'Il campo message e obbligatorio e non puo essere vuoto.' });
  }
  if (message.trim().length > 5000) {
    return res.status(422).json({ error: 'Il messaggio non puo superare i 5000 caratteri.' });
  }

  // Resolve practice
  const practiceQuery = practiceId
    ? supabaseAdmin.from('practices').select('id, api_key_id').eq('id', practiceId)
    : supabaseAdmin.from('practices').select('id, api_key_id').eq('practice_number', practiceNumber as string);

  const { data: practice, error: practiceError } = await practiceQuery.maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!practice) {
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'add-practice-note', ip_address: ip,
      endpoint, method, status_code: 404, error_message: 'Practice not found',
      request_body_size: JSON.stringify(body).length, api_key_id: resolvedKeyId,
    });
    return res.status(404).json({ error: 'Pratica non trovata.' });
  }

  // Tenant isolation
  if (keyRecord) {
    if (practice.api_key_id !== keyRecord.id) {
      await logRequest(supabaseAdmin, {
        api_key_masked: apiKeyMasked, source: 'add-practice-note', ip_address: ip,
        endpoint, method, status_code: 403, error_message: 'Tenant isolation: key mismatch',
        request_body_size: JSON.stringify(body).length, api_key_id: resolvedKeyId,
      });
      return res.status(403).json({ error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' });
    }
  } else {
    if (practice.api_key_id !== null) {
      return res.status(403).json({ error: 'Accesso negato: questa pratica e gestita tramite chiave API dedicata.' });
    }
  }

  // Resolve created_by: use api_key_user_mapping to find the user_id associated with this key
  let createdBy = 'api-external';
  if (resolvedKeyId) {
    const { data: mapping } = await supabaseAdmin
      .from('api_key_user_mapping')
      .select('user_id')
      .eq('api_key_id', resolvedKeyId)
      .maybeSingle();
    if (mapping?.user_id) {
      createdBy = mapping.user_id;
    }
  }

  // Build description with author name prefix for display
  const displayAuthor = authorName?.trim() || 'Partner API';
  const description = `[${displayAuthor}] ${message.trim()}`;

  // Insert practice event with event_type = 'nota'
  const { data: insertedEvent, error: insertError } = await supabaseAdmin
    .from('practice_events')
    .insert({
      practice_id: practice.id,
      event_type: 'nota',
      description,
      created_by: createdBy,
    })
    .select('id, created_at')
    .single();

  if (insertError) {
    console.error('Failed to insert practice_event:', insertError.message);
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'add-practice-note', ip_address: ip,
      endpoint, method, status_code: 500, error_message: insertError.message,
      practice_id: practice.id, request_body_size: JSON.stringify(body).length, api_key_id: resolvedKeyId,
    });
    return res.status(500).json({ error: 'Errore durante il salvataggio della nota.' });
  }

  // Log success
  await logRequest(supabaseAdmin, {
    api_key_masked: apiKeyMasked, source: 'add-practice-note', ip_address: ip,
    endpoint, method, status_code: 201, practice_id: practice.id,
    request_body_size: JSON.stringify(body).length, api_key_id: resolvedKeyId,
  });

  return res.status(201).json({
    success: true,
    event_id: insertedEvent.id,
    practice_id: practice.id,
    message: message.trim(),
    author: displayAuthor,
    created_at: insertedEvent.created_at,
  });
}
