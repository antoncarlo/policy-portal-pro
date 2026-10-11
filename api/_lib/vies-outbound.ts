import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stageOf } from '../../src/lib/practiceStages.js';
import { getDocumentStorageReference, listSignedPracticeDocuments, type OutgoingDocument } from './vies-documents.js';
import { readPortalRegistry } from './vies-portals.js';
import { signCallback } from './vies-signature.js';

/**
 * The flow going out. Two kinds of counterpart, each told what happens to the practices it is
 * concerned with:
 *
 *   source  the portal of a fiscal representative that sent a lot in (its API key): told when the lot
 *           is processed or rejected and at every step of each practice, with the draft to pay and the
 *           issued policy as download links. Address and signing secret are set per API key.
 *   portal  the company's portal: told what the company cannot know by itself (payment recorded,
 *           integrations sent, practice reopened).
 *
 * Every notification is written to `outbound_deliveries` first, then delivered, signed with
 * X-Timestamp / X-Signature as the calls the other way round. A failed delivery is retried with a
 * growing delay (also from the daily cron and by hand from Settings -> Connections); a refusal that
 * retrying cannot fix (4xx) stops at once and can be retried by hand once fixed.
 */

export type OutboundKind = 'sent' | 'info_requested' | 'info_provided' | 'deliberated' | 'rejected' | 'paid' | 'issued' | 'reopened';
export type OutboundOrigin = 'portal' | 'admin' | 'system';

export const OUTBOUND_EVENT_TYPE: Record<OutboundKind, string> = {
  sent: 'practice.in_review',
  info_requested: 'practice.info_requested',
  info_provided: 'practice.info_provided',
  deliberated: 'practice.deliberated',
  rejected: 'practice.rejected',
  paid: 'practice.paid',
  issued: 'practice.issued',
  reopened: 'practice.reopened',
};

/** What the company is told about, when it did not cause it itself. */
const PORTAL_KINDS: ReadonlySet<OutboundKind> = new Set(['paid', 'info_provided', 'reopened']);

export const MAX_ATTEMPTS = 7;
const BACKOFF_SECONDS = [60, 300, 1800, 7200, 21600, 86400];
const DELIVERY_TIMEOUT_MS = 6000;
const LEASE_SECONDS = 300;
const DOCUMENT_LINK_SECONDS = 7 * 24 * 3600;

const nowIso = () => new Date().toISOString();
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

/** An address a webhook may point to: https, a real host name or a public address. */
export function assertPublicHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Indirizzo non valido');
  }
  if (url.protocol !== 'https:') throw new Error('L\'indirizzo deve iniziare con https://');
  if (url.username || url.password) throw new Error('L\'indirizzo non deve contenere credenziali');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateV4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    privateV4.test(host) ||
    host === '::1' ||
    host.startsWith('fc') && host.includes(':') ||
    host.startsWith('fd') && host.includes(':') ||
    host.startsWith('fe80')
  ) {
    throw new Error('L\'indirizzo deve essere raggiungibile da Internet (non un indirizzo interno)');
  }
  return url;
}

export interface DeliveryRow {
  id: string;
  event_id: string;
  target_kind: 'source' | 'portal';
  target_id: string;
  target_label: string | null;
  practice_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
}

interface Target {
  url: string;
  secret: string;
  /** Extra headers (the company's bearer key). */
  headers: Record<string, string>;
}

async function resolveTarget(supabase: SupabaseClient, row: Pick<DeliveryRow, 'target_kind' | 'target_id'>): Promise<Target> {
  if (row.target_kind === 'source') {
    const { data } = await supabase.from('partner_webhooks').select('url, secret, active').eq('api_key_id', row.target_id).maybeSingle();
    if (!data) throw new Error('Nessun indirizzo di notifica configurato per questa chiave API');
    if (!data.active) throw new Error('Le notifiche di questa chiave API sono disattivate');
    assertPublicHttpsUrl(data.url as string);
    return { url: data.url as string, secret: data.secret as string, headers: { 'X-Partner-Id': row.target_id } };
  }
  const portal = readPortalRegistry().find((candidate) => candidate.id === row.target_id);
  const url = portal?.eventsUrl || portal?.url;
  if (!portal || !url || !portal.apiKey) throw new Error('Portale non configurato per le notifiche');
  assertPublicHttpsUrl(url);
  return { url, secret: portal.callbackSecret, headers: { Authorization: `Bearer ${portal.apiKey}`, 'X-Portal-Id': portal.id } };
}

