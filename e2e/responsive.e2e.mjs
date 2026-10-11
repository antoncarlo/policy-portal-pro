// Ogni pagina del portale su telefono, iPad e PC, con dati simulati (nessuna rete reale):
//   - nessuna pagina scorre in orizzontale (il difetto tipico di un layout non adattato)
//   - nessun elemento visibile esce dallo schermo a destra (al netto dei contenitori che scorrono di proposito)
//   - la navigazione è raggiungibile: menu laterale da 1024 px in su, pulsante del menu sotto
//   - i controlli principali hanno un'area toccabile utile sui dispositivi touch
//
//   npm run test:e2e -- responsive            controllo
//   AUDIT=1 npm run test:e2e -- responsive    in più, screenshot di ogni pagina in e2e/artifacts/responsive/
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/responsive/", import.meta.url).pathname;
const AUDIT = process.env.AUDIT === "1";
mkdirSync(SHOTS, { recursive: true });
const REF = "nesblhtjqiavdfsrtfom";
const SUPA = `https://${REF}.supabase.co`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "00000000-0000-4000-8000-000000000001";
const mkJwt = () => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", email: "t@example.com", aal: "aal2", amr: [], session_id: "s1", exp: 4102444800 })}.firma123`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: { full_name: "Mario Admin" }, created_at: "2026-01-01T00:00:00Z", factors: [] };
const session = { access_token: mkJwt(), refresh_token: "r-1", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user };
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

