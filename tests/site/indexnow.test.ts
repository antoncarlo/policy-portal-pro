import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain script of Node, without type declarations.
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, buildPayload, deployIsLive, parseArgs, selectUrls, sitemapEntries } from "../../scripts/site/indexnow.mjs";
import { readSiteEnv } from "../../src/site/config";
import { listPages } from "../../src/site/routes";
import { buildSitemapXml } from "../../src/site/sitemap";

const ORIGIN = "https://portale.tecnomga.com";
const env = readSiteEnv({});

describe("IndexNow: telling Bing and the other engines which pages changed", () => {
  it("has a key the engines can read at the root of the site, in the form they accept", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    const file = `public/${INDEXNOW_KEY}.txt`;
    expect(existsSync(file), file).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
  });

  it("reads every page and its date from the sitemap of the site", () => {
    const entries = sitemapEntries(buildSitemapXml(env, "2026-11-15"));
    expect(entries.map((entry: { loc: string }) => entry.loc).sort()).toEqual(listPages().map((page) => `${ORIGIN}${page.path}`).sort());
    for (const entry of entries) expect(entry.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sends only the pages whose date is recent, so an ordinary deploy of the portal sends nothing", () => {
    const entries = [
      { loc: `${ORIGIN}/`, lastmod: "2026-11-15" },
      { loc: `${ORIGIN}/blog/vecchio/`, lastmod: "2026-10-01" },
      { loc: `${ORIGIN}/blog/ieri/`, lastmod: "2026-11-14" },
    ];
    expect(selectUrls(entries, { days: 2, today: "2026-11-16" })).toEqual([`${ORIGIN}/`, `${ORIGIN}/blog/ieri/`]);
    expect(selectUrls(entries, { days: 2, today: "2026-12-01" })).toEqual([]);
    expect(selectUrls(entries, { all: true, today: "2026-12-01" })).toHaveLength(3);
  });

  it("builds the request the protocol asks for, with the pages of this site only", () => {
    const payload = buildPayload(ORIGIN, INDEXNOW_KEY, [`${ORIGIN}/`, `${ORIGIN}/en/`, "https://altro.example/pagina", `${ORIGIN}/`]);
    expect(payload).toEqual({ host: "portale.tecnomga.com", key: INDEXNOW_KEY, keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`, urlList: [`${ORIGIN}/`, `${ORIGIN}/en/`] });
  });

  it("waits for the deploy that carries the change: the build online must be newer than the commit", () => {
    expect(deployIsLive({ builtAt: "2026-11-15T16:19:03.699Z" }, "2026-11-15T16:17:00Z")).toBe(true);
    expect(deployIsLive({ builtAt: "2026-11-15T16:19:03.699Z" }, "2026-11-15T17:00:00Z")).toBe(false);
    expect(deployIsLive({}, "2026-11-15T17:00:00Z")).toBe(false);
    expect(deployIsLive({ builtAt: "2026-11-15T16:19:03.699Z" }, undefined)).toBe(true);
  });

  it("reads its options: all pages, how many days back, after which moment, and a dry run that sends nothing", () => {
    expect(parseArgs([])).toEqual({ all: false, days: 2, after: undefined, dryRun: false, origin: ORIGIN });
    expect(parseArgs(["--all", "--dry-run", "--days=7", "--after=2026-11-15T16:17:00Z", "--origin=https://example.test/"])).toEqual({ all: true, days: 7, after: "2026-11-15T16:17:00Z", dryRun: true, origin: "https://example.test" });
  });
});
