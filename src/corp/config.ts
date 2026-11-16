// Sito aziendale tecnomga.com (pagine generate come HTML): definizione del sito, dati dell'intermediario e
// impostazioni dall'ambiente. Nessun import del portale riservato: il modulo serve alla build, ai test e al browser.
import { validTagIds } from "../site/consent-core";
import type { SiteDefinition } from "../site-kit/types";

export type CorpLang = "it" | "en";

export const CORP: SiteDefinition<CorpLang> = {
  id: "tecnomga",
  defaultOrigin: "https://tecnomga.com",
  langs: ["it", "en"],
  hreflang: { it: "it", en: "en" },
  langPrefix: { it: "", en: "/en" },
  // Il sito parla anzitutto a clienti italiani: e' l'italiano la versione proposta dove non c'e' una lingua dedicata.
  xDefault: "it",
  langNames: { it: "Italiano", en: "English" },
  langShort: { it: "IT", en: "EN" },
};

/** Data dell'ultima verifica dei contenuti sulle fonti (AAAA-MM-GG): e' la data mostrata e quella della sitemap. */
export const CORP_CONTENT_UPDATED = "2026-11-16";
const DATE_LOCALE: Record<CorpLang, string> = { it: "it-IT", en: "en-GB" };
export const formatDate = (lang: CorpLang, iso: string): string =>
  new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Dove chiunque puo' verificare l'iscrizione dell'intermediario al Registro Unico (IVASS). */
export const RUI_CHECK_URL = "https://ruipubblico.ivass.it/rui-pubblica/ng/";
/** Il portale delle fideiussioni VIES e l'area riservata ai clienti. */
export const PORTAL_URL = "https://portale.tecnomga.com/";
export const PORTAL_LOGIN_URL = "https://portale.tecnomga.com/auth";
/** Il servizio che riceve le richieste di preventivo: e' quello del portale. */
export const DEFAULT_CONTACT_ENDPOINT = "https://portale.tecnomga.com/api/contact";

export interface CorpEnv {
  /** Origine canonica, senza barra finale. */
  origin: string;
  /** Falso sull'indirizzo di prova: le pagine chiedono ai motori di non indicizzarle. */
  indexable: boolean;
  contactEndpoint: string;
  ga4Id?: string;
  gscVerification?: string;
  bingVerification?: string;
}

const clean = (value: string | undefined) => {
  const text = value?.trim();
  return text ? text : undefined;
};

/** Le impostazioni dalle variabili d'ambiente (VITE_CORP_*): un valore vuoto vale assente. */
export const readCorpEnv = (env: Record<string, string | undefined>): CorpEnv => {
  const endpoint = clean(env.VITE_CORP_CONTACT_ENDPOINT);
  return {
    origin: (clean(env.VITE_CORP_ORIGIN) ?? CORP.defaultOrigin).replace(/\/+$/, ""),
    // Si indicizza solo quando lo si chiede in modo esplicito: un indirizzo di prova dimenticato non finisce su Google.
    indexable: clean(env.VITE_CORP_INDEXABLE) === "true",
    contactEndpoint: endpoint && /^https:\/\/[a-z0-9.-]+\/[\w\-./]*$/i.test(endpoint) ? endpoint : DEFAULT_CONTACT_ENDPOINT,
    ga4Id: validTagIds({ ga4Id: clean(env.VITE_CORP_GA4_ID) }).ga4Id,
    gscVerification: clean(env.VITE_CORP_GSC_VERIFICATION),
    bingVerification: clean(env.VITE_CORP_BING_VERIFICATION),
  };
};

/** Dati dell'intermediario, come nel MUP e nell'informativa privacy della societa' e nel Registro Unico degli Intermediari. */
export const COMPANY = {
  name: "Tecno Advance MGA Broker Srl",
  shortName: "Tecno MGA",
  rui: "B000746484",
  vat: "17460381001",
  legalSeat: { street: "Via Po, 102", postalCode: "00198", city: "Roma", region: "RM", country: "IT" },
  office: { street: "Via Michele Mercati, 18", postalCode: "00197", city: "Roma", region: "RM", country: "IT" },
  phone: "06.97638088",
  phoneE164: "+390697638088",
  pec: "tecnoadvancemgabroker@legalmail.it",
  /** Casella generale: riceve anche le richieste di preventivo e i reclami. */
  email: "info@tecnomga.com",
  /** Responsabile della protezione dei dati (DPO): lo stesso recapito del portale. */
  dpoEmail: "antoncarlo@tecnomga.com",
} as const;