/** A refusal that sending again will not change. */
const isFinalRefusal = (status: number) => status >= 400 && status < 500 && ![408, 425, 429].includes(status);

/** One attempt. Records the outcome on the row; never throws. */
export async function attemptDelivery(supabase: SupabaseClient, row: DeliveryRow): Promise<{ delivered: boolean; status: number | null; error: string | null }> {
  let httpStatus: number | null = null;
  let error: string | null = null;
  let final = false;
  try {
    const target = await resolveTarget(supabase, row);
    const raw = JSON.stringify(row.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Event-Type': row.event_type,
      'Idempotency-Key': row.event_id,
      'X-Delivery-Attempt': String((row.attempts ?? 0) + 1),
      ...target.headers,
    };
    if (target.secret) {
      headers['X-Timestamp'] = timestamp;
      headers['X-Signature'] = signCallback(target.secret, timestamp, raw);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const response = await fetch(target.url, { method: 'POST', headers, body: raw, signal: controller.signal, redirect: 'error' });
      httpStatus = response.status;
      if (!response.ok) {
        const text = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
        error = `HTTP ${response.status}${text ? `: ${text}` : ''}`;
        final = isFinalRefusal(response.status);
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Errore sconosciuto';
    error = message === 'This operation was aborted' || /abort/i.test(message) ? 'Nessuna risposta entro 6 secondi' : message;
    // A target that is not set up cannot be reached by trying again: fix the settings, then retry by hand.
    final = /configurat|disattivat|indirizzo|Indirizzo/.test(message);
  }

  const attempts = (row.attempts ?? 0) + 1;
  if (!error) {
    await supabase
      .from('outbound_deliveries')
      .update({ status: 'delivered', attempts, delivered_at: nowIso(), last_error: null, last_http_status: httpStatus })
      .eq('id', row.id);
    return { delivered: true, status: httpStatus, error: null };
  }
  const giveUp = final || attempts >= MAX_ATTEMPTS;
  await supabase
    .from('outbound_deliveries')
    .update({
      status: giveUp ? 'failed' : 'pending',
      attempts,
      last_error: error,
      last_http_status: httpStatus,
      next_attempt_at: giveUp ? nowIso() : later(BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)]),
    })
    .eq('id', row.id);
  return { delivered: false, status: httpStatus, error };
}

/** Delivers what is due: pending notifications whose time has come. A claim keeps two runs from sending the same one. */
export async function processDueDeliveries(supabase: SupabaseClient, options: { limit?: number } = {}): Promise<{ attempted: number; delivered: number }> {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const { data: due } = await supabase
    .from('outbound_deliveries')
    .select('id')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);
  let attempted = 0;
  let delivered = 0;
  await Promise.all(
    (due ?? []).map(async ({ id }) => {
      const { data: claimed } = await supabase
        .from('outbound_deliveries')
        .update({ next_attempt_at: later(LEASE_SECONDS) })
        .eq('id', id)
        .eq('status', 'pending')
        .lte('next_attempt_at', nowIso())
        .select('*');
      const row = claimed?.[0] as DeliveryRow | undefined;
      if (!row) return;
      attempted += 1;
      const result = await attemptDelivery(supabase, row);
      if (result.delivered) delivered += 1;
    }),
  );
  return { attempted, delivered };
}

