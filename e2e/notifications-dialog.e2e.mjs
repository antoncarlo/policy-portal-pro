import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000002";
const COLL = "00000000-0000-4000-8000-000000000003";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const USERS = [
  { id: UID, full_name: "Mario Admin", email: "t@example.com", phone: "1", avatar_url: null, role: "admin", agent_name: null, practice_count: 0 },
  { id: AGENT, full_name: "Anna Agente", email: "anna@agent.test", phone: "2", avatar_url: null, role: "agente", agent_name: null, practice_count: 3, default_commission_percentage: 16 },
  { id: COLL, full_name: "Carlo Collaboratore", email: "carlo@coll.test", phone: "3", avatar_url: null, role: "collaboratore", agent_name: "Anna Agente", practice_count: 1, default_commission_percentage: 8 },
];
// What the database holds for notification settings, by user.
const SETTINGS = { [COLL]: { notification_emails: ["carlo.lavoro@coll.test"], status_change: true, new_practice: false, documents: true, notes: true } };

const browser = await chromium.launch();
async function open({ language = "it", settingsFail = false, testResult = { success: true, sent: true, to: ["carlo.lavoro@coll.test"] } } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { upserts: [], api: [], settingsReads: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/get_all_users_with_details")) return json(USERS);
    if (p.includes("/rpc/has_role")) return json(true);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Mario Admin", language }]);
    if (table === "user_notification_settings") {
      if (method === "POST") {
        log.upserts.push({ body: JSON.parse(req.postData() || "{}"), prefer: req.headers()["prefer"] || "", query: url.search });
        return settingsFail ? json({ message: "new row violates row-level security policy" }, 403) : route.fulfill({ status: 201, headers: hdr, contentType: "application/json", body: "" });
      }
      const wanted = url.searchParams.get("user_id")?.replace("eq.", "");
      log.settingsReads.push(wanted);
      return reply(SETTINGS[wanted] ? [SETTINGS[wanted]] : []);
    }
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const req = route.request(); const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.api.push({ path: new URL(req.url()).pathname, body });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body.action === "send_test_notification" ? testResult : {}) });
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const openDialogFor = async (page, name) => {
  const row = page.locator("tr", { hasText: name });
  await row.locator("button").last().click();
  await page.getByRole("menuitem", { name: /Notifiche email|Email notifications|邮件通知/ }).click();
  await page.waitForSelector("[data-testid=notifications-dialog]");
  await page.waitForTimeout(500);
};

