// Da un percorso pubblico al documento HTML completo. Il corpo e' reso da React come HTML statico (nessuna
// idratazione nel browser); la testata e' composta come testo, con escape.
import { renderToStaticMarkup } from "react-dom/server";
import { ARTICLES, AUTHOR, articleOf, type ArticleId } from "./blog";
import { CONTENT_UPDATED, HREFLANG, LANGS, type SiteEnv } from "./config";
import { contentFor } from "./content";
import type { AudienceId } from "./content/types";
import { metaOf } from "./meta";
import { plainText } from "./inline";
import { findPage, listPages, pageKind, pathOf, type PageRef } from "./routes";
import { Layout } from "./components/Layout";
import { ArticlePage } from "./pages/ArticlePage";
import { AudiencePage } from "./pages/AudiencePage";
import { BlogIndex } from "./pages/BlogIndex";
import { Home } from "./pages/Home";
import { LegalPage } from "./pages/Legal";
import { articleSchema, blogSchema, breadcrumbSchema, faqSchema, howToSchema, jsonLd, organizationSchema, serviceSchema } from "./schema";
import { escapeHtml, headTags } from "./seo";
import { buildFeed, buildLlmsTxt, buildSitemapXml, feedPath } from "./sitemap";

export interface SiteAssets {
  /** Fogli di stile del sito pubblico. */
  css: string[];
  /** Ingresso JavaScript del sito pubblico (modulo). */
  js: string;
  /** I caratteri della prima schermata, da chiedere subito: quello dei titoli (latino) e quello del testo. */
  fonts?: { heading?: string; body?: string };
}

const document = (page: PageRef, assets: SiteAssets, env: SiteEnv): string => {
  const content = contentFor(page.lang);
  const meta = metaOf(page);
  const kind = pageKind(page.id);
  const crumb = (id: PageRef["id"]) => ({ name: metaOf({ id, lang: page.lang, path: pathOf(id, page.lang) }).label, path: pathOf(id, page.lang) });
  const entry = kind === "article" ? articleOf(page.id as ArticleId) : undefined;
  const structured = [organizationSchema(env)];
  if (kind === "home") {
    // Le stesse domande e gli stessi passi che il lettore vede nella pagina.
    structured.push(serviceSchema(page, meta, env), faqSchema(content.faq.items), howToSchema(content.steps.title, content.steps.items.map((step) => ({ name: step.title, text: step.text }))));
  } else if (entry) {
    const article = entry.content[page.lang];
    structured.push(articleSchema(page, entry, env), faqSchema(article.faq.map((item) => ({ q: item.q, a: plainText(item.a) }))), breadcrumbSchema([crumb("home"), crumb("blog"), crumb(page.id)], env));
  } else if (kind === "blog") {
    structured.push(blogSchema(page, meta, ARTICLES, env), breadcrumbSchema([crumb("home"), crumb(page.id)], env));
  } else if (kind === "audience") {
    const audience = content.audiencePages[page.id as AudienceId];
    structured.push(serviceSchema(page, meta, env), faqSchema(audience.faq.map((item) => ({ q: item.q, a: plainText(item.a) }))), breadcrumbSchema([crumb("home"), crumb(page.id)], env));
  } else structured.push(breadcrumbSchema([crumb("home"), crumb(page.id)], env));
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    headTags(page, meta, env, {
      feed: { href: `${env.origin}${feedPath(page.lang)}`, title: content.blog.feedTitle },
      article: entry ? { published: entry.published, updated: entry.updated, author: AUTHOR.name } : undefined,
    }),
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=tecnomga-2">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=tecnomga-2">',
    '<meta name="theme-color" content="#103657">',
    // Il titolo cinese usa il carattere di sistema: li' serve solo il carattere del testo.
    ...[page.lang === "zh" ? undefined : assets.fonts?.heading, assets.fonts?.body]
      .filter((href): href is string => Boolean(href))
      .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${escapeHtml(href)}" crossorigin>`),
    ...assets.css.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    `<script type="module" src="${escapeHtml(assets.js)}"></script>`,
    ...structured.map(jsonLd),
  ].join("\n");
  const body = renderToStaticMarkup(
    <Layout page={page} content={content} tools={{ statistics: Boolean(env.ga4Id), marketing: Boolean(env.adsId) }}>
      {kind === "home" ? (
        <Home page={page} content={content} />
      ) : kind === "legal" ? (
        <LegalPage page={page} content={content} />
      ) : kind === "article" ? (
        <ArticlePage page={page} content={content} />
      ) : kind === "blog" ? (
        <BlogIndex page={page} content={content} />
      ) : (
        <AudiencePage page={page} content={content} />
      )}
    </Layout>,
  );
  // Gli identificativi degli strumenti di Google arrivano al browser come attributi: li legge src/site/client/consent.ts.
  const tools = [
    env.ga4Id ? ` data-ga4="${escapeHtml(env.ga4Id)}"` : "",
    env.adsId ? ` data-ads="${escapeHtml(env.adsId)}"` : "",
    env.adsId && env.adsConversionLabel ? ` data-ads-conversion="${escapeHtml(env.adsConversionLabel)}"` : "",
  ].join("");
  return `<!doctype html>\n<html lang="${HREFLANG[page.lang]}" data-page="${page.id}"${tools}>\n<head>\n${head}\n</head>\n<body class="site">\n${body}\n</body>\n</html>\n`;
};

/** Il documento di un percorso pubblico (con o senza barra finale); null se il percorso non e' del sito pubblico. */
export const renderPage = (path: string, assets: SiteAssets, env: SiteEnv): string | null => {
  const page = findPage(path);
  return page ? document(page, assets, env) : null;
};

export const renderAll = (assets: SiteAssets, env: SiteEnv): Array<{ path: string; html: string }> =>
  listPages().map((page) => ({ path: page.path, html: document(page, assets, env) }));

/** I file serviti accanto alle pagine: la mappa del sito, la descrizione per le IA e i feed delle guide. */
export const renderExtraFiles = (env: SiteEnv): Array<{ file: string; content: string }> => [
  // La data della mappa e' quella dell'ultima verifica dei contenuti, non quella della build: a un motore di
  // ricerca si dice che una pagina e' cambiata solo quando e' cambiata.
  { file: "sitemap.xml", content: buildSitemapXml(env, CONTENT_UPDATED) },
  { file: "llms.txt", content: buildLlmsTxt(env) },
  // Il feed delle guide, uno per lingua, accanto all'indice del blog.
  ...LANGS.map((lang) => ({ file: feedPath(lang).slice(1), content: buildFeed(env, lang) })),
];
