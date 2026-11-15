// The public VIES site (/, /en/, /zh/): complete HTML without JavaScript, and with it the menu, the languages,
// the way into the reserved area and the motion that never hides what the reader came for.
import { chromium } from "playwright";
const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:5300";
const SHOTS = new URL("./artifacts/", import.meta.url).pathname;
const SUPA = "https://nesblhtjqiavdfsrtfom.supabase.co";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const browser = await chromium.launch();
const GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|google\.com|google\.it)\//;
const REFUSED = JSON.stringify({ statistics: false, marketing: false, decidedAt: new Date().toISOString() });
/** `consent`: "refused" (default: the cookie banner stays out of the way), "ask" (first visit, no choice yet). */
async function open({ consent = "refused", ...options } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 }, ...options });
  // Google's addresses are answered here and counted: nothing real is contacted.
  const google = [];
  await ctx.route(GOOGLE, (route) => { google.push(route.request().url()); return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* e2e */" }); });
  if (consent === "refused") await ctx.addInitScript((value) => { try { if (!localStorage.getItem("tecno-consent-v1")) localStorage.setItem("tecno-consent-v1", value); } catch { /* storage unavailable */ } }, REFUSED);
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
  return { ctx, page, pageErrors, external, google };
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
  check(`${path} senza JS: il banner dei cookie non compare (nessuno script, nessuna scelta da fare)`, !(await page.locator("[data-cookie-banner]").isVisible()));
  check(`${path} senza JS: la prima domanda è aperta, le altre restano nell'HTML`, (await page.locator(".faq__item[open]").count()) === 1 && (await page.locator(".faq__item").count()) >= 8);
  await ctx.close();
}

// 2) desktop, with JavaScript: nothing fails, nothing is loaded from other sites, the header leads where it says
{
  const { ctx, page, pageErrors, external } = await open();
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("PC: nessun errore JavaScript", pageErrors.length === 0, pageErrors.join(" | "));
  check("PC: nessuna richiesta verso altri siti (font, script, immagini sono del sito)", external.length === 0, [...new Set(external)].join(", "));
  check("PC: le voci del menu sono in riga e il pulsante del menu non si vede", (await page.locator('[data-testid="site-nav"] a[href="#cos-e"]').isVisible()) && !(await page.locator('[data-testid="site-menu-toggle"]').isVisible()));
  check("PC: nessuno scorrimento orizzontale", (await overflow(page)) === 0);
  await page.waitForFunction(() => document.querySelector("video[data-hero-video] source")?.getAttribute("src"), null, { timeout: 5000 }).catch(() => {});
  const hero = await page.evaluate(() => { const video = document.querySelector("video[data-hero-video]"); return { sources: [...video.querySelectorAll("source")].map((source) => source.getAttribute("src")), poster: video.getAttribute("poster"), muted: video.muted }; });
  check("PC: a pagina pronta il video dell'apertura viene caricato dallo script, muto, con l'immagine fissa sotto", hero.sources.join() === "/site-media/vies-vetro-apertura.webm,/site-media/vies-vetro-apertura.mp4" && hero.poster === "/site-media/vies-vetro-apertura.webp" && hero.muted === true && requested.some((url) => url.endsWith("/site-media/vies-vetro-apertura.webm") || url.endsWith("/site-media/vies-vetro-apertura.mp4")), JSON.stringify(hero));
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
  const videos = [];
  page.on("request", (request) => { if (/\.(webm|mp4)(\?|$)/.test(request.url())) videos.push(request.url()); });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("riduci movimento: il video dell'apertura non viene nemmeno scaricato, resta l'immagine fissa", videos.length === 0 && (await page.evaluate(() => [...document.querySelectorAll("video[data-hero-video] source")].every((source) => !source.getAttribute("src")))), videos.join(", "));
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

// 8) cookies: nothing of Google before the choice or after a refusal; the choice is remembered and can be changed
const layer = (page) => page.evaluate(() => (window.dataLayer ?? []).map((entry) => Array.from(entry)));
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tecno-consent-v1") ?? "null"));
const banner = (page) => page.locator("[data-cookie-banner]");
{
  const { ctx, page, google, pageErrors } = await open({ consent: "ask" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const buttons = await banner(page).locator(".cookie-banner__actions button:visible").allInnerTexts();
  check("cookie, prima visita: il banner propone Accetta, Rifiuta e Personalizza", (await banner(page).isVisible()) && buttons.join("|") === "Accetta|Rifiuta|Personalizza", buttons.join("|"));
  const sizes = await banner(page).locator(".cookie-banner__actions button:visible").evaluateAll((items) => items.map((item) => { const style = getComputedStyle(item); return `${style.backgroundColor}/${style.color}/${style.fontSize}/${style.fontWeight}`; }));
  check("cookie, prima visita: i tre pulsanti hanno lo stesso aspetto", new Set(sizes).size === 1, sizes.join(" · "));
  check("cookie, prima della scelta: nessuna richiesta a Google e nessuno script di misurazione", google.length === 0 && (await page.evaluate(() => typeof window.dataLayer)) === "undefined" && (await page.locator('script[src*="googletagmanager"]').count()) === 0, google.join(", "));
  check("cookie, prima della scelta: «Preferenze cookie» è già nel piè di pagina, per chi vuole decidere da lì", (await page.locator("[data-cookie-preferences-item]").getAttribute("hidden")) === null);
  await page.screenshot({ path: SHOTS + "public-site-cookie-banner.png" });

  await banner(page).locator('[data-consent="reject"]').click();
  await page.waitForTimeout(400);
  check("cookie, «Rifiuta»: il banner si chiude, la scelta è salvata, nessuna richiesta a Google", !(await banner(page).isVisible()) && (await stored(page))?.statistics === false && (await stored(page))?.marketing === false && google.length === 0, JSON.stringify(await stored(page)));
  await page.reload({ waitUntil: "networkidle" });
  check("cookie, dopo il rifiuto: al ricaricamento il banner non torna e Google non viene contattato", !(await banner(page).isVisible()) && google.length === 0, google.join(", "));

  // the choice can be changed from the footer
  const preferences = page.locator("[data-cookie-preferences]");
  await preferences.scrollIntoViewIfNeeded();
  check("cookie: «Preferenze cookie» è nel piè di pagina", (await preferences.isVisible()) && (await preferences.innerText()) === "Preferenze cookie");
  await preferences.click();
  check("cookie, «Preferenze cookie»: riapre il banner con le categorie e la scelta fatta", (await banner(page).isVisible()) && (await banner(page).locator('input[name="statistics"]').isVisible()) && !(await banner(page).locator('input[name="statistics"]').isChecked()) && !(await banner(page).locator('input[name="marketing"]').isChecked()) && (await banner(page).locator('input[disabled]').isChecked()));

  // statistics only
  await banner(page).locator('input[name="statistics"]').check();
  await banner(page).locator('[data-consent="save"]').click();
  await page.waitForFunction(() => document.querySelector('script[src*="googletagmanager"]') !== null, null, { timeout: 5000 }).catch(() => {});
  const scripts = await page.locator('script[src*="googletagmanager"]').evaluateAll((items) => items.map((item) => item.getAttribute("src")));
  const entries = await layer(page);
  const consentCalls = entries.filter((entry) => entry[0] === "consent");
  check("cookie, solo statistiche: parte lo script di Google con l'identificativo di Analytics", scripts.length === 1 && scripts[0] === "https://www.googletagmanager.com/gtag/js?id=G-E2ETEST001" && google.some((url) => url.includes("gtag/js?id=G-E2ETEST001")), scripts.join(", "));
  check("cookie, solo statistiche: a Google si dice prima «negato a tutto», poi statistiche sì e pubblicità no", consentCalls.length === 2 && consentCalls[0][1] === "default" && Object.values(consentCalls[0][2]).every((value) => value === "denied") && consentCalls[1][1] === "update" && consentCalls[1][2].analytics_storage === "granted" && consentCalls[1][2].ad_storage === "denied" && consentCalls[1][2].ad_user_data === "denied" && consentCalls[1][2].ad_personalization === "denied", JSON.stringify(consentCalls));
  const configs = entries.filter((entry) => entry[0] === "config").map((entry) => entry[1]);
  check("cookie, solo statistiche: si configura Analytics e non Ads", configs.join() === "G-E2ETEST001", configs.join());

  // refusing again withdraws the consent and removes Google's cookies kept by the site
  await page.evaluate(() => { document.cookie = "_ga=GA1.1.e2e; path=/"; document.cookie = "_ga_E2ETEST001=GS1.1.e2e; path=/"; document.cookie = "altro=resta; path=/"; });
  await preferences.click();
  check("cookie, «Preferenze cookie» dopo un consenso: la casella delle statistiche è spuntata", await banner(page).locator('input[name="statistics"]').isChecked());
  await banner(page).locator('[data-consent="reject"]').click();
  await page.waitForTimeout(300);
  const after = await layer(page);
  const last = after.filter((entry) => entry[0] === "consent").pop();
  const cookies = await page.evaluate(() => document.cookie);
  check("cookie, consenso revocato: a Google si dice «negato», i suoi cookie sono cancellati e gli altri restano", last?.[1] === "update" && Object.values(last[2]).every((value) => value === "denied") && !/_ga/.test(cookies) && /altro=resta/.test(cookies), `${JSON.stringify(last)} · ${cookies}`);
  check("cookie: nessun errore JavaScript", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, google } = await open({ consent: "ask" });
  const calls = await contactRoute(ctx, { status: 200, body: { ok: true } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await banner(page).locator('[data-consent="accept"]').click();
  await page.waitForFunction(() => document.querySelector('script[src*="googletagmanager"]') !== null, null, { timeout: 5000 }).catch(() => {});
  const entries = await layer(page);
  const update = entries.filter((entry) => entry[0] === "consent").pop();
  check("cookie, «Accetta»: statistiche e pubblicità concesse, Analytics e Ads configurati, uno script solo", update?.[1] === "update" && Object.values(update[2]).every((value) => value === "granted") && entries.filter((entry) => entry[0] === "config").map((entry) => entry[1]).join() === "G-E2ETEST001,AW-1234567890" && (await page.locator('script[src*="googletagmanager"]').count()) === 1 && (await stored(page))?.marketing === true, JSON.stringify(update));
  await page.reload({ waitUntil: "networkidle" });
  check("cookie, dopo «Accetta»: al ricaricamento il banner non torna e la misurazione riparte da sola", !(await banner(page).isVisible()) && (await page.locator('script[src*="googletagmanager"]').count()) === 1 && google.filter((url) => url.includes("gtag/js")).length === 2);
  await page.locator("#contatti").scrollIntoViewIfNeeded();
  await fill(page);
  await page.locator("form[data-contact-form] button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "success", null, { timeout: 5000 });
  const events = (await layer(page)).filter((entry) => entry[0] === "event");
  check("cookie, con consenso: una richiesta inviata è contata come contatto (Analytics) e come conversione (Ads)", calls.length === 1 && events.some((entry) => entry[1] === "generate_lead") && events.some((entry) => entry[1] === "conversion" && entry[2]?.send_to === "AW-1234567890/e2eLabel_1"), JSON.stringify(events));
  await ctx.close();
}
{
  const { ctx, page, google } = await open({ consent: "ask" });
  await contactRoute(ctx, { status: 200, body: { ok: true } });
  await page.goto(`${BASE}/en/`, { waitUntil: "networkidle" });
  check("cookie, pagina inglese: il banner è in inglese", (await banner(page).locator(".cookie-banner__actions button:visible").allInnerTexts()).join("|") === "Accept|Reject|Customise");
  await banner(page).locator('[data-consent="close"]').click();
  await page.waitForTimeout(300);
  check("cookie, chiusura con la X: vale come rifiuto", !(await banner(page).isVisible()) && (await stored(page))?.statistics === false && (await stored(page))?.marketing === false && google.length === 0);
  await page.locator("#contatti").scrollIntoViewIfNeeded();
  await fill(page);
  await page.locator("form[data-contact-form] button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-form-status]").dataset.state === "success", null, { timeout: 5000 });
  check("cookie, senza consenso: una richiesta inviata non dice nulla a Google", google.length === 0 && (await page.evaluate(() => typeof window.dataLayer)) === "undefined", google.join(", "));
  await ctx.close();
}
{
  // an old choice is asked again
  const { ctx, page, google } = await open({ consent: "ask" });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("e2e-old")) { localStorage.setItem("tecno-consent-v1", JSON.stringify({ statistics: true, marketing: true, decidedAt: new Date(Date.now() - 181 * 86400000).toISOString() })); sessionStorage.setItem("e2e-old", "1"); } } catch { /* storage unavailable */ } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("cookie, scelta più vecchia di sei mesi: si chiede di nuovo e nel frattempo nulla parte verso Google", (await banner(page).isVisible()) && google.length === 0, google.join(", "));
  await ctx.close();
}
{
  // the language notice waits for the cookie choice: one thing at a time at the bottom of the screen
  const { ctx, page } = await open({ consent: "ask", locale: "en-GB" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const notice = page.locator('[data-lang-notice="en"]');
  check("cookie e lingua: finché il banner è aperto l'avviso della lingua aspetta", (await banner(page).isVisible()) && !(await notice.isVisible()));
  await banner(page).locator('[data-consent="reject"]').click();
  await page.waitForTimeout(300);
  check("cookie e lingua: fatta la scelta compare l'avviso della lingua", await notice.isVisible());
  await ctx.close();
}
{
  const { ctx, page } = await open({ consent: "ask", viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/zh/`, { waitUntil: "networkidle" });
  const box = await banner(page).boundingBox();
  check("cookie, telefono 360: il banner sta nello schermo senza scorrimento orizzontale", (await banner(page).isVisible()) && box.x >= 0 && box.x + box.width <= 360 && box.y + box.height <= 740 && (await overflow(page)) === 0, JSON.stringify(box));
  await banner(page).locator('[data-consent="customise"]').click();
  const open2 = await banner(page).boundingBox();
  check("cookie, telefono 360: anche con le categorie aperte il banner sta nello schermo e si può salvare", open2.y >= 0 && open2.y + open2.height <= 740 && (await banner(page).locator('[data-consent="save"]').isVisible()), JSON.stringify(open2));
  await page.screenshot({ path: SHOTS + "public-site-cookie-phone.png" });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length ? 1 : 0);
