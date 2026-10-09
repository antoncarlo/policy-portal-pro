// Genera la guida operativa VIES in PDF (italiano, inglese, cinese) su carta intestata Tecno Advance MGA.
// Uso:  node scripts/vies-guide/build.mjs [file-di-uscita.pdf]
// Richiede Playwright con Chromium installati globalmente (come nell'ambiente di sviluppo) e,
// per il cinese, un font CJK di sistema (WenQuanYi Zen Hei o Noto Sans CJK).
// Il testo sta in content.mjs; il link del portale si cambia lì (PORTAL_LINK) e si rigenera il PDF.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CONTACT_EMAIL, FIGURES, GUIDE, PEC, PORTAL_LINK, SECTION_FIGURES, VERIFY_LINK } from "./content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? "Guida_Operativa_VIES.pdf");
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(process.execPath, "../../lib/node_modules/playwright"));

const logo = `data:image/png;base64,${readFileSync(resolve(HERE, "../vies-template/logo.png")).toString("base64")}`;

const NAVY = "#103657";
const BRONZE = "#ac7e59";

// Dati societari: gli stessi dell'intestazione degli estratti conto (src/lib/viesStatementPdf.ts).
const COMPANY = {
  name: "Tecno Advance MGA Broker Srl",
  ivass: "B000746484",
  vat: "17460381001",
  legal: "Viale Parioli, 74 - 00197 Roma",
  ops: "Via Michele Mercati, 18 - 00197 Roma",
};

const LABELS = {
  it: { legal: "Sede legale", ops: "Sede operativa", ivass: "Iscr. IVASS n.", vat: "P.IVA", email: "Email", pec: "Pec", date: "Ottobre 2026" },
  en: { legal: "Registered office", ops: "Operating office", ivass: "IVASS reg. no.", vat: "VAT no.", email: "Email", pec: "PEC", date: "October 2026" },
  zh: { legal: "注册地址", ops: "运营地址", ivass: "IVASS 注册号", vat: "增值税号", email: "邮箱", pec: "PEC", date: "2026 年 10 月" },
};

const verifyLink = `<strong>${VERIFY_LINK}</strong>`;

const FIGURE_LABEL = { it: "Fig.", en: "Fig.", zh: "图" };
const screenUrl = (file) => pathToFileURL(resolve(HERE, "screens", file)).href;

// Screenshots of the portal (Chinese interface) that illustrate a section; numbered per language.
const renderFigure = (id, lang, number) => {
  const figure = FIGURES[id];
  if (!figure) throw new Error(`Schermata sconosciuta: ${id}`);
  return `<figure class="fig" style="width:${figure.width}"><img src="${screenUrl(figure.file)}" alt=""><figcaption><b>${FIGURE_LABEL[lang]} ${number}</b> · ${figure.caption[lang]}</figcaption></figure>`;
};

const renderBlock = (block, lang) => {
  const labels = LABELS[lang];
  switch (block.t) {
    case "p":
      return `<p>${block.x}</p>`;
    case "h3":
      return `<h3>${block.x}</h3>`;
    case "ul":
      return `<ul>${block.items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol class="steps">${block.items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
    case "note":
      return `<div class="note">${block.x}</div>`;
    case "link":
      return `<div class="link"><span>${block.label}</span><a href="${PORTAL_LINK}">${PORTAL_LINK}</a></div>`;
    case "contacts":
      return `<div class="contacts">
        <strong>${COMPANY.name}</strong><br>
        ${labels.ivass} ${COMPANY.ivass} · ${labels.vat} ${COMPANY.vat}<br>
        ${labels.legal}: ${COMPANY.legal}<br>
        ${labels.ops}: ${COMPANY.ops}<br>
        ${labels.email}: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> · ${labels.pec}: ${PEC}
      </div>`;
    case "table": {
      const cols = block.widths ? `<colgroup>${block.widths.map((w) => `<col style="width:${w}">`).join("")}</colgroup>` : "";
      const head = `<thead><tr>${block.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
      const body = `<tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table>${cols}${head}${body}</table>`;
    }
    default:
      throw new Error(`Blocco sconosciuto: ${block.t}`);
  }
};