/** Puts failed (or one given) notifications back to be delivered now, and delivers them. */
export async function retryDeliveries(supabase: SupabaseClient, options: { id?: string } = {}): Promise<{ attempted: number; delivered: number }> {
  let query = supabase.from('outbound_deliveries').update({ status: 'pending', attempts: 0, next_attempt_at: nowIso() }).neq('status', 'delivered');
  if (options.id) query = query.eq('id', options.id);
  const { data } = await query.select('id');
  if (!data?.length) return { attempted: 0, delivered: 0 };
  return processDueDeliveries(supabase, { limit: Math.min(data.length, 50) });
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

interface PracticeInfo {
  id: string;
  practice_number: string;
  client_name: string;
  status: string;
  financial_status: string | null;
  payment_date: string | null;
  api_key_id: string | null;
  policy_number: string | null;
}

const PRACTICE_COLUMNS = 'id, practice_number, client_name, status, financial_status, payment_date, api_key_id, policy_number';

interface WorkflowInfo {
  source_portal: string | null;
  source_reference: string | null;
  target_portal: string | null;
  target_reference: string | null;
  payment_due_date: string | null;
  deliberation_note: string | null;
  rejection_reason: string | null;
}

/** The practice's draft and policy, as links valid for a week. */
async function flowDocuments(supabase: SupabaseClient, practiceId: string): Promise<OutgoingDocument[]> {
  const { data } = await supabase
    .from('practice_documents')
    .select('file_name, file_path, file_size, mime_type, document_type')
    .eq('practice_id', practiceId)
    .in('document_type', ['bozza_deliberata', 'polizza_emessa'])
    .order('created_at', { ascending: false });
  const documents: OutgoingDocument[] = [];
  const expiresAt = later(DOCUMENT_LINK_SECONDS);
  for (const row of data ?? []) {
    const reference = getDocumentStorageReference(row.file_path as string);
    const { data: signed } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, DOCUMENT_LINK_SECONDS);
    if (!signed?.signedUrl) continue;
    documents.push({
      file_name: row.file_name as string,
      mime_type: (row.mime_type as string) || 'application/octet-stream',
      size: Number(row.file_size) || 0,
      document_type: row.document_type as string,
      download_url: signed.signedUrl,
      expires_at: expiresAt,
    });
  }
  return documents;
}

interface EventDetails {
  message?: string | null;
  reason?: string | null;
}

async function buildSourcePayload(
  supabase: SupabaseClient,
  practice: PracticeInfo,
  workflow: WorkflowInfo | null,
  kind: OutboundKind,
  eventId: string,
  details: EventDetails,
) {
  let lotId: string | null = null;
  if (workflow?.source_portal && workflow.source_reference) {
    const { data: lot } = await supabase
      .from('vies_intake_lots')
      .select('id')
      .eq('source_portal', workflow.source_portal)
      .eq('source_reference', workflow.source_reference)
      .maybeSingle();
    lotId = (lot?.id as string | undefined) ?? null;
  }
  const withDocuments = kind === 'deliberated' || kind === 'paid' || kind === 'issued';
  return {
    schema_version: 1,
    event_id: eventId,
    event_type: OUTBOUND_EVENT_TYPE[kind],
    occurred_at: nowIso(),
    source: { lot_id: lotId, reference: workflow?.source_reference ?? null },
    practice: { id: practice.id, number: practice.practice_number, client_name: practice.client_name },
    stage: stageOf(practice),
    data: {
      payment_due_date: kind === 'deliberated' || kind === 'paid' ? workflow?.payment_due_date ?? null : undefined,
      payment_date: kind === 'paid' ? practice.payment_date : undefined,
      note: kind === 'deliberated' ? workflow?.deliberation_note ?? null : undefined,
      reason: kind === 'rejected' ? details.reason ?? workflow?.rejection_reason ?? null : kind === 'reopened' ? details.reason ?? null : undefined,
      message: kind === 'info_requested' || kind === 'info_provided' ? details.message ?? null : undefined,
      policy_number: kind === 'issued' ? practice.policy_number : undefined,
      documents: withDocuments ? await flowDocuments(supabase, practice.id) : undefined,
    },
  };
}

