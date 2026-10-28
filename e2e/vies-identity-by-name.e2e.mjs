// Pagina VIES, identità del cliente senza partita IVA nei documenti (come nei lotti reali: la procura è firmata prima
// dell'attribuzione): l'identità è verificata se i documenti letti dall'agent riportano la Ragione Sociale dell'Excel;
// la riga resta bloccata se il nome è un altro o se nello ZIP compaiono codici di credito sociale di più società.
// Un unico ZIP con le cartelle dei clienti, tutte scansioni lette dall'agent, Excel senza colonna USCC.
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

const MAINLAND = ["licenza", "identita", "report", "dichiarazione", "ubo", "mandato"];
const CLIENTS = [
  // Cina continentale: il nome in pinyin come nell'Excel, il codice di credito sociale in tutti i documenti.
  { zip: "CNTBA00011", name: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", vat: "18678521008", files: MAINLAND,
    read: { latin: "Shen Zhen Shi Zhu Huan Xin Ji Shu You Xian Gong Si", chinese: "深圳市珠嬛新技术有限公司", uscc: "91440300MA5GX639XR" } },
  // Hong Kong: nessun codice, il nome con un'altra grafia.
  { zip: "CNTBA00012", name: "CLARITON INNOVATION CO., LIMITED", vat: "18678691009", files: ["registrazione_hk", "costituzione_hk", "identita", "dichiarazione", "ubo", "mandato"],
    read: { latin: "Clariton Innovation Co., Limited", chinese: "克萊通創新有限公司" } },
  // I documenti sono di un'altra società.
  { zip: "CNTBA00013", name: "Guangzhou Chao Ran Xin Xi Ke Ji Co.Ltd", vat: "18678671001", files: MAINLAND,
    read: { latin: "Guangzhou Hong Yu Trading Co., Ltd.", uscc: "91440101MA59ABCD1D" } },
  // Il nome coincide, ma il report di credito è quello di CNTBA00013: documenti scambiati tra due clienti del lotto.
  { zip: "CNTBA00014", name: "Nan Tong Dong Gan Fu Shi Zai Xian Shang Wu You Xian Gong Si", vat: "18678711005", files: MAINLAND,
    read: { latin: "Nan Tong Dong Gan Fu Shi Zai Xian Shang Wu You Xian Gong Si", uscc: "91320600MA1XYW123N" }, foreignReport: "91440101MA59ABCD1D" },
];
const TYPES = {
  licenza: "licenza_commerciale", identita: "documento_identita", report: "report_credito", dichiarazione: "dichiarazione_sostitutiva",
  ubo: "ubo", mandato: "mandato_rappresentanza", costituzione_hk: "certificato_costituzione_hk", registrazione_hk: "certificato_registrazione_hk",
};
// Every scan has its own bytes: the agent's readings are kept by file content.
const scan = (name) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(name), 0xff, 0xd9]);
const lotZip = async () => {
  const zip = new JSZip();
  for (const client of CLIENTS) for (const kind of client.files) zip.file(`${client.zip}/${client.zip}-${kind}.jpg`, scan(`${client.zip}-${kind}`));
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
  return { name: "Lotto identità.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) };
};
const reading = (fileName) => {
  const [zipName, kind] = fileName.replace(/\.jpg$/, "").split("-");
  const client = CLIENTS.find((item) => item.zip === zipName);
  const company = kind === "identita" ? {} : client.read;
  return {
    document_type: TYPES[kind], contained_document_types: [], company_name_latin: company.latin ?? "", company_name_chinese: company.chinese ?? "",
    unified_social_credit_code: kind === "report" && client.foreignReport ? client.foreignReport : company.uscc ?? "",
    // The procura cites the fiscal representative, never the client's Italian VAT number (not yet assigned).
    italian_vat_number: "", legal_representative_name: "", legal_representative_id_number: "",
    fiscal_representative_name: kind === "mandato" ? "Rappresentante Srl" : "", fiscal_representative_tax_code: kind === "mandato" ? "13489331002" : "",
    document_date: "", expiry_date: kind === "registrazione_hk" ? "05/11/2099" : "", has_italian_translation: false, is_signed: true, issues: [],
  };
};

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
const row = (control, zip) => {
  const start = control.indexOf(zip);
  const next = CLIENTS.filter((client) => client.zip !== zip).map((client) => control.indexOf(client.zip, start)).filter((index) => index > start);
  return control.slice(start, next.length ? Math.min(...next) : undefined);
};

{
  const { ctx, page, pageErrors, agentCalls } = await open();
  await excelInput(page).setInputFiles(excel());
  await page.waitForFunction(() => /Rilevate 4 righe/.test(document.body.innerText), null, { timeout: 15000 });
  await zipInput(page).setInputFiles(await lotZip());
  await page.waitForFunction(() => /4 ZIP selezionati/.test(document.body.innerText) && !/Lettura|Indicizzazione in corso|Apertura|letture dell'agent in corso/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const t = await body(page);
  const control = section(t, "3. Controllo pratiche", "4. Documenti obbligatori");
  check("1 lo ZIP unico è diviso nei 4 clienti e l'agent legge ogni scansione", /4 ZIP selezionati/.test(t) && agentCalls.length === 24, `${agentCalls.length} letture: ${t.slice(0, 300)}`);
  check("1 due pratiche pronte e due bloccate", /2 pronte/.test(control) && /2 bloccate/.test(control), control.slice(0, 400));
  check("1 Cina: senza P.IVA nei documenti, verificata per ragione sociale", /Verificata per ragione sociale/.test(row(control, "CNTBA00011")) && /Pronta/.test(row(control, "CNTBA00011")), row(control, "CNTBA00011"));
  check("1 Hong Kong: nome con un'altra grafia, verificata per ragione sociale", /Verificata per ragione sociale/.test(row(control, "CNTBA00012")) && /Pronta/.test(row(control, "CNTBA00012")), row(control, "CNTBA00012"));
  check(
    "1 documenti di un'altra società: bloccata, con il nome letto",
    /Bloccata/.test(row(control, "CNTBA00013")) &&
      /né la ragione sociale della società: identità non verificabile\. Nei documenti la società risulta Guangzhou Hong Yu Trading Co\., Ltd\./.test(row(control, "CNTBA00013")),
    row(control, "CNTBA00013"),
  );
  check(
    "1 codici di credito di due società nello stesso ZIP: bloccata",
    /Bloccata/.test(row(control, "CNTBA00014")) && /Nello ZIP compaiono i codici di più società/.test(row(control, "CNTBA00014")),
    row(control, "CNTBA00014"),
  );
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await page.screenshot({ path: SHOTS + "vies-identity-by-name.png", fullPage: true });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