// 1) the dialog for a user with saved settings
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  const menuRow = page.locator("tr", { hasText: "carlo@coll.test" });
  await menuRow.locator("button").last().click();
  const items = (await page.getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
  check("1 il menu dell'utente ha 'Notifiche email'", items.includes("Notifiche email"), JSON.stringify(items));
  await page.getByRole("menuitem", { name: "Notifiche email" }).click();
  await page.waitForSelector("[data-testid=notifications-dialog]");
  await page.waitForTimeout(500);
  const dialog = page.locator("[data-testid=notifications-dialog]");
  const body = await dialog.innerText();
  check("1 titolo e nome dell'utente", /Notifiche email/.test(body) && /Carlo Collaboratore/.test(body));
  check("1 la scelta salvata e' letta dal database", log.settingsReads.includes(COLL));
  const inputs = await dialog.locator("[data-testid=notification-email]").evaluateAll((els) => els.map((e) => e.value));
  check("1 l'indirizzo salvato e' mostrato", JSON.stringify(inputs) === JSON.stringify(["carlo.lavoro@coll.test"]), JSON.stringify(inputs));
  check("1 nota: senza indirizzi vale l'email di accesso", /email di accesso \(carlo@coll\.test\)/.test(body), body.slice(0, 400));
  const switches = await dialog.locator("[role=switch]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-checked")));
  check("1 interruttori: stato e documenti attivi, nuove pratiche spento, note attive", JSON.stringify(switches) === JSON.stringify(["true", "false", "true", "true"]), JSON.stringify(switches));
  await page.screenshot({ path: SHOTS + "notify-dialog.png" });

  // add up to three addresses
  await dialog.locator("[data-testid=notification-add]").click();
  await dialog.locator("[data-testid=notification-add]").click();
  check("1 al terzo indirizzo il pulsante 'Aggiungi' sparisce", (await dialog.locator("[data-testid=notification-add]").count()) === 0 && (await dialog.locator("[data-testid=notification-email]").count()) === 3);
  const fields = dialog.locator("[data-testid=notification-email]");
  await fields.nth(1).fill("segreteria@coll.test");
  await fields.nth(2).fill("Carlo.Lavoro@coll.test"); // same as the first, other case
  await dialog.locator("[role=switch]").nth(1).click(); // new practice on
  await dialog.locator("[role=switch]").nth(3).click(); // notes off
  await dialog.locator("[data-testid=notification-save]").click();
  await page.waitForTimeout(700);
  const saved = log.upserts.at(-1);
  check("1 salvataggio: una sola scrittura con la scelta dell'utente", log.upserts.length === 1 && saved?.body.user_id === COLL, JSON.stringify(log.upserts));
  check("1 gli indirizzi sono puliti (minuscolo, senza doppioni)", JSON.stringify(saved?.body.notification_emails) === JSON.stringify(["carlo.lavoro@coll.test", "segreteria@coll.test"]), JSON.stringify(saved?.body));
  check("1 gli eventi scelti sono salvati", saved?.body.status_change === true && saved?.body.new_practice === true && saved?.body.documents === true && saved?.body.notes === false, JSON.stringify(saved?.body));
  check("1 scrittura per utente (upsert su user_id) con l'amministratore come autore", /on_conflict=user_id/.test(saved?.query) && saved?.body.updated_by === UID, JSON.stringify(saved));
  check("1 conferma all'amministratore", /Notifiche salvate/.test(await text(page)));

  // test email asks the server
  await dialog.locator("[data-testid=notification-test]").click();
  await page.waitForTimeout(600);
  const call = log.api.find((c) => c.body.action === "send_test_notification");
  check("1 'Invia email di prova' chiede al server per quell'utente", call?.body.userId === COLL && call.path === "/api/portal-actions", JSON.stringify(log.api));
  check("1 esito della prova mostrato", /Email di prova inviata a carlo\.lavoro@coll\.test/.test(await text(page)));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) no row yet: defaults; validation; test needs saved changes; failure of save
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openDialogFor(page, "anna@agent.test");
  const dialog = page.locator("[data-testid=notifications-dialog]");
  const switches = await dialog.locator("[role=switch]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-checked")));
  check("2 senza scelte salvate: tutto attivo e nessun indirizzo", JSON.stringify(switches) === JSON.stringify(["true", "true", "true", "true"]) && (await dialog.locator("[data-testid=notification-email]").count()) === 0, JSON.stringify(switches));
  await dialog.locator("[data-testid=notification-add]").click();
  await dialog.locator("[data-testid=notification-email]").first().fill("non-un-indirizzo");
  await dialog.locator("[data-testid=notification-save]").click();
  await page.waitForTimeout(500);
  check("2 indirizzo non valido: avviso e nulla salvato", /Indirizzo non valido/.test(await text(page)) && log.upserts.length === 0);
  await dialog.locator("[data-testid=notification-test]").click();
  await page.waitForTimeout(400);
  check("2 prova con modifiche non salvate: chiede di salvare, non invia", /Salva prima le modifiche/.test(await text(page)) && !log.api.some((c) => c.body.action === "send_test_notification"));
  await dialog.locator("[data-testid=notification-email]").first().fill("anna.mobile@agent.test");
  await dialog.locator("[data-testid=notification-save]").click();
  await page.waitForTimeout(600);
  check("2 indirizzo valido: salvato", log.upserts.at(-1)?.body.notification_emails?.[0] === "anna.mobile@agent.test" && log.upserts.at(-1)?.body.user_id === AGENT);
  // an empty line is dropped
  await dialog.locator("[data-testid=notification-add]").click();
  await dialog.locator("[data-testid=notification-save]").click();
  await page.waitForTimeout(500);
  check("2 riga vuota scartata", JSON.stringify(log.upserts.at(-1)?.body.notification_emails) === JSON.stringify(["anna.mobile@agent.test"]), JSON.stringify(log.upserts.at(-1)));
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) save refused by the database, test not sent
{
  const { ctx, page, pageErrors } = await open({ settingsFail: true, testResult: { success: true, sent: false, reason: "Nessun servizio email configurato" } });
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openDialogFor(page, "carlo@coll.test");
  const dialog = page.locator("[data-testid=notifications-dialog]");
  await dialog.locator("[role=switch]").first().click();
  await dialog.locator("[data-testid=notification-save]").click();
  await page.waitForTimeout(600);
  check("3 salvataggio rifiutato: errore mostrato, il dialogo resta aperto", /Errore/.test(await text(page)) && (await dialog.count()) === 1);
  check("3 la prova non inviata mostra il motivo", await (async () => {
    // reopen cleanly: no unsaved changes after cancel
    await page.getByRole("button", { name: "Annulla" }).click();
    await page.waitForTimeout(300);
    await openDialogFor(page, "carlo@coll.test");
    await page.locator("[data-testid=notification-test]").click();
    await page.waitForTimeout(600);
    const body = await text(page);
    return /Email di prova non inviata/.test(body) && /Nessun servizio email configurato/.test(body);
  })());
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) other languages
for (const [language, titleRe, saveRe] of [["en", /Email notifications/, /Save/], ["zh", /邮件通知/, /保存/]]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openDialogFor(page, "carlo@coll.test");
  const body = await page.locator("[data-testid=notifications-dialog]").innerText();
  check(`4 ${language}: il dialogo e' tradotto`, titleRe.test(body) && saveRe.test(body) && !/Notifiche email|Salva/.test(body), body.slice(0, 300));
  check(`4 ${language}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
