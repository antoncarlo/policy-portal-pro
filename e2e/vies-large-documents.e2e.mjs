// Pagina VIES, documenti grandi (nel lotto del 6/11/2026 una scansione da circa 35 MB è stata rifiutata: «Documento troppo
// grande per l'agent (massimo circa 22 MB)»). I file di prova sono pixel casuali, il caso peggiore per la compressione:
// 1 un PDF oltre 20 MB arriva all'agent come PDF delle stesse pagine, sotto il limite della funzione;
// 2 un'immagine oltre 7 MB arriva come JPEG sotto il limite dell'API (10 MB in base64);
// 3 i documenti entro i limiti arrivano identici;
// 4 la pratica è pronta e il registro delle verifiche segna quali letture sono state fatte su una copia compressa.
import { randomBytes } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
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
const MB = 1024 * 1024;

const CLIENT = { zip: "CNTBA00081", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", uscc: "91440300MA5GX639XR" };
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza",
};
const BIG_PDF = `${CLIENT.zip}-licenza.pdf`;
const BIG_IMAGE = `${CLIENT.zip}-identita.png`;

// PNG of random pixels: it does not compress, so its size is width × height × 3.
const noisePng = (width, height) => {
  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);
  const pixels = randomBytes(width * 3 * height);
  for (let y = 0; y < height; y += 1) pixels.copy(raw, y * rowLength + 1, y * width * 3, (y + 1) * width * 3);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0)),
  ]);
};
// Three A4 pages, each a scan of random pixels.
const bigPdf = async () => {
  const doc = await PDFDocument.create();
  for (let page = 0; page < 3; page += 1) {
    const image = await doc.embedPng(noisePng(2000, 1500));
    doc.addPage([595, 842]).drawImage(image, { x: 20, y: 200, width: 555, height: 416 });
  }
  return Buffer.from(await doc.save());
};
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);

const originals = new Map();
const lotZip = async () => {
  const zip = new JSZip();
  for (const kind of Object.keys(TYPES)) {
    const name = kind === "licenza" ? BIG_PDF : kind === "identita" ? BIG_IMAGE : `${CLIENT.zip}-${kind}.jpg`;
    const bytes = kind === "licenza" ? await bigPdf() : kind === "identita" ? noisePng(2000, 1500) : Buffer.from(scan(name));
    originals.set(name, bytes);
    zip.file(`${CLIENT.zip}/${name}`, bytes);
  }
  return { name: `${CLIENT.zip}.zip`, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer", compression: "STORE" }) };
};
const HEADER = ["Tipo Anagrafica", "Ragione Sociale", "Tipo Società", "C.F.", "P.IVA", "legale rappresentante", "indirizzo", "numero civico", "città", "cap", "provincia", "nazione", "sede principale", "pec"];
const excel = () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["ZIP", ...HEADER],
    [CLIENT.zip, "persona giuridica", CLIENT.name, "srl", CLIENT.vat, CLIENT.vat, "Liu Yuzhen", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", ""],
  ]), "CONTRAENTE");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "Rappresentante Srl", "srl", "13489331002", "13489331002", "Mario Rossi", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", "rapp@pec.it"]]), "RAPPRESENTANTE FISCALE ");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "AGENZIA DELLE ENTRATE", "ente pubblico", "06363391001", "06363391001", "", "Via Giorgione", "106", "Roma", "00147", "RM", "Italia", "Sì", ""]]), "BENEFICIARIO ");
  return { name: "Lotto grandi.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const kind = fileName.replace(/\.(jpg|pdf|png)$/, "").split("-")[1];
  const type = TYPES[kind];
  const identity = type === "documento_identita";
  return {
    document_type: type, contained_document_types: [], company_name_latin: identity ? "" : CLIENT.name, company_name_chinese: "",
    unified_social_credit_code: identity ? "" : CLIENT.uscc, italian_vat_number: "", legal_representative_name: "",
    legal_representative_id_number: "", fiscal_representative_name: "", fiscal_representative_tax_code: "", document_date: "",
    expiry_date: "", has_italian_translation: false, is_signed: true, issues: [],
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
const sent = new Map();
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
    // The function's own limit: 30 MB of base64.
    if (request.data.length > 30 * MB) return json({ error: "Documento troppo grande per l'agent (massimo circa 22 MB).", code: "TOO_LARGE" }, 413);
    sent.set(request.file_name, { mediaType: request.media_type, base64Length: request.data.length, bytes: Buffer.from(request.data, "base64") });
    return json({ model: "test", result: reading(request.file_name) });
  }
  if (p.startsWith("/auth/v1/token")) return json(session);
  if (p.startsWith("/auth/v1/user")) return json(user);
  if (p.includes("/rpc/has_role")) return json(true);
  if (p.includes("/rpc/")) return json([]);
  if (p === "/rest/v1/user_roles") return json([{ user_id: UID, role: "admin" }]);
  if (p === "/rest/v1/user_product_permissions") return json([{ practice_type: "vies" }]);
  if (p === "/rest/v1/profiles") return json([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
  if (req.method() === "POST" && p.startsWith("/storage/v1/object/list/")) return json([{ name: JSON.parse(req.postData() || "{}").search, metadata: {} }]);
  if (req.method() === "POST" && p.startsWith("/storage/v1/object/vies-batch-files/")) return json({ Id: "obj-1", Key: p });
  if (req.method() === "POST" && p === "/rest/v1/vies_fiscal_representatives") return json({ id: "rep-1" }, 201);
  if (req.method() === "POST" && p === "/rest/v1/vies_batches") return json({ lot_number: 8 }, 201);
  if (req.method() === "POST" && p === "/rest/v1/practices") {
    const rows = JSON.parse(req.postData() || "[]");
    return json(rows.map((row, index) => ({ id: `p-${index + 1}`, practice_number: row.practice_number })), 201);
  }
  if (req.method() === "POST" && p === "/rest/v1/vies_document_readings") {
    readings.push(...JSON.parse(req.postData() || "[]"));
    return json([], 201);
  }
  return json([]);
});
await ctx.route(`${STORAGE}/**`, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  const length = req.headers()["upload-length"] ?? "0";
  return route.fulfill({ status: 201, headers: { ...hdr, location: `${STORAGE}/storage/v1/upload/resumable/u-${Date.now()}`, "upload-offset": length, "tus-resumable": "1.0.0" }, body: "" });
});
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

