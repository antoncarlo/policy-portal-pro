import { describe, expect, it } from "vitest";
import { ARTICLES, ARTICLE_IDS, AUTHOR, articleOf } from "../../src/site/blog";
import type { Article, ArticleEntry, Block } from "../../src/site/blog/types";
import { LANGS, type Lang } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { parseInline, resolveTarget } from "../../src/site/inline";
import { metaOf } from "../../src/site/meta";
import { findPage, isArticleId, listPages, pageKind, pathOf } from "../../src/site/routes";

const words = (text: string) => text.trim().split(/\s+/).length;
const HAN = /[一-鿿]/;
/** Chinese has no spaces between words: there a text is measured in characters. */
const size = (lang: Lang, text: string) => (lang === "zh" ? text.length : words(text));
const ANSWER: Record<Lang, [number, number]> = { it: [38, 64], en: [38, 64], zh: [60, 170] };
const TITLE: Record<Lang, [number, number]> = { it: [50, 60], en: [50, 60], zh: [15, 34] };
const DESCRIPTION: Record<Lang, [number, number]> = { it: [150, 160], en: [150, 160], zh: [50, 80] };
const within = (value: number, [min, max]: [number, number], label: string) => {
  expect(value, `${label} (${value})`).toBeGreaterThanOrEqual(min);
  expect(value, `${label} (${value})`).toBeLessThanOrEqual(max);
};

/** Every text a reader sees in the body of an article. */
const blockTexts = (block: Block): string[] => {
  if (block.type === "p" || block.type === "note") return [block.text];
  if (block.type === "list") return block.items;
  if (block.type === "steps") return block.items.flatMap((item) => [item.title, item.text]);
  return [...block.columns, ...block.rows.flat()];
};
const bodyTexts = (article: Article): string[] => [article.summary, ...article.sections.flatMap((section) => [section.heading, ...section.blocks.flatMap(blockTexts)]), ...article.faq.flatMap((item) => [item.q, item.a])];
const linksOf = (article: Article) => bodyTexts(article).flatMap((text) => parseInline(text).filter((part): part is { label: string; target: string } => typeof part !== "string"));
/** What must be identical in the three languages: sections, kinds of blocks, numbers of rows and items. */
const outline = (article: Article) => ({
  sections: article.sections.map((section) => ({
    id: section.id,
    blocks: section.blocks.map((block) => {
      if (block.type === "list" || block.type === "steps") return `${block.type}:${block.items.length}`;
      if (block.type === "table") return `table:${block.columns.length}x${block.rows.length}`;
      return block.type;
    }),
  })),
  faq: article.faq.length,
  sources: article.sources.map((source) => source.href),
});
const each = (run: (entry: ArticleEntry, lang: Lang, article: Article, label: string) => void) => {
  for (const entry of ARTICLES) for (const lang of LANGS) run(entry, lang, entry.content[lang], `${entry.id}/${lang}`);
};

/** The only amounts an article may quote: the ones the law sets. Everything else would be a price. */
const LEGAL_AMOUNTS = new Set(["50000", "30000", "100000", "300000", "1000000", "2000000"]);
const amounts = (text: string): string[] => [
  ...[...text.matchAll(/(?:€|EUR)\s?(\d[\d.,]*)/g)].map((match) => match[1]),
  ...[...text.matchAll(/(\d[\d.,]*)\s?(?:euro|EUR|€)/gi)].map((match) => match[1]),
].map((value) => value.replace(/[.,]/g, ""));
const zhAmounts = (text: string): string[] => [...text.matchAll(/(\d+)万欧元/g)].map((match) => `${match[1]}0000`);
const OFFICIAL = /^https:\/\/(www\.agenziaentrate\.gov\.it|www\.normattiva\.it|www\.fiscooggi\.it|ec\.europa\.eu|eur-lex\.europa\.eu|www\.agid\.gov\.it|www\.gazzettaufficiale\.it|www\.ivass\.it)\//;

