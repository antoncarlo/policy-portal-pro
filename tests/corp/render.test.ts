// Le pagine del sito aziendale sono documenti HTML completi, resi senza idratazione nel browser.
import { describe, expect, it } from "vitest";
import { readCorpEnv } from "../../src/corp/config";
import { renderAll, renderExtraFiles, renderPage } from "../../src/corp/render";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const env = readCorpEnv({});
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("pagine del sito aziendale", () => {
  it("la homepage e' un documento completo in italiano, con un solo titolo principale", () => {
    const html = renderPage("/", assets, env);
    expect(html).not.toBeNull();
    expect(html!.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="it" data-site="tecnomga" data-page="home"');
    expect(count(html!, "<h1")).toBe(1);
    expect(html).toContain('<link rel="stylesheet" href="/assets/corp.css">');
    expect(html).toContain('<script type="module" src="/assets/corp.js"></script>');
    expect(html).not.toContain("data-reactroot");
  });

  it("la versione inglese dichiara la sua lingua", () => {
    expect(renderPage("/en/", assets, env)).toContain('<html lang="en"');
  });

  it("un percorso che non e' del sito non viene reso", () => {
    expect(renderPage("/zh/", assets, env)).toBeNull();
    expect(renderPage("/auth", assets, env)).toBeNull();
  });

  it("rende ogni pagina in ogni lingua", () => {
    const pages = renderAll(assets, env);
    expect(pages.map((page) => page.path).sort()).toEqual(["/", "/cookie/", "/en/", "/en/cookie/", "/en/privacy/", "/privacy/"]);
    for (const page of pages) expect(count(page.html, "<h1"), page.path).toBe(1);
  });

  it("non contiene script in linea", () => {
    for (const page of renderAll(assets, env)) {
      const inline = [...page.html.matchAll(/<script\b([^>]*)>/g)].filter((match) => !/\ssrc=/.test(match[1]) && !/application\/ld\+json/.test(match[1]));
      expect(inline, page.path).toHaveLength(0);
    }
  });

  it("i file accanto alle pagine hanno un nome e un contenuto", () => {
    for (const file of renderExtraFiles(env)) {
      expect(file.file).toMatch(/^[\w./-]+$/);
      expect(file.content.length).toBeGreaterThan(0);
    }
  });
});
