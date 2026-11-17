// Dati strutturati (schema.org) per i motori di ricerca e per le IA: l'intermediario, il servizio, le domande
// frequenti, i passi, il percorso della pagina.

export interface PostalSeat {
  street: string;
  postalCode: string;
  city: string;
  region: string;
  country: string;
}

export interface CompanyData {
  name: string;
  rui: string;
  /** Partita IVA, senza prefisso del paese. */
  vat: string;
  legalSeat: PostalSeat;
  office: PostalSeat;
  phoneE164: string;
  email: string;
}

const address = (seat: PostalSeat) => ({
  "@type": "PostalAddress",
  streetAddress: seat.street,
  postalCode: seat.postalCode,
  addressLocality: seat.city,
  addressRegion: seat.region,
  addressCountry: seat.country,
});

export const organizationId = (origin: string) => `${origin}/#organization`;

export interface OrganizationInput {
  company: CompanyData;
  origin: string;
  /** Indirizzo completo del logo. */
  logo: string;
  /** Le lingue in cui si puo' scrivere all'intermediario. */
  languages: string[];
}

/** L'intermediario assicurativo con l'iscrizione al Registro Unico, le sedi e i recapiti. */
export const organizationSchema = ({ company, origin, logo, languages }: OrganizationInput): object => ({
  "@context": "https://schema.org",
  "@type": "InsuranceAgency",
  "@id": organizationId(origin),
  name: company.name,
  legalName: company.name,
  url: `${origin}/`,
  logo,
  image: logo,
  telephone: company.phoneE164,
  email: company.email,
  vatID: `IT${company.vat}`,
  identifier: { "@type": "PropertyValue", propertyID: "RUI", name: "Registro Unico degli Intermediari assicurativi (IVASS), sezione B", value: company.rui },
  address: address(company.legalSeat),
  location: { "@type": "Place", name: "Sede operativa", address: address(company.office) },
  areaServed: { "@type": "Country", name: "Italy" },
  contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", email: company.email, telephone: company.phoneE164, availableLanguage: languages }],
});

export interface ServiceInput {
  origin: string;
  /** Percorso della pagina che descrive il servizio. */
  path: string;
  name: string;
  description: string;
  /** Valore di `inLanguage`. */
  lang: string;
  /** Tipo di servizio, per esempio "Insurance brokerage". */
  serviceType: string;
}

export const serviceSchema = ({ origin, path, name, description, lang, serviceType }: ServiceInput): object => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${origin}${path}#service`,
  name,
  description,
  serviceType,
  inLanguage: lang,
  url: `${origin}${path}`,
  provider: { "@id": organizationId(origin) },
  areaServed: { "@type": "Country", name: "Italy" },
});

export const faqSchema = (items: Array<{ q: string; a: string }>): object => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
});

export const howToSchema = (name: string, steps: Array<{ name: string; text: string }>): object => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name,
  step: steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.name, text: step.text })),
});

export const breadcrumbSchema = (items: Array<{ name: string; path: string }>, origin: string): object => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${origin}${item.path}` })),
});

/** Il blocco da mettere nella testata: un testo non puo' chiudere lo script. */
export const jsonLd = (data: object): string => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
