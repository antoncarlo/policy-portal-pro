import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyApiCors, authenticateApiKey, checkRateLimit, createAdminClient, getClientIp, logApiRequest, rejectAuth } from './_lib/partner-api.js';
import { handlePortalCallback, MAX_CALLBACK_BODY_BYTES } from './_lib/vies-callback.js';
import { completeLot, createLot, IntakeError, lotStatus } from './_lib/vies-intake.js';
import { checkEnv } from './_lib/env.js';
import { captureServerError } from './_lib/monitoring.js';
import { handleResendWebhook } from './_lib/resend-webhook.js';
import { bearerMatches } from './_lib/secrets.js';
import { readPortalRegistry } from './_lib/vies-orchestrator.js';

/**
 * Connections with other portals, one function (the platform limits their number) behind a few
 * addresses, set in vercel.json:
 *   GET  /api/health                 is the portal up; with the cron secret also what is configured (names only)
 *   POST /api/resend-webhook         delivery reports from the email provider (signed by Svix, see resend-webhook.ts)
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
    if (route === 'resend-webhook') return await handleResendDelivery(req, res);
    if (route === 'health') return await handleHealth(req, res);
    return res.status(404).json({ error: 'not_found' });
  } catch (error) {
    if (error instanceof IntakeError) return res.status(error.status).json({ ok: false, error: error.code, message: error.message, ...error.extra });
    console.error('vies-connect:', error instanceof Error ? error.message : error);
    await captureServerError(error, 'vies-connect', { tags: { route: String(route ?? '') } });
    return res.status(500).json({ ok: false, error: 'internal_error', message: 'Errore interno, riprovare.' });
  }
}

/**
 * Public: `{ status, time }` and whether the database answers. With `Authorization: Bearer <CRON_SECRET>` also the
 * environment report (which variables are missing or malformed, which features are on): never values.
 */
async function handleHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const report = checkEnv();
  let database: 'ok' | 'down' | 'unconfigured' = 'unconfigured';
  if (report.ok) {
    try {
      const { error } = await createAdminClient().from('system_settings').select('id', { head: true, count: 'exact' }).limit(1);
      database = error ? 'down' : 'ok';
    } catch {
      database = 'down';
    }
  }
  const status = database === 'ok' ? 'ok' : 'down';
  const detailed = bearerMatches(req.headers.authorization, [process.env.CRON_SECRET]);
  return res.status(status === 'ok' ? 200 : 503).json({
    status,
    database,
    time: new Date().toISOString(),
    ...(detailed ? { release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null, environment: report } : {}),
  });
}

async function handleResendDelivery(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Utilizzare POST.' });
  }
  const supabase = createAdminClient();
  const limit = await checkRateLimit(getClientIp(req), { scope: 'resend-webhook', supabase, limit: 600 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter });
  }
  const rawBody = await readRawBody(req);
  const result = await handleResendWebhook(supabase, process.env.RESEND_WEBHOOK_SECRET, {
    headers: { 'svix-id': header(req, 'svix-id'), 'svix-timestamp': header(req, 'svix-timestamp'), 'svix-signature': header(req, 'svix-signature') },
    rawBody,
  });
  return res.status(result.status).json(result.body);
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Utilizzare POST.' });
  }
  const ip = getClientIp(req);
  const supabase = createAdminClient();
  const limit = await checkRateLimit(ip, { scope: 'vies-callback', supabase });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter });
  }
  const rawBody = await readRawBody(req);
  const result = await handlePortalCallback(
    supabase,
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
  applyApiCors(req, res, `${method}, OPTIONS`, 'X-API-Key, Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return null;
  }
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ ok: false, error: 'method_not_allowed', message: `Utilizzare ${method}.` });
    return null;
  }
  const ip = getClientIp(req);
  const supabase = createAdminClient();
  const limit = await checkRateLimit(ip, { scope: endpoint, supabase });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter });
    return null;
  }
  const auth = await authenticateApiKey(req, supabase);
  if (!auth.ok) {
    rejectAuth(res, auth);
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
