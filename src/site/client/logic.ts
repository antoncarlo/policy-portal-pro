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
