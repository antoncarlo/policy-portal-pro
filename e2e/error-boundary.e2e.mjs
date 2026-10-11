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
async function open({ language = "it" } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1200, height: 900 } });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    // the expiry list comes back with a broken row: drawing the page throws
    if (p.includes("/rpc/get_upcoming_expiries")) return json([null]);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  return { ctx, page, consoleErrors };
}

{
  const { ctx, page, consoleErrors } = await open();
  await page.goto(`${BASE}/expiry`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=error-boundary]", { timeout: 10000 });
  const text = (await page.getByTestId("error-boundary").innerText()).replace(/\s+/g, " ");
  check("1 errore di disegno: pagina di errore al posto dello schermo bianco", /Qualcosa è andato storto/.test(text) && /Riprova/.test(text) && /Torna alla dashboard/.test(text) && /Ricarica la pagina/.test(text), text);
  check("1 riferimento da citare", /Riferimento: [A-Z0-9]{4,6}/.test(text), text);
  check("1 dettaglio tecnico disponibile", /Dettaglio tecnico/.test(text));
  check("1 l'errore e' stato registrato in console", consoleErrors.some((line) => /\[react\]/.test(line)), consoleErrors.join(" | ").slice(0, 200));
  // changing page (client-side) clears the error screen
  await page.evaluate(() => { history.pushState({}, "", "/clients"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await page.waitForTimeout(800);
  check("1 cambiando pagina il portale riprova da solo", (await page.getByTestId("error-boundary").count()) === 0 && /Rubrica Clienti/.test(await page.locator("body").innerText()));
  await ctx.close();
}

for (const [language, re, label] of [["en", /Something went wrong/, "en"], ["zh", /出现了问题/, "zh"]]) {
  const { ctx, page } = await open({ language });
  await page.goto(`${BASE}/expiry`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=error-boundary]", { timeout: 10000 });
  check(`2 ${label}: pagina di errore tradotta`, re.test(await page.getByTestId("error-boundary").innerText()));
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} ok`);
process.exit(ok === results.length ? 0 : 1);