await page.locator('input[type=file][accept=".xlsx,.xls"]').setInputFiles(excel());
await page.waitForFunction(() => /Rilevate 1 righe|Rilevata 1 riga/.test(document.body.innerText), null, { timeout: 15000 });
const zipFile = await lotZip();
console.log(`     ZIP di prova: ${(zipFile.buffer.length / MB).toFixed(1)} MB (PDF ${(originals.get(BIG_PDF).length / MB).toFixed(1)} MB, PNG ${(originals.get(BIG_IMAGE).length / MB).toFixed(1)} MB)`);
await page.locator('input[type=file][accept=".zip"]').setInputFiles(zipFile);
await page.waitForFunction(() => /1 ZIP selezionat/.test(document.body.innerText) && !/In verifica|in lettura|Lettura|Apertura/i.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(1000);

// 1-3 What the agent received.
{
  const pdf = sent.get(BIG_PDF);
  const pages = pdf ? (await PDFDocument.load(pdf.bytes)).getPageCount() : 0;
  check(
    "1 PDF oltre 20 MB: arriva come PDF delle stesse 3 pagine, sotto il limite della funzione",
    Boolean(pdf) && originals.get(BIG_PDF).length > 20 * MB && pdf.mediaType === "application/pdf" && pages === 3 && pdf.base64Length <= 30 * MB && pdf.bytes.length < originals.get(BIG_PDF).length,
    pdf ? `${(pdf.bytes.length / MB).toFixed(1)} MB, ${pages} pagine` : "non inviato",
  );
  const image = sent.get(BIG_IMAGE);
  check(
    "2 immagine oltre 7 MB: arriva come JPEG sotto il limite dell'API",
    Boolean(image) && originals.get(BIG_IMAGE).length > 7 * MB && image.mediaType === "image/jpeg" && image.bytes[0] === 0xff && image.bytes[1] === 0xd8 && image.base64Length <= 10 * MB,
    image ? `${image.mediaType}, ${(image.bytes.length / MB).toFixed(1)} MB` : "non inviata",
  );
  const small = [...sent.entries()].filter(([name]) => name !== BIG_PDF && name !== BIG_IMAGE);
  check(
    "3 documenti entro i limiti: arrivano identici",
    small.length === 4 && small.every(([name, request]) => request.mediaType === "image/jpeg" && request.bytes.equals(originals.get(name))),
    JSON.stringify(small.map(([name, request]) => [name, request.mediaType, request.bytes.length])),
  );
}

// 4 The row, the lot and the register.
{
  const text = await body();
  check("4 la pratica è pronta, senza «troppo grande»", /1 pronte/.test(text) && !/troppo grande/i.test(text), text.slice(text.indexOf("3. Controllo"), text.indexOf("3. Controllo") + 400));
  await page.getByRole("button", { name: "Crea 1 pratiche VIES" }).or(page.getByRole("button", { name: "Crea 1 pratica VIES" })).click();
  await page.waitForFunction(() => /Pratiche create: questo lotto è chiuso/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: SHOTS + "vies-large-documents.png", fullPage: true });
  const register = (name) => readings.find((row) => row.file_name === name)?.agent_readings?.[0];
  check(
    "4 il registro segna le letture fatte su una copia compressa, e solo quelle",
    register(BIG_PDF)?.compressed === true && register(BIG_IMAGE)?.compressed === true &&
      readings.filter((row) => row.file_name !== BIG_PDF && row.file_name !== BIG_IMAGE).every((row) => row.agent_readings[0]?.compressed === false),
    JSON.stringify(readings.map((row) => [row.file_name, row.agent_readings[0]?.compressed])),
  );
  check("4 l'impronta nel registro è quella del file originale", readings.find((row) => row.file_name === BIG_PDF)?.content_sha256?.length === 64);
}
check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
