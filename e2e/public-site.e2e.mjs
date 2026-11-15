// The public VIES site (/, /en/, /zh/): complete HTML without JavaScript, and with it the menu, the languages,
// the way into the reserved area and the motion that never hides what the reader came for.
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const SUPA = "https://nesblhtjqiavdfsrtfom.supabase.co";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const browser = await chromium.launch();
async function open(options = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 }, ...options });
  // The reserved area is reached from the site: its services are answered here, nothing real is touched.
  const hdr = { "access-control-allow-origin": BASE, "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await ctx.route(`${SUPA}/**`, (route) => (route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: hdr }) : route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body: "[]" })));
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await ctx.newPage();
  const pageErrors = [];
  const external = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text().slice(0, 200)); });
  page.on("request", (request) => { const url = new URL(request.url()); if (url.origin !== new URL(BASE).origin && url.protocol.startsWith("http")) external.push(url.origin); });
  return { ctx, page, pageErrors, external };
}
const ANCHORS = ["cos-e", "per-chi", "come-funziona", "portale", "documenti", "costo", "domande", "contatti"];
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// 1) without JavaScript (a crawler, an answer engine): title, sections, steps, answers and contact details are there
for (const [path, lang, h1] of [["/", "it", "Fideiussione VIES per soggetti non residenti"], ["/en/", "en", "VIES guarantee in Italy for non-EU companies"], ["/zh/", "zh-Hans", "面向非欧盟企业的意大利VIES保函"]]) {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  check(`${path} senza JS: risponde 200 come HTML`, response.status() === 200 && /text\/html/.test(response.headers()["content-type"] ?? ""), String(response.status()));
  check(`${path} senza JS: lingua ${lang} e un solo H1 visibile`, (await page.getAttribute("html", "lang")) === lang && (await page.locator("h1").count()) === 1 && (await page.locator("h1").innerText()).replace(/\s+/g, " ") === h1, await page.locator("h1").innerText());
  const visible = [];
  for (const anchor of ANCHORS) if (await page.locator(`#${anchor} h2`).isVisible()) visible.push(anchor);
  check(`${path} senza JS: le otto sezioni con il loro titolo sono visibili`, visible.length === ANCHORS.length, visible.join(","));
  check(`${path} senza JS: i cinque passi sono visibili`, (await page.locator("[data-step]").count()) === 5 && (await page.locator('[data-step="5"] h3').isVisible()));
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((element) => getComputedStyle(element).opacity !== "1").length);
  check(`${path} senza JS: nessun contenuto resta nascosto in attesa di un'animazione`, hidden === 0, String(hidden));
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check(`${path} senza JS: recapiti e dati dell'intermediario nel testo`, ["vies@tecnomga.com", "06.97638088", "tecnoadvancemgabroker@legalmail.it", "B000746484", "17460381001", "Via Po, 102"].every((fact) => text.includes(fact)));
  check(`${path} senza JS: il modulo indica l'indirizzo email come alternativa`, (await page.locator("form[data-contact-form] noscript").count()) === 1 && /vies@tecnomga\.com/.test(await page.locator("form[data-contact-form]").innerText()));
  check(`${path} senza JS: la prima domanda è aperta, le altre restano nell'HTML`, (await page.locator(".faq__item[open]").count()) === 1 && (await page.locator(".faq__item").count()) >= 8);
  await ctx.close();
}

