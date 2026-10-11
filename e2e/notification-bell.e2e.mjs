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

const P1 = "10000000-0000-4000-8000-000000000001";
const P2 = "10000000-0000-4000-8000-000000000002";
const P3 = "10000000-0000-4000-8000-000000000003";
const fresh = () => [
  { id: "n1", practice_id: P1, type: "status_change", title: "Cambio Stato Pratica", message: "Lo stato della pratica PR-2026-0001 è stato cambiato da In Lavorazione a Approvata", read: false, created_at: "2026-10-11T10:00:00Z", practices: { practice_number: "PR-2026-0001" } },
  { id: "n2", practice_id: P2, type: "document_added", title: "Nuovo Documento Caricato", message: "È stato caricato un nuovo documento per la pratica PR-2026-0002", read: false, created_at: "2026-10-11T09:00:00Z", practices: { practice_number: "PR-2026-0002" } },
  { id: "n3", practice_id: P3, type: "document_added", title: "Nuovo Documento Caricato", message: "È stato caricato un nuovo documento per la pratica PR-2026-0003", read: true, created_at: "2026-10-10T09:00:00Z", practices: { practice_number: "PR-2026-0003" } },
];

const browser = await chromium.launch();
async function open({ language = "it", failList = false } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { patches: [] };
  let rows = fresh();
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (list) => (wantsObject ? (list.length ? json(list[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(list));
    if (table === "notifications") {
      if (failList) return json({ message: "boom" }, 500);
      if (method === "PATCH") {
        const body = JSON.parse(req.postData() || "{}");
        log.patches.push({ query: url.search, body });
        const idEq = params.find(([k, v]) => k === "id" && v.startsWith("eq."));
        const unreadOnly = params.some(([k, v]) => k === "read" && v === "eq.false");
        rows = rows.map((row) => ((idEq && row.id === idEq[1].slice(3)) || (!idEq && unreadOnly && !row.read) ? { ...row, ...body } : row));
        return json([]);
      }
      if (method === "HEAD") {
        const unread = rows.filter((row) => !row.read).length;
        return route.fulfill({ status: 200, headers: { ...hdr, "content-range": unread ? `0-${unread - 1}/${unread}` : "*/0" } });
      }
      return reply(rows);
    }
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "practices") {
      const idEq = params.find(([k, v]) => k === "id" && v.startsWith("eq."));
      if (idEq) return reply([{ id: idEq[1].slice(3), practice_number: "PR-2026-0001", practice_type: "casa", status: "in_lavorazione", client_name: "Rossi Srl", client_phone: "1", client_email: "r@x.it", policy_number: null, financial_status: null, payment_date: null, beneficiary: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null, premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", vies_batch_id: null, renewal_of: null, user_id: UID }]);
      return reply([]);
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

{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=notification-count]", { timeout: 10000 });
  check("1 il numero delle notifiche da leggere e' sul campanello", (await page.getByTestId("notification-count").innerText()) === "2");
  check("1 il campanello dice quante sono (accessibilita')", (await page.getByTestId("notification-bell").getAttribute("aria-label")) === "Notifiche: 2 da leggere");
  await page.getByTestId("notification-bell").click();
  await page.waitForSelector("[data-testid=notification-item]");
  const items = (await page.getByTestId("notification-item").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  check("1 elenco: dalla piu' recente, nella lingua dell'utente", items.length === 3 && /Stato della pratica aggiornato/.test(items[0]) && /PR-2026-0001/.test(items[0]) && /Nuovo documento caricato/.test(items[1]), JSON.stringify(items));
  check("1 le da leggere sono evidenziate, quella letta no", JSON.stringify(await page.getByTestId("notification-item").evaluateAll((els) => els.map((el) => el.getAttribute("data-read")))) === JSON.stringify(["false", "false", "true"]));

  await page.getByTestId("notification-item").nth(1).click();
  await page.waitForURL(`${BASE}/practices/${P2}`, { timeout: 8000 });
  for (let i = 0; i < 30 && !log.patches.some((p) => p.query.includes("id=eq.n2")); i += 1) await page.waitForTimeout(100);
  const one = log.patches.find((p) => p.query.includes("id=eq.n2"));
  check("1 un clic apre la pratica e segna la notifica come letta", !!one && one.body.read === true, JSON.stringify(log.patches));
  await page.waitForSelector("[data-testid=notification-count]", { timeout: 8000 });
  check("1 il numero scende a 1", (await page.getByTestId("notification-count").innerText()) === "1");

  await page.getByTestId("notification-bell").click();
  await page.getByTestId("notification-mark-all").click();
  await page.waitForTimeout(500);
  const all = log.patches.find((p) => p.query.includes("read=eq.false") && !p.query.includes("id=eq."));
  check("1 «Segna tutte come lette» aggiorna solo quelle da leggere", !!all && all.body.read === true, JSON.stringify(log.patches));
  check("1 il numero sparisce dal campanello", (await page.getByTestId("notification-count").count()) === 0);
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

for (const [language, re, label] of [["en", /Practice status updated/, "en"], ["zh", /申请状态已更新/, "zh"]]) {
  const { ctx, page } = await open({ language });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=notification-count]", { timeout: 10000 });
  await page.getByTestId("notification-bell").click();
  await page.waitForSelector("[data-testid=notification-item]");
  const panel = await page.getByTestId("notification-panel").innerText();
  check(`2 ${label}: notifiche tradotte (non l'italiano salvato nel database)`, re.test(panel) && !/Cambio Stato Pratica|Nuovo Documento Caricato/.test(panel), panel.replace(/\s+/g, " ").slice(0, 200));
  await ctx.close();
}

{
  const { ctx, page } = await open({ failList: true });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.getByTestId("notification-bell").click();
  await page.waitForSelector("[data-testid=notification-panel]");
  check("3 se il caricamento fallisce: messaggio chiaro e il portale funziona", /Impossibile caricare le notifiche/.test(await page.getByTestId("notification-panel").innerText()) && (await page.getByTestId("notification-count").count()) === 0);
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} ok`);
process.exit(ok === results.length ? 0 : 1);
