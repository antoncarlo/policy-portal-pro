// Il registro degli articoli. Per aggiungerne uno: tre file in articles/<lingua>/<id>.ts, l'id in ARTICLE_IDS
// (types.ts) e una voce qui. I test di tests/site/blog.test.ts controllano il resto.
import { COMPANY } from "../config";
import { garanziaVies as garanziaViesEn } from "./articles/en/garanzia-vies";
import { garanziaVies as garanziaViesIt } from "./articles/it/garanzia-vies";
import { garanziaVies as garanziaViesZh } from "./articles/zh/garanzia-vies";
import { ARTICLE_IDS, type ArticleEntry, type ArticleId } from "./types";

export { ARTICLE_IDS } from "./types";
export type { Article, ArticleEntry, ArticleId, ArticleSection, Block } from "./types";

/** Chi firma gli articoli. */
export const AUTHOR = { name: "Anton Carlo Santoro", organization: COMPANY.name } as const;

const ENTRIES: ArticleEntry[] = [
  {
    id: "garanzia-vies",
    published: "2026-11-15",
    updated: "2026-11-15",
    related: ["forme-garanzia", "documenti", "garanzia-rappresentante"],
    content: { it: garanziaViesIt, en: garanziaViesEn, zh: garanziaViesZh },
  },
];

/** Gli articoli pubblicati, nell'ordine del progetto. */
export const ARTICLES: ArticleEntry[] = ARTICLE_IDS.flatMap((id) => ENTRIES.filter((entry) => entry.id === id));

export const findArticle = (id: string): ArticleEntry | undefined => ARTICLES.find((entry) => entry.id === id);

export const articleOf = (id: ArticleId): ArticleEntry => {
  const entry = findArticle(id);
  if (!entry) throw new Error(`blog: l'articolo «${id}» non e' nel registro`);
  return entry;
};

/** Gli articoli collegati che esistono davvero, nell'ordine indicato dall'articolo. */
export const relatedOf = (entry: ArticleEntry): ArticleEntry[] => entry.related.flatMap((id) => findArticle(id) ?? []);
