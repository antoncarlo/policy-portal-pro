import type { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { hitRateLimit } from './rate-limit.js';
import { alertAdmins } from './admin-alerts.js';

/**
 * Failed sign-ins, as the portal's own sign-in page reports them (the address typed, never the password).
 *
 * What this is and is not: the sign-in itself is done by Supabase from the browser, so the portal only
 * learns of a failure because the page tells it. An attempt made straight against Supabase's authentication
 * address does not pass here (Supabase keeps those in its own authentication log). The report is public and
 * therefore spoofable, so it is only ever a log line: it is counted per address and per caller, never used to
 * lock anybody, and the administrators are warned once per address and hour when the same address keeps failing.
 */

export const LOGIN_FAILURE_WINDOW_SECONDS = 600;
/** Reports taken from one caller in the window. */
export const MAX_REPORTS_PER_IP = 30;
/** Lines written for one address in the window; the rest are not written. */
export const MAX_LINES_PER_ADDRESS = 20;
/** Failures of one address in the window that make the administrators hear of it. */
export const ALERT_AFTER_FAILURES = 5;
/** Warnings sent in an hour whatever the addresses: a flood of invented ones cannot fill the administrators' mailbox. */
export const MAX_ALERTS_PER_HOUR = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginFailureReport {
  email: unknown;
  ip: string | null;
  userAgent?: string | null;
}

export type LoginFailureResult =
  | { status: 'invalid' }
  | { status: 'rate_limited'; retryAfter: number }
  | { status: 'recorded'; written: boolean; alerted: boolean };

const addressKey = (email: string) => crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);

export async function recordLoginFailure(supabase: SupabaseClient, report: LoginFailureReport): Promise<LoginFailureResult> {
  const email = typeof report.email === 'string' ? report.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return { status: 'invalid' };

  const fromIp = await hitRateLimit(supabase, `login-failure:ip:${report.ip ?? 'unknown'}`, { limit: MAX_REPORTS_PER_IP, windowSeconds: LOGIN_FAILURE_WINDOW_SECONDS });
  if (!fromIp.allowed) return { status: 'rate_limited', retryAfter: fromIp.retryAfter };

  const key = addressKey(email);
  // Whether the address belongs to an account tells a mistyped address from an attack: kept in the line, never answered.
  let known: boolean | null = null;
  const knownAccount = async () => {
    if (known === null) {
      try {
        const { data } = await supabase.rpc('auth_user_for_email', { p_email: email });
        known = Array.isArray(data) && data.length > 0;
      } catch {
        // the line is worth more than this detail
        known = false;
      }
    }
    return known;
  };

  let written = false;
  const lines = await hitRateLimit(supabase, `login-failure:lines:${key}`, { limit: MAX_LINES_PER_ADDRESS, windowSeconds: LOGIN_FAILURE_WINDOW_SECONDS });
  if (lines.allowed) {
    const { error } = await supabase.from('audit_log').insert({
      actor_id: null,
      actor_role: null,
      source: 'app',
      table_name: 'app',
      row_id: null,
      action: 'session.login_failed',
      details: { email, known_account: await knownAccount() },
      ip: report.ip,
      user_agent: report.userAgent ? report.userAgent.slice(0, 300) : null,
    });
    if (error) console.error('login-failures: riga non scritta:', error.message);
    else written = true;
  }

  let alerted = false;
  // The counter allows ALERT_AFTER_FAILURES - 1 calls: the one that is refused is the failure that reaches the threshold.
  const repeated = await hitRateLimit(supabase, `login-failure:repeat:${key}`, { limit: ALERT_AFTER_FAILURES - 1, windowSeconds: LOGIN_FAILURE_WINDOW_SECONDS });
  if (!repeated.allowed) {
    // Once per address and hour, however long it goes on.
    const hourly = await hitRateLimit(supabase, `login-failure:alert:${key}`, { limit: 1, windowSeconds: 3600 });
    const overall = hourly.allowed ? await hitRateLimit(supabase, 'login-failure:alert:all', { limit: MAX_ALERTS_PER_HOUR, windowSeconds: 3600 }) : null;
    if (hourly.allowed && overall?.allowed) {
      const isKnown = await knownAccount();
      const result = await alertAdmins(supabase, (language) => alertCopy(language, email, isKnown), { template: 'admin_login_failures' });
      alerted = result.sent > 0;
    }
  }
  return { status: 'recorded', written, alerted };
}

interface Copy {
  subject: string;
  title: string;
  paragraphs: string[];
  closing: string;
}

function alertCopy(language: string, email: string, known: boolean) {
  const minutes = LOGIN_FAILURE_WINDOW_SECONDS / 60;
  const text: Record<string, Copy> = {
    it: {
      subject: `Accessi falliti ripetuti per ${email}`,
      title: 'Accessi falliti ripetuti',
      paragraphs: [
        `Nella schermata di accesso del portale ci sono stati almeno ${ALERT_AFTER_FAILURES} tentativi falliti per ${email} in ${minutes} minuti.`,
        known ? 'L\'indirizzo corrisponde a un account del portale.' : 'L\'indirizzo non corrisponde a nessun account del portale.',
      ],
      closing: 'Se non riconosci l\'attività, controlla il registro in Impostazioni › Log e, se serve, disattiva l\'account o azzera la password.',
    },
    en: {
      subject: `Repeated failed sign-ins for ${email}`,
      title: 'Repeated failed sign-ins',
      paragraphs: [
        `The portal's sign-in page recorded at least ${ALERT_AFTER_FAILURES} failed attempts for ${email} within ${minutes} minutes.`,
        known ? 'The address belongs to an account of the portal.' : 'The address does not belong to any account of the portal.',
      ],
      closing: 'If you do not recognise the activity, check the log in Settings › Logs and, if needed, deactivate the account or reset the password.',
    },
    zh: {
      subject: `${email} 多次登录失败`,
      title: '多次登录失败',
      paragraphs: [
        `${minutes} 分钟内，门户登录页面记录到 ${email} 至少 ${ALERT_AFTER_FAILURES} 次登录失败。`,
        known ? '该地址对应门户中的一个账户。' : '该地址不对应门户中的任何账户。',
      ],
      closing: '如果您不认识这些活动，请在“设置 › 日志”中查看，必要时停用该账户或重置密码。',
    },
  };
  const chosen = text[language] ?? text.it;
  return { subject: chosen.subject, title: chosen.title, paragraphs: chosen.paragraphs, closing: [chosen.closing] };
}
