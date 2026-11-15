// sitemap.xml (tutte le pagine pubbliche, con le alternative per lingua) e llms.txt (il sito descritto alle IA).
import { COMPANY, DEFAULT_LANG, HREFLANG, LANGS, type SiteEnv } from "./config";
import { contentFor } from "./content";
import { listPages, pathOf } from "./routes";

export const buildSitemapXml = (env: SiteEnv, today: string): string => {
  const urls = listPages().map((page) => {
    const alternates = [
      ...LANGS.map((lang) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[lang]}" href="${env.origin}${pathOf(page.id, lang)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${env.origin}${pathOf(page.id, DEFAULT_LANG)}"/>`,
    ].join("\n");
    return `  <url>\n    <loc>${env.origin}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
};

/** Testo semplice per i motori basati su IA: chi siamo, cosa offriamo, dove sono le pagine. In inglese, la lingua che leggono tutti. */
export const buildLlmsTxt = (env: SiteEnv): string => {
  const pages = listPages()
    .map((page) => {
      const meta = contentFor(page.lang).meta[page.id];
      return `- [${meta.title}](${env.origin}${page.path}): ${meta.description}`;
    })
    .join("\n");
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

## Contact

- Email: ${COMPANY.email}
- Phone: ${COMPANY.phoneE164}
- Certified email (PEC): ${COMPANY.pec}
- Registered office: ${COMPANY.legalSeat.street}, ${COMPANY.legalSeat.postalCode} ${COMPANY.legalSeat.city}, Italy
- Operating office: ${COMPANY.office.street}, ${COMPANY.office.postalCode} ${COMPANY.office.city}, Italy
- VAT number: IT${COMPANY.vat}
`;
};
