import { chromium } from "playwright";
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

const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };
const mkPractice = (n, status, financial_status = "non_incassata", extra = {}) => ({
  id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`, practice_number: `PR-2026-00${n}`, practice_type: "vies", client_name: `Azienda ${n}`,
  client_phone: "0123", client_email: `a${n}@example.com`, beneficiary: null, policy_number: null, status, financial_status, payment_date: null, user_id: UID,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-02T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, ...extra,
});
const PRACTICES = [
  mkPractice(1, "in_lavorazione"), mkPractice(2, "in_attesa"), mkPractice(3, "integrazioni"), mkPractice(4, "approvata", "non_incassata"),
  mkPractice(5, "approvata", "incassata", { payment_date: iso(-2) }), mkPractice(6, "completata", "incassata"), mkPractice(7, "rifiutata"), mkPractice(8, "approvata", null),
];
const stageOf = (p) => p.status === "in_attesa" ? "in_valutazione" : p.status === "integrazioni" ? "integrazioni" : p.status === "approvata" ? (["incassata", "provvigioni_ricevute"].includes(p.financial_status) ? "da_emettere" : "deliberata") : p.status === "completata" ? "emessa" : p.status === "rifiutata" ? "non_deliberata" : "da_lavorare";
const WORKFLOW = [
  { practice_id: PRACTICES[3].id, payment_due_date: iso(3), deliberation_note: "Premio confermato", deliberated_at: "2026-10-05T10:00:00Z", target_portal: "alfa", sent_at: "2026-10-03T10:00:00Z", target_reference: "ALFA-1", source_portal: "broker-beta", source_reference: "LOTTO-1" },
  { practice_id: PRACTICES[7].id, payment_due_date: iso(30), deliberated_at: "2026-10-05T10:00:00Z" },
  { practice_id: PRACTICES[2].id, info_due_date: iso(-2) },
];
const LOTS = [
  { id: "lot-1", source_portal: "broker-beta", source_reference: "LOTTO-2", status: "received", expected_rows: 12, fiscal_representative_name: "Rappresentante Srl", notes: "ottobre", rejected_reason: null, received_at: "2026-10-09T09:00:00Z", created_at: "2026-10-09T08:00:00Z", files: [{ kind: "excel", file_name: "lotto.xlsx", storage_path: `${UID}/intake/lot-1/001-lotto.xlsx`, size: 10 }, { kind: "zip", file_name: "1.zip", storage_path: `${UID}/intake/lot-1/002-1.zip`, size: 10 }] },
  { id: "lot-0", source_portal: "broker-beta", source_reference: "LOTTO-1", status: "processed", expected_rows: 3, fiscal_representative_name: null, notes: null, rejected_reason: null, received_at: "2026-10-01T09:00:00Z", created_at: "2026-10-01T08:00:00Z", files: [] },
];
const EVENTS = [
  { id: "e1", direction: "inbound", portal_id: "alfa", event_type: "practice.deliberated", status: "processed", error: null, created_at: "2026-10-05T10:00:00Z" },
  { id: "e2", direction: "inbound", portal_id: "alfa", event_type: "practice.rejected", status: "failed", error: "La pratica è già emessa", created_at: "2026-10-06T10:00:00Z" },
];

const browser = await chromium.launch();

async function open({ admin = true, language = "it", pageErrors = [] } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { rest: [], api: [], storage: [], patches: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, headers: hdr });
    if (p.includes("/rpc/has_role")) return json(admin);
    if (p.includes("/rpc/")) return json([]);
    if (p.startsWith("/storage/v1/object/")) {
      log.storage.push({ method, path: p });
      if (method === "GET") return route.fulfill({ status: 200, headers: hdr, contentType: "application/octet-stream", body: "bytes" });
      if (p.includes("/sign/")) return json({ signedURL: `/object/sign/x?token=t` });
      return json({ Key: p.replace("/storage/v1/object/", "") });
    }
    if (p.startsWith("/storage/v1/")) return json({ signedURL: "/object/sign/x?token=t" });
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    log.rest.push({ method, table, query: url.search });
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const isHead = method === "HEAD";
    const reply = (rows) => {
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${rows.length}` } : {};
      if (isHead) return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    if (method === "PATCH") { log.patches.push({ table, query: url.search, body: JSON.parse(req.postData() || "{}") }); return json([]); }
    if (table === "user_roles") {
      // like the database: a filter on the role returns the row only when it matches
      const wanted = params.find(([k]) => k === "role")?.[1]?.replace("eq.", "");
      const mine = admin ? "admin" : "agente";
      return reply(!wanted || wanted === mine ? [{ user_id: UID, role: mine }] : []);
    }
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "practices") {
      let rows = PRACTICES.filter((row) => params.every(([k, v]) => {
        if (["select", "order", "limit", "offset"].includes(k)) return true;
        if (k === "or") { const clauses = v.replace(/^\(|\)$/g, "").split(","); return clauses.some((c) => { const [col, op, val] = c.split("."); return op === "is" ? row[col] == null : String(row[col]) === val; }); }
        if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
        if (v.startsWith("in.(")) return v.slice(4, -1).split(",").includes(String(row[k]));
        return true;
      }));
      const idFilter = params.find(([k, v]) => k === "id" && v.startsWith("eq."));
      if (idFilter) rows = PRACTICES.filter((row) => row.id === idFilter[1].slice(3));
      return reply(rows);
    }
    if (table === "practice_workflow") {
      const lte = params.find(([k]) => k === "payment_due_date")?.[1]?.replace("lte.", "");
      let rows = WORKFLOW;
      if (lte) rows = rows.filter((w) => w.payment_due_date <= lte && stageOf(PRACTICES.find((x) => x.id === w.practice_id)) === "deliberata");
      const idFilter = params.find(([k]) => k === "practice_id");
      if (idFilter) rows = rows.filter((w) => w.practice_id === idFilter[1].replace("eq.", ""));
      return reply(rows);
    }
    if (table === "practice_documents") return reply(params.some(([k]) => k === "document_type") ? [{ id: "d1", file_name: "bozza-compagnia.pdf", file_path: "x/bozza.pdf", document_type: "bozza_deliberata", created_at: "2026-10-05T10:00:00Z" }] : []);
    if (table === "practice_events") {
      if (params.some(([k, v]) => k === "event_type" && v.includes("info_requested"))) return reply([{ description: "Integrazioni richieste dalla compagnia: Allegare il bilancio 2025" }]);
      const mk = (id, event_type, description, at) => ({ id, practice_id: "x", event_type, description, created_at: at, created_by: UID });
      return reply([
        mk("t1", "workflow_sent", "Inviata al portale Compagnia Alfa (riferimento ALFA-1)", "2026-10-03T10:00:00Z"),
        mk("t2", "status_change", "Stato cambiato da In Lavorazione a In Attesa", "2026-10-03T10:00:01Z"),
        mk("t3", "workflow_info_requested", "Integrazioni richieste dalla compagnia: Allegare il bilancio 2025", "2026-10-04T10:00:00Z"), // earlier wording still reads
        mk("t4", "workflow_deliberated", "Deliberata: bozza da pagare (Compagnia Alfa) · pagamento entro il 30/11/2026 · Premio confermato", "2026-10-05T10:00:00Z"),
        mk("t5", "workflow_paid", "Pagamento registrato (10/11/2026) · Mario Admin", "2026-10-06T10:00:00Z"),
        mk("t6", "workflow_rejected", "Non deliberata: Rischio non assicurabile", "2026-10-07T10:00:00Z"),
        mk("t7", "workflow_issued", "Polizza emessa (Mario Admin)", "2026-10-08T10:00:00Z"),
        mk("t8", "workflow_reopened", "Pratica riaperta: errore", "2026-10-09T10:00:00Z"),
        mk("t9", "note", "Nota libera dell'utente", "2026-10-09T11:00:00Z"),
      ].reverse());
    }
    if (table === "vies_intake_lots") return reply(LOTS);
    if (table === "integration_events") return reply(EVENTS);
    if (table === "outbound_deliveries") return reply([
      { id: "d1", target_kind: "source", target_label: "broker-beta", event_type: "practice.deliberated", status: "delivered", attempts: 1, last_error: null, next_attempt_at: "2026-10-05T10:00:00Z", created_at: "2026-10-05T10:00:00Z", payload: { practice: { number: "PR-2026-004" } } },
      { id: "d2", target_kind: "portal", target_label: "Compagnia Alfa", event_type: "practice.paid", status: "failed", attempts: 1, last_error: "HTTP 401: nope", next_attempt_at: "2026-10-06T10:00:00Z", created_at: "2026-10-06T10:00:00Z", payload: { practice: { number: "PR-2026-004" } } },
      { id: "d3", target_kind: "source", target_label: "broker-beta", event_type: "lot.processed", status: "pending", attempts: 2, last_error: "HTTP 503", next_attempt_at: "2026-10-07T10:00:00Z", created_at: "2026-10-07T10:00:00Z", payload: { lot: { source_reference: "LOTTO-1" } } },
    ]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const req = route.request(); const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.api.push({ path: new URL(req.url()).pathname, body });
    const reply = (status, payload) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (body.action === "portal_status") return reply(200, { ok: true, public_url: "https://portale.tecnomga.com", email_ready: true, callback_url: "https://portale.tecnomga.com/api/vies-portal-callback", intake_url: "https://portale.tecnomga.com/api/vies-intake", intake_status_url: "https://portale.tecnomga.com/api/vies-intake-status", portals: [{ id: "alfa", name: "Compagnia Alfa", host: "portal.alfa.test", can_send: true, can_receive: true }, { id: "beta", name: "Beta", host: "beta.test", can_send: true, can_receive: false }] });
    if (body.action === "webhook_list") return reply(200, { ok: true, keys: [
      { id: "key-1", name: "Broker Beta", key_prefix: "tmga_abcd", partner_email: "b@example.test", is_active: true, mapped: true, webhook: { url: "https://hooks.beta.example/tecno", active: true, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z" }, pending: 1, failed: 2 },
      { id: "key-2", name: "Rappresentante Gamma", key_prefix: "tmga_wxyz", partner_email: null, is_active: true, mapped: false, webhook: null, pending: 0, failed: 0 },
    ] });
    if (body.action === "webhook_set") return reply(body.url?.startsWith("http://") ? 422 : 200, body.url?.startsWith("http://") ? { ok: false, error: "L'indirizzo deve iniziare con https://", code: "invalid_url" } : { ok: true, secret: body.rotateSecret || body.apiKeyId === "key-2" ? "whsec_" + "ab".repeat(32) : null, created: body.apiKeyId === "key-2" });
    if (body.action === "webhook_test") return reply(200, { ok: true, delivered: body.apiKeyId === "key-1", status: body.apiKeyId === "key-1" ? 200 : 401, error: body.apiKeyId === "key-1" ? null : "HTTP 401: nope" });
    if (body.action === "portal_test") return reply(200, { ok: true, delivered: true, status: 200, error: null });
    if (body.action === "deliveries_retry") return reply(200, { ok: true, attempted: 3, delivered: 2 });
    if (body.action === "intake_reject") return reply(200, { ok: true, notified: true });
    if (body.action === "workflow_reject" && body.reason === "FORCE-ERROR") return reply(409, { ok: false, error: "La pratica è già emessa", code: "invalid_transition" });
    if (String(body.action).startsWith("workflow_")) return reply(200, { ok: true, to: body.action === "workflow_deliberate" ? "deliberata" : "non_deliberata", changed: true });
    return reply(404, {});
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  if (process.env.DBG) page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 200)); });
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");

