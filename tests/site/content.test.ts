import { describe, expect, it } from "vitest";
import { COMPANY, LANGS, readSiteEnv, type Lang } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { ANCHORS } from "../../src/site/content/types";
import { renderAll, renderPage } from "../../src/site/render";
import { pathOf } from "../../src/site/routes";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const env = readSiteEnv({});
const home = (lang: Lang) => renderPage(pathOf("home", lang), assets, env) as string;
const count = (text: string, needle: string) => text.split(needle).length - 1;

/** The structure of a content tree: same keys, same list lengths, a type for each leaf. */
const shape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, shape(item)]));
  return typeof value;
};
const strings = (value: unknown, path = ""): Array<[string, string]> => {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => strings(item, path ? `${path}.${key}` : key));
  return [];
};
/** The JSON-LD blocks of a page. */
const structured = (html: string): Array<Record<string, unknown>> =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
const words = (text: string) => text.trim().split(/\s+/).length;
/** The text of the H1, without the tags inside it. */
const h1Text = (html: string) => (html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] ?? "").replace(/<[^>]+>/g, "");
const HAN = /[一-鿿]/;

describe("public site: the texts of the three languages", () => {
  it("have the same keys and the same list lengths, so no page comes out with a piece missing", () => {
    const italian = shape(contentFor("it"));
    expect(shape(contentFor("en"))).toEqual(italian);
    expect(shape(contentFor("zh"))).toEqual(italian);
  });

  it("have no empty text", () => {
    for (const lang of LANGS) {
      const empty = strings(contentFor(lang)).filter(([, text]) => text.trim() === "").map(([path]) => `${lang}:${path}`);
      expect(empty).toEqual([]);
    }
  });

  it("the Chinese texts are in Chinese: the H1 and every section title", () => {
    const zh = contentFor("zh");
    expect(zh.meta.home.h1).toMatch(HAN);
    for (const title of [zh.whatIs.title, zh.audiences.title, zh.steps.title, zh.portal.title, zh.documents.title, zh.cost.title, zh.faq.title, zh.contact.title]) expect(title).toMatch(HAN);
    expect(h1Text(home("zh"))).toMatch(HAN);
  });

  it("answer each frequent question in 40-60 words, the length an answer engine quotes whole", () => {
    for (const lang of LANGS) {
      const { items } = contentFor(lang).faq;
      expect(items.length).toBeGreaterThanOrEqual(8);
      expect(items.length).toBeLessThanOrEqual(10);
      for (const item of items) {
        // Chinese has no spaces between words: there the measure is in characters.
        const size = lang === "zh" ? item.a.length : words(item.a);
        const [min, max] = lang === "zh" ? [60, 170] : [38, 64];
        expect(size, `${lang}: ${item.q} (${size})`).toBeGreaterThanOrEqual(min);
        expect(size, `${lang}: ${item.q} (${size})`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("link the legal statements to primary sources only", () => {
    const official = /^https:\/\/(www\.agenziaentrate\.gov\.it|www\.normattiva\.it|www\.fiscooggi\.it|ec\.europa\.eu)\//;
    for (const lang of LANGS) {
      const { sources } = contentFor(lang).whatIs;
      expect(sources.length).toBeGreaterThanOrEqual(4);
      for (const source of sources) expect(source.href, `${lang}: ${source.label}`).toMatch(official);
    }
  });
});

describe("public site: the home page", () => {
  it("carries the eight sections under the same anchors in every language, each reachable from the menu", () => {
    expect(ANCHORS).toEqual(["cos-e", "per-chi", "come-funziona", "portale", "documenti", "costo", "domande", "contatti"]);
    for (const lang of LANGS) {
      const html = home(lang);
      for (const anchor of ANCHORS) {
        expect(count(html, `id="${anchor}"`), `${lang}: #${anchor}`).toBe(1);
        expect(html, `${lang}: menu → #${anchor}`).toContain(`href="#${anchor}"`);
      }
    }
  });

  it("has the H1 of the project, one only, and the five steps in order", () => {
    for (const lang of LANGS) {
      const html = home(lang);
      expect(count(html, "<h1")).toBe(1);
      expect(h1Text(html)).toBe(contentFor(lang).meta.home.h1);
      expect(count(html, "data-step=")).toBe(5);
      expect(html.indexOf('data-step="1"')).toBeLessThan(html.indexOf('data-step="5"'));
    }
    expect(h1Text(home("it"))).toBe("Fideiussione VIES per soggetti non residenti");
    // A hyphenated word is kept on one line, without changing the text of the title.
    expect(home("en")).toContain('<span class="nowrap">non-EU</span>');
  });

  it("shows who the intermediary is and how to reach it, in the HTML itself", () => {
    for (const lang of LANGS) {
      const html = home(lang);
      for (const fact of [COMPANY.name, COMPANY.rui, COMPANY.vat, COMPANY.pec, COMPANY.email, COMPANY.phone, COMPANY.legalSeat.street, COMPANY.office.street]) {
        expect(html, `${lang}: ${fact}`).toContain(fact);
      }
      expect(html).toContain(`href="mailto:${COMPANY.email}"`);
      expect(html).toContain(`href="tel:${COMPANY.phoneE164}"`);
    }
  });

  it("states the rule with today's article and the one that replaces it in 2027", () => {
    for (const lang of LANGS) {
      const html = home(lang);
      expect(html).toContain("7-quater");
      expect(html).toContain("633/1972");
      expect(html).toContain("10/2026");
      expect(html).toContain("178713/2025");
    }
  });

  it("links the other languages, the reserved area and the contact form from the header", () => {
    for (const lang of LANGS) {
      const html = home(lang);
      for (const other of LANGS) expect(html).toMatch(new RegExp(`<a[^>]*href="${pathOf("home", other)}"[^>]*data-testid="site-lang-${other}"`));
      expect(html).toMatch(new RegExp(`data-testid="site-lang-${lang}"[^>]*aria-current="page"|aria-current="page"[^>]*data-testid="site-lang-${lang}"`));
      expect(html).toMatch(/<a[^>]*href="\/auth"[^>]*data-testid="site-portal-link"/);
      expect(html).toContain('data-testid="site-hero"');
      expect(html).toContain('data-testid="site-nav"');
      expect(html).toContain('data-testid="site-menu-toggle"');
    }
  });

  it("tells search and answer engines the questions and the steps it contains", () => {
    for (const lang of LANGS) {
      const blocks = structured(home(lang));
      const faq = blocks.find((block) => block["@type"] === "FAQPage") as { mainEntity: unknown[] } | undefined;
      const howTo = blocks.find((block) => block["@type"] === "HowTo") as { step: unknown[] } | undefined;
      expect(faq?.mainEntity).toHaveLength(contentFor(lang).faq.items.length);
      expect(howTo?.step).toHaveLength(5);
      // Every question in the data is a question the reader sees on the page.
      for (const item of contentFor(lang).faq.items) expect(home(lang)).toContain(item.q.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    }
  });

  it("has enough text to be read without JavaScript: at least 1,500 characters in the body", () => {
    for (const lang of LANGS) {
      const body = home(lang).split("<body")[1].replace(/<script.*?<\/script>/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      expect(body.length, lang).toBeGreaterThan(lang === "zh" ? 1500 : 4000);
    }
  });
});

describe("public site: every page", () => {
  const pages = renderAll(assets, env);

  it("publishes no insurer's name, no price and no real practice", () => {
    for (const page of pages) {
      expect(page.html, page.path).not.toMatch(/markel/i);
      expect(page.html, page.path).not.toContain("€ 2.000");
      expect(page.html, page.path).not.toContain("2.000,00");
      expect(page.html, page.path).not.toContain("VIES-20");
    }
  });

  it("declares alternative text and size of every image", () => {
    for (const page of pages) {
      for (const [tag] of page.html.matchAll(/<img\b[^>]*>/g)) {
        expect(tag, page.path).toMatch(/\salt="/);
        expect(tag, page.path).toMatch(/\swidth="\d+"/);
        expect(tag, page.path).toMatch(/\sheight="\d+"/);
      }
    }
  });

  it("never says «click here»: every link says where it goes", () => {
    for (const page of pages) {
      expect(page.html, page.path).not.toMatch(/clicca qui|click here|点击这里|點擊這裡/i);
      for (const [, label] of page.html.matchAll(/<a\b[^>]*>(.*?)<\/a>/gs)) {
        const text = label.replace(/<[^>]+>/g, "").trim();
        const named = text.length > 0 || /aria-label="[^"]+"/.test(label) || /<img\b[^>]*alt="[^"]+"/.test(label);
        expect(named, `${page.path}: link senza testo`).toBe(true);
      }
    }
  });

  it("opens external links in a new tab without handing over the window", () => {
    for (const page of pages) {
      for (const [tag] of page.html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)) {
        if (/target="_blank"/.test(tag)) expect(tag, page.path).toMatch(/rel="[^"]*noopener/);
      }
    }
  });

  it("has header, main content and footer with the advertising notice", () => {
    for (const page of pages) {
      expect(page.html, page.path).toContain("<header");
      expect(page.html, page.path).toContain('<main id="contenuto"');
      expect(page.html, page.path).toContain("<footer");
      expect(count(page.html, "<h1"), page.path).toBe(1);
    }
    expect(home("it")).toContain("Messaggio pubblicitario con finalità promozionale. Prima della sottoscrizione leggere il set informativo.");
  });
});
