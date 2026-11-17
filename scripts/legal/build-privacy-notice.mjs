// Genera il PDF dell'informativa privacy generale su carta intestata Tecno Advance MGA Broker Srl, dal testo di
// privacy-notice.mjs, come i documenti da firmare del portale (HTML stampato con Chromium di Playwright).
//
//   node scripts/legal/build-privacy-notice.mjs
//
// Scrive sites/tecnomga/public/documenti/informativa-privacy.pdf. Nelle parole chiave del PDF mette l'impronta
// SHA-256 del testo: il test tests/corp/privacy-notice.test.ts verifica che il PDF pubblicato sia quello del
// testo attuale.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { COMPANY, NOTICE_FILE, NOTICE_TITLE, NOTICE_VERSION, noticeHtml, noticeText } from "./privacy-notice.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGO = `data:image/png;base64,${readFileSync(resolve(HERE, "../vies-template/logo.png")).toString("base64")}`;
const NAVY = "#1a2547";
const CO = COMPANY;

const CSS = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; font-size: 9.6pt; line-height: 1.5; color: #1f2733; margin: 0; }
  h1 { font-size: 13.5pt; color: ${NAVY}; margin: 0 0 12px; line-height: 1.3; }
  h2 { font-size: 10.5pt; color: ${NAVY}; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1.2px solid ${NAVY}; break-after: avoid; }
  p { margin: 0 0 7px; text-align: justify; hyphens: auto; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; } li { margin: 2px 0; text-align: justify; }
  ol { list-style: none; padding-left: 4px; }
  .version { margin-top: 18px; text-align: right; color: #4b5563; font-size: 8.6pt; }
`;

const header = `<div style="width:100%;padding:0 16mm;display:flex;align-items:center;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;border-bottom:2px solid ${NAVY};padding-bottom:5px;-webkit-print-color-adjust:exact">
  <img src="${LOGO}" style="height:34px">
  <div style="text-align:right;color:${NAVY};font-size:8.5pt;line-height:1.25"><b style="font-size:10.5pt">${CO.name}</b><br>Intermediario assicurativo · RUI n. ${CO.rui}</div></div>`;

const footer = `<div style="width:100%;padding:0 16mm;font-family:Helvetica,Arial,sans-serif;font-size:6.8pt;color:#4b5563;border-top:1px solid #b8c1d3;padding-top:4px;line-height:1.35">
  <div style="display:flex;justify-content:space-between"><span><b>${CO.name}</b> · Iscr. IVASS (RUI) n. ${CO.rui} · P.IVA ${CO.vat} · ${CO.web}</span><span>${NOTICE_VERSION} · pag. <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>
  <div>Sede legale: ${CO.legal} · Sede operativa: ${CO.office} · Tel. ${CO.tel} · ${CO.email} · PEC: ${CO.pec}</div></div>`;

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${NOTICE_TITLE}</title><style>${CSS}</style></head><body>${noticeHtml()}</body></html>`;

const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.setContent(html, { waitUntil: "load" });
  const raw = await tab.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: header,
    footerTemplate: footer,
    margin: { top: "27mm", bottom: "21mm", left: "16mm", right: "16mm" },
  });
  const pdf = await PDFDocument.load(raw);
  pdf.setTitle(NOTICE_TITLE, { showInWindowTitleBar: true });
  pdf.setAuthor(CO.name);
  pdf.setSubject(`Informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 · ${NOTICE_VERSION}`);
  pdf.setKeywords([`testo-sha256:${createHash("sha256").update(noticeText()).digest("hex")}`]);
  pdf.setLanguage("it-IT");
  writeFileSync(NOTICE_FILE, await pdf.save());
  console.log(`PDF scritto: ${NOTICE_FILE} (${pdf.getPageCount()} pagine)`);
} finally {
  await browser.close();
}
