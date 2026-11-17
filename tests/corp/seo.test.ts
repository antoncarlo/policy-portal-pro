// Testata, dati strutturati, sitemap, robots e llms.txt del sito aziendale.
import { describe, expect, it } from "vitest";
import { COMPANY, CORP, readCorpEnv } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { renderAll, renderExtraFiles, renderPage } from "../../src/corp/render";
import { listPages } from "../../src/corp/routes";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const test_ = readCorpEnv({});
const live = readCorpEnv({ VITE_CORP_INDEXABLE: "true" });
const head = (html: string) => html.slice(0, html.indexOf("</head>"));
const file = (env: typeof live, name: string) => renderExtraFiles(env).find((item) => item.file === name)?.content ?? "";
const structured = (html: string): Array<Record<string, unknown>> =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));

describe("titoli e descrizioni", () => {
  it("hanno la lunghezza che i motori mostrano per intero, in ogni pagina e lingua", () => {
    for (const page of listPages()) {
      const meta = contentFor(page.lang).meta[page.id];
      expect(meta.title.length, `${page.path} titolo`).toBeGreaterThanOrEqual(50);
      expect(meta.title.length, `${page.path} titolo`).toBeLessThanOrEqual(60);
      expect(meta.description.length, `${page.path} descrizione`).toBeGreaterThanOrEqual(150);
      expect(meta.description.length, `${page.path} descrizione`).toBeLessThanOrEqual(160);
    }
  });

  it("sono diversi da pagina a pagina", () => {
    const titles = listPages().map((page) => contentFor(page.lang).meta[page.id].title);
    const descriptions = listPages().map((page) => contentFor(page.lang).meta[page.id].description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe("testata", () => {
  it("dichiara indirizzo canonico e versioni per lingua, con l'italiano come predefinita", () => {
    const html = head(renderPage("/en/privacy/", assets, live)!);
    expect(html).toContain('<link rel="canonical" href="https://tecnomga.com/en/privacy/">');
    expect(html).toContain('<link rel="alternate" hreflang="it" href="https://tecnomga.com/privacy/">');
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://tecnomga.com/en/privacy/">');
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://tecnomga.com/privacy/">');
  });

  it("ha titolo, descrizione e i dati per la condivisione sui social", () => {
    const html = head(renderPage("/", assets, live)!);
    const meta = contentFor("it").meta.home;
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(html).toContain('<meta name="description" content="');
    for (const name of ["og:type", "og:site_name", "og:title", "og:description", "og:url", "og:image", "og:locale"]) expect(html, name).toMatch(new RegExp(`<meta property="${name}" content="[^"]+"`));
    for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) expect(html, name).toMatch(new RegExp(`<meta name="${name}" content="[^"]+"`));
    expect(html).toContain('<meta property="og:image" content="https://tecnomga.com/media/og-it.png">');
    expect(html).toContain('<meta property="og:locale" content="it_IT">');
  });

  it("usa l'origine indicata dall'ambiente", () => {
    const html = head(renderPage("/", assets, readCorpEnv({ VITE_CORP_ORIGIN: "https://prova.example/" }))!);
    expect(html).toContain('<link rel="canonical" href="https://prova.example/">');
  });

  it("aggiunge i codici di verifica dei motori solo se impostati", () => {
    expect(head(renderPage("/", assets, live)!)).not.toMatch(/google-site-verification|msvalidate/);
    const html = head(renderPage("/", assets, readCorpEnv({ VITE_CORP_GSC_VERIFICATION: "abc123", VITE_CORP_BING_VERIFICATION: "bing456" }))!);
    expect(html).toContain('<meta name="google-site-verification" content="abc123">');
    expect(html).toContain('<meta name="msvalidate.01" content="bing456">');
  });
});

describe("indicizzazione: indirizzo di prova e sito pubblicato", () => {
  it("sull'indirizzo di prova ogni segnale dice di non indicizzare", () => {
    for (const page of renderAll(assets, test_)) expect(head(page.html), page.path).toContain('<meta name="robots" content="noindex, nofollow">');
    const robots = file(test_, "robots.txt");
    expect(robots).toMatch(/^User-agent: \*\nDisallow: \/\n$/);
    expect(robots).not.toContain("Sitemap:");
  });

  it("sul sito pubblicato ogni segnale dice di indicizzare", () => {
    for (const page of renderAll(assets, live)) {
      expect(head(page.html), page.path).toContain('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">');
      expect(page.html, page.path).not.toContain("noindex");
    }
    const robots = file(live, "robots.txt");
    expect(robots).toContain("Sitemap: https://tecnomga.com/sitemap.xml");
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  });

  it("l'indicizzazione si attiva solo con il valore esatto «true»", () => {
    expect(readCorpEnv({ VITE_CORP_INDEXABLE: "1" }).indexable).toBe(false);
    expect(readCorpEnv({ VITE_CORP_INDEXABLE: " true " }).indexable).toBe(true);
    expect(readCorpEnv({}).indexable).toBe(false);
  });
});

describe("dati strutturati", () => {
  it("ogni pagina presenta l'intermediario con i dati del Registro", () => {
    for (const page of renderAll(assets, live)) {
      const agency = structured(page.html).find((item) => item["@type"] === "InsuranceAgency");
      expect(agency, page.path).toBeDefined();
      expect(agency!.name).toBe(COMPANY.name);
      expect(agency!.email).toBe("info@tecnomga.com");
      expect(agency!.vatID).toBe("IT17460381001");
      expect((agency!.identifier as { value: string }).value).toBe("B000746484");
      expect((agency!.address as { streetAddress: string }).streetAddress).toBe("Via Po, 102");
      expect(JSON.stringify(agency)).not.toMatch(/Parioli|helpet|vies@/i);
    }
  });

  it("la homepage descrive il servizio, le altre pagine il percorso", () => {
    const types = (path: string) => structured(renderPage(path, assets, live)!).map((item) => item["@type"]);
    expect(types("/")).toEqual(expect.arrayContaining(["InsuranceAgency", "Service"]));
    expect(types("/privacy/")).toEqual(expect.arrayContaining(["InsuranceAgency", "BreadcrumbList"]));
    const crumbs = structured(renderPage("/en/cookie/", assets, live)!).find((item) => item["@type"] === "BreadcrumbList") as { itemListElement: Array<{ item: string }> };
    expect(crumbs.itemListElement.map((item) => item.item)).toEqual(["https://tecnomga.com/en/", "https://tecnomga.com/en/cookie/"]);
  });

  it("non lascia chiudere il blocco da un testo", () => {
    for (const page of renderAll(assets, live)) for (const match of page.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) expect(match[1]).not.toContain("<");
  });
});

describe("sitemap e llms.txt", () => {
  it("la sitemap elenca ogni pagina con le sue versioni per lingua ed e' XML ben formato", () => {
    const xml = file(live, "sitemap.xml");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs.sort()).toEqual(listPages().map((page) => `https://tecnomga.com${page.path}`).sort());
    expect((xml.match(/hreflang="x-default"/g) ?? []).length).toBe(listPages().length);
    expect((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) ?? []).length).toBe(listPages().length);
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("llms.txt presenta il sito e ne elenca le pagine per lingua", () => {
    const text = file(live, "llms.txt");
    expect(text.startsWith(`# ${COMPANY.name}`)).toBe(true);
    for (const page of listPages()) expect(text, page.path).toContain(`https://tecnomga.com${page.path})`);
    for (const lang of CORP.langs) expect(text).toContain(`## ${CORP.langNames[lang]}`);
    expect(text).toContain("B000746484");
  });
});
