// I testi di Privacy e Cookie del sito aziendale. Sono adattati da quelli del sito del portale (src/site/content),
// gia' verificati: cambiano il sito a cui si riferiscono, il modulo (preventivo invece di contatto) e gli strumenti
// di Google, che qui sono la sola misurazione delle visite e compaiono solo se e' configurata.
import type { CorpLang } from "../../config";
import { legalEn } from "./en";
import { legalIt } from "./it";

/** Una sezione di una pagina di testo. Nei paragrafi «{privacy}», «{cookie}» e «{notice}» diventano link; indirizzi email e indirizzi web si collegano da soli. */
export interface LegalSection {
  title: string;
  paragraphs: string[];
  list: string[];
}

export interface CorpLegal {
  /** Prima della data dell'ultimo aggiornamento. */
  updated: string;
  /** Il testo del link all'informativa generale dell'intermediario (PDF). */
  noticeLabel: string;
  privacy: { sections: LegalSection[] };
  cookie: {
    intro: LegalSection[];
    tableTitle: string;
    columns: { name: string; purpose: string; duration: string; owner: string };
    rows: Array<{ name: string; purpose: string; duration: string; owner: string }>;
    after: LegalSection[];
  };
}

/** `measurement`: lo strumento di misurazione delle visite e' configurato (e quindi esiste il banner dei cookie). */
export const legalFor = (lang: CorpLang, measurement: boolean): CorpLegal => (lang === "en" ? legalEn(measurement) : legalIt(measurement));
