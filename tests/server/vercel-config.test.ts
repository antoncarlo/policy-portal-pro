import { readFileSync } from "node:fs";
import { getTransformedRoutes } from "@vercel/routing-utils";
import { describe, expect, it } from "vitest";
import { listPages } from "../../src/site/routes";

// Le regole di vercel.json decidono cosa i motori di ricerca possono indicizzare e quale politica di sicurezza
// vale per ogni pagina. Qui si applicano come le applica Vercel: `source` e' un'espressione che deve coprire
// tutto il percorso, con la barra finale facoltativa.
interface Rule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { headers: Rule[]; rewrites: Array<{ source: string; destination: string }> };
const matches = (source: string, path: string) => new RegExp(`^${source}(?:/)?$`).test(path);
const headersFor = (path: string) => vercel.headers.filter((rule) => matches(rule.source, path)).flatMap((rule) => rule.headers);
const values = (path: string, key: string) => headersFor(path).filter((header) => header.key === key).map((header) => header.value);

const PRIVATE = ["/dashboard", "/practices", "/practices/abc-123", "/auth", "/vies", "/settings", "/user-management", "/api/health", "/api/contact", "/app.html", "/assets/main-abc.js", "/energia", "/zhongguo", "/version.json", "/blogger", "/blog-admin", "/venditori", "/rappresentanti", "/venditori-esteri-2"];
const PUBLIC = [
  "/", "/en", "/en/", "/zh", "/zh/", "/privacy", "/privacy/", "/cookie/", "/en/privacy/", "/zh/cookie/", "/en/index.html",
  "/blog", "/blog/", "/blog/garanzia-vies-cos-e-chi-deve-prestarla/", "/blog/un-articolo-futuro", "/rappresentanti-fiscali", "/rappresentanti-fiscali/", "/venditori-esteri/",
  "/en/blog/vies-guarantee-italy-explained/", "/zh/blog/", "/en/fiscal-representatives/", "/zh/non-eu-sellers/",
];
const OPEN_FILES = ["/sitemap.xml", "/robots.txt", "/llms.txt", "/site-media/hero.webp", "/blog/feed.xml", "/en/blog/feed.xml", "/zh/blog/feed.xml"];

describe("vercel.json: what is public and what stays private", () => {
  it("keeps every private page out of the search engines, with the portal's own security policy", () => {
    for (const path of PRIVATE) {
      expect(values(path, "X-Robots-Tag"), path).toEqual(["noindex, nofollow, noarchive"]);
      const csp = values(path, "Content-Security-Policy");
      expect(csp, path).toHaveLength(1);
      expect(csp[0], path).toContain("supabase.co");
      expect(csp[0], path).not.toMatch(/google|doubleclick/);
    }
  });

  it("lets the public pages be indexed, with a policy that admits Google's measurement only there", () => {
    for (const path of PUBLIC) {
      expect(values(path, "X-Robots-Tag"), path).toEqual([]);
      const csp = values(path, "Content-Security-Policy");
      expect(csp, path).toHaveLength(1);
      expect(csp[0], path).toContain("https://www.googletagmanager.com");
      expect(csp[0], path).not.toContain("supabase.co");
      expect(csp[0], path).toContain("script-src 'self'");
      expect(csp[0], path).not.toContain("'unsafe-eval'");
      expect(csp[0], path).toContain("frame-ancestors 'none'");
    }
  });

  it("does not hide the sitemap, robots.txt, llms.txt and the site's images", () => {
    for (const path of OPEN_FILES) expect(values(path, "X-Robots-Tag"), path).toEqual([]);
  });

  it("treats every page the site generates as public: a page left out of the rules would answer noindex", () => {
    for (const page of listPages()) {
      expect(values(page.path, "X-Robots-Tag"), page.path).toEqual([]);
      const csp = values(page.path, "Content-Security-Policy");
      expect(csp, page.path).toHaveLength(1);
      expect(csp[0], page.path).toContain("https://www.googletagmanager.com");
    }
  });

  it("serves the feeds of the guides as Atom", () => {
    for (const path of ["/blog/feed.xml", "/en/blog/feed.xml", "/zh/blog/feed.xml"]) expect(values(path, "Content-Type"), path).toEqual(["application/atom+xml; charset=utf-8"]);
    expect(values("/sitemap.xml", "Content-Type")).toEqual([]);
  });

  it("sends the common security headers on every path, once", () => {
    for (const path of [...PRIVATE, ...PUBLIC, ...OPEN_FILES]) {
      for (const key of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
        expect(values(path, key), `${path} ${key}`).toHaveLength(1);
      }
    }
  });

  it("keeps the portal's policy first in the file: the Supabase check reads the first one", () => {
    const first = vercel.headers.flatMap((rule) => rule.headers).find((header) => header.key === "Content-Security-Policy");
    expect(first?.value).toContain("supabase.co");
  });

  it("sends every other path to the portal's shell, never to the public home page", () => {
    const last = vercel.rewrites[vercel.rewrites.length - 1];
    expect(last).toEqual({ source: "/(.*)", destination: "/app.html" });
    expect(values("/app.html", "Cache-Control")).toEqual(["no-cache"]);
    expect(values("/", "Cache-Control")).toEqual(["no-cache"]);
  });

  it("lets the browser keep the images and the video of the site for a day, and nothing else of the site's media rule", () => {
    for (const path of ["/site-media/vies-vetro-apertura.webm", "/site-media/og-it.png", "/site-media/tecno-mga-logo-chiaro.svg"]) {
      expect(values(path, "Cache-Control"), path).toEqual(["public, max-age=86400, stale-while-revalidate=604800"]);
    }
    for (const path of ["/", "/en/", "/dashboard", "/api/contact", "/assets/site-abc.js"]) expect(values(path, "Cache-Control").join(), path).not.toContain("max-age=86400");
  });
});

