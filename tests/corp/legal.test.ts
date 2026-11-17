// Privacy e Cookie del sito aziendale: chi tratta i dati, quali, per quanto e con chi; che cosa si salva nel
// browser, per nome, e solo quello che il sito usa davvero.
import { describe, expect, it } from "vitest";
import { COMPANY, CORP, CORP_CONTENT_UPDATED, formatDate, readCorpEnv, type CorpLang } from "../../src/corp/config";
import { legalFor } from "../../src/corp/content/legal";
import { renderPage } from "../../src/corp/render";
import { pathOf } from "../../src/corp/routes";
import { CONSENT_KEY, CONSENT_MAX_AGE_DAYS } from "../../src/site/consent-core";

const assets = { css: ["/assets/corp.css"], js: "/assets/corp.js" };
const plain = readCorpEnv({});
const measured = readCorpEnv({ VITE_CORP_GA4_ID: "G-ABC123XYZ9" });
const page = (id: "privacy" | "cookie", lang: CorpLang, env = plain) => renderPage(pathOf(id, lang), assets, env)!;
const main = (html: string) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const text = (html: string) => main(html).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** I nomi nella prima colonna dell'elenco dei cookie. */
const cookieNames = (html: string) => [...main(html).matchAll(/<th scope="row"><code>([^<]+)<\/code>/g)].map((match) => match[1]);
const strings = (value: unknown): string[] => (typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);
const shape = (value: unknown): unknown => (typeof value === "string" ? "testo" : Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)])) : value);

