import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito. Utilizzare GET.' });

  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: 'X-API-Key header mancante.' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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
    // Legacy fallback: accept PORTAL_API_KEY env var
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

  const { data: practice, error: practiceError } = await (
    practice_id
      ? supabaseAdmin.from('practices').select('id, practice_number, api_key_id').eq('id', practice_id)
      : supabaseAdmin.from('practices').select('id, practice_number, api_key_id').eq('practice_number', practice_number as string)
  ).maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!practice) return res.status(404).json({ error: 'Pratica non trovata.' });

  // Tenant isolation
  if (keyRecord) {
    // DB key: practice must belong to this specific key
    if (practice.api_key_id !== keyRecord.id) {
      return res.status(403).json({ error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' });
    }
  } else {
    // Legacy key: can only access practices with no DB key assigned (api_key_id IS NULL)
    if (practice.api_key_id !== null) {
      return res.status(403).json({ error: 'Accesso negato: questa pratica è gestita tramite chiave API dedicata.' });
    }
  }

  // Get documents
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_path, file_size, mime_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false });

  if (docsError) {
    console.error('practice_documents lookup failed:', docsError.message);
    return res.status(503).json({ error: 'Errore caricamento documenti.' });
  }

  // Generate signed URLs
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

  const documentsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from('practice-documents')
        .createSignedUrl(doc.file_path, SIGNED_URL_EXPIRY_SECONDS);

      if (signedError) {
        console.error(`Failed to generate signed URL for ${doc.file_name}:`, signedError.message);
      }

      return {
        id: doc.id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        created_at: doc.created_at,
        download_url: signed?.signedUrl ?? null,
        expires_at: expiresAt,
      };
    })
  );

  return res.status(200).json({
    practice_id: practice.id,
    practice_number: practice.practice_number,
    documents: documentsWithUrls,
  });
}
