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

const browser = await chromium.launch();
/** `signIn`: what Supabase answers to a password sign-in. */
async function open({ signIn, language = "it" }) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1200, height: 900 } });
  const log = { reports: [], tokenCalls: 0 };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p.startsWith("/auth/v1/token")) {
      log.tokenCalls += 1;
      if (signIn === "ok") return json(session);
      if (signIn === "invalid") return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      return json({ code: 500, error_code: "unexpected_failure", msg: "Database error" }, 500);
    }
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(false);
    return json([]);
  });
  await ctx.route(`${BASE}/api/login-failure`, async (route) => {
    log.reports.push({ method: route.request().method(), raw: route.request().postData() ?? "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await ctx.route(`${BASE}/api/**`, (route) => (route.request().url().endsWith("/api/login-failure") ? route.fallback() : route.fulfill({ status: 200, contentType: "application/json", body: "{}" })));
  await ctx.addInitScript(({ lang }) => { try { localStorage.setItem("portal-language", lang); } catch { /* storage unavailable */ } }, { lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const waitReports = async (log, n) => { for (let i = 0; i < 30 && log.reports.length < n; i += 1) await new Promise((r) => setTimeout(r, 100)); };

// 1) the sign-in dialog of the landing page: a wrong password is reported, with the address only
{
  const { ctx, page, log, pageErrors } = await open({ signIn: "invalid" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("header nav button", { hasText: "Accedi" }).click();
  await page.locator("input[name=email]").fill("Anna.Rossi@Example.test");
  await page.locator("input[name=password]").fill("Segreta#12345");
  await page.locator("form button[type=submit]").click();
  await waitReports(log, 1);
  check("1 password sbagliata: una segnalazione al portale", log.reports.length === 1 && log.reports[0].method === "POST", JSON.stringify(log.reports));
  const sent = JSON.parse(log.reports[0]?.raw || "{}");
  check("1 la segnalazione contiene solo l'indirizzo", JSON.stringify(Object.keys(sent)) === JSON.stringify(["email"]) && sent.email === "Anna.Rossi@Example.test", log.reports[0]?.raw);
  check("1 la password non viaggia mai verso il portale", !log.reports.some((r) => r.raw.includes("Segreta")), log.reports[0]?.raw);
  check("1 l'utente vede il messaggio di sempre", /Email o password non corretti/.test(await text(page)), (await text(page)).slice(0, 300));
  await page.screenshot({ path: SHOTS + "login-failure.png" });
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) the sign-in page: same
{
  const { ctx, page, log } = await open({ signIn: "invalid" });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.locator("input[name=signin-email]").fill("marco@example.test");
  await page.locator("input[name=signin-password]").fill("Altra#98765");
  await page.locator("form button[type=submit]").first().click();
  await waitReports(log, 1);
  check("2 pagina di accesso: segnalazione con il solo indirizzo", log.reports.length === 1 && JSON.parse(log.reports[0].raw).email === "marco@example.test" && !log.reports[0].raw.includes("Altra"), JSON.stringify(log.reports));
  await ctx.close();
}

// 3) a sign-in that works, or a problem that is not the password, is not reported
{
  const { ctx, page, log } = await open({ signIn: "ok" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("header nav button", { hasText: "Accedi" }).click();
  await page.locator("input[name=email]").fill("anna@example.test");
  await page.locator("input[name=password]").fill("Corretta#12345");
  await page.locator("form button[type=submit]").click();
  await page.waitForTimeout(800);
  check("3 accesso riuscito: nessuna segnalazione", log.tokenCalls >= 1 && log.reports.length === 0, JSON.stringify(log.reports));
  await ctx.close();
}
{
  const { ctx, page, log } = await open({ signIn: "server-error" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("header nav button", { hasText: "Accedi" }).click();
  await page.locator("input[name=email]").fill("anna@example.test");
  await page.locator("input[name=password]").fill("Corretta#12345");
  await page.locator("form button[type=submit]").click();
  await page.waitForTimeout(1000);
  check("3 errore del servizio di accesso (non la password): nessuna segnalazione", log.tokenCalls >= 1 && log.reports.length === 0, JSON.stringify(log.reports));
  await ctx.close();
}

// 4) if the portal cannot take the report, the user notices nothing
{
  const { ctx, page, log } = await open({ signIn: "invalid" });
  await ctx.route(`${BASE}/api/login-failure`, (route) => route.abort("failed"));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("header nav button", { hasText: "Accedi" }).click();
  await page.locator("input[name=email]").fill("anna@example.test");
  await page.locator("input[name=password]").fill("Sbagliata#1");
  await page.locator("form button[type=submit]").click();
  await page.waitForTimeout(800);
  check("4 segnalazione non consegnata: l'utente vede solo il messaggio di sempre", /Email o password non corretti/.test(await text(page)) && log.reports.length === 0, (await text(page)).slice(0, 300));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
