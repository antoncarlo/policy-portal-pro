// Pagina VIES, lo ZIP di tutto il lotto (6/11/2026: ZIP.zip con dentro i 20 ZIP CN0DM03874.zip … CNTBA03464.zip; tutte le
// righe "ZIP non caricato" tranne una, collegata all'intero ZIP tramite la partita IVA e bloccata solo da un documento
// scaduto, quindi forzabile):
// 1 l'Excel scelto mentre lo ZIP è ancora in lettura non va perso: a lettura finita lo ZIP viene diviso con i suoi nomi;
// 2 uno ZIP del lotto che il portale non riesce a dividere non diventa la pratica di una riga: blocco non forzabile;
// 3 uno ZIP collegato a una riga tramite la partita IVA ma con un altro nome: blocco non forzabile già nella pagina
//   (il controllo finale prima dell'invio vuole lo ZIP col nome della colonna ZIP).
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

// Come nell'Excel del lotto: codici cliente nella colonna ZIP, solo la partita IVA italiana (nessuna colonna USCC).
const CLIENTS = [
  { zip: "CN0SX04647", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" },
  { zip: "CN0DM03874", name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E" },
];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
const practiceZip = async (client) => {
  const zip = new JSZip();
  for (const kind of Object.keys(TYPES)) zip.file(`${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
  return zip.generateAsync({ type: "nodebuffer" });
};
// ZIP.zip con dentro uno ZIP per cliente; `folder` li mette in una cartella che il portale non riconosce come lotto.
const wholeLot = async (folder = "") => {
  const zip = new JSZip();
  for (const client of CLIENTS) zip.file(`${folder}${client.zip}.zip`, await practiceZip(client));
  return { name: "ZIP.zip", mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
};
const named = async (name, client) => ({ name, mimeType: "application/zip", buffer: await practiceZip(client) });
const HEADER = ["Tipo Anagrafica", "Ragione Sociale", "Tipo Società", "C.F.", "P.IVA", "legale rappresentante", "indirizzo/via-piazza", "numero civico", "città", "cap", "provincia", "nazione", "sede principale", "pec"];
const excel = () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["ZIP", ...HEADER],
    ...CLIENTS.map((client) => [client.zip, "persona giuridica", client.name, "srl", client.vat, client.vat, "Zhang Wei", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", ""]),
  ]), "CONTRAENTE");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "Rappresentante Srl", "srl", "13489331002", "13489331002", "Mario Rossi", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", "rapp@pec.it"]]), "RAPPRESENTANTE FISCALE ");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "AGENZIA DELLE ENTRATE", "ente pubblico", "06363391001", "06363391001", "", "Via Giorgione", "106", "Roma", "00147", "RM", "Italia", "Sì", ""]]), "BENEFICIARIO ");
  return { name: "20-MKL.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
// Il mandato porta la partita IVA italiana della società, come il modulo di presentazione.
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  return {
    document_type: type, contained_document_types: [], company_name_latin: type === "documento_identita" ? "" : client.name, company_name_chinese: "",
    unified_social_credit_code: type === "documento_identita" ? "" : client.uscc, italian_vat_number: type === "mandato_rappresentanza" ? client.vat : "",
    legal_representative_name: "", legal_representative_id_number: "", fiscal_representative_name: "", fiscal_representative_tax_code: "",
    document_date: "", expiry_date: "", has_italian_translation: false, is_signed: true, issues: [],
  };
};
const gate = () => {
  let open;
  const promise = new Promise((resolve) => (open = resolve));
  return { promise, open, reached: false };
};

const browser = await chromium.launch();
async function openPage(probeGate) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p === "/functions/v1/vies-document-agent") {
      const request = JSON.parse(req.postData() || "{}");
      if (request.probe) {
        if (probeGate) {
          probeGate.reached = true;
          await probeGate.promise;
        }
        return json({ ready: true });
      }
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
  return { ctx, page, pageErrors };
}
const excelInput = (page) => page.locator('input[type=file][accept=".xlsx,.xls"]');
const zipInput = (page) => page.locator('input[type=file][accept=".zip"]');
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const control = async (page) => {
  const text = await body(page);
  const from = text.indexOf("3. Controllo pratiche");
  const to = text.indexOf("4. Documenti obbligatori");
  return text.slice(from, to > from ? to : undefined);
};
const row = (text, zip) => {
  const start = text.indexOf(zip);
  const next = CLIENTS.filter((client) => client.zip !== zip).map((client) => text.indexOf(client.zip, start)).filter((index) => index > start);
  return text.slice(start, next.length ? Math.min(...next) : undefined);
};
const waitFor = async (page, condition, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (!(await condition()) && Date.now() < until) await page.waitForTimeout(150);
  return condition();
};
const readingDone = (page) => waitFor(page, async () => /ZIP selezionati/.test(await body(page)) && !/In verifica/.test(await control(page)), 30000);

// 1) Prima lo ZIP del lotto, poi l'Excel mentre il portale sta ancora leggendo lo ZIP.
{
  const probeGate = gate();
  const { ctx, page, pageErrors } = await openPage(probeGate);
  await zipInput(page).setInputFiles(await wholeLot());
  check("1 lo ZIP è in lettura", await waitFor(page, async () => probeGate.reached));
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
  probeGate.open();
  check("1 a lettura finita lo ZIP è diviso con i nomi della colonna ZIP", await waitFor(page, async () => /2 ZIP selezionati .*CN0DM03874\.zip, CN0SX04647\.zip/.test(await body(page)), 30000), (await body(page)).slice(0, 600));
  await readingDone(page);
  const text = await control(page);
  check("1 ogni riga trova il suo ZIP", !/non caricato|tramite P\.IVA/.test(text), text.slice(0, 800));
  check("1 entrambe le pratiche pronte", CLIENTS.every((client) => /Pronta/.test(row(text, client.zip))), text.slice(0, 800));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) Lo ZIP del lotto con gli ZIP dei clienti in una sottocartella che il portale non riconosce: non viene diviso.
{
  const { ctx, page, pageErrors } = await openPage();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
  await zipInput(page).setInputFiles(await wholeLot("consegna/documenti/"));
  await readingDone(page);
  const text = await control(page);
  const linked = row(text, CLIENTS[0].zip);
  check("2 lo ZIP resta intero", /1 ZIP selezionati .*ZIP\.zip/.test(await body(page)));
  // The message names the other row's code: the row is read up to the end of the message.
  check("2 la riga collegata tramite P.IVA è bloccata: lo ZIP contiene le altre pratiche", /Bloccata/.test(linked) && /CN0SX04647 .*Lo ZIP ZIP\.zip contiene anche le pratiche di altre righe \(CN0DM03874\): è lo ZIP di tutto il lotto/.test(text), text.slice(0, 800));
  check("2 il blocco non si può forzare", !/Forza invio/.test(text), text.slice(0, 800));
  await page.screenshot({ path: SHOTS + "vies-whole-lot-zip.png", fullPage: true });
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) Lo ZIP di un cliente con un altro nome: collegato tramite la partita IVA, ma la colonna ZIP dice altro.
{
  const { ctx, page, pageErrors } = await openPage();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 2 righe/.test(document.body.innerText), null, { timeout: 15000 });
  await zipInput(page).setInputFiles([await named("documenti cliente.zip", CLIENTS[0]), await named(`${CLIENTS[1].zip}.zip`, CLIENTS[1])]);
  await readingDone(page);
  const text = await control(page);
  const linked = row(text, CLIENTS[0].zip);
  check("3 la riga dice di rinominare lo ZIP", /Bloccata/.test(linked) && /I documenti della società sono in documenti cliente\.zip, ma la colonna ZIP indica CN0SX04647: rinominare lo ZIP CN0SX04647\.zip/.test(linked), linked.slice(0, 800));
  check("3 il blocco non si può forzare", !/Forza invio/.test(text), text.slice(0, 800));
  check("3 l'altra pratica è pronta", /Pronta/.test(row(text, CLIENTS[1].zip)), row(text, CLIENTS[1].zip).slice(0, 400));
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