// ---------------------------------------------------------------- dati simulati (nomi lunghi apposta: sono i casi difficili)
const ids = Array.from({ length: 12 }, (_, i) => `00000000-0000-4000-8000-0000000004${String(i + 1).padStart(2, "0")}`);
const LOT1 = "11111111-1111-4111-8111-111111111111";
const LOT2 = "22222222-2222-4222-8222-222222222222";
const statuses = ["in_lavorazione", "in_attesa", "integrazioni", "approvata", "approvata", "completata", "rifiutata", "in_lavorazione", "in_attesa", "approvata", "completata", "in_lavorazione"];
const practice = (i) => ({
  id: ids[i], practice_number: i < 8 ? `VIES-2026-${String(i + 1).padStart(4, "0")}-${LOT1.slice(0, 8).toUpperCase()}` : `PR-2026-${String(1000 + i)}`,
  practice_type: i < 8 ? "vies" : ["auto", "casa", "pet", "rc"][i % 4], client_name: i % 3 === 0 ? "Società Agricola Fratelli Rossi e Bianchi di Montefiascone S.r.l. Unipersonale" : `Cliente Esempio ${i + 1}`,
  client_phone: "+39 333 1234567", client_email: `cliente.molto.lungo.${i + 1}@azienda-esempio-con-dominio-lungo.example.com`, beneficiary: i % 2 ? "Beneficiario Esempio S.p.A." : null,
  policy_number: i % 2 ? `POL-${i}00123` : null, status: statuses[i], financial_status: ["non_incassata", "incassata", "provvigioni_ricevute"][i % 3], payment_date: null, user_id: UID,
  created_at: `2026-10-${String(1 + i).padStart(2, "0")}T10:00:00Z`, updated_at: "2026-10-10T10:00:00Z", notes: i === 2 ? "Nota di prova abbastanza lunga da andare a capo su più righe in una scheda stretta." : null,
  owner_tax_code: "RSSMRA80A01H501U", pet_microchip: null, policy_start_date: "2026-10-01", policy_end_date: `2027-0${1 + (i % 9)}-15`, premium_net: 1200 + i * 10, premium_taxable: 1300, premium_taxes: 150,
  premium_gross: 1450 + i * 10, commission_percentage: 10, commission_amount: 145, vies_batch_id: i < 8 ? (i < 4 ? LOT1 : LOT2) : null, api_key_id: null, renewal_of: null, specific_fields: {},
});
const PRACTICES = ids.map((_, i) => practice(i));
const CLIENTS = Array.from({ length: 6 }, (_, i) => ({
  id: `00000000-0000-4000-8000-0000000005${String(i + 1).padStart(2, "0")}`, user_id: UID, first_name: i % 2 ? "Giovanni Battista" : "Maria", last_name: i % 2 ? "Rossi di Montefiascone" : "Bianchi", full_name: `${i % 2 ? "Giovanni Battista" : "Maria"} ${i % 2 ? "Rossi di Montefiascone" : "Bianchi"}`,
  company_name: i % 2 ? "Società Agricola Fratelli Rossi e Bianchi di Montefiascone S.r.l." : null, email: `cliente.${i + 1}@example.com`, phone: "+39 06 1234567", mobile: "+39 333 1234567", tax_code: "RSSMRA80A01H501U", vat_number: "01234567890",
  address_street: "Via dei Condotti 1", address_city: "Roma", address_province: "RM", address_postal_code: "00187", address_country: "IT", notes: null, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-01T10:00:00Z",
}));
const PROFILES = [
  { id: UID, email: "t@example.com", full_name: "Mario Admin", phone: "+39 333 1111111", avatar_url: null, language: "it", theme: "light", timezone: "Europe/Rome", date_format: "DD/MM/YYYY", address: null, commission_bonus_tiers: [], default_commission_percentage: 10, email_notifications: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];
const USERS = Array.from({ length: 5 }, (_, i) => ({ id: `00000000-0000-4000-8000-0000000006${String(i + 1).padStart(2, "0")}`, full_name: i === 1 ? "Alessandro Maria Giuseppe Ferdinando di Borbone" : `Utente Esempio ${i + 1}`, email: `utente.con.indirizzo.molto.lungo.${i + 1}@azienda-esempio.example.com`, phone: "+39 333 7654321", avatar_url: null, role: ["admin", "agente", "collaboratore", "user", "agente"][i], agent_name: i === 2 ? "Utente Esempio 2" : null, practice_count: 12 + i, default_commission_percentage: 10, commission_bonus_tiers: [] }));
const KPIS = [{ active_agents: 4, avg_premium: 1450, conversion_rate: 62.5, current_period_commission: 5400, current_period_practices: 42, current_period_premium: 61000, expiring_soon: 7, growth_commission: 12.5, growth_practices: 8.3, growth_premium: 15.2, previous_period_commission: 4800, previous_period_practices: 39, previous_period_premium: 52900 }];
const STATS = [{ avg_premium: 1450, practices_by_month: [{ month: "2026-08", count: 10, premium: 14000, commission: 1400 }, { month: "2026-09", count: 14, premium: 20000, commission: 2000 }, { month: "2026-10", count: 18, premium: 27000, commission: 2700 }], practices_by_status: { approvata: 12, in_attesa: 9, in_lavorazione: 14, completata: 7 }, practices_by_type: { vies: 20, auto: 8, casa: 5, pet: 9 }, top_agents: [{ agent_name: "Utente Esempio con nome lungo", practices_count: 14, total_premium: 21000, total_commission: 2100 }], total_commission: 6100, total_practices: 42, total_premium: 61000 }];
const EXPIRIES = Array.from({ length: 4 }, (_, i) => ({ practice_id: ids[i], practice_number: PRACTICES[i].practice_number, practice_type: "auto", client_name: PRACTICES[i].client_name, client_email: PRACTICES[i].client_email, client_phone: "+39 333 1234567", policy_end_date: `2026-11-${10 + i}`, days_until_expiry: 20 + i * 15, notification_90_sent: false, notification_60_sent: false, notification_30_sent: false, notification_7_sent: false, user_id: UID, user_full_name: "Mario Admin" }));
const LOTS = [
  { batch_id: LOT2, lot_number: 2, name: "Excel Lotto 2 · VIES", fiscal_representative_name: "Rappresentante Fiscale Rossi e Associati", created_at: "2026-10-09T09:00:00Z", practice_count: 4 },
  { batch_id: LOT1, lot_number: 1, name: "Excel Lotto 1 · VIES", fiscal_representative_name: "Rappresentante Fiscale Rossi e Associati", created_at: "2026-10-08T09:00:00Z", practice_count: 4 },
];
const BATCHES = LOTS.map((l, i) => ({ id: l.batch_id, user_id: UID, name: l.name, lot_number: l.lot_number, status: i ? "completed" : "ready", total_rows: 20, total_documents: 40, completed_jobs: 18, ready_jobs: 2, failed_jobs: 0, blocked_jobs: 0, cancelled_jobs: 0, processing_jobs: 0, queued_jobs: 0, matched_requirements: 20, missing_requirements: [], fiscal_representative_id: "rep-1", commission_percentage: 10, withholding_percentage: 4, created_at: l.created_at, updated_at: l.created_at, completed_at: null, paid_at: null, commissions_received_at: null, statement_generated_at: null, excel_storage_path: null, zip_storage_path: null, last_worker_message: null, last_worker_run_at: null, notes: null, source_excel_file_name: "lotto.xlsx", source_zip_file_name: "lotto.zip", processing_started_at: null, queued_at: null, target_portal: null }));
const TABLES = {
  practices: PRACTICES, clients: CLIENTS, profiles: PROFILES, user_roles: [{ id: "r1", user_id: UID, role: "admin", parent_agent_id: null, created_at: "2026-01-01T00:00:00Z", created_by: null }],
  user_product_permissions: [{ id: "p1", user_id: UID, practice_type: "vies", created_at: "2026-01-01T00:00:00Z", created_by: null }], vies_batches: BATCHES,
  vies_fiscal_representatives: [{ id: "rep-1", user_id: UID, name: "Rappresentante Fiscale Rossi e Associati S.r.l.", tax_code: "01234567890", pec: "rappresentante.fiscale.rossi@pec.example.com", address: "Via dei Condotti 1, 00187 Roma", administrator_name: "Mario Rossi", administrator_tax_code: "RSSMRA80A01H501U", visura_reference: null, visura_storage_path: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
  api_keys: [{ id: "k1", name: "Broker Beta (portale produzione con nome molto lungo)", key_prefix: "pk_live_ab12", key_hash: "x", is_active: true, partner_email: "partner@example.com", created_at: "2026-09-01T00:00:00Z", expires_at: null, last_used_at: "2026-10-10T10:00:00Z", created_by: UID }],
  system_settings: [{ id: "s1", portal_name: "Tecno Advance MGA", sender_email: "info@tecnomga.com", sender_name: "Tecno Advance", support_email: "info@tecnomga.com", default_language: "it", default_timezone: "Europe/Rome", default_date_format: "DD/MM/YYYY", password_min_length: 6, password_require_numbers: true, password_require_uppercase: true, lockout_duration_minutes: 15, max_login_attempts: 5, session_timeout_minutes: 480, storage_limit_per_user_gb: 5, portal_logo_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
  practice_events: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, practice_id: ids[i], event_type: "status_change", description: "Stato cambiato da In Lavorazione a Approvata con una descrizione lunga che deve andare a capo", created_at: "2026-10-10T10:00:00Z", created_by: UID })),
  practice_documents: ids.slice(0, 5).map((id, i) => ({ id: `d${i}`, practice_id: id, file_name: `documento-di-identita-del-legale-rappresentante-con-nome-molto-lungo-${i}.pdf`, file_path: `${UID}/${id}/doc.pdf`, file_size: 120000, document_type: "documento_identita", mime_type: "application/pdf", uploaded_by: UID, created_at: "2026-10-10T10:00:00Z" })),
  practice_workflow: [], notifications: [], user_notification_settings: [], agent_settings: [], vies_jobs: [], vies_intake_lots: [], vies_batch_documents: [], outbound_deliveries: [], integration_events: [], api_logs: [], api_key_user_mapping: [],
  audit_log: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, at: "2026-10-11T12:00:00Z", actor_id: UID, actor_role: "admin", source: "app", table_name: "practices", row_id: ids[i], action: "update", old_data: { status: "in_attesa" }, new_data: { status: "approvata" }, changed_keys: ["status"], details: null, ip: "203.0.113.9", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })),
};
const RPCS = {
  get_dashboard_kpis: KPIS, get_production_stats: STATS, get_production_details: PRACTICES.slice(0, 5).map((p) => ({ practice_number: p.practice_number, practice_type: p.practice_type, client_name: p.client_name, policy_number: p.policy_number, policy_start_date: p.policy_start_date, policy_end_date: p.policy_end_date, premium_gross: p.premium_gross, commission_amount: 145, status: p.status, created_at: p.created_at })),
  get_all_users_with_details: USERS, get_upcoming_expiries: EXPIRIES, get_practice_lots: LOTS, get_hierarchical_practices: PRACTICES, get_effective_commission_percentage: 10,
  get_renewal_stats: { renewed_last_12_months: 5, expired_last_12_months: 9, rate: 55.6, upcoming_90_days: 7, upcoming_renewed: 2 },
};

