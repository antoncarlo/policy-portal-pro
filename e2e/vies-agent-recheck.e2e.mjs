// Pagina VIES, codici letti male dall'agent (lotto reale, CNTBA03717: 91440300MA5GX639XR letto 9144030MA5GX639XR,
// uno 0 saltato su una scansione ruotata a caratteri piccoli):
// 1 un codice con cifra di controllo errata fa rileggere quel documento una volta dal modello più capace: se la
//   rilettura è giusta la pratica è pronta;
// 2 se anche la rilettura sbaglia ma lo stesso codice è letto bene in un altro documento dello ZIP, è un avviso;
// 3 un codice letto male non blocca mai la pratica (una scansione cattiva non dice di chi è il documento): resta un
//   avviso, e la pratica si blocca solo per un documento mancante o di un'altra società;
// 4 una lettura sbagliata già in memoria nella scheda viene riletta al caricamento successivo, senza rileggere il resto.
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

const CLIENTS = [
  { zip: "CNTBA00041", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" },
  { zip: "CNTBA00042", name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E" },
];
// One 0 of "00" missed, as in the real lot; and an invalid code far from the client's (5 characters off).
const MISREAD = "9144030MA5GX639XR";
const FAR = "91440300MA5GX0J87X";
const LICENCE = `${CLIENTS[0].zip}-licenza.jpg`;
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const SCANS = CLIENTS.length * Object.keys(TYPES).length;
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
  return { name: "Lotto codici.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
// licence(recheck) is the code the agent reads on the first client's business licence.
const reading = (fileName, licence) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  const uscc = type === "documento_identita" ? "" : fileName === LICENCE ? licence : client.uscc;
  return {
    document_type: type, contained_document_types: [], company_name_latin: type === "documento_identita" ? "" : client.name, company_name_chinese: "",
    unified_social_credit_code: uscc, italian_vat_number: "", legal_representative_name: "", legal_representative_id_number: "",
    fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "", expiry_date: "",
    has_italian_translation: false, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();

// licence({ recheck }) gives the code read on the first client's licence, or null for an agent error on that reading.
async function open(licence) {
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
      const recheck = request.recheck === true;
      agentCalls.push({ name: request.file_name, recheck });
      const code = request.file_name === LICENCE ? licence.current({ recheck }) : undefined;
      if (code === null) return json({ error: "Documento non elaborabile: errore di prova", code: "AGENT_BAD_REQUEST" }, 400);
      return json({ model: "test", result: reading(request.file_name, code) });
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
const upload = async (page, first = true) => {
  if (first) {
    await excelInput(page).setInputFiles(excel());
    await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
  }
  await zipInput(page).setInputFiles(LOT_ZIP);
  await page.waitForFunction(() => /2 ZIP selezionati/.test(document.body.innerText) && !/Lettura|Indicizzazione in corso|Apertura|letture dell'agent in corso|in lettura/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
};
const licenceCalls = (calls) => calls.filter((call) => call.name === LICENCE);
const ready = (line) => /Pronta/.test(line) && !/Bloccata/.test(line);

// 1 The licence is read with one 0 missing; read again by the more capable model, it is right.
{
  const licence = { current: ({ recheck }) => (recheck ? CLIENTS[0].uscc : MISREAD) };
  const { ctx, page, pageErrors, agentCalls } = await open(licence);
  await upload(page);
  const rows = await control(page);
  const line = row(rows, CLIENTS[0].zip);
  check("1 la licenza letta male viene riletta una volta, con la richiesta di rilettura", JSON.stringify(licenceCalls(agentCalls).map((call) => call.recheck)) === "[false,true]", JSON.stringify(licenceCalls(agentCalls)));
  check("1 gli altri documenti non vengono riletti", agentCalls.length === SCANS + 1, `${agentCalls.length} chiamate per ${SCANS} scansioni`);
  check("1 con la rilettura giusta la pratica è pronta, senza errori di codice", ready(line) && !/letto non valid/.test(line), line);
  check("1 l'altra pratica è pronta", ready(row(rows, CLIENTS[1].zip)), row(rows, CLIENTS[1].zip));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2 The rereading is wrong too, but the same code is read well on the other documents of the ZIP.
{
  const licence = { current: () => MISREAD };
  const { ctx, page, pageErrors } = await open(licence);
  await upload(page);
  const line = row(await control(page), CLIENTS[0].zip);
  check("2 codice letto male ma confermato dagli altri documenti: la pratica è pronta", ready(line), line);
  check("2 resta un avviso con il codice letto male e quello confermato", line.includes(MISREAD) && line.includes(CLIENTS[0].uscc), line);
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-agent-recheck-warning.png", fullPage: true });
  await ctx.close();
}

// 3 An invalid code far from the codes read well: only a warning, the company is verified by the other documents.
{
  const licence = { current: () => FAR };
  const { ctx, page, pageErrors } = await open(licence);
  await upload(page);
  const line = row(await control(page), CLIENTS[0].zip);
  check("3 codice letto male lontano da quelli letti bene: la pratica è pronta", ready(line), line);
  check("3 resta un avviso con il codice letto male", line.includes(`letto non valido: ${FAR}`), line);
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4 A wrong reading kept in the tab (the rereading had failed) is read again at the next upload, and only it.
{
  let rereadWorks = false;
  const licence = { current: ({ recheck }) => (recheck ? (rereadWorks ? CLIENTS[0].uscc : null) : FAR) };
  const { ctx, page, pageErrors, agentCalls } = await open(licence);
  await upload(page);
  const before = row(await control(page), CLIENTS[0].zip);
  check("4 rilettura non riuscita: la pratica è pronta con l'avviso del codice", ready(before) && before.includes(`letto non valido: ${FAR}`), before);
  const firstCalls = agentCalls.length;
  rereadWorks = true;
  await upload(page, false);
  const after = row(await control(page), CLIENTS[0].zip);
  const newCalls = agentCalls.slice(firstCalls);
  check("4 al nuovo caricamento solo la lettura sbagliata viene riletta", newCalls.length === 1 && newCalls[0].name === LICENCE && newCalls[0].recheck, JSON.stringify(newCalls));
  check("4 con la rilettura giusta la pratica è pronta", ready(after) && !/letto non valid/.test(after), after);
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
