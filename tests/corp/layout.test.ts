// Ossatura di ogni pagina del sito aziendale: barra, pie' di pagina con i dati dell'intermediario, lingua, cookie.
import { describe, expect, it } from "vitest";
import { COMPANY, readCorpEnv } from "../../src/corp/config";
import { renderAll, renderPage } from "../../src/corp/render";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const env = readCorpEnv({});
const withGoogle = readCorpEnv({ VITE_CORP_GA4_ID: "G-TEST123456" });
const pages = renderAll(assets, env);
const body = (html: string) => html.slice(html.indexOf("<body"));
const footer = (html: string) => html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("pie' di pagina: i dati dell'intermediario", () => {
  it("in ogni pagina e lingua ci sono denominazione, RUI, partita IVA, sedi e recapiti", () => {
    for (const page of pages) {
      const foot = text(footer(page.html));
      for (const value of [COMPANY.name, "B000746484", "17460381001", "Via Po, 102 - 00198 Roma", "Via Michele Mercati, 18 - 00197 Roma", "tecnoadvancemgabroker@legalmail.it", "info@tecnomga.com", "06.97638088"]) {
        expect(foot, `${page.path}: ${value}`).toContain(value);
      }
    }
  });

  it("dice chi vigila, come si reclama e che e' un messaggio pubblicitario", () => {
    const it_ = text(footer(renderPage("/", assets, env)!));
    expect(it_).toContain("IVASS");
    expect(it_).toMatch(/reclami[^.]*sede legale[^.]*info@tecnomga\.com/i);
    expect(it_).toContain("Messaggio pubblicitario");
    const en = text(footer(renderPage("/en/", assets, env)!));
    expect(en).toContain("IVASS");
    expect(en).toMatch(/complaints[^.]*registered office[^.]*info@tecnomga\.com/i);
    expect(en).toContain("Advertising message");
  });

  it("collega la verifica pubblica dell'iscrizione al Registro e le pagine legali", () => {
    const foot = footer(renderPage("/", assets, env)!);
    expect(foot).toContain('href="https://ruipubblico.ivass.it/rui-pubblica/ng/"');
    expect(foot).toContain('href="/privacy/"');
    expect(foot).toContain('href="/cookie/"');
    expect(footer(renderPage("/en/", assets, env)!)).toContain('href="/en/privacy/"');
  });

  it("non porta con se' nulla del vecchio sito", () => {
    for (const page of pages) expect(page.html, page.path).not.toMatch(/parioli|example\.com|tecnoinsurance|manusvm|officinawebdesi|vies@tecnomga|helpetapp/i);
  });

  it("Helpet non compare nei dati dell'intermediario, nei reclami ne' nelle pagine legali", () => {
    for (const page of pages) expect(footer(page.html), page.path).not.toMatch(/helpet/i);
    for (const path of ["/privacy/", "/en/privacy/", "/cookie/", "/en/cookie/"]) expect(renderPage(path, assets, env), path).not.toMatch(/helpet/i);
  });

  it("i link verso l'esterno si aprono in una scheda nuova senza passare il riferimento", () => {
    for (const page of pages) {
      for (const match of body(page.html).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) expect(match[0], page.path).toMatch(/rel="[^"]*noopener/);
    }
  });
});

describe("barra e lingua", () => {
  it("ha il salto al contenuto, il menu e il pulsante per il telefono", () => {
    const html = body(renderPage("/", assets, env)!);
    expect(html).toContain('<a class="skip-link" href="#contenuto">');
    expect(html).toContain("data-site-header");
    expect(html).toContain('id="site-menu"');
    expect(html).toMatch(/<button[^>]*class="menu-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"/);
    expect(html).toContain('<main id="contenuto"');
  });

  it("dalle altre pagine le voci del menu tornano alle sezioni della homepage", () => {
    expect(body(renderPage("/", assets, env)!)).toContain('href="#prodotti"');
    expect(body(renderPage("/privacy/", assets, env)!)).toContain('href="/#prodotti"');
    expect(body(renderPage("/en/cookie/", assets, env)!)).toContain('href="/en/#prodotti"');
  });

  it("il cambio lingua porta alla stessa pagina nell'altra lingua", () => {
    const html = body(renderPage("/en/privacy/", assets, env)!);
    expect(html).toMatch(/<a href="\/privacy\/"[^>]*lang="it"[^>]*hrefLang="it"/);
    expect(html).toMatch(/<a href="\/en\/privacy\/"[^>]*aria-current="page"/);
  });

  it("collega il portale delle VIES e l'area clienti", () => {
    const html = body(renderPage("/", assets, env)!);
    expect(html).toContain('href="https://portale.tecnomga.com/"');
    expect(html).toContain('href="https://portale.tecnomga.com/auth"');
  });
});

describe("banner dei cookie", () => {
  it("non c'e' se il sito non usa strumenti di misurazione", () => {
    for (const page of pages) expect(page.html, page.path).not.toContain("data-cookie-banner");
  });

  it("con Google configurato ha un solo consenso, con due pulsanti dello stesso peso, ed e' nascosto finche' serve", () => {
    const html = renderPage("/", assets, withGoogle)!;
    expect(html).toContain('data-ga4="G-TEST123456"');
    const banner = html.slice(html.indexOf("data-cookie-banner") - 200, html.indexOf("data-cookie-banner") + 1600);
    expect(banner).toMatch(/data-cookie-banner[^>]*hidden/);
    expect(banner).toContain('data-consent="accept"');
    expect(banner).toContain('data-consent="reject"');
    expect((banner.match(/data-consent="(accept|reject)"/g) ?? []).length).toBe(2);
    expect(banner).not.toMatch(/data-consent="(statistics|marketing|custom)"/);
    expect(html).toContain("data-cookie-preferences");
  });
});

describe("vetro liquido", () => {
  it("le superfici della barra e del banner sono lastre di vetro", () => {
    const html = renderPage("/", assets, withGoogle)!;
    expect(html).toMatch(/class="site-header__bar glass-card[^"]*"/);
    expect(html).toMatch(/class="cookie-banner glass-card[^"]*"/);
  });
});
