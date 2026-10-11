import type { PracticeStage } from '../../src/lib/practiceStages.js';
import { normalizeLanguage, portalUrl, type EmailLanguage } from './auth-emails.js';
import { escapeHtml } from './mailer.js';

/**
 * The words of the notification emails, in Italian, English and Chinese. Written to be personal
 * ("Dear Mario, practice n. … has been approved: log in to see what to do"), the same for every type
 * of practice, and neutral about who decided (the agency, or the company's portal when connected).
 */

export type Language = EmailLanguage;
export const toLanguage = (value: unknown): Language => normalizeLanguage(value);

const TYPE_LABELS: Record<Language, Record<string, string>> = {
  it: {
    auto: 'Auto', casa: 'Casa', vita: 'Vita', salute: 'Salute', responsabilita: 'Responsabilità Civile', altro: 'Altro',
    fidejussioni: 'Fidejussioni', vies: 'VIES', car: 'CAR', postuma_decennale: 'Postuma Decennale', all_risk: 'All Risk',
    responsabilita_civile: 'Responsabilità Civile', pet: 'Pet', fotovoltaico: 'Fotovoltaico', catastrofali: 'Catastrofali',
    azienda: 'Azienda', risparmio: 'Risparmio',
  },
  en: {
    auto: 'Motor', casa: 'Home', vita: 'Life', salute: 'Health', responsabilita: 'Third-Party Liability', altro: 'Other',
    fidejussioni: 'Surety Bonds', vies: 'VIES', car: "Contractors' All Risks (CAR)", postuma_decennale: 'Ten-Year Latent Defects',
    all_risk: 'All Risks', responsabilita_civile: 'Third-Party Liability', pet: 'Pet', fotovoltaico: 'Photovoltaic',
    catastrofali: 'Natural Catastrophe', azienda: 'Business', risparmio: 'Savings',
  },
  zh: {
    auto: '车险', casa: '家财险', vita: '寿险', salute: '健康险', responsabilita: '第三者责任险', altro: '其他',
    fidejussioni: '保证保险', vies: 'VIES', car: '建筑工程一切险（CAR）', postuma_decennale: '十年期潜在缺陷险', all_risk: '一切险',
    responsabilita_civile: '第三者责任险', pet: '宠物险', fotovoltaico: '光伏险', catastrofali: '巨灾险', azienda: '企业险', risparmio: '储蓄险',
  },
};

export const typeLabel = (language: Language, type: string) => TYPE_LABELS[language][type] ?? TYPE_LABELS[language].altro ?? type;

export const formatDate = (iso: string | null | undefined, language: Language) => {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return null;
  return language === 'zh' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
};

export interface PracticeInfo {
  id: string;
  number: string;
  type: string;
  client: string;
  /** The person who owns the practice, when it is not the person reading. */
  ownerName: string | null;
}

export interface StatusDetails {
  dueDate?: string | null;
  note?: string | null;
  reason?: string | null;
  info?: string | null;
}

interface Copy {
  greeting: (name: string) => string;
  /** "n. X (Tipo · Cliente)" and, for an agent reading about a collaborator, whose it is. */
  label: (practice: PracticeInfo) => string;
  stageShort: Record<PracticeStage, string>;
  statusSentence: Record<PracticeStage, (label: string, details: StatusDetails) => string>;
  statusAction: Record<PracticeStage, (details: StatusDetails) => string>;
  statusSubject: (number: string, stage: PracticeStage) => string;
  statusManySubject: (count: number) => string;
  statusManyIntro: (count: number) => string;
  statusManyAction: string;
  note: (text: string) => string;
  created: {
    subjectOne: (number: string, actor: string) => string;
    subjectMany: (count: number, actor: string) => string;
    introOne: (actor: string, label: string) => string;
    introMany: (actor: string, count: number) => string;
    action: string;
  };
  documents: {
    subjectOne: (number: string) => string;
    subjectMany: (count: number) => string;
    introOne: (actor: string, label: string, files: string) => string;
    introMany: (actor: string, count: number) => string;
    action: string;
    missingInfo: string;
  };
  notes: {
    subjectOne: (number: string) => string;
    subjectMany: (count: number) => string;
    introOne: (actor: string, label: string) => string;
    introMany: (actor: string, count: number) => string;
    action: string;
  };
  buttonOne: string;
  buttonMany: string;
  system: string;
  more: (count: number) => string;
  footer: string;
}

