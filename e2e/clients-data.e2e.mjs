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

const C1 = "c1000000-0000-4000-8000-000000000001";
const C2 = "c1000000-0000-4000-8000-000000000002";
const C3 = "c1000000-0000-4000-8000-000000000003";
const C4 = "c1000000-0000-4000-8000-000000000004";
const mkClient = (id, first, last, extra = {}) => ({
  id, user_id: UID, first_name: first, last_name: last, full_name: `${first} ${last}`, company_name: null, email: null, phone: null, mobile: null, tax_code: null, vat_number: null,
  address_street: null, address_city: null, address_province: null, address_postal_code: null, address_country: null, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...extra,
});
const fresh = () => [
  mkClient(C1, "Mario", "Rossi", { email: "mario@x.it", created_at: "2026-01-01T00:00:00Z" }),
  mkClient(C2, "Mario", "Rossi", { email: "MARIO@x.it", phone: "333111", created_at: "2026-02-01T00:00:00Z" }),
  mkClient(C3, "M.", "Rossi", { email: "mario@x.it", tax_code: "RSSMRA80A01H501U", created_at: "2026-03-01T00:00:00Z" }),
  mkClient(C4, "Anna", "Bianchi", { email: "anna@x.it", created_at: "2026-04-01T00:00:00Z" }),
];
const PRACTICES = [{ client_id: C1 }, { client_id: C2 }, { client_id: C2 }, { client_id: C3 }, { client_id: C4 }];

const browser = await chromium.launch();
async function open({ language = "it", failMerge = false, clients = fresh() } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  const log = { api: [] };
  let rows = clients;
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: hdr, body: JSON.stringify(body) });
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
    if (table === "user_roles") return reply([{ user_id: UID, role: "admin" }]);
    if (table === "profiles") return reply([{ id: UID, email: "t@example.com", full_name: "Prova", language }]);
    if (table === "clients") {
      const idEq = params.find(([k, v]) => k === "id" && v.startsWith("eq."));
      if (idEq) return reply(rows.filter((row) => row.id === idEq[1].slice(3)));
      return reply(rows);
    }
    if (table === "practices") {
      const inClients = params.find(([k, v]) => k === "client_id" && v.startsWith("in.("));
      if (inClients) { const ids = inClients[1].slice(4, -1).split(","); return reply(PRACTICES.filter((row) => ids.includes(row.client_id))); }
      return reply([]);
    }
    return reply([]);
  });
  await ctx.route(`${BASE}/api/**`, async (route) => {
    const req = route.request(); const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.api.push({ path: new URL(req.url()).pathname, body });
    const reply = (status, payload) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (body.action === "merge_clients") {
      if (failMerge) return reply(403, { error: "Puoi unire solo clienti della tua rubrica (o essere amministratore)", code: "forbidden" });
      rows = rows.filter((row) => !body.mergeIds.includes(row.id));
      return reply(200, { success: true, keptId: body.keepId, merged: body.mergeIds.map((id) => ({ id, name: "x", email: null })), practicesMoved: 3, filled: ["phone"] });
    }
    if (body.action === "export_client_data") return reply(200, { success: true, export: { generated_at: "2026-10-11T10:00:00.000Z", client: { id: body.clientId, first_name: "Mario" }, practices: [{ practice_number: "PR-1" }], emails_sent: [] } });
    return reply(200, {});
  });
  await ctx.addInitScript(({ key, value, lang }) => { try { localStorage.setItem(key, value); localStorage.setItem("portal-language", lang); } catch {} }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), lang: language });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  return { ctx, page, log, pageErrors };
}

