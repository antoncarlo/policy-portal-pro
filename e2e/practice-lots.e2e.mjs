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

const LOT1 = "11111111-1111-4111-8111-111111111111";
const LOT2 = "22222222-2222-4222-8222-222222222222";
const LOT0 = "33333333-3333-4333-8333-333333333333";
let n = 0;
const pid = () => `00000000-0000-4000-8000-0000000002${String(++n).padStart(2, "0")}`;
const base = (over) => ({
  id: pid(), practice_type: "vies", client_name: "Azienda", client_phone: "1", client_email: "a@b.c", beneficiary: null, policy_number: null, status: "in_lavorazione", financial_status: "non_incassata",
  payment_date: null, user_id: UID, created_at: "2026-10-08T10:00:00Z", updated_at: "2026-10-08T10:00:00Z", notes: null, owner_tax_code: null, pet_microchip: null, policy_start_date: null, policy_end_date: null,
  premium_net: null, premium_taxable: null, premium_taxes: null, premium_gross: null, commission_percentage: null, commission_amount: null, vies_batch_id: null, ...over,
});
const PRACTICES = [
  base({ practice_number: "VIES-2026-0001-11111111", client_name: "Alfa Srl", vies_batch_id: LOT1, status: "in_attesa" }),
  base({ practice_number: "VIES-2026-0002-11111111", client_name: "Beta Spa", vies_batch_id: LOT1, status: "approvata" }),
  base({ practice_number: "VIES-2026-0001-22222222", client_name: "Gamma Srl", vies_batch_id: LOT2, status: "integrazioni", created_at: "2026-10-09T10:00:00Z" }),
  base({ practice_number: "VIES-2026-0002-22222222", client_name: "Delta Srl", vies_batch_id: LOT2, status: "approvata", created_at: "2026-10-09T10:00:00Z" }),
  base({ practice_number: "VIES-2026-0003-22222222", client_name: "Epsilon Srl", vies_batch_id: LOT2, status: "approvata", created_at: "2026-10-09T10:00:00Z" }),
  base({ practice_number: "VIES-2026-0004-22222222", client_name: "Zeta Srl", vies_batch_id: LOT2, status: "completata", created_at: "2026-10-09T10:00:00Z" }),
  base({ practice_number: "PR-2026-0001", practice_type: "auto", client_name: "Mario Rossi", created_at: "2026-10-10T10:00:00Z" }),
  base({ practice_number: "PR-2026-0002", practice_type: "casa", client_name: "Luisa Bianchi", created_at: "2026-10-10T11:00:00Z" }),
];
const LOTS = [
  { batch_id: LOT2, lot_number: 2, name: "Excel Lotto 2 · VIES", fiscal_representative_name: "Rappresentante Fiscale Rossi", created_at: "2026-10-09T09:00:00Z", practice_count: 4 },
  { batch_id: LOT1, lot_number: 1, name: "Excel Lotto 1 · VIES", fiscal_representative_name: "Rappresentante Fiscale Rossi", created_at: "2026-10-08T09:00:00Z", practice_count: 2 },
];