const COPY: Record<Language, Copy> = {
  it: {
    greeting: (name) => (name ? `Gentile ${name},` : 'Buongiorno,'),
    label: (p) => `n. ${p.number} (${typeLabel('it', p.type)} · ${p.client})${p.ownerName ? ` di ${p.ownerName}` : ''}`,
    stageShort: {
      da_lavorare: 'in lavorazione', in_valutazione: 'in valutazione', integrazioni: 'integrazioni richieste', deliberata: 'deliberata',
      da_emettere: 'pagamento registrato', emessa: 'polizza emessa', non_deliberata: 'non deliberata',
    },
    statusSentence: {
      da_lavorare: (l) => `la pratica ${l} è tornata in lavorazione.`,
      in_valutazione: (l) => `la pratica ${l} è in valutazione.`,
      integrazioni: (l, d) => `per la pratica ${l} servono delle integrazioni${d.info ? `: ${d.info}` : ''}.`,
      deliberata: (l) => `la pratica ${l} è stata deliberata.`,
      da_emettere: (l) => `per la pratica ${l} il pagamento è stato registrato: la polizza è in emissione.`,
      emessa: (l) => `la polizza della pratica ${l} è stata emessa.`,
      non_deliberata: (l, d) => `la pratica ${l} non è stata deliberata${d.reason ? `: ${d.reason}` : ''}.`,
    },
    statusAction: {
      da_lavorare: () => 'Entra nel portale per vedere come procedere.',
      in_valutazione: () => 'Per ora non servono azioni: ti avviseremo appena c\'è una decisione.',
      integrazioni: () => 'Entra nel portale per controllare le azioni da fare: carica i documenti o i chiarimenti richiesti.',
      deliberata: (d) => `Entra nel portale per controllare le azioni da fare: scarica la bozza e procedi al pagamento${d.dueDate ? ` entro il ${d.dueDate}` : ''}.`,
      da_emettere: () => 'Non servono azioni: ti avviseremo quando la polizza sarà emessa.',
      emessa: () => 'Entra nel portale per scaricare la polizza.',
      non_deliberata: () => 'Entra nel portale per vedere il dettaglio.',
    },
    statusSubject: (n, s) => `Pratica n. ${n}: ${COPY.it.stageShort[s]}`,
    statusManySubject: (c) => `${c} pratiche aggiornate`,
    statusManyIntro: (c) => `${c} pratiche hanno cambiato stato:`,
    statusManyAction: 'Entra nel portale per controllare le azioni da fare.',
    note: (t) => `Nota: ${t}`,
    created: {
      subjectOne: (n, a) => `Nuova pratica n. ${n} caricata da ${a}`,
      subjectMany: (c, a) => `${c} nuove pratiche caricate da ${a}`,
      introOne: (a, l) => `${a} ha caricato la pratica ${l}.`,
      introMany: (a, c) => `${a} ha caricato ${c} nuove pratiche:`,
      action: 'Entra nel portale per valutarla.',
    },
    documents: {
      subjectOne: (n) => `Nuovi documenti sulla pratica n. ${n}`,
      subjectMany: (c) => `Nuovi documenti su ${c} pratiche`,
      introOne: (a, l, f) => `${a} ha caricato dei documenti sulla pratica ${l}: ${f}.`,
      introMany: (a, c) => `${a} ha caricato documenti su ${c} pratiche:`,
      action: 'Entra nel portale per controllarli.',
      missingInfo: 'La pratica è in «integrazioni richieste»: verifica i documenti e, se sono completi, segna le integrazioni come fornite.',
    },
    notes: {
      subjectOne: (n) => `Note aggiornate sulla pratica n. ${n}`,
      subjectMany: (c) => `Note aggiornate su ${c} pratiche`,
      introOne: (a, l) => `${a} ha aggiornato le note della pratica ${l}.`,
      introMany: (a, c) => `${a} ha aggiornato le note di ${c} pratiche:`,
      action: 'Entra nel portale per leggerle.',
    },
    buttonOne: 'Apri la pratica',
    buttonMany: 'Apri il portale',
    system: 'il sistema',
    more: (c) => `… e altre ${c}`,
    footer: 'Ricevi questa email perché sei tra i destinatari delle notifiche del portale. Le impostazioni le gestisce l\'amministratore.',
  },
  en: {
    greeting: (name) => (name ? `Dear ${name},` : 'Hello,'),
    label: (p) => `no. ${p.number} (${typeLabel('en', p.type)} · ${p.client})${p.ownerName ? ` of ${p.ownerName}` : ''}`,
    stageShort: {
      da_lavorare: 'in progress', in_valutazione: 'under review', integrazioni: 'information requested', deliberata: 'approved',
      da_emettere: 'payment recorded', emessa: 'policy issued', non_deliberata: 'not approved',
    },
    statusSentence: {
      da_lavorare: (l) => `practice ${l} is back in progress.`,
      in_valutazione: (l) => `practice ${l} is under review.`,
      integrazioni: (l, d) => `practice ${l} needs more information${d.info ? `: ${d.info}` : ''}.`,
      deliberata: (l) => `practice ${l} has been approved.`,
      da_emettere: (l) => `the payment for practice ${l} has been recorded: the policy is being issued.`,
      emessa: (l) => `the policy of practice ${l} has been issued.`,
      non_deliberata: (l, d) => `practice ${l} has not been approved${d.reason ? `: ${d.reason}` : ''}.`,
    },
    statusAction: {
      da_lavorare: () => 'Log in to the portal to see how to proceed.',
      in_valutazione: () => 'No action is needed for now: we will let you know as soon as there is a decision.',
      integrazioni: () => 'Log in to the portal to see what to do: upload the documents or clarifications requested.',
      deliberata: (d) => `Log in to the portal to see what to do: download the draft and proceed with the payment${d.dueDate ? ` by ${d.dueDate}` : ''}.`,
      da_emettere: () => 'No action is needed: we will let you know when the policy is issued.',
      emessa: () => 'Log in to the portal to download the policy.',
      non_deliberata: () => 'Log in to the portal to see the details.',
    },
    statusSubject: (n, s) => `Practice no. ${n}: ${COPY.en.stageShort[s]}`,
    statusManySubject: (c) => `${c} practices updated`,
    statusManyIntro: (c) => `${c} practices changed status:`,
    statusManyAction: 'Log in to the portal to see what to do.',
    note: (t) => `Note: ${t}`,
    created: {
      subjectOne: (n, a) => `New practice no. ${n} uploaded by ${a}`,
      subjectMany: (c, a) => `${c} new practices uploaded by ${a}`,
      introOne: (a, l) => `${a} has uploaded practice ${l}.`,
      introMany: (a, c) => `${a} has uploaded ${c} new practices:`,
      action: 'Log in to the portal to evaluate it.',
    },
    documents: {
      subjectOne: (n) => `New documents on practice no. ${n}`,
      subjectMany: (c) => `New documents on ${c} practices`,
      introOne: (a, l, f) => `${a} has uploaded documents on practice ${l}: ${f}.`,
      introMany: (a, c) => `${a} has uploaded documents on ${c} practices:`,
      action: 'Log in to the portal to check them.',
      missingInfo: 'The practice is in “information requested”: check the documents and, if complete, mark the information as provided.',
    },
    notes: {
      subjectOne: (n) => `Notes updated on practice no. ${n}`,
      subjectMany: (c) => `Notes updated on ${c} practices`,
      introOne: (a, l) => `${a} has updated the notes of practice ${l}.`,
      introMany: (a, c) => `${a} has updated the notes of ${c} practices:`,
      action: 'Log in to the portal to read them.',
    },
    buttonOne: 'Open the practice',
    buttonMany: 'Open the portal',
    system: 'the system',
    more: (c) => `… and ${c} more`,
    footer: 'You receive this email because you are among the recipients of the portal notifications. The settings are managed by the administrator.',
  },
  zh: {
    greeting: (name) => (name ? `${name}，您好：` : '您好：'),
    label: (p) => `${p.number}（${typeLabel('zh', p.type)} · ${p.client}）${p.ownerName ? `，经办人 ${p.ownerName}` : ''}`,
    stageShort: {
      da_lavorare: '办理中', in_valutazione: '审核中', integrazioni: '需补充材料', deliberata: '已核准',
      da_emettere: '已登记付款', emessa: '保单已出具', non_deliberata: '未核准',
    },
    statusSentence: {
      da_lavorare: (l) => `申请 ${l} 已回到办理中。`,
      in_valutazione: (l) => `申请 ${l} 正在审核。`,
      integrazioni: (l, d) => `申请 ${l} 需要补充材料${d.info ? `：${d.info}` : ''}。`,
      deliberata: (l) => `申请 ${l} 已核准。`,
      da_emettere: (l) => `申请 ${l} 的付款已登记：保单正在出具。`,
      emessa: (l) => `申请 ${l} 的保单已出具。`,
      non_deliberata: (l, d) => `申请 ${l} 未获核准${d.reason ? `：${d.reason}` : ''}。`,
    },
    statusAction: {
      da_lavorare: () => '请登录门户查看如何办理。',
      in_valutazione: () => '目前无需操作：一有决定我们会通知您。',
      integrazioni: () => '请登录门户查看待办事项：上传所要求的文件或说明。',
      deliberata: (d) => `请登录门户查看待办事项：下载草稿并${d.dueDate ? `在 ${d.dueDate} 前` : ''}完成付款。`,
      da_emettere: () => '无需操作：保单出具后我们会通知您。',
      emessa: () => '请登录门户下载保单。',
      non_deliberata: () => '请登录门户查看详情。',
    },
    statusSubject: (n, s) => `申请 ${n}：${COPY.zh.stageShort[s]}`,
    statusManySubject: (c) => `${c} 件申请有更新`,
    statusManyIntro: (c) => `${c} 件申请的状态已变更：`,
    statusManyAction: '请登录门户查看待办事项。',
    note: (t) => `备注：${t}`,
    created: {
      subjectOne: (n, a) => `${a} 上传了新申请 ${n}`,
      subjectMany: (c, a) => `${a} 上传了 ${c} 件新申请`,
      introOne: (a, l) => `${a} 上传了申请 ${l}。`,
      introMany: (a, c) => `${a} 上传了 ${c} 件新申请：`,
      action: '请登录门户进行评估。',
    },
    documents: {
      subjectOne: (n) => `申请 ${n} 有新文件`,
      subjectMany: (c) => `${c} 件申请有新文件`,
      introOne: (a, l, f) => `${a} 在申请 ${l} 上传了文件：${f}。`,
      introMany: (a, c) => `${a} 在 ${c} 件申请上传了文件：`,
      action: '请登录门户查看。',
      missingInfo: '该申请处于“需补充材料”：请核对文件，如已齐全，请标记为已提供补充材料。',
    },
    notes: {
      subjectOne: (n) => `申请 ${n} 的备注已更新`,
      subjectMany: (c) => `${c} 件申请的备注已更新`,
      introOne: (a, l) => `${a} 更新了申请 ${l} 的备注。`,
      introMany: (a, c) => `${a} 更新了 ${c} 件申请的备注：`,
      action: '请登录门户阅读。',
    },
    buttonOne: '打开申请',
    buttonMany: '打开门户',
    system: '系统',
    more: (c) => `……另有 ${c} 件`,
    footer: '您收到此邮件，是因为您是门户通知的接收人。设置由管理员管理。',
  },
};

