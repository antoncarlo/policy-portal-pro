import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PRACTICE_TYPES = [
  'car', 'casa', 'fidejussioni', 'rc', 'pet', 'fotovoltaico',
  'catastrofali', 'azienda', 'postuma_decennale', 'all_risk', 'risparmio', 'salute',
];

const requiredDocsByType: Record<string, string[]> = {
  car: ['preventivo_o_contratto', 'visura_camerale'],
  fidejussioni: ['visura_camerale', 'bilancio_ultimo_anno', 'documento_identita_legale_rappresentante'],
  postuma_decennale: ['collaudo_statico', 'progetto_esecutivo', 'visura_camerale'],
  all_risk: ['lista_macchinari', 'visura_camerale'],
  rc: ['visura_camerale', 'documento_identita'],
  pet: ['libretto_sanitario_o_microchip'],
  fotovoltaico: ['progetto_impianto', 'visura_camerale'],
  catastrofali: ['perizia_immobile', 'visura_catastale'],
  azienda: ['visura_camerale', 'bilancio'],
  casa: ['visura_catastale', 'documento_identita'],
  risparmio: ['documento_identita', 'profilo_rischio_mifid'],
  salute: ['documento_identita', 'questionario_sanitario'],
};

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB decoded

// ---------------------------------------------------------------------------
// In-memory rate limiter (sliding window, per IP)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

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
    const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------

function computeHmac(secret: string, body: string): Buffer {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest();
}

