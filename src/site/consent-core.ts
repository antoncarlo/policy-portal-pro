// Il consenso ai cookie, come logica pura (provata in tests/site/consent.test.ts): la scelta ricordata nel browser,
// cosa si dice a Google (modalita' di consenso versione 2) e quali script si caricano. Senza scelta, o dopo un
// rifiuto, non si carica nulla.

/** La chiave nell'archivio locale del browser: cambia il numero se cambiano le categorie. */
export const CONSENT_KEY = "tecno-consent-v1";
/** Dopo sei mesi la scelta si chiede di nuovo. */
export const CONSENT_MAX_AGE_DAYS = 180;
const DAY_MS = 86_400_000;

export interface ConsentChoice {
  statistics: boolean;
  marketing: boolean;
  /** Quando e' stata fatta la scelta (ISO 8601). */
  decidedAt: string;
}

export const serializeConsent = (choice: Omit<ConsentChoice, "decidedAt">, now: Date): string =>
  JSON.stringify({ statistics: choice.statistics, marketing: choice.marketing, decidedAt: now.toISOString() });

/** La scelta salvata, oppure null se manca, non si legge, e' scaduta o porta una data nel futuro. */
export const parseConsent = (raw: string | null, now: Date): ConsentChoice | null => {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { statistics, marketing, decidedAt } = value as Record<string, unknown>;
  if (typeof statistics !== "boolean" || typeof marketing !== "boolean" || typeof decidedAt !== "string") return null;
  const decided = Date.parse(decidedAt);
  if (Number.isNaN(decided)) return null;
  const age = now.getTime() - decided;
  // Un'ora di tolleranza per gli orologi non allineati; oltre, la data non e' credibile.
  if (age < -3_600_000 || age > CONSENT_MAX_AGE_DAYS * DAY_MS) return null;
  return { statistics, marketing, decidedAt };
};

export type GoogleConsentKey = "ad_storage" | "ad_user_data" | "ad_personalization" | "analytics_storage";
export type GoogleConsent = Record<GoogleConsentKey, "granted" | "denied">;

export const DENIED: GoogleConsent = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };

/** Le quattro voci della modalita' di consenso di Google: statistiche → analytics, marketing → le tre voci pubblicitarie. */
export const gtagConsent = (choice: ConsentChoice): GoogleConsent => {
  const ads = choice.marketing ? "granted" : "denied";
  return { ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: choice.statistics ? "granted" : "denied" };
};

export interface TagIds {
  ga4Id?: string;
  adsId?: string;
}

const GA4_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const ADS_PATTERN = /^AW-[0-9]{6,20}$/;

/** Solo identificativi nella forma di Google («G-…», «AW-…»): finiscono nell'indirizzo di uno script. */
export const validTagIds = (ids: TagIds): TagIds => {
  const ga4Id = ids.ga4Id?.trim();
  const adsId = ids.adsId?.trim();
  return { ...(ga4Id && GA4_PATTERN.test(ga4Id) ? { ga4Id } : {}), ...(adsId && ADS_PATTERN.test(adsId) ? { adsId } : {}) };
};

/** Gli identificativi da caricare con la scelta fatta: Analytics con le statistiche, Ads con il marketing. */
export const googleTagsToLoad = (choice: ConsentChoice | null, ids: TagIds): string[] => {
  if (!choice) return [];
  const valid = validTagIds(ids);
  const tags: string[] = [];
  if (choice.statistics && valid.ga4Id) tags.push(valid.ga4Id);
  if (choice.marketing && valid.adsId) tags.push(valid.adsId);
  return tags;
};
