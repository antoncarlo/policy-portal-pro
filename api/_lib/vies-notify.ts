import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeLanguage, portalUrl, type EmailLanguage } from './auth-emails.js';
import { escapeHtml, getMailProvider, sendMail } from './mailer.js';

/**
 * Email to the person who owns a practice when the company moves it on: deliberated (draft ready to
 * pay), more documents asked for, not deliberated, policy issued. In-app notifications already come
 * from the status change; the email follows the user's own "status change" preference.
 */

export type NotifyKind = 'deliberated' | 'info_requested' | 'rejected' | 'issued';

interface Details {
  dueDate?: string | null;
  note?: string | null;
}

interface Copy {
  subject: string;
  title: string;
  lines: string[];
  button: string;
}

const formatDate = (iso: string, language: EmailLanguage) => {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return language === 'it' ? `${day}/${month}/${year}` : language === 'zh' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
};

function copyFor(kind: NotifyKind, language: EmailLanguage, number: string, client: string, details: Details): Copy {
  const due = details.dueDate ? formatDate(details.dueDate, language) : null;
  const note = details.note?.trim() || null;
  const texts: Record<EmailLanguage, Record<NotifyKind, Copy>> = {
    it: {
      deliberated: {
        subject: `Pratica ${number} deliberata: bozza da pagare`,
        title: 'La pratica è stata deliberata',
        lines: [
          `La pratica ${number} (${client}) è stata deliberata. La bozza è disponibile nel portale.`,
          due ? `Il pagamento va effettuato entro il ${due}.` : 'Dopo la registrazione del pagamento la polizza potrà essere emessa.',
          ...(note ? [`Nota: ${note}`] : []),
        ],
        button: 'Apri la pratica',
      },
      info_requested: {
        subject: `Pratica ${number}: integrazioni richieste`,
        title: 'Servono delle integrazioni',
        lines: [`Per la pratica ${number} (${client}) servono documenti o chiarimenti prima di decidere.`, ...(note ? [`Richiesta: ${note}`] : [])],
        button: 'Apri la pratica',
      },
      rejected: {
        subject: `Pratica ${number} non deliberata`,
        title: 'La pratica non è stata deliberata',
        lines: [`La pratica ${number} (${client}) non è stata deliberata.`, ...(note ? [`Motivo: ${note}`] : [])],
        button: 'Apri la pratica',
      },
      issued: {
        subject: `Pratica ${number}: polizza emessa`,
        title: 'La polizza è stata emessa',
        lines: [`Per la pratica ${number} (${client}) la polizza è stata emessa. Il documento è disponibile nel portale.`],
        button: 'Apri la pratica',
      },
    },
    en: {
      deliberated: {
        subject: `Practice ${number} approved: draft ready for payment`,
        title: 'The practice has been approved',
        lines: [
          `Practice ${number} (${client}) has been approved. The draft is available in the portal.`,
          due ? `Payment is due by ${due}.` : 'Once the payment is recorded, the policy can be issued.',
          ...(note ? [`Note: ${note}`] : []),
        ],
        button: 'Open the practice',
      },
      info_requested: {
        subject: `Practice ${number}: more information requested`,
        title: 'More information is needed',
        lines: [`For practice ${number} (${client}) documents or clarifications are needed before deciding.`, ...(note ? [`Request: ${note}`] : [])],
        button: 'Open the practice',
      },
      rejected: {
        subject: `Practice ${number} not approved`,
        title: 'The practice has not been approved',
        lines: [`Practice ${number} (${client}) has not been approved.`, ...(note ? [`Reason: ${note}`] : [])],
        button: 'Open the practice',
      },
      issued: {
        subject: `Practice ${number}: policy issued`,
        title: 'The policy has been issued',
        lines: [`For practice ${number} (${client}) the policy has been issued. The document is available in the portal.`],
        button: 'Open the practice',
      },
    },
    zh: {
      deliberated: {
        subject: `保单申请 ${number} 已核准：待付款草稿`,
        title: '该申请已核准',
        lines: [
          `申请 ${number}（${client}）已核准，草稿已上传至门户。`,
          due ? `请在 ${due} 前完成付款。` : '登记付款后即可出单。',
          ...(note ? [`备注：${note}`] : []),
        ],
        button: '打开申请',
      },
      info_requested: {
        subject: `申请 ${number}：需补充材料`,
        title: '需要补充材料',
        lines: [`申请 ${number}（${client}）在作出决定前，需要补充文件或说明。`, ...(note ? [`要求：${note}`] : [])],
        button: '打开申请',
      },
      rejected: {
        subject: `申请 ${number} 未获核准`,
        title: '该申请未获核准',
        lines: [`申请 ${number}（${client}）未获核准。`, ...(note ? [`原因：${note}`] : [])],
        button: '打开申请',
      },
      issued: {
        subject: `申请 ${number}：保单已出具`,
        title: '保单已出具',
        lines: [`申请 ${number}（${client}）的保单已出具，文件已上传至门户。`],
        button: '打开申请',
      },
    },
  };
  return texts[language][kind];
}

