// Ciclo del lotto VIES: il pannello nel lotto, i passaggi del rappresentante fiscale (verifica bozze, pagamento) e
// dell'amministratore (bozze in blocco, controllo del pagamento), il lotto chiuso.
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const LOT = "00000000-0000-4000-8000-0000000000aa";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const mk = (n, name, status, financial_status) => ({
  id: `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`, practice_number: `VIES-2026-000${n}-AAAA1111`, practice_type: "vies", client_name: name,
  client_phone: "0", client_email: "a@b.c", beneficiary: null, policy_number: null, status, financial_status, payment_date: null, user_id: UID,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: "2026-10-05", policy_end_date: null,
  premium_net: 800, premium_taxable: 800, premium_taxes: 200, premium_gross: 1000, commission_percentage: null, commission_amount: null, vies_batch_id: LOT,
});
const P1 = mk(1, "Azienda Uno Srl", "approvata", "non_incassata");
const P2 = mk(2, "Azienda Due Srl", "approvata", "non_incassata");
const P3 = mk(3, "Azienda Tre Srl", "in_attesa", "non_incassata");
const P4 = mk(4, "Azienda Quattro Srl", "rifiutata", "non_incassata");
const PRACTICES = [P1, P2, P3, P4];
const doc = (practice, type) => ({ practice_id: practice.id, file_name: `${type}.pdf`, document_type: type, created_at: "2026-10-05T10:00:00Z" });
const DRAFTS = [doc(P1, "bozza_deliberata"), doc(P2, "bozza_deliberata")];
const ISO = "2026-10-06T10:00:00Z";
const flowOf = (steps) => ({ batch_id: LOT, closed_at: null, ...Object.fromEntries(steps.flatMap((s) => [[`${s}_at`, ISO], [`${s}_by`, UID]])) });

const browser = await chromium.launch();
async function open({ admin = false, flow = null, docs = DRAFTS, lotDocs = [], events = [], paid = false } = {}) {
  const rows = paid ? PRACTICES.map((row) => (row === P1 || row === P2 ? { ...row, financial_status: "incassata", payment_date: "2026-10-12" } : row)) : PRACTICES;
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 1100 } });
  const log = { api: [], storage: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(admin);
    if (p.includes("/rpc/get_practice_lots")) return json([{ batch_id: LOT, lot_number: 3, name: "Excel Lotto 3 · VIES", fiscal_representative_name: "Rappresentante Srl", created_at: "2026-10-01T10:00:00Z", practice_count: 4 }]);
    if (p.includes("/rpc/")) return json([]);
    if (p.startsWith("/storage/v1/object/")) {
      log.storage.push({ method, path: p });
      if (method === "GET" && p.includes("/vies-batch-files/")) return route.fulfill({ status: 404, headers: hdr, contentType: "application/json", body: JSON.stringify({ message: "not found" }) });
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
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {};
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    if (method !== "GET" && method !== "HEAD") return json([]);
    if (table === "user_roles") {
      // like the database: a filter on the role returns the row only when it matches
      const wanted = params.find(([k]) => k === "role")?.[1]?.replace("eq.", "");
      const mine = admin ? "admin" : "agente";
      return reply(!wanted || wanted === mine ? [{ user_id: UID, role: mine }] : []);
    }
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
    if (table === "practices") {
      const found = rows.filter((row) => params.every(([k, v]) => {
        if (["select", "order", "limit", "offset", "or"].includes(k)) return true;
        if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
        if (v.startsWith("in.(")) return v.slice(4, -1).split(",").includes(String(row[k]));
        return true;
      }));
      return reply(found);
    }
    if (table === "practice_documents") return reply(docs.filter((d) => { const ids = params.find(([k]) => k === "practice_id")?.[1]; return !ids || !ids.startsWith("in.(") || ids.slice(4, -1).split(",").includes(d.practice_id); }));
    if (table === "vies_lot_flow") return reply(flow ? [flow] : []);
    if (table === "vies_lot_events") return reply(events);
    if (table === "vies_lot_documents") return reply(lotDocs);
    if (table === "vies_batches") return reply([{ id: LOT, lot_number: 3, created_at: "2026-10-01T10:00:00Z", fiscal_representative_id: "rep-1", paid_at: null, excel_storage_path: null, source_excel_file_name: null }]);
    if (table === "vies_fiscal_representatives") return reply([{ name: "Rappresentante Srl", tax_code: "12345678901" }]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => {
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    log.api.push({ path: new URL(route.request().url()).pathname, body });
    const extra = body.action === "lot_confirm_drafts" ? { practices: 2 } : body.action === "lot_confirm_payment" ? { registered: 2 } : body.action === "lot_mark_sent" ? { practices: 2 } : {};
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, changed: true, ...extra }) });
  });
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/practices?lot=${LOT}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-cycle]", { timeout: 12000 });
  return { ctx, page, log, pageErrors };
}
const states = async (page) => Object.fromEntries(await page.locator("[data-testid^=lot-step-]").evaluateAll((items) => items.map((i) => [i.getAttribute("data-testid").replace("lot-step-", ""), i.getAttribute("data-state")])));
const apiCalls = (log, action) => log.api.filter((c) => c.body.action === action);