// ---------------------------------------------------------------- pagine e larghezze
const ROUTES = [
  ["home", "/", false], ["accesso", "/auth", false], ["password-dimenticata", "/forgot-password", false], ["nuova-password", "/reset-password", false],
  ["cambio-password", "/change-password", true], ["dashboard", "/dashboard", true], ["carica-pratica", "/upload", true], ["pratiche", "/practices", true], ["pratiche-per-lotto", "/practices?stage=da_lavorare", true],
  ["dettaglio-pratica", `/practices/${ids[0]}`, true], ["clienti", "/clients", true], ["dettaglio-cliente", `/clients/${CLIENTS[1].id}`, true], ["impostazioni", "/settings", true], ["utenti", "/user-management", true],
  ["amministrazione", "/administration", true], ["scadenzario", "/expiry", true], ["report", "/reports", true], ["questionari", "/questionnaires", true], ["vies", "/vies", true], ["api-docs", "/api-docs", false], ["non-trovata", "/pagina-che-non-esiste", false],
];
const VIEWPORTS = [
  { name: "telefono-360", width: 360, height: 740, touch: true, menu: "button" },
  { name: "telefono-390", width: 390, height: 844, touch: true, menu: "button" },
  { name: "ipad-768", width: 768, height: 1024, touch: true, menu: "button" },
  { name: "ipad-1024", width: 1024, height: 768, touch: true, menu: "sidebar" },
  { name: "pc-1440", width: 1440, height: 900, touch: false, menu: "sidebar" },
];
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const onlyRoutes = only ? ROUTES.filter(([name]) => only.includes(name)) : ROUTES;
const onlyViewports = process.env.VIEWPORT ? VIEWPORTS.filter((v) => process.env.VIEWPORT.split(",").includes(v.name)) : VIEWPORTS;