// 1) menu a sezioni + schede con contatori
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[role=tablist]", { timeout: 10000 });
  await page.waitForTimeout(800);
  const group = page.locator("[role=group]").first();
  const labels = (await group.locator("a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("1 il menu Pratiche si apre con le 7 sezioni", labels.length === 7, JSON.stringify(labels));
  check("1 voci del menu nell'ordine del flusso", labels[0].startsWith("Da lavorare") && labels[2].startsWith("Integrazioni richieste") && labels[3].startsWith("Deliberate · da pagare") && labels[6].startsWith("Non deliberate"), JSON.stringify(labels));
  const counts = Object.fromEntries(labels.map((l) => [l.replace(/[\d\s]+$/, "").replace(/\s*\d+\s*$/, ""), l]));
  check("1 contatori nel menu (Deliberate: avviso 1 in scadenza + totale 2)", /Deliberate · da pagare\s+1\s+2$/.test(labels[3]), labels[3]);
  const tabs = (await page.locator("[role=tab]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("1 schede: Tutte (8) + 7 sezioni", tabs.length === 8 && /^Tutte 8$/.test(tabs[0]), JSON.stringify(tabs));
  check("1 scheda Deliberate con avviso scadenza", /Deliberate · da pagare 2 1 in scadenza/.test(tabs[4]), tabs[4]);
  check("1 tutte le 8 pratiche in elenco", (await text(page)).includes("PR-2026-008") && (await text(page)).includes("PR-2026-001"));

  await page.getByRole("tab", { name: /^Deliberate · da pagare/ }).click();
  await page.waitForURL(/stage=deliberata/);
  await page.waitForTimeout(700);
  const body = await text(page);
  check("1 sezione Deliberate: solo le 2 pratiche deliberate non pagate", body.includes("PR-2026-004") && body.includes("PR-2026-008") && !body.includes("PR-2026-005") && !body.includes("PR-2026-001") && !body.includes("PR-2026-002"));
  const stageQuery = log.rest.filter((r) => r.table === "practices" && r.method === "GET" && r.query.includes("status=eq.approvata") && r.query.includes("financial_status") && !r.query.includes("head"));
  check("1 la query usa stato + incasso (non una colonna nuova)", stageQuery.length > 0, JSON.stringify(log.rest.filter((r) => r.table === "practices").slice(-3)));
  const active = await page.locator("[role=tab][aria-selected=true]").innerText();
  check("1 scheda attiva = Deliberate", /Deliberate/.test(active), active);

  await page.locator("[role=group] a", { hasText: "Integrazioni richieste" }).click();
  await page.waitForURL(/stage=integrazioni/);
  await page.waitForTimeout(600);
  const body2 = await text(page);
  check("1 dal menu: sezione Integrazioni -> solo PR-2026-003", body2.includes("PR-2026-003") && !body2.includes("PR-2026-004"));
  await page.screenshot({ path: SHOTS + "flow-sections.png" });

  await page.getByRole("tab", { name: /^Tutte/ }).click();
  await page.waitForTimeout(600);
  check("1 Tutte: torna l'elenco completo e l'indirizzo senza stage", !/stage=/.test(page.url()) && (await text(page)).includes("PR-2026-001"), page.url());
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) scheda Flusso (amministratore): pratica in valutazione
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  check("2 scheda Flusso: stato In valutazione", (await page.getByTestId("workflow-stage").innerText()).includes("In valutazione"));
  const btns = (await page.locator("[data-testid^=workflow-action-]").allInnerTexts()).map((t) => t.trim());
  check("2 azioni per In valutazione", JSON.stringify(btns) === JSON.stringify(["Richiedi integrazioni", "Delibera la pratica", "Declina la pratica", "Riapri la pratica"]), JSON.stringify(btns));
  // non deliberata senza motivo -> errore, nessuna chiamata
  await page.getByTestId("workflow-action-reject").click();
  await page.getByTestId("workflow-confirm").click();
  check("2 rifiuto senza motivo: errore di campo e nessuna chiamata", (await page.getByText("Campo obbligatorio").count()) === 1 && log.api.length === 0);
  await page.locator("#workflow-reason").fill("FORCE-ERROR");
  await page.getByTestId("workflow-confirm").click();
  await page.waitForSelector("text=Operazione non riuscita", { timeout: 5000 });
  check("2 errore del server mostrato e finestra ancora aperta", (await page.getByText("La pratica è già emessa").count()) >= 1 && (await page.getByTestId("workflow-confirm").count()) === 1);
  await page.getByRole("button", { name: "Annulla" }).click();
  await page.waitForTimeout(500);

  // richiesta di integrazioni: termine proposto a 7 giorni, modificabile, inviato all'API
  await page.getByTestId("workflow-action-requestInfo").click();
  check("2 richiesta integrazioni: termine proposto a 7 giorni", (await page.locator("#workflow-info-due").inputValue()) === iso(7), await page.locator("#workflow-info-due").inputValue());
  await page.locator("#workflow-message").fill("Visura aggiornata");
  await page.locator("#workflow-info-due").fill(iso(10));
  await page.getByTestId("workflow-confirm").click();
  await page.waitForSelector("text=Fatto", { timeout: 5000 });
  const infoCall = log.api.find((c) => c.body.action === "workflow_request_info");
  check("2 richiesta integrazioni: l'API riceve testo e termine", !!infoCall && infoCall.body.message === "Visura aggiornata" && infoCall.body.dueDate === iso(10), JSON.stringify(infoCall));
  await page.waitForTimeout(500);

  // deliberazione con bozza PDF: carica nello storage, poi chiama l'API con il percorso
  await page.getByTestId("workflow-action-deliberate").click();
  await page.locator("#workflow-file").setInputFiles({ name: "Bozza compagnia.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.locator("#workflow-due").fill(iso(10));
  await page.locator("#workflow-note").fill("Premio confermato");
  await page.getByTestId("workflow-confirm").click();
  for (let i = 0; i < 50 && !log.api.some((c) => c.body.action === "workflow_deliberate"); i += 1) await page.waitForTimeout(100);
  const call = log.api.find((c) => c.body.action === "workflow_deliberate");
  check("2 deliberazione: bozza caricata nella cartella della pratica", log.storage.some((s) => s.method === "POST" && s.path.includes(`/practice-documents/${PRACTICES[1].id}/bozza_deliberata-`)), JSON.stringify(log.storage));
  check("2 deliberazione: l'API riceve percorso, scadenza e nota", !!call && call.body.practiceId === PRACTICES[1].id && call.body.paymentDueDate === iso(10) && call.body.note === "Premio confermato" && call.body.draft?.storage_path?.startsWith(`${PRACTICES[1].id}/bozza_deliberata-`) && call.body.draft?.mime_type === "application/pdf" && !("content_base64" in call.body.draft), JSON.stringify(call));
  // file non PDF
  await page.waitForTimeout(500);
  await page.getByTestId("workflow-action-deliberate").click();
  await page.locator("#workflow-file").setInputFiles({ name: "documento.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await page.getByTestId("workflow-confirm").click();
  check("2 file non PDF rifiutato dal browser", (await page.getByText("Il file deve essere un PDF.").count()) === 1);
  await page.screenshot({ path: SHOTS + "flow-card-admin.png" });
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) scheda Flusso: deliberata con scadenza vicina, integrazioni, utente non amministratore
{
  const { ctx, page, pageErrors } = await open();
  await page.goto(`${BASE}/practices/${PRACTICES[3].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const card = await page.getByTestId("workflow-card").innerText();
  check("3 deliberata: stato, scadenza in giorni, bozza scaricabile", /Deliberate · da pagare/.test(card) && /mancano 3 giorni/.test(card) && /bozza-compagnia\.pdf/.test(card) && /Scarica/.test(card), card.replace(/\s+/g, " ").slice(0, 400));
  check("3 deliberata: portale, riferimento, origine, nota", /Inviata a alfa/.test(card) && /ALFA-1/.test(card) && /Proveniente da broker-beta/.test(card) && /Premio confermato/.test(card), card.replace(/\s+/g, " ").slice(0, 500));
  const btns = (await page.locator("[data-testid^=workflow-action-]").allInnerTexts()).map((t) => t.trim());
  check("3 deliberata: registra pagamento / non deliberata / riapri", JSON.stringify(btns) === JSON.stringify(["Registra pagamento", "Declina la pratica", "Riapri la pratica"]), JSON.stringify(btns));
  await page.getByTestId("workflow-action-registerPayment").click();
  await page.getByTestId("workflow-confirm").click();
  await page.waitForSelector("text=Fatto", { timeout: 5000 });
  await ctx.close();

  const c2 = await open();
  await c2.page.goto(`${BASE}/practices/${PRACTICES[2].id}`, { waitUntil: "networkidle" });
  await c2.page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await c2.page.waitForTimeout(600);
  const card2 = await c2.page.getByTestId("workflow-card").innerText();
  check("3 integrazioni: mostra cosa ha chiesto la compagnia", /Integrazioni richieste/.test(card2) && /Allegare il bilancio 2025/.test(card2), card2.replace(/\s+/g, " ").slice(0, 300));
  const dueLine = await c2.page.getByTestId("info-due").innerText();
  check("3 integrazioni in ritardo: il termine scaduto e' evidenziato", /In ritardo: dovevano arrivare entro il/.test(dueLine) && dueLine.includes(iso(-2).split("-").reverse().join("/")), dueLine);
  const btns2 = (await c2.page.locator("[data-testid^=workflow-action-]").allInnerTexts()).map((t) => t.trim());
  check("3 integrazioni: integrazioni fornite / delibera / declina / riapri", JSON.stringify(btns2) === JSON.stringify(["Integrazioni fornite", "Delibera la pratica", "Declina la pratica", "Riapri la pratica"]), JSON.stringify(btns2));
  await c2.ctx.close();

  const c3 = await open({ admin: false });
  await c3.page.goto(`${BASE}/practices/${PRACTICES[3].id}`, { waitUntil: "networkidle" });
  await c3.page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await c3.page.waitForTimeout(600);
  const card3 = await c3.page.getByTestId("workflow-card").innerText();
  check("3 utente normale: vede flusso e bozza, nessuna azione", /Deliberate · da pagare/.test(card3) && /Scarica/.test(card3) && (await c3.page.locator("[data-testid^=workflow-action-]").count()) === 0 && !/Decisione/.test(card3));
  check("3 nessun errore JS", pageErrors.length === 0 && c3.pageErrors.length === 0, [...pageErrors, ...c3.pageErrors].join(" | "));
  await c3.ctx.close();
}

// 4) lotti ricevuti nella pagina VIES
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/vies`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=received-lots]", { timeout: 15000 }).catch(() => {});
  const panel = page.getByTestId("received-lots");
  const present = (await panel.count()) === 1;
  check("4 pannello lotti ricevuti visibile", present, (await text(page)).slice(0, 300));
  if (present) {
    const t = await panel.innerText();
    check("4 lotto da caricare: origine, file, righe, rappresentante", /broker-beta · LOTTO-2/.test(t) && /Da caricare/.test(t) && /Excel, 1 ZIP/.test(t) && /12 pratiche attese/.test(t) && /Rappresentante Srl/.test(t), t.replace(/\s+/g, " ").slice(0, 300));
    check("4 gli elaborati sono nascosti finché non si chiede", !/LOTTO-1/.test(t));
    await panel.getByText("Mostra elaborati e rifiutati").click();
    check("4 storico visibile su richiesta", /LOTTO-1/.test(await panel.innerText()) && /Elaborato/.test(await panel.innerText()));
    await page.screenshot({ path: SHOTS + "flow-lots.png" });
    await panel.getByRole("button", { name: "Rifiuta", exact: true }).click();
    await page.getByRole("button", { name: "Conferma" }).click();
    check("4 rifiuto senza motivo non parte", (await page.getByText("Indicare il motivo").count()) === 1 && log.patches.length === 0);
    await page.locator("#lot-reject-reason").fill("Excel non conforme");
    await page.getByRole("button", { name: "Conferma" }).click();
    await page.waitForTimeout(600);
    const rej = log.api.find((c) => c.body.action === "intake_reject");
    check("4 rifiuto: passa dal server (il portale mittente viene avvisato) con lotto e motivo", !!rej && rej.body.lotId === "lot-1" && rej.body.reason === "Excel non conforme" && log.patches.length === 0, JSON.stringify(rej));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-testid=received-lots]", { timeout: 10000 });
    await page.getByTestId("received-lot-load").click();
    await page.waitForTimeout(1500);
    check("4 'Carica nel flusso' scarica i file del lotto dallo storage riservato", log.storage.filter((s) => s.method === "GET" && s.path.includes("/vies-batch-files/")).length >= 2, JSON.stringify(log.storage));
  }
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 5) impostazioni -> Connessioni
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: /Connessioni/ }).click();
  await page.waitForSelector("text=Portali collegati", { timeout: 8000 });
  await page.waitForTimeout(500);
  const t = await text(page);
  check("5 portali: nome, indirizzo, invio/risposte", /Compagnia Alfa/.test(t) && /portal\.alfa\.test/.test(t) && /Manca il segreto/.test(t) && /Pronto/.test(t), t.slice(0, 600));
  check("5 indirizzi da comunicare", /api\/vies-portal-callback/.test(t) && /api\/vies-intake\b/.test(t) && /api\/vies-intake-status/.test(t));
  check("5 registro scambi con esito e motivo", /practice\.deliberated/.test(t) && /Elaborato/.test(t) && /Non riuscito/.test(t) && /La pratica è già emessa/.test(t));
  check("5 nessun segreto nella pagina", !/secret|SECRET/.test(t.replace(/Manca il segreto/g, "")));
  // notifiche in uscita
  const sources = page.getByTestId("webhook-sources");
  await sources.waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  const st = await sources.innerText();
  check("5 chiavi: attive con indirizzo, non configurata, non associata a un utente", /Broker Beta/.test(st) && /Attive/.test(st) && /hooks\.beta\.example/.test(st) && /Rappresentante Gamma/.test(st) && /Non configurate/.test(st) && /Non associata a un utente/.test(st), st.replace(/\s+/g, " ").slice(0, 400));
  check("5 coda: 1 in attesa, 2 non consegnate", /1 in attesa/.test(st) && /2 non consegnate/.test(st), st.replace(/\s+/g, " ").slice(0, 300));
  check("5 il segreto non compare nell'elenco", !/whsec_/.test(await text(page)));
  await sources.getByRole("button", { name: "Prova", exact: true }).first().click();
  await page.waitForSelector("text=Notifica di prova consegnata", { timeout: 5000 });
  check("5 prova invio: chiama il server con la chiave", log.api.some((c) => c.body.action === "webhook_test" && c.body.apiKeyId === "key-1"));
  // configurare la seconda chiave: indirizzo http rifiutato, https accettato, segreto mostrato una volta
  await sources.getByTestId("webhook-configure").nth(1).click();
  await page.locator("#webhook-url").fill("http://hooks.gamma.example/x");
  await page.getByTestId("webhook-save").click();
  await page.waitForSelector("[role=alert]", { timeout: 5000 });
  check("5 indirizzo http: errore del server mostrato, finestra aperta", /https/.test(await page.locator("[role=alert]").first().innerText()) && (await page.locator("#webhook-url").count()) === 1);
  await page.locator("#webhook-url").fill("https://hooks.gamma.example/x");
  await page.getByTestId("webhook-save").click();
  await page.waitForSelector("[data-testid=webhook-secret]", { timeout: 5000 });
  const secretShown = await page.getByTestId("webhook-secret").innerText();
  const setCall = log.api.filter((c) => c.body.action === "webhook_set").at(-1);
  check("5 salvataggio: indirizzo, attivo, nessuna rotazione; segreto mostrato", setCall.body.apiKeyId === "key-2" && setCall.body.url === "https://hooks.gamma.example/x" && setCall.body.active === true && setCall.body.rotateSecret === false && /^whsec_[0-9a-f]{64}$/.test(secretShown), JSON.stringify(setCall) + secretShown);
  await page.getByRole("button", { name: "Ho copiato il segreto" }).click();
  await page.waitForTimeout(400);
  check("5 chiuso il segreto non resta nella pagina", !/whsec_/.test(await text(page)));
  // consegne in uscita
  const deliveries = page.getByTestId("outbound-deliveries");
  const dt = await deliveries.innerText();
  check("5 consegne: destinatario, evento, pratica, esito, errore", /broker-beta/.test(dt) && /Compagnia Alfa/.test(dt) && /practice\.paid/.test(dt) && /PR-2026-004/.test(dt) && /Consegnata/.test(dt) && /Non consegnata/.test(dt) && /Da ritentare/.test(dt) && /HTTP 401: nope/.test(dt), dt.replace(/\s+/g, " ").slice(0, 500));
  await deliveries.getByTestId("deliveries-retry-all").click();
  await page.waitForSelector("text=Riprovate 3: consegnate 2", { timeout: 5000 });
  check("5 riprova tutte: chiama il server", log.api.some((c) => c.body.action === "deliveries_retry" && !c.body.deliveryId));
  await deliveries.getByRole("button", { name: "Riprova", exact: true }).first().click();
  await page.waitForTimeout(500);
  check("5 riprova una: con l'id", log.api.some((c) => c.body.action === "deliveries_retry" && c.body.deliveryId === "d2"));
  // prova del portale della compagnia
  await page.getByRole("button", { name: "Prova invio" }).first().click();
  await page.waitForTimeout(600);
  check("5 prova portale compagnia", log.api.some((c) => c.body.action === "portal_test" && c.body.portalId === "alfa"));
  await page.screenshot({ path: SHOTS + "flow-connections.png" });
  check("5 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 6) cinese
{
  const { ctx, page, pageErrors } = await open({ language: "zh" });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[role=tablist]", { timeout: 10000 });
  await page.waitForTimeout(600);
  const tabs = (await page.locator("[role=tab]").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim());
  check("6 schede in cinese", /^全部/.test(tabs[0]) && tabs.some((x) => /已核准·待付款/.test(x)) && tabs.some((x) => /需补充材料/.test(x)), JSON.stringify(tabs));
  await page.goto(`${BASE}/practices/${PRACTICES[3].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await page.waitForTimeout(500);
  const card = await page.getByTestId("workflow-card").innerText();
  check("6 scheda Flusso in cinese", /申请评估/.test(card) && /还剩 3 天/.test(card) && /登记付款/.test(card), card.replace(/\s+/g, " ").slice(0, 300));
  check("6 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 7) storico del flusso nella lingua dell'utente
for (const [language, expected] of [
  ["en", [/Sent to portal Compagnia Alfa \(reference ALFA-1\)/, /Status changed from In Progress to Pending|Status changed from/, /Information requested: Allegare il bilancio 2025/, /Approved: draft to pay \(Compagnia Alfa\) · payment due by 30\/11\/2026 · Premio confermato/, /Payment recorded \(10\/11\/2026\) · Mario Admin/, /Not approved: Rischio non assicurabile/, /Policy issued \(Mario Admin\)/, /Practice reopened: errore/, /Nota libera dell'utente/]],
  ["zh", [/已提交至门户 Compagnia Alfa（参考号 ALFA-1）/, /要求补充材料：Allegare il bilancio 2025/, /已核准：待付款草稿（Compagnia Alfa） · 付款截止 30\/11\/2026 · Premio confermato/, /已登记付款（10\/11\/2026） · Mario Admin/, /未核准：Rischio non assicurabile/, /保单已出具（Mario Admin）/, /申请已重新打开：errore/]],
  ["it", [/Inviata al portale Compagnia Alfa \(riferimento ALFA-1\)/, /Deliberata: bozza da pagare \(Compagnia Alfa\) · pagamento entro il 30\/11\/2026 · Premio confermato/, /Pratica riaperta: errore/]],
]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/practices/${PRACTICES[3].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await page.waitForTimeout(800);
  const body = await text(page);
  const missing = expected.filter((re) => !re.test(body));
  check(`7 storico del flusso (${language})`, missing.length === 0, missing.map(String).join(" | ") + " :: " + body.slice(body.indexOf("Storico"), body.indexOf("Storico") + 400));
  check(`7 nessun errore JS (${language})`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 9) una sola sezione "Valutazione pratica" (niente piu' Gestione stato separata)
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOTS + "flow-evaluation.png" });
  const body = await text(page);
  const card = await page.getByTestId("workflow-card").innerText();
  check("9 la sezione si chiama Valutazione pratica", /Valutazione pratica/.test(card) && !/Flusso con la compagnia/.test(body));
  check("9 nessuna 'Gestione Stato' separata (ne' il menu a tendina di stato)", !/Gestione Stato/i.test(body) && (await page.locator("#status").count()) === 0);
  check("9 una sola scheda di valutazione", (await page.getByTestId("workflow-card").count()) === 1);
  check("9 testo della decisione: approva, integrazioni o declina; con la compagnia collegata arriva da solo", /Decisione/.test(card) && /Approva con la bozza, chiedi integrazioni o declina la pratica/.test(card) && /bozza e comunicazioni arrivano da sole/.test(card), card.replace(/\s+/g, " ").slice(0, 400));
  await page.getByTestId("workflow-action-reject").click();
  const dlg = await page.locator("[role=dialog]").innerText();
  check("9 declinare: finestra 'Declina la pratica' con motivo", /Declina la pratica/.test(dlg) && /Motivo/.test(dlg), dlg.replace(/\s+/g, " ").slice(0, 200));
  await page.locator("#workflow-reason").fill("Rischio fuori appetito");
  await page.getByTestId("workflow-confirm").click();
  await page.waitForSelector("text=Fatto", { timeout: 5000 });
  check("9 declinare: chiama il server con il motivo", log.api.some((c) => c.body.action === "workflow_reject" && c.body.reason === "Rischio fuori appetito" && c.body.practiceId === PRACTICES[1].id));
  check("9 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
  // in inglese e in cinese
  for (const [language, re] of [["en", /Practice evaluation/], ["zh", /申请评估/]]) {
    const c = await open({ language });
    await c.page.goto(`${BASE}/practices/${PRACTICES[1].id}`, { waitUntil: "networkidle" });
    await c.page.waitForSelector("[data-testid=workflow-card]", { timeout: 10000 });
    check(`9 titolo della sezione (${language})`, re.test(await c.page.getByTestId("workflow-card").innerText()));
    await c.ctx.close();
  }
}

// 8) Questionari: solo amministratori
{
  const user = await open({ admin: false });
  await user.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await user.page.waitForTimeout(800);
  const links = (await user.page.locator("aside a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("8 utente normale: nessuna voce Questionari nel menu", !links.some((t) => /Questionari/.test(t)) && links.some((t) => /Dashboard/.test(t)), JSON.stringify(links));
  await user.page.goto(`${BASE}/questionnaires`, { waitUntil: "networkidle" });
  await user.page.waitForTimeout(800);
  check("8 utente normale: /questionnaires riporta alla dashboard", /\/dashboard$/.test(user.page.url()) && !(await text(user.page)).includes("Questionari"), user.page.url());
  check("8 utente normale: nessun errore JS", user.pageErrors.length === 0, user.pageErrors.join(" | "));
  await user.ctx.close();

  const admin = await open({ admin: true });
  await admin.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await admin.page.waitForTimeout(800);
  const adminLinks = (await admin.page.locator("aside a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("8 amministratore: la voce Questionari c'e'", adminLinks.some((t) => /Questionari/.test(t)), JSON.stringify(adminLinks));
  await admin.page.locator("aside a", { hasText: "Questionari" }).click();
  await admin.page.waitForURL(/\/questionnaires/, { timeout: 5000 });
  await admin.page.waitForTimeout(600);
  check("8 amministratore: la pagina si apre", /\/questionnaires$/.test(admin.page.url()) && (await admin.page.locator("h1").first().innerText()).length > 0, admin.page.url());
  check("8 amministratore: nessun errore JS", admin.pageErrors.length === 0, admin.pageErrors.join(" | "));
  await admin.ctx.close();

  // senza ruolo leggibile (errore del database) la pagina non si mostra
  const broken = await open({ admin: true });
  await broken.ctx.route(`${SUPA}/rest/v1/user_roles*`, (route) => route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": BASE }, body: JSON.stringify({ message: "boom" }) }));
  await broken.page.goto(`${BASE}/questionnaires`, { waitUntil: "networkidle" });
  await broken.page.waitForTimeout(800);
  check("8 errore nel leggere il ruolo: non si mostra la pagina", !/\/questionnaires$/.test(broken.page.url()), broken.page.url());
  await broken.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
