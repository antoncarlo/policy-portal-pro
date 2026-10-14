// Genera il documento da firmare su carta intestata Tecno Advance MGA Broker Srl: il MUP unico (Allegato 3 al
// Reg. IVASS 40/2018, incarico di consulenza, raccomandazione, dichiarazione di consegna, informativa privacy e
// questionario antiriciclaggio), il cui testo e' in mup-body.mjs.
//
//   node scripts/signing-templates/build.mjs [cartella-di-uscita]     (predefinita: public/modelli-firma)
//
// I testi stanno in questo file: si modificano qui e si rigenerano i PDF. I file prodotti si caricano in
// Impostazioni > Documenti da firmare (nome: mup.pdf).
// Richiede Chromium di Playwright.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildMup } from "./mup-body.mjs";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(process.argv[2] ?? resolve(HERE, "../../public/modelli-firma"));
const LOGO = `data:image/png;base64,${readFileSync(resolve(HERE, "../vies-template/logo.png")).toString("base64")}`;
const NAVY = "#1a2547";

// Riferimenti dell'intermediario (carta intestata).
const CO = {
  name: "Tecno Advance MGA Broker Srl",
  web: "www.tecnoinsurance.com",
  rui: "B000746484",
  vat: "17460381001",
  legal: "Via Po, 102 - 00198 Roma",
  office: "Via Michele Mercati, 18 - 00197 Roma",
  tel: "06.97638088",
  pec: "tecnoadvancemgabroker@legalmail.it",
  // Responsabile della protezione dei dati (DPO), nominato dal Titolare ai sensi dell'art. 37 GDPR.
  privacy: { name: "Anton Carlo Santoro", email: "antoncarlo@tecnomga.com" },
};

const CSS = `
  @page { size: A4; margin: 27mm 16mm 21mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; font-size: 9pt; line-height: 1.42; color: #1f2733; margin: 0; }
  h1 { font-size: 15pt; color: ${NAVY}; margin: 0 0 4px; line-height: 1.2; }
  .sub { color: #4b5563; font-size: 8.6pt; margin: 0 0 10px; }
  h2 { font-size: 10.5pt; color: ${NAVY}; margin: 14px 0 5px; padding: 3px 0 3px; border-bottom: 1.2px solid ${NAVY}; break-after: avoid; }
  h3 { font-size: 9.4pt; color: ${NAVY}; margin: 10px 0 3px; break-after: avoid; }
  p { margin: 0 0 6px; text-align: left; hyphens: auto; }
  ul { margin: 0 0 6px; padding-left: 18px; } li { margin: 1px 0; }
  .box { border: 1px solid #b8c1d3; background: #f6f8fb; padding: 6px 9px; margin: 6px 0 8px; border-radius: 3px; break-inside: avoid; }
  .lead { margin-bottom: 2px; break-after: avoid; }
  .note { font-size: 8pt; color: #4b5563; }
  .row { display: flex; gap: 10px; margin: 4px 0; align-items: flex-end; }
  .row > * { flex: 1; }
  .fld { display: block; }
  .fld small { display: block; font-size: 7.2pt; color: #6b7280; text-transform: uppercase; letter-spacing: .02em; }
  a.k { display: block; text-decoration: none; color: inherit; }
  .fld i { display: block; border-bottom: 1px solid #1f2733; min-height: 15px; }
  .w2 { flex: 2; } .w3 { flex: 3; } .w05 { flex: .5; }
  .cb.on { background: #1a2547; box-shadow: inset 0 0 0 1.6px #fff; }
  .cb { display: inline-block; width: 9px; height: 9px; border: 1px solid #1f2733; margin-right: 5px; vertical-align: -1px; }
  .opt { display: block; margin: 2px 0 2px 0; padding-left: 15px; text-indent: -15px; }
  .opts { margin: 3px 0 6px; }
  .opts .opt { display: inline-block; margin-right: 14px; }
  .sig { display: flex; gap: 24px; margin-top: 22px; break-inside: avoid; }
  .sig > div { flex: 1; border-top: 1px solid #1f2733; padding-top: 3px; font-size: 8pt; color: #4b5563; }
  .pb { break-before: page; }
  .keep { break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; font-size: 8.4pt; }
  th { background: ${NAVY}; color: #fff; text-align: left; padding: 3px 6px; }
  td { padding: 3px 6px; border-bottom: 1px solid #dfe5ef; vertical-align: top; }
`;

// Un campo con `key` e' precompilabile: il suo riquadro viene registrato in fields.json (vedi piu' sotto).
const KEY_URL = "https://prefill.invalid/";
const f = (label, cls = "", key = "") =>
  `<span class="fld ${cls}"><small>${label}</small>${key ? `<a class="k" href="${KEY_URL}${key}"><i></i></a>` : "<i></i>"}</span>`;
