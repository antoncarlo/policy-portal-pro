import { describe, expect, it } from "vitest";
import { ARTICLES } from "../../src/site/blog";
import type { Block } from "../../src/site/blog/types";
import { HREFLANG, LANGS, readSiteEnv, type Lang } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { parseInline, plainText, resolveTarget } from "../../src/site/inline";
import { renderPage } from "../../src/site/render";
import { pathOf, type PageId } from "../../src/site/routes";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const env = readSiteEnv({});
const ORIGIN = "https://portale.tecnomga.com";
const AUDIENCES = ["representatives", "sellers"] as const;
const page = (id: PageId, lang: Lang) => renderPage(pathOf(id, lang), assets, env) as string;
const count = (text: string, needle: string) => text.split(needle).length - 1;
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html: string) => decode((html.split(/<body[^>]*>/)[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, ""));
interface LdNode {
  "@type"?: string;
  [key: string]: unknown;
}
const structured = (html: string): LdNode[] => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
const node = (html: string, type: string) => structured(html).find((item) => item["@type"] === type) as LdNode;
const words = (value: string) => value.trim().split(/\s+/).length;
const size = (lang: Lang, value: string) => (lang === "zh" ? value.length : words(value));
const ANSWER: Record<Lang, [number, number]> = { it: [38, 64], en: [38, 64], zh: [60, 170] };
const blockTexts = (block: Block): string[] => {
  if (block.type === "p" || block.type === "note") return [block.text];
  if (block.type === "list") return block.items;
  if (block.type === "steps") return block.items.flatMap((item) => [item.title, item.text]);
  return [...block.columns, ...block.rows.flat()];
};
/** The section of the home page with the given anchor, up to the next section. */
const section = (html: string, id: string) => html.slice(html.indexOf(`id="${id}"`)).split("</section>")[0];
const each = (run: (id: (typeof AUDIENCES)[number], lang: Lang, html: string, label: string) => void) => {
  for (const id of AUDIENCES) for (const lang of LANGS) run(id, lang, page(id, lang), `${id}/${lang}`);
};

describe("pages for each audience", () => {
  it("open with the title of the project and a direct answer of 40-60 words, with nothing above the title", () => {
    each((id, lang, html, label) => {
      const content = contentFor(lang);
      expect(count(html, "<h1"), label).toBe(1);
      expect(html, label).toMatch(/<header class="legal__hero audience-page__hero"><div class="container container--narrow"><h1 class="legal__title">/);
      const body = text(html);
      expect(body, label).toContain(content.meta[id].h1);
      const lead = content.audiencePages[id].lead;
      const [min, max] = ANSWER[lang];
      expect(size(lang, lead), `${label} lead (${size(lang, lead)})`).toBeGreaterThanOrEqual(min);
      expect(size(lang, lead), `${label} lead (${size(lang, lead)})`).toBeLessThanOrEqual(max);
      expect(body.indexOf(plainText(lead)), label).toBeGreaterThan(body.indexOf(content.meta[id].h1));
    });
  });

  it("write each section under its own anchor, with only the title above the text", () => {
    each((id, lang, html, label) => {
      const sections = contentFor(lang).audiencePages[id].sections;
      expect(sections.length, label).toBeGreaterThanOrEqual(3);
      for (const item of sections) expect(decode(html.match(new RegExp(`<section id="${item.id}"><h2>(.*?)</h2><(\\w+)`))?.[1] ?? ""), `${label} #${item.id}`).toBe(item.heading);
    });
  });

  it("link only pages that exist, at least three of them, and invite the reader to write", () => {
    each((id, lang, html, label) => {
      const audience = contentFor(lang).audiencePages[id];
      const texts = [audience.lead, ...audience.sections.flatMap((item) => item.blocks.flatMap(blockTexts)), ...audience.faq.map((item) => item.a)];
      const links = texts.flatMap((value) => parseInline(value).filter((part): part is { label: string; target: string } => typeof part !== "string"));
      for (const link of links) expect(resolveTarget(link.target, lang), `${label}: [${link.label}](${link.target})`).not.toBeNull();
      expect(new Set(links.map((link) => link.target)).size, label).toBeGreaterThanOrEqual(3);
      expect(html, label).toContain(`href="${pathOf("home", lang)}#contatti"`);
      expect(text(html), label).not.toMatch(/\]\((article|page|section|https):/);
    });
  });

  it("answer at least three questions in 40-60 words, the same in the page and in the structured data", () => {
    each((id, lang, html, label) => {
      const { faq } = contentFor(lang).audiencePages[id];
      expect(faq.length, label).toBeGreaterThanOrEqual(3);
      for (const item of faq) {
        const [min, max] = ANSWER[lang];
        expect(size(lang, item.a), `${label} «${item.q}» (${size(lang, item.a)})`).toBeGreaterThanOrEqual(min);
        expect(size(lang, item.a), `${label} «${item.q}» (${size(lang, item.a)})`).toBeLessThanOrEqual(max);
        expect(text(html), label).toContain(plainText(item.a));
      }
      expect((node(html, "FAQPage").mainEntity as Array<{ name: string }>).map((item) => item.name), label).toEqual(faq.map((item) => item.q));
    });
  });

  it("show the guides written for that reader, and say the page is general information", () => {
    each((_id, lang, html, label) => {
      const cards = ARTICLES.filter((entry) => html.includes(`<a href="${pathOf(entry.id, lang)}">`));
      expect(cards.length, label).toBeGreaterThanOrEqual(1);
      expect(html, label).toMatch(new RegExp(`<a class="link-arrow" href="${pathOf("blog", lang)}">`));
      expect(text(html), label).toContain(contentFor(lang).whatIs.disclaimer);
    });
  });

  it("present themselves to search engines as a service of the intermediary, with questions and the path from the home page", () => {
    each((id, lang, html, label) => {
      const url = `${ORIGIN}${pathOf(id, lang)}`;
      expect(node(html, "Service"), label).toMatchObject({ url, inLanguage: HREFLANG[lang], provider: { "@id": `${ORIGIN}/#organization` } });
      expect((node(html, "BreadcrumbList").itemListElement as Array<{ item: string }>).map((item) => item.item), label).toEqual([`${ORIGIN}${pathOf("home", lang)}`, url]);
    });
  });
});

describe("home page: the way to the new pages", () => {
  it("links the page of each audience from its box", () => {
    for (const lang of LANGS) {
      const box = section(page("home", lang), "per-chi");
      const { items } = contentFor(lang).audiences;
      expect(decode(box), lang).toContain(`href="${pathOf("representatives", lang)}">${items[0].more}`);
      expect(decode(box), lang).toContain(`href="${pathOf("sellers", lang)}">${items[1].more}`);
    }
  });

  it("shows up to three guides before the contact form, with the link to all of them", () => {
    for (const lang of LANGS) {
      const html = page("home", lang);
      const guides = section(html, "guide");
      const shown = count(guides, '<article class="guide-card ');
      expect(shown, lang).toBe(Math.min(3, ARTICLES.length));
      expect(decode(guides), lang).toContain(`<h2 class="section__title">${contentFor(lang).blog.latestTitle}</h2>`);
      expect(guides, lang).toContain(`href="${pathOf("blog", lang)}"`);
      expect(html.indexOf('id="guide"'), lang).toBeLessThan(html.indexOf('id="contatti"'));
      expect(html.indexOf('id="guide"'), lang).toBeGreaterThan(html.indexOf('id="domande"'));
    }
  });

  it("puts the guides in the bar and in the footer of every page", () => {
    for (const lang of LANGS) {
      for (const id of ["home", "blog", "privacy", "representatives", "garanzia-vies"] as PageId[]) {
        const html = page(id, lang);
        const header = html.split("</header>")[0];
        const footer = html.slice(html.indexOf('<footer class="site-footer"'));
        expect(decode(header), `${lang} ${id}`).toContain(`href="${pathOf("blog", lang)}"`);
        for (const target of ["blog", "representatives", "sellers"] as const) expect(footer, `${lang} ${id} footer ${target}`).toContain(`href="${pathOf(target, lang)}"`);
      }
    }
  });
});
