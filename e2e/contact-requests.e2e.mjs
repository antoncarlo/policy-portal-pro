// Impostazioni → «Richieste di contatto»: le richieste arrivate dal modulo del sito pubblico VIES e dal modulo di
// preventivo del sito aziendale. Le vedono e le segnano come gestite solo gli amministratori; un collaboratore non
// ha nemmeno la scheda.
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

const request = (n, over = {}) => ({
  id: `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`, created_at: `2026-11-1${n}T09:30:00Z`, name: `Persona ${n}`, company: `Studio ${n}`, role: "fiscal_representative", country: "Italia",
  email: `persona${n}@example.test`, phone: null, volume: null, message: `Messaggio della richiesta ${n}.\nSeconda riga.`, lang: "it", page: "/", email_sent: true, email_error: null, status: "new", handled_at: null, handled_by: null, site: "portal", product: null, ...over,
});
// una richiesta di preventivo dal sito aziendale: niente società, ruolo e Paese; c'è il prodotto
const quote = (n, over = {}) => request(n, { name: "Marco Bianchi", company: null, role: null, country: null, email: "marco.bianchi@example.test", message: "Vorrei un preventivo per un cantiere.", site: "corporate", product: "car", ...over });

const browser = await chromium.launch();
async function open(role) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 } });
  const rows = [request(3, { company: "Shenzhen Trading Ltd", role: "foreign_company", country: "Cina", lang: "zh", page: "/zh/", phone: "+86 138 0000 0000", volume: "20 al mese", message: "<b>Vorremmo</b> una quotazione." }), request(2, { email_sent: false, email_error: "SMTP timeout" }), request(1, { status: "handled", handled_at: "2026-11-12T10:00:00Z", handled_by: UID }), quote(0, { status: "handled", handled_at: "2026-11-11T10:00:00Z", handled_by: UID }), quote(9, { id: "00000000-0000-4000-8000-000000000399", created_at: "2026-11-10T08:00:00Z", status: "handled", handled_at: "2026-11-11T11:00:00Z", handled_by: UID, company: "Edil Bianchi Srl", product: null, email_sent: false, email_error: "SMTP timeout" })];
  const log = { writes: [], reads: 0 };
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    const p = url.pathname;
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.includes("/rpc/has_role")) return json(role === "admin");
    if (p.includes("/rpc/")) return json([]);
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const reply = (list) => (wantsObject ? (list.length ? json(list[0]) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(list));
    if (table === "contact_requests") {
      // come il database: senza il ruolo di amministratore non si vede nessuna riga e non se ne cambia nessuna
      if (method === "GET") { log.reads += 1; return reply(role === "admin" ? rows : []); }
      if (method === "PATCH") {
        const id = params.find(([k]) => k === "id")?.[1]?.replace("eq.", "");
        const body = req.postDataJSON();
        log.writes.push({ id, body });
        if (role === "admin") Object.assign(rows.find((row) => row.id === id) ?? {}, body);
        return route.fulfill({ status: 204, headers: hdr });
      }
      return json([]);
    }
    if (method !== "GET" && method !== "HEAD") return json([]);
    if (table === "user_roles") {
      const wanted = params.find(([k]) => k === "role")?.[1]?.replace("eq.", "");
      return reply(!wanted || wanted === role ? [{ user_id: UID, role }] : []);
    }
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language: "it" }]);
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", "it"); } catch { /* storage unavailable */ } }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { ctx, page, log, pageErrors };
}