const browser = await chromium.launch();
async function open(viewport, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.width < 800, deviceScaleFactor: 2, locale: "it-IT" });
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method(); const p = url.pathname;
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { ...hdr, ...extra }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: hdr });
    if (p.startsWith("/auth/v1/token")) return json(session);
    if (p.startsWith("/auth/v1/user")) return json(user);
    if (p.startsWith("/auth/v1/factors") || p.includes("/mfa")) return json([]);
    if (p.includes("/rpc/")) {
      const name = p.split("/rpc/")[1];
      if (name === "has_role" || name === "mfa_satisfied" || name === "is_admin_or_service") return json(true);
      if (name in RPCS) return json(RPCS[name]);
      return json([]);
    }
    if (p.startsWith("/storage/")) return json({});
    if (!p.startsWith("/rest/v1/")) return json({});
    const table = p.replace("/rest/v1/", "");
    if (method !== "GET" && method !== "HEAD") return json([]);
    const params = [...url.searchParams.entries()];
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    let rows = [...(TABLES[table] ?? [])];
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "or", "and"].includes(k)) continue;
      if (v.startsWith("eq.")) rows = rows.filter((row) => String(row[k]) === v.slice(3));
      else if (v.startsWith("in.(")) rows = rows.filter((row) => v.slice(4, -1).split(",").includes(String(row[k])));
    }
    const countHeader = (req.headers()["prefer"] || "").includes("count=exact") ? { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${rows.length}` } : {};
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...hdr, ...countHeader } });
    if (wantsObject) return rows.length ? json(rows[0], 200, countHeader) : json({ code: "PGRST116", message: "no rows" }, 406);
    return json(rows, 200, countHeader);
  });
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, portals: [], keys: [], items: [], logs: [] }) }));
  await ctx.addInitScript(({ key, value, on }) => { try { localStorage.setItem("portal-language", "it"); if (on) localStorage.setItem(key, value); } catch { /* storage unavailable */ } }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session), on: signedIn });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e).slice(0, 160)));
  return { ctx, page };
}

/** Misure nella pagina: scorrimento orizzontale, elementi fuori schermo, controlli troppo piccoli. */
const measure = (vw) => {
  // la larghezza reale dello schermo (sul telefono il browser allarga da solo l'area di pagina se qualcosa sborda)
  const doc = document.documentElement;
  const pageOverflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw;
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  // dentro un contenitore che scorre di proposito (overflow-x: auto/scroll) non conta
  // dentro un contenitore che scorre di proposito (overflow-x: auto/scroll) non conta; se invece un
  // contenitore con overflow nascosto taglia l'elemento, il contenuto è tagliato e va segnalato
  const insideScroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const offscreen = [];
  for (const el of document.querySelectorAll("body *")) {
    if (offscreen.length >= 6) break;
    if (!visible(el) || el.closest("[data-radix-popper-content-wrapper], [role=tooltip], .toaster, [data-sonner-toaster]")) continue;
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).position === "fixed" && r.left >= vw) continue; // pannelli chiusi fuori schermo (cassetto)
    if (r.right > vw + 2 && !insideScroller(el)) offscreen.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : ""} → ${Math.round(r.right)}px: ${(el.textContent || "").trim().slice(0, 40)}`);
  }
  // bersagli tocco: pulsanti e collegamenti visibili sotto i 32 px di lato minore (soglia minima, 44 consigliata)
  const small = [];
  for (const el of document.querySelectorAll("button, a[href], [role=button], [role=checkbox], [role=tab], input:not([type=hidden])")) {
    if (small.length >= 6) break;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li, td, span, label");
    if (inline) continue;
    if (el.tagName === "A" && el.querySelector("button")) continue; // il collegamento avvolge un pulsante: il bersaglio è il pulsante
    // area di tocco allargata con un elemento ::after (caselle di selezione)
    const slop = getComputedStyle(el, "::after");
    if (slop.position === "absolute" && Math.min(parseFloat(slop.width) || 0, parseFloat(slop.height) || 0) >= 32) continue;
    if (Math.min(r.width, r.height) < 32 && !el.closest("[data-hit-slop]")) small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`);
  }
  const wide = [];
  if (pageOverflow > 1) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== "svg") continue;
      if (r.right > vw + 1 && visible(el) && getComputedStyle(el).position !== "fixed" && !el.closest("[data-sonner-toaster], .toaster, ol.fixed, header.fixed")) wide.push({ el, w: Math.round(r.right) });
    }
    wide.sort((a, b) => a.el.querySelectorAll("*").length - b.el.querySelectorAll("*").length);
  }
  const chain = (el) => { const parts = []; for (let n = el; n && n !== document.body && parts.length < 6; n = n.parentElement) parts.push(`${n.tagName.toLowerCase()}${typeof n.className === "string" && n.className ? "." + n.className.split(/\s+/)[0] : ""}`); return parts.join(" < "); };
  const widest = wide.slice(0, 2).map(({ el, w }) => chain(el) + ` → ${w}px`).concat(wide.slice(2, 4).map(({ el, w }) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.split(/\s+/).slice(0, 4).join(".") : ""} → ${w}px`));
  const crashed = /Qualcosa è andato storto|Something went wrong|出错了/.test(document.body.innerText) || !!document.querySelector("[data-testid=error-boundary]");
  const hasMenuButton = !!document.querySelector("[data-testid=mobile-menu-button]");
  const hasSidebar = !!document.querySelector("aside[data-testid=sidebar]") && getComputedStyle(document.querySelector("aside[data-testid=sidebar]")).display !== "none";
  return { pageOverflow, widest, offscreen, small, crashed, hasMenuButton, hasSidebar, textLength: document.body.innerText.length };
};

