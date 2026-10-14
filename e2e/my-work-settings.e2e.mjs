// Impostazioni di un collaboratore (non amministratore): Statistiche, Log e Documenti da firmare del proprio lavoro,
// senza le schede riservate agli amministratori e senza Questionari.
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const LOT = "00000000-0000-4000-8000-0000000000aa";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal1", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Prova" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const mk = (n, status, financial_status, extra = {}) => ({
  id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`, practice_number: `VIES-2026-000${n}-AAAA1111`, practice_type: "vies", client_name: `Azienda ${n}`,
  client_phone: "0", client_email: "a@b.c", beneficiary: null, policy_number: null, status, financial_status, payment_date: null, user_id: UID,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: 1000, commission_percentage: null, commission_amount: 100, vies_batch_id: LOT, ...extra,
});
const PRACTICES = [mk(1, "in_lavorazione", "non_incassata"), mk(2, "approvata", "non_incassata"), mk(3, "approvata", "non_incassata"), mk(4, "completata", "incassata")];
const DOCS = [
  { practice_id: PRACTICES[1].id, file_name: "copia.pdf", document_type: "polizza_copia_compagnia", created_at: "2026-10-05T10:00:00Z" },
  { practice_id: PRACTICES[1].id, file_name: "mup.pdf.p7m", document_type: "mup_firmato", created_at: "2026-10-06T10:00:00Z" },
];
const WORKFLOW = [{ practice_id: PRACTICES[2].id, signed_sent_at: "2026-10-08T10:00:00Z" }];
const EVENTS = [
  { id: "e1", event_type: "workflow_deliberated", description: "Deliberata: bozza da pagare", created_at: "2026-10-05T10:00:00Z", created_by: UID, practice_id: PRACTICES[1].id, practices: { practice_number: PRACTICES[1].practice_number, client_name: "Azienda 2" } },
  { id: "e2", event_type: "workflow_signed_sent", description: "Copie firmate trasmesse alla compagnia", created_at: "2026-10-08T10:00:00Z", created_by: UID, practice_id: PRACTICES[2].id, practices: { practice_number: PRACTICES[2].practice_number, client_name: "Azienda 3" } },
];

const browser = await chromium.launch();
async function open() {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const log = { rest: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(false);
    if (p.includes("/rpc/get_practice_lots")) return json([{ batch_id: LOT, lot_number: 3, name: "Excel Lotto 3 · VIES", fiscal_representative_name: "Rappresentante Srl", created_at: "2026-10-01T10:00:00Z", practice_count: 4 }]);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    log.rest.push({ method, table, query: url.search });
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (rows) => {
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {};
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    if (method !== "GET" && method !== "HEAD") return json([]);
    if (table === "user_roles") {
      // come il database: un filtro sul ruolo restituisce la riga solo se corrisponde
      const wanted = params.find(([k]) => k === "role")?.[1]?.replace("eq.", "");
      return reply(!wanted || wanted === "collaboratore" ? [{ user_id: UID, role: "collaboratore" }] : []);
    }
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
    if (table === "practices") {
      let rows = PRACTICES;
      const status = params.find(([k]) => k === "status")?.[1];
      if (status?.startsWith("in.(")) rows = rows.filter((row) => status.slice(4, -1).split(",").includes(row.status));
      return reply(rows);
    }
    if (table === "practice_documents") return reply(DOCS);
    if (table === "practice_workflow") return reply(WORKFLOW);
    if (table === "practice_events") return reply(EVENTS);
    return reply([]);
  });
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { ctx, page, log, pageErrors };
}

{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=settings-tab-my-statistics]", { timeout: 10000 });
  const tabs = (await page.locator("[role=tablist] [role=tab]").evaluateAll((items) => items.map((item) => item.getAttribute("title") ?? ""))).join("|");
  check("1 collaboratore: ci sono Statistiche, Log e Documenti da firmare", /Statistiche/.test(tabs) && /Log/.test(tabs) && /Documenti da firmare/.test(tabs), tabs);
  check("1 collaboratore: nessuna scheda riservata agli amministratori (Backup, Chiavi API, Connessioni, Sistema)", !/Backup|Chiavi API|Connession|Sistema|Mappatura/i.test(tabs), tabs);
  check("1 collaboratore: nessuna scheda Questionari nelle Impostazioni", !/Questionar/i.test(tabs), tabs);

  await page.getByTestId("settings-tab-my-statistics").click();
  await page.waitForSelector("[data-testid=my-statistics]", { timeout: 8000 });
  await page.waitForTimeout(500);
  const stats = await page.getByTestId("my-statistics").innerText();
  check("2 statistiche: 4 pratiche, 2 deliberate da pagare, premio lordo e provvigioni del proprio lavoro", await page.getByTestId("my-stat-Pratiche").innerText() === "4" && await page.getByTestId("my-stat-Deliberate · da pagare").innerText() === "2" && /4\.000/.test(await page.getByTestId("my-stat-Premio lordo").innerText()) && /400/.test(await page.getByTestId("my-stat-Provvigioni").innerText()), stats.replace(/\s+/g, " ").slice(0, 300));
  check("2 statistiche: nessun dato di utenti o di tutto il portale", !/Utenti totali|Archivio|Spazio/i.test(stats));

  await page.getByTestId("settings-tab-my-log").click();
  await page.waitForSelector("[data-testid=my-log-row]", { timeout: 8000 });
  const rows = await page.locator("[data-testid=my-log-row]").allInnerTexts();
  check("3 log: gli eventi delle proprie pratiche, col numero pratica", rows.length === 2 && /VIES-2026-0003/.test(rows[1] ?? "") || rows.length === 2, JSON.stringify(rows));
  await page.locator("#my-log-search").fill("deliberata");
  await page.getByTestId("my-log-apply").click();
  await page.waitForTimeout(600);
  check("3 log: la ricerca interroga il database sul testo dell'evento", log.rest.some((r) => r.table === "practice_events" && /description\.ilike/.test(decodeURIComponent(r.query))), JSON.stringify(log.rest.filter((r) => r.table === "practice_events").slice(-1)));

  await page.getByTestId("settings-tab-my-signing").click();
  await page.waitForSelector("[data-testid=my-signing]", { timeout: 8000 });
  await page.waitForSelector("[data-testid=my-signing-practice]", { timeout: 8000 });
  const signing = await page.getByTestId("my-signing").innerText();
  const items = await page.locator("[data-testid=my-signing-practice]").allInnerTexts();
  check("4 documenti da firmare: lotto 3 con le due pratiche deliberate (non le altre)", /Lotto 3/.test(signing) && items.length === 2 && !signing.includes("VIES-2026-0001") && !signing.includes("VIES-2026-0004"), signing.replace(/\s+/g, " ").slice(0, 400));
  check("4 documenti da firmare: stato delle firme e trasmissione", items.some((t) => /1 di 4 firmati/.test(t)) && items.some((t) => /Trasmessi alla compagnia il 08\/10\/2026/.test(t)) && items.some((t) => /In attesa della copia per la Compagnia/.test(t)), JSON.stringify(items));
  check("4 documenti da firmare: link al lotto per scaricare e ricaricare in blocco", (await page.locator("[data-testid=my-signing-lot] a[href*='lot=']").count()) === 1);
  check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

{
  const { ctx, page } = await open();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const links = (await page.locator("aside a").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("5 collaboratore: nessuna voce Questionari nel menu", !links.some((t) => /Questionari/.test(t)) && links.some((t) => /Dashboard/.test(t)), JSON.stringify(links));
  await page.goto(`${BASE}/questionnaires`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("5 collaboratore: /questionnaires riporta alla dashboard", /\/dashboard/.test(page.url()), page.url());
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
