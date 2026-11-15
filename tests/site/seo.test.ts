import { describe, expect, it } from "vitest";
import { CONTENT_UPDATED, HREFLANG, LANGS, readSiteEnv } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { metaOf } from "../../src/site/meta";
import { listPages, pathOf } from "../../src/site/routes";
import { renderExtraFiles, renderPage } from "../../src/site/render";
import { breadcrumbSchema, faqSchema, howToSchema, jsonLd, organizationSchema, serviceSchema } from "../../src/site/schema";
import { headTags } from "../../src/site/seo";
import { buildLlmsTxt, buildSitemapXml } from "../../src/site/sitemap";

const env = readSiteEnv({});
const ORIGIN = "https://portale.tecnomga.com";
const assets = { css: ["/a.css"], js: "/a.js" };
const attr = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1]);
/** A node of the structured data, as the tests read it. */
interface Node {
  [key: string]: unknown;
  mainEntity?: Node[];
  step?: Node[];
  itemListElement?: Node[];
  acceptedAnswer?: Node;
}
const node = (value: object) => value as Node;

describe("head of every public page", () => {
  it("has its own title and description, within the lengths the search results show", () => {
    const seen = new Set<string>();
    for (const page of listPages()) {
      const meta = metaOf(page);
      expect(seen.has(meta.title), `${page.path}: duplicate title`).toBe(false);
      seen.add(meta.title);
      if (page.lang === "zh") {
        expect(meta.title.length, page.path).toBeGreaterThanOrEqual(15);
        expect(meta.title.length, page.path).toBeLessThanOrEqual(34);
        expect(meta.description.length, page.path).toBeGreaterThanOrEqual(50);
        expect(meta.description.length, page.path).toBeLessThanOrEqual(80);
      } else {
        expect(meta.title.length, `${page.path}: ${meta.title}`).toBeGreaterThanOrEqual(50);
        expect(meta.title.length, `${page.path}: ${meta.title}`).toBeLessThanOrEqual(60);
        expect(meta.description.length, `${page.path}: ${meta.description}`).toBeGreaterThanOrEqual(150);
        expect(meta.description.length, `${page.path}: ${meta.description}`).toBeLessThanOrEqual(160);
      }
    }
  });

  it("uses the titles and descriptions of the project for the home pages", () => {
    expect(contentFor("it").meta.home).toMatchObject({
      title: "Fideiussione VIES per soggetti non residenti | Tecno MGA",
      description: "Polizza fideiussoria VIES da 50.000 euro per 36 mesi, art. 35 c. 7-quater DPR 633/1972. Per rappresentanti fiscali e società estere. Richiedi un contatto.",
    });
    expect(contentFor("en").meta.home).toMatchObject({
      title: "VIES Guarantee Italy: €50,000 Surety Bond | Tecno MGA",
      description: "Surety bond for the Italian VIES guarantee: €50,000 for 36 months, for non-EU companies with a fiscal representative. See documents, steps and get in touch.",
    });
    expect(contentFor("zh").meta.home.title).toBe("意大利VIES保函：5万欧元、36个月 | Tecno MGA");
  });

  it("names its canonical address and the same page in the other languages, both ways", () => {
    for (const page of listPages()) {
      const html = headTags(page, metaOf(page), env);
      expect(attr(html, /<link rel="canonical" href="([^"]+)">/g)).toEqual([`${ORIGIN}${page.path}`]);
      const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((match) => [match[1], match[2]]));
      expect(Object.keys(alternates).sort()).toEqual(["en", "it", "x-default", "zh-Hans"]);
      for (const lang of LANGS) expect(alternates[HREFLANG[lang]]).toBe(`${ORIGIN}${pathOf(page.id, lang)}`);
      expect(alternates["x-default"]).toBe(`${ORIGIN}${pathOf(page.id, "en")}`);
    }
  });

  it("carries what social networks and messaging apps show when the link is shared", () => {
    const html = headTags({ id: "home", lang: "en", path: "/en/" }, contentFor("en").meta.home, env);
    expect(html).toContain('<meta property="og:title" content="VIES Guarantee Italy: €50,000 Surety Bond | Tecno MGA">');
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/en/">`);
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/site-media/og-en.png">`);
    expect(html).toContain('<meta property="og:locale" content="en_GB">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">');
  });

  it("adds the ownership codes of Google and Bing only when they are set", () => {
    const page = listPages()[0];
    const meta = metaOf(page);
    expect(headTags(page, meta, env)).not.toMatch(/google-site-verification|msvalidate/);
    const html = headTags(page, meta, readSiteEnv({ VITE_GSC_VERIFICATION: "abc123", VITE_BING_VERIFICATION: "bing456" }));
    expect(html).toContain('<meta name="google-site-verification" content="abc123">');
    expect(html).toContain('<meta name="msvalidate.01" content="bing456">');
  });

  it("escapes what it writes into the tags", () => {
    const html = headTags({ id: "home", lang: "it", path: "/" }, { title: 'A "B" <C> & D', description: "x" }, env);
    expect(html).toContain("<title>A &quot;B&quot; &lt;C&gt; &amp; D</title>");
  });

  it("is in the rendered page, with the placeholder title gone", () => {
    const html = renderPage("/", assets, env) as string;
    expect(html).toContain("<title>Fideiussione VIES per soggetti non residenti | Tecno MGA</title>");
    expect(html).toContain('<link rel="canonical" href="https://portale.tecnomga.com/">');
    expect(html).toContain('"@type":"InsuranceAgency"');
  });
});

