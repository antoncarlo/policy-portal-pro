import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANY, CONTENT_UPDATED, LANGS, LEGAL_UPDATED, readSiteEnv, type Lang } from "../../src/site/config";
import { CONSENT_KEY } from "../../src/site/consent-core";
import { contentFor } from "../../src/site/content";
import { renderAll, renderPage } from "../../src/site/render";
import { pathOf } from "../../src/site/routes";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const plain = readSiteEnv({});
const measured = readSiteEnv({ VITE_GA4_ID: "G-ABC123XYZ9", VITE_GOOGLE_ADS_ID: "AW-123456789", VITE_GOOGLE_ADS_CONVERSION_LABEL: "AbC-123_xyz" });
const page = (id: "home" | "privacy" | "cookie", lang: Lang, env = plain) => renderPage(pathOf(id, lang), assets, env) as string;
const text = (html: string) => (html.split(/<body[^>]*>/)[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const main = (html: string) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));

describe("site settings: the identifiers of the measurement tools", () => {
  it("are taken only in Google's own form", () => {
    expect(measured).toMatchObject({ ga4Id: "G-ABC123XYZ9", adsId: "AW-123456789", adsConversionLabel: "AbC-123_xyz" });
    const wrong = readSiteEnv({ VITE_GA4_ID: "UA-12345-6", VITE_GOOGLE_ADS_ID: "AW-12x", VITE_GOOGLE_ADS_CONVERSION_LABEL: 'x" onload="alert(1)' });
    expect(wrong.ga4Id).toBeUndefined();
    expect(wrong.adsId).toBeUndefined();
    expect(wrong.adsConversionLabel).toBeUndefined();
  });
});

