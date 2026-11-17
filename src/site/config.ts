// Sito pubblico VIES (pagine generate come HTML): origine, lingue, dati societari e impostazioni dall'ambiente.
// Nessun import del portale: il modulo serve al plugin di Vite, ai test e al codice del browser.

import { validTagIds } from "./consent-core";

export type Lang = "it" | "en" | "zh";
export const LANGS: Lang[] = ["it", "en", "zh"];
/** Valore di `lang` e di `hreflang`: il cinese e' il semplificato. */
export const HREFLANG: Record<Lang, string> = { it: "it", en: "en", zh: "zh-Hans" };
/** Prefisso dei percorsi: l'italiano sta alla radice. */
export const LANG_PREFIX: Record<Lang, string> = { it: "", en: "/en", zh: "/zh" };
/** La lingua proposta a chi arriva da un paese non coperto. */
export const DEFAULT_LANG: Lang = "en";

export const DEFAULT_ORIGIN = "https://portale.tecnomga.com";

/** Come ogni lingua chiama se stessa: nel selettore della lingua e negli avvisi. */
export const LANG_NAMES: Record<Lang, string> = { it: "Italiano", en: "English", zh: "中文" };
/** La sigla mostrata nella barra. */
export const LANG_SHORT: Record<Lang, string> = { it: "IT", en: "EN", zh: "中文" };

/** Data dell'ultima verifica dei contenuti normativi sulle fonti ufficiali (AAAA-MM-GG). */
export const CONTENT_UPDATED = "2026-11-15";
/** Ultimo aggiornamento delle pagine Privacy e Cookie: è distinto da CONTENT_UPDATED, la data dell'ultima verifica delle norme. */
export const LEGAL_UPDATED = "2026-11-17";
const DATE_LOCALE: Record<Lang, string> = { it: "it-IT", en: "en-GB", zh: "zh-CN" };
/** La data scritta per esteso nella lingua della pagina: «15 novembre 2026». */
export const formatDate = (lang: Lang, iso: string): string =>
  new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Dove chiunque puo' verificare l'iscrizione dell'intermediario al Registro Unico (IVASS). */
export const RUI_CHECK_URL = "https://ruipubblico.ivass.it/rui-pubblica/ng/";
/** Rotte del portale riservato raggiunte dal sito pubblico. */
export const PORTAL_LOGIN_PATH = "/auth";
export const API_DOCS_PATH = "/api-docs";

export interface SiteEnv {
  /** Origine canonica, senza barra finale. */
  origin: string;
  ga4Id?: string;
  adsId?: string;
  adsConversionLabel?: string;
  gscVerification?: string;
  bingVerification?: string;
}

const clean = (value: string | undefined) => {
  const text = value?.trim();
  return text ? text : undefined;
};

/** Le impostazioni del sito dalle variabili d'ambiente (VITE_*): un valore vuoto vale assente. */
export const readSiteEnv = (env: Record<string, string | undefined>): SiteEnv => {
  // Solo identificativi nella forma di Google: finiscono in un attributo della pagina e nell'indirizzo di uno script.
  const tags = validTagIds({ ga4Id: clean(env.VITE_GA4_ID), adsId: clean(env.VITE_GOOGLE_ADS_ID) });
  const label = clean(env.VITE_GOOGLE_ADS_CONVERSION_LABEL);
  return {
    origin: (clean(env.VITE_SITE_ORIGIN) ?? DEFAULT_ORIGIN).replace(/\/+$/, ""),
    ga4Id: tags.ga4Id,
    adsId: tags.adsId,
    adsConversionLabel: label && /^[A-Za-z0-9_-]{4,60}$/.test(label) ? label : undefined,
    gscVerification: clean(env.VITE_GSC_VERIFICATION),
    bingVerification: clean(env.VITE_BING_VERIFICATION),
  };
};

/** Dati dell'intermediario, come nei documenti del portale e nel Registro Unico degli Intermediari. */
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
  email: "vies@tecnomga.com",
  /** Responsabile della protezione dei dati (DPO): lo stesso recapito dei documenti che il portale fa firmare ai clienti (scripts/signing-templates/build.mjs). */
  dpoEmail: "antoncarlo@tecnomga.com",
  /** L'informativa generale (clienti, rapporti contrattuali, area riservata). */
  privacyNoticeUrl: "https://tecnomga.com/wp-content/uploads/2025/12/Informativaprivacytecno-1_1.pdf",
} as const;