// 2) desktop, with JavaScript: nothing fails, nothing is loaded from other sites, the header leads where it says
{
  const { ctx, page, pageErrors, external } = await open();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("PC: nessun errore JavaScript", pageErrors.length === 0, pageErrors.join(" | "));
  check("PC: nessuna richiesta verso altri siti (font, script, immagini sono del sito)", external.length === 0, [...new Set(external)].join(", "));
  check("PC: le voci del menu sono in riga e il pulsante del menu non si vede", (await page.locator('[data-testid="site-nav"] a[href="#cos-e"]').isVisible()) && !(await page.locator('[data-testid="site-menu-toggle"]').isVisible()));
  check("PC: nessuno scorrimento orizzontale", (await overflow(page)) === 0);
  await page.screenshot({ path: SHOTS + "public-site-desktop.png" });

  // sections below the screen wait and then appear when reached
  const waiting = await page.locator(".is-waiting").count();
  await page.locator("#domande").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#domande .section__head")).opacity === "1", null, { timeout: 5000 }).catch(() => {});
  const faqOpacity = await page.evaluate(() => getComputedStyle(document.querySelector("#domande .section__head")).opacity);
  check("PC: le sezioni sotto lo schermo compaiono quando ci si arriva", waiting > 0 && faqOpacity === "1", `in attesa ${waiting}, opacità ${faqOpacity}`);
  check("PC: la barra segna lo scorrimento", await page.evaluate(() => document.querySelector("[data-site-header]").classList.contains("is-scrolled")));

  // a question opens with a click
  const second = page.locator(".faq__item").nth(1);
  await second.locator("summary").click();
  check("PC: una domanda si apre e mostra la risposta", (await second.getAttribute("open")) !== null && (await second.locator(".faq__a").isVisible()));

  // menu → section
  await page.locator('[data-testid="site-nav"] a[href="#documenti"]').click();
  await page.waitForFunction(() => { const top = document.getElementById("documenti").getBoundingClientRect().top; return top > 40 && top < 220; }, null, { timeout: 5000 }).catch(() => {});
  const top = await page.evaluate(() => Math.round(document.getElementById("documenti").getBoundingClientRect().top));
  check("PC: una voce del menu porta alla sua sezione, sotto la barra", /#documenti$/.test(page.url()) && top > 40 && top < 220, `top ${top}`);

  // languages
  await page.locator('[data-testid="site-lang-en"]').click();
  await page.waitForURL(`${BASE}/en/`);
  check("PC: «EN» porta a /en/ in inglese", (await page.getAttribute("html", "lang")) === "en" && (await page.locator('[data-testid="site-lang-en"]').getAttribute("aria-current")) === "page");
  await page.locator('[data-testid="site-lang-zh"]').click();
  await page.waitForURL(`${BASE}/zh/`);
  check("PC: «中文» porta a /zh/ in cinese", (await page.getAttribute("html", "lang")) === "zh-Hans" && /[一-鿿]/.test(await page.locator("h1").innerText()));
  check("PC: cinese senza scorrimento orizzontale né errori", (await overflow(page)) === 0 && pageErrors.length === 0, pageErrors.join(" | "));

  // the reserved area
  await page.locator('[data-testid="site-portal-link"]').click();
  await page.waitForURL(/\/auth$/);
  await page.waitForSelector("input[name=signin-email]", { timeout: 15000 });
  check("PC: «Area riservata» porta alla pagina di accesso del portale", /\/auth$/.test(page.url()) && (await page.locator("input[name=signin-email]").isVisible()));
  await ctx.close();
}

// 3) phone: the menu opens and closes, nothing is wider than the screen
for (const width of [360, 390]) {
  const { ctx, page, pageErrors } = await open({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(`telefono ${width}: nessuno scorrimento orizzontale`, (await overflow(page)) === 0, String(await overflow(page)));
  const toggle = page.locator('[data-testid="site-menu-toggle"]');
  const firstLink = page.locator('[data-testid="site-nav"] a[href="#cos-e"]');
  check(`telefono ${width}: il menu è chiuso all'apertura della pagina`, (await toggle.isVisible()) && !(await firstLink.isVisible()) && (await toggle.getAttribute("aria-expanded")) === "false");
  await toggle.click();
  check(`telefono ${width}: il pulsante apre il menu con sezioni e area riservata`, (await firstLink.isVisible()) && (await page.locator('[data-testid="site-portal-link"]').isVisible()) && (await toggle.getAttribute("aria-expanded")) === "true");
  check(`telefono ${width}: menu aperto senza scorrimento orizzontale`, (await overflow(page)) === 0);
  if (width === 390) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOTS + "public-site-phone-menu.png" });
  }
  await page.keyboard.press("Escape");
  check(`telefono ${width}: Esc chiude il menu`, !(await firstLink.isVisible()) && (await toggle.getAttribute("aria-expanded")) === "false");
  await toggle.click();
  await page.locator('[data-testid="site-nav"] .site-nav__list a[href="#contatti"]').click();
  await page.waitForFunction(() => !document.querySelector("[data-site-header]").classList.contains("menu-open"));
  check(`telefono ${width}: scegliere una voce chiude il menu e porta alla sezione`, /#contatti$/.test(page.url()) && !(await firstLink.isVisible()));
  for (const path of ["/en/", "/zh/"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    check(`telefono ${width} ${path}: nessuno scorrimento orizzontale`, (await overflow(page)) === 0, String(await overflow(page)));
  }
  check(`telefono ${width}: nessun errore JavaScript`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) the language notice: offered in the reader's language, never a redirect, remembered once answered
{
  const { ctx, page } = await open({ locale: "en-GB" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const notice = page.locator('[data-lang-notice="en"]');
  check("avviso lingua: a un browser inglese sulla pagina italiana si propone l'inglese, senza reindirizzare", (await notice.isVisible()) && /available in English/.test(await notice.innerText()) && new URL(page.url()).pathname === "/" && !(await page.locator('[data-lang-notice="zh"]').isVisible()));
  await notice.locator("[data-lang-dismiss]").click();
  await page.reload({ waitUntil: "networkidle" });
  check("avviso lingua: chiuso una volta, non torna", !(await notice.isVisible()));
  await ctx.close();
}
{
  const { ctx, page } = await open({ locale: "it-IT" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("avviso lingua: nessun avviso a chi legge nella propria lingua", (await page.locator("[data-lang-notice]:visible").count()) === 0);
  await page.locator('[data-testid="site-lang-en"]').click();
  await page.waitForURL(`${BASE}/en/`);
  await page.waitForLoadState("networkidle");
  check("avviso lingua: chi sceglie una lingua dalla barra non viene richiamato alla propria", (await page.locator("[data-lang-notice]:visible").count()) === 0);
  await ctx.close();
}

// 5) «reduce motion»: nothing waits for an animation, the page is all there
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const state = await page.evaluate(() => ({
    waiting: document.querySelectorAll(".is-waiting").length,
    running: document.getAnimations().filter((animation) => animation.playState === "running").length,
    footer: getComputedStyle(document.querySelector("#contatti .section__head")).opacity,
  }));
  check("riduci movimento: nessun contenuto in attesa, nessuna animazione in corso", state.waiting === 0 && state.running === 0 && state.footer === "1", JSON.stringify(state));
  await ctx.close();
}

// 6) the legal pages share header and footer, and their menu goes back to the home page sections
{
  const { ctx, page, pageErrors } = await open();
  await page.goto(`${BASE}/en/privacy/`, { waitUntil: "networkidle" });
  check("pagina privacy: un H1 e il menu che torna alle sezioni della homepage inglese", (await page.locator("h1").count()) === 1 && (await page.locator('[data-testid="site-nav"] a[href="/en/#cos-e"]').count()) === 1);
  check("pagina privacy: nessun errore JavaScript", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 7) the contact form: what is missing is said field by field, a request is sent once, the outcome is announced
const fill = async (page) => {
  await page.locator("#contact-name").fill("Anna Rossi");
  await page.locator("#contact-company").fill("Studio Rossi");
  await page.locator("#contact-role").selectOption("fiscal_representative");
  await page.locator("#contact-country").fill("Italia");
  await page.locator("#contact-email").fill("anna@example.test");
  await page.locator("#contact-message").fill("Vorremmo una quotazione per venti società.");
  await page.locator("#contact-consent").check();
};
const contactRoute = async (ctx, answer) => {
  const calls = [];
  await ctx.route(`${BASE}/api/contact`, async (route) => {
    calls.push({ method: route.request().method(), type: route.request().headers()["content-type"], body: route.request().postDataJSON() });
    await route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) });
  });
  return calls;
};
{
  const { ctx, page, pageErrors } = await open();
  const calls = await contactRoute(ctx, { status: 200, body: { ok: true } });
  await page.goto(`${BASE}/#contatti`, { waitUntil: "networkidle" });
  const form = page.locator("form[data-contact-form]");
  const status = form.locator("[data-form-status]");

  await form.locator("button[type=submit]").click();
  const invalid = await form.locator('[aria-invalid="true"]').evaluateAll((fields) => fields.map((field) => field.getAttribute("name")));
  check("modulo: inviato vuoto non parte nessuna richiesta e ogni campo obbligatorio è segnalato", calls.length === 0 && invalid.sort().join() === "company,consent,country,email,message,name,role", invalid.join());
  check("modulo: il messaggio sotto il campo dice cosa manca, e lo stato lo annuncia", (await form.locator("#contact-name-error").innerText()) === "Campo obbligatorio." && (await status.innerText()) === "Controlla i campi evidenziati." && (await status.getAttribute("aria-live")) === "polite");
  check("modulo: il primo campo da correggere riceve il fuoco", await page.evaluate(() => document.activeElement?.id === "contact-name"));
  await page.locator("#contact-email").fill("anna@");
  await page.locator("#contact-name").fill("Anna Rossi");
  check("modulo: correggendo un campo il suo errore sparisce", (await form.locator("#contact-name-error").count()) === 0 && (await page.locator("#contact-name").getAttribute("aria-invalid")) === null);
  await form.locator("button[type=submit]").click();
  check("modulo: un indirizzo scritto male è segnalato come tale", (await form.locator("#contact-email-error").innerText()) === "Indirizzo email non valido." && calls.length === 0);

  await fill(page);
  await page.screenshot({ path: SHOTS + "public-site-contact.png" });
  await form.locator("button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "success", null, { timeout: 5000 });
  const sent = calls[0] ?? {};
  check("modulo: una sola richiesta, in JSON, verso /api/contact", calls.length === 1 && sent.method === "POST" && /^application\/json/.test(sent.type ?? ""), JSON.stringify(calls).slice(0, 200));
  check("modulo: partono i campi scritti, la lingua, la pagina, il campo trappola vuoto e il tempo impiegato", sent.body?.name === "Anna Rossi" && sent.body?.role === "fiscal_representative" && sent.body?.consent === true && sent.body?.lang === "it" && sent.body?.page === "/" && sent.body?.website === "" && typeof sent.body?.elapsedMs === "number" && sent.body.elapsedMs > 0, JSON.stringify(sent.body));
  check("modulo: a invio riuscito compare la conferma e il modulo si svuota", /Richiesta inviata/.test(await status.innerText()) && (await page.locator("#contact-name").inputValue()) === "" && !(await form.locator("button[type=submit]").isDisabled()));
  check("modulo: nessun errore JavaScript", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open();
  const calls = await contactRoute(ctx, { status: 500, body: { ok: false, error: "unavailable" } });
  await page.goto(`${BASE}/en/#contatti`, { waitUntil: "networkidle" });
  const form = page.locator("form[data-contact-form]");
  await fill(page);
  await form.locator("button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "error", null, { timeout: 5000 });
  check("modulo, errore del server: chi scrive lo sa, trova l'indirizzo email e non perde ciò che ha scritto", /vies@tecnomga\.com/.test(await form.locator("[data-form-status]").innerText()) && (await page.locator("#contact-message").inputValue()).startsWith("Vorremmo") && !(await form.locator("button[type=submit]").isDisabled()));
  check("modulo, pagina inglese: la richiesta porta lingua e pagina inglesi", calls[0]?.body?.lang === "en" && calls[0]?.body?.page === "/en/", JSON.stringify(calls[0]?.body));
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await contactRoute(ctx, { status: 400, body: { ok: false, error: "invalid", fields: ["email"] } });
  await page.goto(`${BASE}/#contatti`, { waitUntil: "networkidle" });
  const form = page.locator("form[data-contact-form]");
  await fill(page);
  await form.locator("button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "invalid", null, { timeout: 5000 });
  check("modulo, campo rifiutato dal server: il campo è segnalato", (await page.locator("#contact-email").getAttribute("aria-invalid")) === "true" && (await form.locator("#contact-email-error").count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await ctx.route(`${BASE}/api/contact`, (route) => route.abort("failed"));
  await page.goto(`${BASE}/#contatti`, { waitUntil: "networkidle" });
  await fill(page);
  await page.locator("form[data-contact-form] button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "error", null, { timeout: 5000 });
  check("modulo, rete assente: compare l'errore con l'indirizzo email", /vies@tecnomga\.com/.test(await page.locator("[data-form-status]").innerText()));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
