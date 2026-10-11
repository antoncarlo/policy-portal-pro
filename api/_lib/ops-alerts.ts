import type { SupabaseClient } from '@supabase/supabase-js';
import { alertAdmins } from './admin-alerts.js';
import { captureServerError } from './monitoring.js';
import { alertCopy, type AlertDelivery } from './alert-copy.js';
import { portalUrl } from './auth-emails.js';
import { checkEnv, type EnvIssue } from './env.js';

/**
 * What the administrators hear about without having to look:
 *   - a delivery to an external portal that used up its retries (once, as soon as it is found)
 *   - a daily summary of what is still open: failed deliveries, clients whose address is unreachable and
 *     whose policy expires within 90 days, emails that could not be sent in the last 24 hours
 *   - an automatic task that stopped with an error
 */

const MAX_LISTED = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DeliveryRow {
  id: string;
  target_kind: string;
  target_id: string;
  target_label: string | null;
  event_type: string;
  practice_id: string | null;
  last_error: string | null;
  attempts: number;
  created_at: string;
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const DELIVERY_COLUMNS = 'id, target_kind, target_id, target_label, event_type, practice_id, last_error, attempts, created_at';

async function practiceNumbers(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const { data } = await supabase.from('practices').select('id, practice_number').in('id', wanted);
  return new Map(((data ?? []) as Array<{ id: string; practice_number: string }>).map((row) => [row.id, row.practice_number]));
}

async function describeDeliveries(supabase: SupabaseClient, rows: DeliveryRow[]): Promise<AlertDelivery[]> {
  const numbers = await practiceNumbers(supabase, rows.map((row) => row.practice_id ?? ''));
  return rows.map((row) => ({
    target: row.target_label || row.target_id,
    event: row.event_type,
    practice: row.practice_id ? numbers.get(row.practice_id) ?? null : null,
    error: row.last_error ? shorten(row.last_error, 160) : null,
    attempts: row.attempts,
  }));
}

/** Tells the administrators about deliveries that just gave up. Each one only once (`alerted_at`). */
export async function alertFailedDeliveries(supabase: SupabaseClient): Promise<{ alerted: number }> {
  try {
    const { data: found, error } = await supabase
      .from('outbound_deliveries')
      .select('id')
      .eq('status', 'failed')
      .is('alerted_at', null)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = ((found ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) return { alerted: 0 };

    // Claim them first: two runs at the same moment must not both write.
    const { data: claimed, error: claimError } = await supabase
      .from('outbound_deliveries')
      .update({ alerted_at: new Date().toISOString() })
      .in('id', ids)
      .eq('status', 'failed')
      .is('alerted_at', null)
      .select(DELIVERY_COLUMNS);
    if (claimError) throw new Error(claimError.message);
    const rows = (claimed ?? []) as DeliveryRow[];
    if (rows.length === 0) return { alerted: 0 };

    const items = await describeDeliveries(supabase, rows);
    const result = await alertAdmins(
      supabase,
      (language) => {
        const copy = alertCopy(language);
        const shown = items.slice(0, MAX_LISTED);
        return {
          subject: copy.deliveryFailed.subject(items.length),
          paragraphs: [copy.greeting, copy.deliveryFailed.intro(items.length)],
          listing: shown.map((item) => ({ text: copy.deliveryFailed.line(item), url: `${portalUrl()}/settings` })),
          listingMore: items.length - shown.length,
          closing: [copy.deliveryFailed.action],
          buttonUrl: `${portalUrl()}/settings`,
        };
      },
      { template: 'admin_alert_delivery_failed' },
    );
    if (result.sent === 0) {
      // Nobody could be told (no email channel, or it failed): try again at the next run.
      await supabase.from('outbound_deliveries').update({ alerted_at: null }).in('id', rows.map((row) => row.id));
      return { alerted: 0 };
    }
    return { alerted: rows.length };
  } catch (error) {
    console.error('Avviso consegne fallite non riuscito:', error instanceof Error ? error.message : error);
    return { alerted: 0 };
  }
}

export interface DigestSummary {
  sent: boolean;
  failedDeliveries: number;
  unreachableClients: number;
  emailFailures: number;
  configIssues: number;
}

/** The daily summary of what is still open. Nothing to report, nothing sent. */
export async function sendDailyDigest(supabase: SupabaseClient, now = new Date()): Promise<DigestSummary> {
  const summary: DigestSummary = { sent: false, failedDeliveries: 0, unreachableClients: 0, emailFailures: 0, configIssues: 0 };
  try {
    const { data: failedRows, count } = await supabase
      .from('outbound_deliveries')
      .select(DELIVERY_COLUMNS, { count: 'exact' })
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(MAX_LISTED);
    const failedDeliveries = await describeDeliveries(supabase, (failedRows ?? []) as DeliveryRow[]);
    summary.failedDeliveries = count ?? failedDeliveries.length;

    // Unreachable addresses of clients whose policy expires within 90 days.
    const today = now.toISOString().slice(0, 10);
    const horizon = new Date(now.getTime() + 90 * DAY_MS).toISOString().slice(0, 10);
    const { data: suppressed } = await supabase.from('email_suppressions').select('email').limit(1000);
    const unreachable = new Set(((suppressed ?? []) as Array<{ email: string }>).map((row) => row.email));
    const byAddress = new Map<string, string[]>();
    if (unreachable.size > 0) {
      const { data: expiring } = await supabase
        .from('practices')
        .select('practice_number, client_email')
        .gte('policy_end_date', today)
        .lte('policy_end_date', horizon)
        .limit(2000);
      for (const practice of (expiring ?? []) as Array<{ practice_number: string; client_email: string | null }>) {
        const address = practice.client_email?.trim().toLowerCase();
        if (address && unreachable.has(address)) byAddress.set(address, [...(byAddress.get(address) ?? []), practice.practice_number]);
      }
    }
    const unreachableClients = [...byAddress].map(([address, practices]) => ({ address, practices }));
    summary.unreachableClients = unreachableClients.length;

    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const { data: failedMail, count: failedMailCount } = await supabase
      .from('email_logs')
      .select('error_message', { count: 'exact' })
      .in('status', ['failed', 'bounced', 'complained'])
      .gte('created_at', since)
      .limit(5);
    summary.emailFailures = failedMailCount ?? (failedMail ?? []).length;
    const sample = [...new Set(((failedMail ?? []) as Array<{ error_message: string | null }>).map((row) => shorten(row.error_message ?? '—', 120)))];

    // Blocking configuration problems every day; the softer warnings only on Mondays (they do not change from day to day).
    const env = checkEnv();
    const configIssues: Array<EnvIssue & { blocking: boolean }> = [
      ...env.errors.map((issue) => ({ ...issue, blocking: true })),
      ...(now.getUTCDay() === 1 ? env.warnings.map((issue) => ({ ...issue, blocking: false })) : []),
    ];
    summary.configIssues = configIssues.length;

    if (summary.failedDeliveries === 0 && unreachableClients.length === 0 && summary.emailFailures === 0 && configIssues.length === 0) return summary;

    const result = await alertAdmins(
      supabase,
      (language) => {
        const copy = alertCopy(language);
        const listing = [
          ...failedDeliveries.map((item) => ({ text: copy.deliveryFailed.line(item), url: `${portalUrl()}/settings` })),
          ...unreachableClients.slice(0, MAX_LISTED).map((item) => ({ text: `${item.address} · ${item.practices.slice(0, 5).join(', ')}`, url: `${portalUrl()}/expiry` })),
          ...configIssues.slice(0, MAX_LISTED).map((issue) => ({ text: `${issue.name} — ${issue.message}`, url: `${portalUrl()}/settings` })),
        ];
        const sections: string[] = [];
        if (summary.failedDeliveries > 0) sections.push(copy.digest.deliveries(failedDeliveries.length, summary.failedDeliveries));
        if (unreachableClients.length > 0) sections.push(`${copy.digest.unreachable}: ${unreachableClients.length}`);
        if (configIssues.length > 0) sections.push(copy.digest.config(env.errors.length, configIssues.length - env.errors.length));
        if (summary.emailFailures > 0) sections.push(`${copy.digest.emailFailures(summary.emailFailures)}${sample.length > 0 ? ` (${sample.join(' | ')})` : ''}`);
        return {
          subject: copy.digest.subject,
          paragraphs: [copy.greeting, copy.digest.intro, ...sections.map((section) => `• ${section}`)],
          listing,
          closing: [copy.digest.action],
        };
      },
      { template: 'admin_digest' },
    );
    summary.sent = result.sent > 0;
  } catch (error) {
    console.error('Riepilogo giornaliero non riuscito:', error instanceof Error ? error.message : error);
  }
  return summary;
}

/** An automatic task stopped with an error: say so, instead of leaving it to the Vercel log. */
export async function alertCronFailure(supabase: SupabaseClient, job: string, error: unknown): Promise<void> {
  const message = shorten(error instanceof Error ? error.message : String(error), 300);
  await captureServerError(error, job, { tags: { kind: 'cron' } });
  await alertAdmins(
    supabase,
    (language) => {
      const copy = alertCopy(language).cronFailed;
      return { subject: copy.subject(job), paragraphs: [alertCopy(language).greeting, copy.intro(job, message)], closing: [copy.action] };
    },
    { template: 'admin_alert_cron_failed' },
  );
}
