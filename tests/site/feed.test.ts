import { describe, expect, it } from "vitest";
import { ARTICLES, AUTHOR } from "../../src/site/blog";
import { HREFLANG, LANGS, readSiteEnv, type Lang } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { plainText } from "../../src/site/inline";
import { renderExtraFiles, renderPage } from "../../src/site/render";
import { listPages, pathOf } from "../../src/site/routes";
import { buildFeed, buildLlmsTxt, buildSitemapXml, feedPath } from "../../src/site/sitemap";

const env = readSiteEnv({});
const ORIGIN = "https://portale.tecnomga.com";
const assets = { css: ["/a.css"], js: "/a.js" };
const count = (text: string, needle: string) => text.split(needle).length - 1;
const unescape = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}(?: [^>]*)?>([\\s\\S]*?)</${name}>`, "g"))].map((match) => match[1]);

describe("feed of the guides", () => {
  it("has an address for each language, next to the index of the blog", () => {
    expect(LANGS.map(feedPath)).toEqual(["/blog/feed.xml", "/en/blog/feed.xml", "/zh/blog/feed.xml"]);
  });

  it("is an Atom feed in the language of its articles, with where it lives and when it last changed", () => {
    for (const lang of LANGS) {
      const xml = buildFeed(env, lang);
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"'), lang).toBe(true);
      expect(xml, lang).toContain(`xml:lang="${HREFLANG[lang]}"`);
      expect(xml, lang).toContain(`<id>${ORIGIN}${pathOf("blog", lang)}</id>`);
      expect(xml, lang).toContain(`<link rel="self" type="application/atom+xml" href="${ORIGIN}${feedPath(lang)}"/>`);
      expect(xml, lang).toContain(`<link rel="alternate" type="text/html" href="${ORIGIN}${pathOf("blog", lang)}"/>`);
      const newest = ARTICLES.map((entry) => entry.updated).sort().at(-1);
      expect(tag(xml, "updated")[0], lang).toBe(`${newest}T00:00:00Z`);
      expect(unescape(tag(xml, "title")[0]), lang).toBe(contentFor(lang).blog.feedTitle);
    }
  });

  it("has one entry per article: title, address, dates, the direct answer as plain text and who wrote it", () => {
    for (const lang of LANGS) {
      const xml = buildFeed(env, lang);
      const entries = tag(xml, "entry");
      expect(entries, lang).toHaveLength(ARTICLES.length);
      ARTICLES.forEach((entry, index) => {
        const article = entry.content[lang];
        const url = `${ORIGIN}${pathOf(entry.id, lang)}`;
        expect(unescape(tag(entries[index], "title")[0]), `${lang} ${entry.id}`).toBe(article.h1);
        expect(entries[index], `${lang} ${entry.id}`).toContain(`<link rel="alternate" type="text/html" href="${url}"/>`);
        expect(tag(entries[index], "id"), `${lang} ${entry.id}`).toEqual([url]);
        expect(tag(entries[index], "published"), `${lang} ${entry.id}`).toEqual([`${entry.published}T00:00:00Z`]);
        expect(tag(entries[index], "updated"), `${lang} ${entry.id}`).toEqual([`${entry.updated}T00:00:00Z`]);
        expect(unescape(tag(entries[index], "summary")[0]), `${lang} ${entry.id}`).toBe(plainText(article.summary));
        expect(tag(entries[index], "name"), `${lang} ${entry.id}`).toEqual([AUTHOR.name]);
      });
    }
  });

  it("is well-formed: every special character of a text is escaped", () => {
    for (const lang of LANGS) {
      const xml = buildFeed(env, lang);
      expect(xml, lang).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
      expect(count(xml, "<entry>"), lang).toBe(count(xml, "</entry>"));
      expect(xml.trimEnd().endsWith("</feed>"), lang).toBe(true);
      // Nothing of the link syntax of the articles reaches the feed.
      expect(xml, lang).not.toMatch(/\]\((article|page|section):/);
    }
  });

  it("is served as a file for each language and announced in the head of every page of that language", () => {
    const files = renderExtraFiles(env).map((file) => file.file);
    expect(files.sort()).toEqual(["blog/feed.xml", "en/blog/feed.xml", "llms.txt", "sitemap.xml", "zh/blog/feed.xml"]);
    for (const page of listPages()) {
      const head = (renderPage(page.path, assets, env) as string).split("</head>")[0];
      expect(head, page.path).toContain(`<link rel="alternate" type="application/atom+xml" title="${contentFor(page.lang).blog.feedTitle}" href="${ORIGIN}${feedPath(page.lang)}">`);
    }
  });
});

describe("sitemap and llms.txt with the guides", () => {
  it("dates each article with the day it was last checked, and the other pages with the day given", () => {
    const xml = buildSitemapXml(env, "2020-01-01");
    const dated = new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((match) => [match[1], match[2]]));
    expect(dated.size).toBe(listPages().length);
    for (const entry of ARTICLES) for (const lang of LANGS) expect(dated.get(`${ORIGIN}${pathOf(entry.id, lang)}`), `${entry.id}/${lang}`).toBe(entry.updated);
    for (const id of ["home", "blog", "representatives", "sellers", "privacy"] as const) expect(dated.get(`${ORIGIN}${pathOf(id, "it")}`), id).toBe("2020-01-01");
    // Each article names its own translations, with the address of each language.
    const first = ARTICLES[0];
    for (const lang of LANGS as Lang[]) expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="${HREFLANG[lang]}" href="${ORIGIN}${pathOf(first.id, lang)}"/>`);
  });

  it("tells the AI engines where the guides are, who signs them and where the feed is", () => {
    const text = buildLlmsTxt(env);
    expect(text).toContain("## Guides");
    expect(text).toContain(AUTHOR.name);
    for (const entry of ARTICLES) for (const lang of LANGS) expect(text, `${entry.id}/${lang}`).toContain(`${ORIGIN}${pathOf(entry.id, lang)}`);
    for (const id of ["representatives", "sellers", "blog"] as const) expect(text, id).toContain(`${ORIGIN}${pathOf(id, "en")}`);
    expect(text).toContain(`${ORIGIN}${feedPath("en")}`);
    expect(text).not.toMatch(/\]\((article|page|section):/);
  });
});
