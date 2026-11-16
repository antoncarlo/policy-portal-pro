// sitemap.xml (tutte le pagine, con le versioni per lingua), robots.txt e llms.txt (il sito descritto alle IA).
import type { SiteDefinition } from "./types";

export const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export interface SitemapPage<L extends string> {
  path: string;
  /** Data dell'ultima modifica vera del contenuto (AAAA-MM-GG), non della build. */
  lastmod: string;
  /** La stessa pagina in ogni lingua. */
  alternates: Array<{ lang: L; path: string }>;
}

export const buildSitemapXml = <L extends string>(def: SiteDefinition<L>, origin: string, pages: Array<SitemapPage<L>>): string => {
  const urls = pages.map((page) => {
    const fallback = page.alternates.find((item) => item.lang === def.xDefault);
    const alternates = [
      ...page.alternates.map((item) => `    <xhtml:link rel="alternate" hreflang="${def.hreflang[item.lang]}" href="${escapeXml(`${origin}${item.path}`)}"/>`),
      ...(fallback ? [`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}${fallback.path}`)}"/>`] : []),
    ].join("\n");
    return `  <url>\n    <loc>${escapeXml(`${origin}${page.path}`)}</loc>\n    <lastmod>${page.lastmod}</lastmod>\n${alternates}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
};

/** Un indirizzo di prova chiude la porta a tutti i motori; il sito pubblicato la apre e indica la sitemap. */
export const buildRobotsTxt = ({ origin, indexable }: { origin: string; indexable: boolean }): string =>
  indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";

export interface LlmsInput {
  title: string;
  /** Una o due frasi su chi e' e cosa fa il sito. */
  summary: string;
  /** Righe di fatti verificabili, mostrate come elenco. */
  facts: string[];
  sections: Array<{ heading: string; links: Array<{ label: string; url: string; note?: string }> }>;
}

export const buildLlmsTxt = ({ title, summary, facts, sections }: LlmsInput): string =>
  [
    `# ${title}`,
    "",
    `> ${summary}`,
    "",
    ...facts.map((fact) => `- ${fact}`),
    "",
    ...sections.flatMap((section) => [`## ${section.heading}`, "", ...section.links.map((link) => `- [${link.label}](${link.url})${link.note ? `: ${link.note}` : ""}`), ""]),
  ].join("\n");
