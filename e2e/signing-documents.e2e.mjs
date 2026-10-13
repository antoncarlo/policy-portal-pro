// Bozza separata dal caricamento e documenti da firmare (flusso VIES):
//   1) rappresentante, pratica in valutazione: "Documenti ricevuti, in attesa della deliberazione", nessuna bozza,
//      il modulo precompilato per la compagnia non compare, i documenti da firmare mostrano la polizza "da firmare dopo"
//   2) rappresentante, pratica deliberata: "Bozza ricevuta il …" con download e passi successivi, polizza da firmare,
//      caricamento di una copia firmata con il tipo giusto
//   3) amministratore: vede il modulo per la compagnia con la sua etichetta, e la scheda modelli in Impostazioni
//   4) pagina Pratiche, lotto aperto: le azioni "Scarica documenti da firmare" e "Carica documenti firmati"
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };
const LOT = "11111111-1111-4111-8111-111111111111";
const mkPractice = (n, status, financial_status = "non_incassata") => ({
  id: `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`, practice_number: `VIES-2026-000${n}`, practice_type: "vies", client_name: `Azienda ${n}`,
  client_phone: "0123", client_email: `a${n}@example.com`, beneficiary: null, policy_number: null, status, financial_status, payment_date: null, user_id: UID,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-02T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, vies_batch_id: LOT, renewal_of: null,
});
const PRACTICES = [mkPractice(1, "in_attesa"), mkPractice(2, "approvata")];
const WORKFLOW = [{ practice_id: PRACTICES[1].id, payment_due_date: iso(10), deliberation_note: "Premio confermato", deliberated_at: "2026-10-05T10:00:00Z", target_portal: "alfa", sent_at: "2026-10-03T10:00:00Z" }];
const DOCS = [
  { id: "m1", practice_id: PRACTICES[0].id, file_name: "Polizza_VIES_Azienda_1.pdf", file_path: `${PRACTICES[0].id}/1-Polizza_VIES_Azienda_1.pdf`, file_size: 1000, mime_type: "application/pdf", document_type: "modulo_polizza_vies", uploaded_by: UID, created_at: "2026-10-01T10:01:00Z" },
  { id: "z1", practice_id: PRACTICES[0].id, file_name: "1.zip", file_path: `vies-batch-files://${UID}/${LOT}/1.zip`, file_size: 5000, mime_type: "application/zip", document_type: null, uploaded_by: UID, created_at: "2026-10-01T10:00:30Z" },
  { id: "m2", practice_id: PRACTICES[1].id, file_name: "Polizza_VIES_Azienda_2.pdf", file_path: `${PRACTICES[1].id}/1-Polizza_VIES_Azienda_2.pdf`, file_size: 1000, mime_type: "application/pdf", document_type: null, uploaded_by: UID, created_at: "2026-10-01T10:01:00Z" },
  { id: "b2", practice_id: PRACTICES[1].id, file_name: "bozza-compagnia.pdf", file_path: `${PRACTICES[1].id}/bozza_deliberata-1-bozza.pdf`, file_size: 2000, mime_type: "application/pdf", document_type: "bozza_deliberata", uploaded_by: UID, created_at: "2026-10-05T10:00:00Z" },
  { id: "s2", practice_id: PRACTICES[1].id, file_name: "mup-firmato.pdf", file_path: `${PRACTICES[1].id}/mup_firmato-1-mup.pdf`, file_size: 900, mime_type: "application/pdf", document_type: "mup_firmato", uploaded_by: UID, created_at: "2026-10-06T10:00:00Z" },
];
const TEMPLATES = ["mup.pdf", "privacy.pdf"].map((name) => ({ id: `t-${name}`, name, updated_at: "2026-09-30T10:00:00Z", created_at: "2026-09-30T10:00:00Z", metadata: { size: 1234 } }));

const browser = await chromium.launch();

