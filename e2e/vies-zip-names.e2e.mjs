// Pagina VIES: la colonna ZIP accetta codici cliente e sigle (non solo 1 … 20) e ogni riga trova il suo ZIP
// qualunque siano maiuscole e minuscole: ZIP separati, un unico ZIP con una cartella per cliente, ZIP prima dell'Excel.
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

// Excel del lotto come il modello della compagnia: codici cliente nella colonna ZIP, scritti in modi diversi.
const CLIENTS = [
  { zip: "CNTBA00001", name: "Alfa Trading Co., Ltd", vat: "18678521008" },
  { zip: "cntba00002", name: "Beta Export Limited", vat: "18678541006" },
  { zip: "Gamma", name: "Gamma Housewares Co., Limited", vat: "18678611007" },
];
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
const zipOf = async (name, files) => {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return { name, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
};
// Windows, "Comprimi" sulle cartelle selezionate: un solo ZIP, chiamato come una di esse, con le cartelle dentro.
const bundle = () => zipOf("CNTBA00001.zip", { "cntba00001/nota.txt": "a", "CNTBA00002/nota.txt": "b", "GAMMA/nota.txt": "c" });

const browser = await chromium.launch();

async function open() {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
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
  return { ctx, page, pageErrors };
}
const excelInput = (page) => page.locator('input[type=file][accept=".xlsx,.xls"]');
const zipInput = (page) => page.locator('input[type=file][accept=".zip"]');
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
// Ogni riga ha trovato il suo ZIP: nessun "ZIP non caricato" e nessun nome rifiutato.
const allMatched = async (page, label) => {
  await page.waitForFunction(() => /3 ZIP selezionati/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const t = await body(page);
  check(`${label}: 3 ZIP per 3 righe`, /3 ZIP selezionati/.test(t), t.slice(0, 400));
  check(`${label}: ogni riga trova il suo ZIP`, !/ZIP non caricato|non caricato/.test(t), t.slice(t.indexOf("3. Controllo"), t.indexOf("3. Controllo") + 600));
  check(`${label}: i codici sono nomi ZIP validi`, !/Nome ZIP non valido|Numero ZIP non valido/.test(t));
  check(`${label}: nomi delle righe mostrati come nell'Excel`, CLIENTS.every((client) => t.includes(client.zip)));
};

// 1) Excel, poi un unico ZIP con una cartella per cliente (maiuscole diverse dall'Excel).
{
  const { ctx, page, pageErrors } = await open();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Lotto codici\.xlsx/.test(document.body.innerText), null, { timeout: 15000 });
  await zipInput(page).setInputFiles(await bundle());
  await allMatched(page, "1 Excel poi ZIP unico");
  await page.screenshot({ path: SHOTS + "vies-zip-names.png", fullPage: true });
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) Prima lo ZIP unico, poi l'Excel: la divisione viene rifatta con i nomi della colonna ZIP.
{
  const { ctx, page, pageErrors } = await open();
  await zipInput(page).setInputFiles(await bundle());
  await page.waitForFunction(() => /ZIP selezionat/.test(document.body.innerText), null, { timeout: 15000 });
  check("2 senza Excel lo ZIP resta intero", /1 ZIP selezionati/.test(await body(page)));
  await excelInput(page).setInputFiles(excel());
  await allMatched(page, "2 ZIP poi Excel");
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) Tre ZIP separati, nomi tutti in minuscolo.
{
  const { ctx, page, pageErrors } = await open();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Lotto codici\.xlsx/.test(document.body.innerText), null, { timeout: 15000 });
  await zipInput(page).setInputFiles([
    await zipOf("cntba00001.zip", { "nota.txt": "a" }),
    await zipOf("cntba00002.zip", { "nota.txt": "b" }),
    await zipOf("gamma.zip", { "gamma/nota.txt": "c" }),
  ]);
  await allMatched(page, "3 ZIP separati in minuscolo");
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
