// Scadenzario: le polizze VIES (36 mesi) compaiono nel calendario al mese della scadenza, nel giorno giusto anche
// di notte in Italia, e il menu avvisa quando una polizza scade entro 30 giorni.
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

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const row = (id, number, type, client, offset) => ({ practice_id: id, practice_number: number, practice_type: type, client_name: client, client_email: "a@b.c", client_phone: "1", policy_end_date: day(offset), days_until_expiry: offset, notification_90_sent: false, notification_60_sent: false, notification_30_sent: false, notification_7_sent: false, user_id: UID, user_full_name: "Prova" });
const ALL = [
  row("00000000-0000-4000-8000-000000000501", "PR-2026-0501", "casa", "Cliente Casa Uno", 12),
  row("00000000-0000-4000-8000-000000000502", "PR-2026-0502", "pet", "Cliente Pet Due", 25),
  row("00000000-0000-4000-8000-000000000503", "PR-2026-0503", "casa", "Cliente Casa Tre", 70),
  row("00000000-0000-4000-8000-000000000504", "VIES-2026-0001-AAAA1111", "vies", "Azienda VIES Srl", 1050),
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "it-IT", timezoneId: "Europe/Rome", viewport: { width: 1360, height: 1000 } });
const rpcs = [];
const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
await ctx.route(`${SUPA}/**`, async (route) => {
  const req = route.request(); const url = new URL(req.url()); const method = req.method();
  const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
  const p = url.pathname;
  if (p.startsWith("/auth/v1/token")) return json(session);
  if (p.startsWith("/auth/v1/user")) return json(user);
  if (p.includes("/rpc/get_upcoming_expiries")) {
    const body = JSON.parse(req.postData() || "{}");
    rpcs.push(body);
    let rows = ALL.filter((r) => r.days_until_expiry <= body.p_days_ahead);
    if (body.p_practice_type) rows = rows.filter((r) => r.practice_type === body.p_practice_type);
    return json(rows);
  }
  if (p.includes("/rpc/has_role")) return json(false);
  if (p.includes("/rpc/")) return json([]);
  if (!p.startsWith("/rest/v1/")) return json({});
  const table = p.replace("/rest/v1/", "");
  const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
  const reply = (rows) => {
    const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {};
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
    if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
    return json(rows, 200, countHeader);
  };
  if (table === "user_roles") return reply([{ user_id: UID, role: "collaboratore" }]);
  if (table === "user_product_permissions") return reply([{ practice_type: "vies" }, { practice_type: "casa" }]);
  if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
  return reply([]);
});
await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=nav-expiry-alert]", { timeout: 10000 });
check("1 menu Scadenzario: avviso con 2 polizze in scadenza entro 30 giorni", (await page.getByTestId("nav-expiry-alert").innerText()).trim() === "2", await page.getByTestId("nav-expiry-alert").innerText());
check("1 l'avviso interroga le scadenze a 30 giorni", rpcs.some((r) => r.p_days_ahead === 30));

await page.goto(`${BASE}/expiry`, { waitUntil: "networkidle" });
await page.getByRole("tab", { name: /Calendario/i }).click();
await page.waitForSelector("h2.text-lg", { timeout: 8000 });
check("2 il calendario carica anche le scadenze a 3 anni (finestra di 5 anni)", rpcs.some((r) => r.p_days_ahead >= 1100), JSON.stringify(rpcs.map((r) => r.p_days_ahead)));

const target = new Date(); target.setDate(target.getDate() + 1050);
const months = (target.getFullYear() - new Date().getFullYear()) * 12 + target.getMonth() - new Date().getMonth();
for (let i = 0; i < months; i += 1) await page.locator("button:has(svg.lucide-chevron-right)").first().click();
await page.waitForTimeout(400);
const heading = (await page.locator("h2.text-lg").innerText()).replace(/\s+/g, " ").toLowerCase();
check("2 al mese della scadenza compare la polizza VIES", (await page.getByText("Azienda VIES Srl").count()) === 1, heading);
const cell = page.locator("div.h-24", { hasText: "Azienda VIES Srl" }).first();
const dayNumber = (await cell.locator("span.font-semibold").first().innerText()).trim();
check("2 nel giorno giusto (non il giorno prima, anche con il fuso orario italiano)", Number(dayNumber) === target.getDate(), `${dayNumber} vs ${target.getDate()}`);

const trigger = page.locator("button[role=combobox]").first();
await trigger.click();
check("3 il filtro per tipologia ha VIES", (await page.getByRole("option", { name: "VIES" }).count()) === 1);
await page.getByRole("option", { name: "VIES" }).click();
await page.waitForTimeout(500);
check("3 filtrando per VIES la richiesta porta il tipo", rpcs.some((r) => r.p_practice_type === "vies"));
check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
