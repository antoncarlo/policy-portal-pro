/**
 * Invio email del portale (cron scadenze, notifiche agli admin).
 *
 * Due canali, scelti dalle variabili d'ambiente di Vercel:
 *  - Gmail / Google Workspace via SMTP, se sono presenti GMAIL_USER e GMAIL_APP_PASSWORD
 *    (password per le app dell'account, non la password di accesso). Non richiede record DNS.
 *  - Resend, se c'e' RESEND_API_KEY. Richiede il dominio mittente verificato su Resend.
 * Se sono configurati entrambi vince Gmail. Nessuna chiave arriva mai al browser.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
}

export interface MailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export type MailProvider = 'gmail' | 'resend' | 'none';

const SENDER_NAME = () => process.env.EMAIL_FROM_NAME || process.env.VITE_EMAIL_FROM_NAME || 'Tecno Advance MGA';

function gmailCredentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  // Google mostra la password per le app a gruppi di 4 lettere separati da spazi.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  return user && pass ? { user, pass } : null;
}

function resendKey(): string | undefined {
  return process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
}

export function getMailProvider(): MailProvider {
  if (gmailCredentials()) return 'gmail';
  if (resendKey()) return 'resend';
  return 'none';
}

const gmailSender = (user: string) => process.env.GMAIL_FROM || user;
const resendSender = () => process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || 'notifiche@tecnomga.com';

/** Indirizzo da cui partono le email con il canale attivo, null se non ce n'e' uno. */
export function getSenderAddress(): string | null {
  const credentials = gmailCredentials();
  if (credentials) return gmailSender(credentials.user);
  return resendKey() ? resendSender() : null;
}

let cachedTransport: { key: string; transport: Transporter } | null = null;

function gmailTransport(credentials: { user: string; pass: string }): Transporter {
  // SMTP_HOST / SMTP_PORT servono solo per provare l'invio contro un server locale.
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const key = `${host}:${port}:${credentials.user}:${credentials.pass}`;
  if (cachedTransport?.key === key) return cachedTransport.transport;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: credentials,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedTransport = { key, transport };
  return transport;
}

async function sendWithGmail(message: MailMessage, credentials: { user: string; pass: string }): Promise<MailResult> {
  try {
    const info = await gmailTransport(credentials).sendMail({
      from: `${SENDER_NAME()} <${gmailSender(credentials.user)}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0) {
      return { success: false, error: `Destinatari rifiutati dal server: ${rejected.length}` };
    }
    return { success: true, id: info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Errore SMTP sconosciuto' };
  }
}

async function sendWithResend(message: MailMessage, apiKey: string): Promise<MailResult> {
  const sender = resendSender();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${SENDER_NAME()} <${sender}>`,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!response.ok) return { success: false, error: JSON.stringify(payload) };
    return { success: true, id: payload?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Errore Resend sconosciuto' };
  }
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const credentials = gmailCredentials();
  if (credentials) return sendWithGmail(message, credentials);

  const apiKey = resendKey();
  if (apiKey) return sendWithResend(message, apiKey);

  return { success: false, error: 'Nessun servizio email configurato (GMAIL_USER/GMAIL_APP_PASSWORD oppure RESEND_API_KEY)' };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
