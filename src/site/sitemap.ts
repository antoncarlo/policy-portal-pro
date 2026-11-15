// sitemap.xml (tutte le pagine pubbliche, con le alternative per lingua), llms.txt (il sito descritto alle IA) e il
// feed delle guide, uno per lingua.
import { ARTICLES, AUTHOR, findArticle } from "./blog";
import { COMPANY, DEFAULT_LANG, HREFLANG, LANGS, LANG_NAMES, type Lang, type SiteEnv } from "./config";
import { contentFor } from "./content";
import { plainText } from "./inline";
import { metaOf } from "./meta";
import { listPages, pageKind, pathOf, type PageRef } from "./routes";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** La data di una pagina nella mappa: per un articolo quella della sua ultima verifica, per le altre quella data. */
const lastModified = (page: PageRef, fallback: string) => findArticle(page.id)?.updated ?? fallback;

export const buildSitemapXml = (env: SiteEnv, today: string): string => {
  const urls = listPages().map((page) => {
    const alternates = [
      ...LANGS.map((lang) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[lang]}" href="${env.origin}${pathOf(page.id, lang)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${env.origin}${pathOf(page.id, DEFAULT_LANG)}"/>`,
    ].join("\n");
    return `  <url>\n    <loc>${env.origin}${page.path}</loc>\n    <lastmod>${lastModified(page, today)}</lastmod>\n${alternates}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
};

/** Dove sta il feed delle guide di una lingua: accanto all'indice del blog. */
export const feedPath = (lang: Lang): string => `${pathOf("blog", lang)}feed.xml`;

/** Il feed delle guide in formato Atom: per i lettori di feed e per chi segue gli aggiornamenti in modo automatico. */
export const buildFeed = (env: SiteEnv, lang: Lang): string => {
  const blog = `${env.origin}${pathOf("blog", lang)}`;
  const stamp = (date: string) => `${date}T00:00:00Z`;
  const newest = ARTICLES.map((entry) => entry.updated).sort().at(-1) ?? "1970-01-01";
  const entries = ARTICLES.map((entry) => {
    const article = entry.content[lang];
    const url = `${env.origin}${pathOf(entry.id, lang)}`;
    return [
      "  <entry>",
      `    <title>${escapeXml(article.h1)}</title>`,
      `    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>`,
      `    <id>${escapeXml(url)}</id>`,
      `    <published>${stamp(entry.published)}</published>`,
      `    <updated>${stamp(entry.updated)}</updated>`,
      `    <summary>${escapeXml(plainText(article.summary))}</summary>`,
      `    <author><name>${escapeXml(AUTHOR.name)}</name></author>`,
      "  </entry>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${HREFLANG[lang]}">`,
    `  <title>${escapeXml(contentFor(lang).blog.feedTitle)}</title>`,
    `  <subtitle>${escapeXml(contentFor(lang).meta.blog.description)}</subtitle>`,
    `  <id>${escapeXml(blog)}</id>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${env.origin}${feedPath(lang)}`)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(blog)}"/>`,
    `  <updated>${stamp(newest)}</updated>`,
    `  <author><name>${escapeXml(AUTHOR.name)}</name></author>`,
    `  <rights>${escapeXml(COMPANY.name)}</rights>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");
};

/** Testo semplice per i motori basati su IA: chi siamo, cosa offriamo, dove sono le pagine. In inglese, la lingua che leggono tutti. */
export const buildLlmsTxt = (env: SiteEnv): string => {
  const line = (page: PageRef) => {
    const meta = metaOf(page);
    return `- [${meta.title}](${env.origin}${page.path}): ${meta.description}`;
  };
  const pages = listPages()
    .filter((page) => pageKind(page.id) !== "article")
    .map(line)
    .join("\n");
  // Le guide per lingua, cosi' un motore di risposta cita la versione nella lingua della domanda.
  const guides = LANGS.map((lang) => {
    const items = ARTICLES.map((entry) => line({ id: entry.id, lang, path: pathOf(entry.id, lang) })).join("\n");
    return `### ${LANG_NAMES[lang]}\n\n${items}`;
  }).join("\n\n");
  return `# ${COMPANY.name}: VIES guarantees (fideiussioni VIES) in Italy

> ${COMPANY.name} is an Italian insurance broker, entered in the Italian Register of Insurance Intermediaries (RUI, kept by IVASS) under number ${COMPANY.rui}. This site is dedicated to the VIES guarantee: the surety bond that a company not established in the EU or EEA, registered for Italian VAT through a fiscal representative, must provide to be included in the VIES database (art. 35, paragraph 7-quater, DPR 633/1972).

## Key facts

- The guarantee is for at least 50,000 euro and lasts at least 36 months (Ministry of Economy decree of 4 December 2024; Italian Revenue Agency order of 14 April 2025).
- It can be given as a deposit of government bonds, a bank guarantee or an insurance surety bond. This site is about the insurance surety bond.
- The beneficiary is the Italian Revenue Agency (Agenzia delle Entrate).
- Requests come from fiscal representatives, professional firms and brokers, in batches, and from the foreign companies themselves.
- The site is available in Italian, English and Simplified Chinese.
- The content is general information, not tax or legal advice.

## Pages

${pages}

## Guides

The guides are written by ${AUTHOR.name} (${COMPANY.name}) from the official texts of the Italian Revenue Agency and of Italian and EU law, which each guide links, and from how applications are actually handled in the portal. Each guide opens with a direct answer and ends with its sources and the date they were last checked. Feed: ${env.origin}${feedPath(DEFAULT_LANG)}

${guides}

## Contact

- Email: ${COMPANY.email}
- Phone: ${COMPANY.phoneE164}
- Certified email (PEC): ${COMPANY.pec}
- Registered office: ${COMPANY.legalSeat.street}, ${COMPANY.legalSeat.postalCode} ${COMPANY.legalSeat.city}, Italy
- Operating office: ${COMPANY.office.street}, ${COMPANY.office.postalCode} ${COMPANY.office.city}, Italy
- VAT number: IT${COMPANY.vat}
`;
};
