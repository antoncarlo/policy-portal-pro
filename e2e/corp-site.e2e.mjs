// The corporate site (tecnomga.com): complete HTML without JavaScript; with it the menu, the language switch, the
// cookie banner with a single consent, and liquid-glass surfaces that stay readable. Nothing real is contacted.
import { chromium } from "playwright";
const BASE = process.env.E2E_CORP_BASE ?? "http://127.0.0.1:5301";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const browser = await chromium.launch();
const GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com|google\.it)\//;
const REFUSED = JSON.stringify({ statistics: false, marketing: false, decidedAt: new Date().toISOString() });
/**
 * `consent`: "refused" (default: the cookie banner stays out of the way), "ask" (first visit, no choice yet).
 * `intro`: false (default: as for someone who comes from another page of the site, so the animated opening of the
 * home page does not play and the checks see the page still), true (a first arrival: the opening plays).
 */
async function open({ consent = "refused", intro = false, ...options } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 }, ...options });
  if (!intro) await ctx.addInitScript(() => { try { Object.defineProperty(document, "referrer", { configurable: true, get: () => `${location.origin}/privacy/` }); } catch { /* the page decides by itself */ } });
  const google = [];
  await ctx.route(GOOGLE, (route) => { google.push(route.request().url()); return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* e2e */" }); });
  if (consent === "refused") await ctx.addInitScript((value) => { try { if (!localStorage.getItem("tecno-consent-v1")) localStorage.setItem("tecno-consent-v1", value); } catch { /* storage unavailable */ } }, REFUSED);
  const page = await ctx.newPage();
  const pageErrors = [];
  const external = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text().slice(0, 200)); });
  page.on("request", (request) => { const url = new URL(request.url()); if (url.origin !== new URL(BASE).origin && url.protocol.startsWith("http")) external.push(url.origin); });
  return { ctx, page, pageErrors, external, google };
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// 1) without JavaScript (a crawler, an answer engine): the page is all there
for (const [path, lang] of [["/", "it"], ["/en/", "en"], ["/privacy/", "it"], ["/en/cookie/", "en"]]) {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  check(`${path} senza JS: risponde 200 come HTML`, response.status() === 200 && /text\/html/.test(response.headers()["content-type"] ?? ""), String(response.status()));
  check(`${path} senza JS: lingua ${lang} e un solo H1 visibile`, (await page.getAttribute("html", "lang")) === lang && (await page.locator("h1").count()) === 1 && (await page.locator("h1").isVisible()));
  const footer = await page.locator("footer").innerText();
  check(`${path} senza JS: nel pie' di pagina RUI, sede legale e reclami`, /B000746484/.test(footer) && /Via Po, 102/.test(footer) && /info@tecnomga\.com/.test(footer), footer.slice(0, 200));
  check(`${path} senza JS: la pagina dice ai motori di non indicizzare l'indirizzo di prova`, (await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow");
  await ctx.close();
}

// 2) a path that is not of the site is not found (no application shell behind it)
{
  const { ctx, page } = await open();
  const response = await page.goto(`${BASE}/zh/`, { waitUntil: "load" });
  check("un percorso che non e' del sito risponde «non trovato»", response.status() === 404, String(response.status()));
  const robots = await (await page.request.get(`${BASE}/robots.txt`)).text();
  check("robots.txt dell'indirizzo di prova chiude a tutti i motori", /^User-agent: \*\nDisallow: \/\n$/.test(robots), robots);
  await ctx.close();
}

// 3) phone: nothing wider than the screen, the menu opens and closes
for (const width of [360, 390]) {
  const { ctx, page, pageErrors } = await open({ viewport: { width, height: 800 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(`telefono ${width}: la pagina non esce dal bordo`, (await overflow(page)) === 0, String(await overflow(page)));
  const toggle = page.locator(".menu-toggle");
  check(`telefono ${width}: il menu parte chiuso`, (await toggle.getAttribute("aria-expanded")) === "false" && !(await page.locator("#site-menu").isVisible()));
  await toggle.click();
  check(`telefono ${width}: il pulsante apre il menu`, (await toggle.getAttribute("aria-expanded")) === "true" && (await page.locator("#site-menu a").first().isVisible()));
  check(`telefono ${width}: a menu aperto la pagina non esce dal bordo`, (await overflow(page)) === 0);
  await page.keyboard.press("Escape");
  check(`telefono ${width}: Esc chiude il menu`, (await toggle.getAttribute("aria-expanded")) === "false");
  check(`telefono ${width}: nessun errore JS`, pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 4) desktop: the bar is a sheet of liquid glass and holds everything on one line
{
  const { ctx, page, pageErrors, external } = await open();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const glass = await page.evaluate(() => {
    const bar = document.querySelector(".site-header__bar");
    const style = getComputedStyle(bar);
    return { blur: style.backdropFilter || style.webkitBackdropFilter || "", toggle: getComputedStyle(document.querySelector(".menu-toggle")).display, height: Math.round(bar.getBoundingClientRect().height) };
  });
  check("la barra e' una lastra di vetro che sfoca lo sfondo", /blur\(/.test(glass.blur), JSON.stringify(glass));
  check("su PC il menu e' in linea, senza pulsante", glass.toggle === "none" && glass.height < 80, JSON.stringify(glass));
  check("nessuna richiesta verso l'esterno senza consenso", external.length === 0, [...new Set(external)].join(", "));
  // the language switch keeps the page
  await page.goto(`${BASE}/privacy/`, { waitUntil: "networkidle" });
  await page.click('.lang-switch a[lang="en"]');
  await page.waitForURL(`${BASE}/en/privacy/`);
  check("il cambio lingua porta alla stessa pagina in inglese", (await page.getAttribute("html", "lang")) === "en");
  // from an inner page the menu goes back to the sections of the home page
  check("dalle pagine interne il menu torna alla homepage", (await page.locator('.site-nav__list a[href="/en/#prodotti"]').count()) === 1);
  check("nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 5) cookie banner: one consent, nothing loads before it, a refusal stays a refusal
{
  const { ctx, page, google, pageErrors } = await open({ consent: "ask" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const banner = page.locator("[data-cookie-banner]");
  check("alla prima visita compare il banner dei cookie", await banner.isVisible());
  check("il banner ha solo «Accetta» e «Rifiuta», dello stesso peso", (await banner.locator('[data-consent="accept"], [data-consent="reject"]').count()) === 2 && (await banner.locator('[data-consent="accept"]').getAttribute("class")) === (await banner.locator('[data-consent="reject"]').getAttribute("class")));
  check("prima della scelta non parte nulla verso Google", google.length === 0, google.join(", "));
  await banner.locator('[data-consent="reject"]').click();
  await page.waitForTimeout(300);
  check("dopo «Rifiuta» il banner si chiude e non parte nulla verso Google", !(await banner.isVisible()) && google.length === 0, google.join(", "));
  const preferences = page.locator("[data-cookie-preferences]");
  check("nel pie' di pagina compare «Preferenze sui cookie»", await preferences.isVisible());
  await preferences.click();
  check("«Preferenze sui cookie» riapre il banner", await banner.isVisible());
  await banner.locator('[data-consent="accept"]').click();
  await page.waitForTimeout(600);
  check("dopo «Accetta» parte lo strumento di misurazione", google.some((url) => url.includes("googletagmanager.com/gtag/js")), google.join(", "));
  check("nessun errore JS con il banner", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}

// 6) reduced motion: nothing waits hidden for a scroll
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("con «riduci movimento» nessun contenuto resta nascosto in attesa", (await page.locator(".is-waiting").count()) === 0);
  await ctx.close();
}

// 7) home page: every section is in the HTML, the product cards are glass, the opening shows its still image
{
  const { ctx, page } = await open({ javaScriptEnabled: false });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const sections = await page.locator("main section[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
  check("homepage senza JS: le sezioni ci sono tutte e in ordine", sections.join(",") === "apertura,prodotti,broker,fondatori,compagnie,come-funziona,preventivo", sections.join(","));
  check("homepage senza JS: undici prodotti, sei in evidenza", (await page.locator("[data-product]").count()) === 11 && (await page.locator(".product-card--featured").count()) === 6);
  check("homepage senza JS: i prodotti si leggono anche senza movimento", await page.locator('[data-product="infortuni-malattia"] h3').isVisible());
  const text = await page.locator("main").innerText();
  const altNames = await page.locator("#compagnie img").evaluateAll((nodes) => nodes.map((img) => img.getAttribute("alt")));
  check("homepage senza JS: la frase sui soci fondatori e le societa' con il loro nome", /Anton Carlo Santoro e Barbara Santoro/.test(text) && /Vittoria hub/.test(text) && altNames.join(",") === "Generali,AXA,Vittoria,Helpet,Markel", altNames.join(","));
  check("homepage senza JS: nessun prezzo e nessun tempo di emissione", !/€|\beuro\b/i.test(text) && !/\b\d+\s*(ore|minuti|giorni)\b/i.test(text), text.match(/.{0,30}(€|\beuro\b|\d+\s*(ore|minuti|giorni)).{0,30}/i)?.[0] ?? "");
  await ctx.close();
}
{
  const { ctx, page, pageErrors, external } = await open();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const poster = await page.locator(".hero__poster").evaluate((img) => ({ loaded: img.complete && img.naturalWidth > 0, width: img.getAttribute("width"), height: img.getAttribute("height"), alt: img.getAttribute("alt") ?? "" }));
  check("homepage: l'immagine ferma dell'apertura e' caricata, con dimensioni e testo alternativo", poster.loaded && Number(poster.width) > 0 && Number(poster.height) > 0 && poster.alt.length > 10, JSON.stringify(poster));
  await page.locator("#compagnie").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll("#compagnie img")].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 5000 }).catch(() => {});
  const logos = await page.locator("#compagnie img").evaluateAll((nodes) => nodes.map((img) => ({ alt: img.alt, loaded: img.complete && img.naturalWidth > 0, sharp: img.naturalWidth >= img.getBoundingClientRect().width * 2 - 1 })));
  check("homepage: i cinque loghi delle societa' sono caricati, nitidi e con il nome come testo alternativo", logos.map((logo) => logo.alt).join(",") === "Generali,AXA,Vittoria,Helpet,Markel" && logos.every((logo) => logo.loaded && logo.sharp), JSON.stringify(logos));
  check("homepage: i loghi stanno su fondo bianco", (await page.locator("#compagnie").evaluate((node) => getComputedStyle(node).backgroundColor)) === "rgb(255, 255, 255)");
  const card = await page.locator('[data-product="fideiussioni"]').evaluate((node) => {
    const style = getComputedStyle(node);
    return { blur: style.backdropFilter || style.webkitBackdropFilter || "", glow: node.hasAttribute("data-glow"), portal: node.querySelector('a[href="https://portale.tecnomga.com/"]') !== null };
  });
  check("homepage: il riquadro delle fideiussioni e' di vetro e porta al portale VIES", /blur\(/.test(card.blur) && card.glow && card.portal, JSON.stringify(card));
  const portalLinks = await page.locator('main a[href^="https://portale.tecnomga.com"]').count();
  check("homepage: il rimando al portale VIES sta solo nel riquadro delle fideiussioni", portalLinks === 1, String(portalLinks));
  await page.locator('[data-product="car"] a[data-quote-product]').click();
  await page.waitForTimeout(400);
  check("homepage: «Chiedi un preventivo» porta alla sezione del preventivo", new URL(page.url()).hash === "#preventivo" && (await page.locator("#preventivo").isVisible()));
  // Each waiting element is brought on screen, as a reader scrolling the page would, and must appear: a fast
  // programmatic scroll can pass an element between two frames of the browser, which no reader does.
  let stuck = "";
  for (let guard = 0; guard < 60; guard += 1) {
    const next = await page.$(".is-waiting");
    if (!next) break;
    await next.scrollIntoViewIfNeeded();
    const appeared = await next.evaluate((node) => new Promise((resolve) => {
      const until = Date.now() + 3000;
      const tick = () => (!node.classList.contains("is-waiting") ? resolve(true) : Date.now() > until ? resolve(false) : requestAnimationFrame(tick));
      tick();
    }));
    if (!appeared) { stuck = await next.evaluate((node) => `${node.tagName.toLowerCase()}.${node.className}`); break; }
  }
  check("homepage: ogni contenuto compare quando arriva sullo schermo", !stuck && (await page.locator(".is-waiting").count()) === 0, stuck || String(await page.locator(".is-waiting").count()));
  check("homepage: nessuna richiesta verso l'esterno", external.length === 0, [...new Set(external)].join(", "));
  check("homepage: nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
// 8) quote form: an empty form does not leave; a filled one goes to the portal as JSON with site, product and language
{
  const ENDPOINT = "https://portale.tecnomga.com/api/contact";
  const cors = { "access-control-allow-origin": new URL(BASE).origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Content-Type", vary: "Origin" };
  const { ctx, page, pageErrors } = await open();
  const calls = [];
  let answer = { status: 200, body: { ok: true } };
  await ctx.route(ENDPOINT, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls.push({ method: request.method(), type: request.headers()["content-type"], body: request.postDataJSON() });
    return route.fulfill({ status: answer.status, contentType: "application/json", headers: cors, body: JSON.stringify(answer.body) });
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const form = page.locator("form[data-quote-form]");
  const submit = form.locator("button[type=submit]");
  const status = form.locator("[data-form-status]");
  check("preventivo: il modulo punta al portale e con lo script il pulsante si accende", (await form.getAttribute("action")) === ENDPOINT && (await submit.isEnabled()));
  await page.evaluate(() => { window.__leads = 0; document.addEventListener("tecno:lead", () => { window.__leads += 1; }); });

  await submit.click();
  await page.waitForTimeout(200);
  const invalid = await form.locator('[aria-invalid="true"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("name")));
  check("preventivo: vuoto non parte e segna nome, email, messaggio e consenso", calls.length === 0 && invalid.join(",") === "name,email,message,consent", `${calls.length} ${invalid.join(",")}`);
  check("preventivo: vuoto dice di controllare i campi e porta al primo", (await status.innerText()) === "Controlla i campi evidenziati." && (await page.evaluate(() => document.activeElement?.getAttribute("name"))) === "name");
  check("preventivo: ogni errore e' scritto sotto il suo campo e collegato al campo", (await form.locator(".field__error").count()) === 4 && (await form.locator('[name="email"]').getAttribute("aria-describedby")) === "quote-email-error" && (await form.locator("#quote-email-error").innerText()) === "Campo obbligatorio.");

  // the product card fills the product in
  await page.locator('[data-product="car"] a[data-quote-product]').click();
  check("preventivo: «Chiedi un preventivo» su un prodotto lo sceglie nel modulo", (await form.locator('[name="product"]').inputValue()) === "car");
  await form.locator('[name="name"]').fill("  Marco   Bianchi ");
  check("preventivo: correggendo un campo il suo errore sparisce", (await form.locator('[name="name"]').getAttribute("aria-invalid")) === null && (await form.locator(".field__error").count()) === 3);
  await form.locator('[name="email"]').fill("marco@");
  await form.locator('[name="message"]').fill("Vorrei un preventivo per un cantiere a Roma.");
  await form.locator('[name="consent"]').check();
  await submit.click();
  await page.waitForTimeout(200);
  check("preventivo: un indirizzo email scritto male e' segnalato e non parte nulla", calls.length === 0 && (await form.locator("#quote-email-error").innerText()) === "Indirizzo email non valido.");
  await form.locator('[name="email"]').fill("marco@example.test");
  await page.waitForTimeout(3100);
  await submit.click();
  await page.waitForFunction(() => document.querySelector("form[data-quote-form] [data-form-status]")?.getAttribute("data-state") === "success", null, { timeout: 5000 }).catch(() => {});
  const sent = calls[0]?.body ?? {};
  check("preventivo: la richiesta parte come JSON verso il portale", calls.length === 1 && calls[0].method === "POST" && /^application\/json/.test(calls[0].type ?? ""), JSON.stringify(calls[0] ?? {}));
  check("preventivo: porta sito, prodotto, lingua, pagina e i valori ripuliti", sent.site === "corporate" && sent.product === "car" && sent.lang === "it" && sent.page === "/" && sent.name === "Marco Bianchi" && sent.email === "marco@example.test" && sent.consent === true && sent.company === "", JSON.stringify(sent));
  check("preventivo: il campo trappola resta vuoto e il tempo impiegato e' quello di una persona", sent.website === "" && Number.isInteger(sent.elapsedMs) && sent.elapsedMs >= 3000, JSON.stringify({ website: sent.website, elapsedMs: sent.elapsedMs }));
  check("preventivo: a invio riuscito lo dice, svuota il modulo e avvisa la pagina", (await status.innerText()) === "Richiesta inviata. Ti rispondiamo all'indirizzo che hai indicato." && (await form.locator('[name="name"]').inputValue()) === "" && (await page.evaluate(() => window.__leads)) === 1);
  const trap = await form.locator('[name="website"]').evaluate((node) => ({ tab: node.tabIndex, left: node.getBoundingClientRect().right }));
  check("preventivo: il campo trappola e' fuori dallo schermo e dal giro dei tasti", trap.tab === -1 && trap.left < 0, JSON.stringify(trap));

  // the server refuses a field, then is unavailable
  const fill = async () => { await form.locator('[name="name"]').fill("Marco Bianchi"); await form.locator('[name="email"]').fill("marco@example.test"); await form.locator('[name="message"]').fill("Vorrei un preventivo per un cantiere a Roma."); await form.locator('[name="consent"]').check(); };
  answer = { status: 400, body: { ok: false, error: "invalid", fields: ["email"] } };
  await fill();
  await submit.click();
  await page.waitForFunction(() => document.querySelector("form[data-quote-form] [data-form-status]")?.getAttribute("data-state") === "invalid", null, { timeout: 5000 }).catch(() => {});
  check("preventivo: un campo rifiutato dal server e' segnalato sul campo", (await form.locator('[name="email"]').getAttribute("aria-invalid")) === "true" && (await form.locator('[name="name"]').inputValue()) === "Marco Bianchi");
  answer = { status: 500, body: { ok: false, error: "unavailable" } };
  await submit.click();
  await page.waitForFunction(() => document.querySelector("form[data-quote-form] [data-form-status]")?.getAttribute("data-state") === "error", null, { timeout: 5000 }).catch(() => {});
  check("preventivo: se il server non risponde bene lo dice, da' l'indirizzo a cui scrivere e non perde quanto scritto", /info@tecnomga\.com/.test(await status.innerText()) && (await form.locator('[name="message"]').inputValue()).length > 10 && (await submit.isEnabled()));
  check("preventivo: nessun errore JS", pageErrors.filter((text) => !/Failed to load resource/.test(text)).length === 0, pageErrors.join(" | "));
  await ctx.close();
}
// the form in English says its messages in English and sends the language
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 800 } });
  const bodies = [];
  await ctx.route("https://portale.tecnomga.com/api/contact", (route) => {
    const cors = { "access-control-allow-origin": new URL(BASE).origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Content-Type" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: '{"ok":true}' });
  });
  await page.goto(`${BASE}/en/`, { waitUntil: "networkidle" });
  const form = page.locator("form[data-quote-form]");
  await form.locator("button[type=submit]").click();
  check("preventivo in inglese, telefono: i messaggi sono in inglese e il modulo non esce dal bordo", (await form.locator("[data-form-status]").innerText()) === "Please check the highlighted fields." && (await overflow(page)) === 0);
  await form.locator('[name="name"]').fill("Mark White");
  await form.locator('[name="email"]').fill("mark@example.test");
  await form.locator('[name="product"]').selectOption("d-and-o");
  await form.locator('[name="message"]').fill("I would like a quotation for our board.");
  await form.locator('[name="consent"]').check();
  await form.locator("button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("form[data-quote-form] [data-form-status]")?.getAttribute("data-state") === "success", null, { timeout: 5000 }).catch(() => {});
  check("preventivo in inglese: la richiesta porta la lingua e la pagina inglesi", bodies.length === 1 && bodies[0].lang === "en" && bodies[0].page === "/en/" && bodies[0].product === "d-and-o", JSON.stringify(bodies[0] ?? {}));
  await ctx.close();
}
// 9) privacy and cookies: readable text on a light sheet, the cookie table fits a phone, the links work
{
  const { ctx, page, pageErrors } = await open({ viewport: { width: 360, height: 800 } });
  for (const path of ["/privacy/", "/cookie/", "/en/privacy/", "/en/cookie/"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    check(`${path} telefono 360: la pagina non esce dal bordo`, (await overflow(page)) === 0, String(await overflow(page)));
    const colors = await page.locator(".legal__body p").first().evaluate((node) => ({ text: getComputedStyle(node).color, sheet: getComputedStyle(node.closest(".legal__sheet")).backgroundImage }));
    check(`${path}: il testo e' scuro su un foglio chiaro`, colors.text === "rgb(64, 86, 106)" && /gradient/.test(colors.sheet), JSON.stringify(colors));
  }
  await page.goto(`${BASE}/cookie/`, { waitUntil: "networkidle" });
  const names = await page.locator(".compare tbody th code").allInnerTexts();
  check("cookie: con la misurazione attiva l'elenco ha la scelta sui cookie, la lingua e i due cookie di Google Analytics", names.join("|") === "tecno-consent-v1 (archivio locale)|tecno-lang-choice (archivio locale)|_ga|_ga_<ID>", names.join("|"));
  check("cookie: su telefono ogni cella dice a che colonna appartiene", (await page.locator(".compare td").first().evaluate((node) => getComputedStyle(node, "::before").content)) === '"A cosa serve"');
  await page.locator('.legal__body a[href="/privacy/"]').first().click();
  await page.waitForURL(`${BASE}/privacy/`);
  check("cookie: il rimando porta all'informativa sulla privacy", (await page.locator("h1").innerText()) === "Informativa sulla privacy");
  check("privacy: il rimando all'informativa generale si apre in un'altra scheda", (await page.locator('.legal__body a[target="_blank"][rel="noopener noreferrer"]').first().getAttribute("href")) === "/documenti/informativa-privacy.pdf");
  check("pagine legali: nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
// 10) animated opening of the home page: the world alone and large, then it moves back and the site appears
const openingState = (page) => page.evaluate(() => {
  const css = (selector) => getComputedStyle(document.querySelector(selector));
  return { intro: document.documentElement.classList.contains("intro"), title: Number(css(".hero__title").opacity), header: css(".site-header").visibility, veil: Number(getComputedStyle(document.querySelector(".hero__media"), "::after").opacity), scale: Number(new DOMMatrix(css(".hero__poster").transform).a.toFixed(3)) };
});
{
  const { ctx, page, pageErrors } = await open({ intro: true });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const early = await openingState(page);
  check("apertura: al primo arrivo il mondo e' in grande e da solo; testo, barra e velo non ci sono ancora", early.intro && early.scale > 1.3 && early.title < 0.1 && early.header === "hidden" && early.veil < 0.2, JSON.stringify(early));
  check("apertura: il mondo in grande non allarga la pagina", (await overflow(page)) === 0);
  check("apertura: finche' dura si vede l'immagine ferma, il video non viene ancora scaricato", (await page.evaluate(() => document.querySelector("video[data-hero-video]").currentSrc)) === "");
  await page.waitForTimeout(1500);
  const middle = await openingState(page);
  check("apertura: il mondo si allontana piano", middle.intro && middle.scale < early.scale && middle.scale > 1, JSON.stringify(middle));
  await page.waitForTimeout(3000);
  const late = await openingState(page);
  check("apertura: a fine corsa c'e' tutto il sito, con il mondo sullo sfondo, e l'apertura e' spenta", !late.intro && late.scale === 1 && late.title === 1 && late.header === "visible" && late.veil === 1, JSON.stringify(late));
  const video = await page.evaluate(async () => { const node = document.querySelector("video[data-hero-video]"); const first = node.currentTime; await new Promise((resolve) => setTimeout(resolve, 900)); return { source: node.currentSrc.split("/").pop(), paused: node.paused, moved: node.currentTime !== first, width: node.videoWidth }; });
  check("apertura: il video a ciclo continuo e' partito sopra l'immagine ferma", /^apertura\.(webm|mp4)$/.test(video.source) && !video.paused && video.moved && video.width === 1920, JSON.stringify(video));
  check("apertura: nessun errore JS", pageErrors.length === 0, pageErrors.join(" | "));
  await ctx.close();
}
{
  // nobody has to wait: the first gesture ends the opening
  const { ctx, page } = await open({ intro: true });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const before = await openingState(page);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(150);
  const after = await openingState(page);
  check("apertura: al primo scorrimento si spegne subito e il sito e' tutto li'", before.intro && !after.intro && after.title === 1 && after.header === "visible" && after.scale === 1, JSON.stringify({ before, after }));
  await ctx.close();
}
{
  const { ctx, page } = await open({ intro: true });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  check("apertura: anche un tasto la spegne, per chi naviga da tastiera", !(await openingState(page)).intro);
  await ctx.close();
}
{
  // from another page of the site, back, to a section, with reduced motion: no opening
  const { ctx, page } = await open({ intro: true });
  await page.goto(`${BASE}/privacy/`, { waitUntil: "networkidle" });
  await page.locator(".site-header a[href='/']").first().click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  const fromInside = await openingState(page);
  check("apertura: non parte per chi arriva da un'altra pagina del sito", !fromInside.intro && fromInside.title === 1 && fromInside.scale === 1, JSON.stringify(fromInside));
  await page.goto(`${BASE}/#preventivo`, { waitUntil: "domcontentloaded" });
  check("apertura: non parte per chi arriva dritto alla sezione del preventivo", !(await openingState(page)).intro);
  await ctx.close();
}
{
  const { ctx, page } = await open({ intro: true, reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const still = await openingState(page);
  const video = await page.evaluate(() => { const node = document.querySelector("video[data-hero-video]"); return { source: node.currentSrc, loaded: [...node.querySelectorAll("source")].some((source) => source.hasAttribute("src")) }; });
  check("con «riduci movimento»: nessuna apertura, il testo e' subito visibile e il video non viene scaricato", !still.intro && still.title === 1 && still.scale === 1 && video.source === "" && !video.loaded, JSON.stringify({ still, video }));
  await ctx.close();
}
{
  const { ctx, page } = await open({ intro: true, javaScriptEnabled: false });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const plain = await page.locator(".hero__title").evaluate((node) => ({ opacity: getComputedStyle(node).opacity, intro: document.documentElement.classList.contains("intro") }));
  check("senza JavaScript: nessuna apertura, il titolo e' visibile", plain.opacity === "1" && !plain.intro, JSON.stringify(plain));
  await ctx.close();
}
{
  const { ctx, page } = await open({ intro: true, viewport: { width: 390, height: 800 } });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const early = await openingState(page);
  check("apertura su telefono: parte, e la pagina non esce dal bordo", early.intro && early.scale > 1.3 && (await overflow(page)) === 0, JSON.stringify(early));
  await page.waitForTimeout(4400);
  const late = await openingState(page);
  check("apertura su telefono: a fine corsa testo e barra ci sono", !late.intro && late.title === 1 && late.header === "visible" && (await overflow(page)) === 0, JSON.stringify(late));
  await ctx.close();
}
// tablet: nothing wider than the screen either
{
  const { ctx, page } = await open({ viewport: { width: 820, height: 1180 } });
  await page.goto(`${BASE}/en/`, { waitUntil: "networkidle" });
  check("tablet 820, inglese: la pagina non esce dal bordo", (await overflow(page)) === 0, String(await overflow(page)));
  check("tablet 820, inglese: undici prodotti", (await page.locator("[data-product]").count()) === 11);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length === 0 ? 0 : 1);
