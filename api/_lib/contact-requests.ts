import type { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { escapeHtml, type MailMessage, type MailResult } from './mailer.js';
import { hitRateLimit } from './rate-limit.js';

/**
 * The contact form of the public VIES site (POST /api/contact).
 *
 * A request is validated here (the browser's checks are a courtesy, not a defence), saved for the administrators
 * and sent to the VIES mailbox with the answer going straight to who wrote. The endpoint is public, so:
 *  - a trap field and a minimum filling time tell programs from people: a program gets the same answer as a
 *    person, but nothing is saved and no email leaves;
 *  - each caller can send a few requests an hour. The caller's address is never stored: the counters use a keyed
 *    fingerprint of it, which cannot be turned back into the address;
 *  - only JSON is taken, so a form posted from another site cannot use the endpoint;
 *  - everything typed reaches the email as text, never as HTML, and one-line fields cannot carry a line break.
 * If the email cannot leave, the request stays saved with the reason; if the database is down, the email still
 * leaves. Only when both fail is the sender told to try again.
 */

export const CONTACT_ROLES = ['fiscal_representative', 'professional_firm', 'broker', 'foreign_company', 'other'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];
export const CONTACT_LANGS = ['it', 'en', 'zh'] as const;
export type ContactLang = (typeof CONTACT_LANGS)[number];

/** A person does not fill the form in less than this. */
export const CONTACT_MIN_ELAPSED_MS = 3000;
/** Requests saved and sent for one caller in an hour. */
export const CONTACT_MAX_PER_HOUR = 5;
/** Calls of any kind taken from one caller in an hour, valid or not. */
export const CONTACT_MAX_CALLS_PER_HOUR = 60;
const WINDOW_SECONDS = 3600;
const DEFAULT_INBOX = 'vies@tecnomga.com';

const LIMITS = { name: 120, company: 120, country: 80, email: 200, phone: 40, volume: 40, messageMin: 10, messageMax: 4000, page: 200 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  company: string;
  role: ContactRole;
  country: string;
  email: string;
  phone?: string;
  volume?: string;
  message: string;
  consent: true;
  lang: ContactLang;
  /** The trap field: empty for a person. */
  website?: string;
  /** Milliseconds between the form appearing and being sent. */
  elapsedMs?: number;
  /** Path of the page the form was sent from. */
  page?: string;
}

export type ContactValidation = { ok: true; value: ContactInput } | { ok: false; fields: string[] };

/** One line of text: control characters and line breaks become spaces. */
const oneLine = (value: unknown): string =>
  typeof value === 'string'
    ? value
        // eslint-disable-next-line no-control-regex -- control characters are exactly what must not pass
        .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
/** Text of several lines: line breaks stay, the other control characters go. */
const manyLines = (value: unknown): string =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex -- control characters are exactly what must not pass
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, '')
        .trim()
    : '';

export function validateContact(body: unknown): ContactValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, fields: ['body'] };
  const raw = body as Record<string, unknown>;
  const fields: string[] = [];

  const name = oneLine(raw.name);
  if (!name || name.length > LIMITS.name) fields.push('name');
  const company = oneLine(raw.company);
  if (!company || company.length > LIMITS.company) fields.push('company');
  const role = oneLine(raw.role) as ContactRole;
  if (!CONTACT_ROLES.includes(role)) fields.push('role');
  const country = oneLine(raw.country);
  if (!country || country.length > LIMITS.country) fields.push('country');
  const email = oneLine(raw.email).toLowerCase();
  if (!email || email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) fields.push('email');
  const phone = oneLine(raw.phone);
  if (phone.length > LIMITS.phone) fields.push('phone');
  const volume = oneLine(raw.volume);
  if (volume.length > LIMITS.volume) fields.push('volume');
  const message = manyLines(raw.message);
  if (message.length < LIMITS.messageMin || message.length > LIMITS.messageMax) fields.push('message');
  const consent = raw.consent === true || raw.consent === 'true' || raw.consent === 'yes' || raw.consent === 'on';
  if (!consent) fields.push('consent');
  if (fields.length > 0) return { ok: false, fields };

  const lang = CONTACT_LANGS.includes(raw.lang as ContactLang) ? (raw.lang as ContactLang) : 'it';
  const page = oneLine(raw.page);
  const elapsedMs = typeof raw.elapsedMs === 'number' && Number.isFinite(raw.elapsedMs) ? raw.elapsedMs : undefined;
  return {
    ok: true,
    value: {
      name,
      company,
      role,
      country,
      email,
      phone: phone || undefined,
      volume: volume || undefined,
      message,
      consent: true,
      lang,
      website: oneLine(raw.website) || undefined,
      elapsedMs,
      page: /^\/(?!\/)/.test(page) && page.length <= LIMITS.page ? page : undefined,
    },
  };
}

/** The trap field filled in, or the form sent faster than a person can (or with no time at all). */
export const isLikelyBot = (input: ContactInput): boolean => Boolean(input.website) || !(typeof input.elapsedMs === 'number' && input.elapsedMs >= CONTACT_MIN_ELAPSED_MS);

/** The caller, for the counters: a keyed fingerprint, never the address itself. */
const callerKey = (ip: string): string =>
  crypto
    .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'contact-requests')
    .update(ip || 'unknown')
    .digest('hex')
    .slice(0, 32);

