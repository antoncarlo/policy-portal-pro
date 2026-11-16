// La forma dei testi del sito aziendale: la stessa in ogni lingua.
import type { CorpPageId } from "../routes";

/** Le sezioni della homepage: i loro identificativi sono gli stessi in ogni lingua. */
export const HOME_ANCHORS = ["prodotti", "broker", "come-funziona", "preventivo"] as const;
export type HomeAnchor = (typeof HOME_ANCHORS)[number];

export interface PageMeta {
  /** Titolo della scheda del browser e dei risultati di ricerca: 50-60 caratteri. */
  title: string;
  /** Descrizione nei risultati di ricerca: 150-160 caratteri. */
  description: string;
  /** Titolo principale della pagina. */
  h1: string;
  /** Nome breve: menu, briciole di pane, llms.txt. */
  label: string;
}

export interface CorpContent {
  meta: Record<CorpPageId, PageMeta>;
  nav: {
    /** Link per saltare al contenuto, per chi naviga da tastiera. */
    skip: string;
    /** Etichetta del logo che riporta alla homepage. */
    home: string;
    /** Nome del menu per chi usa un lettore di schermo. */
    site: string;
    /** Le sezioni della homepage raggiungibili dal menu, nell'ordine in cui compaiono. */
    items: Array<{ anchor: HomeAnchor; label: string }>;
    /** Link al portale delle fideiussioni VIES. */
    portal: string;
    /** Link all'area riservata ai clienti. */
    clientArea: string;
    /** Invito principale: la richiesta di preventivo. */
    cta: string;
    menuToggle: string;
    language: string;
  };
  footer: {
    about: string;
    site: string;
    legal: string;
    privacy: string;
    cookie: string;
    cookiePreferences: string;
    ruiCheck: string;
    contacts: string;
    pec: string;
    legalSeat: string;
    office: string;
    /** «Iscritta alla sezione B del RUI con il numero». */
    rui: string;
    vat: string;
    supervision: string;
    complaintsTitle: string;
    complaints: string;
    rights: string;
  };
  /** Avvertenza sulla pubblicita' dei prodotti assicurativi. */
  legalNotice: string;
  cookieBanner: { title: string; text: string; policyLink: string; accept: string; reject: string; close: string };
  /** L'avviso mostrato, in questa lingua, a chi legge il sito in un'altra. */
  langNotice: { text: string; action: string; dismiss: string };
  /** Come il sito si presenta alle IA (llms.txt) e nei dati strutturati. */
  about: {
    /** Una o due frasi su chi e' e cosa fa l'intermediario. */
    summary: string;
    /** Il tipo di servizio, per i dati strutturati. */
    serviceType: string;
  };
}
