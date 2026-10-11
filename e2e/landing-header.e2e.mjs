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
async function open({ signedIn, language = "it" }) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 900 } });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(true);
    return json([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value, lang, signedIn: on }) => {
    try {
      localStorage.setItem("portal-language", lang);
      if (on) localStorage.setItem(key, value);
    } catch { /* storage unavailable */ }
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language, signedIn });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, pageErrors };
}

// signed in: one button in the header for the portal (it was two, both going to the dashboard)
for (const [language, portalLabel, dashboardLabel] of [["it", /Vai al Portale/i, /^Dashboard$/], ["en", /Go to Portal/i, /^Dashboard$/], ["zh", /进入门户/, /^仪表板$|^控制台$|^概览$/]]) {
  const { ctx, page, pageErrors } = await open({ signedIn: true, language });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("header nav a");
  const links = await page.locator("header nav a").allInnerTexts();
  const toDashboard = await page.locator("header nav a[href='/dashboard']").count();
  check(`${language}: un solo collegamento al portale nell'intestazione`, toDashboard === 1, JSON.stringify(links));
  check(`${language}: il collegamento è «${portalLabel}»`, links.length === 1 && portalLabel.test(links[0]), JSON.stringify(links));
  check(`${language}: nessun pulsante «Dashboard» doppione`, !links.some((text) => dashboardLabel.test(text.trim())), JSON.stringify(links));
  if (language === "it") {
    const hero = await page.locator("section a[href='/upload'], section a[href='/dashboard']").allInnerTexts();
    check("it: i pulsanti centrali restano (carica pratica, vedi dashboard)", hero.length === 2, JSON.stringify(hero));
    await page.screenshot({ path: SHOTS + "landing-header.png" });
    await page.locator("header nav a[href='/dashboard']").click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    check("it: «Vai al Portale» porta alla dashboard", /\/dashboard/.test(page.url()), page.url());
  }
  check(`${language}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// signed out: the sign-in button only
{
  const { ctx, page } = await open({ signedIn: false });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("header nav button");
  const buttons = await page.locator("header nav button").allInnerTexts();
  check("senza accesso: nell'intestazione solo «Accedi»", (await page.locator("header nav a[href='/dashboard']").count()) === 0, JSON.stringify(buttons));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
