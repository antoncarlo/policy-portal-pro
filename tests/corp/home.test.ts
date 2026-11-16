// La homepage del sito aziendale: apertura, prodotti, perche' un broker, soci fondatori, societa', passi, preventivo.
import { describe, expect, it } from "vitest";
import { readCorpEnv } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { FEATURED, PRODUCT_IDS } from "../../src/corp/products";
import { renderPage } from "../../src/corp/render";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const env = readCorpEnv({ VITE_CORP_INDEXABLE: "true" });
const page = (path: string) => renderPage(path, assets, env)!;
const main = (html: string) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const count = (text: string, needle: string) => text.split(needle).length - 1;
const structured = (html: string): Array<Record<string, unknown>> =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));

describe("homepage", () => {
  it("ha un solo titolo principale e le sezioni nell'ordine previsto", () => {
    for (const path of ["/", "/en/"]) {
      const html = main(page(path));
      expect(count(html, "<h1"), path).toBe(1);
      const sections = [...html.matchAll(/<section\b[^>]*\sid="([^"]+)"/g)].map((match) => match[1]);
      expect(sections, path).toEqual(["apertura", "prodotti", "broker", "fondatori", "compagnie", "come-funziona", "preventivo"]);
    }
  });

  it("ogni sezione ha il solo titolo, senza scritte sopra ne' sottotitoli", () => {
    const html = main(page("/"));
    expect(count(html, "<h2")).toBe(6);
    expect(html).not.toMatch(/class="[^"]*(eyebrow|kicker|overline|section__subtitle|section__lead)/);
  });

  it("l'apertura ha titolo, invito al preventivo e tre fatti verificabili", () => {
    const html = main(page("/"));
    const hero = html.slice(0, html.indexOf('id="prodotti"'));
    expect(hero).toContain(contentFor("it").meta.home.h1);
    expect(hero).toContain('href="#preventivo"');
    expect(hero).toContain('href="#prodotti"');
    for (const chip of contentFor("it").home.hero.chips) expect(hero).toContain(chip);
  });

  it("l'immagine dell'apertura ha testo alternativo e dimensioni; il video non parte finche' il browser non decide", () => {
    const hero = main(page("/")).slice(0, 4000);
    const img = hero.match(/<img\b[^>]*class="hero__poster"[^>]*>/)?.[0] ?? "";
    expect(img).toMatch(/\salt="[^"]{10,}"/);
    expect(img).toMatch(/\swidth="\d+"/);
    expect(img).toMatch(/\sheight="\d+"/);
    expect(img).toContain('fetchPriority="high"');
    const video = hero.match(/<video\b[^>]*>/)?.[0] ?? "";
    expect(video).toContain("data-hero-video");
    expect(video).not.toMatch(/\ssrc=/);
    expect(video).not.toMatch(/\sautoplay/i);
    expect(video).toMatch(/\smuted/i);
    expect(video).toMatch(/\sloop/i);
    expect(video).toMatch(/\splaysInline|\splaysinline/);
    expect(hero).toMatch(/data-src="\/media\/apertura\.(webm|mp4)"/);
  });

  it("presenta gli undici prodotti come lastre di vetro, i sei piu' venduti per primi", () => {
    const html = main(page("/"));
    const cards = [...html.matchAll(/<article\b[^>]*class="product-card[^"]*glass-card[^"]*"[^>]*data-product="([^"]+)"/g)].map((match) => match[1]);
    expect(cards).toEqual([...PRODUCT_IDS]);
    const featured = [...html.matchAll(/<article\b[^>]*class="product-card product-card--featured[^"]*"[^>]*data-product="([^"]+)"/g)].map((match) => match[1]);
    expect(featured).toEqual(FEATURED);
    for (const id of PRODUCT_IDS) expect(html).toContain(`<h3 class="product-card__name">${contentFor("it").home.products.items[id].name.replace("&", "&amp;")}</h3>`);
  });

  it("ogni prodotto porta alla richiesta di preventivo gia' con il prodotto scelto", () => {
    const html = main(page("/"));
    for (const id of PRODUCT_IDS) expect(html).toContain(`href="#preventivo" data-quote-product="${id}"`);
  });

  it("le fideiussioni rimandano al portale per le VIES, e solo li' si parla di VIES", () => {
    const html = main(page("/"));
    expect(html).toContain('href="https://portale.tecnomga.com/"');
    const text = html.replace(/<[^>]+>/g, " ");
    expect(count(text, "VIES")).toBe(1);
  });

  it("«perche' un broker» cita la fonte e collega la verifica dell'iscrizione", () => {
    const html = main(page("/"));
    const section = html.slice(html.indexOf('id="broker"'), html.indexOf('id="fondatori"'));
    expect(count(section, "glass-card")).toBeGreaterThanOrEqual(3);
    expect(section).toContain('href="https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-09-07;209~art109"');
    expect(section).toContain('href="https://ruipubblico.ivass.it/rui-pubblica/ng/"');
  });

  it("i soci fondatori e le societa' compaiono una sola volta, senza loghi", () => {
    const html = main(page("/"));
    const text = html.replace(/<[^>]+>/g, " ");
    expect(count(text, "Anton Carlo Santoro")).toBe(1);
    expect(count(text, "Mapfre")).toBe(1);
    expect(count(text, "Markel")).toBe(1);
    const companies = html.slice(html.indexOf('id="compagnie"'), html.indexOf('id="come-funziona"'));
    expect(companies).not.toContain("<img");
    for (const name of contentFor("it").home.companies.names) expect(companies).toContain(name);
  });

  it("i passi sono un elenco numerato di tre voci", () => {
    const html = main(page("/"));
    const steps = html.slice(html.indexOf('id="come-funziona"'), html.indexOf('id="preventivo"'));
    expect(steps).toMatch(/<ol\b/);
    expect(count(steps, "<li")).toBe(3);
  });

  it("la sezione del preventivo da' email e telefono", () => {
    const html = main(page("/"));
    const quote = html.slice(html.indexOf('id="preventivo"'));
    expect(quote).toContain('href="mailto:info@tecnomga.com"');
    expect(quote).toContain('href="tel:+390697638088"');
  });

  it("i dati strutturati descrivono intermediario, servizio e passi, con gli stessi testi della pagina", () => {
    const data = structured(page("/"));
    expect(data.map((item) => item["@type"])).toEqual(expect.arrayContaining(["InsuranceAgency", "Service", "HowTo"]));
    const howTo = data.find((item) => item["@type"] === "HowTo") as { name: string; step: Array<{ name: string }> };
    expect(howTo.name).toBe(contentFor("it").home.steps.title);
    expect(howTo.step.map((step) => step.name)).toEqual(contentFor("it").home.steps.items.map((item) => item.title));
  });
});
