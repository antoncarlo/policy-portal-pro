// I file grafici del sito aziendale: quelli dichiarati esistono, hanno le dimensioni dichiarate e non pesano.
import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCorpEnv } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { COMPANY_LOGOS, HERO_POSTER } from "../../src/corp/media";
import { renderAll } from "../../src/corp/render";
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

  it("ogni immagine che le pagine chiamano sotto /companies/ e /media/ esiste", () => {
    const wanted = new Set<string>();
    for (const { html } of renderAll(assets, readCorpEnv({}))) for (const [url] of html.matchAll(/\/(?:companies|media)\/[A-Za-z0-9._-]+/g)) wanted.add(url);
    // Il video dell'apertura e le immagini per i social arrivano con la grafica (compito 7): fino ad allora non si pretendono.
    const images = [...wanted].filter((url) => !/\.(mp4|webm)$/.test(url) && !url.startsWith("/media/og-"));
    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const url of images) expect(existsSync(publicFile(url)), url).toBe(true);
  });
});
