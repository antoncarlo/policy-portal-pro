import { describe, expect, it } from "vitest";
import { readSiteEnv } from "../../src/site/config";
import { listPages } from "../../src/site/routes";
import { renderAll, renderPage } from "../../src/site/render";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const env = readSiteEnv({});
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("public site: pages rendered to complete HTML", () => {
  it("lists the nine pages of the first delivery, each with its own path", () => {
    const pages = listPages();
    expect(pages).toHaveLength(9);
    expect(new Set(pages.map((page) => page.path)).size).toBe(9);
    expect(pages.map((page) => page.path)).toEqual(expect.arrayContaining(["/", "/en/", "/zh/", "/privacy/", "/en/privacy/", "/zh/privacy/", "/cookie/", "/en/cookie/", "/zh/cookie/"]));
  });

  it("renders the Italian home page as a full document with one H1 and the site's assets", () => {
    const html = renderPage("/", assets, env) as string;
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="it"');
    expect(count(html, "<h1")).toBe(1);
    expect(html).toContain('<link rel="stylesheet" href="/assets/site-abc.css"');
    expect(html).toContain('<script type="module" src="/assets/site-abc.js"');
  });

  it("serves a page with or without the trailing slash, in its own language", () => {
    expect(renderPage("/en", assets, env)).toBe(renderPage("/en/", assets, env));
    expect(renderPage("/en/", assets, env)).toContain('<html lang="en"');
    expect(renderPage("/zh/", assets, env)).toContain('<html lang="zh-Hans"');
    expect(renderPage("/privacy", assets, env)).toContain('<html lang="it"');
  });

  it("asks the browser for the fonts of the first screen right away, so the title does not jump when they arrive", () => {
    const fonts = { heading: "/assets/lora-latin-600-normal-abc.woff2", body: "/assets/inter-latin-400-normal-abc.woff2" };
    const preload = (href: string) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`;
    const italian = renderPage("/", { ...assets, fonts }, env) as string;
    expect(italian).toContain(preload(fonts.heading));
    expect(italian).toContain(preload(fonts.body));
    expect(italian.indexOf(preload(fonts.heading))).toBeLessThan(italian.indexOf('<link rel="stylesheet"'));
    // The Chinese title is drawn with the reader's own font: only the text font is worth asking for.
    const chinese = renderPage("/zh/", { ...assets, fonts }, env) as string;
    expect(chinese).not.toContain(fonts.heading);
    expect(chinese).toContain(preload(fonts.body));
    expect(renderPage("/", assets, env)).not.toContain('rel="preload"');
  });

  it("knows nothing of the private routes of the portal", () => {
    for (const path of ["/dashboard", "/auth", "/practices/abc", "/api/health", "/app.html"]) expect(renderPage(path, assets, env)).toBeNull();
  });

  it("renders every listed page", () => {
    const all = renderAll(assets, env);
    expect(all.map((page) => page.path).sort()).toEqual(listPages().map((page) => page.path).sort());
    for (const page of all) expect(page.html).toContain("</html>");
  });

  it("reads the site settings from the environment, with the production origin by default", () => {
    expect(env.origin).toBe("https://portale.tecnomga.com");
    expect(readSiteEnv({ VITE_SITE_ORIGIN: "https://example.test/", VITE_GA4_ID: "G-TEST" })).toMatchObject({ origin: "https://example.test", ga4Id: "G-TEST" });
    expect(readSiteEnv({ VITE_GA4_ID: "  " }).ga4Id).toBeUndefined();
  });
});
