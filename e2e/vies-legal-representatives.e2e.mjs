// Pagina VIES, Excel dei legali rappresentanti (la compagnia chiede, per ogni società del lotto, i dati anagrafici del
// legale rappresentante in un file a parte, scaricato con il lotto):
// 1 una carta d'identità scansionata è letta dall'agent una volta sola, dati anagrafici compresi;
// 2 una carta d'identità riconosciuta dal testo è mandata all'agent solo per i dati anagrafici;
// 3 se quella lettura non riesce la pratica resta pronta: nessun blocco;
// 4 creato il lotto, nella sua cartella c'è «Legali-rappresentanti-Lotto-N.xlsx» con il logo, una riga per pratica,
//   il codice fiscale calcolato dove i dati ci sono e, dove mancano, la nota di cosa completare;
// 5 nel registro delle verifiche (vies_document_readings) c'è una riga per documento, con pratica, impronta del file,
//   come è stato riconosciuto e ogni lettura dell'agent, compresa quella non riuscita.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

const SCANNED = { zip: "CNTBA00071", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR", representative: "Liu Yuzhen" };
const TEXT = { zip: "CNTBA00072", name: "Shen Zhen Shi Dong Ji Shang Mao You Xian Gong Si", vat: "18678541006", uscc: "91440300MA5GX0J87E", representative: "Sun Jiandong" };
const FAILED = { zip: "CNTBA00073", name: "Guang Zhou Shi Hua Mei Mao Yi You Xian Gong Si", vat: "18678561004", uscc: "91440101MA5CKRAX7P", representative: "Zhang Wei" };
const CLIENTS = [SCANNED, TEXT, FAILED];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const DETAILS = {
  [SCANNED.zip]: {
    surname: "Liu", given_names: "Yuzhen", sex: "F", birth_date: "01/09/1977", birth_place: "", nationality: "",
    residence_address: "No.13 Zhaotang Fangyuan Village, Changtang Town, Ji'an District, Jiangxi Province", document_kind: "",
    document_number: "362401197709014447", issue_date: "26/01/2026", expiry_date: "illimitata", issuing_authority: "Ufficio del Distretto di Jizhou",
  },
  [TEXT.zip]: {
    surname: "Sun", given_names: "Jiandong", sex: "M", birth_date: "08/09/1989", birth_place: "", nationality: "",
    residence_address: "Group 15, Sanxingxujiaqiao Village, Yulong Town, Yanting County, Sichuan Province", document_kind: "",
    document_number: "510723198909080970", issue_date: "12/01/2017", expiry_date: "12/01/2037", issuing_authority: "Ufficio di Pubblica Sicurezza della Contea di Yanting",
  },
};
const EMPTY_DETAILS = Object.fromEntries(Object.keys(DETAILS[SCANNED.zip]).map((key) => [key, ""]));

const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
const textPdf = async (lines) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lines.forEach((line, index) => page.drawText(line, { x: 50, y: 780 - index * 24, size: 12, font }));
  return doc.save();
};
const lotZip = async () => {
  const zip = new JSZip();
  for (const client of CLIENTS) {
    for (const kind of Object.keys(TYPES)) {
      if (kind === "identita" && client !== SCANNED) {
        zip.file(`${client.zip}/${client.zip}-identita.pdf`, await textPdf(["CARTA D'IDENTITA' - TRADUZIONE", client.representative, "Repubblica Popolare Cinese - documento di prova"]));
      } else {
        zip.file(`${client.zip}/${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
      }
    }
  }
  return { name: `${SCANNED.zip}.zip`, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
};
const HEADER = ["Tipo Anagrafica", "Ragione Sociale", "Tipo Società", "C.F.", "P.IVA", "legale rappresentante", "indirizzo/via-piazza", "numero civico", "città", "cap", "provincia", "nazione", "sede principale", "pec"];
const excel = () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["ZIP", ...HEADER],
    ...CLIENTS.map((client) => [client.zip, "persona giuridica", client.name, "srl", client.vat, client.vat, client.representative, "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", ""]),
  ]), "CONTRAENTE");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "Rappresentante Srl", "srl", "13489331002", "13489331002", "Mario Rossi", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", "rapp@pec.it"]]), "RAPPRESENTANTE FISCALE ");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "AGENZIA DELLE ENTRATE", "ente pubblico", "06363391001", "06363391001", "", "Via Giorgione", "106", "Roma", "00147", "RM", "Italia", "Sì", ""]]), "BENEFICIARIO ");
  return { name: "Lotto legali.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.(jpg|pdf)$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const type = TYPES[kind];
  const identity = type === "documento_identita";
  const details = identity ? DETAILS[client.zip] : undefined;
  return {
    document_type: type, contained_document_types: [], company_name_latin: identity ? "" : client.name, company_name_chinese: "",
    unified_social_credit_code: identity ? "" : client.uscc, italian_vat_number: "", legal_representative_name: "",
    legal_representative_id_number: details?.document_number ?? "", fiscal_representative_name: "", fiscal_representative_tax_code: "",
    document_date: details?.issue_date ?? "", expiry_date: details?.expiry_date ?? "", legal_representative_identity: details ?? EMPTY_DETAILS,
    has_italian_translation: identity, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
const agentRequests = [];
const uploads = [];
const readings = [];
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
    agentRequests.push(request.file_name);
    if (request.file_name === `${FAILED.zip}-identita.pdf`) return json({ error: "Documento non elaborabile.", code: "AGENT_BAD_REQUEST" }, 400);
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
  // A file saved in one request (the workbook of the legal representatives).
  if (req.method() === "POST" && p.startsWith("/storage/v1/object/vies-batch-files/")) {
    const path = decodeURIComponent(p.slice("/storage/v1/object/vies-batch-files/".length));
    uploads.push({ path, contentType: req.headers()["content-type"], body: req.postDataBuffer() ?? Buffer.alloc(0) });
    return json({ Id: "obj-1", Key: `vies-batch-files/${path}` });
  }
  if (req.method() === "POST" && p === "/rest/v1/vies_fiscal_representatives") return json({ id: "rep-1" }, 201);
  if (req.method() === "POST" && p === "/rest/v1/vies_batches") return json({ lot_number: 7 }, 201);
  if (req.method() === "POST" && p === "/rest/v1/practices") {
    const rows = JSON.parse(req.postData() || "[]");
    return json(rows.map((row, index) => ({ id: `p-${index + 1}`, practice_number: row.practice_number })), 201);
  }
  if (req.method() === "POST" && p === "/rest/v1/vies_jobs") return json([], 201);
  if (req.method() === "POST" && p === "/rest/v1/vies_document_readings") {
    readings.push(...JSON.parse(req.postData() || "[]"));
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

await page.locator('input[type=file][accept=".xlsx,.xls"]').setInputFiles(excel());
await page.waitForFunction(() => /Rilevate 3 righe/.test(document.body.innerText), null, { timeout: 15000 });
await page.locator('input[type=file][accept=".zip"]').setInputFiles(await lotZip());
await page.waitForFunction(() => /3 ZIP selezionati/.test(document.body.innerText) && !/In verifica|in lettura|Lettura|Apertura/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);

// 1-3 What the agent was asked, and the rows.
{
  const count = (name) => agentRequests.filter((item) => item === name).length;
  check("1 la carta scansionata è letta una volta sola", count(`${SCANNED.zip}-identita.jpg`) === 1, JSON.stringify(agentRequests));
  check("2 la carta riconosciuta dal testo è mandata all'agent per i dati anagrafici", count(`${TEXT.zip}-identita.pdf`) === 1, JSON.stringify(agentRequests));
  check("2 nessun altro documento è letto due volte", agentRequests.length === new Set(agentRequests).size, JSON.stringify(agentRequests));
  const rows = await control();
  check("3 le tre pratiche sono pronte, anche quella con la lettura anagrafica non riuscita", /3 pronte/.test(rows) && !/Bloccata/.test(rows), rows);
}

// 4 The lot and its workbook.
{
  await page.getByRole("button", { name: "Crea 3 pratiche VIES" }).click();
  await page.waitForFunction(() => /Pratiche create: questo lotto è chiuso/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.screenshot({ path: SHOTS + "vies-legal-representatives.png", fullPage: true });
  const workbook = uploads.find((upload) => upload.path.endsWith("/Legali-rappresentanti-Lotto-7.xlsx"));
  check("4 l'Excel è nella cartella del lotto", Boolean(workbook) && workbook.path.startsWith(`${UID}/`) && workbook.path.split("/").length === 3, JSON.stringify(uploads.map((upload) => upload.path)));
  check("4 nessun avviso di Excel non creato", !/legali rappresentanti non creato/.test(await body()));
  if (workbook) {
    check("4 è un file Excel", /spreadsheetml/.test(workbook.contentType ?? ""), workbook.contentType);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(workbook.body);
    const sheet = book.worksheets[0];
    const cell = (row, column) => sheet.getRow(row).getCell(column).value;
    check("4 ha il logo e il titolo del lotto", sheet.getImages().length === 1 && cell(5, 1) === "Lotto 7 VIES – Dati anagrafici dei legali rappresentanti", String(cell(5, 1)));
    check("4 una riga per pratica, nell'ordine dell'Excel", [9, 10, 11].map((row) => cell(row, 2)).join() === CLIENTS.map((client) => client.zip).join() && !cell(12, 2));
    check(
      "4 carta scansionata: dati letti e codice fiscale calcolato",
      cell(9, 5) === "LIU" && cell(9, 6) === "YUZHEN" && cell(9, 8) === "01/09/1977" && cell(9, 11) === "LIUYHN77P41Z210P" && cell(9, 13) === "362401197709014447" &&
        cell(9, 15) === "illimitata" && String(cell(9, 17)).startsWith("No.13 Zhaotang"),
      JSON.stringify(sheet.getRow(9).values),
    );
    check(
      "4 carta riconosciuta dal testo: dati letti e codice fiscale calcolato",
      cell(10, 5) === "SUN" && cell(10, 6) === "JIANDONG" && cell(10, 7) === "M" && cell(10, 11) === "SNUJDN89P08Z210W" && cell(10, 15) === "12/01/2037",
      JSON.stringify(sheet.getRow(10).values),
    );
    check(
      "4 lettura non riuscita: il nome dell'Excel e la nota di cosa completare",
      cell(11, 5) === FAILED.representative && !cell(11, 11) && /Documento d'identità non letto/.test(String(cell(11, 18))),
      JSON.stringify(sheet.getRow(11).values),
    );
  }
}
// 5 The register of the document checks.
{
  const of = (name) => readings.find((row) => row.file_name === name);
  check("5 una riga per documento del lotto", readings.length === 18 && new Set(readings.map((row) => row.document_path)).size === 18, String(readings.length));
  check(
    "5 ogni riga ha lotto, pratica, impronta del file e chi l'ha registrata",
    readings.every((row) => row.lot_number === 7 && /^p-\d$/.test(row.practice_id ?? "") && /^VIES-/.test(row.practice_number ?? "") && /^[0-9a-f]{64}$/.test(row.content_sha256 ?? "") && row.recorded_by === UID),
    JSON.stringify(readings.slice(0, 1)),
  );
  const scannedCard = of(`${SCANNED.zip}-identita.jpg`);
  check(
    "5 carta scansionata: letta dall'agent, con modello e codice accettato",
    scannedCard?.recognised_by === "agent" && scannedCard.agent_readings.length === 1 && scannedCard.agent_readings[0].purpose === "lettura" &&
      scannedCard.agent_readings[0].model === "test" && scannedCard.agent_readings[0].verified.chineseIds.includes("362401197709014447"),
    JSON.stringify(scannedCard),
  );
  const textCard = of(`${TEXT.zip}-identita.pdf`);
  check(
    "5 carta riconosciuta dal testo: tipo dal testo e lettura per i dati anagrafici",
    textCard?.recognised_by === "testo" && textCard.document_type === "documento_identita" && textCard.agent_readings.length === 1 &&
      textCard.agent_readings[0].purpose === "dati_anagrafici" && textCard.agent_readings[0].result.legal_representative_identity.surname === "Sun",
    JSON.stringify(textCard),
  );
  const failedCard = of(`${FAILED.zip}-identita.pdf`);
  check(
    "5 lettura non riuscita: registrata con il motivo",
    failedCard?.agent_readings.length === 1 && failedCard.agent_readings[0].status === "error" && /non elaborabile/.test(failedCard.agent_readings[0].error ?? ""),
    JSON.stringify(failedCard),
  );
  check("5 nessun avviso di registro non salvato", !/verifiche dei documenti non salvato/.test(await body()));
}
check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
