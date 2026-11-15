// I testi del sito pubblico, uguali per struttura nelle tre lingue (lo verifica tests/site/content.test.ts).
import type { StaticPageId } from "../routes";

/** Le ancore delle sezioni della homepage, uguali in tutte le lingue: un link condiviso funziona in ogni versione. */
export const ANCHORS = ["cos-e", "per-chi", "come-funziona", "portale", "documenti", "costo", "domande", "contatti"] as const;
export type Anchor = (typeof ANCHORS)[number];

/** I ruoli di chi scrive dal modulo contatti: gli stessi valori che il server accetta. */
export const CONTACT_ROLES = ["fiscal_representative", "professional_firm", "broker", "foreign_company", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface PageMeta {
  /** 50-60 caratteri in italiano e inglese, con la parola chiave all'inizio. */
  title: string;
  /** 150-160 caratteri in italiano e inglese, con un invito. */
  description: string;
  h1: string;
  /** Nome breve della pagina, per le briciole di pane. */
  label: string;
}

export interface TitledText {
  title: string;
  text: string;
}

/** Una sezione di una pagina di testo. Nei paragrafi «{privacy}», «{cookie}» e «{notice}» diventano link; indirizzi email e indirizzi web si collegano da soli. */
export interface LegalSection {
  title: string;
  paragraphs: string[];
  list: string[];
}

/** Lo stato di una riga nell'interfaccia di esempio: decide il colore, non il testo. */
export type MockTone = "done" | "progress" | "waiting" | "missing";

export interface SiteContent {
  /** Le pagine fisse; titolo e descrizione di un articolo stanno nell'articolo (src/site/meta.ts). */
  meta: Record<StaticPageId, PageMeta>;
  nav: {
    /** Una voce per sezione, nell'ordine della pagina. */
    items: Array<{ anchor: Anchor; label: string }>;
    portal: string;
    contact: string;
    menu: string;
    languages: string;
    skip: string;
    home: string;
  };
  hero: {
    lead: string;
    /** I tre dati chiave della garanzia. */
    facts: Array<{ value: string; label: string }>;
    primary: string;
    secondary: string;
    note: string;
    /** La scheda di vetro accanto al titolo: una polizza stilizzata, decorativa. */
    card: { title: string; beneficiaryLabel: string; beneficiary: string; signed: string; status: string };
  };
  trust: {
    label: string;
    items: TitledText[];
    ruiCheck: string;
  };
  whatIs: {
    title: string;
    /** La risposta diretta, 40-60 parole. */
    answer: string;
    facts: Array<{ term: string; text: string }>;
    formsTitle: string;
    formsColumns: { form: string; issuer: string; commitment: string };
    forms: Array<{ form: string; issuer: string; commitment: string }>;
    lawTitle: string;
    law: string;
    sourcesTitle: string;
    sources: Array<{ label: string; href: string }>;
    disclaimer: string;
    updated: string;
  };
  audiences: {
    title: string;
    items: Array<{ title: string; text: string; points: string[]; cta: string }>;
  };
  steps: {
    title: string;
    items: TitledText[];
    outcome: string;
  };
  portal: {
    title: string;
    features: TitledText[];
    api: { text: string; cta: string };
    /** Interfaccia ridisegnata con dati inventati: mai schermate o nomi reali. */
    mock: {
      title: string;
      lot: string;
      columns: { company: string; documents: string; status: string };
      rows: Array<{ company: string; documents: string; status: string; tone: MockTone }>;
      note: string;
    };
  };
  documents: {
    title: string;
    items: TitledText[];
    note: string;
  };
  cost: {
    title: string;
    answer: string;
    factors: TitledText[];
    cta: string;
    note: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  contact: {
    title: string;
    form: {
      name: string;
      company: string;
      role: string;
      rolePlaceholder: string;
      roles: Record<ContactRole, string>;
      country: string;
      email: string;
      phone: string;
      volume: string;
      volumeHint: string;
      message: string;
      optional: string;
      /** Il testo del consenso: «{privacy}» diventa il link all'informativa. */
      consent: string;
      privacyLink: string;
      submit: string;
      sending: string;
      success: string;
      error: string;
      invalid: string;
      /** Messaggi per campo, mostrati sotto il campo che non va. */
      fieldErrors: { required: string; email: string; message: string; consent: string };
      noscript: string;
    };
    details: {
      title: string;
      email: string;
      phone: string;
      pec: string;
      legalSeat: string;
      office: string;
    };
  };
  footer: {
    about: string;
    rui: string;
    vat: string;
    site: string;
    legal: string;
    contacts: string;
    privacy: string;
    cookie: string;
    cookiePreferences: string;
    apiDocs: string;
    complaintsTitle: string;
    complaints: string;
    rights: string;
  };
  legal: {
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
  };
  /** Avvertenza sulla pubblicità dei prodotti assicurativi. */
  legalNotice: string;
  /** Un solo consenso per tutti i cookie non tecnici: «Accetta» o «Rifiuta»; la chiusura vale rifiuto. */
  cookieBanner: {
    title: string;
    text: string;
    accept: string;
    reject: string;
    close: string;
    policyLink: string;
  };
  /** L'avviso mostrato a chi ha il browser in questa lingua e sta leggendo la pagina in un'altra. */
  langNotice: {
    text: string;
    action: string;
    dismiss: string;
  };
}
