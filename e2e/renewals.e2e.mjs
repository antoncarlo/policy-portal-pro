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
const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };

const P1 = "10000000-0000-4000-8000-000000000001"; // da rinnovare
const P2 = "10000000-0000-4000-8000-000000000002"; // gia' rinnovata da C2
const P3 = "10000000-0000-4000-8000-000000000003"; // da rinnovare (dettaglio)
const C2 = "20000000-0000-4000-8000-000000000002";
const NEW = "30000000-0000-4000-8000-000000000001";
const mkPractice = (id, number, extra = {}) => ({
  id, practice_number: number, practice_type: "casa", status: "completata", client_name: "Rossi Srl", client_phone: "333", client_email: "rossi@x.it", policy_number: null,
  financial_status: null, payment_date: null, beneficiary: null, owner_tax_code: null, pet_microchip: null, policy_start_date: iso(-300), policy_end_date: iso(30),
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, notes: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", vies_batch_id: null, renewal_of: null, user_id: UID, client_id: null, api_key_id: null, ...extra,
});
const PRACTICES = {
  [P1]: mkPractice(P1, "PR-2026-0100", { policy_end_date: iso(10) }),
  [P2]: mkPractice(P2, "PR-2026-0101", { policy_end_date: iso(20) }),
  [P3]: mkPractice(P3, "PR-2026-0102", { policy_end_date: iso(30) }),
  [C2]: mkPractice(C2, "PR-2026-0200", { renewal_of: P2, status: "in_lavorazione", policy_end_date: iso(400), policy_start_date: iso(20) }),
  [NEW]: mkPractice(NEW, "PR-2026-0300", { renewal_of: P1, status: "in_lavorazione", policy_end_date: iso(375), policy_start_date: iso(10) }),
};
const EXPIRIES = [P1, P2].map((id) => ({
  practice_id: id, practice_number: PRACTICES[id].practice_number, practice_type: "casa", client_name: "Rossi Srl", client_email: "rossi@x.it", client_phone: "333",
  policy_end_date: PRACTICES[id].policy_end_date, days_until_expiry: id === P1 ? 10 : 20, notification_90_sent: true, notification_60_sent: true, notification_30_sent: false, notification_7_sent: false, user_id: UID, user_full_name: "Prova",
}));

const browser = await chromium.launch();
async function open({ language = "it", failRenew = null } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { api: [] };
  let created = false; // the renewal exists only after the call
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/get_upcoming_expiries")) return json(EXPIRIES);
    if (p.includes("/rpc/get_renewal_stats")) return json({ expired: 10, expired_renewed: 7, upcoming: 4, upcoming_renewed: 1 });
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "practices") {
      const renewalIn = params.find(([k, v]) => k === "renewal_of" && v.startsWith("in.("));
      if (renewalIn) {
        const ids = renewalIn[1].slice(4, -1).split(",");
        return reply(Object.values(PRACTICES).filter((row) => row.renewal_of && ids.includes(row.renewal_of) && (row.id !== NEW || created)).map((row) => ({ id: row.id, practice_number: row.practice_number, renewal_of: row.renewal_of })));
      }
      const idIn = params.find(([k, v]) => k === "id" && v.startsWith("in.("));
      if (idIn) return reply(idIn[1].slice(4, -1).split(",").map((id) => PRACTICES[id]).filter(Boolean).map((row) => ({ id: row.id, policy_start_date: row.policy_start_date })));
      const idEq = params.find(([k, v]) => k === "id" && v.startsWith("eq."));
      if (idEq) return reply(PRACTICES[idEq[1].slice(3)] ? [PRACTICES[idEq[1].slice(3)]] : []);
      return reply([]);
    }
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const req = route.request(); const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.api.push({ path: new URL(req.url()).pathname, body });
    if (body.action === "renew_practice") {
      if (failRenew) return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: failRenew, code: "already_renewed" }) });
      created = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, practiceId: NEW, practiceNumber: "PR-2026-0300", renewalOf: body.practiceId }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}
const card = (page, number) => page.locator("div.cursor-pointer", { hasText: number }).first();

