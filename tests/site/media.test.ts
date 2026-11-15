import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGS, readSiteEnv } from "../../src/site/config";
import { renderAll, renderPage } from "../../src/site/render";
import { pathOf } from "../../src/site/routes";
import { socialImage } from "../../src/site/seo";

const assets = { css: ["/assets/site-abc.css"], js: "/assets/site-abc.js" };
const env = readSiteEnv({});
const publicFile = (url: string) => `public${url}`;

describe("public site: images and video", () => {
  it("the opening shows a still image at once and leaves the video to the script: nothing heavy loads by itself", () => {
    for (const lang of LANGS) {
      const html = renderPage(pathOf("home", lang), assets, env) as string;
      const video = html.match(/<video\b[^>]*>[\s\S]*?<\/video>/)?.[0] ?? "";
      expect(video, lang).toMatch(/<video[^>]*data-hero-video/);
      for (const attribute of ["muted", "loop", "playsInline", 'preload="none"', 'aria-hidden="true"', 'poster="/site-media/vies-vetro-apertura.webp"']) expect(video.toLowerCase(), `${lang}: ${attribute}`).toContain(attribute.toLowerCase());
      // The sources carry the address in data-src: without the script, or with «reduce motion», no video is fetched.
      expect(video).toMatch(/<source[^>]*data-src="\/site-media\/vies-vetro-apertura\.webm"[^>]*type="video\/webm"/);
      expect(video).toMatch(/<source[^>]*data-src="\/site-media\/vies-vetro-apertura\.mp4"[^>]*type="video\/mp4"/);
      expect(video).not.toMatch(/<source[^>]*\ssrc=/);
      expect(video).not.toMatch(/autoplay/i);
    }
  });

  it("decorative images say nothing to a screen reader and never shift the page while loading", () => {
    const html = renderPage("/", assets, env) as string;
    const art = html.match(/<img\b[^>]*vies-lastre-vetro\.webp[^>]*>/)?.[0] ?? "";
    expect(art).toMatch(/\salt=""/);
    expect(art).toMatch(/\swidth="\d+"/);
    expect(art).toMatch(/\sheight="\d+"/);
    expect(art).toMatch(/loading="lazy"/);
  });

  it("every file the pages and the stylesheet point to under /site-media/ exists", () => {
    const wanted = new Set<string>();
    for (const { html } of renderAll(assets, env)) for (const [url] of html.matchAll(/\/site-media\/[A-Za-z0-9._-]+/g)) wanted.add(url);
    for (const [url] of readFileSync("src/site/site.css", "utf8").matchAll(/\/site-media\/[A-Za-z0-9._-]+/g)) wanted.add(url);
    expect(wanted.size).toBeGreaterThanOrEqual(7);
    for (const url of wanted) expect(existsSync(publicFile(url)), url).toBe(true);
  });

  it("there is a 1200x630 image for the social networks in each language", () => {
    for (const lang of LANGS) {
      const url = new URL(socialImage(env, lang)).pathname;
      expect(url).toBe(`/site-media/og-${lang}.png`);
      const bytes = readFileSync(publicFile(url));
      // PNG: width and height are in the header.
      expect(bytes.readUInt32BE(16)).toBe(1200);
      expect(bytes.readUInt32BE(20)).toBe(630);
    }
  });

  it("nothing in /site-media/ is heavy: 1.5 MB for a video, 700 kB for an image", () => {
    for (const name of ["vies-vetro-apertura.webm", "vies-vetro-apertura.mp4"]) expect(statSync(`public/site-media/${name}`).size, name).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    for (const name of ["vies-vetro-apertura.webp", "vies-onde-blu.webp", "vies-lastre-vetro.webp", "og-it.png", "og-en.png", "og-zh.png"]) expect(statSync(`public/site-media/${name}`).size, name).toBeLessThanOrEqual(700 * 1024);
  });
});