describe("robots.txt", () => {
  const robots = readFileSync("public/robots.txt", "utf8");
  const lines = robots.split("\n").map((line) => line.trim());

  it("opens the site and names the sitemap", () => {
    expect(lines).toContain("Allow: /");
    expect(lines).not.toContain("Disallow: /");
    expect(lines).toContain("Sitemap: https://portale.tecnomga.com/sitemap.xml");
  });

  it("keeps the crawlers away from the API only: private pages must be read to see their noindex", () => {
    expect(lines.filter((line) => line.startsWith("Disallow:"))).toEqual(["Disallow: /api/"]);
  });

  it("names the crawlers of the AI engines in the same group as everyone else", () => {
    for (const bot of ["*", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended", "Bingbot"]) expect(lines).toContain(`User-agent: ${bot}`);
    // One group: a crawler follows only the most specific group that names it, so the rules must not be split.
    expect(robots.split(/\n\s*\n/).filter((block) => /^User-agent:/m.test(block))).toHaveLength(1);
  });
});

// Il sito aziendale (tecnomga.com) e' un progetto Vercel a parte, con cartella radice sites/tecnomga: solo pagine
// statiche, nessuna funzione. Le sue regole stanno in sites/tecnomga/vercel.json.
describe("sites/tecnomga/vercel.json: the company site", () => {
  const corp = JSON.parse(readFileSync("sites/tecnomga/vercel.json", "utf8")) as {
    headers: Rule[];
    trailingSlash?: boolean;
    buildCommand?: string;
    installCommand?: string;
    outputDirectory?: string;
    framework?: string | null;
    rewrites?: unknown[];
    redirects?: Array<{ source: string; destination: string; permanent?: boolean }>;
    functions?: unknown;
    crons?: unknown;
  };
  // I reindirizzamenti si provano come li compila Vercel, con la sua libreria: con la barra finale attiva Vercel
  // aggiunge prima la barra (/about-us -> /about-us/) e solo dopo cerca la regola, che deve coprire il percorso esatto.
  const compiled = getTransformedRoutes({ trailingSlash: corp.trailingSlash, redirects: corp.redirects ?? [] });
  if (compiled.error) throw new Error(compiled.error.message);
  const routes = (compiled.routes ?? []) as Array<{ src: string; status?: number; headers?: Record<string, string> }>;
  /** Il primo passo di instradamento per un percorso: un reindirizzamento con la sua destinazione, oppure nessuno. */
  const step = (path: string) => {
    for (const route of routes) {
      const found = new RegExp(route.src).exec(path);
      if (!found) continue;
      if (!route.status) return undefined;
      const location = (route.headers?.Location ?? "").replace(/\$(\d)/g, (_, n: string) => found[Number(n)] ?? "");
      return { status: route.status, location };
    }
    return undefined;
  };
  /** Dove porta un indirizzo del vecchio sito WordPress, seguendo i reindirizzamenti fino alla fine. */
  const redirectOf = (path: string) => {
    const hops: Array<{ status: number; location: string }> = [];
    let current = path;
    for (let next = step(current); next && hops.length < 5; next = step(current)) {
      hops.push(next);
      if (!next.location.startsWith("/") || next.location.includes("#")) break;
      current = next.location;
    }
    return hops.length ? { destination: hops[hops.length - 1].location, permanent: hops.every((hop) => hop.status === 308), hops } : undefined;
  };
  const corpValues = (path: string, key: string) =>
    corp.headers
      .filter((rule) => matches(rule.source, path))
      .flatMap((rule) => rule.headers)
      .filter((header) => header.key === key)
      .map((header) => header.value);
  const PAGES = ["/", "/en/", "/privacy/", "/cookie/", "/en/privacy/", "/en/cookie/", "/una-pagina-futura/"];

  it("builds from the root of the repository and publishes the folder of the static pages", () => {
    expect(corp.installCommand).toBe("cd ../.. && npm install");
    expect(corp.buildCommand).toBe("cd ../.. && npm run build:corp");
    expect(corp.outputDirectory).toBe("dist");
    expect(corp.framework).toBeNull();
  });

  it("is static only: no functions, no scheduled jobs, no rewrite to an application shell", () => {
    expect(corp.functions).toBeUndefined();
    expect(corp.crons).toBeUndefined();
    expect(corp.rewrites ?? []).toEqual([]);
  });

  it("the pages of the old WordPress site that search engines know lead to the new ones, permanently", () => {
    const expected: Record<string, string> = {
      "/about-us/": "/#fondatori",
      "/services/": "/#prodotti",
      "/contact/": "/#preventivo",
      "/fideiussioni-e-cauzioni/": "/#prodotti",
      "/decennale-postuma-e-car/": "/#prodotti",
      "/ar-fotovoltaico/": "/#prodotti",
      "/business-insurance/": "/#prodotti",
      "/home-insurance/": "/#prodotti",
      "/vehicle-insurance/": "/#prodotti",
      "/health-insurance/": "/#prodotti",
      "/life-insurance/": "/#prodotti",
      "/travel-insurance/": "/#prodotti",
      "/en/about-us/": "/en/#fondatori",
      "/en/services/": "/en/#prodotti",
      "/en/contact/": "/en/#preventivo",
      "/en/fideiussioni-e-cauzioni/": "/en/#prodotti",
      "/en/decennale-postuma-e-car/": "/en/#prodotti",
      "/en/ar-fotovoltaico/": "/en/#prodotti",
      "/en/business-insurance/": "/en/#prodotti",
      "/en/home-insurance/": "/en/#prodotti",
      "/en/vehicle-insurance/": "/en/#prodotti",
      "/en/health-insurance/": "/en/#prodotti",
      "/en/life-insurance/": "/en/#prodotti",
      "/en/travel-insurance/": "/en/#prodotti",
      "/portale-assicurativo/": "https://portale.tecnomga.com/",
      "/en/portale-assicurativo/": "https://portale.tecnomga.com/",
    };
    for (const [from, to] of Object.entries(expected)) {
      for (const path of [from, from.replace(/\/$/, "")]) {
        const rule = redirectOf(path);
        expect(rule?.destination, path).toBe(to);
        expect(rule?.permanent, path).toBe(true);
      }
    }
  });

  it("the general privacy notice keeps its old address, to which the portal links, and leads to the copy hosted by the new site", () => {
    const rule = redirectOf("/wp-content/uploads/2025/12/Informativaprivacytecno-1_1.pdf");
    expect(rule?.destination).toBe("/documenti/informativa-privacy.pdf");
    expect(rule?.permanent).toBe(true);
  });

  it("what the new site does not carry over is not found: no redirect to the home page that would pass for an answer", () => {
    for (const path of [
      "/hello-world/", "/test-aj/", "/author/officinawebdesi/", "/category/uncategorized/", "/elementskit-content/dynamic-content-widget-720d6f67-83ca625/", "/metform-form/final-form/",
      "/wp-content/uploads/2025/12/MUP-TECNO-1-1.pdf", "/wp-content/uploads/2025/12/vendita-a-distanza-tecno.pdf", "/wp-content/uploads/2025/12/terms-and-conditions.pdf",
      "/", "/en/", "/privacy/", "/cookie/", "/en/privacy/", "/media/apertura.webp", "/documenti/informativa-privacy.pdf",
    ]) expect(redirectOf(path), path).toBeUndefined();
    // Senza la barra finale si aggiunge solo la barra: la pagina resta quella chiesta, e se non esiste risponde 404.
    for (const path of ["/hello-world", "/privacy", "/en"]) expect(redirectOf(path)?.destination, path).toBe(`${path}/`);
  });

  it("every address ends with a slash, like the routes of the site", () => {
    expect(corp.trailingSlash).toBe(true);
  });

  it("every page and every file carries the security headers", () => {
    for (const path of [...PAGES, "/assets/site-abc.js", "/media/apertura.webp", "/robots.txt"]) {
      expect(corpValues(path, "Strict-Transport-Security"), path).toEqual(["max-age=63072000; includeSubDomains"]);
      expect(corpValues(path, "X-Content-Type-Options"), path).toEqual(["nosniff"]);
      expect(corpValues(path, "X-Frame-Options"), path).toEqual(["DENY"]);
      expect(corpValues(path, "Referrer-Policy"), path).toEqual(["strict-origin-when-cross-origin"]);
      expect(corpValues(path, "Permissions-Policy").join(), path).toContain("camera=()");
    }
  });

  it("the content policy lets the pages run only their own script, call the portal for the quote form and, for Google, the same addresses as the public pages of the portal", () => {
    const portalPublic = values("/", "Content-Security-Policy")[0];
    const directive = (csp: string, name: string) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";
    for (const path of PAGES) {
      const csp = corpValues(path, "Content-Security-Policy");
      expect(csp, path).toHaveLength(1);
      expect(directive(csp[0], "connect-src"), path).toBe(directive(portalPublic, "connect-src").replace("connect-src 'self'", "connect-src 'self' https://portale.tecnomga.com"));
      for (const name of ["default-src", "script-src", "style-src", "img-src", "font-src", "frame-src", "media-src", "object-src", "base-uri", "form-action", "frame-ancestors"]) expect(directive(csp[0], name), `${path}: ${name}`).toBe(directive(portalPublic, name));
      expect(csp[0], path).not.toContain("supabase");
      expect(csp[0], path).not.toContain("'unsafe-eval'");
      expect(csp[0], path).toContain("upgrade-insecure-requests");
    }
  });

  it("never tells the engines not to index through a header: on the test address the pages and robots.txt say it themselves", () => {
    for (const path of [...PAGES, "/sitemap.xml", "/robots.txt", "/llms.txt"]) expect(corpValues(path, "X-Robots-Tag"), path).toEqual([]);
  });

  it("writes its rules the way Vercel reads them: a group that does not capture is always inside one that does", () => {
    // Vercel reads `source` with path-to-regexp, which refuses a pattern starting with «?» at the top level.
    const topLevelQuestionGroup = (source: string) => {
      let depth = 0;
      for (let index = 0; index < source.length; index += 1) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === "(") {
          if (source[index + 1] === "?" && depth === 0) return true;
          depth += 1;
        } else if (source[index] === ")") depth -= 1;
      }
      return false;
    };
    expect(topLevelQuestionGroup("/(?:media|brand)/(.*)")).toBe(true);
    for (const rule of [...corp.headers, ...vercel.headers]) expect(topLevelQuestionGroup(rule.source), rule.source).toBe(false);
  });

  it("lets the browser keep the files with a fingerprint in the name for a year, images and video for a day, and never the pages", () => {
    expect(corpValues("/assets/site-E-6NjboQ.css", "Cache-Control")).toEqual(["public, max-age=31536000, immutable"]);
    for (const path of ["/media/apertura.webm", "/media/og-it.png", "/companies/axa.webp", "/brand/tecno-mga-logo.png", "/documenti/informativa-privacy.pdf"]) expect(corpValues(path, "Cache-Control"), path).toEqual(["public, max-age=86400, stale-while-revalidate=604800"]);
    for (const path of PAGES) expect(corpValues(path, "Cache-Control"), path).toEqual([]);
  });
});
