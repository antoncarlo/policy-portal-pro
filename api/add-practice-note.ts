import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authenticateApiKey,
  checkRateLimit,
  createAdminClient,
  getClientIp,
  logApiRequest,
  practiceBelongsToTenant,
} from './_lib/partner-api.js';

// ---------------------------------------------------------------------------
// POST /api/add-practice-note
// Aggiunge una nota/messaggio del partner nella timeline della pratica.
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = '/api/add-practice-note';
  const method = req.method ?? 'UNKNOWN';
  const ip = getClientIp(req);

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare POST.' });
  }

  // Rate limit
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  const supabaseAdmin = createAdminClient();
  const auth = await authenticateApiKey(req, supabaseAdmin);
  if (!auth.ok) return res.status(auth.status).json(auth.body);
  const { ctx } = auth;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');

  const respond = async (
    statusCode: number,
    payload: object,
    extra?: { practice_id?: string; error_message?: string }
  ) => {
    await logApiRequest(supabaseAdmin, {
      api_key_masked: ctx.apiKeyMasked,
      source: 'add-practice-note',
      ip_address: ip,
      endpoint,
      method,
      status_code: statusCode,
      practice_id: extra?.practice_id,
      error_message: extra?.error_message,
      request_body_size: bodySize,
      api_key_id: ctx.keyId,
    });
    return res.status(statusCode).json(payload);
  };

  const practiceId = typeof body.practice_id === 'string' ? body.practice_id : undefined;
  const practiceNumber = typeof body.practice_number === 'string' ? body.practice_number : undefined;
  const message = typeof body.message === 'string' ? body.message : undefined;
  const authorName = typeof body.author_name === 'string' ? body.author_name : undefined;

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
    ? supabaseAdmin.from('practices').select('id, api_key_id, user_id').eq('id', practiceId)
    : supabaseAdmin.from('practices').select('id, api_key_id, user_id').eq('practice_number', practiceNumber as string);

  const { data: practice, error: practiceError } = await practiceQuery.maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: practiceError.message });
  }

  if (!practice) {
    return respond(404, { error: 'Pratica non trovata.' }, { error_message: 'Practice not found' });
  }

  if (!practiceBelongsToTenant(practice, ctx)) {
    return respond(403, { error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' },
      { error_message: 'Tenant isolation: key mismatch' });
  }

  // created_by: utente del portale associato alla chiave, altrimenti marker esterno
  const createdBy = ctx.mappedUserId ?? 'api-external';

  const displayAuthor = authorName?.trim() || 'Partner API';
  const description = `[${displayAuthor}] ${message.trim()}`;

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
    return respond(500, { error: 'Errore durante il salvataggio della nota.' },
      { practice_id: practice.id, error_message: insertError.message });
  }

  return respond(201, {
    success: true,
    event_id: insertedEvent.id,
    practice_id: practice.id,
    message: message.trim(),
    author: displayAuthor,
    created_at: insertedEvent.created_at,
  }, { practice_id: practice.id });
}
