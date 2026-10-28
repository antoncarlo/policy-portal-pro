// Pagina VIES, documenti obbligatori: solo quelli del cliente (visura, bilancio e statuto del rappresentante fiscale
// non servono); per le società di Hong Kong il Certificate of Incorporation e/o il Business Registration Certificate
// valgono al posto di licenza e report di credito; un Business Registration Certificate scaduto blocca la pratica;
// ricaricando gli stessi ZIP l'agent non rilegge i file già letti.
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
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
  { zip: "CNTBA00001", name: "Alfa Trading Co., Ltd", vat: "18678521008", files: ["licenza", "identita", "report", "dichiarazione", "ubo", "mandato"] },
  { zip: "CNTBA00002", name: "Beta Trading Limited", vat: "18678541006", files: ["costituzione_hk", "identita", "dichiarazione", "ubo", "mandato"] },
  { zip: "CNTBA00003", name: "Gamma Housewares Limited", vat: "18678611007", files: ["br_scansione", "identita", "dichiarazione", "ubo", "mandato"] },
  { zip: "CNTBA00004", name: "Delta Export Co., Ltd", vat: "18678601008", files: ["licenza", "identita", "report", "dichiarazione", "mandato"] },
];
const TITLES = {
  licenza: "LICENZA COMMERCIALE",
  identita: "CARTA D'IDENTITA DEL LEGALE RAPPRESENTANTE",
  report: "REPORT INFORMAZIONI SUL CREDITO D'IMPRESA",
  dichiarazione: "DICHIARAZIONE SOSTITUTIVA A SUPPORTO DELLA FIDEIUSSIONE",
  ubo: "DICHIARAZIONE DEL TITOLARE EFFETTIVO",
  mandato: "MANDATO DI RAPPRESENTANZA FISCALE",
  costituzione_hk: "CERTIFICATE OF INCORPORATION",
};
const pdf = async (lines) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lines.forEach((line, index) => page.drawText(line, { x: 50, y: 780 - index * 24, size: 12, font }));
  return doc.save();
};
const zips = async () => Promise.all(CLIENTS.map(async (client) => {
  const zip = new JSZip();
  for (const kind of client.files) {
    if (kind === "br_scansione") zip.file("br_scansione.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]));
    else zip.file(`${kind}.pdf`, await pdf([TITLES[kind], client.name, kind === "mandato" ? `Partita IVA italiana ${client.vat}` : "Documento di prova"]));
  }
  return { name: `${client.zip}.zip`, mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
}));
const HEADER = ["Tipo Anagrafica", "Ragione Sociale", "Tipo Società", "C.F.", "P.IVA", "legale rappresentante", "indirizzo/via-piazza", "numero civico", "città", "cap", "provincia", "nazione", "sede principale", "pec"];
const excel = () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["ZIP", ...HEADER],
    ...CLIENTS.map((client) => [client.zip, "persona giuridica", client.name, "srl", client.vat, client.vat, "Zhang Wei", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", ""]),
  ]), "CONTRAENTE");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "Rappresentante Srl", "srl", "13489331002", "13489331002", "Mario Rossi", "Via degli Scipioni", "157", "Roma", "00192", "RM", "Italia", "Sì", "rapp@pec.it"]]), "RAPPRESENTANTE FISCALE ");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADER, ["persona giuridica", "AGENZIA DELLE ENTRATE", "ente pubblico", "06363391001", "06363391001", "", "Via Giorgione", "106", "Roma", "00147", "RM", "Italia", "Sì", ""]]), "BENEFICIARIO ");
  return { name: "Lotto documenti.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => ({
  document_type: /br_scansione/.test(fileName) ? "certificato_registrazione_hk" : "altro",
  contained_document_types: [], company_name_latin: "", company_name_chinese: "", unified_social_credit_code: "", italian_vat_number: "",
  legal_representative_name: "", legal_representative_id_number: "", fiscal_representative_name: "", fiscal_representative_tax_code: "",
  document_date: "", expiry_date: /br_scansione/.test(fileName) ? "22/10/2026" : "", has_italian_translation: false, is_signed: false, issues: [],
});

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
      agentCalls.push(request.file_name);
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
  return { ctx, page, pageErrors, agentCalls };
}
const excelInput = (page) => page.locator('input[type=file][accept=".xlsx,.xls"]');
const zipInput = (page) => page.locator('input[type=file][accept=".zip"]');
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const section = (text, from, to) => text.slice(text.indexOf(from), to && text.indexOf(to) > text.indexOf(from) ? text.indexOf(to) : undefined);
// The same files both times: pdf-lib writes a new date and id into every PDF it creates.
const LOT_ZIPS = await zips();
const uploadZips = async (page) => {
  await zipInput(page).setInputFiles(LOT_ZIPS);
  await page.waitForFunction(() => /4 ZIP selezionati/.test(document.body.innerText) && !/Lettura|Indicizzazione in corso|Apertura|letture dell'agent in corso/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
};

{
  const { ctx, page, pageErrors, agentCalls } = await open();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 4 righe/.test(document.body.innerText), null, { timeout: 15000 });
  await uploadZips(page);
  const t = await body(page);
  const control = section(t, "3. Controllo pratiche", "4. Documenti obbligatori");
  const required = section(t, "4. Documenti obbligatori", "5.");
  check("1 due pratiche pronte e due bloccate", /2 pronte/.test(control) && /2 bloccate/.test(control), control.slice(0, 400));
  check("1 senza visura, bilancio e statuto del rappresentante la pratica è pronta", /CNTBA00001 Alfa Trading[^]*?Pronta/.test(control) && !/Visura camerale del rappresentante/.test(required), control.slice(0, 600));
  check("1 Hong Kong: il Certificate of Incorporation vale per licenza e report", /CNTBA00002 Beta Trading Limited[^]*?Pronta/.test(control), control.slice(0, 900));
  check("1 Hong Kong: Business Registration Certificate scaduto blocca la pratica", /Business Registration Certificate di Hong Kong scaduto il 22\/10\/2026/.test(control), control.slice(0, 1400));
  check("1 senza UBO la pratica resta bloccata", /CNTBA00004[^]*?Bloccata/.test(control) && /titolare effettivo/i.test(control), control.slice(-700));
  const firstCalls = agentCalls.length;
  check("1 la scansione è stata letta dall'agent", agentCalls.includes("br_scansione.jpg"), JSON.stringify(agentCalls));
  await uploadZips(page);
  check("1 ricaricando gli stessi ZIP l'agent non rilegge nulla", agentCalls.length === firstCalls, `${firstCalls} → ${agentCalls.length}: ${JSON.stringify(agentCalls)}`);
  check("1 dopo il ricaricamento l'esito è lo stesso", /2 pronte/.test(section(await body(page), "3. Controllo pratiche", "4. Documenti obbligatori")));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-required-documents.png", fullPage: true });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