describe("pagine legali del sito aziendale", () => {
  it("privacy e cookie esistono nelle due lingue, con un solo titolo e sezioni", () => {
    for (const lang of CORP.langs) {
      for (const id of ["privacy", "cookie"] as const) {
        const html = main(page(id, lang));
        expect(html.match(/<h1\b/g), `${lang} ${id}`).toHaveLength(1);
        expect((html.match(/<h2\b/g) ?? []).length, `${lang} ${id}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("stessa struttura nelle due lingue, con e senza misurazione, e nessun testo vuoto", () => {
    for (const measurement of [false, true]) {
      expect(shape(legalFor("en", measurement))).toEqual(shape(legalFor("it", measurement)));
      for (const lang of CORP.langs) for (const value of strings(legalFor(lang, measurement))) expect(value.trim().length, `${lang}: «${value}»`).toBeGreaterThan(0);
    }
  });

  it("la data dell'ultimo aggiornamento e' nella pagina, leggibile da persone e programmi", () => {
    for (const lang of CORP.langs) {
      for (const id of ["privacy", "cookie"] as const) expect(main(page(id, lang)), `${lang} ${id}`).toContain(`<time dateTime="${CORP_CONTENT_UPDATED}">${formatDate(lang, CORP_CONTENT_UPDATED)}</time>`);
    }
  });

  it("non nominano Helpet, le VIES ne' la vecchia sede", () => {
    for (const env of [plain, measured]) {
      for (const lang of CORP.langs) {
        for (const id of ["privacy", "cookie"] as const) {
          const body = text(page(id, lang, env));
          for (const word of ["Helpet", "helpet", "VIES", "Parioli", "Markel", "portale.tecnomga.com"]) expect(body, `${lang} ${id}: ${word}`).not.toContain(word);
        }
      }
    }
  });
});

describe("informativa sulla privacy", () => {
  it("dice chi e' il titolare, con sede legale, partita IVA e numero di iscrizione al RUI", () => {
    for (const lang of CORP.langs) {
      const body = text(page("privacy", lang));
      expect(body, lang).toContain(COMPANY.name);
      expect(body, lang).toContain("Via Po, 102 - 00198 Roma");
      expect(body, lang).toContain(COMPANY.vat);
      expect(body, lang).toContain(COMPANY.rui);
    }
  });

  it("da' il recapito del responsabile della protezione dei dati, lo stesso del portale, come link", () => {
    expect(COMPANY.dpoEmail).toBe("info@tecnomga.com");
    for (const lang of CORP.langs) expect(main(page("privacy", lang)), lang).toContain(`<a href="mailto:${COMPANY.dpoEmail}">${COMPANY.dpoEmail}</a>`);
  });

  it("riguarda questo sito e il suo modulo di preventivo; per i contratti rimanda all'informativa generale", () => {
    for (const lang of CORP.langs) {
      const html = main(page("privacy", lang));
      expect(text(page("privacy", lang)), lang).toContain("tecnomga.com");
      expect(html, lang).toMatch(new RegExp(`<a href="${COMPANY.privacyNoticeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer">`));
    }
    expect(text(page("privacy", "it"))).toMatch(/modulo di richiesta preventivo/);
    expect(text(page("privacy", "en"))).toMatch(/quotation form/);
  });

  it("dice che cosa chiede il modulo, che l'indirizzo IP non si salva e per quanto restano le richieste", () => {
    const it_ = text(page("privacy", "it"));
    expect(it_).toMatch(/nome e cognome, email, il testo del messaggio e, se li indichi, società, telefono e prodotto/);
    expect(it_).toMatch(/non salviamo il tuo indirizzo IP/);
    expect(it_).toMatch(/24 mesi/);
    const en = text(page("privacy", "en"));
    expect(en).toMatch(/full name, email, the text of the message and, if you give them, company, phone and product/);
    expect(en).toMatch(/We do not store your IP address/);
    expect(en).toMatch(/24 months/);
  });

  it("elenca i fornitori che ricevono i dati; Google solo se la misurazione e' attiva, mai Google Ads", () => {
    for (const lang of CORP.langs) {
      const without = text(page("privacy", lang));
      for (const name of ["Vercel", "Supabase", "Resend", "Sentry"]) expect(without, `${lang}: ${name}`).toContain(name);
      expect(without, lang).not.toContain("Google Ireland");
      expect(without, lang).not.toContain("Google Analytics");
      const withMeasurement = text(page("privacy", lang, measured));
      expect(withMeasurement, lang).toContain("Google Ireland Limited: Google Analytics");
      expect(withMeasurement, lang).not.toContain("Google Ads");
      // Con la misurazione l'informativa rimanda alla pagina dei cookie.
      expect(main(page("privacy", lang, measured)), lang).toContain(`href="${pathOf("cookie", lang)}"`);
    }
  });

  it("dice che le statistiche di visita si raccolgono con Vercel Web Analytics, senza cookie, con e senza Google Analytics", () => {
    for (const env of [plain, measured]) {
      const it_ = text(page("privacy", "it", env));
      expect(it_).toContain("Vercel Web Analytics");
      expect(it_).toMatch(/senza cookie e senza salvare nulla nel tuo browser/);
      expect(it_).toMatch(/cancellato dopo 24 ore/);
      expect(it_).toMatch(/Vercel Inc\.: ospita il sito e fornisce le statistiche di visita/);
      const en = text(page("privacy", "en", env));
      expect(en).toContain("Vercel Web Analytics");
      expect(en).toMatch(/without cookies and without saving anything in your browser/);
      expect(en).toMatch(/deleted after 24 hours/);
      expect(en).toMatch(/Vercel Inc\.: hosts the site and provides the visit statistics/);
      for (const lang of CORP.langs) {
        const cookie = page("cookie", lang, env);
        expect(text(cookie), lang).toContain("Vercel Web Analytics");
        // Non salva nulla nel browser: nell'elenco non c'e' nessuna sua voce.
        expect(cookieNames(cookie).join(" "), lang).not.toMatch(/vercel|_va/i);
      }
    }
  });

  it("indica i diritti, il tempo di risposta e il Garante", () => {
    for (const lang of CORP.langs) {
      const html = main(page("privacy", lang));
      expect(html, lang).toContain('href="https://www.garanteprivacy.it/"');
      expect(text(page("privacy", lang)), lang).toMatch(lang === "it" ? /entro un mese/ : /within one month/);
    }
  });
});

describe("informativa sui cookie", () => {
  it("senza misurazione elenca solo la scelta della lingua, e dice che non c'e' nessuna scelta da fare", () => {
    for (const lang of CORP.langs) {
      const html = page("cookie", lang);
      expect(cookieNames(html), lang).toEqual([lang === "it" ? "tecno-lang-choice (archivio locale)" : "tecno-lang-choice (local storage)"]);
      const body = text(html);
      for (const word of ["_ga", "tecno-consent", "Google"]) expect(body, `${lang}: ${word}`).not.toContain(word);
    }
    expect(text(page("cookie", "it"))).toMatch(/non usa cookie di profilazione né cookie di misurazione/);
    expect(text(page("cookie", "en"))).toMatch(/uses no profiling cookies and no measurement cookies/);
  });

  it("con la misurazione elenca la scelta sui cookie e i due cookie di Google Analytics, attivi solo con il consenso", () => {
    for (const lang of CORP.langs) {
      const html = page("cookie", lang, measured);
      const storage = lang === "it" ? "archivio locale" : "local storage";
      expect(cookieNames(html), lang).toEqual([`${CONSENT_KEY} (${storage})`, `tecno-lang-choice (${storage})`, "_ga", "_ga_&lt;ID&gt;"]);
      const body = text(html);
      expect(body, lang).not.toMatch(/_gcl|doubleclick|Google Ads/);
      expect(body, lang).toMatch(lang === "it" ? /solo con il consenso/ : /only with consent/);
      expect(body, lang).toMatch(lang === "it" ? /nessuno script di Google viene caricato/ : /no Google script is loaded/);
    }
  });

  it("la durata della scelta sui cookie e' quella che il sito applica davvero", () => {
    expect(CONSENT_MAX_AGE_DAYS).toBe(180);
    expect(text(page("cookie", "it", measured))).toMatch(/Ricorda la tua scelta sui cookie\. 6 mesi/);
    expect(text(page("cookie", "en", measured))).toMatch(/Remembers your cookie choice\. 6 months/);
  });

  it("rimanda all'informativa sulla privacy della stessa lingua", () => {
    for (const lang of CORP.langs) for (const env of [plain, measured]) expect(main(page("cookie", lang, env)), lang).toContain(`href="${pathOf("privacy", lang)}"`);
  });
});
