// Pagina VIES, lettura dell'agent per estratto: di un PDF scansionato lungo l'agent riceve prima solo le pagine 1, 2 e
// l'ultima (si paga ogni pagina inviata); il documento intero gli arriva solo se nello ZIP manca ancora un documento
// obbligatorio (seconda lettura), e la lettura intera sostituisce quella dell'estratto.
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
import * as XLSX from "xlsx";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const CLIENTS = [
  // Procura di 6 pagine: basta l'estratto.
  { zip: "CNTBA00021", name: "Shen Zhen Shi Alfa Mao Yi You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR",
    scans: ["licenza", "identita", "report", "dichiarazione", "ubo"], pdfs: { mandato: 6 } },
  // Nessun file UBO: la dichiarazione UBO è a pagina 3 di un allegato di 5 pagine, fuori dall'estratto.
  { zip: "CNTBA00022", name: "Shen Zhen Shi Beta Mao Yi You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E",
    scans: ["licenza", "identita", "report", "dichiarazione", "mandato"], pdfs: { allegato: 5 } },
];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
// Every scan has its own bytes: the agent's readings are kept by file content.
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
// A scanned PDF has no text: blank pages, one per page of the document.
const scannedPdf = async (pages) => {
  const doc = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) doc.addPage([595, 842]);
  return doc.save();
};
const lotZip = async () => {
  const zip = new JSZip();
  for (const client of CLIENTS) {
    for (const kind of client.scans) zip.file(`${client.zip}/${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
    for (const [kind, pages] of Object.entries(client.pdfs)) zip.file(`${client.zip}/${client.zip}-${kind}.pdf`, await scannedPdf(pages));
  }
  return { name: `${CLIENTS[0].zip}.zip`, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
};
const HEADER = ["Tipo Anagrafica", "Ragione Sociale", "Tipo Società", "C.F.", "P.IVA", "legale rappresentante", "indirizzo/via-piazza", "numero civico", "città", "cap", "provincia", "nazione", "sede principale", "pec"];
const excel = () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["ZIP", ...HEADER],
    ...CLIENTS.map((client) => [client.zip, "persona giuridica", client.name, "srl", client.vat, client.vat, "Zhang Wei", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", ""]),
  ]), "CONTRAENTE");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "Rappresentante Srl", "srl", "13489331002", "13489331002", "Mario Rossi", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", "rapp@pec.it"]]), "RAPPRESENTANTE FISCALE ");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "AGENZIA DELLE ENTRATE", "ente pubblico", "06363391001", "06363391001", "", "Via Giorgione", "106", "Roma", "00147", "RM", "Italia", "Sì", ""]]), "BENEFICIARIO ");
  return { name: "Lotto estratti.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName, excerpt) => {
  const [zipName, kind] = fileName.replace(/\.(jpg|pdf)$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  // The UBO in the attachment is past the excerpt: only the whole reading finds it.
  const type = kind === "allegato" ? (excerpt ? "altro" : "ubo") : TYPES[kind];
  const company = type === "documento_identita" || type === "altro" ? {} : { latin: client.name, uscc: client.uscc };
  return {
    document_type: type, contained_document_types: [], company_name_latin: company.latin ?? "", company_name_chinese: "",
    unified_social_credit_code: company.uscc ?? "", italian_vat_number: "", legal_representative_name: "", legal_representative_id_number: "",
    fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "", expiry_date: "",
    has_italian_translation: false, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();

async function open() {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const agentCalls = [];
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p === "/functions/v1/vies-document-agent") {
      const request = JSON.parse(req.postData() || "{}");
      if (request.probe) return json({ ready: true });
      const pages = request.media_type === "application/pdf" ? (await PDFDocument.load(Buffer.from(request.data, "base64"))).getPageCount() : null;
      agentCalls.push({ name: request.file_name, excerpt: request.excerpt ?? null, pages });
      return json({ model: "test", result: reading(request.file_name, Boolean(request.excerpt)) });
    }
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(true);
    if (p.includes("/rpc/")) return json([]);
    if (p === "/rest/v1/user_roles") return json([{ user_id: UID, role: "admin" }]);
    if (p === "/rest/v1/user_product_permissions") return json([{ practice_type: "vies" }]);
    if (p === "/rest/v1/profiles") return json([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
    return json([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/vies`, { waitUntil: "networkidle" });
  return { ctx, page, pageErrors, agentCalls };
}
const excelInput = (page) => page.locator('input[type=file][accept=".xlsx,.xls"]');
const zipInput = (page) => page.locator('input[type=file][accept=".zip"]');
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const section = (text, from, to) => text.slice(text.indexOf(from), to && text.indexOf(to) > text.indexOf(from) ? text.indexOf(to) : undefined);
const row = (control, zip) => {
  const start = control.indexOf(zip);
  const next = CLIENTS.filter((client) => client.zip !== zip).map((client) => control.indexOf(client.zip, start)).filter((index) => index > start);
  return control.slice(start, next.length ? Math.min(...next) : undefined);
};
const LOT_ZIP = await lotZip();
const uploadZip = async (page) => {
  await zipInput(page).setInputFiles(LOT_ZIP);
  await page.waitForFunction(() => /2 ZIP selezionati/.test(document.body.innerText) && !/Lettura|Indicizzazione in corso|Apertura|letture dell'agent in corso|in lettura/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
};
const callsFor = (calls, name) => calls.filter((call) => call.name === name);

{
  const { ctx, page, pageErrors, agentCalls } = await open();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
  await uploadZip(page);
  const control = section(await body(page), "3. Controllo pratiche", "4. Documenti obbligatori");

  const mandato = callsFor(agentCalls, "CNTBA00021-mandato.pdf");
  check(
    "1 procura di 6 pagine: l'agent riceve solo le pagine 1, 2 e 6",
    mandato.length === 1 && mandato[0].pages === 3 && JSON.stringify(mandato[0].excerpt) === JSON.stringify({ pages: [1, 2, 6], total_pages: 6 }),
    JSON.stringify(mandato),
  );
  check("1 con tutti i documenti la pratica è pronta, senza seconda lettura", /Pronta/.test(row(control, "CNTBA00021")) && !/Bloccata/.test(row(control, "CNTBA00021")), row(control, "CNTBA00021"));

  const allegato = callsFor(agentCalls, "CNTBA00022-allegato.pdf");
  check(
    "1 UBO oltre l'estratto: prima l'estratto, poi l'allegato intero (5 pagine)",
    allegato.length === 2 && allegato[0].excerpt && allegato[0].pages === 3 && allegato[1].excerpt === null && allegato[1].pages === 5,
    JSON.stringify(allegato),
  );
  check("1 la lettura intera sostituisce l'estratto: UBO trovato, pratica pronta", /Pronta/.test(row(control, "CNTBA00022")) && !/Bloccata/.test(row(control, "CNTBA00022")), row(control, "CNTBA00022"));
  check("1 le scansioni corte (immagini) non vengono rilette", agentCalls.filter((call) => call.name.endsWith(".jpg")).length === 10, JSON.stringify(agentCalls.map((call) => call.name)));

  const firstCalls = agentCalls.length;
  await uploadZip(page);
  check("1 ricaricando lo ZIP l'agent non rilegge né estratti né documenti interi", agentCalls.length === firstCalls, `${firstCalls} → ${agentCalls.length}`);
  check("1 dopo il ricaricamento le pratiche restano pronte", /2 pronte/.test(section(await body(page), "3. Controllo pratiche", "4. Documenti obbligatori")));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-agent-excerpt.png", fullPage: true });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
