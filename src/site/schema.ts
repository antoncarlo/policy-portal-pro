// Dati strutturati (JSON-LD, vocabolario schema.org): dicono ai motori di ricerca e alle IA chi e' l'intermediario,
// che servizio offre, quali domande trovano risposta nella pagina e in che ordine si svolgono i passi.
import { COMPANY, HREFLANG, type SiteEnv } from "./config";
import { pathOf, type PageRef } from "./routes";

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

export const breadcrumbSchema = (page: PageRef, labels: { home: string; page: string }, env: SiteEnv): object => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: labels.home, item: `${env.origin}${pathOf("home", page.lang)}` },
    { "@type": "ListItem", position: 2, name: labels.page, item: `${env.origin}${page.path}` },
  ],
});

/** Il blocco di dati nella pagina. "<" e' scritto come \u003c: nessun valore puo' chiudere il blocco. */
export const jsonLd = (data: object): string => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
