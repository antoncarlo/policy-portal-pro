import type { AlertContent } from './admin-alerts.js';
import type { Language } from './notification-copy.js';

/** The emails of the lot cycle: who is told what when a step is done (see src/lib/lotCycle.ts). */
export type LotAlertKind =
  | 'drafts_uploaded'
  | 'payment_confirmed'
  | 'copies_uploaded'
  | 'issued_uploaded';

export interface LotAlertParams {
  /** "Lotto 3" (in the language of the email). */
  lot: string;
  representative?: string | null;
  count?: number;
  actor?: string | null;
  url: string;
}

type Builder = (p: LotAlertParams) => Omit<AlertContent, 'buttonUrl'>;

const withWho = (p: LotAlertParams) => (p.representative ? ` (${p.representative})` : '');

const COPY: Record<Language, Record<LotAlertKind, Builder>> = {
  it: {
    drafts_uploaded: (p) => ({
      subject: `${p.lot}: bozze da verificare`,
      title: 'Bozze da verificare',
      paragraphs: [
        `Le pratiche del ${p.lot}${withWho(p)} sono state deliberate e le bozze della compagnia sono caricate${p.count ? ` (${p.count} pratiche)` : ''}.`,
        'Scarica le bozze e i MUP, controllali e conferma di averli verificati: poi potrai pagare l\'estratto conto.',
      ],
    }),
    payment_confirmed: (p) => ({
      subject: `${p.lot}: pagamento confermato`,
      title: 'Pagamento confermato',
      paragraphs: [`Il pagamento del ${p.lot}${withWho(p)} è stato confermato${p.count ? ` per ${p.count} pratiche` : ''}.`, 'A breve ti arriveranno i documenti da firmare: la polizza copia Compagnia e il MUP di ogni cliente.'],
    }),
    copies_uploaded: (p) => ({
      subject: `${p.lot}: documenti da firmare disponibili`,
      title: 'Documenti da firmare',
      paragraphs: [`Per il ${p.lot}${withWho(p)} sono pronti la polizza copia Compagnia e il MUP di ogni cliente${p.count ? ` (${p.count} pratiche)` : ''}.`, 'Scarica lo ZIP, firma in blocco e ricarica i file firmati nel lotto.'],
    }),
    issued_uploaded: (p) => ({
      subject: `${p.lot}: polizze emesse disponibili`,
      title: 'Polizze emesse',
      paragraphs: [`Le polizze emesse del ${p.lot}${withWho(p)} sono caricate${p.count ? ` (${p.count} pratiche)` : ''}.`, 'Puoi scaricare tutto dal lotto: il ciclo è chiuso.'],
    }),
  },
  en: {
    drafts_uploaded: (p) => ({
      subject: `${p.lot}: drafts to verify`,
      title: 'Drafts to verify',
      paragraphs: [`The practices of ${p.lot}${withWho(p)} are approved and the insurer's drafts are uploaded${p.count ? ` (${p.count} practices)` : ''}.`, 'Download the drafts and the MUPs, check them and confirm you have verified them: then you can pay the statement.'],
    }),
    payment_confirmed: (p) => ({
      subject: `${p.lot}: payment confirmed`,
      title: 'Payment confirmed',
      paragraphs: [`The payment of ${p.lot}${withWho(p)} is confirmed${p.count ? ` for ${p.count} practices` : ''}.`, 'The documents to sign will reach you shortly: the insurer\'s policy copy and the MUP of each client.'],
    }),
    copies_uploaded: (p) => ({
      subject: `${p.lot}: documents to sign are ready`,
      title: 'Documents to sign',
      paragraphs: [`The insurer's policy copy and the MUP of each client are ready for ${p.lot}${withWho(p)}${p.count ? ` (${p.count} practices)` : ''}.`, 'Download the ZIP, sign in bulk and upload the signed files to the lot.'],
    }),
    issued_uploaded: (p) => ({
      subject: `${p.lot}: issued policies available`,
      title: 'Issued policies',
      paragraphs: [`The issued policies of ${p.lot}${withWho(p)} are uploaded${p.count ? ` (${p.count} practices)` : ''}.`, 'You can download everything from the lot: the cycle is closed.'],
    }),
  },
  zh: {
    drafts_uploaded: (p) => ({
      subject: `${p.lot}：待核对草稿`,
      title: '待核对草稿',
      paragraphs: [`${p.lot}${withWho(p)} 的申请已核准，保险公司草稿已上传${p.count ? `（${p.count} 笔申请）` : ''}。`, '请下载草稿和 MUP 并核对，确认已核对后即可支付对账单。'],
    }),
    payment_confirmed: (p) => ({
      subject: `${p.lot}：付款已确认`,
      title: '付款已确认',
      paragraphs: [`${p.lot}${withWho(p)} 的付款已确认${p.count ? `，共 ${p.count} 笔申请` : ''}。`, '待签署文件将很快发送给您：每位客户的保险公司留存联保单和 MUP。'],
    }),
    copies_uploaded: (p) => ({
      subject: `${p.lot}：待签署文件已就绪`,
      title: '待签署文件',
      paragraphs: [`${p.lot}${withWho(p)} 每位客户的保险公司留存联保单和 MUP 已就绪${p.count ? `（${p.count} 笔申请）` : ''}。`, '请下载 ZIP，批量签署后将已签署文件上传到批次。'],
    }),
    issued_uploaded: (p) => ({
      subject: `${p.lot}：已出具保单可下载`,
      title: '已出具保单',
      paragraphs: [`${p.lot}${withWho(p)} 的已出具保单已上传${p.count ? `（${p.count} 笔申请）` : ''}。`, '您可以从批次下载全部文件：流程已结束。'],
    }),
  },
};

export const lotAlertContent = (kind: LotAlertKind, language: Language, params: LotAlertParams): AlertContent => ({
  ...COPY[language][kind](params),
  buttonUrl: params.url,
});

export const lotLabel = (language: Language, number: number | null, name: string) =>
  number ? (language === 'en' ? `Lot ${number}` : language === 'zh' ? `批次 ${number}` : `Lotto ${number}`) : name;
