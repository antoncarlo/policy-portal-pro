import { describe, expect, it } from "vitest";
import { ARTICLES, AUTHOR } from "../../src/site/blog";
import { HREFLANG, LANGS, readSiteEnv, type Lang } from "../../src/site/config";
import { contentFor } from "../../src/site/content";
import { plainText } from "../../src/site/inline";
import { renderPage } from "../../src/site/render";
import { pathOf, type PageId } from "../../src/site/routes";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const env = readSiteEnv({});
const ORIGIN = "https://portale.tecnomga.com";
const page = (id: PageId, lang: Lang) => renderPage(pathOf(id, lang), assets, env) as string;
const count = (text: string, needle: string) => text.split(needle).length - 1;
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** What a reader sees of the body: no tags, no data blocks. */
const text = (html: string) => decode((html.split(/<body[^>]*>/)[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, ""));
const structured = (html: string): Array<Record<string, any>> => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
const node = (html: string, type: string) => structured(html).find((item) => item["@type"] === type) as Record<string, any>;
const each = (run: (entry: (typeof ARTICLES)[number], lang: Lang, html: string, label: string) => void) => {
  for (const entry of ARTICLES) for (const lang of LANGS) run(entry, lang, page(entry.id, lang), `${entry.id}/${lang}`);
};

describe("blog: the page of an article", () => {
  it("opens with the title alone, then who wrote it and when, then the direct answer", () => {
    each((entry, lang, html, label) => {
      const article = entry.content[lang];
      expect(count(html, "<h1"), label).toBe(1);
      // Nothing above the title: the H1 is the first thing in the opening band.
      expect(html, label).toMatch(/<header class="legal__hero article__hero"><div class="container container--narrow"><h1 class="legal__title">/);
      const body = text(html);
      expect(body, label).toContain(article.h1);
      const byline = html.match(/<p class="article__byline">([\s\S]*?)<\/p>/)?.[1] ?? "";
      expect(byline, label).toContain(AUTHOR.name);
      expect(byline.toLowerCase(), label).toContain(`<time datetime="${entry.published}"`);
      const summary = body.indexOf(plainText(article.summary));
      expect(summary, `${label}: summary`).toBeGreaterThan(body.indexOf(article.h1));
      expect(summary, `${label}: summary before the first section`).toBeLessThan(body.indexOf(article.sections[0].heading));
    });
  });

  it("writes each section under its own anchor, with only the title above the text", () => {
    each((entry, lang, html, label) => {
      for (const section of entry.content[lang].sections) {
        const heading = decode(html.match(new RegExp(`<section id="${section.id}"><h2>(.*?)</h2><(\\w+)`))?.[1] ?? "");
        expect(heading, `${label} #${section.id}`).toBe(section.heading);
      }
    });
  });

  it("turns the links of the text into links of the site, and never shows their syntax", () => {
    const html = page("garanzia-vies", "it");
    expect(html).toContain('<a href="/venditori-esteri/">garanzia VIES per le società extra UE</a>');
    expect(html).toContain('<a href="/rappresentanti-fiscali/">fideiussioni VIES per rappresentanti fiscali</a>');
    expect(html).toContain('<a href="/#costo">quanto costa la fideiussione VIES</a>');
    expect(page("garanzia-vies", "en")).toContain('<a href="/en/fiscal-representatives/">VIES surety bonds for fiscal representatives</a>');
    each((_entry, _lang, page, label) => expect(text(page), label).not.toMatch(/\]\((article|page|section|https):/));
  });

  it("writes tables with a header row and a header cell per row, and steps as a numbered list", () => {
    const html = page("garanzia-vies", "it");
    expect(html).toContain('<th scope="col">Elemento</th>');
    expect(html).toContain('<th scope="row">Importo</th>');
    expect(html).toContain('<td data-label="Regola">Valore massimale minimo di 50.000 euro.</td>');
    expect(html).toMatch(/<ol class="article-steps">\s*<li><strong>Consegna<\/strong>/);
  });

  it("answers the frequent questions in the page and in the structured data with the same words", () => {
    each((entry, lang, html, label) => {
      const article = entry.content[lang];
      const faq = node(html, "FAQPage");
      expect(faq.mainEntity.map((item: any) => [item.name, item.acceptedAnswer.text]), label).toEqual(article.faq.map((item) => [item.q, plainText(item.a)]));
      const body = text(html);
      for (const item of article.faq) {
        expect(body, `${label}: ${item.q}`).toContain(item.q);
        expect(body, `${label}: ${item.q}`).toContain(plainText(item.a));
      }
    });
  });

  it("lists its official sources, opened in a new tab, and says it is general information checked on a date", () => {
    each((entry, lang, html, label) => {
      for (const source of entry.content[lang].sources) expect(decode(html), `${label}: ${source.href}`).toContain(`<a href="${source.href}" target="_blank" rel="noopener noreferrer">`);
      expect(text(html), label).toContain(contentFor(lang).whatIs.disclaimer);
      expect(html.toLowerCase(), label).toContain(`<time datetime="${entry.updated}"`);
    });
  });

  it("sends the reader on: to the contact form and to the index of the guides", () => {
    each((_entry, lang, html, label) => {
      expect(html, label).toContain(`href="${pathOf("home", lang)}#contatti"`);
      expect(html, label).toMatch(new RegExp(`<a class="link-arrow" href="${pathOf("blog", lang)}">`));
    });
  });

  it("presents itself to search engines as an article signed by a person and published by the intermediary", () => {
    each((entry, lang, html, label) => {
      const article = entry.content[lang];
      const url = `${ORIGIN}${pathOf(entry.id, lang)}`;
      const post = node(html, "BlogPosting");
      expect(post, label).toMatchObject({
        headline: article.h1,
        description: article.description,
        inLanguage: HREFLANG[lang],
        datePublished: entry.published,
        dateModified: entry.updated,
        author: { "@type": "Person", name: AUTHOR.name },
        publisher: { "@id": `${ORIGIN}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: `${ORIGIN}/site-media/og-${lang}.png`,
      });
      expect(post.citation, label).toEqual(article.sources.map((source) => source.href));
      const crumbs = node(html, "BreadcrumbList").itemListElement.map((item: any) => [item.position, item.name, item.item]);
      expect(crumbs, label).toEqual([
        [1, contentFor(lang).meta.home.label, `${ORIGIN}${pathOf("home", lang)}`],
        [2, contentFor(lang).meta.blog.label, `${ORIGIN}${pathOf("blog", lang)}`],
        [3, article.label, url],
      ]);
    });
  });

  it("has the head of an article: its own address, the same article in the other languages, author and dates", () => {
    each((entry, lang, html, label) => {
      const head = decode(html.split("</head>")[0]);
      expect(head, label).toContain(`<title>${entry.content[lang].title}</title>`);
      expect(head, label).toContain(`<link rel="canonical" href="${ORIGIN}${pathOf(entry.id, lang)}">`);
      for (const other of LANGS) expect(head, label).toContain(`<link rel="alternate" hreflang="${HREFLANG[other]}" href="${ORIGIN}${pathOf(entry.id, other)}">`);
      expect(head, label).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathOf(entry.id, "en")}">`);
      expect(head, label).toContain('<meta property="og:type" content="article">');
      expect(head, label).toContain(`<meta property="article:published_time" content="${entry.published}">`);
      expect(head, label).toContain(`<meta property="article:modified_time" content="${entry.updated}">`);
      expect(head, label).toContain(`<meta name="author" content="${AUTHOR.name}">`);
    });
    expect(page("home", "it")).toContain('<meta property="og:type" content="website">');
    expect(page("home", "it")).not.toContain("article:published_time");
  });

  it("lets the reader change language without losing the article", () => {
    const html = page("garanzia-vies", "it");
    expect(html).toMatch(/<a href="\/en\/blog\/vies-guarantee-italy-explained\/" data-testid="site-lang-en"/);
    expect(html).toMatch(/<a href="\/zh\/blog\/vies-guarantee-italy-explained\/" data-testid="site-lang-zh"/);
    expect(page("garanzia-vies", "en")).toMatch(/<a href="\/blog\/garanzia-vies-cos-e-chi-deve-prestarla\/" data-testid="site-lang-it"/);
  });
});

describe("blog: the index of the guides", () => {
  it("has the title of the project and one card per article, linked with the title of the article", () => {
    for (const lang of LANGS) {
      const html = page("blog", lang);
      expect(count(html, "<h1"), lang).toBe(1);
      expect(text(html), lang).toContain(contentFor(lang).meta.blog.h1);
      expect(count(html, '<article class="guide-card '), lang).toBe(ARTICLES.length);
      for (const entry of ARTICLES) {
        const link = decode(html).match(new RegExp(`<a href="${pathOf(entry.id, lang)}">(.*?)</a>`))?.[1];
        expect(link, `${lang}: ${entry.id}`).toBe(entry.content[lang].h1);
        expect(text(html), `${lang}: ${entry.id}`).toContain(entry.content[lang].description);
      }
    }
  });

  it("presents itself to search engines as a blog with its posts", () => {
    for (const lang of LANGS) {
      const html = page("blog", lang);
      const blog = node(html, "Blog");
      expect(blog, lang).toMatchObject({ url: `${ORIGIN}${pathOf("blog", lang)}`, inLanguage: HREFLANG[lang], publisher: { "@id": `${ORIGIN}/#organization` } });
      expect(blog.blogPost.map((post: any) => post.url), lang).toEqual(ARTICLES.map((entry) => `${ORIGIN}${pathOf(entry.id, lang)}`));
      expect(node(html, "BreadcrumbList").itemListElement, lang).toHaveLength(2);
    }
  });
});