const report = [];
for (const viewport of onlyViewports) {
  for (const [name, path, signedIn] of onlyRoutes) {
    const { ctx, page } = await open(viewport, signedIn);
    let m;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(500);
      m = await page.evaluate(measure, viewport.width);
      if (AUDIT) await page.screenshot({ path: `${SHOTS}${viewport.name}-${name}.png`, fullPage: true });
    } catch (error) {
      m = { pageOverflow: 0, offscreen: [], small: [], crashed: true, hasMenuButton: false, hasSidebar: false, textLength: 0, error: String(error).slice(0, 120) };
    }
    const problems = [];
    if (m.pageOverflow > 1) problems.push(`scorre in orizzontale di ${m.pageOverflow}px (più larghi: ${(m.widest ?? []).join(" | ")})`);
    if (m.offscreen.length) problems.push(`elementi fuori schermo: ${m.offscreen.slice(0, 3).join(" | ")}`);
    if (m.crashed) problems.push(m.error ? `non si apre (${m.error})` : "pagina di errore");
    if (signedIn && !m.crashed && path !== "/change-password") {
      if (viewport.menu === "button" && !m.hasMenuButton) problems.push("manca il pulsante del menu");
      if (viewport.menu === "sidebar" && !m.hasSidebar) problems.push("manca il menu laterale");
    }
    if (page.__errors.length) problems.push(`errori JS: ${page.__errors[0]}`);
    report.push({ viewport: viewport.name, name, problems, small: m.small });
    check(`${viewport.name} · ${name}`, problems.length === 0, problems.join(" ; "));
    await ctx.close();
  }
}