// 1) fiscal representative: the drafts are in, it is their turn to verify
{
  const { ctx, page, log, pageErrors } = await open({ flow: flowOf(["drafts_uploaded"]) });
  const s = await states(page);
  check("1 8 passaggi: bozze fatto, verifica in corso, gli altri da fare", s.drafts === "done" && s.verify === "current" && ["payment", "payment_check", "copies", "sign", "send", "issued"].every((k) => s[k] === "todo"), JSON.stringify(s));
  check("1 'Tocca a te' e il suggerimento del rappresentante", /Tocca a te/.test(await page.getByTestId("lot-cycle-turn").innerText()) && /Scarica le bozze e i MUP/.test(await page.getByTestId("lot-cycle-hint").innerText()));
  check("1 una pratica non ancora deliberata aspetta la delibera", /1 pratica non ancora deliberata/.test(await page.getByTestId("lot-cycle-waiting").innerText()));
  check("1 il rappresentante vede scarica bozze e conferma; non i passaggi dell'amministratore", (await page.getByTestId("lot-action-download-drafts").count()) === 1 && (await page.getByTestId("lot-action-verify").count()) === 1 && (await page.getByTestId("lot-action-drafts").count()) === 0 && (await page.getByTestId("lot-action-check").count()) === 0);
  await page.getByTestId("lot-action-verify").click();
  const confirm = page.getByTestId("lot-verify-confirm");
  check("1 la conferma resta spenta finché non si spunta la dichiarazione", await confirm.isDisabled());
  await page.getByTestId("lot-verify-check").click();
  await confirm.click();
  await page.waitForTimeout(500);
  const call = apiCalls(log, "lot_confirm_drafts")[0];
  check("1 conferma delle bozze: una sola chiamata per il lotto", apiCalls(log, "lot_confirm_drafts").length === 1 && call.body.batchId === LOT, JSON.stringify(log.api));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 1b) the menu says which lots wait for the person looking at it
{
  const mine = await open({ flow: flowOf(["drafts_uploaded"]) });
  await mine.page.waitForSelector("[data-testid=lots-menu]", { timeout: 8000 });
  check("1b rappresentante: il lotto che aspetta le sue bozze ha il segno 'tocca a te' nel menu", (await mine.page.getByTestId("lots-menu-turn").count()) === 1);
  await mine.ctx.close();
  const theirs = await open({ admin: true, flow: flowOf(["drafts_uploaded"]) });
  await theirs.page.waitForSelector("[data-testid=lots-menu]", { timeout: 8000 });
  check("1b amministratore: lo stesso lotto, che aspetta il rappresentante, non ha il segno", (await theirs.page.getByTestId("lots-menu-turn").count()) === 0);
  await theirs.ctx.close();
  const admin = await open({ admin: true, flow: null, docs: [] });
  await admin.page.waitForSelector("[data-testid=lots-menu]", { timeout: 8000 });
  check("1b amministratore: un lotto da deliberare ha il segno", (await admin.page.getByTestId("lots-menu-turn").count()) === 1);
  await admin.ctx.close();
}

