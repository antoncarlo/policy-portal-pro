import type { Language } from './notification-copy.js';

/** The words of the emails the portal sends to its administrators about what needs a human, in it / en / zh. */

export interface AlertDelivery {
  target: string;
  event: string;
  practice: string | null;
  error: string | null;
  attempts: number;
}

export interface AlertBounce {
  address: string;
  reason: 'bounced' | 'complained';
  practices: string[];
}

export interface AlertDigestInput {
  failedDeliveries: AlertDelivery[];
  failedDeliveriesTotal: number;
  unreachable: Array<{ address: string; practices: string[] }>;
  emailFailures: { total: number; sample: string[] };
}

interface AlertCopy {
  greeting: string;
  deliveryFailed: {
    subject: (count: number) => string;
    intro: (count: number) => string;
    line: (item: AlertDelivery) => string;
    action: string;
  };
  bounce: {
    subject: (address: string) => string;
    intro: (item: AlertBounce) => string;
    practices: (list: string) => string;
    action: string;
  };
  digest: {
    subject: string;
    intro: string;
    deliveries: (shown: number, total: number) => string;
    unreachable: string;
    emailFailures: (total: number) => string;
    action: string;
  };
  cronFailed: {
    subject: (job: string) => string;
    intro: (job: string, error: string) => string;
    action: string;
  };
  button: string;
}