// ---------------------------------------------------------------- finestre e pannelli aperti
// Cassetto del menu, campanella e finestre di dialogo devono stare dentro lo schermo (e scorrere se più alte).
const insideScreen = async (page, selector, viewport) => page.evaluate(({ selector, vw, vh }) => {
  const el = document.querySelector(selector);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const fits = r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1;
  const clipped = el.scrollWidth > el.clientWidth + 1;
  return { found: true, fits, clipped, box: `${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)} su ${vw}×${vh}` };
}, { selector, vw: viewport.width, vh: viewport.height });

const INTERACTIONS = [
  { name: "cassetto-menu", path: "/dashboard", only: "button", run: async (page) => { await page.click("[data-testid=mobile-menu-button]"); await page.waitForSelector("[data-testid=mobile-menu]"); await page.waitForTimeout(900); }, target: "[data-testid=mobile-menu]" },
  { name: "campanella", path: "/dashboard", run: async (page, viewport) => { await page.click(viewport.menu === "button" ? "[data-testid=mobile-header] [data-testid=notification-bell]" : "[data-testid=notification-bell]"); await page.waitForSelector("[data-testid=notification-panel]"); await page.waitForTimeout(300); }, target: "[data-testid=notification-panel]" },
  { name: "dialogo-cliente", path: "/clients", run: async (page) => { await page.getByRole("button", { name: /Aggiungi Cliente/ }).click(); await page.waitForSelector("[role=dialog]"); await page.waitForTimeout(400); }, target: "[role=dialog]" },
  { name: "dialogo-invito", path: "/user-management", run: async (page) => { await page.getByRole("button", { name: /Invita Utente/ }).click(); await page.waitForSelector("[role=dialog]"); await page.waitForTimeout(400); }, target: "[role=dialog]" },
];
for (const viewport of onlyViewports.filter((v) => v.width < 1500)) {
  for (const step of INTERACTIONS) {
    if (step.only && step.only !== viewport.menu) continue;
    if (only && !only.includes(step.name)) continue;
    const { ctx, page } = await open(viewport, true);
    let problem = "";
    try {
      await page.goto(`${BASE}${step.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(400);
      await step.run(page, viewport);
      const result = await insideScreen(page, step.target, viewport);
      if (AUDIT) await page.screenshot({ path: `${SHOTS}${viewport.name}-${step.name}.png` });
      if (!result.found) problem = "non si apre";
      else if (!result.fits) problem = `esce dallo schermo (${result.box})`;
      else if (result.clipped) problem = "contenuto tagliato in orizzontale";
    } catch (error) {
      problem = `errore: ${String(error).slice(0, 120)}`;
    }
    check(`${viewport.name} · ${step.name}`, !problem, problem);
    await ctx.close();
  }
}

// bersagli piccoli: solo un riepilogo (non blocca), così si vede dove migliorare
const smallByPage = report.filter((r) => r.small.length && (r.viewport.startsWith("telefono") || r.viewport.startsWith("ipad")));
if (process.env.SMALL === "1") for (const r of smallByPage) console.log(`  piccoli ${r.viewport} · ${r.name}: ${r.small.join(" | ")}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
