// Dati strutturati (JSON-LD, vocabolario schema.org): dicono ai motori di ricerca e alle IA chi e' l'intermediario,
// che servizio offre, quali domande trovano risposta nella pagina e in che ordine si svolgono i passi.
import { AUTHOR, type ArticleEntry } from "./blog";
import { COMPANY, HREFLANG, type Lang, type SiteEnv } from "./config";
import { plainText } from "./inline";
import { pathOf, type PageRef } from "./routes";
import { socialImage } from "./seo";

const CONTEXT = "https://schema.org";
export const organizationId = (env: SiteEnv) => `${env.origin}/#organization`;

const address = (seat: { street: string; postalCode: string; city: string; region: string; country: string }) => ({
  "@type": "PostalAddress",
  streetAddress: seat.street,
  postalCode: seat.postalCode,
  addressLocality: seat.city,
  addressRegion: seat.region,
  addressCountry: seat.country,
});

export const organizationSchema = (env: SiteEnv): object => ({
  "@context": CONTEXT,
  "@type": "InsuranceAgency",
  "@id": organizationId(env),
  name: COMPANY.name,
  legalName: COMPANY.name,
  url: `${env.origin}/`,
  logo: `${env.origin}/brand/tecno-mga-logo.png`,
  image: `${env.origin}/brand/tecno-mga-logo.png`,
  telephone: COMPANY.phoneE164,
  email: COMPANY.email,
  vatID: `IT${COMPANY.vat}`,
  // Iscrizione al Registro Unico degli Intermediari assicurativi, verificabile sul sito dell'IVASS.
  identifier: { "@type": "PropertyValue", propertyID: "RUI", name: "Registro Unico degli Intermediari assicurativi (IVASS), sezione B", value: COMPANY.rui },
  address: address(COMPANY.legalSeat),
  location: { "@type": "Place", name: "Sede operativa", address: address(COMPANY.office) },
  areaServed: { "@type": "Country", name: "Italy" },
  contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email: COMPANY.email, telephone: COMPANY.phoneE164, availableLanguage: ["it", "en", "zh"] }],
});

export const serviceSchema = (page: PageRef, meta: { title: string; description: string }, env: SiteEnv): object => ({
  "@context": CONTEXT,
  "@type": "Service",
  "@id": `${env.origin}${page.path}#service`,
  name: meta.title.split(" | ")[0],
  description: meta.description,
  serviceType: "Surety bond (VIES guarantee, art. 35(7-quater) DPR 633/1972)",
  url: `${env.origin}${page.path}`,
  inLanguage: HREFLANG[page.lang],
  provider: { "@id": organizationId(env) },
  areaServed: { "@type": "Country", name: "Italy" },
});

export const faqSchema = (items: Array<{ q: string; a: string }>): object => ({
  "@context": CONTEXT,
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
});

export const howToSchema = (name: string, steps: Array<{ name: string; text: string }>): object => ({
  "@context": CONTEXT,
  "@type": "HowTo",
  name,
  step: steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.name, text: step.text })),
});

/** Il percorso dalla homepage alla pagina: una voce per livello. */
export const breadcrumbSchema = (items: Array<{ name: string; path: string }>, env: SiteEnv): object => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${env.origin}${item.path}` })),
});

const blogId = (lang: Lang, env: SiteEnv) => `${env.origin}${pathOf("blog", lang)}#blog`;
const authorNode = (env: SiteEnv) => ({ "@type": "Person", name: AUTHOR.name, worksFor: { "@id": organizationId(env) } });

/** Un articolo: chi lo firma, chi lo pubblica, quando, e su quali fonti poggia. */
export const articleSchema = (page: PageRef, entry: ArticleEntry, env: SiteEnv): object => {
  const article = entry.content[page.lang];
  const url = `${env.origin}${page.path}`;
  return {
    "@context": CONTEXT,
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: article.h1,
    description: article.description,
    abstract: plainText(article.summary),
    keywords: article.keyword,
    inLanguage: HREFLANG[page.lang],
    datePublished: entry.published,
    dateModified: entry.updated,
    author: authorNode(env),
    publisher: { "@id": organizationId(env) },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: socialImage(env, page.lang),
    isPartOf: { "@id": blogId(page.lang, env) },
    citation: article.sources.map((source) => source.href),
  };
};

/** L'indice del blog, con l'elenco degli articoli. */
export const blogSchema = (page: PageRef, meta: { h1: string; description: string }, entries: ArticleEntry[], env: SiteEnv): object => ({
  "@context": CONTEXT,
  "@type": "Blog",
  "@id": blogId(page.lang, env),
  name: meta.h1,
  description: meta.description,
  url: `${env.origin}${page.path}`,
  inLanguage: HREFLANG[page.lang],
  publisher: { "@id": organizationId(env) },
  blogPost: entries.map((entry) => ({
    "@type": "BlogPosting",
    headline: entry.content[page.lang].h1,
    url: `${env.origin}${pathOf(entry.id, page.lang)}`,
    datePublished: entry.published,
    dateModified: entry.updated,
    author: authorNode(env),
  })),
});

/** Il blocco di dati nella pagina. "<" e' scritto come \u003c: nessun valore puo' chiudere il blocco. */
export const jsonLd = (data: object): string => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