// A table keeps its heading and introduction on the same page: [h3] [p] table → one unbreakable group.
const groupBlocks = (blocks) => {
  const groups = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const [a, b, c] = [blocks[i], blocks[i + 1], blocks[i + 2]];
    if (a.t === "h3" && b?.t === "p" && c?.t === "table") {
      groups.push([a, b, c]);
      i += 2;
    } else if ((a.t === "p" || a.t === "h3") && b?.t === "table") {
      groups.push([a, b]);
      i += 1;
    } else if (a.t === "table" && b?.t === "note") {
      groups.push([a, b]); // a table and the note that comments it stay together
      i += 1;
    } else {
      groups.push([a]);
    }
  }
  return groups;
};

const renderLanguage = (guide) => {
  const lang = guide.lang;
  const overview = guide.overview
    .map((text, index) => `<div class="stage"><span class="n">${index + 1}</span><span class="t">${text}</span></div>`)
    .join("");
  let figureNumber = 0;
  const sections = guide.sections
    .map((section, index) => {
      const heading = `<h2><span class="num">${index + 1}</span>${section.title}</h2>`;
      const groups = groupBlocks(section.blocks).map((group) => ({
        html: group.map((block) => renderBlock(block, lang)).join("\n"),
        keep: group.length > 1,
      }));
      const figures = (SECTION_FIGURES[index] ?? []).map((id) => ({ html: renderFigure(id, lang, (figureNumber += 1)), keep: false }));
      // The section heading travels with the first group, so it is never left alone at the bottom of a page.
      const [first, ...rest] = [...groups, ...figures];
      return `<section><div class="keep">${heading}${first.html}</div>${rest
        .map((group) => (group.keep ? `<div class="keep">${group.html}</div>` : group.html))
        .join("\n")}</section>`;
    })
    .join("\n");
  return `<article class="lang" lang="${lang === "zh" ? "zh-CN" : lang}">
    <div class="tag"><span>${guide.tag}</span><span class="date">${LABELS[lang].date}</span></div>
    <h1>${guide.title}</h1>
    <p class="summary">${guide.summary}</p>
    <div class="overview"><h3>${guide.overviewTitle}</h3><div class="stages">${overview}</div></div>
    ${sections}
  </article>`.replaceAll("VERIFY_LINK", verifyLink);
};