describe("structured data", () => {
  const parse = (html: string) => JSON.parse(html.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "").replace(/\\u003c/g, "<"));

  it("describes the intermediary as an insurance agency, with its register number and contacts", () => {
    const org = node(organizationSchema(env));
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("InsuranceAgency");
    expect(org.name).toBe("Tecno Advance MGA Broker Srl");
    expect(org.url).toBe(`${ORIGIN}/`);
    expect(org.telephone).toBe("+390697638088");
    expect(org.email).toBe("vies@tecnomga.com");
    expect(org.vatID).toBe("IT17460381001");
    expect(org.identifier).toMatchObject({ "@type": "PropertyValue", propertyID: "RUI", value: "B000746484" });
    expect(org.address).toMatchObject({ "@type": "PostalAddress", streetAddress: "Via Po, 102", postalCode: "00198", addressLocality: "Roma", addressCountry: "IT" });
  });

  it("describes the service in the language of the page", () => {
    const service = node(serviceSchema({ id: "home", lang: "en", path: "/en/" }, contentFor("en").meta.home, env));
    expect(service["@type"]).toBe("Service");
    expect(service.inLanguage).toBe("en");
    expect(service.provider).toEqual({ "@id": `${ORIGIN}/#organization` });
    expect(service.url).toBe(`${ORIGIN}/en/`);
  });

  it("lists one entry for each question, each step and each crumb", () => {
    const faq = node(faqSchema([{ q: "Q1?", a: "A1" }, { q: "Q2?", a: "A2" }]));
    expect(faq["@type"]).toBe("FAQPage");
    expect((faq.mainEntity ?? []).map((item) => [item["@type"], item.name, item.acceptedAnswer?.text])).toEqual([["Question", "Q1?", "A1"], ["Question", "Q2?", "A2"]]);
    const howTo = node(howToSchema("How it works", [{ name: "One", text: "First" }, { name: "Two", text: "Second" }]));
    expect((howTo.step ?? []).map((step) => [step.position, step.name])).toEqual([[1, "One"], [2, "Two"]]);
    const crumbs = node(breadcrumbSchema({ id: "privacy", lang: "en", path: "/en/privacy/" }, { home: "Home", page: "Privacy" }, env));
    expect((crumbs.itemListElement ?? []).map((item) => [item.position, item.name, item.item])).toEqual([[1, "Home", `${ORIGIN}/en/`], [2, "Privacy", `${ORIGIN}/en/privacy/`]]);
  });

  it("writes a data block that a value cannot close", () => {
    const html = jsonLd({ text: "a </script><script>alert(1)</script> b" });
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(parse(html).text).toBe("a </script><script>alert(1)</script> b");
  });
});

describe("sitemap and llms.txt", () => {
  it("lists every page with its languages and the date", () => {
    const xml = buildSitemapXml(env, "2026-11-15");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const locs = attr(xml, /<loc>([^<]+)<\/loc>/g);
    expect(locs.sort()).toEqual(listPages().map((page) => `${ORIGIN}${page.path}`).sort());
    expect(xml.match(/<lastmod>2026-11-15<\/lastmod>/g)).toHaveLength(listPages().length);
    expect(xml.match(/<xhtml:link rel="alternate" hreflang="zh-Hans"/g)).toHaveLength(listPages().length);
    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(listPages().length);
  });

  it("tells the AI engines who the company is, what it offers and where the pages are", () => {
    const text = buildLlmsTxt(env);
    expect(text.startsWith("# Tecno Advance MGA Broker")).toBe(true);
    for (const needle of ["B000746484", "vies@tecnomga.com", "50,000", "36 months", `${ORIGIN}/`, `${ORIGIN}/en/`, `${ORIGIN}/zh/`]) expect(text, needle).toContain(needle);
  });

  it("is served as files next to the pages", () => {
    // The date in the sitemap is the day the contents were last checked, not the day of the build: a search engine
    // is told a page changed only when it did.
    const files = renderExtraFiles(env);
    const sitemap = files.find((file) => file.file === "sitemap.xml")?.content ?? "";
    expect(sitemap.match(new RegExp(`<lastmod>${CONTENT_UPDATED}</lastmod>`, "g"))).toHaveLength(listPages().length);
    expect(files.map((file) => file.file).sort()).toEqual(["llms.txt", "sitemap.xml"]);
  });
});
