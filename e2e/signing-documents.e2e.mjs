// Bozza separata dal caricamento, documenti da firmare nell'ordine giusto e trasmissione alla compagnia (flusso VIES):
//   1) rappresentante, pratica in valutazione: "Documenti ricevuti, in attesa della deliberazione", nessuna bozza,
//      il modulo precompilato per la compagnia non compare, le firme non sono ancora aperte
//   2) rappresentante, pratica deliberata: "Bozza ricevuta il …" con download e passi successivi; documenti da firmare
//      nell'ordine polizza copia Compagnia, privacy, MUP, antiriciclaggio; la copia per la Compagnia si scarica;
//      caricamento di una copia firmata con il tipo giusto; con firme incomplete nessuna trasmissione
//   3) rappresentante, pratica con tutte le firme: la trasmissione alla compagnia parte da sola
//   4) amministratore: vede il modulo per la compagnia con la sua etichetta, e la scheda modelli in Impostazioni
//   6) amministratore: ZIP firmato con file .p7m caricato dal lotto
//   5) pagina Pratiche, lotto aperto: le azioni "Scarica documenti da firmare" e "Carica documenti firmati"
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
const PRACTICES = [mkPractice(1, "in_attesa"), mkPractice(2, "approvata"), mkPractice(3, "approvata")];
const WORKFLOW = [
  { practice_id: PRACTICES[1].id, payment_due_date: iso(10), deliberation_note: "Premio confermato", deliberated_at: "2026-10-05T10:00:00Z", target_portal: "alfa", sent_at: "2026-10-03T10:00:00Z", signed_sent_at: null },
  { practice_id: PRACTICES[2].id, payment_due_date: iso(12), deliberated_at: "2026-10-05T10:00:00Z", target_portal: "alfa", sent_at: "2026-10-03T10:00:00Z", signed_sent_at: null },
];
const doc = (id, practice, file_name, document_type, created_at, extra = {}) => ({ id, practice_id: practice.id, file_name, file_path: `${practice.id}/${document_type ?? "x"}-${file_name}`, file_size: 1000, mime_type: "application/pdf", document_type, uploaded_by: UID, created_at, ...extra });
const AML = [{ practice_id: PRACTICES[2].id, data: {}, sources: { files: ["licenza.pdf", "id.jpg", "ubo.pdf"], issues: ["Documento del legale rappresentante scaduto il 30/09/2025"], skipped: [] }, extracted_at: "2026-10-12T09:00:00Z" }];
const DOCS = [
  doc("m1", PRACTICES[0], "Polizza_VIES_Azienda_1.pdf", "modulo_polizza_vies", "2026-10-01T10:01:00Z"),
  doc("z1", PRACTICES[0], "1.zip", null, "2026-10-01T10:00:30Z", { file_path: `vies-batch-files://${UID}/${LOT}/1.zip`, mime_type: "application/zip", file_size: 5000 }),
  doc("m2", PRACTICES[1], "Polizza_VIES_Azienda_2.pdf", null, "2026-10-01T10:01:00Z"),
  doc("b2", PRACTICES[1], "bozza-compagnia.pdf", "bozza_deliberata", "2026-10-05T10:00:00Z"),
  doc("c2", PRACTICES[1], "copia-compagnia.pdf", "polizza_copia_compagnia", "2026-10-05T10:00:01Z"),
  doc("s2", PRACTICES[1], "mup-firmato.pdf", "mup_firmato", "2026-10-06T10:00:00Z"),
  doc("b3", PRACTICES[2], "bozza-3.pdf", "bozza_deliberata", "2026-10-05T10:00:00Z"),
  doc("c3", PRACTICES[2], "copia-3.pdf", "polizza_copia_compagnia", "2026-10-05T10:00:01Z"),
  doc("p3", PRACTICES[2], "polizza-firmata.pdf", "polizza_firmata", "2026-10-07T10:00:00Z"),
  doc("v3", PRACTICES[2], "privacy.pdf", "privacy_firmata", "2026-10-07T10:01:00Z"),
  doc("u3", PRACTICES[2], "mup.pdf", "mup_firmato", "2026-10-07T10:02:00Z"),
  doc("a3", PRACTICES[2], "aml.pdf", "antiriciclaggio_firmato", "2026-10-07T10:03:00Z"),
];
const TEMPLATES = ["mup.pdf", "privacy.pdf"].map((name) => ({ id: `t-${name}`, name, updated_at: "2026-09-30T10:00:00Z", created_at: "2026-09-30T10:00:00Z", metadata: { size: 1234 } }));

const browser = await chromium.launch();

