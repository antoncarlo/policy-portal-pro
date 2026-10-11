// Scarica tutto il lotto in un clic: dai tre puntini della riga del lotto esce uno ZIP con i documenti di TUTTE le
// pratiche del lotto (anche quelle nascoste da un filtro) e con i file del lotto stesso (Excel, ZIP caricati,
// visura, file ricevuti dall'intermediario).
import { chromium } from "playwright";
import JSZip from "jszip";
import { readFileSync } from "node:fs";

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

const LOT = "22222222-2222-4222-8222-222222222222";
const OTHER = "11111111-1111-4111-8111-111111111111";
const INTAKE = "44444444-4444-4444-8444-444444444444";
const REP = "55555555-5555-4555-8555-555555555555";
const pid = (n) => `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`;
const practice = (n, over) => ({
  id: pid(n), practice_type: "vies", client_name: `Azienda ${n}`, client_phone: "1", client_email: "a@b.c", beneficiary: null, policy_number: null, status: "in_lavorazione", financial_status: "non_incassata",
  payment_date: null, user_id: UID, created_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, vies_batch_id: LOT, ...over,
});
const PRACTICES = [
  practice(1, { practice_number: "VIES-2026-0001-22222222", client_name: "Gamma Srl" }),
  practice(2, { practice_number: "VIES-2026-0002-22222222" }),
  practice(3, { practice_number: "VIES-2026-0003-22222222" }),
  practice(4, { practice_number: "VIES-2026-0004-22222222" }),
  practice(5, { practice_number: "VIES-2026-0001-11111111", vies_batch_id: OTHER }),
];
const doc = (n, practiceIndex, file_name, file_path) => ({ id: `d${n}`, practice_id: pid(practiceIndex), file_name, file_path, file_size: 1000, document_type: "documento", mime_type: "application/pdf", uploaded_by: UID, created_at: "2026-10-09T10:00:00Z" });
const DOCS = [
  doc(1, 1, "visura.pdf", `${UID}/${LOT}/doc1`),
  doc(2, 1, "visura.pdf", `${UID}/${LOT}/doc2`), // same name: must not overwrite the first
  doc(3, 1, "bilancio.pdf", `vies-batch-files://${UID}/${LOT}/zip-nominativi/bilancio`),
  doc(4, 2, "mandato.pdf", `${UID}/${LOT}/doc4`),
  doc(5, 4, "rotto.pdf", `${UID}/${LOT}/rotto`), // unreadable: reported, the rest still comes
  doc(6, 5, "altro-lotto.pdf", `${UID}/${OTHER}/doc6`), // another lot: never in this ZIP
];
const LOTS = [{ batch_id: LOT, lot_number: 2, name: "Excel Lotto 2 · VIES", fiscal_representative_name: "Rappresentante Fiscale Rossi", created_at: "2026-10-09T09:00:00Z", practice_count: 4 }];
// the storage of the lot: its own files, one level at a time
const FOLDERS = {
  [`${UID}/${LOT}`]: [{ name: "Excel-Lotto-2.xlsx", id: "f1", metadata: { size: 10 } }, { name: "zip-nominativi", id: null }, { name: "visura-rappresentante", id: null }],
  [`${UID}/${LOT}/zip-nominativi`]: [{ name: "AZ-001.zip", id: "f2", metadata: { size: 10 } }, { name: "bilancio", id: "f3", metadata: { size: 10 } }],
  [`${UID}/${LOT}/visura-rappresentante`]: [{ name: "visura-rf.pdf", id: "f4", metadata: { size: 10 } }],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const downloaded = [];
await ctx.route(`${SUPA}/**`, async (route) => {
  const req = route.request(); const url = new URL(req.url()); const method = req.method(); const p = url.pathname;
  const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  if (p.startsWith("/auth/v1/token")) return json(session);
  if (p.startsWith("/auth/v1/user")) return json(user);
  if (p.includes("/rpc/get_practice_lots")) {
    const body = JSON.parse(req.postData() || "{}");
    return json(body.p_batch_ids ? LOTS.filter((row) => body.p_batch_ids.includes(row.batch_id)) : LOTS);
  }
  if (p.includes("/rpc/has_role")) return json(true);
  if (p.includes("/rpc/")) return json([]);
  if (p.startsWith("/storage/v1/object/list/")) {
    const body = JSON.parse(req.postData() || "{}");
    return json(FOLDERS[String(body.prefix).replace(/\/$/, "")] ?? []);
  }
  if (p.startsWith("/storage/v1/object/")) {
    const path = decodeURIComponent(p.replace(/^\/storage\/v1\/object\/(authenticated\/)?/, ""));
    downloaded.push(path);
    if (path.includes("/rotto")) return json({ message: "Object not found", error: "not_found", statusCode: "404" }, 404);
    return route.fulfill({ status: 200, contentType: "application/octet-stream", headers: hdr, body: `contenuto di ${path}` });
  }
  if (!p.startsWith("/rest/v1/")) return json({});
  const table = p.replace("/rest/v1/", "");
  const params = [...url.searchParams.entries()];
  const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
  const reply = (rows) => {
    if (method === "HEAD") return route.fulfill({ status: 200, headers: hdr });
    if (wantsObject) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406);
    return json(rows, 200, (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {});
  };
  const filter = (rows) => rows.filter((row) => params.every(([k, v]) => {
    if (["select", "order", "limit", "offset", "or"].includes(k)) return true;
    if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
    if (v.startsWith("in.(")) return v.slice(4, -1).split(",").includes(String(row[k]));
    return true;
  }));
  if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
  if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
  if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
  if (table === "practices") {
    const select = params.find(([k]) => k === "select")?.[1];
    return reply(filter(PRACTICES).map((row) => (!select || select === "*" ? row : Object.fromEntries(select.split(",").map((c) => c.trim()).filter((c) => c in row).map((c) => [c, row[c]])))));
  }
  if (table === "practice_documents") return reply(filter(DOCS));
  if (table === "vies_batches") return reply([{ id: LOT, user_id: UID, excel_storage_path: `${UID}/${LOT}/Excel-Lotto-2.xlsx`, source_excel_file_name: "Lotto 2.xlsx", fiscal_representative_id: REP }]);
  if (table === "vies_fiscal_representatives") return reply([{ id: REP, visura_storage_path: `vies-batch-files://${UID}/${LOT}/visura-rappresentante/visura-rf.pdf` }]);
  if (table === "vies_intake_lots") {
    return reply([{ id: INTAKE, batch_id: LOT, files: [
      { kind: "excel", file_name: "lotto-intermediario.xlsx", storage_path: `${UID}/intake/${INTAKE}/001-lotto-intermediario.xlsx`, size: 10 },
      { kind: "zip", file_name: "documenti.zip", storage_path: `${UID}/intake/${INTAKE}/002-documenti.zip`, size: 10 },
    ] }]);
  }
  return reply([]);
});
await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });

const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

const zipOf = async (download) => JSZip.loadAsync(readFileSync(await download.path()));
const lotRow = page.locator("[data-testid=lot-row]", { hasText: "Lotto 2" });

await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=lot-row]", { timeout: 10000 });

// 1) the row of the lot has its own three dots, with the download of the whole lot
await lotRow.locator("[data-testid=lot-menu]").click();
const item = page.locator("[data-testid=lot-download-all]");
check("1 la riga del lotto ha i tre puntini con «Scarica tutto il lotto (ZIP)»", await item.isVisible() && /Scarica tutto il lotto/.test(await item.innerText()));
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), item.click()]);
check("1 un solo clic scarica un file ZIP col nome del lotto", /^Lotto 2 - documenti\.zip$/.test(download.suggestedFilename()), download.suggestedFilename());
const zip = await zipOf(download);
const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
console.log("   ZIP:", JSON.stringify(names));
const has = (name) => names.includes(name);

check("1 i documenti di ogni pratica nella sua cartella", has("Pratiche/VIES-2026-0001-22222222/bilancio.pdf") && has("Pratiche/VIES-2026-0002-22222222/mandato.pdf"), JSON.stringify(names));
check("1 due documenti con lo stesso nome non si sovrascrivono", has("Pratiche/VIES-2026-0001-22222222/visura.pdf") && has("Pratiche/VIES-2026-0001-22222222/visura (2).pdf"), JSON.stringify(names));
check("1 l'Excel e gli ZIP caricati del lotto ci sono", has("File del lotto/Excel-Lotto-2.xlsx") && has("File del lotto/zip-nominativi/AZ-001.zip"), JSON.stringify(names));
check("1 la visura del rappresentante fiscale ci sono una volta sola", names.filter((n) => /visura-rf\.pdf$/.test(n)).length === 1, JSON.stringify(names));
check("1 anche i file ricevuti dall'intermediario (Excel e ZIP)", has("File del lotto/Ricevuti dall'intermediario/lotto-intermediario.xlsx") && has("File del lotto/Ricevuti dall'intermediario/documenti.zip"), JSON.stringify(names));
check("1 un file già tra i documenti di una pratica non si ripete tra i file del lotto", names.filter((n) => /bilancio/.test(n)).length === 1, JSON.stringify(names));
check("1 i documenti di un altro lotto non ci sono", !names.some((n) => /altro-lotto|0001-11111111/.test(n)), JSON.stringify(names));
check("1 il file illeggibile non ferma gli altri ed è elencato", has("_non_scaricati.txt") && /VIES-2026-0004-22222222 \/ rotto\.pdf/.test(await zip.file("_non_scaricati.txt").async("string")), JSON.stringify(names));
check("1 il contenuto è quello del file di origine", (await zip.file("Pratiche/VIES-2026-0002-22222222/mandato.pdf").async("string")) === `contenuto di practice-documents/${UID}/${LOT}/doc4`);
await page.waitForTimeout(500);
check("1 compare l'avviso di fine con il numero di file", /ZIP del lotto pronto/.test(await page.locator("body").innerText()));
await page.screenshot({ path: SHOTS + "lot-download.png" });

