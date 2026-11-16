// Il modulo di richiesta preventivo del sito aziendale: cosa controlla il browser, cosa invia e com'e' fatto nella pagina.
import { describe, expect, it } from "vitest";
import { CONTACT_PRODUCTS, validateContact } from "../../api/_lib/contact-requests";
import { quotePayload, quoteProblems, type QuoteValues } from "../../src/corp/client/quote";
import { CORP, DEFAULT_CONTACT_ENDPOINT, readCorpEnv } from "../../src/corp/config";
import { contentFor } from "../../src/corp/content";
import { PRODUCT_IDS } from "../../src/corp/products";
import { renderPage } from "../../src/corp/render";
import { pathOf } from "../../src/corp/routes";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const filled = (over: Partial<QuoteValues> = {}): QuoteValues => ({
  name: "Marco Bianchi",
  company: "",
  email: "marco@example.test",
  phone: "",
  product: "car",
  message: "Vorrei un preventivo per un cantiere a Roma.",
  consent: true,
  ...over,
});
const formOf = (html: string) => html.match(/<form\b[^>]*data-quote-form[\s\S]*?<\/form>/)?.[0] ?? "";

describe("modulo di preventivo: nel browser", () => {
  it("non trova nulla da dire in una richiesta completa; societa', telefono e prodotto non sono obbligatori", () => {
    expect(quoteProblems(filled())).toEqual({});
    expect(quoteProblems(filled({ company: "", phone: "", product: "" }))).toEqual({});
  });

  it("dice che cosa non va, campo per campo", () => {
    expect(quoteProblems(filled({ name: "  ", email: "", message: "", consent: false }))).toEqual({ name: "required", email: "required", message: "required", consent: "consent" });
    expect(quoteProblems(filled({ email: "marco@" }))).toEqual({ email: "email" });
    expect(quoteProblems(filled({ message: "troppo" }))).toEqual({ message: "message" });
  });

  it("chiede a chi scrive quello che chiede il server: gli stessi campi sono rifiutati da entrambi", () => {
    const samples: Array<Partial<QuoteValues>> = [{}, { name: "" }, { company: "Edil Bianchi Srl" }, { email: "x" }, { email: "a b@c.d" }, { message: "123456789" }, { message: "1234567890" }, { consent: false }, { product: "" }, { product: "altro" }, { name: "", email: "", consent: false }];
    for (const sample of samples) {
      const values = filled(sample);
      const server = validateContact({ ...quotePayload(values, { lang: "it", page: "/", website: "", elapsedMs: 9000 }), consent: values.consent });
      expect(Object.keys(quoteProblems(values)).sort(), JSON.stringify(sample)).toEqual(server.ok ? [] : [...server.fields].sort());
    }
  });

  it("invia quello che e' stato scritto, ripulito, con il sito, la lingua, la pagina, il campo trappola e il tempo impiegato", () => {
    expect(quotePayload(filled({ name: "  Marco Bianchi ", company: " Edil  Bianchi Srl ", phone: " 06 123 " }), { lang: "en", page: "/en/", website: "", elapsedMs: 5123.7 })).toEqual({
      site: "corporate",
      product: "car",
      name: "Marco Bianchi",
      company: "Edil Bianchi Srl",
      email: "marco@example.test",
      phone: "06 123",
      message: "Vorrei un preventivo per un cantiere a Roma.",
      consent: true,
      lang: "en",
      page: "/en/",
      website: "",
      elapsedMs: 5124,
    });
  });

  it("una richiesta compilata e' accettata dal server come richiesta del sito aziendale", () => {
    const server = validateContact(quotePayload(filled({ product: "" }), { lang: "it", page: "/", website: "", elapsedMs: 9000 }));
    expect(server.ok && server.value.site).toBe("corporate");
    expect(server.ok && server.value.product).toBeUndefined();
  });
});

