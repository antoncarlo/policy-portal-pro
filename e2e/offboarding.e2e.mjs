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


const browser = await chromium.launch();
async function open({ deleteStatus = 200 } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { api: [] };
  const state = { [AGENT]: { practices: 3, clients: 2, collaborators: 1, batches: 1, apiKeys: 0 }, [COLL]: { practices: 0, clients: 0, collaborators: 0, batches: 0, apiKeys: 0 } };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/get_all_users_with_details")) return json(USERS);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Mario Admin", language: "it" }]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    log.api.push(body);
    const reply = (status, payload) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (body.action === "user_footprint") return reply(200, { success: true, footprint: state[body.userId] ?? state[COLL] });
    if (body.action === "reassign_user_data") {
      const moved = state[body.fromUserId].practices;
      state[body.fromUserId] = { practices: 0, clients: 0, collaborators: 0, batches: 0, apiKeys: 0 };
      return reply(200, { success: true, moved, clients: 2 });
    }
    if (body.action === "delete_user") return deleteStatus === 200 ? reply(200, { success: true }) : reply(409, { error: "L'utente ha ancora 3 pratiche", code: "user_has_data" });
    if (body.action === "disable_user") return reply(200, { success: true });
    return reply(200, {});
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: "it" });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const openFor = async (page, email) => {
  const row = page.locator("tr", { hasText: email });
  await row.locator("button").last().click();
  await page.getByRole("menuitem", { name: /Elimina/ }).click();
  await page.waitForSelector("[data-testid=offboard-dialog]");
  await page.waitForTimeout(500);
};

// 1) a user with data: hand everything over, then delete
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openFor(page, "anna@agent.test");
  const dialog = page.locator("[data-testid=offboard-dialog]");
  const owns = (await dialog.locator("[data-testid=offboard-owns]").innerText()).replace(/\s+/g, " ");
  check("1 mostra cosa possiede l'utente (3 pratiche, 2 clienti, 1 collaboratore, 1 lotto)", /3 pratiche/.test(owns) && /2 clienti/.test(owns) && /1 collaboratore/.test(owns) && /1 lotto VIES/.test(owns), owns);
  check("1 'Elimina definitivamente' è spento finché non si riassegna", await dialog.locator("[data-testid=offboard-delete]").isDisabled());
  check("1 'Riassegna tutto' è spento senza destinatario", await dialog.locator("[data-testid=offboard-reassign]").isDisabled());
  await dialog.locator("[data-testid=offboard-target]").click();
  const options = (await page.getByRole("option").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("1 con collaboratori da passare si offrono solo agenti e amministratori", options.length === 1 && /Mario Admin/.test(options[0]) && !options.some((o) => /Carlo/.test(o)) && !options.some((o) => /Anna/.test(o)), JSON.stringify(options));
  await page.getByRole("option").first().click();
  await dialog.locator("[data-testid=offboard-reassign]").click();
  await page.waitForTimeout(800);
  const call = log.api.find((c) => c.action === "reassign_user_data");
  check("1 la riassegnazione chiede al server da chi e a chi", call?.fromUserId === AGENT && call?.toUserId === UID, JSON.stringify(log.api));
  check("1 conferma con i numeri", /Riassegnate 3 pratiche e 2 clienti/.test(await text(page)));
  check("1 poi non possiede più nulla e si può eliminare", (await dialog.locator("[data-testid=offboard-nothing]").count()) === 1 && !(await dialog.locator("[data-testid=offboard-delete]").isDisabled()));
  await dialog.locator("[data-testid=offboard-delete]").click();
  await page.waitForTimeout(700);
  check("1 l'eliminazione parte e il dialogo si chiude", log.api.some((c) => c.action === "delete_user" && c.userId === AGENT) && (await page.locator("[data-testid=offboard-dialog]").count()) === 0);
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) nothing to hand over
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openFor(page, "carlo@coll.test");
  const dialog = page.locator("[data-testid=offboard-dialog]");
  check("2 senza pratiche: 'non possiede più nulla' e si può eliminare subito", (await dialog.locator("[data-testid=offboard-nothing]").count()) === 1 && !(await dialog.locator("[data-testid=offboard-delete]").isDisabled()));
  await dialog.locator("[data-testid=offboard-disable]").click();
  await page.waitForTimeout(600);
  check("2 'Disattiva invece di eliminare' disattiva e chiude", log.api.some((c) => c.action === "disable_user" && c.userId === COLL) && (await page.locator("[data-testid=offboard-dialog]").count()) === 0);
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) the server still refuses
{
  const { ctx, page, pageErrors } = await open({ deleteStatus: 409 });
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  await openFor(page, "carlo@coll.test");
  await page.locator("[data-testid=offboard-delete]").click();
  await page.waitForTimeout(600);
  check("3 se il server rifiuta, l'errore si vede e il dialogo resta aperto", /L'utente ha ancora 3 pratiche/.test(await text(page)) && (await page.locator("[data-testid=offboard-dialog]").count()) === 1);
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
