import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { alertAdmins } from './admin-alerts.js';
import { alertCopy } from './alert-copy.js';
import { portalUrl } from './auth-emails.js';

/**
 * Delivery reports from Resend (webhook signed with Svix): delivered, delayed, bounced, complained.
 * They update the line of the email in `email_logs`; a permanent bounce or a complaint puts the address in
 * `email_suppressions` (nobody writes to it again) and the administrators are told, because a wrong
 * mailbox means an expiry reminder that never arrives.
 */

export const SVIX_TOLERANCE_SECONDS = 300;

export interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

/** Svix: HMAC-SHA256 of `${id}.${timestamp}.${body}` with the base64 key after `whsec_`, base64-encoded. */
export function verifySvixSignature(options: {
  secret: string;
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  nowSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signature, rawBody } = options;
  if (!id || !timestamp || !signature) return false;
  const sent = Number(timestamp);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(sent) || Math.abs(now - sent) > SVIX_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signature.split(/\s+/).some((candidate) => {
    const [version, value] = candidate.split(',');
    if (version !== 'v1' || !value) return false;
    const received = Buffer.from(value, 'base64');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  });
}

const addressesOf = (event: ResendEvent): string[] => {
  const to = event.data?.to;
  const list = Array.isArray(to) ? to : to ? [to] : [];
  return list.map((address) => String(address).trim().toLowerCase()).filter(Boolean);
};

type LogStatus = 'delivered' | 'delayed' | 'bounced' | 'complained';
const STATUS_BY_EVENT: Record<string, { status: LogStatus; from: string[] }> = {
  'email.delivered': { status: 'delivered', from: ['sent', 'delayed'] },
  'email.delivery_delayed': { status: 'delayed', from: ['sent'] },
  'email.bounced': { status: 'bounced', from: ['sent', 'delayed', 'delivered'] },
  'email.complained': { status: 'complained', from: ['sent', 'delayed', 'delivered', 'bounced'] },
};

export interface ResendOutcome {
  handled: boolean;
  type: string;
  updated: number;
  suppressed: string[];
}

export async function applyResendEvent(supabase: SupabaseClient, event: ResendEvent): Promise<ResendOutcome> {
  const outcome: ResendOutcome = { handled: false, type: event.type, updated: 0, suppressed: [] };
  const rule = STATUS_BY_EVENT[event.type];
  const emailId = event.data?.email_id;
  if (!rule || !emailId) return outcome;
  outcome.handled = true;

  const addresses = addressesOf(event);
  const bounce = event.data?.bounce;
  const detail = event.type === 'email.bounced' ? [bounce?.type, bounce?.subType, bounce?.message].filter(Boolean).join(' · ').slice(0, 500) || null : null;

  let update = supabase
    .from('email_logs')
    .update({ status: rule.status, delivery_updated_at: new Date().toISOString(), delivery_detail: detail })
    .eq('resend_email_id', emailId)
    .in('status', rule.from);
  if (addresses.length > 0) update = update.in('recipient_email', addresses);
  const { data: changed, error } = await update.select('id');
  if (error) throw new Error(`email_logs: ${error.message}`);
  outcome.updated = changed?.length ?? 0;

  // Only a permanent bounce (or a complaint) closes the address; a full mailbox or a hiccup may pass.
  const permanent = event.type === 'email.complained' || (event.type === 'email.bounced' && String(bounce?.type ?? '').toLowerCase() === 'permanent');
  if (permanent) {
    const reason = event.type === 'email.complained' ? 'complained' : 'bounced';
    for (const address of addresses) {
      if (await suppress(supabase, address, reason, detail)) outcome.suppressed.push(address);
    }
  }
  return outcome;
}

/** True when the address was not suppressed before (the administrators are told once). */
async function suppress(supabase: SupabaseClient, address: string, reason: 'bounced' | 'complained', detail: string | null): Promise<boolean> {
  const { data: existing, error } = await supabase.from('email_suppressions').select('email, hits').eq('email', address).maybeSingle();
  if (error) throw new Error(`email_suppressions: ${error.message}`);
  if (existing) {
    await supabase.from('email_suppressions').update({ reason, detail, hits: Number(existing.hits ?? 1) + 1, last_at: new Date().toISOString() }).eq('email', address);
    return false;
  }
  const { error: insertError } = await supabase.from('email_suppressions').insert({ email: address, reason, detail, source: 'resend' });
  if (insertError) {
    if (insertError.code === '23505') return false;
    throw new Error(`email_suppressions: ${insertError.message}`);
  }
  return true;
}

/** The practices that name this address as the client's, for the alert. */
async function practicesOf(supabase: SupabaseClient, address: string): Promise<Array<{ id: string; practice_number: string }>> {
  const { data } = await supabase.from('practices').select('id, practice_number').ilike('client_email', address).limit(10);
  return (data ?? []) as Array<{ id: string; practice_number: string }>;
}

export async function alertBounce(supabase: SupabaseClient, address: string, reason: 'bounced' | 'complained'): Promise<void> {
  const practices = await practicesOf(supabase, address);
  const numbers = practices.map((practice) => practice.practice_number);
  await alertAdmins(
    supabase,
    (language) => {
      const copy = alertCopy(language).bounce;
      const item = { address, reason, practices: numbers };
      return {
        subject: copy.subject(address),
        paragraphs: [alertCopy(language).greeting, copy.intro(item), ...(numbers.length > 0 ? [copy.practices(numbers.join(', '))] : [])],
        closing: [copy.action],
        buttonUrl: practices[0] ? `${portalUrl()}/practices/${practices[0].id}` : `${portalUrl()}/practices`,
      };
    },
    { template: 'admin_alert_bounce', practiceId: practices[0]?.id ?? null },
  );
}

export interface WebhookRequest {
  headers: { 'svix-id'?: string; 'svix-timestamp'?: string; 'svix-signature'?: string };
  rawBody: string;
}

export async function handleResendWebhook(
  supabase: SupabaseClient,
  secret: string | undefined,
  request: WebhookRequest,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!secret) return { status: 503, body: { ok: false, error: 'not_configured', message: 'RESEND_WEBHOOK_SECRET non configurato' } };
  const valid = verifySvixSignature({
    secret,
    id: request.headers['svix-id'],
    timestamp: request.headers['svix-timestamp'],
    signature: request.headers['svix-signature'],
    rawBody: request.rawBody,
  });
  if (!valid) return { status: 401, body: { ok: false, error: 'unauthorized' } };

  let event: ResendEvent;
  try {
    event = JSON.parse(request.rawBody) as ResendEvent;
  } catch {
    return { status: 400, body: { ok: false, error: 'invalid_json' } };
  }
  if (!event || typeof event.type !== 'string') return { status: 400, body: { ok: false, error: 'invalid_payload' } };

  try {
    const outcome = await applyResendEvent(supabase, event);
    for (const address of outcome.suppressed) await alertBounce(supabase, address, event.type === 'email.complained' ? 'complained' : 'bounced');
    return { status: 200, body: { ok: true, handled: outcome.handled, updated: outcome.updated, suppressed: outcome.suppressed.length } };
  } catch (error) {
    console.error('resend-webhook:', error instanceof Error ? error.message : error);
    // 5xx: Resend (Svix) retries later.
    return { status: 503, body: { ok: false, error: 'temporarily_unavailable' } };
  }
}