async function open({ admin = true, pageErrors = [] } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { storage: [], inserts: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(admin);
    if (p.includes("/rpc/get_practice_lots")) return json([{ batch_id: LOT, lot_number: 1, name: "Excel Lotto 1 · VIES", fiscal_representative_name: "Rappresentante Srl", created_at: "2026-10-01T10:00:00Z", practice_count: 2 }]);
    if (p.includes("/rpc/")) return json([]);
    if (p.startsWith("/storage/v1/object/list/signing-templates")) return json(TEMPLATES);
    if (p.startsWith("/storage/v1/object/")) {
      log.storage.push({ method, path: p });
      if (method === "GET") return route.fulfill({ status: 200, headers: hdr, contentType: "application/pdf", body: "%PDF-1.4 bytes" });
      if (p.includes("/sign/")) return json({ signedURL: `/object/sign/x?token=t` });
      return json({ Key: p.replace("/storage/v1/object/", "") });
    }
    if (p.startsWith("/storage/v1/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => {
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${rows.length}` } : {};
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    const filter = (rows) => rows.filter((row) => params.every(([k, v]) => {
      if (["select", "order", "limit", "offset", "or"].includes(k)) return true;
      if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
      if (v.startsWith("in.")) return v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(row[k]));
      return true;
    }));
    if (method === "POST") { log.inserts.push({ table, body: JSON.parse(req.postData() || "{}") }); return json([{ id: "new", created_at: new Date().toISOString() }]); }
    if (method === "PATCH" || method === "DELETE") return json([]);
    if (table === "user_roles") { const wanted = params.find(([k]) => k === "role")?.[1]?.replace("eq.", ""); const mine = admin ? "admin" : "agente"; return reply(!wanted || wanted === mine ? [{ user_id: UID, role: mine }] : []); }
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
    if (table === "practices") return reply(filter(PRACTICES));
    if (table === "practice_workflow") return reply(filter(WORKFLOW));
    if (table === "practice_documents") return reply(filter(DOCS));
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");

// 1) rappresentante, pratica in valutazione
{
  const { ctx, page, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices/${PRACTICES[0].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const body = await text(page);
  check("1 in valutazione: 'Documenti ricevuti, in attesa della deliberazione'", (await page.getByTestId("draft-waiting").count()) === 1 && /Nessuna bozza è ancora stata emessa/.test(body));
  check("1 nessuna 'Bozza ricevuta' e nessun bottone di download della bozza", (await page.getByTestId("draft-received").count()) === 0 && (await page.getByTestId("draft-download").count()) === 0);
  check("1 il modulo precompilato per la compagnia non compare", !body.includes("Polizza_VIES_Azienda_1.pdf") && body.includes("1.zip"), body.slice(0, 300));
  check("1 niente scheda 'Documento di polizza VIES' per il rappresentante", !/Documento di polizza VIES/.test(body));
  check("1 documenti da firmare: 0 di 4 (la polizza si firma dopo)", (await page.getByTestId("signing-progress").innerText()).includes("0 di 4") && /Da firmare dopo la deliberazione/.test(await page.getByTestId("signing-slot-polizza_firmata").innerText()));
  check("1 modello scaricabile per MUP, assente per il set informativo", !(await page.getByTestId("signing-slot-mup").getByRole("button", { name: /Scarica il modello/ }).isDisabled()) && /Modello non ancora disponibile/.test(await page.getByTestId("signing-slot-set_informativo").innerText()));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) rappresentante, pratica deliberata
{
  const { ctx, page, log, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=draft-received]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const received = await page.getByTestId("draft-received").innerText();
  check("2 'Bozza ricevuta il 05/10/2026'", /Bozza ricevuta il 05\/10\/2026/.test(received), received.replace(/\s+/g, " ").slice(0, 200));
  check("2 passi successivi: controllo, firme, pagamento", /Prossimi passi/i.test(received) && /Documenti da firmare/.test(received), received.replace(/\s+/g, " ").slice(0, 300));
  check("2 bottone per scaricare la bozza", (await page.getByTestId("draft-download").count()) === 1, String(await page.getByTestId("draft-download").count()));
  check("2 pagamento entro la scadenza nei passi", new RegExp(`entro il ${iso(10).split("-").reverse().join("/")}`).test(received), received);
  check("2 modulo storico senza tipo (per nome) nascosto; bozza e copia firmata visibili", !(await text(page)).includes("Polizza_VIES_Azienda_2.pdf") && (await text(page)).includes("bozza-compagnia.pdf") && (await text(page)).includes("mup-firmato.pdf"));
  check("2 documenti da firmare: 1 di 5, MUP firmato il 06/10/2026, polizza da firmare con la bozza", (await page.getByTestId("signing-progress").innerText()).includes("1 di 5") && /Firmato il 06\/10\/2026/.test(await page.getByTestId("signing-slot-mup").innerText()) && !(await page.getByTestId("signing-slot-polizza_firmata").getByRole("button", { name: /Scarica la bozza da firmare/ }).isDisabled()));
  await page.locator(`#signing-upload-${PRACTICES[1].id}-privacy`).setInputFiles({ name: "privacy firmata.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 firmato") });
  await page.waitForTimeout(900);
  const insert = log.inserts.find((i) => i.table === "practice_documents");
  check("2 copia firmata caricata nella cartella della pratica con il tipo privacy_firmata", !!insert && insert.body.document_type === "privacy_firmata" && insert.body.file_path.startsWith(`${PRACTICES[1].id}/privacy_firmato-`) && log.storage.some((s) => s.method === "POST" && s.path.includes(`/practice-documents/${PRACTICES[1].id}/privacy_firmato-`)), JSON.stringify(insert));
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) amministratore: modulo visibile con etichetta; Impostazioni → Documenti da firmare
{
  const { ctx, page, pageErrors } = await open({ admin: true });
  await page.goto(`${BASE}/practices/${PRACTICES[0].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const body = await text(page);
  check("3 amministratore: il modulo per la compagnia c'è, con etichetta 'interno'", body.includes("Polizza_VIES_Azienda_1.pdf") && /Modulo per la compagnia \(interno\)/.test(body) && /Documento di polizza VIES/.test(body));
  check("3 amministratore: nessun avviso 'in attesa' (è lui che delibera)", (await page.getByTestId("draft-waiting").count()) === 0);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=settings-tab-signing]", { timeout: 10000 });
  await page.getByTestId("settings-tab-signing").click();
  await page.waitForTimeout(700);
  const settings = await text(page);
  check("3 Impostazioni → Documenti da firmare: modelli caricati e mancanti", /Modelli dei documenti da firmare/.test(settings) && /Caricato il 30\/09\/2026/.test(await page.getByTestId("signing-template-mup").innerText()) && /Nessun modello caricato/.test(await page.getByTestId("signing-template-antiriciclaggio").innerText()) && /si firma la bozza della compagnia/.test(await page.getByTestId("signing-template-polizza_firmata").innerText()));
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) pagina Pratiche, lotto aperto: azioni di firma in blocco
{
  const { ctx, page, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices?lot=${LOT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-download-signing-chip]", { timeout: 10000 });
  check("4 lotto aperto: 'Scarica documenti da firmare' e 'Carica documenti firmati'", (await page.getByTestId("lot-download-signing-chip").count()) === 1 && (await page.getByTestId("lot-upload-signed-chip").count()) === 1);
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
