import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const mkJwt = (aal) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal, amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const mkUser = (verified, mustChange = false) => ({ id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: mustChange ? { must_change_password: true } : {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: verified ? [{ id: "f-1", factor_type: "totp", status: "verified", friendly_name: "Telefono" }] : [] });
const mkSession = (aal, verified, mustChange = false) => ({ access_token: mkJwt(aal), refresh_token: "r-" + aal, expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: mkUser(verified, mustChange) });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); };

const browser = await chromium.launch();

// scenario = { admin, hasFactor, goodCode }
async function open(scenario, seedAal) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1280, height: 900 } });
  const state = { level: seedAal || "aal1", calls: [], mustChange: !!scenario.mustChange, apiCalls: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = req.url(); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const verified = scenario.hasFactor || state.enrolled;
    if (url.includes("/auth/v1/token") && url.includes("grant_type=password")) { state.level = "aal1"; state.calls.push("login"); return json(mkSession("aal1", scenario.hasFactor, state.mustChange)); }
    if (url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token")) { state.calls.push("refresh"); return json(mkSession(state.level, verified, state.mustChange)); }
    if (url.includes("/auth/v1/verify") && method === "POST") { state.calls.push("verifyOtp"); if (scenario.badToken) return json({ code: 403, error_code: "otp_expired", msg: "Email link is invalid or has expired" }, 403); state.level = "aal1"; return json(mkSession("aal1", scenario.hasFactor, state.mustChange)); }
    if (url.match(/\/auth\/v1\/factors\/[^/]+\/challenge/)) { state.calls.push("challenge"); return json({ id: "ch-1", type: "totp", expires_at: 4102444800 }); }
    if (url.match(/\/auth\/v1\/factors\/[^/]+\/verify/)) {
      state.calls.push("verify");
      const body = JSON.parse(req.postData() || "{}");
      if (body.code !== (scenario.goodCode || "123456")) return json({ code: 400, error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" }, 400);
      state.level = "aal2"; state.enrolled = true;
      return json(mkSession("aal2", true, state.mustChange));
    }
    if (url.match(/\/auth\/v1\/factors$/) && method === "POST") { state.calls.push("enroll"); return json({ id: "f-new", type: "totp", friendly_name: "x", totp: { qr_code: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"29\" height=\"29\" viewBox=\"0 0 29 29\"><rect width=\"29\" height=\"29\" fill=\"#ffffff\"/><rect x=\"2\" y=\"2\" width=\"9\" height=\"9\" fill=\"#000000\"/></svg>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x" } }); }
    if (url.match(/\/auth\/v1\/factors\/[^/]+$/) && method === "DELETE") { state.calls.push("unenroll"); return json({ id: "f-new" }); }
    if (url.includes("/auth/v1/user")) return json(mkUser(verified, state.mustChange));
    if (url.includes("/auth/v1/logout")) return route.fulfill({ status: 204, headers: hdr });
    if (url.includes("/rpc/has_role")) { state.calls.push("has_role"); return json(!!scenario.admin); }
    if (url.includes("/rpc/")) return json([]);
    if (url.includes("/rest/v1/user_roles")) return json([{ user_id: UID, role: scenario.admin ? "admin" : "agente" }]);
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (url.includes("/rest/v1/profiles")) { const row = { id: UID, email: "t@example.com", full_name: "Prova", language: "it" }; return json(wantsObject ? row : [row]); }
    return wantsObject ? json({ code: "PGRST116", message: "no rows" }, 406) : json([]);
  });
  if (seedAal) {
    const session = mkSession(seedAal, scenario.hasFactor);
    await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  }
  // API del portale (il server statico di prova risponde 404): risposte simulate
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const body = req.postData() ? JSON.parse(req.postData()) : {};
    const reply = (status, payload) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (u.pathname === "/api/password-reset") { state.apiCalls.push({ path: "password-reset", body }); return reply(scenario.resetStatus || 200, scenario.resetStatus ? { error: "x" } : { ok: true }); }
    if (u.pathname === "/api/portal-actions") {
      state.apiCalls.push({ path: "portal-actions", body, auth: req.headers()["authorization"] });
      if (body.action === "set_password") {
        if (scenario.setPasswordError) return reply(400, { error: "La nuova password deve essere diversa da quella attuale", code: scenario.setPasswordError });
        state.mustChange = false; state.calls.push("set_password"); return reply(200, { success: true });
      }
      return reply(200, { success: true });
    }
    return reply(404, {});
  });
  const page = await ctx.newPage();
  const errors = [];
  if (process.env.DBG) { page.on("console", (m) => console.log("  console:", m.type(), m.text().slice(0, 160))); page.on("request", (r) => { if (r.url().includes("supabase.co")) console.log("  req:", r.method(), r.url().replace(SUPA, "").slice(0, 90)); }); }
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  return { ctx, page, state, errors };
}
async function login(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.fill("#signin-email", "t@example.com");
  await page.fill("#signin-password", "Password-di-prova-1!");
  await page.click("button[type=submit]");
  if (process.env.DBG) { await page.waitForTimeout(2500); console.log("  body after login:", (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300)); }
}
const typeCode = async (page, code) => { await page.locator("input[autocomplete=one-time-code], input[inputmode=numeric]").first().fill(code); };

