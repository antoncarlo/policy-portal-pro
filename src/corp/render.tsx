// Da un percorso del sito aziendale al documento HTML completo. Il corpo e' reso da React come HTML statico
// (nessuna idratazione nel browser); la testata e' composta come testo, con escape.
import { renderToStaticMarkup } from "react-dom/server";
import { escapeHtml, htmlDocument } from "../site-kit/html";
import { CORP, type CorpEnv } from "./config";
import { contentFor } from "./content";
import { findPage, listPages, type CorpPage } from "./routes";

export interface SiteAssets {
  /** Fogli di stile del sito. */
  css: string[];
  /** Ingresso JavaScript del sito (modulo). */
  js: string;
  /** I caratteri della prima schermata, da chiedere subito. */
  fonts?: { heading?: string; body?: string };
}

const document = (page: CorpPage, assets: SiteAssets, _env: CorpEnv): string => {
  const content = contentFor(page.lang);
  const meta = content.meta[page.id];
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${escapeHtml(meta.title)}</title>`,
    ...[assets.fonts?.heading, assets.fonts?.body]
      .filter((href): href is string => Boolean(href))
      .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${escapeHtml(href)}" crossorigin>`),
    ...assets.css.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    `<script type="module" src="${escapeHtml(assets.js)}"></script>`,
  ].join("\n");
  const body = renderToStaticMarkup(
    <main id="contenuto">
      <h1>{meta.h1}</h1>
    </main>,
  );
  return htmlDocument({ lang: CORP.hreflang[page.lang], siteId: CORP.id, pageId: page.id, head, body, bodyClass: "corp" });
};

/** Il documento di un percorso (con o senza barra finale); null se il percorso non e' del sito aziendale. */
export const renderPage = (path: string, assets: SiteAssets, env: CorpEnv): string | null => {
  const page = findPage(path);
  return page ? document(page, assets, env) : null;
};

export const renderAll = (assets: SiteAssets, env: CorpEnv): Array<{ path: string; html: string }> =>
  listPages().map((page) => ({ path: page.path, html: document(page, assets, env) }));

/** I file serviti accanto alle pagine: per ora nessuno oltre a quelli aggiunti con la testata e la sitemap. */
export const renderExtraFiles = (_env: CorpEnv): Array<{ file: string; content: string }> => [];