async function open({ admin = true, pageErrors = [] } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { storage: [], inserts: [], api: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(admin);
    if (p.includes("/rpc/get_practice_lots")) return json([{ batch_id: LOT, lot_number: 1, name: "Excel Lotto 1 · VIES", fiscal_representative_name: "Rappresentante Srl", created_at: "2026-10-01T10:00:00Z", practice_count: 3 }]);
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
    if (table === "practice_aml_data") return reply(filter(AML));
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => {
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    log.api.push({ path: new URL(route.request().url()).pathname, body });
    let payload = { ok: true };
    if (body.action === "workflow_send_signed") {
      // Come il server vero: la data resta nella riga del flusso e le letture successive la trovano.
      const row = WORKFLOW.find((w) => w.practice_id === body.practiceId);
      if (row) row.signed_sent_at = "2026-10-13T10:00:00Z";
      payload = { ok: true, changed: true, sentAt: "2026-10-13T10:00:00Z", stage: "deliberata" };
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");

// 1) rappresentante, pratica in valutazione
{
  const { ctx, page, log, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices/${PRACTICES[0].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const body = await text(page);
  check("1 in valutazione: 'Documenti ricevuti, in attesa della deliberazione'", (await page.getByTestId("draft-waiting").count()) === 1 && /Nessuna bozza è ancora stata emessa/.test(body));
  check("1 nessuna 'Bozza ricevuta' e nessun bottone di download della bozza", (await page.getByTestId("draft-received").count()) === 0 && (await page.getByTestId("draft-download").count()) === 0);
  check("1 il modulo precompilato per la compagnia non compare", !body.includes("Polizza_VIES_Azienda_1.pdf") && body.includes("1.zip"), body.slice(0, 300));
  check("1 niente scheda 'Documento di polizza VIES' per il rappresentante", !/Documento di polizza VIES/.test(body));
  check("1 firme non ancora aperte: 'Le firme iniziano dopo la deliberazione', nessun documento elencato", (await page.getByTestId("signing-before").count()) === 1 && (await page.locator("[data-testid^=signing-slot-]").count()) === 0 && (await page.getByTestId("signing-progress").count()) === 0);
  check("1 nessuna trasmissione chiamata", !log.api.some((c) => c.body.action === "workflow_send_signed"));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) rappresentante, pratica deliberata con firme incomplete
{
  const { ctx, page, log, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=draft-received]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const received = await page.getByTestId("draft-received").innerText();
  check("2 'Bozza ricevuta il 05/10/2026'", /Bozza ricevuta il 05\/10\/2026/.test(received), received.replace(/\s+/g, " ").slice(0, 200));
  check("2 passi successivi: controllo (la bozza non si firma), firme nell'ordine, trasmissione, pagamento, copie", /la bozza non si firma/.test(received) && /copia per la Compagnia, privacy, MUP e antiriciclaggio/.test(received) && /partono da sole verso la compagnia/.test(received) && /copie della polizza emessa/.test(received), received.replace(/\s+/g, " ").slice(0, 600));
  check("2 bottone per scaricare la bozza", (await page.getByTestId("draft-download").count()) === 1);
  check("2 modulo storico senza tipo (per nome) nascosto; bozza, copia per la Compagnia e copia firmata visibili", !(await text(page)).includes("Polizza_VIES_Azienda_2.pdf") && (await text(page)).includes("bozza-compagnia.pdf") && (await text(page)).includes("copia-compagnia.pdf") && (await text(page)).includes("mup-firmato.pdf"));
  const order = await page.locator("[data-testid^=signing-slot-]").evaluateAll((items) => items.map((item) => item.getAttribute("data-testid").replace("signing-slot-", "")));
  check("2 ordine di firma: polizza copia Compagnia, privacy, MUP, antiriciclaggio", JSON.stringify(order) === JSON.stringify(["polizza_firmata", "privacy", "mup", "antiriciclaggio"]), JSON.stringify(order));
  check("2 documenti da firmare: 1 di 4, MUP firmato il 06/10/2026", (await page.getByTestId("signing-progress").innerText()).includes("1 di 4") && /Firmato il 06\/10\/2026/.test(await page.getByTestId("signing-slot-mup").innerText()));
  check("2 la copia per la Compagnia si scarica; la bozza non e' tra i documenti da firmare", !(await page.getByTestId("signing-company-copy-download").isDisabled()) && !/bozza-compagnia\.pdf/.test(await page.getByTestId("signing-card").innerText()));
  check("2 documenti dello ZIP non ancora letti: lo dice, con il pulsante per leggerli", /Non ancora letti/.test(await page.getByTestId("signing-aml").innerText()) && /Leggi i documenti/.test(await page.getByTestId("signing-aml-read").innerText()));
  await page.getByTestId("signing-aml-read").click();
  await page.waitForTimeout(800);
  check("2 nessun documento utile indicizzato: errore chiaro, nessuna chiamata a vuoto", /Lettura dei documenti non riuscita/.test(await text(page)));
  check("2 il rappresentante non vede il campo del numero di polizza", (await page.getByTestId("signing-policy-number").count()) === 0);
  check("2 privacy, MUP e antiriciclaggio: modello sempre disponibile (integrato nel portale)", !(await page.getByTestId("signing-slot-privacy").getByRole("button", { name: /Scarica il modello/ }).isDisabled()) && !(await page.getByTestId("signing-slot-antiriciclaggio").getByRole("button", { name: /Scarica il modello/ }).isDisabled()) && !/Modello non ancora disponibile/.test(await page.getByTestId("signing-card").innerText()));
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByTestId("signing-slot-antiriciclaggio").getByRole("button", { name: /Scarica il modello/ }).click()]);
  const downloadedPath = await download.path();
  const downloaded = downloadedPath ? (await import("node:fs")).readFileSync(downloadedPath) : Buffer.alloc(0);
  check("2 il download e' il PDF dell'antiriciclaggio compilato per la pratica, nome con ordine e numero", /^4_antiriciclaggio_VIES-2026-0002\.pdf$/.test(download.suggestedFilename()) && downloaded.subarray(0, 5).toString() === "%PDF-" && downloaded.length > 150000, `${download.suggestedFilename()} ${downloaded.length}`);
  await page.locator(`#signing-upload-${PRACTICES[1].id}-privacy`).setInputFiles({ name: "privacy firmata.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 firmato") });
  await page.waitForTimeout(900);
  const insert = log.inserts.find((i) => i.table === "practice_documents");
  check("2 copia firmata caricata nella cartella della pratica con il tipo privacy_firmata", !!insert && insert.body.document_type === "privacy_firmata" && insert.body.file_path.startsWith(`${PRACTICES[1].id}/privacy_firmato-`) && log.storage.some((s) => s.method === "POST" && s.path.includes(`/practice-documents/${PRACTICES[1].id}/privacy_firmato-`)), JSON.stringify(insert));
  check("2 firme incomplete: nessuna trasmissione alla compagnia", !log.api.some((c) => c.body.action === "workflow_send_signed"), JSON.stringify(log.api));
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) rappresentante, tutte le firme caricate: trasmissione automatica
{
  const { ctx, page, log, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices/${PRACTICES[2].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  for (let i = 0; i < 50 && !log.api.some((c) => c.body.action === "workflow_send_signed"); i += 1) await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  const sends = log.api.filter((c) => c.body.action === "workflow_send_signed");
  check("3 4 di 4 firmati: la trasmissione parte da sola, una volta, per la pratica giusta", sends.length === 1 && sends[0].body.practiceId === PRACTICES[2].id && sends[0].body.resend === false, JSON.stringify(sends));
  check("3 dopo la risposta: 'Copie firmate trasmesse alla compagnia il 13/10/2026'", (await page.getByTestId("signing-sent").count()) === 1 && /trasmesse alla compagnia il 13\/10\/2026/.test(await page.getByTestId("signing-sent").innerText()), await page.getByTestId("signing-card").innerText());
  const amlPanel = await page.getByTestId("signing-aml").innerText();
  check("3 dati letti dai documenti: data, numero di documenti, segnalazioni da controllare, 'bozza da verificare'", /Letti il 12\/10\/2026 da 3 documenti/.test(amlPanel) && /bozza da verificare/.test(amlPanel) && /scaduto il 30\/09\/2025/.test(await page.getByTestId("signing-aml-issues").innerText()) && /Rileggi i documenti/.test(amlPanel), amlPanel);
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) amministratore: modulo visibile con etichetta; copia per la Compagnia caricabile; Impostazioni → Documenti da firmare
{
  const { ctx, page, log, pageErrors } = await open({ admin: true });
  await page.goto(`${BASE}/practices/${PRACTICES[0].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const body = await text(page);
  check("4 amministratore: il modulo per la compagnia c'è, con etichetta 'interno'", body.includes("Polizza_VIES_Azienda_1.pdf") && /Modulo per la compagnia \(interno\)/.test(body) && /Documento di polizza VIES/.test(body));
  check("4 amministratore: nessun avviso 'in attesa' (è lui che delibera)", (await page.getByTestId("draft-waiting").count()) === 0);
  await page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=signing-card]", { timeout: 10000 });
  check("4 amministratore: può allegare la copia per la Compagnia dalla sezione firme", (await page.getByTestId("signing-company-copy-upload").count()) === 1);
  await page.locator("#signing-policy-input").fill("FID-2026-445");
  await page.getByTestId("signing-policy-save").click();
  await page.waitForTimeout(500);
  const policyCall = log.api.find((c) => c.body.action === "workflow_set_policy_number");
  check("4 amministratore: registra il numero di polizza della compagnia (dopo la delibera)", !!policyCall && policyCall.body.practiceId === PRACTICES[1].id && policyCall.body.policyNumber === "FID-2026-445", JSON.stringify(policyCall));
  await page.getByTestId("workflow-action-reopen").waitFor({ timeout: 5000 }).catch(() => {});
  await page.getByTestId("workflow-action-registerPayment").click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=settings-tab-signing]", { timeout: 10000 });
  await page.getByTestId("settings-tab-signing").click();
  await page.waitForTimeout(700);
  const settings = await text(page);
  check("4 Impostazioni → Documenti da firmare: privacy, MUP e antiriciclaggio integrati (nessun caricamento), polizza senza modello", /Modelli dei documenti da firmare/.test(settings) && /Modello integrato/.test(await page.getByTestId("signing-template-mup").innerText()) && /Modello integrato/.test(await page.getByTestId("signing-template-antiriciclaggio").innerText()) && (await page.locator("[id^=signing-template-]").count()) === 0 && /si firma la copia per la Compagnia/.test(await page.getByTestId("signing-template-polizza_firmata").innerText()));
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 5) pagina Pratiche, lotto aperto: azioni di firma in blocco
{
  const { ctx, page, pageErrors } = await open({ admin: false });
  await page.goto(`${BASE}/practices?lot=${LOT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-download-signing-chip]", { timeout: 10000 });
  check("5 lotto aperto: 'Scarica documenti da firmare' e 'Carica documenti firmati'", (await page.getByTestId("lot-download-signing-chip").count()) === 1 && (await page.getByTestId("lot-upload-signed-chip").count()) === 1);
  check("5 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 6) amministratore, lotto aperto: ZIP dei documenti firmati digitalmente (.p7m), in cartelle e con nomi appiattiti
{
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(`${PRACTICES[1].practice_number}/3_mup.pdf.p7m`, "p7m-bytes-mup");
  zip.file(`${PRACTICES[1].practice_number}/1_polizza_copia_compagnia_Azienda_2.pdf.p7m`, "p7m-bytes-polizza");
  zip.file(`${PRACTICES[2].practice_number}_2_privacy.pdf.p7m`, "p7m-bytes-privacy"); // senza cartella: il numero e' nel nome
  zip.file("note.txt", "non e' un documento firmato");
  zip.file(`${PRACTICES[0].practice_number}/3_mup.pdf.p7m`, "pratica non deliberata");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const { ctx, page, log, pageErrors } = await open({ admin: true });
  await page.goto(`${BASE}/practices?lot=${LOT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-upload-signed-chip]", { timeout: 10000 });
  await page.locator(`#signed-upload-${LOT}-chip`).setInputFiles({ name: "firmati.zip", mimeType: "application/zip", buffer });
  await page.waitForTimeout(2500);
  const docs = log.inserts.filter((i) => i.table === "practice_documents").map((i) => i.body);
  const find = (practice, type) => docs.find((d) => d.practice_id === practice.id && d.document_type === type);
  check("6 MUP firmato .p7m nella cartella della pratica giusta, tipo mup_firmato, tipo file p7m", !!find(PRACTICES[1], "mup_firmato") && find(PRACTICES[1], "mup_firmato").mime_type === "application/pkcs7-mime" && find(PRACTICES[1], "mup_firmato").file_name === "3_mup.pdf.p7m", JSON.stringify(docs));
  check("6 copia polizza firmata .p7m riconosciuta (polizza_firmata)", !!find(PRACTICES[1], "polizza_firmata") && find(PRACTICES[1], "polizza_firmata").file_name.endsWith(".pdf.p7m"));
  check("6 file senza cartella: la pratica si riconosce dal numero nel nome", !!find(PRACTICES[2], "privacy_firmata"));
  check("6 testo, e pratica non deliberata: ignorati (3 file caricati, non 5)", docs.length === 3, String(docs.length));
  check("6 niente errore 'Nessun file riconosciuto'", !/Nessun file riconosciuto/.test(await text(page)));
  check("6 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