// A) agente senza fattore: entra direttamente
{
  const { ctx, page, state, errors } = await open({ admin: false, hasFactor: false });
  await login(page);
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("A agente senza fattore -> /dashboard", /\/dashboard/.test(page.url()), page.url());
  check("A nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// B) admin senza fattore: nessun obbligo, entra direttamente
{
  const { ctx, page, state, errors } = await open({ admin: true, hasFactor: false });
  await login(page);
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("B admin senza fattore -> /dashboard (2FA non obbligatoria)", /\/dashboard/.test(page.url()) && !state.calls.includes("enroll"), page.url());
  check("B nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// B2) (vecchio test di configurazione obbligatoria, ora non piu' applicabile)
if (false) {
  const { ctx, page, state, errors } = await open({ admin: true, hasFactor: false });
  await page.waitForSelector("img[alt='QR code']", { timeout: 5000 }).catch(() => {});
  check("B QR e chiave manuale visibili", (await page.locator("img[alt='QR code']").count()) === 1 && (await page.getByText("JBSWY3DPEHPK3PXP").count()) === 1);
  if (process.env.DBG) console.log("  img.src:", (await page.locator("img[alt='QR code']").getAttribute("src")).slice(0, 220));
  check("B immagine QR decodificata", await page.locator("img[alt='QR code']").evaluate((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: SHOTS + "mfa-setup.png" });
  await typeCode(page, "000000");
  await page.waitForSelector("[role=alert]", { timeout: 5000 }).catch(() => {});
  check("B codice sbagliato -> errore", (await page.getByText("Codice non valido").count()) >= 1);
  await typeCode(page, "123456");
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("B codice giusto -> /dashboard", /\/dashboard/.test(page.url()), page.url());
  check("B chiamate: enroll, challenge, verify", ["enroll", "challenge", "verify"].every((c) => state.calls.includes(c)), state.calls.join(","));
  check("B nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// C) utente con fattore: codice al login
{
  const { ctx, page, state, errors } = await open({ admin: false, hasFactor: true });
  await login(page);
  await page.waitForSelector("text=Verifica in due passaggi", { timeout: 8000 }).catch(() => {});
  check("C utente con fattore -> schermata codice (resta su /auth)", /\/auth/.test(page.url()) && (await page.getByText("Inserisci il codice a 6 cifre").count()) >= 1, page.url());
  await page.screenshot({ path: SHOTS + "mfa-challenge.png" });
  await typeCode(page, "999999");
  await page.waitForSelector("[role=alert]", { timeout: 5000 }).catch(() => {});
  check("C codice sbagliato -> errore e resta su /auth", /\/auth/.test(page.url()) && (await page.getByText("Codice non valido").count()) >= 1);
  await typeCode(page, "123456");
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("C codice giusto -> /dashboard", /\/dashboard/.test(page.url()), page.url());
  check("C nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// D) pagina protetta aperta direttamente con sessione aal1
{
  const { ctx, page } = await open({ admin: true, hasFactor: false }, "aal1");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("D admin senza fattore apre /dashboard -> resta su /dashboard", /\/dashboard/.test(page.url()), page.url());
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, hasFactor: true }, "aal1");
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("D utente con fattore aal1 apre /practices -> /auth (codice)", /\/auth/.test(page.url()), page.url());
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: true, hasFactor: true }, "aal2");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  check("D admin aal2 apre /dashboard -> resta su /dashboard", /\/dashboard/.test(page.url()), page.url());
  await ctx.close();
}

// E) impostazioni: scheda verifica in due passaggi (tab Sicurezza)
{
  const { ctx, page, state, errors } = await open({ admin: false, hasFactor: false }, "aal1");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await page.waitForTimeout(1200);
  check("E agente: scheda 2FA nel tab Sicurezza (Non attiva)", (await page.getByText("Non attiva").count()) >= 1);
  await page.screenshot({ path: SHOTS + "mfa-settings.png", fullPage: true });
  await page.getByRole("button", { name: "Attiva", exact: true }).click();
  await page.getByRole("button", { name: "Inizia la configurazione" }).click().catch(() => {});
  await page.waitForSelector("img[alt='QR code']", { timeout: 5000 }).catch(() => {});
  check("E agente: Attiva -> QR code", (await page.locator("img[alt='QR code']").count()) === 1, state.calls.join(","));
  await typeCode(page, "123456");
  await page.waitForTimeout(1500);
  check("E agente: codice giusto -> stato Attiva", (await page.getByText("Attiva", { exact: true }).count()) >= 1 && (await page.locator("img[alt='QR code']").count()) === 0);
  await page.screenshot({ path: SHOTS + "mfa-settings-on.png", fullPage: true });
  check("E nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: true, hasFactor: true }, "aal2");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await page.waitForTimeout(1200);
  check("E admin: puo' disattivare la verifica (non obbligatoria)", (await page.getByRole("button", { name: "Disattiva" }).count()) >= 1 && (await page.getByText("obbligatoria").count()) === 0);
  await ctx.close();
}

// F) password dimenticata
{
  const { ctx, page, state, errors } = await open({ admin: false });
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Password dimenticata?" }).click();
  await page.waitForURL(/\/forgot-password/, { timeout: 5000 }).catch(() => {});
  check("F link 'Password dimenticata?' nella pagina di accesso", /\/forgot-password/.test(page.url()), page.url());
  await page.fill("#forgot-email", "mario@example.com");
  await page.getByRole("button", { name: "Invia il link" }).click();
  await page.waitForSelector("text=Controlla la tua email", { timeout: 5000 }).catch(() => {});
  check("F risposta: 'Controlla la tua email'", (await page.getByText("Controlla la tua email").count()) >= 1);
  check("F la richiesta contiene email e lingua", state.apiCalls[0]?.body?.email === "mario@example.com" && ["it", "en", "zh"].includes(state.apiCalls[0]?.body?.language), JSON.stringify(state.apiCalls[0]?.body));
  await page.screenshot({ path: SHOTS + "forgot-sent.png" });
  check("F nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, resetStatus: 429 });
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await page.fill("#forgot-email", "mario@example.com");
  await page.getByRole("button", { name: "Invia il link" }).click();
  await page.waitForSelector("[role=alert]", { timeout: 5000 }).catch(() => {});
  check("F troppe richieste (429) -> messaggio", (await page.getByText("Troppe richieste").count()) >= 1);
  await ctx.close();
}

// G) pagina del link: benvenuto / reimposta
{
  const { ctx, page, state, errors } = await open({ admin: false, hasFactor: false });
  await page.goto(`${BASE}/reset-password?token_hash=HASH1&type=recovery&kind=welcome`, { waitUntil: "networkidle" });
  check("G benvenuto: titolo e nessuna verifica prima dell'invio", (await page.getByText("Benvenuto nel portale").count()) >= 1 && !state.calls.includes("verifyOtp"));
  await page.screenshot({ path: SHOTS + "reset-welcome.png" });
  await page.fill("#new-password", "corta");
  await page.fill("#confirm-password", "corta");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForSelector("[role=alert]", { timeout: 3000 }).catch(() => {});
  check("G password debole -> errore, link NON consumato", (await page.getByText("almeno 6 caratteri").count()) >= 1 && !state.calls.includes("verifyOtp"));
  await page.fill("#new-password", "NuovaPasswordSicura42");
  await page.fill("#confirm-password", "Diversa123456789");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForTimeout(500);
  check("G conferma diversa -> errore, link NON consumato", (await page.getByText("non coincidono").count() + await page.getByText("corrispondono").count()) >= 1 && !state.calls.includes("verifyOtp"), "");
  await page.fill("#confirm-password", "NuovaPasswordSicura42");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  const order = state.calls.filter((c) => ["verifyOtp", "set_password", "login"].includes(c)).join(">");
  check("G password valida -> verifica link, imposta password, rientro con la nuova password, /dashboard", /\/dashboard/.test(page.url()) && order === "verifyOtp>set_password>login", `${page.url()} ${order}`);
  const sp = state.apiCalls.find((c) => c.body?.action === "set_password");
  check("G set_password con token di sessione e password", !!sp?.auth?.startsWith("Bearer ") && sp.body.password === "NuovaPasswordSicura42");
  check("G nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, badToken: true });
  await page.goto(`${BASE}/reset-password?token_hash=SCADUTO&type=recovery`, { waitUntil: "networkidle" });
  await page.fill("#new-password", "NuovaPasswordSicura42");
  await page.fill("#confirm-password", "NuovaPasswordSicura42");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForSelector("text=Link non valido o scaduto", { timeout: 5000 }).catch(() => {});
  check("G link scaduto -> 'Link non valido o scaduto' + richiedi nuovo", (await page.getByText("Link non valido o scaduto").count()) >= 1 && (await page.getByRole("link", { name: "Richiedi un nuovo link" }).count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false });
  await page.goto(`${BASE}/reset-password`, { waitUntil: "networkidle" });
  check("G senza token -> 'Link non valido o scaduto'", (await page.getByText("Link non valido o scaduto").count()) >= 1);
  await ctx.close();
}
{
  const { ctx, page, state } = await open({ admin: false, hasFactor: true });
  await page.goto(`${BASE}/reset-password?token_hash=HASH2&type=recovery`, { waitUntil: "networkidle" });
  await page.fill("#new-password", "NuovaPasswordSicura42");
  await page.fill("#confirm-password", "NuovaPasswordSicura42");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForSelector("text=Inserisci il codice a 6 cifre", { timeout: 5000 }).catch(() => {});
  check("G utente con 2FA: dopo il link chiede il codice dell'app prima di salvare", (await page.getByText("Inserisci il codice a 6 cifre").count()) >= 1 && !state.calls.includes("set_password"));
  await typeCode(page, "123456");
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("G codice giusto -> password salvata e /dashboard", /\/dashboard/.test(page.url()) && state.calls.includes("set_password"), page.url() + " " + state.calls.join(","));
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, setPasswordError: "same_password" });
  await page.goto(`${BASE}/reset-password?token_hash=HASH3&type=recovery`, { waitUntil: "networkidle" });
  await page.fill("#new-password", "NuovaPasswordSicura42");
  await page.fill("#confirm-password", "NuovaPasswordSicura42");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForSelector("[role=alert]", { timeout: 5000 }).catch(() => {});
  check("G server: password uguale all'attuale -> messaggio dedicato e resta sulla pagina", (await page.getByText("deve essere diversa da quella attuale").count()) >= 1 && /reset-password/.test(page.url()));
  await ctx.close();
}

// H) primo accesso con password provvisoria
{
  const { ctx, page, state, errors } = await open({ admin: false, hasFactor: false, mustChange: true });
  await login(page);
  await page.waitForURL(/\/change-password/, { timeout: 8000 }).catch(() => {});
  check("H utente con password provvisoria -> /change-password", /\/change-password/.test(page.url()), page.url());
  await page.screenshot({ path: SHOTS + "change-password.png" });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/change-password/, { timeout: 5000 }).catch(() => {});
  check("H non si puo' saltare: /dashboard riporta a /change-password", /\/change-password/.test(page.url()), page.url());
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/change-password/, { timeout: 5000 }).catch(() => {});
  check("H neppure /practices", /\/change-password/.test(page.url()), page.url());
  await page.fill("#new-password", "debole");
  await page.fill("#confirm-password", "debole");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForTimeout(400);
  check("H password debole -> rifiutata, nessuna chiamata al server", !state.calls.includes("set_password") && (await page.getByText("almeno una lettera maiuscola").count()) >= 1);
  await page.fill("#new-password", "NuovaPasswordSicura42");
  await page.fill("#confirm-password", "NuovaPasswordSicura42");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
  check("H password valida -> /dashboard", /\/dashboard/.test(page.url()) && state.calls.includes("set_password") && state.calls.filter((c) => c === "login").length >= 2, page.url());
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check("H dopo il cambio le pagine si aprono", /\/practices/.test(page.url()), page.url());
  check("H nessun errore JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, hasFactor: true, mustChange: true });
  await login(page);
  await page.waitForSelector("text=Inserisci il codice a 6 cifre", { timeout: 8000 }).catch(() => {});
  await typeCode(page, "123456");
  await page.waitForURL(/\/change-password/, { timeout: 8000 }).catch(() => {});
  check("H con 2FA attiva: prima il codice, poi il cambio password", /\/change-password/.test(page.url()), page.url());
  await ctx.close();
}
{
  const { ctx, page } = await open({ admin: false, hasFactor: false, mustChange: true, setPasswordError: "same_password" });
  await login(page);
  await page.waitForURL(/\/change-password/, { timeout: 8000 }).catch(() => {});
  await page.fill("#new-password", "TempPass123456");
  await page.fill("#confirm-password", "TempPass123456");
  await page.getByRole("button", { name: "Salva la password" }).click();
  await page.waitForSelector("[role=alert]", { timeout: 5000 }).catch(() => {});
  check("H stessa password della provvisoria -> messaggio e resta su /change-password", (await page.getByText("deve essere diversa da quella attuale").count()) >= 1 && /change-password/.test(page.url()));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} controlli superati`);
process.exit(failed.length ? 1 : 0);
