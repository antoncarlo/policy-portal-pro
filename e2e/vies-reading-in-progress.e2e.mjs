// Pagina VIES, pratiche mentre i documenti sono ancora in lettura (lotto reale: dopo il caricamento di Excel e ZIP la
// pagina restava piena di righe rosse "Bloccata, documenti mancanti" finché la lettura non arrivava in fondo):
// 0 mentre il portale apre gli ZIP (con 80-110 MB di documenti, la fase più lunga prima dell'agent) nessuna riga
//   compare bloccata o con documenti mancanti, nemmeno per un istante;
// 1 mentre il portale controlla l'agent nessuna riga è bloccata né ha documenti mancanti: è "In verifica", e il
//   riepilogo non conta pratiche bloccate;
// 2 lo stesso mentre l'agent legge le scansioni;
// 3 a lettura finita le pratiche complete sono pronte.
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
  { zip: "CNTBA00051", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" },
  { zip: "CNTBA00052", name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E" },
];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
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
  return { name: "Lotto in lettura.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  return {
    document_type: type, contained_document_types: [], company_name_latin: type === "documento_identita" ? "" : client.name, company_name_chinese: "",
    unified_social_credit_code: type === "documento_identita" ? "" : client.uscc, italian_vat_number: "", legal_representative_name: "",
    legal_representative_id_number: "", fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "", expiry_date: "",
    has_italian_translation: false, is_signed: true, issues: [],
  };
};
// A gate the test opens by hand: the mocked agent answers only once it is open.
const gate = () => {
  let open;
  const promise = new Promise((resolve) => (open = resolve));
  return { promise, open, reached: false };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
const probeGate = gate();
const readingGate = gate();
const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
await ctx.route(`${SUPA}/**`, async (route) => {
  const req = route.request(); const p = new URL(req.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  if (p === "/functions/v1/vies-document-agent") {
    const request = JSON.parse(req.postData() || "{}");
    if (request.probe) {
      probeGate.reached = true;
      await probeGate.promise;
      return json({ ready: true });
    }
    readingGate.reached = true;
    await readingGate.promise;
    return json({ model: "test", result: reading(request.file_name) });
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

const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const control = async () => {
  const text = await body();
  const from = text.indexOf("3. Controllo pratiche");
  const to = text.indexOf("4. Documenti obbligatori");
  return text.slice(from, to > from ? to : undefined);
};
const row = (text, zip) => {
  const start = text.indexOf(zip);
  const next = CLIENTS.filter((client) => client.zip !== zip).map((client) => text.indexOf(client.zip, start)).filter((index) => index > start);
  return text.slice(start, next.length ? Math.min(...next) : undefined);
};
const waitFor = async (condition, timeout = 15000) => {
  const until = Date.now() + timeout;
  while (!condition() && Date.now() < until) await page.waitForTimeout(100);
  return condition();
};
const judgedTooEarly = (line) => /Bloccata|Documenti mancanti|non verrà creata/.test(line);

await page.locator('input[type=file][accept=".xlsx,.xls"]').setInputFiles(excel());
await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
// Every state the page shows while reading, even for a moment: a row judged before its documents are read is recorded.
await page.evaluate(() => {
  window.__judgedTooEarly = [];
  window.__watchReading = true;
  const watch = () => {
    if (!window.__watchReading) return;
    const text = document.body.innerText.replace(/\s+/g, " ");
    const section = text.slice(text.indexOf("3. Controllo pratiche"), text.indexOf("4. Documenti obbligatori"));
    for (const seen of section.match(/Bloccata|Documenti mancanti|\d+ bloccate/g) ?? []) {
      if (!window.__judgedTooEarly.includes(seen)) window.__judgedTooEarly.push(seen);
    }
  };
  new MutationObserver(watch).observe(document.body, { childList: true, subtree: true, characterData: true });
});
await page.locator('input[type=file][accept=".zip"]').setInputFiles(await lotZip());

// 1 The ZIPs are open, the agent check has not answered yet.
check("1 il portale arriva al controllo dell'agent", await waitFor(() => probeGate.reached));
await page.waitForTimeout(800);
{
  const rows = await control();
  for (const client of CLIENTS) {
    const line = row(rows, client.zip);
    check(`1 ${client.zip} in verifica, non bloccata, nessun documento mancante`, /In verifica/.test(line) && !judgedTooEarly(line), line);
  }
  check("1 il riepilogo non conta pratiche bloccate", !/\d+ bloccate/.test(rows), rows.slice(0, 400));
  await page.screenshot({ path: SHOTS + "vies-reading-in-progress-probe.png", fullPage: true });
}
probeGate.open();

// 2 The agent is reading the scans.
check("2 l'agent riceve le scansioni", await waitFor(() => readingGate.reached));
await page.waitForTimeout(800);
{
  const rows = await control();
  for (const client of CLIENTS) {
    const line = row(rows, client.zip);
    check(`2 ${client.zip} in verifica durante la lettura, non bloccata`, /In verifica/.test(line) && !judgedTooEarly(line), line);
  }
  check("2 il riepilogo non conta pratiche bloccate", !/\d+ bloccate/.test(rows), rows.slice(0, 400));
}
const judgedTooEarly0 = await page.evaluate(() => {
  window.__watchReading = false;
  return window.__judgedTooEarly;
});
check("0 durante apertura ZIP e lettura nessuna riga è mai comparsa bloccata o con documenti mancanti", judgedTooEarly0.length === 0, JSON.stringify(judgedTooEarly0));
readingGate.open();

// 3 Reading done.
await page.waitForFunction(() => !/in lettura|Lettura|Apertura|letture dell'agent in corso|In verifica/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
{
  const rows = await control();
  for (const client of CLIENTS) {
    const line = row(rows, client.zip);
    check(`3 ${client.zip} pronta a lettura finita`, /Pronta/.test(line) && !/Bloccata/.test(line), line);
  }
  check("3 riepilogo: 2 pronte", /2 pronte/.test(rows), rows.slice(0, 200));
}
check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