// 1) amministratore: vede le richieste, risponde, le segna come gestite
{
  const { ctx, page, log, pageErrors } = await open("admin");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByTestId("settings-tab-contact-requests").click();
  await page.waitForSelector('[data-testid="contact-request"]', { timeout: 10000 });
  const cards = page.getByTestId("contact-request");
  check("1 all'apertura si vedono le richieste da gestire, la più recente in alto", (await cards.count()) === 2 && /Shenzhen Trading Ltd/.test(await cards.first().innerText()), String(await cards.count()));
  check("1 il conteggio dice quante sono da gestire", (await page.getByTestId("contact-requests-count").innerText()) === "2 richieste da gestire");
  const first = await cards.first().innerText();
  check("1 la richiesta mostra chi scrive, il ruolo, il paese, la pagina e i recapiti", /Persona 3/.test(first) && /Società estera/.test(first) && /Cina/.test(first) && /Pagina in cinese \(\/zh\/\)/.test(first) && /persona3@example\.test/.test(first) && /\+86 138/.test(first) && /20 al mese/.test(first), first.replace(/\s+/g, " ").slice(0, 300));
  check("1 il messaggio è testo, mai HTML", /<b>Vorremmo<\/b> una quotazione\./.test(first) && (await cards.first().locator("b").count()) === 0);
  check("1 una richiesta la cui email non è partita è segnalata", /Email non inviata alla casella VIES/.test(await cards.nth(1).innerText()));
  const reply = await cards.first().locator('a[href^="mailto:"]').getAttribute("href");
  check("1 «Rispondi» scrive a chi ha inviato la richiesta", reply === "mailto:persona3@example.test?subject=Richiesta%20di%20contatto%20VIES%3A%20Shenzhen%20Trading%20Ltd", reply ?? "");
  await page.screenshot({ path: SHOTS + "contact-requests.png" });

  await cards.first().getByRole("button", { name: "Segna come gestita" }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="contact-request"]').length === 1);
  const write = log.writes[0] ?? {};
  check("1 «Segna come gestita» cambia solo lo stato, con chi e quando", log.writes.length === 1 && write.id === "00000000-0000-4000-8000-000000000303" && JSON.stringify(Object.keys(write.body).sort()) === JSON.stringify(["handled_at", "handled_by", "status"]) && write.body.status === "handled" && write.body.handled_by === UID && !Number.isNaN(Date.parse(write.body.handled_at)), JSON.stringify(log.writes));
  check("1 la richiesta gestita esce dall'elenco «Da gestire» e il conteggio scende", (await page.getByTestId("contact-requests-count").innerText()) === "1 richiesta da gestire");

  await page.getByTestId("contact-requests-filter-handled").click();
  check("1 «Gestite» mostra le richieste gestite, con la data", (await cards.count()) === 4 && /Gestita il/.test(await cards.first().innerText()));
  await cards.first().getByRole("button", { name: /Riporta a/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="contact-request"]').length === 3);
  check("1 una richiesta gestita si può riportare a «da gestire»", log.writes.length === 2 && log.writes[1].body.status === "new" && log.writes[1].body.handled_at === null && log.writes[1].body.handled_by === null, JSON.stringify(log.writes[1]));
  await page.getByTestId("contact-requests-filter-all").click();
  check("1 «Tutte» le mostra tutte, quelle del sito VIES e quelle del sito aziendale", (await cards.count()) === 5 && (await page.locator('[data-testid="contact-request"][data-site="corporate"]').count()) === 2);
  const quoteCard = (await page.locator('[data-testid="contact-request"][data-site="corporate"]').first().innerText()).replace(/\s+/g, " ");
  check("1 una richiesta del sito aziendale è intestata alla persona e dice sito e prodotto, senza ruolo né Paese", /^Marco Bianchi/.test(quoteCard) && /Sito aziendale/.test(quoteCard) && /Prodotto: CAR/.test(quoteCard) && !/null|undefined/.test(quoteCard), quoteCard.slice(0, 240));
  const quoteReply = await page.locator('[data-testid="contact-request"][data-site="corporate"]').first().locator('a[href^="mailto:"]').getAttribute("href");
  check("1 la risposta a una richiesta di preventivo non parla di VIES", quoteReply === "mailto:marco.bianchi@example.test?subject=Richiesta%20di%20preventivo%3A%20Marco%20Bianchi", quoteReply ?? "");
  const companyQuote = (await page.locator('[data-testid="contact-request"][data-site="corporate"]').nth(1).innerText()).replace(/\s+/g, " ");
  check("1 con la società indicata il titolo è la società; senza prodotto lo dice; l'email non partita nomina la casella aziendale", /^Edil Bianchi Srl/.test(companyQuote) && /Marco Bianchi · Prodotto: non indicato/.test(companyQuote) && /Email non inviata alla casella aziendale/.test(companyQuote), companyQuote.slice(0, 260));
  check("1 le richieste del sito VIES portano la loro etichetta", /Sito VIES/.test(await page.locator('[data-testid="contact-request"][data-site="portal"]').first().innerText()));
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 2) collaboratore e agente: nessuna scheda, nessuna lettura della tabella
for (const role of ["collaboratore", "agente"]) {
  const { ctx, page, log } = await open(role);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForSelector("[role=tablist] [role=tab]", { timeout: 10000 });
  await page.waitForTimeout(500);
  check(`2 ${role}: la scheda «Richieste di contatto» non c'è`, (await page.getByTestId("settings-tab-contact-requests").count()) === 0);
  check(`2 ${role}: la tabella delle richieste non viene letta`, log.reads === 0, String(log.reads));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
