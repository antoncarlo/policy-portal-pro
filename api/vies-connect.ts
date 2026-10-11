import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateApiKey, checkRateLimit, createAdminClient, getClientIp, logApiRequest } from './_lib/partner-api.js';
import { handlePortalCallback, MAX_CALLBACK_BODY_BYTES } from './_lib/vies-callback.js';
import { completeLot, createLot, IntakeError, lotStatus } from './_lib/vies-intake.js';
import { readPortalRegistry } from './_lib/vies-orchestrator.js';

/**
 * Connections with other portals, one function (the platform limits their number) behind three
 * addresses, set in vercel.json:
 *   POST /api/vies-portal-callback   answers from the company's portal (signed, see vies-callback.ts)
 *   POST /api/vies-intake            a portal sends in a lot: create_lot, complete_lot (X-API-Key)
 *   GET  /api/vies-intake-status     state of the lots sent in (X-API-Key)
 * Documented in docs/vies-connector.md.
 */

// The signature covers the exact bytes received, so the body is read here and not parsed by the platform.
export const config = { api: { bodyParser: false } };

export async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_CALLBACK_BODY_BYTES) throw new IntakeError(413, 'payload_too_large', 'Corpo della richiesta troppo grande (massimo 4 MB)');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const header = (req: VercelRequest, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = Array.isArray(req.query.route) ? req.query.route[0] : req.query.route;
  try {
    if (route === 'callback') return await handleCallback(req, res);
    if (route === 'intake') return await handleIntake(req, res);
    if (route === 'intake-status') return await handleIntakeStatus(req, res);
    return res.status(404).json({ error: 'not_found' });
  } catch (error) {
    if (error instanceof IntakeError) return res.status(error.status).json({ ok: false, error: error.code, message: error.message, ...error.extra });
    console.error('vies-connect:', error instanceof Error ? error.message : error);
    return res.status(500).json({ ok: false, error: 'internal_error', message: 'Errore interno, riprovare.' });
  }
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Utilizzare POST.' });
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter });
  }
  const rawBody = await readRawBody(req);
  const result = await handlePortalCallback(
    createAdminClient(),
    readPortalRegistry(),
    {
      headers: { 'x-portal-id': header(req, 'x-portal-id'), 'x-timestamp': header(req, 'x-timestamp'), 'x-signature': header(req, 'x-signature') },
      rawBody,
    },
  );
  return res.status(result.status).json(result.body);
}

/** Rate limit, X-API-Key and the log line every partner call leaves. */
async function partnerCall(req: VercelRequest, res: VercelResponse, endpoint: string, method: 'GET' | 'POST') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', `${method}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ ok: false, error: 'method_not_allowed', message: `Utilizzare ${method}.` });
    return null;
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter });
    return null;
  }
  const supabase = createAdminClient();
  const auth = await authenticateApiKey(req, supabase);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return null;
  }
  const log = (statusCode: number, errorMessage?: string, size = 0) =>
    logApiRequest(supabase, {
      api_key_masked: auth.ctx.apiKeyMasked,
      source: endpoint.replace(/^\/api\//, ''),
      ip_address: ip,
      endpoint,
      method,
      status_code: statusCode,
      error_message: errorMessage,
      request_body_size: size,
      api_key_id: auth.ctx.keyId,
    });
  return { supabase, ctx: auth.ctx, log };
}

async function handleIntake(req: VercelRequest, res: VercelResponse) {
  const call = await partnerCall(req, res, '/api/vies-intake', 'POST');
  if (!call) return;
  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new IntakeError(400, 'invalid_json', 'Il corpo non è un JSON valido');
    }
    const action = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).action : undefined;
    let result: Record<string, unknown>;
    if (action === 'create_lot') result = await createLot(call.supabase, call.ctx, body);
    else if (action === 'complete_lot') result = await completeLot(call.supabase, call.ctx, body);
    else throw new IntakeError(422, 'invalid_action', 'action: ammessi create_lot, complete_lot');
    await call.log(200, undefined, rawBody.length);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof IntakeError) {
      await call.log(error.status, error.message, rawBody.length);
      return res.status(error.status).json({ ok: false, error: error.code, message: error.message, ...error.extra });
    }
    throw error;
  }
}

async function handleIntakeStatus(req: VercelRequest, res: VercelResponse) {
  const call = await partnerCall(req, res, '/api/vies-intake-status', 'GET');
  if (!call) return;
  const pick = (name: string) => {
    const raw = req.query[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  try {
    const result = await lotStatus(call.supabase, call.ctx, { lotId: pick('lot_id'), sourceReference: pick('source_reference') });
    await call.log(200);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof IntakeError) {
      await call.log(error.status, error.message);
      return res.status(error.status).json({ ok: false, error: error.code, message: error.message, ...error.extra });
    }
    throw error;
  }
}
