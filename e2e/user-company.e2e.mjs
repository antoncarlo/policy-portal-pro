// Gestione utenti, «Dati società» (10/11/2026): l'estratto conto di un lotto è intestato alla società di chi lo ha
// caricato (es. Italy4VAT S.r.l. per Stefano Schiaffino), non al rappresentante fiscale delle pratiche. L'amministratore
// imposta ragione sociale, codice fiscale o partita IVA e sede; se il database non aggiorna nulla lo dice.
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000002";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const USERS = [
  { id: UID, full_name: "Mario Admin", email: "t@example.com", phone: "1", avatar_url: null, role: "admin", agent_name: null, practice_count: 0 },
  { id: AGENT, full_name: "Stefano Schiaffino", email: "stefano@italy4vat.test", phone: "2", avatar_url: null, role: "agente", agent_name: null, practice_count: 40, default_commission_percentage: 0 },
];

const browser = await chromium.launch();
async function open({ updateRows = 1 } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { updates: [] };
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
    const reply = (rows) => (wantsObject ? (rows.length ? json(rows[0]) : json(null)) : json(rows));
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles" && method === "PATCH") {
      log.updates.push({ id: url.searchParams.get("id"), body: JSON.parse(req.postData() || "{}") });
      return json(updateRows ? [{ id: AGENT }] : []);
    }
    if (table === "profiles" && url.searchParams.get("select")?.includes("company_name")) return reply([{ company_name: null, company_tax_code: null, company_address: null }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Mario Admin", language: "it" }]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/user-management`, { waitUntil: "networkidle" });
  await page.waitForSelector("table");
  return { ctx, page, log, pageErrors };
}
const openCompany = async (page) => {
  await page.locator("tr", { hasText: "stefano@italy4vat.test" }).locator("button").last().click();
  await page.getByTestId("user-edit-company").click();
  await page.waitForSelector("[data-testid=company-company_name]");
};
const body = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");

// 1) the administrator sets Italy4VAT S.r.l. for the collaborator
{
  const { ctx, page, log, pageErrors } = await open();
  await openCompany(page);
  check("1 la finestra spiega a cosa servono i dati", /l'estratto conto dei lotti che carica è intestato a lei/.test(await body(page)));
  await page.getByTestId("company-company_name").fill("  Italy4VAT   S.r.l. ");
  await page.getByTestId("company-company_tax_code").fill("123 456 789 03");
  await page.getByTestId("company-company_address").fill("Via degli Scipioni 157 - 00192 Roma (RM)");
  await page.getByTestId("company-save").click();
  await page.waitForTimeout(600);
  const update = log.updates[0];
  check("1 salva ragione sociale, codice e sede del collaboratore, ripuliti", update && update.id === `eq.${AGENT}` && update.body.company_name === "Italy4VAT S.r.l." && update.body.company_tax_code === "12345678903" && update.body.company_address === "Via degli Scipioni 157 - 00192 Roma (RM)", JSON.stringify(log.updates));
  check("1 conferma il salvataggio", /Dati della società salvati per Stefano Schiaffino/.test(await body(page)));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) the database updates nothing (not an administrator): an error, never a silent success
{
  const { ctx, page, pageErrors } = await open({ updateRows: 0 });
  await openCompany(page);
  await page.getByTestId("company-company_name").fill("Italy4VAT S.r.l.");
  await page.getByTestId("company-save").click();
  await page.waitForTimeout(600);
  const t = await body(page);
  check("2 nessuna riga aggiornata: «Dati della società non salvati», la finestra resta aperta", /Dati della società non salvati/.test(t) && (await page.getByTestId("company-company_name").count()) === 1, t.slice(0, 300));
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
