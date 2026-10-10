import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml, getMailProvider, sendMail } from './mailer.js';

/**
 * Welcome and password-reset emails of the portal.
 *
 * They are sent by the portal (Gmail / Resend, like every other portal email), not by the Supabase
 * mailer: no dependency on the Supabase SMTP settings, no sending limits of the default mailer, and
 * the same sender as the rest of the portal.
 *
 * The link points to the portal's own /reset-password page with the one-time token hash of a Supabase
 * recovery link. The token is consumed only when the user submits the new password on that page.
 */

export type EmailLanguage = 'it' | 'en' | 'zh';
export type AccessEmailKind = 'welcome' | 'recovery';

export const normalizeLanguage = (value: unknown): EmailLanguage => (value === 'en' || value === 'zh' ? value : 'it');

export const portalUrl = () => (process.env.PORTAL_URL || 'https://portale.tecnomga.com').replace(/\/+$/, '');

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Configurazione server mancante');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Client with the public key, to test credentials without touching the admin session. */
export function getSupabaseAnon(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configurazione server mancante');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface Copy {
  subject: string;
  title: string;
  intro: string[];
  button: string;
  notes: string[];
  fallback: string;
  support: string;
}

const COPY: Record<AccessEmailKind, Record<EmailLanguage, (name: string, email: string) => Copy>> = {
  welcome: {
    it: (name, email) => ({
      subject: 'Benvenuto nel Portale Tecno Advance MGA',
      title: name ? `Benvenuto, ${name}` : 'Benvenuto',
      intro: [
        'È stato creato il tuo account sul Portale Tecno Advance MGA.',
        `Per accedere usa l'indirizzo ${email}. Premi il pulsante per scegliere la tua password personale.`,
      ],
      button: 'Imposta la tua password',
      notes: [
        'Il link ha una durata limitata. Se è scaduto, dalla pagina di accesso scegli «Password dimenticata».',
        "Se l'amministratore ti ha già comunicato una password provvisoria puoi usare quella: ti verrà chiesto di sostituirla al primo accesso.",
      ],
      fallback: 'Se il pulsante non funziona, copia questo indirizzo nel browser:',
      support: 'Per assistenza scrivi a',
    }),
    en: (name, email) => ({
      subject: 'Welcome to the Tecno Advance MGA Portal',
      title: name ? `Welcome, ${name}` : 'Welcome',
      intro: [
        'Your account on the Tecno Advance MGA Portal has been created.',
        `Sign in with ${email}. Press the button to choose your personal password.`,
      ],
      button: 'Set your password',
      notes: [
        'The link is valid for a limited time. If it has expired, choose “Forgot password” on the sign-in page.',
        'If the administrator already gave you a temporary password you can use it: you will be asked to replace it at your first sign-in.',
      ],
      fallback: 'If the button does not work, copy this address into your browser:',
      support: 'For help write to',
    }),
    zh: (name, email) => ({
      subject: '欢迎使用 Tecno Advance MGA 门户',
      title: name ? `欢迎，${name}` : '欢迎',
      intro: ['您在 Tecno Advance MGA 门户的账号已创建。', `请使用 ${email} 登录。点击按钮设置您的个人密码。`],
      button: '设置密码',
      notes: ['链接在有限时间内有效。如已过期，请在登录页面选择“忘记密码”。', '如果管理员已告知您临时密码，也可以使用它：首次登录时系统会要求您更换。'],
      fallback: '如果按钮无法使用，请将以下地址复制到浏览器：',
      support: '如需帮助，请联系',
    }),
  },
  recovery: {
    it: (_name, email) => ({
      subject: 'Reimposta la password del Portale Tecno Advance MGA',
      title: 'Reimposta la password',
      intro: [`Abbiamo ricevuto una richiesta di reimpostazione della password per l'account ${email}.`, 'Premi il pulsante per scegliere una nuova password.'],
      button: 'Scegli una nuova password',
      notes: ['Il link ha una durata limitata e si può usare una sola volta.', 'Se non hai fatto tu la richiesta, ignora questo messaggio: la password attuale resta valida.'],
      fallback: 'Se il pulsante non funziona, copia questo indirizzo nel browser:',
      support: 'Per assistenza scrivi a',
    }),
    en: (_name, email) => ({
      subject: 'Reset your Tecno Advance MGA Portal password',
      title: 'Reset your password',
      intro: [`We received a request to reset the password of the account ${email}.`, 'Press the button to choose a new password.'],
      button: 'Choose a new password',
      notes: ['The link is valid for a limited time and can be used only once.', 'If you did not make this request, ignore this message: your current password stays valid.'],
      fallback: 'If the button does not work, copy this address into your browser:',
      support: 'For help write to',
    }),
    zh: (_name, email) => ({
      subject: '重置 Tecno Advance MGA 门户密码',
      title: '重置密码',
      intro: [`我们收到了账号 ${email} 的密码重置申请。`, '请点击按钮设置新密码。'],
      button: '设置新密码',
      notes: ['链接在有限时间内有效，且只能使用一次。', '如果这不是您本人的操作，请忽略本邮件：当前密码仍然有效。'],
      fallback: '如果按钮无法使用，请将以下地址复制到浏览器：',
      support: '如需帮助，请联系',
    }),
  },
};

