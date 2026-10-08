// Lingue del portale: italiano, inglese e cinese semplificato.
//
// I testi stanno in moduli di messaggi definiti con defineMessages: l'italiano fissa
// la forma, inglese e cinese devono avere esattamente le stesse chiavi (e le stesse
// funzioni con gli stessi parametri), altrimenti la compilazione TypeScript fallisce.
// Così nessun testo può restare senza traduzione.
//
// I documenti legali generati (polizze VIES, estratti conto) restano in italiano.

import { useSyncExternalStore } from "react";

export type Language = "it" | "en" | "zh";

export const LANGUAGES: ReadonlyArray<{ code: Language; label: string; short: string; locale: string }> = [
  { code: "it", label: "Italiano", short: "IT", locale: "it-IT" },
  { code: "en", label: "English", short: "EN", locale: "en-GB" },
  { code: "zh", label: "中文", short: "中文", locale: "zh-CN" },
];

const STORAGE_KEY = "portal-language";
const HTML_LANG: Record<Language, string> = { it: "it", en: "en", zh: "zh-CN" };

const isLanguage = (value: unknown): value is Language => value === "it" || value === "en" || value === "zh";

const readStoredLanguage = (): Language | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
};

// Without a saved choice the browser language decides: Chinese for zh-*, Italian
// for it-*, English for everything else (foreign representatives).
const detectLanguage = (): Language => {
  if (typeof window === "undefined") return "it";
  const stored = readStoredLanguage();
  if (stored) return stored;
  const browser = (window.navigator.languages?.[0] ?? window.navigator.language ?? "it").toLowerCase();
  if (browser.startsWith("zh")) return "zh";
  if (browser.startsWith("it")) return "it";
  return "en";
};

let current: Language = detectLanguage();
const listeners = new Set<() => void>();

const applyDocumentLanguage = (language: Language) => {
  if (typeof document !== "undefined") document.documentElement.lang = HTML_LANG[language];
};
applyDocumentLanguage(current);

export const getLanguage = () => current;

export const getLocale = (language: Language = current) => LANGUAGES.find((entry) => entry.code === language)?.locale ?? "it-IT";

export const setLanguage = (language: Language) => {
  if (!isLanguage(language) || language === current) return;
  current = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Senza storage la scelta vale fino alla chiusura della pagina.
  }
  applyDocumentLanguage(language);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage, getLanguage);

export type Messages<T> = { it: T; en: T; zh: T };

/** Il tipo dei messaggi è quello italiano: inglese e cinese devono combaciare. */
export const defineMessages = <T>(messages: { it: T; en: NoInfer<T>; zh: NoInfer<T> }): Messages<T> => messages;

/** Messaggi nella lingua corrente, aggiornati quando l'utente cambia lingua. */
export const useMessages = <T>(messages: Messages<T>): T => messages[useLanguage()];

/** Messaggi nella lingua corrente fuori dai componenti (toast, funzioni di supporto). */
export const getMessages = <T>(messages: Messages<T>): T => messages[current];

export const useLocale = () => getLocale(useLanguage());

/** Data breve (gg/mm/aaaa in italiano) nella lingua corrente. */
export const formatDate = (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(getLocale(), options ?? { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatDateTime = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const formatCurrency = (value: number | null | undefined, currency = "EUR") =>
  new Intl.NumberFormat(getLocale(), { style: "currency", currency }).format(value ?? 0);

export const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLocale(), options).format(value ?? 0);