// 1) scadenzario
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/expiry`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renewal-rate]", { timeout: 10000 });
  const rate = (await page.getByTestId("renewal-rate").innerText()).replace(/\s+/g, " ");
  check("1 tasso di rinnovo: 70% (7 su 10) e 25% (1 su 4)", /70%/.test(rate) && /7 rinnovate su 10/.test(rate) && /25%/.test(rate) && /1 rinnovate su 4/.test(rate), rate);
  check("1 pratica non rinnovata: pulsante Rinnova", (await card(page, "PR-2026-0100").getByTestId("renew-practice").count()) === 1);
  const renewed = card(page, "PR-2026-0101");
  check("1 pratica gia' rinnovata: collegamento al rinnovo, nessun pulsante", (await renewed.getByTestId("renew-practice").count()) === 0 && /Rinnovata: PR-2026-0200/.test(await renewed.getByTestId("renewed-link").innerText()));

  await card(page, "PR-2026-0100").getByTestId("renew-practice").click();
  const dialog = await page.getByRole("alertdialog").innerText();
  check("1 conferma: numero, inizio e fine del nuovo periodo", /PR-2026-0100/.test(dialog) && dialog.includes(iso(10).split("-").reverse().join("/")) && dialog.includes(iso(320).split("-").reverse().join("/")), dialog.replace(/\s+/g, " "));
  check("1 annullando non parte nessuna chiamata", (await (async () => { await page.getByRole("button", { name: "Annulla" }).click(); await page.waitForTimeout(300); return log.api.filter((c) => c.body.action === "renew_practice").length; })()) === 0);

  await card(page, "PR-2026-0100").getByTestId("renew-practice").click();
  await page.getByTestId("renew-confirm").click();
  await page.waitForURL(`${BASE}/practices/${NEW}`, { timeout: 8000 });
  const call = log.api.find((c) => c.body.action === "renew_practice");
  check("1 conferma: l'API riceve la pratica e si apre il rinnovo", !!call && call.body.practiceId === P1 && page.url().endsWith(`/practices/${NEW}`), JSON.stringify(call));
  await page.waitForSelector("[data-testid=renewal-links]", { timeout: 8000 });
  check("1 il rinnovo mostra «Rinnovo di PR-2026-0100»", /Rinnovo di PR-2026-0100/.test(await page.getByTestId("renewal-of").innerText()));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) dettaglio pratica
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices/${P3}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renewal-links]", { timeout: 10000 });
  check("2 pratica in scadenza: pulsante Rinnova nel dettaglio", (await page.getByTestId("renew-practice").count()) === 1);
  await page.goto(`${BASE}/practices/${P2}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renewal-links]", { timeout: 10000 });
  check("2 pratica rinnovata: «Rinnovata con PR-2026-0200», nessun pulsante", /Rinnovata con PR-2026-0200/.test(await page.getByTestId("renewed-by").innerText()) && (await page.getByTestId("renew-practice").count()) === 0);
  await page.goto(`${BASE}/practices/${C2}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renewal-links]", { timeout: 10000 });
  check("2 il rinnovo rimanda alla pratica d'origine", /Rinnovo di PR-2026-0101/.test(await page.getByTestId("renewal-of").innerText()));
  check("2 una pratica con scadenza lontana non propone il rinnovo", (await page.getByTestId("renew-practice").count()) === 0);
  check("2 nessuna chiamata di rinnovo non richiesta", log.api.filter((c) => c.body.action === "renew_practice").length === 0);
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) errore del server mostrato
{
  const { ctx, page } = await open({ failRenew: "La pratica è già stata rinnovata (PR-2026-0400)" });
  await page.goto(`${BASE}/practices/${P3}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renew-practice]", { timeout: 10000 });
  await page.getByTestId("renew-practice").click();
  await page.getByTestId("renew-confirm").click();
  await page.waitForSelector("text=Rinnovo non riuscito", { timeout: 5000 });
  check("3 errore del server: messaggio mostrato, si resta sulla pratica", (await page.getByText("PR-2026-0400").count()) >= 1 && page.url().endsWith(`/practices/${P3}`));
  await ctx.close();
}

// 4) inglese e cinese
for (const [language, re, label] of [["en", /Renew/, "en"], ["zh", /续保/, "zh"]]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/expiry`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=renewal-rate]", { timeout: 10000 });
  const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(`4 ${label}: scadenzario tradotto`, re.test(body) && !/Rinnova|Tasso di rinnovo/.test(body), body.slice(0, 300));
  check(`4 ${label}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} ok`);
process.exit(ok === results.length ? 0 : 1);
