import { z } from 'zod';
import { parseDsn } from '../../src/lib/sentryEnvelope.js';

/**
 * What the functions need from the environment, checked in one place. A missing or malformed variable used
 * to show up as a 503 in the middle of a request; here it is reported up front (the health check, the
 * daily summary to the administrators). Only names and reasons are ever reported, never values.
 */

export interface EnvIssue {
  name: string;
  message: string;
}

export interface EnvReport {
  /** No blocking problem: the portal can serve requests. */
  ok: boolean;
  errors: EnvIssue[];
  warnings: EnvIssue[];
  features: {
    mail: 'gmail' | 'resend' | 'none';
    deliveryReports: boolean;
    cron: boolean;
    partnerWebhook: boolean;
    viesConnector: boolean;
    monitoring: boolean;
  };
}

type Env = Record<string, string | undefined>;

const url = z.string().url();
const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'deve iniziare con https://');
const uuid = z.string().uuid();
const email = z.string().email();
const secret = (min: number) => z.string().min(min, `troppo corto (almeno ${min} caratteri)`);

const present = (value: string | undefined) => (value ?? '').trim() !== '';

function check(issues: EnvIssue[], name: string, value: string | undefined, schema: z.ZodTypeAny, hint?: string) {
  if (!present(value)) return;
  const result = schema.safeParse(value!.trim());
  if (!result.success) issues.push({ name, message: `${result.error.issues[0]?.message ?? 'valore non valido'}${hint ? ` — ${hint}` : ''}` });
}

function jsonArray(value: string | undefined): boolean {
  if (!present(value)) return true;
  try {
    return Array.isArray(JSON.parse(value!));
  } catch {
    return false;
  }
}

export function checkEnv(env: Env = process.env): EnvReport {
  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];

  // Blocking: without these nothing works.
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!present(supabaseUrl)) errors.push({ name: 'VITE_SUPABASE_URL', message: 'mancante: le funzioni non raggiungono il database' });
  else check(errors, env.SUPABASE_URL ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL', supabaseUrl, httpsUrl);
  if (!present(env.SUPABASE_SERVICE_ROLE_KEY)) errors.push({ name: 'SUPABASE_SERVICE_ROLE_KEY', message: 'mancante: le funzioni non possono leggere né scrivere i dati' });
  else check(errors, 'SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY, z.string().min(30, 'sembra incompleta'));

  // Features that stay off (or break) without their variables.
  const gmail = present(env.GMAIL_USER) && present(env.GMAIL_APP_PASSWORD);
  if (present(env.GMAIL_USER) !== present(env.GMAIL_APP_PASSWORD)) warnings.push({ name: 'GMAIL_USER / GMAIL_APP_PASSWORD', message: 'ne manca una delle due: il canale Gmail non è attivo' });
  const resend = present(env.RESEND_API_KEY);
  const mail: EnvReport['features']['mail'] = gmail ? 'gmail' : resend ? 'resend' : 'none';
  if (mail === 'none') warnings.push({ name: 'GMAIL_USER / RESEND_API_KEY', message: 'nessun canale email: notifiche, promemoria e avvisi non partono' });
  if (resend && !gmail && !present(env.RESEND_WEBHOOK_SECRET)) warnings.push({ name: 'RESEND_WEBHOOK_SECRET', message: 'mancante: nessun rapporto di recapito (rimbalzi e reclami)' });
  check(warnings, 'RESEND_WEBHOOK_SECRET', env.RESEND_WEBHOOK_SECRET, z.string().startsWith('whsec_', 'deve iniziare con whsec_'));

  const cron = present(env.CRON_SECRET);
  if (!cron) warnings.push({ name: 'CRON_SECRET', message: 'mancante: i cron giornalieri restano chiusi (promemoria, notifiche, ciclo VIES)' });
  else check(warnings, 'CRON_SECRET', env.CRON_SECRET, secret(16));

  const partnerWebhook = present(env.WEBHOOK_SECRET);
  if (!partnerWebhook) warnings.push({ name: 'WEBHOOK_SECRET', message: 'mancante: la creazione di pratiche via API risponde 503' });
  else check(warnings, 'WEBHOOK_SECRET', env.WEBHOOK_SECRET, secret(16));
  if (partnerWebhook) {
    if (!present(env.WEBHOOK_DEFAULT_USER_ID)) warnings.push({ name: 'WEBHOOK_DEFAULT_USER_ID', message: 'mancante: le pratiche create via API senza utente mappato vengono rifiutate' });
    else check(warnings, 'WEBHOOK_DEFAULT_USER_ID', env.WEBHOOK_DEFAULT_USER_ID, uuid);
  }

  const viesConnector = present(env.VIES_PORTALS);
  if (!jsonArray(env.VIES_PORTALS)) warnings.push({ name: 'VIES_PORTALS', message: 'non è un elenco JSON valido: nessun portale collegato' });
  check(warnings, 'VIES_WORKER_SECRET', env.VIES_WORKER_SECRET, secret(16));

  check(warnings, 'PORTAL_URL', env.PORTAL_URL, httpsUrl, 'i link nelle email puntano a questo indirizzo');
  check(warnings, 'EMAIL_FROM', env.EMAIL_FROM, email);
  check(warnings, 'GMAIL_FROM', env.GMAIL_FROM, email);
  if (present(env.ADMIN_NOTIFICATION_EMAILS) && env.ADMIN_NOTIFICATION_EMAILS!.trim().toLowerCase() !== 'none') {
    const bad = env.ADMIN_NOTIFICATION_EMAILS!.split(',').map((value) => value.trim()).filter((value) => value && !email.safeParse(value).success);
    if (bad.length > 0) warnings.push({ name: 'ADMIN_NOTIFICATION_EMAILS', message: `${bad.length} indirizzo/i non valido/i: verranno ignorati` });
  }
  check(warnings, 'API_CORS_ORIGINS', present(env.API_CORS_ORIGINS) ? env.API_CORS_ORIGINS!.split(',')[0].trim() : undefined, url, 'origini complete, es. https://esempio.it');

  const monitoring = parseDsn(env.SENTRY_DSN) !== null;
  if (present(env.SENTRY_DSN) && !monitoring) warnings.push({ name: 'SENTRY_DSN', message: 'non è un DSN valido (https://chiave@host/ID): errori non inviati' });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    features: { mail, deliveryReports: resend && !gmail && present(env.RESEND_WEBHOOK_SECRET), cron, partnerWebhook, viesConnector, monitoring },
  };
}