const row = (...cells) => `<div class="row">${cells.join("")}</div>`;
const cb = (item) => (typeof item === "string" ? `<span class="opt"><span class="cb"></span>${item}</span>` : `<span class="opt"><span class="cb on"></span>${item.text}</span>`);
const on = (text) => ({ on: true, text });
const opts = (...items) => `<div class="opts">${items.map(cb).join("")}</div>`;
const stack = (...items) => `<div class="opts">${items.map(cb).join("")}</div>`.replace(/class="opts"/, 'class="opts" style="display:block"');
const policyLine = row(f("Pratica / Polizza n.", "w2", "pratica"), f("Contraente", "w3", "contraente"), f("Codice fiscale / P.IVA", "w2", "cf"));
const sign = (...captions) => `<div class="sig">${captions.map((c) => `<div>${c}</div>`).join("")}</div>`;
const placeDate = row(f("Luogo"), f("Data"));


const inl = (key, width) =>
  `<a class="k" href="${KEY_URL}${key}" style="display:inline-block;width:${width};border-bottom:1px solid #1f2733;min-height:13px;vertical-align:bottom;text-decoration:none">&nbsp;</a>`;

const mup = buildMup({ CO, f, row, cb, on, opts, stack, sign, placeDate, inl });

// ---------------------------------------------------------------------------------------------------
// Un solo documento da firmare: il MUP unico (con incarico, raccomandazione, consegna, privacy e antiriciclaggio).
const docs = [{ file: "mup.pdf", title: "MUP unico", body: mup }];

const page = (title, body) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${title} · ${CO.name}</title><style>${CSS}</style></head><body>${body}</body></html>`;

const header = `<div style="width:100%;padding:0 16mm;display:flex;align-items:center;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;border-bottom:2px solid ${NAVY};padding-bottom:5px;-webkit-print-color-adjust:exact">
  <img src="${LOGO}" style="height:34px">
  <div style="text-align:right;color:${NAVY};font-size:8.5pt;line-height:1.25"><b style="font-size:10.5pt">${CO.name}</b><br>Intermediario assicurativo · RUI n. ${CO.rui}</div></div>`;

const footer = (title) => `<div style="width:100%;padding:0 16mm;font-family:Helvetica,Arial,sans-serif;font-size:6.8pt;color:#4b5563;border-top:1px solid #b8c1d3;padding-top:4px;line-height:1.35">
  <div style="display:flex;justify-content:space-between"><span><b>${CO.name}</b> · Iscr. IVASS (RUI) n. ${CO.rui} · P.IVA ${CO.vat} · ${CO.web}</span><span>${title} · pag. <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>
  <div>Sede legale: ${CO.legal} · Sede operativa: ${CO.office} · Tel. ${CO.tel} · PEC: ${CO.pec}</div></div>`;

/**
 * I campi con chiave sono link verso un indirizzo finto: Chromium li scrive come annotazioni con il loro
 * riquadro. Qui si leggono (pagina, posizione, misura), si salvano in fields.json e si tolgono dal PDF.
 */
async function extractFields(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const fields = [];
  pdf.getPages().forEach((page, pageIndex) => {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) return;
    for (let i = 0; i < annots.size(); i += 1) {
      const annot = annots.lookupMaybe(i, PDFDict);
      const action = annot?.lookupMaybe(PDFName.of("A"), PDFDict);
      const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString);
      const text = uri?.decodeText();
      if (!text?.startsWith(KEY_URL)) continue;
      const rect = annot.lookup(PDFName.of("Rect"), PDFArray).asRectangle();
      fields.push({ key: text.slice(KEY_URL.length), page: pageIndex, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height) });
    }
    page.node.delete(PDFName.of("Annots"));
  });
  return { fields, bytes: await pdf.save() };
}
const round = (value) => Math.round(value * 10) / 10;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const map = {};
try {
  for (const doc of docs) {
    const tab = await browser.newPage();
    await tab.setContent(page(doc.title, doc.body), { waitUntil: "load" });
    const raw = await tab.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer(doc.title),
      margin: { top: "27mm", bottom: "21mm", left: "16mm", right: "16mm" },
    });
    await tab.close();
    const { fields, bytes } = await extractFields(raw);
    writeFileSync(join(OUT_DIR, doc.file), bytes);
    map[doc.file.replace(/\.pdf$/, "")] = fields;
    console.log(`PDF scritto: ${join(OUT_DIR, doc.file)} (${fields.length} campi precompilabili)`);
  }
  writeFileSync(join(OUT_DIR, "fields.json"), `${JSON.stringify(map, null, 1)}\n`);
} finally {
  await browser.close();
}