const FONT = "Arial, Helvetica, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

export function renderPracticeEmail(copy: Copy, language: EmailLanguage, link: string): string {
  const paragraph = (text: string) => `<p style="margin:0 0 12px 0;line-height:1.55;font-size:15px;color:#1d2433;">${escapeHtml(text)}</p>`;
  return `<!DOCTYPE html>
<html lang="${language === 'zh' ? 'zh-CN' : language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;border:1px solid #e4e7ec;">
<tr><td style="padding:22px 36px 14px 36px;border-bottom:2px solid #ac7e59;"><img src="${portalUrl()}/brand/tecno-mga-logo.png" width="170" alt="Tecno Advance MGA" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:26px 36px 8px 36px;">
<h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.25;color:#103657;font-family:${FONT};">${escapeHtml(copy.title)}</h1>
${copy.lines.map(paragraph).join('')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 16px 0;"><tr><td style="background:#103657;border-radius:6px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(copy.button)}</a></td></tr></table>
</td></tr>
<tr><td style="padding:16px 36px 24px 36px;background:#f7f8fa;border-top:1px solid #e4e7ec;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:11px;line-height:1.6;color:#667085;"><strong style="color:#103657;">Tecno Advance MGA Broker Srl</strong> · Iscr. IVASS n. B000746484 · P.IVA 17460381001<br>Viale Parioli, 74 - 00197 Roma · info@tecnomga.com · ${portalUrl()}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

/** Best effort: a failed email never undoes the change of status. */
export async function notifyPracticeOwner(supabase: SupabaseClient, practiceId: string, kind: NotifyKind, details: Details = {}): Promise<boolean> {
  try {
    if (getMailProvider() === 'none') return false;
    const { data: practice } = await supabase.from('practices').select('practice_number, client_name, user_id').eq('id', practiceId).maybeSingle();
    if (!practice) return false;
    const { data: profile } = await supabase.from('profiles').select('email, language, email_notifications').eq('id', practice.user_id).maybeSingle();
    if (!profile?.email) return false;
    const preferences = (profile.email_notifications ?? {}) as { status_change?: boolean };
    if (preferences.status_change === false) return false;

    const language = normalizeLanguage(profile.language);
    const copy = copyFor(kind, language, practice.practice_number as string, practice.client_name as string, details);
    const link = `${portalUrl()}/practices/${practiceId}`;
    const result = await sendMail({ to: profile.email as string, subject: copy.subject, html: renderPracticeEmail(copy, language, link) });
    if (!result.success) console.error('vies-notify: email non inviata:', result.error);
    return result.success;
  } catch (error) {
    console.error('vies-notify:', error instanceof Error ? error.message : error);
    return false;
  }
}
