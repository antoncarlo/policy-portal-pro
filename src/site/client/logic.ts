// Le decisioni che il sito pubblico prende nel browser, come funzioni pure (provate in tests/site/client-logic.test.ts).

export type SiteLang = "it" | "en" | "zh";
const SITE_LANGS: SiteLang[] = ["it", "en", "zh"];

/** La lingua della pagina dal suo attributo lang («zh-Hans» → «zh»); l'italiano se manca. */
export const pageLanguage = (htmlLang: string): SiteLang => {
  const code = htmlLang.toLowerCase().slice(0, 2);
  return SITE_LANGS.includes(code as SiteLang) ? (code as SiteLang) : "it";
};

/**
 * La lingua da proporre a chi legge: la prima lingua del browser, se il sito ce l'ha ed e' diversa da quella della
 * pagina. Chi ha il browser in una lingua che il sito non parla non riceve nessuna proposta. Il cinese tradizionale
 * («zh-TW», «zh-HK») non e' il cinese semplificato del sito.
 */
export const noticeLanguage = (current: SiteLang, browserLanguages: readonly string[]): SiteLang | null => {
  const first = browserLanguages[0]?.toLowerCase();
  if (!first) return null;
  if (/^zh-(tw|hk|mo|hant)/.test(first)) return null;
  const code = first.slice(0, 2) as SiteLang;
  return SITE_LANGS.includes(code) && code !== current ? code : null;
};

/** Il video dell'apertura parte solo se chi legge non ha chiesto meno movimento o meno dati. */
export const shouldPlayVideo = (state: { reducedMotion: boolean; saveData?: boolean; effectiveType?: string }): boolean =>
  !state.reducedMotion && state.saveData !== true && !/(^|-)2g$/.test(state.effectiveType ?? "");

/**
 * Quanta parte della linea dei passi e' disegnata (0-1): comincia quando l'elenco entra nell'ultimo quinto dello
 * schermo e finisce quando la sua fine arriva a meta' schermo.
 */
export const lineProgress = (rect: { top: number; height: number }, viewport: number): number => {
  const start = viewport * 0.8;
  const distance = rect.height + viewport * 0.3;
  const value = (start - rect.top) / distance;
  return Math.min(1, Math.max(0, Number(value.toFixed(3))));
};

// ---------- Modulo contatti ----------
// Le stesse regole del server (api/_lib/contact-requests.ts): qui servono a dire subito cosa manca, il controllo
// vero resta quello del server. tests/site/contact-form.test.ts verifica che le due parti rifiutino gli stessi campi.

const ROLES = ["fiscal_representative", "professional_firm", "broker", "foreign_company", "other"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MIN = 10;

export interface ContactValues {
  name: string;
  company: string;
  role: string;
  country: string;
  email: string;
  phone: string;
  volume: string;
  message: string;
  consent: boolean;
}
export type ContactField = keyof ContactValues;
/** Il tipo di problema decide il messaggio mostrato sotto il campo. */
export type ContactProblem = "required" | "email" | "message" | "consent";

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export const contactProblems = (values: ContactValues): Partial<Record<ContactField, ContactProblem>> => {
  const problems: Partial<Record<ContactField, ContactProblem>> = {};
  for (const field of ["name", "company", "country"] as const) if (!oneLine(values[field])) problems[field] = "required";
  if (!ROLES.includes(values.role)) problems.role = "required";
  const email = oneLine(values.email);
  if (!email) problems.email = "required";
  else if (!EMAIL_PATTERN.test(email)) problems.email = "email";
  const message = values.message.trim();
  if (!message) problems.message = "required";
  else if (message.length < MESSAGE_MIN) problems.message = "message";
  if (!values.consent) problems.consent = "consent";
  return problems;
};

/** Cio' che parte verso il server: i valori ripuliti, la lingua e la pagina, il campo trappola e il tempo impiegato. */
export const contactPayload = (values: ContactValues, extra: { lang: SiteLang; page: string; website: string; elapsedMs: number }) => ({
  name: oneLine(values.name),
  company: oneLine(values.company),
  role: values.role,
  country: oneLine(values.country),
  email: oneLine(values.email),
  phone: oneLine(values.phone),
  volume: oneLine(values.volume),
  message: values.message.trim(),
  consent: values.consent,
  lang: extra.lang,
  page: extra.page,
  website: extra.website,
  elapsedMs: Math.round(extra.elapsedMs),
});
