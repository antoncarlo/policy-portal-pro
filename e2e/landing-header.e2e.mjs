// Between the public site and the reserved area: the home page is public for everyone, «Area riservata» leads to the
// sign-in page (or straight into the portal for who is already signed in), and from inside the portal nothing sends
// a signed-in user back to the public home page by mistake.
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
async function open({ signedIn }) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 900 } });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, headers: hdr });
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(true);
    return json([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  // The session is put in the browser once: after a sign-out it must not come back at the next page.
  await ctx.addInitScript(({ key, value, signedIn: on }) => {
    try {
      localStorage.setItem("portal-language", "it");
      if (on && !localStorage.getItem("e2e-seeded")) {
        localStorage.setItem(key, value);
        localStorage.setItem("e2e-seeded", "1");
      }
    } catch { /* storage unavailable */ }
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), signedIn });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, pageErrors };
}

// 1) signed out: the public home page, and «Area riservata» opens the sign-in page
{
  const { ctx, page, pageErrors } = await open({ signedIn: false });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const portalLinks = await page.locator('header a[href="/auth"]').count();
  check("senza accesso: la radice del sito è la homepage pubblica, con un solo collegamento all'area riservata nella barra", (await page.locator("h1").innerText()).includes("Fideiussione VIES") && portalLinks === 1, String(portalLinks));
  check("senza accesso: la homepage non carica il portale (nessun punto di montaggio dell'applicazione)", (await page.locator("#root").count()) === 0);
  await page.locator('[data-testid="site-portal-link"]').click();
  await page.waitForURL(/\/auth$/);
  await page.waitForSelector("input[name=signin-email]", { timeout: 15000 });
  check("senza accesso: «Area riservata» apre la pagina di accesso", (await page.locator("input[name=signin-password]").isVisible()));
  check("senza accesso: nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) signed in: the home page stays public, «Area riservata» goes straight into the portal
{
  const { ctx, page, pageErrors } = await open({ signedIn: true });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("con accesso: la homepage resta quella pubblica", (await page.locator('[data-testid="site-hero"]').count()) === 1 && new URL(page.url()).pathname === "/");
  await page.locator('[data-testid="site-portal-link"]').click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
  check("con accesso: «Area riservata» porta direttamente alla dashboard", /\/dashboard$/.test(page.url()), page.url());

  // inside the portal the logo stays in the portal
  await page.waitForSelector('a[href="/dashboard"] img[alt="Tecno Advance MGA"]', { timeout: 15000 });
  const logoToHome = await page.locator('a[href="/"] img').count();
  check("nel portale: il logo porta alla dashboard, non alla homepage pubblica", logoToHome === 0, String(logoToHome));
  await page.screenshot({ path: SHOTS + "landing-header.png" });

  // signing out from the sessions settings ends on the sign-in page
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.locator('[role="tab"][title="Sessioni"]').click();
  await page.locator('[role="tabpanel"] button', { hasText: /^Esci$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/settings"), { timeout: 15000 });
  // The sign-out both updates the portal and reloads the page: wait for the page that remains.
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  check("nel portale: uscire dalle sessioni porta alla pagina di accesso, non alla homepage pubblica", /\/auth$/.test(page.url()) && (await page.locator("input[name=signin-email]").count()) === 1, page.url());
  check("con accesso: nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
