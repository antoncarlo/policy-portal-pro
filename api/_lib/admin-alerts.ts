import type { SupabaseClient } from '@supabase/supabase-js';
import { portalUrl } from './auth-emails.js';
import { sendMailLogged } from './email-log.js';
import { getMailProvider } from './mailer.js';
import { copyFor, renderEmail, toLanguage, type EmailParts, type Language } from './notification-copy.js';
import { extraAddresses, isEmailAddress } from './notification-dispatch.js';

/**
 * Emails to the administrators about what needs a human: failed deliveries to external portals, an
 * address that bounced, a failed automatic task, the daily summary. They go to the addresses chosen for
 * each administrator in "Gestione utenti" (the sign-in email by default) and to the office mailboxes
 * (ADMIN_NOTIFICATION_EMAILS), one email per language.
 */

export interface AdminRecipient {
  email: string;
  language: Language;
}

export interface AlertContent {
  subject: string;
  title?: string;
  paragraphs: string[];
  listing?: EmailParts['listing'];
  listingMore?: number;
  closing?: string[];
  buttonUrl?: string;
}

const unique = <T>(values: T[]) => [...new Set(values)];

export async function adminRecipients(supabase: SupabaseClient): Promise<AdminRecipient[]> {
  const { data: roles, error } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  if (error) throw new Error(`user_roles: ${error.message}`);
  const ids = unique((roles ?? []).map((row: { user_id: string }) => row.user_id));

  const recipients = new Map<string, AdminRecipient>();
  if (ids.length > 0) {
    const [profiles, settings] = await Promise.all([
      supabase.from('profiles').select('id, email, language').in('id', ids),
      supabase.from('user_notification_settings').select('user_id, notification_emails').in('user_id', ids),
    ]);
    const chosen = new Map<string, string[]>((settings.data ?? []).map((row: { user_id: string; notification_emails: string[] | null }) => [row.user_id, row.notification_emails ?? []]));
    for (const profile of (profiles.data ?? []) as Array<{ id: string; email: string | null; language: string | null }>) {
      const language = toLanguage(profile.language);
      const own = (chosen.get(profile.id) ?? []).map((address) => address.trim()).filter(isEmailAddress);
      const addresses = own.length > 0 ? own : isEmailAddress(profile.email) ? [profile.email.trim()] : [];
      for (const address of addresses) recipients.set(address.toLowerCase(), { email: address.toLowerCase(), language });
    }
  }
  for (const address of extraAddresses()) if (!recipients.has(address)) recipients.set(address, { email: address, language: 'it' });
  return [...recipients.values()];
}

/** Sends one alert to every administrator, written in each one's language. Never throws. */
export async function alertAdmins(
  supabase: SupabaseClient,
  build: (language: Language) => AlertContent,
  meta: { template: string; practiceId?: string | null },
): Promise<{ sent: number; failed: number; recipients: number; reason?: string }> {
  try {
    if (getMailProvider() === 'none') return { sent: 0, failed: 0, recipients: 0, reason: 'no_mail_provider' };
    const recipients = await adminRecipients(supabase);
    const byLanguage = new Map<Language, string[]>();
    for (const recipient of recipients) byLanguage.set(recipient.language, [...(byLanguage.get(recipient.language) ?? []), recipient.email]);

    let sent = 0;
    let failed = 0;
    for (const [language, addresses] of byLanguage) {
      const content = build(language);
      const copy = copyFor(language);
      const html = renderEmail({
        language,
        title: content.title ?? content.subject,
        paragraphs: content.paragraphs,
        listing: content.listing,
        listingMore: content.listingMore,
        closing: content.closing,
        button: { label: copy.buttonMany, url: content.buttonUrl ?? `${portalUrl()}/dashboard` },
        footer: copy.footer,
      });
      const result = await sendMailLogged(supabase, { to: addresses, subject: content.subject, html }, { template: meta.template, practiceId: meta.practiceId });
      if (result.success) sent += 1;
      else {
        failed += 1;
        console.error(`Avviso agli amministratori (${meta.template}) non inviato:`, result.error);
      }
    }
    return { sent, failed, recipients: recipients.length };
  } catch (error) {
    console.error(`Avviso agli amministratori (${meta.template}) non riuscito:`, error instanceof Error ? error.message : error);
    return { sent: 0, failed: 1, recipients: 0, reason: error instanceof Error ? error.message : 'error' };
  }
}