describe("modulo di preventivo: nella pagina", () => {
  it("c'e' in ogni lingua, invia al portale e non parte senza lo script", () => {
    for (const lang of CORP.langs) {
      const form = formOf(renderPage(pathOf("home", lang), assets, readCorpEnv({}))!);
      expect(form, lang).toContain(`action="${DEFAULT_CONTACT_ENDPOINT}"`);
      expect(form, lang).toMatch(/<form[^>]*method="post"/);
      expect(form, lang).toMatch(/<form[^>]*novalidate/i);
      // Senza lo script il modulo partirebbe come modulo normale, che il server non accetta: il pulsante resta spento
      // e un avviso da' l'indirizzo a cui scrivere.
      expect(form, lang).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
      expect(form, lang).toMatch(/<noscript>[\s\S]*info@tecnomga\.com[\s\S]*<\/noscript>/);
      expect(form, lang).toMatch(/<p[^>]*data-form-status[^>]*aria-live="polite"/);
    }
  });

  it("l'indirizzo a cui invia si puo' cambiare per le prove", () => {
    const form = formOf(renderPage("/", assets, readCorpEnv({ VITE_CORP_CONTACT_ENDPOINT: "https://prova.example.test/api/contact" }))!);
    expect(form).toContain('action="https://prova.example.test/api/contact"');
  });

  it("ogni campo ha la sua etichetta; nome, email e messaggio sono obbligatori", () => {
    for (const lang of CORP.langs) {
      const form = formOf(renderPage(pathOf("home", lang), assets, readCorpEnv({}))!);
      for (const name of ["name", "company", "email", "phone", "product", "message", "consent"]) {
        const control = form.match(new RegExp(`<(?:input|select|textarea)[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
        const id = control.match(/\sid="([^"]+)"/)?.[1];
        expect(id, `${lang}: ${name}`).toBeTruthy();
        expect(form, `${lang}: ${name}`).toContain(`<label for="${id}"`);
      }
      for (const name of ["name", "email", "message", "consent"]) expect(form, `${lang}: ${name}`).toMatch(new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*required`));
      for (const name of ["company", "phone"]) expect(form, `${lang}: ${name}`).not.toMatch(new RegExp(`<input[^>]*name="${name}"[^>]*required`));
      expect(form, lang).toMatch(/<input[^>]*type="email"[^>]*name="email"[^>]*autoComplete="email"/i);
    }
  });

  it("il prodotto si sceglie tra gli undici del sito piu' «altro», con i nomi della pagina", () => {
    expect([...CONTACT_PRODUCTS]).toEqual([...PRODUCT_IDS, "altro"]);
    for (const lang of CORP.langs) {
      const content = contentFor(lang);
      const select = formOf(renderPage(pathOf("home", lang), assets, readCorpEnv({}))!).match(/<select[^>]*name="product"[\s\S]*?<\/select>/)?.[0] ?? "";
      const options = [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((match) => [match[1], match[2]]);
      expect(options.map(([value]) => value), lang).toEqual(["", ...PRODUCT_IDS, "altro"]);
      for (const id of PRODUCT_IDS) expect(options.find(([value]) => value === id)?.[1], `${lang}: ${id}`).toBe(content.home.products.items[id].name.replace(/&/g, "&amp;"));
    }
  });

  it("il consenso rimanda all'informativa sulla privacy della stessa lingua", () => {
    for (const lang of CORP.langs) {
      const form = formOf(renderPage(pathOf("home", lang), assets, readCorpEnv({}))!);
      const consent = form.slice(form.indexOf('name="consent"'));
      expect(consent, lang).toContain(`href="${pathOf("privacy", lang)}"`);
    }
  });

  it("il campo trappola e' fuori dalla vista e dal giro dei tasti; i messaggi d'errore sono nella lingua della pagina", () => {
    for (const lang of CORP.langs) {
      const form = formOf(renderPage(pathOf("home", lang), assets, readCorpEnv({}))!);
      const trap = form.match(/<input[^>]*name="website"[^>]*>/)?.[0] ?? "";
      expect(trap, lang).toMatch(/tabindex="-1"/i);
      expect(trap, lang).toMatch(/autoComplete="off"/i);
      const errors = contentFor(lang).home.quote.form.fieldErrors;
      for (const [kind, text] of Object.entries(errors)) expect(form, `${lang}: ${kind}`).toContain(`data-error-${kind}="${text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;")}"`);
    }
  });
});
