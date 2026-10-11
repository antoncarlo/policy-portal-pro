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

const ids = Array.from({ length: 4 }, (_, i) => `00000000-0000-4000-8000-0000000003${String(i + 1).padStart(2, "0")}`);
const base = (over) => ({
  id: "", practice_type: "vies", client_name: "Azienda", client_phone: "1", client_email: "a@b.c", beneficiary: null, policy_number: null, status: "in_lavorazione", financial_status: "non_incassata",
  payment_date: null, user_id: UID, created_at: "2026-10-08T10:00:00Z", updated_at: "2026-10-08T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, vies_batch_id: null, ...over,
});
const PRACTICES = [
  base({ id: ids[0], practice_number: "VIES-2026-0001-AAAA1111", client_name: "Alfa Srl" }),
  base({ id: ids[1], practice_number: "VIES-2026-0002-AAAA1111", client_name: "Beta Spa" }),
  base({ id: ids[2], practice_number: "VIES-2026-0003-AAAA1111", client_name: "Gamma Srl", status: "completata" }),
  base({ id: ids[3], practice_number: "VIES-2026-0004-AAAA1111", client_name: "Delta Srl", status: "approvata" }),
];

const browser = await chromium.launch();
async function open({ language = "it", controlReply } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 1000 } });
  const log = { control: [], patches: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(true);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    if (method === "PATCH" || method === "POST" || method === "DELETE") { log.patches.push(`${method} ${table}`); return json([]); }
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => {
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${rows.length}` } : {};
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "practices") return reply([...PRACTICES].sort((a, b) => a.practice_number.localeCompare(b.practice_number)));
    return reply([]);
  });
  await ctx.route(`${BASE}/api/vies-control`, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    log.control.push(body);
    const reply = controlReply ? controlReply(body) : { ok: true, status: body.status, requested: body.practiceIds.length, changed: body.practiceIds.length, unchanged: 0, blocked: 0, failed: 0, results: [] };
    return route.fulfill({ status: reply.__status ?? 200, contentType: "application/json", body: JSON.stringify(reply) });
  });
  await ctx.route(`${BASE}/api/**`, (route) => {
    if (route.request().url().endsWith("/api/vies-control")) return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const pick = async (page, number) => page.getByRole("checkbox", { name: new RegExp(number) }).click();
const chooseStatus = async (page, label) => {
  await page.getByRole("combobox").filter({ hasText: /./ }).last().click();
  await page.getByRole("option", { name: label }).click();
};

// 1) a plain change: one call to the company flow, never a direct write on the practices
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0001-AAAA1111");
  await pick(page, "VIES-2026-0002-AAAA1111");
  check("1 due pratiche selezionate", /2 pratiche selezionate/.test(await text(page)));
  await chooseStatus(page, "In Attesa");
  check("1 'In attesa': nessun campo di testo", (await page.locator("[data-testid=bulk-note]").count()) === 0);
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  check("1 una sola chiamata al flusso, con le due pratiche e lo stato", log.control.length === 1 && log.control[0].action === "workflow_bulk_status" && log.control[0].status === "in_attesa" && JSON.stringify(log.control[0].practiceIds.sort()) === JSON.stringify([ids[0], ids[1]]), JSON.stringify(log.control));
  check("1 nessuna scrittura diretta sulla tabella delle pratiche", log.patches.length === 0, log.patches.join(", "));
  check("1 conferma all'utente", /Stato aggiornato/.test(await text(page)), (await text(page)).slice(0, 300));
  check("1 la selezione si azzera", /0 pratiche selezionate/.test(await text(page)));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) rejecting needs the reason: nothing is sent without it, and it travels with the call
{
  const { ctx, page, log } = await open();
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0001-AAAA1111");
  await chooseStatus(page, "Rifiutata");
  const note = page.locator("[data-testid=bulk-note]");
  check("2 'Rifiutata': compare il campo del motivo", (await note.count()) === 1);
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(400);
  check("2 senza motivo non parte nulla e l'utente è avvisato", log.control.length === 0 && /Indica il testo/.test(await text(page)), JSON.stringify(log.control));
  await note.fill("Rischio non assicurabile");
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  check("2 con il motivo la chiamata lo porta", log.control.length === 1 && log.control[0].status === "rifiutata" && log.control[0].note === "Rischio non assicurabile", JSON.stringify(log.control));
  await page.screenshot({ path: SHOTS + "bulk-status-reject.png" });
  await ctx.close();
}

// 3) 'integrazioni' asks what is needed too; other statuses do not send a note
{
  const { ctx, page, log } = await open();
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0001-AAAA1111");
  await chooseStatus(page, "Integrazioni richieste");
  check("3 'Integrazioni': campo di testo con la richiesta", (await page.locator("[data-testid=bulk-note]").count()) === 1);
  await page.locator("[data-testid=bulk-note]").fill("Manca la visura");
  await chooseStatus(page, "Approvata");
  check("3 cambiando stato il campo sparisce", (await page.locator("[data-testid=bulk-note]").count()) === 0);
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  check("3 'Approvata': la chiamata non porta il testo dimenticato", log.control.length === 1 && log.control[0].status === "approvata" && !("note" in log.control[0]), JSON.stringify(log.control));
  await ctx.close();
}

// 4) partial outcome: what could not pass is explained, with the practice number
{
  const reply = (body) => ({
    ok: true, status: body.status, requested: 2, changed: 1, unchanged: 0, blocked: 1, failed: 0,
    results: [
      { practiceId: ids[0], practiceNumber: "VIES-2026-0001-AAAA1111", outcome: "changed", to: "in_valutazione" },
      { practiceId: ids[2], practiceNumber: "VIES-2026-0003-AAAA1111", outcome: "blocked", message: "La pratica è già emessa" },
    ],
  });
  const { ctx, page } = await open({ controlReply: reply });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0001-AAAA1111");
  await pick(page, "VIES-2026-0003-AAAA1111");
  await chooseStatus(page, "In Attesa");
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  const body = await text(page);
  check("4 esito parziale: titolo e conteggi", /Aggiornamento parziale/.test(body) && /1 aggiornate, 1 non modificate/.test(body), body.slice(0, 400));
  check("4 la pratica bloccata è nominata con il motivo", /VIES-2026-0003-AAAA1111: La pratica è già emessa/.test(body), body.slice(0, 600));
  await page.screenshot({ path: SHOTS + "bulk-status-partial.png" });
  await ctx.close();
}

// 5) nothing could pass: said as an error, and a server refusal is shown
{
  const reply = (body) => ({
    ok: true, status: body.status, requested: 1, changed: 0, unchanged: 0, blocked: 1, failed: 0,
    results: [{ practiceId: ids[2], practiceNumber: "VIES-2026-0003-AAAA1111", outcome: "blocked", message: "La pratica è già emessa" }],
  });
  const { ctx, page } = await open({ controlReply: reply });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0003-AAAA1111");
  await chooseStatus(page, "Approvata");
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  check("5 nessuna pratica modificata: avviso con il motivo", /Nessuna pratica modificata/.test(await text(page)) && /già emessa/.test(await text(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open({ controlReply: () => ({ __status: 409, ok: false, error: "Solo gli amministratori possono gestire il flusso delle pratiche", code: "forbidden" }) });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await pick(page, "VIES-2026-0001-AAAA1111");
  await chooseStatus(page, "In Attesa");
  await page.getByRole("button", { name: "Cambia stato selezionate" }).click();
  await page.waitForTimeout(600);
  check("5 rifiuto del server: errore mostrato, selezione conservata", /Aggiornamento massivo non riuscito/.test(await text(page)) && /1 pratiche selezionate/.test(await text(page)), (await text(page)).slice(0, 400));
  await ctx.close();
}

// 6) other languages
for (const [language, reasonLabel] of [["en", /Reason \(required/], ["zh", /原因（必填/]]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  await page.getByRole("checkbox").nth(1).click();
  await page.getByRole("combobox").filter({ hasText: /./ }).last().click();
  const options = await page.getByRole("option").allInnerTexts();
  const rejected = options.find((label) => (language === "en" ? /Reject/i : /拒/).test(label));
  await page.getByRole("option", { name: rejected }).click();
  const placeholder = await page.locator("[data-testid=bulk-note]").getAttribute("placeholder");
  check(`6 ${language}: il campo del motivo è tradotto`, reasonLabel.test(placeholder ?? ""), String(placeholder));
  check(`6 ${language}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