async function buildPortalPayload(
  supabase: SupabaseClient,
  practice: PracticeInfo,
  workflow: WorkflowInfo | null,
  kind: OutboundKind,
  eventId: string,
  details: EventDetails,
) {
  // The documents the company may not have yet: everything of the practice except what came back from it.
  const documents = kind === 'info_provided' ? await listSignedPracticeDocuments(supabase, practice.id, DOCUMENT_LINK_SECONDS) : undefined;
  return {
    schema_version: 2,
    event_id: eventId,
    event_type: OUTBOUND_EVENT_TYPE[kind],
    occurred_at: nowIso(),
    practice: { id: practice.id, number: practice.practice_number, reference: workflow?.target_reference ?? null },
    data: {
      payment_date: kind === 'paid' ? practice.payment_date : undefined,
      message: kind === 'info_provided' ? details.message ?? null : undefined,
      reason: kind === 'reopened' ? details.reason ?? null : undefined,
      documents,
    },
  };
}

async function queue(
  supabase: SupabaseClient,
  rows: Array<{ target_kind: 'source' | 'portal'; target_id: string; target_label: string; practice_id: string | null; event_type: string; payload: Record<string, unknown>; event_id: string }>,
): Promise<DeliveryRow[]> {
  if (!rows.length) return [];
  // A fresh notification waits two minutes for the scheduled run, so it is delivered once, right now.
  const { data, error } = await supabase
    .from('outbound_deliveries')
    .insert(rows.map((row) => ({ ...row, status: 'pending', attempts: 0, next_attempt_at: later(120) })))
    .select('*');
  if (error) throw new Error(`Notifica in uscita non registrata: ${error.message}`);
  return (data ?? []) as DeliveryRow[];
}

/**
 * Tells whoever is concerned that a practice moved. Never throws: the practice has already moved and
 * a notification that cannot be delivered is kept for another attempt.
 */
export async function emitPracticeEvent(
  supabase: SupabaseClient,
  options: { practiceId: string; kind: OutboundKind; origin: OutboundOrigin; details?: EventDetails },
): Promise<{ queued: number; delivered: number }> {
  try {
    const { data: practice } = await supabase.from('practices').select(PRACTICE_COLUMNS).eq('id', options.practiceId).maybeSingle();
    if (!practice) return { queued: 0, delivered: 0 };
    const { data: workflow } = await supabase
      .from('practice_workflow')
      .select('source_portal, source_reference, target_portal, target_reference, payment_due_date, deliberation_note, rejection_reason')
      .eq('practice_id', options.practiceId)
      .maybeSingle();
    const info = practice as PracticeInfo;
    const flow = (workflow as WorkflowInfo | null) ?? null;
    const details = options.details ?? {};
    const rows: Parameters<typeof queue>[1] = [];

    // The representative who sent the practice in.
    if (info.api_key_id) {
      const { data: webhook } = await supabase.from('partner_webhooks').select('active').eq('api_key_id', info.api_key_id).maybeSingle();
      if (webhook?.active) {
        const eventId = crypto.randomUUID();
        rows.push({
          target_kind: 'source',
          target_id: info.api_key_id,
          target_label: flow?.source_portal ?? info.api_key_id.slice(0, 8),
          practice_id: info.id,
          event_type: OUTBOUND_EVENT_TYPE[options.kind],
          event_id: eventId,
          payload: await buildSourcePayload(supabase, info, flow, options.kind, eventId, details),
        });
      }
    }

    // The company, about what it cannot know by itself.
    if (options.origin !== 'portal' && PORTAL_KINDS.has(options.kind) && flow?.target_portal) {
      const portal = readPortalRegistry().find((candidate) => candidate.id === flow.target_portal);
      if (portal && portal.apiKey && (portal.eventsUrl || portal.url)) {
        const eventId = crypto.randomUUID();
        rows.push({
          target_kind: 'portal',
          target_id: portal.id,
          target_label: portal.name,
          practice_id: info.id,
          event_type: OUTBOUND_EVENT_TYPE[options.kind],
          event_id: eventId,
          payload: await buildPortalPayload(supabase, info, flow, options.kind, eventId, details),
        });
      }
    }

    const queued = await queue(supabase, rows);
    const results = await Promise.all(queued.map((row) => attemptDelivery(supabase, row)));
    return { queued: queued.length, delivered: results.filter((result) => result.delivered).length };
  } catch (error) {
    console.error('vies-outbound:', error instanceof Error ? error.message : error);
    return { queued: 0, delivered: 0 };
  }
}

