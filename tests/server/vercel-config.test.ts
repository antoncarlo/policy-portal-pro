import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

const PRIVATE = ["/dashboard", "/practices", "/practices/abc-123", "/auth", "/vies", "/settings", "/user-management", "/api/health", "/api/contact", "/app.html", "/assets/main-abc.js", "/energia", "/zhongguo", "/version.json"];
const PUBLIC = ["/", "/en", "/en/", "/zh", "/zh/", "/privacy", "/privacy/", "/cookie/", "/en/privacy/", "/zh/cookie/", "/en/index.html"];
const OPEN_FILES = ["/sitemap.xml", "/robots.txt", "/llms.txt", "/site-media/hero.webp"];

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
