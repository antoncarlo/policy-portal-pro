// Immagini per i social (1200x630), una per lingua: public/site-media/og-{it,en,zh}.png.
// Sono mostrate quando si condivide un link del sito (og:image, twitter:image). Si rigenerano a mano quando
// cambiano il titolo della homepage, i tre dati della garanzia o l'immagine dell'apertura:
//
//   node scripts/site/og-images.mjs
//
// Serve Chromium (lo stesso dei test del browser). I testi vengono dai contenuti del sito (src/site/content),
// cosi' l'immagine dice sempre le stesse parole della pagina.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "public/site-media");
const file = (relative) => pathToFileURL(path.join(root, relative)).href;
const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const server = await createServer({ root, configFile: false, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
const { contentFor } = await server.ssrLoadModule("/src/site/content/index.ts");
const { COMPANY, HREFLANG, LANGS, DEFAULT_ORIGIN } = await server.ssrLoadModule("/src/site/config.ts");

const page = (lang) => {
  const content = contentFor(lang);
  const cjk = lang === "zh";
  return `<!doctype html><html lang="${HREFLANG[lang]}"><head><meta charset="utf-8"><style>
@font-face { font-family: "Lora"; font-weight: 600; src: url("${file("node_modules/@fontsource/lora/files/lora-latin-600-normal.woff2")}") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 500; src: url("${file("node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2")}") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 600; src: url("${file("node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2")}") format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; color: #fff; font-family: "Inter", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif; background: #061826; }
.bg { position: absolute; inset: 0; background: url("${file("public/site-media/vies-vetro-apertura.webp")}") right center / cover no-repeat; }
.shade { position: absolute; inset: 0; background: linear-gradient(90deg, #061826 0%, rgba(6, 24, 38, 0.94) 38%, rgba(6, 24, 38, 0.35) 72%, rgba(6, 24, 38, 0.1) 100%); }
.frame { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 56px 64px 52px; }
.logo { height: 76px; width: auto; align-self: flex-start; }
.eyebrow { display: flex; align-items: center; gap: 14px; font-size: 19px; font-weight: 600; letter-spacing: ${cjk ? "0.06em" : "0.14em"}; text-transform: uppercase; color: #c9a882; }
.eyebrow::before { content: ""; width: 44px; height: 2px; background: currentColor; }
h1 { max-width: 780px; margin-top: 18px; font-family: ${cjk ? '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif' : '"Lora", Georgia, serif'}; font-size: ${cjk ? 62 : 66}px; font-weight: ${cjk ? 700 : 600}; line-height: 1.1; letter-spacing: ${cjk ? "0" : "-0.015em"}; }
.facts { display: flex; gap: 14px; margin-top: 30px; }
.fact { padding: 12px 22px; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 999px; background: rgba(255, 255, 255, 0.1); font-size: 24px; font-weight: 600; white-space: nowrap; }
.foot { display: flex; align-items: center; justify-content: space-between; font-size: 20px; font-weight: 500; color: #c5d6e3; }
.foot strong { color: #fff; font-weight: 600; }
</style></head><body>
<div class="bg"></div><div class="shade"></div>
<div class="frame">
  <img class="logo" src="${file("public/site-media/tecno-mga-logo-chiaro.svg")}" alt="">
  <div>
    <p class="eyebrow">${escape(content.hero.card.title)}</p>
    <h1>${escape(content.meta.home.h1)}</h1>
    <div class="facts">${content.hero.facts.map((fact) => `<span class="fact">${escape(fact.value)}</span>`).join("")}</div>
  </div>
  <p class="foot"><strong>${escape(DEFAULT_ORIGIN.replace(/^https?:\/\//, ""))}</strong><span>${escape(COMPANY.name)} · RUI ${escape(COMPANY.rui)}</span></p>
</div></body></html>`;
};

const work = mkdtempSync(path.join(tmpdir(), "og-"));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const lang of LANGS) {
    const html = path.join(work, `og-${lang}.html`);
    writeFileSync(html, page(lang));
    const tab = await context.newPage();
    await tab.goto(pathToFileURL(html).href, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const target = path.join(out, `og-${lang}.png`);
    await tab.screenshot({ path: target, type: "png" });
    await tab.close();
    console.log(`og-${lang}.png ${readFileSync(target).length} byte`);
  }
} finally {
  await browser.close();
  await server.close();
  rmSync(work, { recursive: true, force: true });
}