describe("blog: the pages and their paths", () => {
  it("gives the pages for each audience and the blog index a path of their own in each language", () => {
    expect(pathOf("representatives", "it")).toBe("/rappresentanti-fiscali/");
    expect(pathOf("representatives", "en")).toBe("/en/fiscal-representatives/");
    expect(pathOf("representatives", "zh")).toBe("/zh/fiscal-representatives/");
    expect(pathOf("sellers", "it")).toBe("/venditori-esteri/");
    expect(pathOf("sellers", "en")).toBe("/en/non-eu-sellers/");
    expect(pathOf("sellers", "zh")).toBe("/zh/non-eu-sellers/");
    expect(LANGS.map((lang) => pathOf("blog", lang))).toEqual(["/blog/", "/en/blog/", "/zh/blog/"]);
  });

  it("puts each article under the blog of its language, with the segment written in that language", () => {
    expect(pathOf("garanzia-vies", "it")).toBe("/blog/garanzia-vies-cos-e-chi-deve-prestarla/");
    expect(pathOf("garanzia-vies", "en")).toBe("/en/blog/vies-guarantee-italy-explained/");
    expect(pathOf("garanzia-vies", "zh")).toBe("/zh/blog/vies-guarantee-italy-explained/");
    expect(findPage("/en/blog/vies-guarantee-italy-explained")).toEqual({ id: "garanzia-vies", lang: "en", path: "/en/blog/vies-guarantee-italy-explained/" });
    expect(findPage("/blog/vies-guarantee-italy-explained/")).toBeNull();
    expect(findPage("/blog/nessun-articolo/")).toBeNull();
  });

  it("lists every page once: six fixed pages and each article, in the three languages", () => {
    const paths = listPages().map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength((6 + ARTICLES.length) * LANGS.length);
  });

  it("knows what kind of page each one is", () => {
    expect(pageKind("home")).toBe("home");
    expect(pageKind("representatives")).toBe("audience");
    expect(pageKind("sellers")).toBe("audience");
    expect(pageKind("blog")).toBe("blog");
    expect(pageKind("privacy")).toBe("legal");
    expect(pageKind("garanzia-vies")).toBe("article");
    expect(isArticleId("garanzia-vies")).toBe(true);
    expect(isArticleId("blog")).toBe(false);
  });

  it("takes the title and the description of an article from the article, and those of the other pages from the site's texts", () => {
    const article = articleOf("garanzia-vies").content.en;
    expect(metaOf({ id: "garanzia-vies", lang: "en", path: pathOf("garanzia-vies", "en") })).toEqual({ title: article.title, description: article.description, h1: article.h1, label: article.label });
    expect(metaOf({ id: "blog", lang: "it", path: "/blog/" })).toEqual(contentFor("it").meta.blog);
  });
});

describe("blog: links written inside a text", () => {
  it("reads «[text](target)» and leaves the rest of the sentence as it is", () => {
    expect(parseInline("Leggi [la guida](article:garanzia-vies) e poi scrivici.")).toEqual(["Leggi ", { label: "la guida", target: "article:garanzia-vies" }, " e poi scrivici."]);
    expect(parseInline("Nessun collegamento (solo parentesi) [e quadre].")).toEqual(["Nessun collegamento (solo parentesi) [e quadre]."]);
  });

  it("turns a target into the address of the page in the reader's language", () => {
    expect(resolveTarget("article:garanzia-vies", "en")).toEqual({ href: "/en/blog/vies-guarantee-italy-explained/", external: false });
    expect(resolveTarget("page:representatives", "it")).toEqual({ href: "/rappresentanti-fiscali/", external: false });
    expect(resolveTarget("page:blog", "zh")).toEqual({ href: "/zh/blog/", external: false });
    expect(resolveTarget("section:contatti", "en")).toEqual({ href: "/en/#contatti", external: false });
    expect(resolveTarget("https://www.normattiva.it/x", "it")).toEqual({ href: "https://www.normattiva.it/x", external: true });
  });

  it("refuses a target that does not exist or is not a safe address, so a broken link fails the tests instead of going online", () => {
    for (const target of ["article:nessuno", "page:dashboard", "section:inesistente", "http://www.example.com/", "javascript:alert(1)", "/dashboard", ""]) expect(resolveTarget(target, "it"), target).toBeNull();
  });
});

