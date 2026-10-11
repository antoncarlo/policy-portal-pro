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

const AUDIT = [
  { id: 5, at: "2026-10-11T12:00:00Z", actor_id: UID, actor_role: "admin", source: "app", table_name: "profiles", row_id: "c1000000-0000-4000-8000-000000000003", action: "user.delete", old_data: null, new_data: null, changed_keys: null, details: { full_name: "Carlo Collaboratore", email: "carlo@coll.test" }, ip: "203.0.113.9", user_agent: "UA" },
  { id: 4, at: "2026-10-11T11:00:00Z", actor_id: UID, actor_role: "admin", source: "db", table_name: "practices", row_id: "00000000-0000-4000-8000-000000000201", action: "update", old_data: { status: "in_attesa", client_phone: "111" }, new_data: { status: "approvata", client_phone: "222" }, changed_keys: ["client_phone", "status"], details: null, ip: "203.0.113.9", user_agent: "UA" },
  { id: 3, at: "2026-10-11T10:00:00Z", actor_id: null, actor_role: "system", source: "db", table_name: "api_keys", row_id: "k1", action: "insert", old_data: null, new_data: { name: "Broker Beta" }, changed_keys: null, details: null, ip: null, user_agent: null },
  { id: 2, at: "2026-10-11T09:00:00Z", actor_id: UID, actor_role: "admin", source: "app", table_name: "profiles", row_id: UID, action: "session.login", old_data: null, new_data: null, changed_keys: null, details: null, ip: "203.0.113.9", user_agent: "UA" },
];
const browser = await chromium.launch();
async function open({ language = "it" } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { audit: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") {
      const or = params.find(([k]) => k === "or")?.[1];
      if (or) return reply(/Mario/i.test(or) ? [{ id: UID }] : []);
      return reply([{ id: UID, email: "t@example.com", full_name: "Mario Admin", language }]);
    }
    if (table === "audit_log") {
      log.audit.push(url.search);
      let rows = AUDIT;
      for (const [k, v] of params) {
        if (k === "table_name" && v.startsWith("eq.")) rows = rows.filter((r) => r.table_name === v.slice(3));
        if (k === "action" && v.startsWith("eq.")) rows = rows.filter((r) => r.action === v.slice(3));
        if (k === "actor_id" && v.startsWith("in.(")) rows = rows.filter((r) => v.slice(4, -1).split(",").includes(r.actor_id));
      }
      return reply(rows);
    }
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const openLogs = async (page) => {
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /^Log$/ }).click();
  await page.waitForSelector("[data-testid=audit-log]");
  await page.waitForSelector("[data-testid=audit-line]");
};

{
  const { ctx, page, log, pageErrors } = await open();
  await openLogs(page);
  const rows = (await page.locator("[data-testid=audit-line]").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  check("1 il registro mostra le righe dalla più recente", rows.length === 4 && /Utente eliminato/.test(rows[0]) && /Accesso/.test(rows[3]), JSON.stringify(rows));
  check("1 chi, cosa e su che cosa (nome, email dell'utente eliminato)", /Mario Admin/.test(rows[0]) && /carlo@coll\.test/.test(rows[0]) && /Utenti/.test(rows[0]), rows[0]);
  check("1 le modifiche ai dati mostrano i campi cambiati", /client_phone, status/.test(rows[1]) && /Modifica/.test(rows[1]), rows[1]);
  check("1 un evento del sistema (nessun utente) e' indicato come Sistema", /Sistema/.test(rows[2]) && /Creazione/.test(rows[2]) && /Chiavi API/.test(rows[2]), rows[2]);
  check("1 l'indirizzo IP e' mostrato", /203\.0\.113\.9/.test(rows[0]));
  await page.locator("[data-testid=audit-detail]").nth(1).click();
  const dialog = page.locator("[data-testid=audit-dialog]");
  await dialog.waitFor();
  const detail = (await dialog.innerText()).replace(/\s+/g, " ");
  check("1 il dettaglio mostra prima e dopo di ogni campo cambiato", /status/.test(detail) && /in_attesa/.test(detail) && /approvata/.test(detail) && /111/.test(detail) && /222/.test(detail), detail);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.locator("#audit-table").selectOption("practices");
  await page.waitForTimeout(500);
  check("1 filtro per elemento: solo le pratiche", (await page.locator("[data-testid=audit-line]").count()) === 1);
  await page.locator("#audit-table").selectOption("all");
  await page.locator("#audit-action").selectOption("session.login");
  await page.waitForTimeout(500);
  check("1 filtro per azione: solo gli accessi", (await page.locator("[data-testid=audit-line]").count()) === 1);
  await page.locator("#audit-action").selectOption("all");
  await page.locator("#audit-user").fill("Mario");
  await page.waitForTimeout(700);
  check("1 filtro per utente (nome): solo le righe di quella persona", (await page.locator("[data-testid=audit-line]").count()) === 3);
  await page.locator("#audit-user").fill("Nessuno");
  await page.waitForTimeout(700);
  check("1 utente inesistente: nessuna riga", (await page.locator("[data-testid=audit-line]").count()) === 0 && /Nessuna riga nel registro/.test(await text(page)));
  check("1 il registro è solo in lettura (nessuna scrittura verso audit_log)", log.audit.every((q) => !/method=/.test(q)));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
for (const [language, tab, expected] of [["en", /^Logs$/, /User deleted/], ["zh", /^日志$/, /已删除用户/]]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: tab }).click();
  await page.waitForSelector("[data-testid=audit-line]");
  check(`2 ${language}: il registro è tradotto`, expected.test(await page.locator("[data-testid=audit-line]").first().innerText()));
  check(`2 ${language}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