const COPY: Record<Language, AlertCopy> = {
  it: {
    greeting: 'Gentile amministratore,',
    deliveryFailed: {
      subject: (count) => (count === 1 ? 'Una consegna verso un portale esterno non è riuscita' : `${count} consegne verso portali esterni non sono riuscite`),
      intro: (count) =>
        count === 1
          ? 'Una notifica verso un portale esterno ha esaurito i tentativi automatici e non è stata consegnata:'
          : `${count} notifiche verso portali esterni hanno esaurito i tentativi automatici e non sono state consegnate:`,
      line: (item) => `${item.target} · ${item.event}${item.practice ? ` · pratica ${item.practice}` : ''} · ${item.attempts} tentativi${item.error ? ` · ${item.error}` : ''}`,
      action: 'Controlla l\'indirizzo del portale in Impostazioni › Connessioni e, risolto il problema, usa «Riprova» sulle consegne fallite.',
    },
    bounce: {
      subject: (address) => `Email non recapitabile: ${address}`,
      intro: (item) =>
        item.reason === 'complained'
          ? `${item.address} ha segnalato come indesiderata una nostra email: non gli scriveremo più.`
          : `L'indirizzo ${item.address} non esiste o non accetta posta (rimbalzo definitivo): non gli scriveremo più.`,
      practices: (list) => `Pratiche con questo indirizzo: ${list}.`,
      action: 'Verifica l\'indirizzo con il cliente e correggilo nella pratica: i promemoria di scadenza non possono raggiungerlo finché resta questo.',
    },
    digest: {
      subject: 'Riepilogo giornaliero: da controllare',
      intro: 'Dall\'ultimo controllo ci sono elementi che richiedono attenzione:',
      deliveries: (shown, total) => `Consegne verso portali esterni non riuscite (${total}${total > shown ? `, prime ${shown}` : ''})`,
      unreachable: 'Clienti con indirizzo non raggiungibile e scadenza entro 90 giorni',
      emailFailures: (total) => `Email non inviate nelle ultime 24 ore: ${total}`,
      action: 'Apri il portale per i dettagli.',
    },
    cronFailed: {
      subject: (job) => `Attività automatica non riuscita: ${job}`,
      intro: (job, error) => `L'attività automatica «${job}» si è interrotta con un errore: ${error}`,
      action: 'Se l\'errore si ripete, controlla i log su Vercel.',
    },
    button: 'Apri il portale',
  },
  en: {
    greeting: 'Dear administrator,',
    deliveryFailed: {
      subject: (count) => (count === 1 ? 'A delivery to an external portal failed' : `${count} deliveries to external portals failed`),
      intro: (count) =>
        count === 1
          ? 'A notification to an external portal used up its automatic retries and was not delivered:'
          : `${count} notifications to external portals used up their automatic retries and were not delivered:`,
      line: (item) => `${item.target} · ${item.event}${item.practice ? ` · practice ${item.practice}` : ''} · ${item.attempts} attempts${item.error ? ` · ${item.error}` : ''}`,
      action: 'Check the portal address under Settings › Connections and, once fixed, use “Retry” on the failed deliveries.',
    },
    bounce: {
      subject: (address) => `Email could not be delivered: ${address}`,
      intro: (item) =>
        item.reason === 'complained'
          ? `${item.address} marked one of our emails as unwanted: we will not write to this address again.`
          : `The address ${item.address} does not exist or does not accept mail (permanent bounce): we will not write to it again.`,
      practices: (list) => `Practices with this address: ${list}.`,
      action: 'Check the address with the client and correct it on the practice: expiry reminders cannot reach them while it stays as it is.',
    },
    digest: {
      subject: 'Daily summary: needs attention',
      intro: 'Since the last check, these items need attention:',
      deliveries: (shown, total) => `Failed deliveries to external portals (${total}${total > shown ? `, first ${shown}` : ''})`,
      unreachable: 'Clients with an unreachable address and a policy expiring within 90 days',
      emailFailures: (total) => `Emails not sent in the last 24 hours: ${total}`,
      action: 'Open the portal for the details.',
    },
    cronFailed: {
      subject: (job) => `Automatic task failed: ${job}`,
      intro: (job, error) => `The automatic task “${job}” stopped with an error: ${error}`,
      action: 'If the error repeats, check the logs on Vercel.',
    },
    button: 'Open the portal',
  },
  zh: {
    greeting: '尊敬的管理员，',
    deliveryFailed: {
      subject: (count) => (count === 1 ? '发送至外部门户的一条通知失败' : `发送至外部门户的 ${count} 条通知失败`),
      intro: (count) => (count === 1 ? '一条发往外部门户的通知已用完自动重试次数，仍未送达：' : `${count} 条发往外部门户的通知已用完自动重试次数，仍未送达：`),
      line: (item) => `${item.target} · ${item.event}${item.practice ? ` · 保单 ${item.practice}` : ''} · 已尝试 ${item.attempts} 次${item.error ? ` · ${item.error}` : ''}`,
      action: '请在“设置 › 连接”中检查门户地址，问题解决后对失败的通知点击“重试”。',
    },
    bounce: {
      subject: (address) => `邮件无法送达：${address}`,
      intro: (item) =>
        item.reason === 'complained'
          ? `${item.address} 将我们的一封邮件标记为垃圾邮件：我们不会再向该地址发送邮件。`
          : `地址 ${item.address} 不存在或不接收邮件（永久退信）：我们不会再向该地址发送邮件。`,
      practices: (list) => `使用该地址的保单：${list}。`,
      action: '请向客户核实地址并在保单中更正：在更正之前，到期提醒无法送达该客户。',
    },
    digest: {
      subject: '每日汇总：需要关注',
      intro: '自上次检查以来，以下事项需要关注：',
      deliveries: (shown, total) => `发送至外部门户失败的通知（${total}${total > shown ? `，前 ${shown} 条` : ''}）`,
      unreachable: '邮箱不可达且保单 90 天内到期的客户',
      emailFailures: (total) => `过去 24 小时内未发出的邮件：${total}`,
      action: '请打开门户查看详情。',
    },
    cronFailed: {
      subject: (job) => `自动任务失败：${job}`,
      intro: (job, error) => `自动任务“${job}”因错误而中断：${error}`,
      action: '如果错误反复出现，请查看 Vercel 日志。',
    },
    button: '打开门户',
  },
};

export const alertCopy = (language: Language) => COPY[language];
