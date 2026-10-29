// Pagina VIES, l'agent documentale che non può leggere e le pratiche mentre legge:
// 1 credito API esaurito: la lettura si ferma, il motivo è detto una volta sola e nessuna pratica chiede al cliente
//   documenti o copie più leggibili (i documenti ci sono, non sono stati letti);
// 2 scansioni ancora in lettura: la pratica dice che le sta leggendo, senza errori d'identità o documenti mancanti
//   provvisori; a lettura finita è pronta.
import JSZip from "jszip";
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

const NO_CREDIT = "Credito API dell'agent esaurito: l'amministratore del portale deve ricaricarlo nella Console Anthropic";
const CLIENTS = [
  { zip: "CNTBA00031", name: "Shen Zhen Shi Gamma Mao Yi You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" },
  { zip: "CNTBA00032", name: "Shen Zhen Shi Delta Mao Yi You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E" },
];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const SCANS = CLIENTS.length * Object.keys(TYPES).length;
// Every scan has its own bytes: the agent's readings are kept by file content.
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
const lotZip = async () => {
  const zip = new JSZip();
  for (const client of CLIENTS) for (const kind of Object.keys(TYPES)) zip.file(`${client.zip}/${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
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
  return { name: "Lotto agent.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  const company = type === "documento_identita" ? {} : { latin: client.name, uscc: client.uscc };
  return {
    document_type: type, contained_document_types: [], company_name_latin: company.latin ?? "", company_name_chinese: "",
    unified_social_credit_code: company.uscc ?? "", italian_vat_number: "", legal_representative_name: "", legal_representative_id_number: "",
    fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "", expiry_date: "",
    has_italian_translation: false, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();

// answer(request) gives the agent's reply to one document: { status, body }.
async function open(answer) {
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
      agentCalls.push(request.file_name);
      const { status, body } = await answer(request);
      return json(body, status);
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
const control = async (page) => section(await body(page), "3. Controllo pratiche", "4. Documenti obbligatori");
const row = (text, zip) => {
  const start = text.indexOf(zip);
  const next = CLIENTS.filter((client) => client.zip !== zip).map((client) => text.indexOf(client.zip, start)).filter((index) => index > start);
  return text.slice(start, next.length ? Math.min(...next) : undefined);
};
const LOT_ZIP = await lotZip();
const readExcel = async (page) => {
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
};
const readingDone = (page, timeout) =>
  page.waitForFunction(() => /2 ZIP selezionati/.test(document.body.innerText) && !/Lettura|Indicizzazione in corso|Apertura|letture dell'agent in corso|in lettura/i.test(document.body.innerText), null, { timeout }).catch(() => {});

// 1 Credit exhausted: every reading answers "no credit".
{
  const { ctx, page, pageErrors, agentCalls } = await open(async () => ({ status: 503, body: { error: NO_CREDIT, code: "AGENT_NO_CREDIT" } }));
  await readExcel(page);
  await zipInput(page).setInputFiles(LOT_ZIP);
  await readingDone(page, 90000);
  await page.waitForTimeout(1000);
  const text = await body(page);
  const rows = await control(page);
  check("1 l'agent si ferma: nessun nuovo tentativo e nessuna seconda lettura", agentCalls.length <= SCANS, `${agentCalls.length} chiamate per ${SCANS} scansioni`);
  check("1 il motivo è il credito esaurito", text.includes(NO_CREDIT), text.slice(0, 600));
  for (const client of CLIENTS) {
    const line = row(rows, client.zip);
    check(`1 ${client.zip} bloccata con il credito come motivo`, /Bloccata/.test(line) && line.includes(NO_CREDIT), line);
    check(`1 ${client.zip} cosa fare: ricaricare il credito, non chiedere copie al cliente`, /ricaricare il credito/i.test(line) && !/copie più leggibili/.test(line), line);
    check(`1 ${client.zip} nessun errore d'identità né documento mancante provvisorio`, !/identità non verificabile|Documenti mancanti|Nessun codice leggibile/.test(line), line);
  }
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-agent-no-credit.png", fullPage: true });
  await ctx.close();
}

// 2 Scans still being read: the readings are held until the page has been checked.
{
  let release;
  const held = new Promise((resolve) => (release = resolve));
  const { ctx, page, pageErrors, agentCalls } = await open(async (request) => {
    await held;
    return { status: 200, body: { model: "test", result: reading(request.file_name) } };
  });
  await readExcel(page);
  await zipInput(page).setInputFiles(LOT_ZIP);
  await page.waitForFunction(() => /scansioni in lettura/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  const during = await control(page);
  for (const client of CLIENTS) {
    const line = row(during, client.zip);
    check(`2 ${client.zip} in lettura: lo dice`, /In verifica/.test(line) && /scansioni in lettura/.test(line), line);
    check(`2 ${client.zip} in lettura: nessun errore d'identità né documento mancante provvisorio`, !/identità non verificabile|Nessun codice leggibile|Documenti mancanti|Bloccata/.test(line), line);
  }
  release();
  await readingDone(page, 30000);
  await page.waitForTimeout(1000);
  const after = await control(page);
  for (const client of CLIENTS) check(`2 ${client.zip} a lettura finita è pronta`, /Pronta/.test(row(after, client.zip)) && !/Bloccata/.test(row(after, client.zip)), row(after, client.zip));
  check("2 ogni scansione letta una volta", agentCalls.length === SCANS, `${agentCalls.length} chiamate per ${SCANS} scansioni`);
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-agent-reading.png", fullPage: true });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
