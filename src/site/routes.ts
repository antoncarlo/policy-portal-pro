// Le pagine pubbliche e i loro percorsi per lingua. Ogni percorso finisce con la barra.
import { LANGS, LANG_PREFIX, type Lang } from "./config";

export type PageId = "home" | "privacy" | "cookie";
export const PAGE_IDS: PageId[] = ["home", "privacy", "cookie"];

export interface PageRef {
  id: PageId;
  lang: Lang;
  /** "/", "/en/", "/privacy/", "/zh/cookie/". */
  path: string;
}

/** Il tratto del percorso dopo la lingua: vuoto per la homepage. */
const SLUGS: Record<PageId, Record<Lang, string>> = {
  home: { it: "", en: "", zh: "" },
  privacy: { it: "privacy", en: "privacy", zh: "privacy" },
  cookie: { it: "cookie", en: "cookie", zh: "cookie" },
};

export const pathOf = (id: PageId, lang: Lang): string => {
  const slug = SLUGS[id][lang];
  return `${LANG_PREFIX[lang]}/${slug ? `${slug}/` : ""}`;
};

export const listPages = (): PageRef[] => PAGE_IDS.flatMap((id) => LANGS.map((lang) => ({ id, lang, path: pathOf(id, lang) })));

/** Il percorso come lo scrive `pathOf`: una sola barra iniziale, barra finale, senza query. */
export const normalizePath = (path: string): string => {
  const clean = `/${path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")}`;
  return clean === "/" ? "/" : `${clean}/`;
};

export const findPage = (path: string): PageRef | null => {
  const wanted = normalizePath(path);
  return listPages().find((page) => page.path === wanted) ?? null;
};
