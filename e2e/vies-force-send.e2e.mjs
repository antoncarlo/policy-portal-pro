// Pagina VIES, invio forzato (lotto reale: CNTBA03717 bloccata per «Documento d'identità scaduto il 10/03/2026» letto
// dall'agent; l'operatore deve poterla far partire lo stesso, assumendosene la responsabilità):
// 1 una riga bloccata solo dai controlli sui documenti (documento scaduto, documento non trovato) ha «Forza invio»;
//   una riga senza ZIP no;
// 2 la finestra elenca i controlli ignorati e conferma solo con un motivo e la presa di responsabilità;
// 3 la riga forzata è «Pronta (forzata)» con il motivo, e si può annullare;
// 4 il lotto crea le pratiche forzate con chi, quando, perché e i blocchi ignorati (vies_forzatura), e i loro job
//   vanno in coda senza errori; la riga senza ZIP resta esclusa.
import JSZip from "jszip";
import { chromium } from "playwright";
import * as XLSX from "xlsx";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const STORAGE = `https://${REF}.storage.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const EXPIRED = { zip: "CNTBA00061", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" };
const NO_UBO = { zip: "CNTBA00062", name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E" };
const NO_ZIP = { zip: "CNTBA00063", name: "Guang Zhou Shi Hua Mei Mao Yi You Xian Gong Si", vat: "18678561004", uscc: "" };
const CLIENTS = [EXPIRED, NO_UBO, NO_ZIP];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const EXPIRED_BLOCK = "Documento d'identità scaduto il 10/03/2026";
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
const lotZip = async () => {
  const zip = new JSZip();
  for (const client of [EXPIRED, NO_UBO]) {
    for (const kind of Object.keys(TYPES)) {
      if (client === NO_UBO && kind === "ubo") continue;
      zip.file(`${client.zip}/${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
    }
  }
  return { name: `${EXPIRED.zip}.zip`, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
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
  return { name: "Lotto forzato.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  const identity = type === "documento_identita";
  return {
    document_type: type, contained_document_types: [], company_name_latin: identity ? "" : client.name, company_name_chinese: "",
    unified_social_credit_code: identity ? "" : client.uscc, italian_vat_number: "", legal_representative_name: "",
    legal_representative_id_number: "", fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "",
    expiry_date: identity && client === EXPIRED ? "10/03/2026" : "", has_italian_translation: false, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
const saved = { practices: [], jobs: [] };
const hdr = {
  "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*",
  "access-control-expose-headers": "content-range, location, upload-offset, upload-length, tus-resumable, tus-version, tus-max-size",
};
await ctx.route(`${SUPA}/**`, async (route) => {
  const req = route.request(); const p = new URL(req.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  if (p === "/functions/v1/vies-document-agent") {
    const request = JSON.parse(req.postData() || "{}");
    if (request.probe) return json({ ready: true });
    return json({ model: "test", result: reading(request.file_name) });
  }
  if (p.startsWith("/auth/v1/token")) return json(session);
  if (p.startsWith("/auth/v1/user")) return json(user);
  if (p.includes("/rpc/has_role")) return json(true);
  if (p.includes("/rpc/")) return json([]);
  if (p === "/rest/v1/user_roles") return json([{ user_id: UID, role: "admin" }]);
  if (p === "/rest/v1/user_product_permissions") return json([{ practice_type: "vies" }]);
  if (p === "/rest/v1/profiles") return json([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
  // The check that an uploaded file is in storage: it is listed under its own name.
  if (req.method() === "POST" && p.startsWith("/storage/v1/object/list/")) return json([{ name: JSON.parse(req.postData() || "{}").search, metadata: {} }]);
  if (req.method() === "POST" && p === "/rest/v1/vies_fiscal_representatives") return json({ id: "rep-1" }, 201);
  if (req.method() === "POST" && p === "/rest/v1/vies_batches") return json({ lot_number: 1 }, 201);
  if (req.method() === "POST" && p === "/rest/v1/practices") {
    const rows = JSON.parse(req.postData() || "[]");
    saved.practices.push(...rows);
    return json(rows.map((row, index) => ({ id: `p-${saved.practices.length - rows.length + index + 1}`, practice_number: row.practice_number })), 201);
  }
  if (req.method() === "POST" && p === "/rest/v1/vies_jobs") {
    saved.jobs.push(...JSON.parse(req.postData() || "[]"));
    return json([], 201);
  }
  return json([]);
});
// Resumable uploads of the Excel and the ZIPs: every upload is complete in its creation request.
await ctx.route(`${STORAGE}/**`, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  const length = req.headers()["upload-length"] ?? String((req.postDataBuffer() ?? Buffer.alloc(0)).length);
  return route.fulfill({ status: 201, headers: { ...hdr, location: `${STORAGE}/storage/v1/upload/resumable/u-${Date.now()}`, "upload-offset": length, "tus-resumable": "1.0.0" }, body: "" });
});
// The duplicate check finds no existing practice; every other server call is not needed here.
await ctx.route(`${BASE}/api/**`, (route) =>
  new URL(route.request().url()).pathname === "/api/vies-control"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ existing: [] }) })
    : route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
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
const dialog = () => page.getByRole("dialog");
const forceButtons = () => page.locator("table").getByRole("button", { name: "Forza invio" });
const force = async (index, reason, note = "") => {
  await forceButtons().nth(index).click();
  await dialog().waitFor();
  await dialog().getByText(reason, { exact: true }).click();
  if (note) await dialog().getByLabel("Nota (facoltativa)").fill(note);
  await dialog().getByText(/Mi assumo la responsabilità/).click();
  await dialog().getByRole("button", { name: "Forza invio" }).click();
  await dialog().waitFor({ state: "hidden" });
};

await page.locator('input[type=file][accept=".xlsx,.xls"]').setInputFiles(excel());
await page.waitForFunction(() => /Rilevate 3 righe/.test(document.body.innerText), null, { timeout: 15000 });
await page.locator('input[type=file][accept=".zip"]').setInputFiles(await lotZip());
await page.waitForFunction(() => /2 ZIP selezionati/.test(document.body.innerText) && !/In verifica|in lettura|Lettura|Apertura/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);

// 1 Which rows may be forced.
{
  const rows = await control();
  const expired = row(rows, EXPIRED.zip);
  const noUbo = row(rows, NO_UBO.zip);
  const noZip = row(rows, NO_ZIP.zip);
  check("1 documento scaduto: bloccata, con «Forza invio»", /Bloccata/.test(expired) && expired.includes(EXPIRED_BLOCK) && /Forza invio/.test(expired), expired);
  check("1 documento non trovato: bloccata, con «Forza invio»", /Bloccata/.test(noUbo) && /Documenti mancanti/.test(noUbo) && /Forza invio/.test(noUbo), noUbo);
  check("1 ZIP non caricato: bloccata, senza «Forza invio»", /non caricato/.test(noZip) && !/Forza invio/.test(noZip), noZip);
  check("1 due pulsanti «Forza invio» in tabella", (await forceButtons().count()) === 2, String(await forceButtons().count()));
}

// 2 The dialog: the checks ignored, and a reason and the responsibility before confirming.
{
  await forceButtons().nth(0).click();
  await dialog().waitFor();
  const text = (await dialog().innerText()).replace(/\s+/g, " ");
  const confirm = dialog().getByRole("button", { name: "Forza invio" });
  check("2 la finestra elenca il controllo ignorato", text.includes(EXPIRED_BLOCK), text);
  check("2 senza motivo né responsabilità non si conferma", await confirm.isDisabled());
  await dialog().getByText("Lettura dell'agent errata", { exact: true }).click();
  check("2 con il solo motivo non si conferma", await confirm.isDisabled());
  await dialog().getByText(/Mi assumo la responsabilità/).click();
  check("2 con motivo e responsabilità si conferma", await confirm.isEnabled());
  await page.screenshot({ path: SHOTS + "vies-force-send-dialog.png" });
  await confirm.click();
  await dialog().waitFor({ state: "hidden" });
}

// 3 The forced row, and undoing it.
{
  const rows = await control();
  const expired = row(rows, EXPIRED.zip);
  check("3 la riga forzata è «Pronta (forzata)» con il motivo", /Pronta \(forzata\)/.test(expired) && /Motivo: Lettura dell'agent errata/.test(expired) && !/Bloccata/.test(expired), expired);
  check("3 il riepilogo conta 1 pronta e 1 con invio forzato", /1 pronte/.test(rows) && /1 con invio forzato/.test(rows), rows.slice(0, 400));
  await page.getByRole("button", { name: "Annulla forzatura" }).click();
  const after = row(await control(), EXPIRED.zip);
  check("3 annullata la forzatura la riga torna bloccata", /Bloccata/.test(after) && !/forzata/.test(after), after);
}

// 4 Forcing both and creating the lot.
{
  await force(0, "Lettura dell'agent errata", "Carta d'identità rinnovata");
  await force(0, "Documento verificato a mano dall'operatore");
  const rows = await control();
  check("4 due pratiche pronte, entrambe forzate", /2 pronte/.test(rows) && /2 con invio forzato/.test(rows) && /1 bloccate/.test(rows), rows.slice(0, 400));
  await page.screenshot({ path: SHOTS + "vies-force-send-rows.png", fullPage: true });
  await page.getByRole("button", { name: "Crea 2 pratiche VIES" }).click();
  await page.waitForFunction(() => /Pratiche create: questo lotto è chiuso/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  const fields = (practice) => JSON.parse(practice.notes.slice(practice.notes.indexOf("{")));
  const byClient = (client) => saved.practices.find((practice) => practice.client_name === client.name);
  check("4 create solo le due pratiche forzate", saved.practices.length === 2 && Boolean(byClient(EXPIRED)) && Boolean(byClient(NO_UBO)), JSON.stringify(saved.practices.map((p) => p.client_name)));
  const expired = byClient(EXPIRED) ? fields(byClient(EXPIRED)).vies_forzatura : null;
  check(
    "4 la pratica registra chi, quando, perché e il blocco ignorato",
    expired?.operatore === "t@example.com" && expired?.motivo === "agent_misread" && expired?.nota === "Carta d'identità rinnovata" &&
      Boolean(Date.parse(expired?.data)) && expired?.blocchi.includes(EXPIRED_BLOCK),
    JSON.stringify(expired),
  );
  const noUbo = byClient(NO_UBO) ? fields(byClient(NO_UBO)).vies_forzatura : null;
  check(
    "4 l'altra pratica registra il documento non trovato",
    noUbo?.motivo === "manual_check" && noUbo?.blocchi.includes("Documento obbligatorio non trovato: Dichiarazione del titolare effettivo (UBO)"),
    JSON.stringify(noUbo),
  );
  check(
    "4 i job delle pratiche forzate vanno in coda senza errori",
    saved.jobs.length === 2 && saved.jobs.every((job) => job.status === "queued" && job.reconciliation_errors.length === 0 && job.validation_errors.length === 0),
    JSON.stringify(saved.jobs.map((job) => [job.nome_zip, job.status, job.reconciliation_errors, job.validation_errors])),
  );
}
check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