describe("blog: every article, in the three languages", () => {
  it("is one of the articles of the project and is signed by its author", () => {
    expect(ARTICLES.map((entry) => entry.id)).toEqual(ARTICLE_IDS.filter((id) => ARTICLES.some((entry) => entry.id === id)));
    expect(ARTICLES.length).toBeGreaterThan(0);
    expect(AUTHOR.name).toBe("Anton Carlo Santoro");
  });

  it("has a short address in lowercase with hyphens, different from every other article", () => {
    for (const lang of LANGS) {
      const slugs = ARTICLES.map((entry) => entry.content[lang].slug);
      expect(new Set(slugs).size, lang).toBe(slugs.length);
      for (const slug of slugs) expect(slug, lang).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    // The Chinese pages reuse the English segment: a segment in Chinese characters would be escaped in every link.
    for (const entry of ARTICLES) expect(entry.content.zh.slug, entry.id).toBe(entry.content.en.slug);
  });

  it("has a title and a description of the length the search results show, with its keyword in the title or the H1", () => {
    each((_entry, lang, article, label) => {
      within(article.title.length, TITLE[lang], `${label} title «${article.title}»`);
      within(article.description.length, DESCRIPTION[lang], `${label} description`);
      expect(`${article.title} ${article.h1}`.toLowerCase(), `${label} keyword «${article.keyword}»`).toContain(article.keyword.toLowerCase());
      if (lang === "zh") for (const text of [article.title, article.h1, article.label, article.summary]) expect(text, label).toMatch(HAN);
    });
  });

  it("opens with a direct answer of 40-60 words, and answers at least three questions the same way", () => {
    each((_entry, lang, article, label) => {
      within(size(lang, article.summary), ANSWER[lang], `${label} summary`);
      expect(article.faq.length, label).toBeGreaterThanOrEqual(3);
      for (const item of article.faq) within(size(lang, item.a), ANSWER[lang], `${label} «${item.q}»`);
    });
  });

  it("has the same sections, the same kinds of blocks and the same sources in the three languages", () => {
    for (const entry of ARTICLES) {
      const italian = outline(entry.content.it);
      expect(italian.sections.length, entry.id).toBeGreaterThanOrEqual(4);
      expect(new Set(italian.sections.map((section) => section.id)).size, entry.id).toBe(italian.sections.length);
      for (const section of italian.sections) expect(section.id, entry.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(outline(entry.content.en), `${entry.id}/en`).toEqual(italian);
      expect(outline(entry.content.zh), `${entry.id}/zh`).toEqual(italian);
    }
  });

  it("has no empty text and no table row of the wrong width", () => {
    each((_entry, _lang, article, label) => {
      for (const text of [article.title, article.description, article.h1, article.label, article.keyword, ...bodyTexts(article), ...article.sources.map((source) => source.label)]) expect(text.trim(), label).not.toBe("");
      for (const section of article.sections) for (const block of section.blocks) if (block.type === "table") for (const row of block.rows) expect(row.length, `${label} #${section.id}`).toBe(block.columns.length);
    });
  });

  it("links at least three other pages of the site, and every link leads somewhere", () => {
    each((_entry, lang, article, label) => {
      const links = linksOf(article);
      for (const link of links) expect(resolveTarget(link.target, lang), `${label}: [${link.label}](${link.target})`).not.toBeNull();
      const internal = new Set(links.filter((link) => !link.target.startsWith("https://")).map((link) => link.target));
      expect(internal.size, `${label}: internal links`).toBeGreaterThanOrEqual(3);
      // The text of a link says where it leads.
      for (const link of links) expect(link.label.trim().length, `${label}: ${link.target}`).toBeGreaterThanOrEqual(lang === "zh" ? 2 : 8);
    });
  });

  it("rests on official sources only", () => {
    each((_entry, _lang, article, label) => {
      expect(article.sources.length, label).toBeGreaterThanOrEqual(2);
      for (const source of article.sources) expect(source.href, `${label}: ${source.label}`).toMatch(OFFICIAL);
    });
  });

  it("names no insurer and quotes no amount but the ones the law sets", () => {
    each((_entry, lang, article, label) => {
      const text = [article.title, article.description, ...bodyTexts(article)].join("\n");
      expect(text, label).not.toMatch(/markel/i);
      for (const amount of [...amounts(text), ...(lang === "zh" ? zhAmounts(text) : [])]) expect(LEGAL_AMOUNTS.has(amount), `${label}: amount ${amount}`).toBe(true);
    });
  });

  it("has its dates and points to other articles of the project, never to itself", () => {
    for (const entry of ARTICLES) {
      expect(entry.published, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.updated >= entry.published, entry.id).toBe(true);
      expect(entry.related, entry.id).not.toContain(entry.id);
      for (const id of entry.related) expect(ARTICLE_IDS, entry.id).toContain(id);
    }
  });
});