// 2) a search that hides practices never leaves them out of the ZIP
await page.getByPlaceholder(/Cerca per numero pratica/).fill("Gamma");
await page.waitForTimeout(500);
check("2 con la ricerca la riga mostra '1 di 4 pratiche'", /1 di 4 pratiche/.test((await page.locator("main").innerText()).replace(/\s+/g, " ")));
await lotRow.locator("[data-testid=lot-menu]").click();
const [filteredDownload] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.locator("[data-testid=lot-download-all]").click()]);
const filteredNames = Object.keys((await zipOf(filteredDownload)).files).filter((name) => /^Pratiche\/[^/]+\/.+/.test(name));
check("2 lo ZIP ha comunque i documenti di tutte le pratiche del lotto", filteredNames.some((n) => /0001-22222222/.test(n)) && filteredNames.some((n) => /0002-22222222/.test(n)) && filteredNames.some((n) => /0004-22222222/.test(n)) === false /* only the unreadable one */, JSON.stringify(filteredNames));

// 3) the same from the list filtered on the lot
await page.getByPlaceholder(/Cerca per numero pratica/).fill("");
await page.goto(`${BASE}/practices?lot=${LOT}`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=lot-download-chip]");
const [chipDownload] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.locator("[data-testid=lot-download-chip]").click()]);
check("3 anche dal filtro sul lotto un clic scarica lo ZIP", /\.zip$/.test(chipDownload.suggestedFilename()));

// 4) on a phone the card of the lot has the same menu
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=lot-row]");
await page.locator("[data-testid=lot-row]").first().locator("[data-testid=lot-menu]").click();
check("4 sul telefono la scheda del lotto ha gli stessi tre puntini", await page.locator("[data-testid=lot-download-all]").isVisible());

check("5 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
