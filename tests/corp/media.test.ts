// I file grafici del sito aziendale: quelli dichiarati esistono, hanno le dimensioni dichiarate e non pesano.
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANY, CORP, readCorpEnv } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { COMPANY_LOGOS, HERO_POSTER, HERO_VIDEO } from "../../src/corp/media";
import { renderAll, renderPage } from "../../src/corp/render";
import { pathOf } from "../../src/corp/routes";
import { webpSize } from "../helpers/webp";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const publicFile = (url: string) => `sites/tecnomga/public${url}`;

describe("sito aziendale: immagini", () => {
  it("l'immagine ferma dell'apertura ha le dimensioni dichiarate nella pagina", () => {
    expect(webpSize(publicFile(HERO_POSTER.src))).toEqual({ width: HERO_POSTER.width, height: HERO_POSTER.height });
  });

  it("ogni societa' dell'elenco ha il suo logo; il file e' il doppio della misura mostrata, per gli schermi ad alta densita'", () => {
    const names = contentFor("it").home.companies.names;
    expect(Object.keys(COMPANY_LOGOS)).toEqual(names);
    for (const name of names) {
      const logo = COMPANY_LOGOS[name];
      expect(logo.src, name).toMatch(/^\/companies\/[a-z]+\.webp$/);
      expect(existsSync(publicFile(logo.src)), name).toBe(true);
      expect(webpSize(publicFile(logo.src)), name).toEqual({ width: logo.width * 2, height: logo.height * 2 });
    }
  });

  it("un logo non pesa piu' di 60 kB", () => {
    for (const [name, logo] of Object.entries(COMPANY_LOGOS)) expect(statSync(publicFile(logo.src)).size, name).toBeLessThanOrEqual(60 * 1024);
  });

  it("ogni file che le pagine chiamano sotto /companies/ e /media/ esiste: immagini, video dell'apertura e immagini per i social", () => {
    const wanted = new Set<string>();
    for (const { html } of renderAll(assets, readCorpEnv({}))) for (const [url] of html.matchAll(/\/(?:companies|media)\/[A-Za-z0-9._-]+/g)) wanted.add(url);
    expect(wanted.size).toBeGreaterThanOrEqual(10);
    for (const url of wanted) expect(existsSync(publicFile(url)), url).toBe(true);
  });

  it("il video dell'apertura c'e' nei due formati e nessuno dei due supera i 3 MB", () => {
    expect(HERO_VIDEO.map((file) => file.src)).toEqual(["/media/apertura.webm", "/media/apertura.mp4"]);
    for (const file of HERO_VIDEO) {
      expect(existsSync(publicFile(file.src)), file.src).toBe(true);
      expect(statSync(publicFile(file.src)).size, file.src).toBeLessThanOrEqual(3 * 1024 * 1024);
      expect(statSync(publicFile(file.src)).size, file.src).toBeGreaterThan(100 * 1024);
    }
  });

  it("l'immagine ferma dell'apertura e' in formato largo, almeno 1600 px, e non supera i 200 kB", () => {
    expect(HERO_POSTER.width).toBeGreaterThanOrEqual(1600);
    expect(HERO_POSTER.width / HERO_POSTER.height).toBeCloseTo(16 / 9, 1);
    expect(statSync(publicFile(HERO_POSTER.src)).size).toBeLessThanOrEqual(200 * 1024);
  });

  it("c'e' un'immagine 1200x630 per i social in ogni lingua, sotto i 700 kB", () => {
    for (const lang of CORP.langs) {
      const file = publicFile(`/media/og-${lang}.png`);
      expect(existsSync(file), lang).toBe(true);
      const bytes = readFileSync(file);
      // PNG: larghezza e altezza stanno nell'intestazione.
      expect(bytes.readUInt32BE(16), lang).toBe(1200);
      expect(bytes.readUInt32BE(20), lang).toBe(630);
      expect(bytes.length, lang).toBeLessThanOrEqual(700 * 1024);
    }
  });

  it("carica i soli caratteri tipografici che servono a italiano e inglese", () => {
    // I file per sottoinsieme di @fontsource non dichiarano a quali caratteri servono: importare anche l'esteso
    // («latin-ext») fa scaricare a ogni visita due file per peso, uno dei quali inutile (70 kB in piu').
    const css = readFileSync("src/corp/corp.css", "utf8");
    const imports = [...css.matchAll(/@import "@fontsource\/([a-z]+)\/([a-z0-9-]+)\.css";/g)].map((match) => `${match[1]}/${match[2]}`);
    expect(imports.length).toBeGreaterThanOrEqual(4);
    for (const name of imports) expect(name, name).toMatch(/^(inter|lora)\/latin-\d{3}(-italic)?$/);
  });

  it("l'informativa privacy generale della societa' e' un documento del sito, ed e' quello a cui rimandano le pagine", () => {
    expect(COMPANY.privacyNoticeUrl).toBe("/documenti/informativa-privacy.pdf");
    const bytes = readFileSync(publicFile(COMPANY.privacyNoticeUrl));
    expect(bytes.toString("latin1", 0, 5)).toBe("%PDF-");
    expect(bytes.length).toBeLessThanOrEqual(1024 * 1024);
    for (const lang of CORP.langs) expect(renderPage(pathOf("privacy", lang), assets, readCorpEnv({}))!, lang).toContain(`href="${COMPANY.privacyNoticeUrl}"`);
  });

  it("la pagina dichiara ai social l'immagine della sua lingua", () => {
    for (const lang of CORP.langs) {
      const html = renderPage(pathOf("home", lang), assets, readCorpEnv({}))!;
      expect(html, lang).toContain(`<meta property="og:image" content="https://tecnomga.com/media/og-${lang}.png">`);
    }
  });
});