// 2) fiscal representative: pays the statement
{
  const { ctx, page, log, pageErrors } = await open({ flow: flowOf(["drafts_uploaded", "drafts_confirmed"]) });
  const s = await states(page);
  check("2 verificate le bozze: tocca al pagamento", s.verify === "done" && s.payment === "current", JSON.stringify(s));
  await page.getByTestId("lot-action-payment").click();
  await page.waitForSelector("[data-testid=lot-payment-amount]", { timeout: 10000 });
  // 2.000 € or 2000 €: the browser's Italian locale data decides whether four-digit amounts are grouped.
  check("2 l'estratto conto si prepara: 2 polizze deliberate, totale premi 2.000", /2 polizze/.test(await page.getByTestId("lot-payment-amount").innerText()) && /\b2\.?000,00\b/.test(await page.getByTestId("lot-payment-amount").innerText()), await page.getByTestId("lot-payment-amount").innerText());
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.getByTestId("lot-payment-statement").click()]);
  check("2 l'estratto conto si scarica come PDF 'Estratto conto Excel Lotto 3'", /^Estratto conto Excel Lotto 3 - Rappresentante Srl\.pdf$/.test(download.suggestedFilename()), download.suggestedFilename());
  check("2 senza i due file non si invia", await page.getByTestId("lot-payment-send").isDisabled());
  await page.getByTestId("lot-payment-signed").setInputFiles({ name: "estratto firmato.pdf.p7m", mimeType: "application/pkcs7-mime", buffer: Buffer.from("p7m") });
  await page.getByTestId("lot-payment-transfer").setInputFiles({ name: "bonifico.png", mimeType: "image/png", buffer: Buffer.from("png") });
  await page.getByTestId("lot-payment-send").click();
  await page.waitForTimeout(800);
  const pay = apiCalls(log, "lot_submit_payment")[0];
  check("2 i due file vanno nell'archivio del lotto", log.storage.filter((x) => x.method === "POST" && x.path.includes(`/vies-lot-documents/${LOT}/`)).length === 2, JSON.stringify(log.storage));
  check("2 il pagamento si registra con estratto firmato e bonifico", pay && pay.body.documents.map((d) => d.kind).sort().join() === "bonifico,estratto_conto_firmato" && pay.body.documents.every((d) => d.storage_path.startsWith(`${LOT}/`)), JSON.stringify(pay));
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) administrator: delibera e carica le bozze in blocco
{
  const { ctx, page, log, pageErrors } = await open({ admin: true, flow: null, docs: [] });
  const s = await states(page);
  check("3 amministratore: il primo passaggio è suo (bozze)", s.drafts === "current" && /Tocca a te/.test(await page.getByTestId("lot-cycle-turn").innerText()));
  await page.getByTestId("lot-action-drafts").click();
  await page.getByTestId("lot-bulk-input").setInputFiles([
    { name: "VIES-2026-0001-AAAA1111_bozza.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 uno") },
    { name: "Polizza Azienda Due Srl.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 due") },
    { name: "scan_001.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 senza testo") },
    { name: "scansione.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 boh") },
  ]);
  await page.waitForSelector("[data-testid=lot-bulk-row]", { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector("[data-testid=lot-bulk-reading]"), null, { timeout: 8000 });
  check("3 il portale riconosce 2 file su 4 (numero pratica, nome del cliente)", /2 file su 4 assegnati/.test(await page.getByTestId("lot-bulk-summary").innerText()), await page.getByTestId("lot-bulk-summary").innerText());
  const optionsOf = async (index) => (await page.locator("[data-testid=lot-bulk-row]").nth(index).locator("option").allInnerTexts()).map((t) => t.trim());
  const third = await optionsOf(2);
  check("3 la lista dei clienti si restringe: per un file da assegnare restano solo i clienti non ancora assegnati", third.length === 2 && /VIES-2026-0003/.test(third[1]), JSON.stringify(third));
  await page.locator("[data-testid=lot-bulk-row]").nth(2).locator("select").selectOption({ label: third[1] });
  const fourth = await optionsOf(3);
  check("3 assegnato il terzo cliente, l'ultimo file non ha più nulla da scegliere", fourth.length === 1, JSON.stringify(fourth));
  check("3 il cliente scelto resta nella lista del file a cui è assegnato (si può cambiare)", (await optionsOf(2)).length === 2);
  check("3 le pratiche senza file non ci sono più", (await page.getByTestId("lot-bulk-without").count()) === 0);
  await page.getByTestId("lot-bulk-run").click();
  await page.waitForSelector("[data-testid=lot-bulk-result]", { timeout: 10000 });
  const deliberate = apiCalls(log, "workflow_deliberate");
  check("3 le tre pratiche si deliberano con la bozza, senza e-mail per pratica (quiet)", deliberate.length === 3 && deliberate.every((c) => c.body.quiet === true && c.body.draft.storage_path.startsWith(c.body.practiceId + "/")), JSON.stringify(deliberate));
  const step = apiCalls(log, "lot_record_step")[0];
  check("3 il passaggio si registra una volta, con 3 pratiche collegate e il file non riconosciuto", apiCalls(log, "lot_record_step").length === 1 && step.body.step === "drafts_uploaded" && step.body.summary.attached === 3 && step.body.summary.unmatched.join() === "scansione.pdf", JSON.stringify(step));
  check("3 i file sono nelle cartelle delle pratiche", log.storage.filter((x) => x.method === "POST" && /\/practice-documents\/00000000-0000-4000-8000-0000000003(01|02|03)\/bozza_deliberata-/.test(x.path)).length === 3, JSON.stringify(log.storage));
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3b) il contenuto del PDF, non solo il nome: un file dal nome qualunque va al cliente scritto dentro
{
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Polizza fideiussoria. Contraente: AZIENDA DUE S.R.L. - Rappresentante fiscale", { x: 40, y: 700, size: 12, font });
  const withText = Buffer.from(await pdf.save());
  const { ctx, page, pageErrors } = await open({ admin: true, flow: flowOf(["drafts_uploaded", "drafts_confirmed", "payment_submitted", "payment_confirmed"]), paid: true });
  await page.getByTestId("lot-action-copies").click();
  await page.getByTestId("lot-bulk-input").setInputFiles([{ name: "documento-7781.pdf", mimeType: "application/pdf", buffer: withText }]);
  await page.waitForSelector("[data-testid=lot-bulk-row]", { timeout: 8000 });
  await page.waitForFunction(() => /nel documento/.test(document.querySelector("[data-testid=lot-bulk-row]")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => undefined);
  const row = await page.locator("[data-testid=lot-bulk-row]").first().innerText();
  check("3b il PDF 'documento-7781.pdf' va ad Azienda Due dal nome scritto dentro il documento (anche 'S.R.L.' con i punti)", /VIES-2026-0002/.test(await page.locator("[data-testid=lot-bulk-row] select").first().evaluate((el) => el.selectedOptions[0]?.textContent ?? "")) && /dal nome del cliente nel documento/.test(row), row.replace(/\s+/g, " "));
  check("3b nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) administrator: checks the payment
{
  const lotDocs = [
    { id: "d1", kind: "estratto_conto_firmato", file_name: "estratto firmato.pdf.p7m", file_path: `${LOT}/estratto.p7m`, file_size: 10, mime_type: "application/pkcs7-mime", uploaded_by: UID, created_at: ISO },
    { id: "d2", kind: "bonifico", file_name: "bonifico.png", file_path: `${LOT}/bonifico.png`, file_size: 10, mime_type: "image/png", uploaded_by: UID, created_at: ISO },
  ];
  const { ctx, page, log, pageErrors } = await open({ admin: true, flow: flowOf(["drafts_uploaded", "drafts_confirmed", "payment_submitted"]), lotDocs });
  const s = await states(page);
  check("4 pagamento inviato: all'amministratore tocca confermare", s.payment === "done" && s.payment_check === "current", JSON.stringify(s));
  await page.getByTestId("lot-action-check").click();
  await page.waitForSelector("[data-testid=lot-check-doc]", { timeout: 8000 });
  check("4 vede estratto conto firmato e bonifico", (await page.locator("[data-testid=lot-check-doc]").count()) === 2);
  await page.locator("#lot-pay-date").fill("2026-10-12");
  await page.getByTestId("lot-check-confirm").click();
  await page.waitForTimeout(500);
  const call = apiCalls(log, "lot_confirm_payment")[0];
  check("4 conferma dell'incasso con la data", call && call.body.batchId === LOT && call.body.paymentDate === "2026-10-12", JSON.stringify(call));
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 5) waiting for the other side, then the closed lot, with the register
{
  const { ctx, page, pageErrors } = await open({ admin: false, flow: flowOf(["drafts_uploaded", "drafts_confirmed", "payment_submitted"]) });
  check("5 il rappresentante, in attesa dell'amministratore: nessun pulsante di passaggio", /Attende l'amministratore/.test(await page.getByTestId("lot-cycle-turn").innerText()) && (await page.locator("[data-testid^=lot-action-]").count()) === 0);
  await ctx.close();
  const all = ["drafts_uploaded", "drafts_confirmed", "payment_submitted", "payment_confirmed", "copies_uploaded", "sent_to_company", "issued_uploaded"];
  const events = [{ id: 2, event_type: "closed", description: "Lotto 3 chiuso: tutte le polizze sono emesse e disponibili · Mario Admin", details: {}, created_by: UID, created_at: ISO }, { id: 1, event_type: "issued_uploaded", description: "Polizze emesse caricate: 2 pratiche collegate su 8 file · Mario Admin", details: {}, created_by: UID, created_at: ISO }];
  const closed = await open({ flow: { ...flowOf(all), closed_at: ISO }, docs: [...DRAFTS, ...[P1, P2].flatMap((p) => ["polizza_copia_compagnia", "polizza_firmata", "privacy_firmata", "mup_firmato", "antiriciclaggio_firmato", "polizza_emessa"].map((t) => doc(p, t)))], events });
  const s = await states(closed.page);
  check("5 lotto chiuso: tutti i passaggi fatti", Object.values(s).every((v) => v === "done"), JSON.stringify(s));
  check("5 lotto chiuso: etichetta e scarica tutto", /Lotto chiuso/.test(await closed.page.getByTestId("lot-cycle-turn").innerText()) && (await closed.page.getByTestId("lot-action-download-all").count()) === 1);
  await closed.page.getByTestId("lot-cycle-log-toggle").click();
  const log = await closed.page.getByTestId("lot-cycle-log").innerText();
  check("5 il registro del lotto mostra i passaggi, il più recente per primo", /Lotto chiuso[\s\S]*Polizze emesse caricate/.test(log) && /Mario Admin/.test(log), log);
  check("5 nessun errore JS", closed.pageErrors.length === 0, closed.pageErrors.join(" | "));
  await closed.ctx.close();
}

// 6) administrator: issued policies, four copies per practice, close the lot
{
  const all = ["drafts_uploaded", "drafts_confirmed", "payment_submitted", "payment_confirmed", "copies_uploaded", "sent_to_company"];
  const docs = [...DRAFTS, ...[P1, P2].flatMap((p) => ["polizza_copia_compagnia", "polizza_firmata", "privacy_firmata", "mup_firmato", "antiriciclaggio_firmato"].map((t) => doc(p, t)))];
  const { ctx, page, log, pageErrors } = await open({ admin: true, flow: flowOf(all), docs, paid: true });
  const s = await states(page);
  check("6 inviato alla compagnia: restano le polizze emesse", s.send === "done" && s.issued === "current", JSON.stringify(s));
  await page.getByTestId("lot-action-issued").click();
  const files = [P1, P2].flatMap((p) => [1, 2, 3, 4].map((n) => ({ name: `${p.practice_number}_copia${n}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${p.practice_number} ${n}`) })));
  await page.getByTestId("lot-bulk-input").setInputFiles(files);
  await page.waitForSelector("[data-testid=lot-bulk-row]", { timeout: 8000 });
  check("6 8 file, tutti assegnati (4 copie per pratica)", /8 file su 8 assegnati/.test(await page.getByTestId("lot-bulk-summary").innerText()), await page.getByTestId("lot-bulk-summary").innerText());
  await page.getByTestId("lot-bulk-run").click();
  await page.waitForSelector("[data-testid=lot-bulk-result]", { timeout: 10000 });
  const issue = apiCalls(log, "workflow_issue");
  check("6 una emissione per pratica con le 4 copie, senza e-mail per pratica", issue.length === 2 && issue.every((c) => c.body.documents.length === 4 && c.body.quiet === true), JSON.stringify(issue.map((c) => c.body.documents?.length)));
  const step = apiCalls(log, "lot_record_step")[0];
  check("6 il lotto si chiude con un solo passaggio registrato", apiCalls(log, "lot_record_step").length === 1 && step.body.step === "issued_uploaded" && step.body.summary.attached === 2 && step.body.summary.files === 8, JSON.stringify(step));
  check("6 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
