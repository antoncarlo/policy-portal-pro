// Da un percorso pubblico al documento HTML completo. Il corpo e' reso da React come HTML statico (nessuna
// idratazione nel browser); la testata e' composta come testo, con escape.
import { renderToStaticMarkup } from "react-dom/server";
import { HREFLANG, type SiteEnv } from "./config";
import { contentFor } from "./content";
import { findPage, listPages, type PageRef } from "./routes";
import { breadcrumbSchema, jsonLd, organizationSchema, serviceSchema } from "./schema";
import { escapeHtml, headTags } from "./seo";
import { buildLlmsTxt, buildSitemapXml } from "./sitemap";

export interface SiteAssets {
  /** Fogli di stile del sito pubblico. */
  css: string[];
  /** Ingresso JavaScript del sito pubblico (modulo). */
  js: string;
}

const document = (page: PageRef, assets: SiteAssets, env: SiteEnv): string => {
  const content = contentFor(page.lang);
  const meta = content.meta[page.id];
  const structured = [organizationSchema(env)];
  if (page.id === "home") structured.push(serviceSchema(page, meta, env));
  else structured.push(breadcrumbSchema(page, { home: content.meta.home.label, page: meta.label }, env));
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    headTags(page, meta, env),
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=tecnomga-2">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=tecnomga-2">',
    '<meta name="theme-color" content="#103657">',
    ...assets.css.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    `<script type="module" src="${escapeHtml(assets.js)}"></script>`,
    ...structured.map(jsonLd),
  ].join("\n");
  const body = renderToStaticMarkup(
    <main>
      <h1>{meta.h1}</h1>
    </main>,
  );
  return `<!doctype html>\n<html lang="${HREFLANG[page.lang]}" data-page="${page.id}">\n<head>\n${head}\n</head>\n<body class="site">\n${body}\n</body>\n</html>\n`;
};

/** Il documento di un percorso pubblico (con o senza barra finale); null se il percorso non e' del sito pubblico. */
export const renderPage = (path: string, assets: SiteAssets, env: SiteEnv): string | null => {
  const page = findPage(path);
  return page ? document(page, assets, env) : null;
};

export const renderAll = (assets: SiteAssets, env: SiteEnv): Array<{ path: string; html: string }> =>
  listPages().map((page) => ({ path: page.path, html: document(page, assets, env) }));

/** I file serviti accanto alle pagine: la mappa del sito e la descrizione per le IA. */
export const renderExtraFiles = (env: SiteEnv, today: string): Array<{ file: string; content: string }> => [
  { file: "sitemap.xml", content: buildSitemapXml(env, today) },
  { file: "llms.txt", content: buildLlmsTxt(env) },
];
