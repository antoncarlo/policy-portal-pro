// La testata di una pagina pubblica: titolo, descrizione, indirizzo canonico, la stessa pagina nelle altre lingue,
// e quello che mostrano i social quando si condivide il link. Tutto come testo, con escape.
import { COMPANY, DEFAULT_LANG, HREFLANG, LANGS, type Lang, type SiteEnv } from "./config";
import { pathOf, type PageRef } from "./routes";

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Il valore di og:locale per ogni lingua. */
const OG_LOCALE: Record<Lang, string> = { it: "it_IT", en: "en_GB", zh: "zh_CN" };

export const absoluteUrl = (env: SiteEnv, path: string) => `${env.origin}${path}`;
/** Immagine 1200x630 mostrata quando si condivide il link, una per lingua. */
export const socialImage = (env: SiteEnv, lang: Lang) => `${env.origin}/site-media/og-${lang}.png`;

/** Cio' che la testata di un articolo ha in piu': chi lo firma e le sue date (AAAA-MM-GG). */
export interface HeadExtra {
  article?: { published: string; updated: string; author: string };
  /** Il feed delle guide nella lingua della pagina: indirizzo completo e nome. */
  feed?: { href: string; title: string };
}

export const headTags = (page: PageRef, meta: { title: string; description: string }, env: SiteEnv, extra: HeadExtra = {}): string => {
  const url = absoluteUrl(env, page.path);
  const image = socialImage(env, page.lang);
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<meta name="author" content="${escapeHtml(extra.article?.author ?? COMPANY.name)}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    ...LANGS.map((lang) => `<link rel="alternate" hreflang="${HREFLANG[lang]}" href="${escapeHtml(absoluteUrl(env, pathOf(page.id, lang)))}">`),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(env, pathOf(page.id, DEFAULT_LANG)))}">`,
    `<meta property="og:type" content="${extra.article ? "article" : "website"}">`,
    `<meta property="og:site_name" content="${escapeHtml(COMPANY.name)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:locale" content="${OG_LOCALE[page.lang]}">`,
    ...LANGS.filter((lang) => lang !== page.lang).map((lang) => `<meta property="og:locale:alternate" content="${OG_LOCALE[lang]}">`),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ];
  if (extra.feed) tags.push(`<link rel="alternate" type="application/atom+xml" title="${escapeHtml(extra.feed.title)}" href="${escapeHtml(extra.feed.href)}">`);
  if (extra.article) {
    tags.push(
      `<meta property="article:published_time" content="${escapeHtml(extra.article.published)}">`,
      `<meta property="article:modified_time" content="${escapeHtml(extra.article.updated)}">`,
      `<meta property="article:author" content="${escapeHtml(extra.article.author)}">`,
    );
  }
  if (env.gscVerification) tags.push(`<meta name="google-site-verification" content="${escapeHtml(env.gscVerification)}">`);
  if (env.bingVerification) tags.push(`<meta name="msvalidate.01" content="${escapeHtml(env.bingVerification)}">`);
  return tags.join("\n");
};
