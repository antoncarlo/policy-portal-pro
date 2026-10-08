import { enGB, it, zhCN } from "date-fns/locale";
import { getLanguage, useLanguage, type Language } from "@/i18n";

const DATE_FNS_LOCALES = { it, en: enGB, zh: zhCN } as const;

/** Lingua del portale per date-fns e per i calendari (react-day-picker). */
export const dateFnsLocale = (language: Language = getLanguage()) => DATE_FNS_LOCALES[language];

export const useDateFnsLocale = () => DATE_FNS_LOCALES[useLanguage()];