const css = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Arial, Helvetica, "WenQuanYi Zen Hei", "Noto Sans CJK SC", sans-serif; font-size: 9pt; line-height: 1.45; color: #1d2433; }
  .lang + .lang { break-before: page; }
  .lang[lang="zh-CN"] { font-family: "WenQuanYi Zen Hei", "Noto Sans CJK SC", Arial, sans-serif; line-height: 1.65; }
  .tag { display: flex; justify-content: space-between; align-items: center; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: ${BRONZE}; font-weight: bold; border-bottom: 1px solid #d0d5dd; padding-bottom: 5px; margin-bottom: 14px; }
  .tag .date { color: #667085; font-weight: normal; letter-spacing: .04em; }
  h1 { color: ${NAVY}; font-size: 22pt; line-height: 1.15; margin: 0 0 8px; font-weight: bold; }
  .summary { font-style: italic; color: #475467; font-size: 10pt; margin: 0 0 16px; }
  h2 { color: ${NAVY}; font-size: 12.2pt; margin: 17px 0 7px; padding: 0 0 5px; border-bottom: 2px solid ${BRONZE}; display: flex; align-items: center; gap: 9px; break-after: avoid; }
  h2 .num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: ${NAVY}; color: #fff; font-size: 9pt; flex: none; }
  h3 { color: ${NAVY}; font-size: 10pt; margin: 11px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 9px; padding-left: 20px; }
  li { margin-bottom: 3px; }
  ol.steps { list-style: none; padding-left: 0; counter-reset: s; }
  ol.steps li { counter-increment: s; position: relative; padding-left: 28px; margin-bottom: 6px; break-inside: avoid; }
  ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 1px; width: 18px; height: 18px; border-radius: 50%; background: ${BRONZE}; color: #fff; font-size: 8.5pt; font-weight: bold; text-align: center; line-height: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 5px 0 10px; font-size: 8.3pt; table-layout: fixed; break-inside: avoid; }
  th { background: ${NAVY}; color: #fff; font-weight: bold; text-align: left; padding: 5px 7px; border: 1px solid ${NAVY}; }
  td { padding: 5px 7px; border: 1px solid #d0d5dd; vertical-align: top; word-wrap: break-word; }
  tbody tr:nth-child(even) td { background: #f2f4f7; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .keep { break-inside: avoid; }
  .note { background: #f2f4f7; border-left: 4px solid ${BRONZE}; padding: 7px 11px; margin: 7px 0 10px; font-size: 8.7pt; break-inside: avoid; }
  .link { background: ${NAVY}; color: #fff; border-radius: 6px; padding: 10px 14px; margin: 4px 0 12px; break-inside: avoid; }
  .link span { display: block; font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: #e1c3a6; margin-bottom: 2px; }
  .link a { color: #fff; font-size: 13pt; font-weight: bold; text-decoration: none; }
  .contacts { border: 1px solid #d0d5dd; border-radius: 6px; padding: 10px 14px; margin: 4px 0 10px; line-height: 1.6; break-inside: avoid; }
  .contacts a { color: ${NAVY}; }
  .overview { background: #f7f8fa; border: 1px solid #e4e7ec; border-radius: 8px; padding: 10px 12px 12px; margin: 0 0 6px; break-inside: avoid; }
  .overview h3 { margin: 0 0 8px; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: ${BRONZE}; }
  .stages { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
  .stage { background: #fff; border: 1px solid #d0d5dd; border-top: 3px solid ${NAVY}; border-radius: 4px; padding: 6px 7px; font-size: 7.8pt; line-height: 1.3; min-height: 54px; }
  .stage .n { display: block; color: ${BRONZE}; font-weight: bold; font-size: 11pt; margin-bottom: 1px; }
  .lang[lang="zh-CN"] .stage { line-height: 1.45; }
  strong { color: inherit; }
  .fig { margin: 8px auto 12px; break-inside: avoid; text-align: center; }
  .fig img { display: block; width: 100%; height: auto; border: 1px solid #d0d5dd; border-radius: 4px; }
  .fig figcaption { font-size: 7.8pt; line-height: 1.4; color: #475467; margin-top: 4px; text-align: left; }
  .fig figcaption b { color: ${BRONZE}; }
`;

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${["it", "en", "zh"]
  .map((code) => renderLanguage(GUIDE[code]))
  .join("\n")}</body></html>`;

// Carta intestata: logo e titolo in testata, dati societari e numero di pagina a piè.
const headerTemplate = `<div style="width:100%; padding:0 18mm; font-family: Arial, 'WenQuanYi Zen Hei', sans-serif; -webkit-print-color-adjust:exact;">
  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid ${BRONZE}; padding-bottom:5px;">
    <img src="${logo}" style="height:34px;">
    <span style="font-size:7.5px; color:#667085; letter-spacing:.04em;">Guida operativa VIES · VIES Operating Guide · VIES 操作指南</span>
  </div>
</div>`;

const footerTemplate = `<div style="width:100%; padding:0 18mm; font-family: Arial, 'WenQuanYi Zen Hei', sans-serif; font-size:6.8px; color:#667085; -webkit-print-color-adjust:exact;">
  <div style="border-top:1px solid #d0d5dd; padding-top:5px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
    <div style="line-height:1.55;">
      <strong style="color:${NAVY};">${COMPANY.name}</strong> · Iscr. IVASS n. ${COMPANY.ivass} · P.Iva ${COMPANY.vat}<br>
      Sede Legale: ${COMPANY.legal} · Sede Operativa: ${COMPANY.ops}<br>
      Pec: ${PEC} · ${CONTACT_EMAIL}
    </div>
    <div style="white-space:nowrap; font-size:7.5px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>
  </div>
</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // The page is loaded from a file:// URL so that it can reference the screenshots on disk.
  const workDir = mkdtempSync(resolve(tmpdir(), "vies-guide-"));
  const htmlFile = resolve(workDir, "guide.html");
  writeFileSync(htmlFile, html);
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
  rmSync(workDir, { recursive: true, force: true });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: "29mm", bottom: "23mm", left: "18mm", right: "18mm" },
  });
  writeFileSync(OUT, pdf);
  console.log(`ok → ${OUT} (${(pdf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