/** Lot-level news for the representative: processed (with the practices created) or rejected. */
export async function emitLotEvent(
  supabase: SupabaseClient,
  options: { lotId: string; kind: 'processed' | 'rejected' },
): Promise<{ queued: number; delivered: number }> {
  try {
    const { data: lot } = await supabase
      .from('vies_intake_lots')
      .select('id, api_key_id, source_portal, source_reference, status, rejected_reason, batch_id, processed_at')
      .eq('id', options.lotId)
      .maybeSingle();
    if (!lot?.api_key_id) return { queued: 0, delivered: 0 };
    const { data: webhook } = await supabase.from('partner_webhooks').select('active').eq('api_key_id', lot.api_key_id).maybeSingle();
    if (!webhook?.active) return { queued: 0, delivered: 0 };

    const practices: Array<Record<string, unknown>> = [];
    if (options.kind === 'processed' && lot.batch_id) {
      const { data: jobs } = await supabase.from('vies_jobs').select('row_number, contraente, external_reference').eq('batch_id', lot.batch_id).order('row_number', { ascending: true }).limit(5000);
      const ids = (jobs ?? []).map((job) => job.external_reference as string | null).filter((id): id is string => Boolean(id));
      const byId = new Map<string, PracticeInfo>();
      for (let start = 0; start < ids.length; start += 200) {
        const { data: rows } = await supabase.from('practices').select(PRACTICE_COLUMNS).in('id', ids.slice(start, start + 200));
        for (const row of rows ?? []) byId.set(row.id as string, row as PracticeInfo);
      }
      for (const job of jobs ?? []) {
        const practice = byId.get(job.external_reference as string);
        practices.push({ row_number: job.row_number, contraente: job.contraente, practice_number: practice?.practice_number ?? null, stage: practice ? stageOf(practice) : null });
      }
    }
    const eventId = crypto.randomUUID();
    const eventType = options.kind === 'processed' ? 'lot.processed' : 'lot.rejected';
    const payload = {
      schema_version: 1,
      event_id: eventId,
      event_type: eventType,
      occurred_at: nowIso(),
      lot: { lot_id: lot.id, source_reference: lot.source_reference, status: lot.status },
      data: { reason: options.kind === 'rejected' ? lot.rejected_reason ?? null : undefined, practices: options.kind === 'processed' ? practices : undefined },
    };
    const queued = await queue(supabase, [
      { target_kind: 'source', target_id: lot.api_key_id as string, target_label: lot.source_portal as string, practice_id: null, event_type: eventType, event_id: eventId, payload },
    ]);
    const results = await Promise.all(queued.map((row) => attemptDelivery(supabase, row)));
    return { queued: queued.length, delivered: results.filter((result) => result.delivered).length };
  } catch (error) {
    console.error('vies-outbound:', error instanceof Error ? error.message : error);
    return { queued: 0, delivered: 0 };
  }
}

/** A test notification, to check the address and the signature before real ones depend on them. */
export async function sendTestEvent(
  supabase: SupabaseClient,
  target: { kind: 'source' | 'portal'; id: string; label: string },
): Promise<{ delivered: boolean; status: number | null; error: string | null }> {
  const eventId = crypto.randomUUID();
  const payload = {
    schema_version: target.kind === 'source' ? 1 : 2,
    event_id: eventId,
    event_type: 'practice.test',
    occurred_at: nowIso(),
    data: { message: 'Notifica di prova: nessuna pratica coinvolta.' },
  };
  const [row] = await queue(supabase, [{ target_kind: target.kind, target_id: target.id, target_label: target.label, practice_id: null, event_type: 'practice.test', event_id: eventId, payload }]);
  return attemptDelivery(supabase, row);
}
