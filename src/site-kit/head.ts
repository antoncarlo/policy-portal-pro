// La testata di una pagina pubblica: titolo, descrizione, indirizzo canonico, la stessa pagina nelle altre lingue,
// cosa mostrano i social quando si condivide il link, e se i motori possono indicizzarla. Tutto come testo, con escape.
import { escapeHtml } from "./html";
import type { PageRef, SiteDefinition } from "./types";

export interface HeadInput<L extends string> {
  def: SiteDefinition<L>;
  page: PageRef<string, L>;
  /** La stessa pagina in ogni lingua del sito (compresa quella corrente). */
  alternates: Array<{ lang: L; path: string }>;
  meta: { title: string; description: string };
  /** Origine canonica, senza barra finale. */
  origin: string;
  /** Falso su un indirizzo di prova: la pagina chiede ai motori di non indicizzarla. */
  indexable: boolean;
  /** Indirizzo completo dell'immagine per i social (1200×630). */
  socialImage: string;
  siteName: string;
  /** Il valore di og:locale per ogni lingua, per esempio it_IT. */
  ogLocale: Record<L, string>;
  verification?: { google?: string; bing?: string };
  /** Solo per gli articoli firmati. */
  article?: { published: string; updated: string; author: string };
  /** Il feed delle guide nella lingua della pagina. */
  feed?: { href: string; title: string };
}

export const headTags = <L extends string>(input: HeadInput<L>): string => {
  const { def, page, alternates, meta, origin } = input;
  const url = `${origin}${page.path}`;
  const fallback = alternates.find((item) => item.lang === def.xDefault);
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    ...(input.article ? [`<meta name="author" content="${escapeHtml(input.article.author)}">`] : []),
    `<meta name="robots" content="${input.indexable ? "index, follow, max-image-preview:large, max-snippet:-1" : "noindex, nofollow"}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    ...alternates.map((item) => `<link rel="alternate" hreflang="${def.hreflang[item.lang]}" href="${escapeHtml(`${origin}${item.path}`)}">`),
    ...(fallback ? [`<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${origin}${fallback.path}`)}">`] : []),
    `<meta property="og:type" content="${input.article ? "article" : "website"}">`,
    `<meta property="og:site_name" content="${escapeHtml(input.siteName)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(input.socialImage)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:locale" content="${input.ogLocale[page.lang]}">`,
    ...def.langs.filter((lang) => lang !== page.lang).map((lang) => `<meta property="og:locale:alternate" content="${input.ogLocale[lang]}">`),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(input.socialImage)}">`,
  ];
  if (input.feed) tags.push(`<link rel="alternate" type="application/atom+xml" title="${escapeHtml(input.feed.title)}" href="${escapeHtml(input.feed.href)}">`);
  if (input.article) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(input.article.published)}">`);
    tags.push(`<meta property="article:modified_time" content="${escapeHtml(input.article.updated)}">`);
    tags.push(`<meta property="article:author" content="${escapeHtml(input.article.author)}">`);
  }
  if (input.verification?.google) tags.push(`<meta name="google-site-verification" content="${escapeHtml(input.verification.google)}">`);
  if (input.verification?.bing) tags.push(`<meta name="msvalidate.01" content="${escapeHtml(input.verification.bing)}">`);
  return tags.join("\n");
};