const browser = await chromium.launch();
async function open({ withLots = true, language = "it" } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1400, height: 1000 } });
  const log = { rpc: [], practiceQueries: [] };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/get_practice_lots")) {
      const body = JSON.parse(req.postData() || "{}");
      log.rpc.push(body);
      if (!withLots) return json([]);
      let rows = LOTS;
      if (body.p_batch_ids) rows = rows.filter((row) => body.p_batch_ids.includes(row.batch_id));
      if (body.p_limit) rows = rows.slice(0, body.p_limit);
      return json(rows);
    }
    if (p.includes("/rpc/has_role")) return json(true);
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const isHead = method === "HEAD";
    const reply = (rows) => {
      const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${rows.length}` } : {};
      if (isHead) return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
      if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
      return json(rows, 200, countHeader);
    };
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "user_product_permissions") return reply([{ practice_type: "vies" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "practice_workflow" || table === "practice_events" || table === "practice_documents") return reply([]);
    if (table === "practices") {
      log.practiceQueries.push(url.search);
      let rows = PRACTICES.filter((row) => params.every(([k, v]) => {
        if (["select", "order", "limit", "offset"].includes(k)) return true;
        if (k === "or") return true;
        if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
        if (v.startsWith("in.(")) return v.slice(4, -1).split(",").includes(String(row[k]));
        return true;
      }));
      rows = rows.map((row) => {
        const select = params.find(([k]) => k === "select")?.[1];
        if (!select || select === "*") return row;
        const cols = select.split(",").map((c) => c.trim());
        return Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]));
      });
      rows = [...rows].sort((a, b) => (params.find(([k]) => k === "order")?.[1].startsWith("practice_number") ? a.practice_number.localeCompare(b.practice_number) : String(b.created_at).localeCompare(String(a.created_at))));
      return reply(rows);
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
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const mainText = async (page) => (await page.locator("main").innerText()).replace(/\s+/g, " ");
const lotRow = (page, n) => page.locator("[data-testid=lot-row]", { hasText: `Lotto ${n}` });

// 1) the list grouped by lot
{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-row]", { timeout: 10000 });
  const rows = await page.locator("[data-testid=lot-row]").allInnerTexts();
  check("1 una riga per lotto, il più recente per primo", rows.length === 2 && /Lotto 2/.test(rows[0]) && /Lotto 1/.test(rows[1]), JSON.stringify(rows));
  check("1 la riga del lotto: conteggio, rappresentante fiscale, data", /4 pratiche/.test(rows[0]) && /Rappresentante Fiscale Rossi/.test(rows[0]) && /09\/10\/2026/.test(rows[0]), rows[0]);
  check("1 la riga del lotto riassume gli stati (2 deliberate...)", /2 · Deliberate/.test(rows[0]) && /1 · Integrazioni/.test(rows[0]), rows[0]);
  const body = await text(page);
  check("1 chiuso: le pratiche del lotto non si vedono ancora, le altre sì", !body.includes("VIES-2026-0001-22222222") && body.includes("PR-2026-0001") && body.includes("PR-2026-0002"));
  check("1 'Altre pratiche' separa le pratiche fuori lotto", /altre pratiche/i.test(body));
  const lotQuery = log.rpc.find((r) => Array.isArray(r.p_batch_ids));
  check("1 i lotti si chiedono in una sola volta per tutti gli id", lotQuery && lotQuery.p_batch_ids.length === 2, JSON.stringify(log.rpc));

  await lotRow(page, 2).locator("[data-testid=lot-toggle]").click();
  await page.waitForTimeout(300);
  const nested = await page.locator("[data-testid=practice-row]").allInnerTexts();
  const lot2Numbers = nested.filter((t) => /VIES-2026-000\d-22222222/.test(t)).map((t) => t.match(/VIES-2026-000\d-22222222/)[0]);
  check("1 espanso: ogni pratica del lotto col proprio numero", JSON.stringify(lot2Numbers) === JSON.stringify(["VIES-2026-0001-22222222", "VIES-2026-0002-22222222", "VIES-2026-0003-22222222", "VIES-2026-0004-22222222"]), JSON.stringify(lot2Numbers));
  check("1 l'altro lotto resta chiuso", !(await text(page)).includes("VIES-2026-0001-11111111"));
  await page.screenshot({ path: SHOTS + "lots-list.png" });

  // selection of a whole lot
  await lotRow(page, 2).locator("button[role=checkbox]").click();
  check("1 il segno sul lotto seleziona tutte le sue pratiche", /4 pratiche selezionate/.test(await text(page)), (await text(page)).slice(0, 400));
  await lotRow(page, 2).locator("button[role=checkbox]").click();

  // filter by search: matching lots open with 'x di y'
  await page.getByPlaceholder(/Cerca per numero pratica/).fill("Gamma");
  await page.waitForTimeout(500);
  const filtered = await mainText(page);
  check("1 con la ricerca il lotto si apre solo sulle pratiche trovate", filtered.includes("VIES-2026-0001-22222222") && !filtered.includes("VIES-2026-0002-22222222") && !filtered.includes("Lotto 1"), filtered.slice(0, 500));
  check("1 il lotto mostra '1 di 4 pratiche'", /1 di 4 pratiche/.test(filtered), filtered.slice(0, 500));
  await page.getByPlaceholder(/Cerca per numero pratica/).fill("lotto 1");
  await page.waitForTimeout(400);
  check("1 la ricerca trova anche per nome del lotto", /Lotto 1/.test(await mainText(page)) && (await mainText(page)).includes("VIES-2026-0001-11111111"));
  await page.getByPlaceholder(/Cerca per numero pratica/).fill("");

  // view toggle remembered
  await page.locator("[data-testid=view-flat]").click();
  await page.waitForTimeout(300);
  check("1 vista a elenco: nessuna riga di lotto, tutte le pratiche una per riga", (await page.locator("[data-testid=lot-row]").count()) === 0 && (await page.locator("[data-testid=practice-row]").count()) === 8);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=view-flat]");
  check("1 la scelta della vista è ricordata dopo il ricarico", (await page.locator("[data-testid=lot-row]").count()) === 0);
  await page.locator("[data-testid=view-lots]").click();
  await page.waitForSelector("[data-testid=lot-row]");
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) the menu: lots with their practices
{
  const { ctx, page, pageErrors } = await open();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check("2 il menu chiuso non mostra i lotti", (await page.locator("[data-testid=lots-menu]").count()) === 0);
  await page.getByRole("button", { name: /Apri le sezioni|sezioni/i }).first().click().catch(() => {});
  await page.locator("aside [aria-expanded]").first().waitFor();
  const chevron = page.locator("aside button[aria-expanded]").first();
  if ((await chevron.getAttribute("aria-expanded")) !== "true") await chevron.click();
  await page.waitForSelector("[data-testid=lots-menu]", { timeout: 8000 });
  const lots = await page.locator("[data-testid=lots-menu-lot]").allInnerTexts();
  check("2 il menu Pratiche elenca i lotti (Lotto 2 e Lotto 1) con il numero di pratiche", lots.length === 2 && /Lotto 2\s*4/.test(lots[0].replace(/\s+/g, " ")) && /Lotto 1\s*2/.test(lots[1].replace(/\s+/g, " ")), JSON.stringify(lots));
  await page.locator("[data-testid=lots-menu-lot]").first().locator("button[aria-expanded]").click();
  await page.waitForSelector("[data-testid=lots-menu-practice]");
  const items = await page.locator("[data-testid=lots-menu-practice]").allInnerTexts();
  check("2 il lotto si apre sulle sue pratiche, ognuna col suo numero", JSON.stringify(items.map((t) => t.trim())) === JSON.stringify(["VIES-2026-0001-22222222", "VIES-2026-0002-22222222", "VIES-2026-0003-22222222", "VIES-2026-0004-22222222"]), JSON.stringify(items));
  await page.screenshot({ path: SHOTS + "lots-menu.png" });
  await page.locator("[data-testid=lots-menu-practice]").nth(1).click();
  await page.waitForURL(/\/practices\/00000000/);
  await page.waitForSelector("[data-testid=lot-breadcrumb]");
  const crumb = (await page.locator("[data-testid=lot-breadcrumb]").innerText()).replace(/\s+/g, " ");
  check("2 la pratica si apre con il percorso Pratiche › Lotto 2 › numero e la posizione 2 / 4", /Pratiche/.test(crumb) && /Lotto 2/.test(crumb) && /VIES-2026-0002-22222222/.test(crumb) && /2 \/ 4/.test(crumb), crumb);
  check("2 nel menu il lotto della pratica resta aperto e la pratica è evidenziata", (await page.locator("[data-testid=lots-menu-practice]").count()) === 4);
  await page.locator("[data-testid=lot-next]").click();
  await page.waitForTimeout(600);
  check("2 'successiva' porta alla pratica seguente del lotto", /VIES-2026-0003-22222222/.test((await page.locator("[data-testid=lot-breadcrumb]").innerText())) && /3 \/ 4/.test(await page.locator("[data-testid=lot-breadcrumb]").innerText()));
  await page.locator("[data-testid=lot-breadcrumb] a", { hasText: "Lotto 2" }).click();
  await page.waitForURL(/\/practices\?lot=/);
  await page.waitForSelector("[data-testid=lot-chip]");
  const rows = await page.locator("[data-testid=practice-row]").allInnerTexts();
  check("2 il link del lotto apre l'elenco filtrato sul lotto, già aperto, con il suo filtro visibile", rows.length === 4 && /Lotto: Lotto 2/.test(await page.locator("[data-testid=lot-chip]").innerText()), JSON.stringify(rows.length));
  await page.locator("[data-testid=lot-chip] button").click();
  await page.waitForTimeout(500);
  check("2 togliendo il filtro tornano tutte le pratiche", !/lot=/.test(page.url()) && (await page.locator("[data-testid=lot-row]").count()) === 2);
  check("2 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 3) no lots: nothing changes for who has none
{
  const { ctx, page, pageErrors } = await open({ withLots: false });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=practice-row]");
  check("3 senza lotti: elenco piatto, nessun selettore di vista, nessuna riga di lotto", (await page.locator("[data-testid=lot-row]").count()) === 0 && (await page.locator("[data-testid=view-lots]").count()) === 0 && (await page.locator("[data-testid=practice-row]").count()) === 8);
  check("3 senza lotti: nessun menu dei lotti", (await page.locator("[data-testid=lots-menu]").count()) === 0);
  check("3 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) other languages
for (const [language, expected] of [["en", /Lot 2/], ["zh", /批次 2/]]) {
  const { ctx, page, pageErrors } = await open({ language });
  await page.goto(`${BASE}/practices`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lot-row]");
  const rows = await page.locator("[data-testid=lot-row]").allInnerTexts();
  check(`4 ${language}: il lotto è tradotto`, expected.test(rows[0]) && !/Lotto/.test(rows[0]), rows[0]);
  check(`4 ${language}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
