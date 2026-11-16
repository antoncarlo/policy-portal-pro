// Da un percorso del sito aziendale al documento HTML completo. Il corpo e' reso da React come HTML statico
// (nessuna idratazione nel browser); la testata e' composta come testo, con escape.
import { renderToStaticMarkup } from "react-dom/server";
import { headTags } from "../site-kit/head";
import { escapeHtml, htmlDocument } from "../site-kit/html";
import { breadcrumbSchema, jsonLd, organizationSchema, serviceSchema } from "../site-kit/schema";
import { buildLlmsTxt, buildRobotsTxt, buildSitemapXml } from "../site-kit/sitemap";
import { COMPANY, CORP, CORP_CONTENT_UPDATED, type CorpEnv, type CorpLang } from "./config";
import { contentFor } from "./content";
import { metaOf } from "./meta";
import { findPage, listPages, pageKind, pathOf, type CorpPage } from "./routes";
import { Layout } from "./components/Layout";

export interface SiteAssets {
  /** Fogli di stile del sito. */
  css: string[];
  /** Ingresso JavaScript del sito (modulo). */
  js: string;
  /** I caratteri della prima schermata, da chiedere subito. */
  fonts?: { heading?: string; body?: string };
}

const OG_LOCALE: Record<CorpLang, string> = { it: "it_IT", en: "en_GB" };
/** La stessa pagina in ogni lingua del sito. */
const alternatesOf = (page: CorpPage) => CORP.langs.map((lang) => ({ lang, path: pathOf(page.id, lang) }));
const logoUrl = (env: CorpEnv) => `${env.origin}/brand/tecno-mga-logo.png`;
const socialImage = (env: CorpEnv, lang: CorpLang) => `${env.origin}/media/og-${lang}.png`;

const document = (page: CorpPage, assets: SiteAssets, env: CorpEnv): string => {
  const content = contentFor(page.lang);
  const meta = metaOf(page);
  const kind = pageKind(page.id);
  const crumb = (id: CorpPage["id"]) => ({ name: metaOf({ id, lang: page.lang }).label, path: pathOf(id, page.lang) });
  const structured = [organizationSchema({ company: COMPANY, origin: env.origin, logo: logoUrl(env), languages: [...CORP.langs] })];
  if (kind === "home") {
    structured.push(serviceSchema({ origin: env.origin, path: page.path, name: meta.h1, description: meta.description, lang: CORP.hreflang[page.lang], serviceType: content.about.serviceType }));
  } else structured.push(breadcrumbSchema([crumb("home"), crumb(page.id)], env.origin));
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    headTags({
      def: CORP,
      page,
      alternates: alternatesOf(page),
      meta,
      origin: env.origin,
      indexable: env.indexable,
      socialImage: socialImage(env, page.lang),
      siteName: COMPANY.name,
      ogLocale: OG_LOCALE,
      verification: { google: env.gscVerification, bing: env.bingVerification },
    }),
    ...[assets.fonts?.heading, assets.fonts?.body]
      .filter((href): href is string => Boolean(href))
      .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${escapeHtml(href)}" crossorigin>`),
    ...assets.css.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    `<script type="module" src="${escapeHtml(assets.js)}"></script>`,
    ...structured.map(jsonLd),
  ].join("\n");
  const body = renderToStaticMarkup(
    <Layout page={page} content={content} measurement={Boolean(env.ga4Id)}>
      <section className="page-head">
        <div className="container">
          <h1 className="page-head__title">{meta.h1}</h1>
        </div>
      </section>
    </Layout>,
  );
  return htmlDocument({ lang: CORP.hreflang[page.lang], siteId: CORP.id, pageId: page.id, head, body, bodyClass: "corp", attrs: { "data-ga4": env.ga4Id } });
};

/** Il documento di un percorso (con o senza barra finale); null se il percorso non e' del sito aziendale. */
export const renderPage = (path: string, assets: SiteAssets, env: CorpEnv): string | null => {
  const page = findPage(path);
  return page ? document(page, assets, env) : null;
};

export const renderAll = (assets: SiteAssets, env: CorpEnv): Array<{ path: string; html: string }> =>
  listPages().map((page) => ({ path: page.path, html: document(page, assets, env) }));

const seat = (value: { street: string; postalCode: string; city: string }) => `${value.street} - ${value.postalCode} ${value.city}`;

/** I file serviti accanto alle pagine: la mappa del sito, le istruzioni per i motori e la descrizione per le IA. */
export const renderExtraFiles = (env: CorpEnv): Array<{ file: string; content: string }> => {
  const about = contentFor(CORP.xDefault).about;
  return [
    {
      file: "sitemap.xml",
      // La data e' quella dell'ultima verifica dei contenuti, non quella della build.
      content: buildSitemapXml(
        CORP,
        env.origin,
        listPages().map((page) => ({ path: page.path, lastmod: CORP_CONTENT_UPDATED, alternates: alternatesOf(page) })),
      ),
    },
    { file: "robots.txt", content: buildRobotsTxt({ origin: env.origin, indexable: env.indexable }) },
    {
      file: "llms.txt",
      content: buildLlmsTxt({
        title: COMPANY.name,
        summary: about.summary,
        facts: [
          `Registro Unico degli Intermediari assicurativi (IVASS), sezione B: ${COMPANY.rui}`,
          `Partita IVA: ${COMPANY.vat}`,
          `Sede legale: ${seat(COMPANY.legalSeat)}`,
          `Sede operativa: ${seat(COMPANY.office)}`,
          `Email: ${COMPANY.email} · Telefono: ${COMPANY.phone} · PEC: ${COMPANY.pec}`,
        ],
        sections: CORP.langs.map((lang) => ({
          heading: CORP.langNames[lang],
          links: listPages()
            .filter((page) => page.lang === lang)
            .map((page) => ({ label: metaOf(page).label, url: `${env.origin}${page.path}`, note: metaOf(page).description })),
        })),
      }),
    },
  ];
};
