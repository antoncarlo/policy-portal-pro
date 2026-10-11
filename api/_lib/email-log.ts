import type { SupabaseClient } from '@supabase/supabase-js';
import { getMailProvider, sendMail, type MailMessage, type MailResult } from './mailer.js';

/**
 * Every email the portal sends goes through `sendMailLogged`: it is written to `email_logs` (who, what,
 * when, outcome, the provider's message id so the delivery report can find it again) and addresses the
 * provider reported as unreachable (`email_suppressions`) are not written to again.
 */

export interface EmailLogMeta {
  /** Which email it is, e.g. `access_welcome`, `notification_status_changed`, `admin_alert_delivery`. */
  template: string;
  notificationType?: string | null;
  practiceId?: string | null;
  recipientName?: string | null;
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const toList = (to: string | string[]) => (Array.isArray(to) ? to : [to]).map((address) => address.trim()).filter(Boolean);

export const SUPPRESSED_REASON = 'Indirizzo non raggiungibile: il provider ha segnalato un rimbalzo definitivo o un reclamo';

/** Which of the addresses must not be written to. Fails open: a lookup problem must not stop the email. */
export async function findSuppressed(supabase: SupabaseClient, addresses: string[]): Promise<Set<string>> {
  const wanted = [...new Set(addresses.map((address) => address.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return new Set();
  const { data, error } = await supabase.from('email_suppressions').select('email').in('email', wanted);
  if (error) {
    console.error('email_suppressions non letta:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row: { email: string }) => row.email));
}

/** One line per recipient. A failure to write the log is reported but never stops the caller. */
export async function recordEmail(
  supabase: SupabaseClient,
  recipients: string[],
  subject: string,
  result: Pick<MailResult, 'success' | 'id' | 'error'>,
  meta: EmailLogMeta,
): Promise<void> {
  if (recipients.length === 0) return;
  const provider = getMailProvider();
  const rows = recipients.map((address) => ({
    practice_id: meta.practiceId ?? null,
    recipient_email: address,
    recipient_name: meta.recipientName || null,
    subject: shorten(subject, 300),
    template_used: meta.template,
    notification_type: meta.notificationType ?? null,
    resend_email_id: result.id ?? null,
    provider: provider === 'none' ? null : provider,
    status: result.success ? 'sent' : 'failed',
    error_message: result.success ? null : shorten(result.error ?? 'errore sconosciuto', 500),
  }));
  const { error } = await supabase.from('email_logs').insert(rows);
  if (error) console.error('Registro email non scritto:', error.message);
}

export async function sendMailLogged(supabase: SupabaseClient, message: MailMessage, meta: EmailLogMeta): Promise<MailResult> {
  const recipients = toList(message.to);
  const suppressed = await findSuppressed(supabase, recipients);
  const reachable = recipients.filter((address) => !suppressed.has(address.toLowerCase()));

  if (reachable.length === 0) {
    const result: MailResult = { success: false, error: SUPPRESSED_REASON };
    await recordEmail(supabase, recipients, message.subject, result, meta);
    return result;
  }

  const result = await sendMail({ ...message, to: reachable });
  await recordEmail(supabase, reachable, message.subject, result, meta);
  if (suppressed.size > 0) {
    await recordEmail(supabase, recipients.filter((address) => suppressed.has(address.toLowerCase())), message.subject, { success: false, error: SUPPRESSED_REASON }, meta);
  }
  return result;
}
