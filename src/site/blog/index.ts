// Il registro degli articoli. Per aggiungerne uno: tre file articles/<lingua>/<id>.ts, una riga in ciascun
// articles/<lingua>/index.ts, l'id in ARTICLE_IDS (types.ts) e le sue date qui sotto. Un articolo compare nel sito
// solo quando esiste in tutte e tre le lingue; i test di tests/site/blog.test.ts controllano il resto.
import { COMPANY, type Lang } from "../config";
import { articles as en } from "./articles/en";
import { articles as it } from "./articles/it";
import { articles as zh } from "./articles/zh";
import { ARTICLE_IDS, type Article, type ArticleEntry, type ArticleId } from "./types";

export { ARTICLE_IDS } from "./types";
export type { Article, ArticleEntry, ArticleId, ArticleSection, Block } from "./types";

/** Chi firma gli articoli. */
export const AUTHOR = { name: "Anton Carlo Santoro", organization: COMPANY.name } as const;

const CONTENT: Record<Lang, Partial<Record<ArticleId, Article>>> = { it, en, zh };

/** Date (AAAA-MM-GG) e guide collegate di ogni articolo. `updated` e' il giorno dell'ultima verifica sulle fonti. */
const META: Record<ArticleId, { published: string; updated: string; related: ArticleId[] }> = {
  "garanzia-vies": { published: "2026-11-15", updated: "2026-11-15", related: ["forme-garanzia", "documenti", "garanzia-rappresentante"] },
  "forme-garanzia": { published: "2026-11-15", updated: "2026-11-15", related: ["garanzia-vies", "documenti", "richiesta-polizza"] },
  documenti: { published: "2026-11-15", updated: "2026-11-15", related: ["richiesta-polizza", "garanzia-vies", "venditori-marketplace"] },
  "richiesta-polizza": { published: "2026-11-15", updated: "2026-11-15", related: ["documenti", "lotto-pratiche", "firma-p7m"] },
  "lotto-pratiche": { published: "2026-11-15", updated: "2026-11-15", related: ["richiesta-polizza", "firma-p7m", "garanzia-rappresentante"] },
  "firma-p7m": { published: "2026-11-15", updated: "2026-11-15", related: ["lotto-pratiche", "richiesta-polizza", "documenti"] },
  "garanzia-rappresentante": { published: "2026-11-15", updated: "2026-11-15", related: ["garanzia-vies", "lotto-pratiche", "forme-garanzia"] },
  "venditori-marketplace": { published: "2026-11-15", updated: "2026-11-15", related: ["garanzia-vies", "documenti", "forme-garanzia"] },
};

/** Gli articoli pubblicati, nell'ordine del progetto. */
export const ARTICLES: ArticleEntry[] = ARTICLE_IDS.flatMap((id) => {
  const content = { it: CONTENT.it[id], en: CONTENT.en[id], zh: CONTENT.zh[id] };
  return content.it && content.en && content.zh ? [{ id, ...META[id], content: content as Record<Lang, Article> }] : [];
});

export const findArticle = (id: string): ArticleEntry | undefined => ARTICLES.find((entry) => entry.id === id);

export const articleOf = (id: ArticleId): ArticleEntry => {
  const entry = findArticle(id);
  if (!entry) throw new Error(`blog: l'articolo «${id}» non e' nel registro`);
  return entry;
};

/** Gli articoli collegati che esistono davvero, nell'ordine indicato dall'articolo. */
export const relatedOf = (entry: ArticleEntry): ArticleEntry[] => entry.related.flatMap((id) => findArticle(id) ?? []);