const ROLE_LABELS: Record<ContactRole, string> = {
  fiscal_representative: 'Rappresentante fiscale',
  professional_firm: 'Studio professionale',
  broker: 'Broker o agente assicurativo',
  foreign_company: 'Società estera',
  other: 'Altro',
};
const LANG_LABELS: Record<ContactLang, string> = { it: 'italiano', en: 'inglese', zh: 'cinese' };

/** The email to the VIES mailbox, in Italian: every value is escaped. */
export function contactEmail(input: ContactInput, inbox: string, now: Date): MailMessage {
  const rows: Array<[string, string]> = [
    ['Nome e cognome', input.name],
    ['Società o studio', input.company],
    ['Chi è', ROLE_LABELS[input.role]],
    ['Paese', input.country],
    ['Email', input.email],
    ['Telefono', input.phone ?? '—'],
    ['Pratiche stimate', input.volume ?? '—'],
    ['Lingua della pagina', LANG_LABELS[input.lang]],
    ['Pagina', input.page ?? '—'],
    ['Ricevuta', `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`],
  ];
  const table = rows
    .map(([label, value]) => `<tr><td style="padding:6px 16px 6px 0;color:#40566a;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0d2233"><strong>${escapeHtml(value)}</strong></td></tr>`)
    .join('');
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0d2233">',
    '<h2 style="margin:0 0 12px;color:#0f3a5c">Richiesta di contatto dal sito VIES</h2>',
    `<table style="border-collapse:collapse">${table}</table>`,
    '<h3 style="margin:20px 0 8px;color:#0f3a5c">Messaggio</h3>',
    `<p style="margin:0;padding:12px 16px;border-left:3px solid #b08968;background:#f6f3ee;white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    '<p style="margin:20px 0 0;color:#40566a;font-size:13px">Rispondendo a questa email si scrive direttamente a chi ha inviato la richiesta. La richiesta è anche nell’elenco «Richieste di contatto» del portale.</p>',
    '</div>',
  ].join('');
  return { to: inbox, subject: `Richiesta di contatto VIES: ${input.company} (${input.country})`, html, replyTo: input.email };
}

export interface ContactDeps {
  supabase: SupabaseClient;
  sendMail: (message: MailMessage) => Promise<MailResult>;
  now: () => Date;
}

export interface ContactCall {
  body: unknown;
  ip: string | null;
  contentType?: string | null;
}

export interface ContactAnswer {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

const OK: ContactAnswer = { status: 200, body: { ok: true } };
const limited = (retryAfter: number): ContactAnswer => ({ status: 429, body: { ok: false, error: 'rate_limited' }, headers: { 'Retry-After': String(retryAfter) } });

export async function handleContactRequest(deps: ContactDeps, call: ContactCall): Promise<ContactAnswer> {
  if (!/^application\/json\b/i.test(call.contentType ?? '')) return { status: 415, body: { ok: false, error: 'unsupported_media_type' } };

  const caller = callerKey(call.ip ?? 'unknown');
  const calls = await hitRateLimit(deps.supabase, `contact:calls:${caller}`, { limit: CONTACT_MAX_CALLS_PER_HOUR, windowSeconds: WINDOW_SECONDS });
  if (!calls.allowed) return limited(calls.retryAfter);

  const checked = validateContact(call.body);
  if (!checked.ok) return { status: 400, body: { ok: false, error: 'invalid', fields: checked.fields } };
  const input = checked.value;
  // A program is not told it was recognised.
  if (isLikelyBot(input)) return OK;

  const requests = await hitRateLimit(deps.supabase, `contact:requests:${caller}`, { limit: CONTACT_MAX_PER_HOUR, windowSeconds: WINDOW_SECONDS });
  if (!requests.allowed) return limited(requests.retryAfter);

  let savedId: string | null = null;
  try {
    const { data, error } = await deps.supabase
      .from('contact_requests')
      .insert({
        name: input.name,
        company: input.company,
        role: input.role,
        country: input.country,
        email: input.email,
        phone: input.phone ?? null,
        volume: input.volume ?? null,
        message: input.message,
        lang: input.lang,
        page: input.page ?? null,
        email_sent: false,
        email_error: null,
        status: 'new',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    savedId = (data as { id?: string } | null)?.id ?? null;
  } catch (error) {
    console.error('contact request not saved:', error instanceof Error ? error.message : error);
  }

  let mail: MailResult;
  try {
    mail = await deps.sendMail(contactEmail(input, process.env.CONTACT_INBOX?.trim() || DEFAULT_INBOX, deps.now()));
  } catch (error) {
    mail = { success: false, error: error instanceof Error ? error.message : 'Errore di invio sconosciuto' };
  }
  if (!mail.success) console.error('contact request email not sent:', mail.error);

  if (savedId) {
    try {
      await deps.supabase
        .from('contact_requests')
        .update({ email_sent: mail.success, email_error: mail.success ? null : (mail.error ?? 'Errore di invio sconosciuto').slice(0, 500) })
        .eq('id', savedId);
    } catch (error) {
      console.error('contact request email outcome not recorded:', error instanceof Error ? error.message : error);
    }
  }

  if (!savedId && !mail.success) return { status: 500, body: { ok: false, error: 'unavailable' } };
  return OK;
}