function validateSignature(secret: string, rawBody: string, signatureHeader: string): boolean {
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const provided = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
  const expected = computeHmac(secret, rawBody);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// Practice-number generator (mirrors DB trigger format PR-YYYY-NNNN)
// ---------------------------------------------------------------------------

function generatePracticeNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PR-${year}-${rand}`;
}

// ---------------------------------------------------------------------------
// Admin email notification (direct Resend call — no frontend import)
// ---------------------------------------------------------------------------

async function notifyAdminNewPractice(params: {
  practiceNumber: string;
  practiceType: string;
  clientName: string;
  clientEmail: string;
  agentName: string;
  agentEmail: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAILS || 'info@tecnomga.com,antoncarlo@tecnomga.com')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const dateStr = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

  const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        <tr><td style="background:#1a2744;padding:24px 32px">
          <h1 style="margin:0;color:#fff;font-size:20px">🆕 Nuova Pratica Caricata</h1>
          <p style="margin:4px 0 0;color:#a8b8d8;font-size:14px">Portale Tecno Advance MGA</p>
        </td></tr>
        <tr><td style="padding:32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
            <tr style="background:#1a2744;color:#fff">
              <th style="padding:10px 14px;text-align:left">Campo</th>
              <th style="padding:10px 14px;text-align:left">Valore</th>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-weight:600;color:#374151">Numero Pratica</td>
              <td style="padding:10px 14px;color:#111827">${params.practiceNumber}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600;color:#374151">Tipo Polizza</td>
              <td style="padding:10px 14px;color:#111827">${params.practiceType}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-weight:600;color:#374151">Cliente</td>
              <td style="padding:10px 14px;color:#111827">${params.clientName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600;color:#374151">Email Cliente</td>
              <td style="padding:10px 14px;color:#111827">${params.clientEmail}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-weight:600;color:#374151">Caricata da</td>
              <td style="padding:10px 14px;color:#111827">${params.agentName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600;color:#374151">Email Agente</td>
              <td style="padding:10px 14px;color:#111827">${params.agentEmail}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-weight:600;color:#374151">Data/Ora</td>
              <td style="padding:10px 14px;color:#111827">${dateStr}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f4f6f8;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#6b7280">Portale Tecno Advance MGA — Notifica automatica</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = `🆕 Nuova Pratica Caricata (API): ${params.practiceNumber} — ${params.practiceType}`;

  await Promise.allSettled(
    adminEmails.map(to =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Tecno Advance MGA <notifiche@tecnomga.com>',
          to: [to],
          subject,
          html,
        }),
      })
    )
  );
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
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Signature, X-Idempotency-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = '/api/webhook-receive-policy';
  const method = req.method ?? 'UNKNOWN';
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const apiKeyMasked = apiKey ? `${apiKey.slice(0, 4)}****` : 'none';

  let resolvedKeyRecord: { id: string; is_active: boolean; expires_at: string | null } | null = null;

  const logAndRespond = async (
    statusCode: number,
    body: object,
    extraLog?: { source?: string; practice_id?: string; error_message?: string; size?: number }
  ) => {
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked,
      source: extraLog?.source ?? 'unknown',
      ip_address: ip,
      endpoint,
      method,
      status_code: statusCode,
      practice_id: extraLog?.practice_id,
      error_message: extraLog?.error_message,
      request_body_size: extraLog?.size ?? 0,
      api_key_id: resolvedKeyRecord?.id,
    });
    return res.status(statusCode).json(body);
  };

  // 1. Method check
  if (method !== 'POST') {
    return logAndRespond(405, { error: 'Metodo non consentito. Utilizzare POST.' });
  }

  // 2. IP whitelist
  const allowedIps = (process.env.ALLOWED_IPS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
    return logAndRespond(403, { error: 'IP non autorizzato.' }, { error_message: `IP blocked: ${ip}` });
  }

  // 3. Rate limit
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return logAndRespond(429, { error: 'Troppe richieste. Riprova tra qualche secondo.', retry_after: retryAfter });
  }

  // 4. API Key — validate against api_keys table (DB-based multi-tenant)
  if (!apiKey) {
    return logAndRespond(401, { error: 'X-API-Key header mancante.' });
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: dbKeyRecord } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();
  resolvedKeyRecord = dbKeyRecord;
  const keyRecord = dbKeyRecord;

  // Fallback: accept legacy PORTAL_API_KEY env var if no DB keys exist yet
  const legacyKey = process.env.PORTAL_API_KEY;
  const legacyMatch = legacyKey
    ? (() => {
        const a = Buffer.from(legacyKey, 'utf8');
        const b = Buffer.from(apiKey, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      })()
    : false;

  if (!keyRecord && !legacyMatch) {
    return logAndRespond(401, { error: 'API Key non valida.' }, { error_message: 'Key not found in DB' });
  }

  if (keyRecord) {
    if (!keyRecord.is_active) {
      return logAndRespond(401, { error: 'API Key disattivata.' }, { error_message: 'Key inactive' });
    }
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return logAndRespond(401, { error: 'API Key scaduta.' }, { error_message: 'Key expired' });
    }
    // Update last_used_at (fire-and-forget)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {});
  }

  // 5. HMAC signature
  const webhookSecret = process.env.WEBHOOK_SECRET ?? '';
  const signatureHeader = req.headers['x-signature'] as string | undefined;
  const rawBody = JSON.stringify(req.body ?? {});

  if (!signatureHeader) {
    return logAndRespond(401, { error: 'Header X-Signature mancante.' });
  }
  if (!validateSignature(webhookSecret, rawBody, signatureHeader)) {
    return logAndRespond(401, { error: 'Firma HMAC non valida.' }, { error_message: 'HMAC validation failed' });
  }

  // 6. JSON body
  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return logAndRespond(400, { error: 'Corpo della richiesta non valido o non JSON.' });
  }

  const bodySize = Buffer.byteLength(rawBody, 'utf8');
  const source = typeof body.source === 'string' ? body.source : 'unknown';

  // 7. Required fields validation
  const requiredFields: (keyof typeof body)[] = [
    'source', 'practice_type', 'client_name', 'client_email', 'client_phone',
  ];
  const missingFields = requiredFields.filter(f => !body[f] || typeof body[f] !== 'string' || !(body[f] as string).trim());
  if (missingFields.length > 0) {
    return logAndRespond(422, { error: 'Campi obbligatori mancanti.', missing_fields: missingFields },
      { source, error_message: `Missing fields: ${missingFields.join(', ')}`, size: bodySize });
  }

  const practiceTypeRaw = (body.practice_type as string).toLowerCase().replace(/\s+/g, '_');
  if (!VALID_PRACTICE_TYPES.includes(practiceTypeRaw)) {
    return logAndRespond(422, {
      error: 'Tipo pratica non valido.',
      valid_types: VALID_PRACTICE_TYPES,
    }, { source, error_message: `Invalid practice type: ${practiceTypeRaw}`, size: bodySize });
  }

  // 8. Idempotency check
  const idempotencyKey = (req.headers['x-idempotency-key'] as string | undefined) ||
    (typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined);

  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('practices')
      .select('id, practice_number')
      .eq('notes', `idempotency:${idempotencyKey}`)
      .maybeSingle();

    if (existing) {
      return logAndRespond(200, {
        success: true,
        practice_id: existing.id,
        practice_number: existing.practice_number,
        message: 'Pratica già esistente (idempotency key riconosciuta).',
        duplicate: true,
      }, { source, practice_id: existing.id, size: bodySize });
    }
  }

  // 9. Document requirements validation
  const documents = Array.isArray(body.documents)
    ? (body.documents as Array<{ filename: string; content_base64: string; mime_type: string }>)
    : [];

  const requiredDocs = requiredDocsByType[practiceTypeRaw] ?? [];
  const missingDocs = requiredDocs.filter(
    req => !documents.some(d => d.filename.toLowerCase().includes(req))
  );
  if (missingDocs.length > 0) {
    return logAndRespond(422, {
      error: 'missing_required_documents',
      missing: missingDocs,
      message: `Documenti obbligatori mancanti per la tipologia "${practiceTypeRaw}".`,
    }, { source, error_message: `Missing docs: ${missingDocs.join(', ')}`, size: bodySize });
  }

  // Validate document mime types and sizes
  for (const doc of documents) {
    if (!ALLOWED_MIME_TYPES.includes(doc.mime_type)) {
      return logAndRespond(422, {
        error: 'Tipo MIME non consentito.',
        filename: doc.filename,
        allowed_types: ALLOWED_MIME_TYPES,
      }, { source, error_message: `Invalid mime: ${doc.mime_type}`, size: bodySize });
    }
    const decoded = Buffer.from(doc.content_base64, 'base64');
    if (decoded.length > MAX_DOC_SIZE_BYTES) {
      return logAndRespond(422, {
        error: 'Documento troppo grande (max 10MB).',
        filename: doc.filename,
      }, { source, error_message: `Doc too large: ${doc.filename}`, size: bodySize });
    }
  }

  // ---------------------------------------------------------------------------
  // Insert practice
  // ---------------------------------------------------------------------------
  try {
    const defaultUserId = process.env.WEBHOOK_DEFAULT_USER_ID ?? '';

    const notesPrefix = idempotencyKey ? `idempotency:${idempotencyKey}\n\n` : '';
    const notes = `${notesPrefix}Fonte: ${source}${body.notes ? `\n\n${body.notes}` : ''}`;

    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('practices')
      .insert({
        practice_type: practiceTypeRaw as 'auto',
        client_name: (body.client_name as string).trim(),
        client_phone: (body.client_phone as string).trim(),
        client_email: (body.client_email as string).trim(),
        beneficiary: typeof body.beneficiary === 'string' ? body.beneficiary.trim() || null : null,
        policy_number: typeof body.policy_number === 'string' ? body.policy_number.trim() || null : null,
        policy_start_date: typeof body.policy_start_date === 'string' ? body.policy_start_date || null : null,
        policy_end_date: typeof body.policy_end_date === 'string' ? body.policy_end_date || null : null,
        notes: notes || null,
        user_id: defaultUserId,
        status: 'in_lavorazione',
        api_key_id: keyRecord?.id ?? null,
      })
      .select('id, practice_number')
      .single();

    if (practiceError || !practice) {
      console.error('Practice insert error:', practiceError);
      return logAndRespond(500, { error: 'Errore interno durante la creazione della pratica.' },
        { source, error_message: practiceError?.message ?? 'no data', size: bodySize });
    }

    // Upload documents
    for (const doc of documents) {
      const decoded = Buffer.from(doc.content_base64, 'base64');
      const ext = doc.filename.split('.').pop() ?? 'bin';
      const storagePath = `${practice.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      await supabaseAdmin.storage
        .from('practice-documents')
        .upload(storagePath, decoded, { contentType: doc.mime_type, upsert: false });

      await supabaseAdmin.from('practice_documents').insert({
        practice_id: practice.id,
        file_name: doc.filename,
        file_path: storagePath,
        file_size: decoded.length,
        mime_type: doc.mime_type,
        uploaded_by: defaultUserId,
      });
    }

    // Admin notification (fire-and-forget)
    notifyAdminNewPractice({
      practiceNumber: practice.practice_number,
      practiceType: practiceTypeRaw,
      clientName: (body.client_name as string).trim(),
      clientEmail: (body.client_email as string).trim(),
      agentName: source,
      agentEmail: source,
    }).catch(err => console.error('Admin notification failed:', err));

    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked,
      source,
      ip_address: ip,
      endpoint,
      method,
      status_code: 200,
      practice_id: practice.id,
      request_body_size: bodySize,
      api_key_id: keyRecord?.id,
    });

    return res.status(200).json({
      success: true,
      practice_id: practice.id,
      practice_number: practice.practice_number,
      message: 'Pratica creata con successo.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('Webhook handler error:', message);
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked,
      source,
      ip_address: ip,
      endpoint,
      method,
      status_code: 500,
      error_message: message,
      request_body_size: bodySize,
      api_key_id: keyRecord?.id,
    });
    return res.status(500).json({ error: 'Errore interno del server.' });
  }
}
