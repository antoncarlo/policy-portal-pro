// The corporate site (tecnomga.com): complete HTML without JavaScript; with it the menu, the language switch, the
// cookie banner with a single consent, and liquid-glass surfaces that stay readable. Nothing real is contacted.
import { chromium } from "playwright";
const BASE = process.env.E2E_CORP_BASE ?? "http://127.0.0.1:5301";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name} ${ok ? "" : extra}`); };

const browser = await chromium.launch();
const GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com|google\.it)\//;
const REFUSED = JSON.stringify({ statistics: false, marketing: false, decidedAt: new Date().toISOString() });
/** `consent`: "refused" (default: the cookie banner stays out of the way), "ask" (first visit, no choice yet). */
async function open({ consent = "refused", ...options } = {}) {
  const ctx = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 }, ...options });
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

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
process.exit(failed.length === 0 ? 0 : 1);