{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=duplicates-button]", { timeout: 10000 });
  check("1 rubrica con doppioni: pulsante con il numero dei gruppi", (await page.getByTestId("duplicates-button").innerText()).includes("Possibili doppioni (1)"));
  await page.getByTestId("duplicates-button").click();
  await page.waitForSelector("[data-testid=duplicate-group]");
  const group = (await page.getByTestId("duplicate-group").innerText()).replace(/\s+/g, " ");
  check("1 gruppo: i tre clienti con la stessa email (maiuscole e spazi ignorati), non Anna", /Stessa email/i.test(group) && (await page.getByTestId("duplicate-name").count()) === 3 && !/Anna/.test(group), group);
  check("1 per ogni cliente il numero di pratiche", /2 pratiche/.test(group) && /1 pratica/.test(group), group);
  check("1 tiene di default quello con piu' pratiche", /Mario Rossi[^]*2 pratiche[^]*Tieni questo/.test(group) || /2 pratiche[^T]*Tieni questo/.test(group), group);

  await page.getByTestId("merge-group").click();
  const confirm = (await page.getByRole("alertdialog").innerText()).replace(/\s+/g, " ");
  check("1 conferma: dice quanti si uniscono e dove, e che non si annulla", /3 clienti verranno uniti in «Mario Rossi»/.test(confirm) && /non si può annullare/.test(confirm), confirm);
  await page.getByRole("button", { name: "Annulla" }).click();
  await page.waitForTimeout(300);
  check("1 annullando non parte nessuna chiamata", log.api.filter((c) => c.body.action === "merge_clients").length === 0);

  await page.getByTestId("merge-group").click();
  await page.getByTestId("merge-confirm").click();
  for (let i = 0; i < 40 && !log.api.some((c) => c.body.action === "merge_clients"); i += 1) await page.waitForTimeout(100);
  const call = log.api.find((c) => c.body.action === "merge_clients");
  check("1 l'API riceve chi tenere e chi unire", !!call && call.body.keepId === C2 && JSON.stringify([...call.body.mergeIds].sort()) === JSON.stringify([C1, C3].sort()), JSON.stringify(call));
  await page.waitForSelector("text=Clienti uniti", { timeout: 5000 });
  await page.waitForTimeout(600);
  check("1 dopo l'unione la rubrica si aggiorna e non ci sono piu' doppioni", (await page.getByTestId("duplicates-button").count()) === 0);
  check("1 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

{
  const { ctx, page } = await open({ failMerge: true });
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.getByTestId("duplicates-button").click();
  await page.getByTestId("merge-group").click();
  await page.getByTestId("merge-confirm").click();
  await page.waitForSelector("text=Unione non riuscita", { timeout: 5000 });
  check("2 errore del server: messaggio mostrato e doppioni ancora li'", (await page.getByText("Puoi unire solo clienti della tua rubrica").count()) >= 1 && (await page.getByTestId("duplicate-group").count()) === 1);
  await ctx.close();
}

{
  const { ctx, page } = await open({ clients: fresh().slice(3) });
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check("3 senza doppioni il pulsante non compare", (await page.getByTestId("duplicates-button").count()) === 0);
  await ctx.close();
}

{
  const { ctx, page, log, pageErrors } = await open();
  await page.goto(`${BASE}/clients/${C1}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=export-client-data]", { timeout: 10000 });
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.getByTestId("export-client-data").click()]);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const content = JSON.parse(readFileSync(path, "utf8"));
  check("4 esportazione: file JSON scaricato con il nome del cliente", download.suggestedFilename() === `cliente-${C1}.json`, download.suggestedFilename());
  check("4 il file contiene i dati restituiti dal server", content.client?.id === C1 && content.practices?.[0]?.practice_number === "PR-1");
  check("4 l'API riceve il cliente", log.api.some((c) => c.body.action === "export_client_data" && c.body.clientId === C1));
  check("4 nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

for (const [language, re, label] of [["en", /Possible duplicates \(1\)/, "en"], ["zh", /可能重复的客户（1）/, "zh"]]) {
  const { ctx, page } = await open({ language });
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=duplicates-button]", { timeout: 10000 });
  check(`5 ${label}: pulsante tradotto`, re.test(await page.getByTestId("duplicates-button").innerText()));
  await page.getByTestId("duplicates-button").click();
  await page.waitForSelector("[data-testid=duplicates-dialog]");
  const text = await page.getByTestId("duplicates-dialog").innerText();
  check(`5 ${label}: finestra tradotta`, !/Stessa email|Tieni questo|Possibili clienti doppi/.test(text), text.slice(0, 160));
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} ok`);
process.exit(ok === results.length ? 0 : 1);