describe("cookie banner", () => {
  it("without identifiers there is no banner, no setting for the browser and nothing of Google in any page", () => {
    for (const { path, html } of renderAll(assets, plain)) {
      expect(html, path).not.toContain("data-cookie-banner");
      expect(html, path).not.toMatch(/<html[^>]*data-ga4/);
      expect(html, path).not.toContain("googletagmanager");
    }
  });

  it("with identifiers every page carries them for the browser and the banner, hidden until the script decides", () => {
    for (const { path, html } of renderAll(assets, measured)) {
      expect(html, path).toMatch(/<html[^>]*data-ga4="G-ABC123XYZ9"[^>]*data-ads="AW-123456789"[^>]*data-ads-conversion="AbC-123_xyz"/);
      expect(html, path).toMatch(/<div[^>]*data-cookie-banner[^>]*hidden=""/);
      // No script of Google is ever in the page: it is added by the site's own script, after consent.
      expect(html, path).not.toContain("googletagmanager");
    }
  });

  it("asks one consent for everything: Accept and Reject with the same weight, in the language of the page", () => {
    for (const lang of LANGS) {
      const html = page("home", lang, measured);
      const banner = html.slice(html.indexOf("data-cookie-banner"));
      const { cookieBanner } = contentFor(lang);
      const classes = ["accept", "reject"].map((action) => banner.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*data-consent="${action}"`))?.[1]);
      expect(classes[0], lang).toBeTruthy();
      expect(new Set(classes).size, `${lang}: ${classes.join(" | ")}`).toBe(1);
      for (const label of [cookieBanner.accept, cookieBanner.reject]) expect(banner, `${lang}: ${label}`).toContain(`>${label}<`);
      // One consent covers statistics and marketing: no categories to tick, no «customise».
      expect(banner).not.toMatch(/<input\b/);
      expect(banner).not.toMatch(/data-consent="(customise|save)"/);
      expect(Object.keys(cookieBanner).sort()).toEqual(["accept", "close", "policyLink", "reject", "text", "title"]);
      expect(banner).toContain(`href="${pathOf("cookie", lang)}"`);
      expect(banner).toMatch(/data-consent="close"[^>]*aria-label="[^"]+"|aria-label="[^"]+"[^>]*data-consent="close"/);
    }
  });

  it("is there with one identifier as with two", () => {
    for (const settings of [{ VITE_GA4_ID: "G-ABC123XYZ9" }, { VITE_GOOGLE_ADS_ID: "AW-123456789" }]) expect(page("home", "it", readSiteEnv(settings))).toContain("data-cookie-banner");
  });
});

describe("privacy page", () => {
  it("says who processes the data, why, for how long, with whom, and how to exercise one's rights", () => {
    for (const lang of LANGS) {
      const html = page("privacy", lang);
      const body = main(html);
      for (const fact of [COMPANY.name, COMPANY.legalSeat.street, COMPANY.vat, COMPANY.dpoEmail, "DPO", "Vercel", "Supabase", "Google", "Resend", "24"]) expect(body, `${lang}: ${fact}`).toContain(fact);
      // The same data protection officer as in the documents the portal gives its clients to sign.
      expect(COMPANY.dpoEmail).toBe("info@tecnomga.com");
      expect(readFileSync("scripts/signing-templates/build.mjs", "utf8")).toContain(`email: "${COMPANY.dpoEmail}"`);
      expect(body, lang).toContain(`href="mailto:${COMPANY.dpoEmail}"`);
      expect(body, lang).not.toMatch(/privacy@tecnomga\.com|dpo@tecnomga\.com/);
      expect(body, lang).toContain('href="https://www.garanteprivacy.it/"');
      expect(body, lang).toContain(`href="${pathOf("cookie", lang)}"`);
      expect(body, lang).toMatch(/<time dateTime="\d{4}-\d{2}-\d{2}"|<time datetime="\d{4}-\d{2}-\d{2}"/);
      expect((body.match(/<h2/g) ?? []).length, lang).toBeGreaterThanOrEqual(7);
      expect(text(html).length, lang).toBeGreaterThan(lang === "zh" ? 1200 : 3000);
    }
  });

  it("has the same sections in the three languages", () => {
    const count = (lang: Lang) => contentFor(lang).legal.privacy.sections.length;
    expect(count("en")).toBe(count("it"));
    expect(count("zh")).toBe(count("it"));
  });
});

describe("visit statistics with Vercel Web Analytics", () => {
  const PRIVACY: Record<Lang, RegExp[]> = {
    it: [/senza cookie e senza salvare nulla nel tuo browser/, /cancellato dopo 24 ore/, /fornisce le statistiche di visita \(Vercel Web Analytics\)/],
    en: [/without cookies and without saving anything in your browser/, /deleted after 24 hours/, /provides the visit statistics \(Vercel Web Analytics\)/],
    zh: [/不使用Cookie，也不在您的浏览器中保存任何内容/, /24小时后删除/, /提供访问统计（Vercel Web Analytics）/],
  };
  const RESERVED: Record<Lang, RegExp> = {
    it: /Anche nell'area riservata le statistiche delle pagine viste sono raccolte con Vercel Web Analytics/,
    en: /In the client area too, the statistics of the pages viewed are collected with Vercel Web Analytics/,
    zh: /在客户区域内，浏览页面的统计同样通过 Vercel Web Analytics 收集/,
  };

  it("the privacy page says what is collected, without cookies, for how long and by whom, with and without Google's tools", () => {
    for (const env of [plain, measured]) for (const lang of LANGS) for (const fact of PRIVACY[lang]) expect(text(page("privacy", lang, env)).replace(/&#x27;/g, "'"), `${lang}: ${fact}`).toMatch(fact);
  });

  it("the cookie page says it, for the public pages and the reserved area, and lists nothing of it in the browser", () => {
    for (const env of [plain, measured]) {
      for (const lang of LANGS) {
        const body = text(page("cookie", lang, env)).replace(/&#x27;/g, "'");
        expect(body, lang).toContain("Vercel Web Analytics");
        expect(body, lang).toMatch(RESERVED[lang]);
        expect(main(page("cookie", lang, env)), lang).not.toMatch(/<code>[^<]*(vercel|_va)[^<]*<\/code>/i);
      }
    }
  });

  it("the legal pages carry their own date of update, apart from the date of the last check of the rules", () => {
    for (const lang of LANGS) {
      for (const id of ["privacy", "cookie"] as const) expect(main(page(id, lang)), `${lang} ${id}`).toContain(`<time dateTime="${LEGAL_UPDATED}">`);
      expect(main(page("home", lang)), lang).toContain(`<time dateTime="${CONTENT_UPDATED}">`);
    }
    expect(LEGAL_UPDATED).toBe("2026-11-17");
  });
});

describe("cookie page", () => {
  it("lists what is kept in the browser, by name, with purpose, duration and owner", () => {
    for (const lang of LANGS) {
      const html = page("cookie", lang);
      const body = main(html);
      for (const name of [CONSENT_KEY, "tecno-lang-choice", "_ga", "_gcl_au"]) expect(body, `${lang}: ${name}`).toContain(name);
      expect((body.match(/<th scope="col"/g) ?? []).length, lang).toBe(4);
      expect((body.match(/<tr/g) ?? []).length, lang).toBeGreaterThanOrEqual(6);
      expect(body, lang).toContain(`href="${pathOf("privacy", lang)}"`);
      expect(text(html).length, lang).toBeGreaterThan(lang === "zh" ? 700 : 1800);
    }
  });

  it("every page of the site has one H1 and its own title", () => {
    for (const lang of LANGS) {
      for (const id of ["privacy", "cookie"] as const) {
        const html = page(id, lang);
        expect((html.match(/<h1/g) ?? []).length).toBe(1);
        expect(html).toContain(`<title>${contentFor(lang).meta[id].title.replace(/&/g, "&amp;")}</title>`);
      }
    }
  });
});
