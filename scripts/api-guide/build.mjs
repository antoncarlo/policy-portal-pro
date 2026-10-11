// Genera il PDF della guida all'integrazione API da docs/api/GuidaIntegrazioneAPI-PolicyPortalPro-aggiornata.md
// su carta intestata Tecno Advance MGA.
//
//   npm run docs:api-pdf [-- file-di-uscita.pdf]
//
// Il testo sta nel file Markdown: si modifica lì e si rigenera il PDF (in docs/api/ se non si indica un'uscita).
// Richiede Chromium di Playwright (`npx playwright install chromium`).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, "../../docs/api/GuidaIntegrazioneAPI-PolicyPortalPro-aggiornata.md");
const OUT = resolve(process.argv[2] ?? resolve(HERE, "../../docs/api/GuidaIntegrazioneAPI-PolicyPortalPro-aggiornata.pdf"));
const LOGO = `data:image/png;base64,${readFileSync(resolve(HERE, "../vies-template/logo.png")).toString("base64")}`;

const NAVY = "#1a2547";
const markdown = readFileSync(SOURCE, "utf8");
const version = /\*\*Versione:\*\*\s*([0-9.]+)/.exec(markdown)?.[1] ?? "";

marked.use({ gfm: true, breaks: false });
const body = marked.parse(markdown);

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Guida Integrazione API</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; font-size: 9.6pt; line-height: 1.5; color: #1f2733; margin: 0; }
  .letterhead { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid ${NAVY}; margin-bottom: 18px; }
  .letterhead img { height: 54px; }
  .letterhead .who { text-align: right; color: ${NAVY}; }
  .letterhead .who strong { display: block; font-size: 11pt; }
  .letterhead .who span { font-size: 8.5pt; }
  h1 { font-size: 19pt; color: ${NAVY}; margin: 0 0 14px; line-height: 1.2; }
  h2 { font-size: 13.5pt; color: ${NAVY}; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #d5dbe6; break-after: avoid; }
  h3 { font-size: 11pt; color: ${NAVY}; margin: 18px 0 6px; break-after: avoid; }
  h4 { font-size: 10pt; color: ${NAVY}; margin: 14px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 9px; padding-left: 22px; }
  li { margin: 1px 0; }
  hr { border: 0; border-top: 1px solid #d5dbe6; margin: 16px 0; }
  a { color: ${NAVY}; }
  code { font-family: "DejaVu Sans Mono", "Liberation Mono", Menlo, monospace; font-size: 8.4pt; background: #eef2f8; color: #1a2547; padding: 1px 4px; border-radius: 3px; overflow-wrap: break-word; }
  pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 5px; margin: 8px 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: auto; }
  pre code { background: none; color: inherit; padding: 0; font-size: 7.9pt; line-height: 1.45; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; font-size: 8.6pt; }
  thead { display: table-header-group; }
  th { background: ${NAVY}; color: #fff; font-weight: 700; text-align: left; padding: 5px 7px; }
  td { padding: 5px 7px; vertical-align: top; border-bottom: 1px solid #e6ebf3; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f3f5f9; }
  td code { font-size: 7.9pt; }
  td:first-child code, td:first-child { overflow-wrap: normal; }
  td:first-child code { white-space: nowrap; }
  blockquote { margin: 10px 0 12px; padding: 9px 14px; background: #f6f8fb; border-left: 4px solid ${NAVY}; border-radius: 0 4px 4px 0; break-inside: avoid; }
  blockquote p:last-child { margin-bottom: 0; }
</style>
</head>
<body>
<div class="letterhead">
  <img src="${LOGO}" alt="Tecno Advance MGA">
  <div class="who"><strong>Tecno Advance MGA</strong><span>Policy Portal Pro</span></div>
</div>
${body}
</body>
</html>`;

const work = mkdtempSync(join(tmpdir(), "api-guide-"));
const page_html = join(work, "guide.html");
writeFileSync(page_html, html);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`file://${page_html}`, { waitUntil: "load" });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#6b7280;padding:0 18mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
      <span>Policy Portal Pro · Guida all'Integrazione API${version ? ` · versione ${version}` : ""}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "18mm", bottom: "20mm", left: "18mm", right: "18mm" },
  });
  console.log(`PDF scritto: ${OUT}`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