export const copyFor = (language: Language) => COPY[language];

const FONT = "Arial, Helvetica, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";
const MAX_LISTED = 15;

export interface EmailParts {
  language: Language;
  title: string;
  paragraphs: string[];
  /** One line per practice, with a link. */
  listing?: Array<{ text: string; url: string }>;
  listingMore?: number;
  /** Paragraphs after the list (what to do next). */
  closing?: string[];
  button: { label: string; url: string };
  footer: string;
}

export const MAX_LISTED_ITEMS = MAX_LISTED;

/** The brand layout shared by the portal's emails. */
export function renderEmail(parts: EmailParts): string {
  const paragraph = (text: string) => `<p style="margin:0 0 12px 0;line-height:1.55;font-size:15px;color:#1d2433;">${escapeHtml(text)}</p>`;
  const listing = parts.listing?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px 0;border:1px solid #e4e7ec;border-radius:6px;">${parts.listing
        .map(
          (item, index) =>
            `<tr><td style="padding:9px 12px;font-size:14px;line-height:1.45;color:#1d2433;${index % 2 ? 'background:#f7f8fa;' : ''}"><a href="${escapeHtml(item.url)}" style="color:#103657;text-decoration:none;">${escapeHtml(item.text)}</a></td></tr>`,
        )
        .join('')}${parts.listingMore ? `<tr><td style="padding:9px 12px;font-size:13px;color:#667085;">${escapeHtml(COPY[parts.language].more(parts.listingMore))}</td></tr>` : ''}</table>`
    : '';
  return `<!DOCTYPE html>