const FONT = "Arial, Helvetica, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";
const SUPPORT_ADDRESS = 'info@tecnomga.com';

export function renderAccessEmail(
  kind: AccessEmailKind,
  language: EmailLanguage,
  data: { name: string; email: string; link: string },
): { subject: string; html: string } {
  const copy = COPY[kind][language](data.name, data.email);
  const paragraph = (text: string, style = 'font-size:15px;color:#1d2433;') =>
    `<p style="margin:0 0 12px 0;line-height:1.55;${style}">${escapeHtml(text)}</p>`;
  const html = `<!DOCTYPE html>
<html lang="${language === 'zh' ? 'zh-CN' : language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;border:1px solid #e4e7ec;">
<tr><td style="padding:22px 36px 14px 36px;border-bottom:2px solid #ac7e59;"><img src="${portalUrl()}/brand/tecno-mga-logo.png" width="170" alt="Tecno Advance MGA" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:26px 36px 8px 36px;">
<h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.25;color:#103657;font-family:${FONT};">${escapeHtml(copy.title)}</h1>
${copy.intro.map((text) => paragraph(text)).join('')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px 0;"><tr><td style="background:#103657;border-radius:6px;"><a href="${escapeHtml(data.link)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(copy.button)}</a></td></tr></table>
${copy.notes.map((text) => paragraph(text, 'font-size:12.5px;color:#667085;')).join('')}
</td></tr>
<tr><td style="padding:6px 36px 20px 36px;"><p style="margin:0;font-size:11.5px;line-height:1.5;color:#98a2b3;word-break:break-all;">${escapeHtml(copy.fallback)} <a href="${escapeHtml(data.link)}" style="color:#98a2b3;">${escapeHtml(data.link)}</a></p>
<p style="margin:8px 0 0 0;font-size:11.5px;line-height:1.5;color:#98a2b3;">${escapeHtml(copy.support)} <a href="mailto:${SUPPORT_ADDRESS}" style="color:#98a2b3;">${SUPPORT_ADDRESS}</a></p></td></tr>
<tr><td style="padding:16px 36px 24px 36px;background:#f7f8fa;border-top:1px solid #e4e7ec;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:11px;line-height:1.6;color:#667085;"><strong style="color:#103657;">Tecno Advance MGA Broker Srl</strong> · Iscr. IVASS n. B000746484 · P.IVA 17460381001<br>Viale Parioli, 74 - 00197 Roma · ${SUPPORT_ADDRESS} · ${portalUrl()}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: copy.subject, html };
}

export interface AccessEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Creates a one-time recovery token for an existing user and emails the link to the user.
 * Never throws: the caller decides what to tell the person who asked.
 */
export async function sendAccessEmail(
  supabase: SupabaseClient,
  params: { kind: AccessEmailKind; email: string; name: string; language: EmailLanguage },
): Promise<AccessEmailResult> {
  if (getMailProvider() === 'none') return { sent: false, reason: 'Nessun servizio email configurato' };

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email: params.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return { sent: false, reason: `Creazione del link non riuscita: ${error?.message ?? 'token mancante'}` };

  const link = `${portalUrl()}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&kind=${params.kind}`;
  const { subject, html } = renderAccessEmail(params.kind, params.language, { name: params.name, email: params.email, link });
  const result = await sendMail({ to: params.email, subject, html });
  if (!result.success) return { sent: false, reason: `Invio email non riuscito: ${result.error ?? 'errore sconosciuto'}` };
  return { sent: true };
}
