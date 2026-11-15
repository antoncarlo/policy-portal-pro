// Le pagine pubbliche e i loro percorsi per lingua. Ogni percorso finisce con la barra.
import { ARTICLES, findArticle, type ArticleId } from "./blog";
import { LANGS, LANG_PREFIX, type Lang } from "./config";

/** Le pagine fisse. Le altre pagine sono gli articoli del blog, una per articolo. */
export type StaticPageId = "home" | "representatives" | "sellers" | "blog" | "privacy" | "cookie";
export const STATIC_PAGE_IDS: StaticPageId[] = ["home", "representatives", "sellers", "blog", "privacy", "cookie"];
export type PageId = StaticPageId | ArticleId;
export type PageKind = "home" | "audience" | "blog" | "article" | "legal";

export interface PageRef {
  id: PageId;
  lang: Lang;
  /** "/", "/en/", "/privacy/", "/zh/cookie/", "/en/blog/vies-guarantee-italy-explained/". */
  path: string;
}

/** Il tratto del percorso dopo la lingua: vuoto per la homepage. Inglese e cinese usano lo stesso tratto. */
const SLUGS: Record<StaticPageId, Record<Lang, string>> = {
  home: { it: "", en: "", zh: "" },
  representatives: { it: "rappresentanti-fiscali", en: "fiscal-representatives", zh: "fiscal-representatives" },
  sellers: { it: "venditori-esteri", en: "non-eu-sellers", zh: "non-eu-sellers" },
  blog: { it: "blog", en: "blog", zh: "blog" },
  privacy: { it: "privacy", en: "privacy", zh: "privacy" },
  cookie: { it: "cookie", en: "cookie", zh: "cookie" },
};

export const isStaticPageId = (id: string): id is StaticPageId => Object.prototype.hasOwnProperty.call(SLUGS, id);
/** Vero solo per un articolo pubblicato. */
export const isArticleId = (id: string): id is ArticleId => findArticle(id) !== undefined;

const KINDS: Record<StaticPageId, PageKind> = { home: "home", representatives: "audience", sellers: "audience", blog: "blog", privacy: "legal", cookie: "legal" };
export const pageKind = (id: PageId): PageKind => (isStaticPageId(id) ? KINDS[id] : "article");

export const pathOf = (id: PageId, lang: Lang): string => {
  if (isStaticPageId(id)) {
    const slug = SLUGS[id][lang];
    return `${LANG_PREFIX[lang]}/${slug ? `${slug}/` : ""}`;
  }
  const article = findArticle(id);
  if (!article) throw new Error(`routes: nessuna pagina «${id}»`);
  return `${LANG_PREFIX[lang]}/${SLUGS.blog[lang]}/${article.content[lang].slug}/`;
};

export const listPages = (): PageRef[] => {
  const ids: PageId[] = [...STATIC_PAGE_IDS, ...ARTICLES.map((entry) => entry.id)];
  return ids.flatMap((id) => LANGS.map((lang) => ({ id, lang, path: pathOf(id, lang) })));
};

/** Il percorso come lo scrive `pathOf`: una sola barra iniziale, barra finale, senza query. */
export const normalizePath = (path: string): string => {
  const clean = `/${path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")}`;
  return clean === "/" ? "/" : `${clean}/`;
};

export const findPage = (path: string): PageRef | null => {
  const wanted = normalizePath(path);
  return listPages().find((page) => page.path === wanted) ?? null;
};