<html lang="${parts.language === 'zh' ? 'zh-CN' : parts.language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;border:1px solid #e4e7ec;">
<tr><td style="padding:22px 36px 14px 36px;border-bottom:2px solid #ac7e59;"><img src="${portalUrl()}/brand/tecno-mga-logo.png" width="170" alt="Tecno Advance MGA" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:26px 36px 8px 36px;">
<h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.25;color:#103657;font-family:${FONT};">${escapeHtml(parts.title)}</h1>
${parts.paragraphs.map(paragraph).join('')}${listing}${(parts.closing ?? []).map(paragraph).join('')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 16px 0;"><tr><td style="background:#103657;border-radius:6px;"><a href="${escapeHtml(parts.button.url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(parts.button.label)}</a></td></tr></table>
</td></tr>
<tr><td style="padding:0 36px 16px 36px;"><p style="margin:0;font-size:11.5px;line-height:1.5;color:#98a2b3;">${escapeHtml(parts.footer)}</p></td></tr>
<tr><td style="padding:16px 36px 24px 36px;background:#f7f8fa;border-top:1px solid #e4e7ec;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:11px;line-height:1.6;color:#667085;"><strong style="color:#103657;">Tecno Advance MGA Broker Srl</strong> · Iscr. IVASS n. B000746484 · P.IVA 17460381001<br>Viale Parioli, 74 - 00197 Roma · info@tecnomga.com · ${portalUrl()}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
