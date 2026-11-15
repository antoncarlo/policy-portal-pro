// Controllo della build pubblicata (dopo `vite build`): le pagine pubbliche esistono come HTML completo, il guscio del
// portale riservato e' separato e non indicizzabile, e le pagine pubbliche non caricano il codice del portale.
// Nasce da un rischio preciso: se la generazione delle pagine si rompe, la radice del sito servirebbe una pagina
// vuota (o il portale) senza che nessun test del browser se ne accorga.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const MAX_SITE_JS_GZIP = 150 * 1024;
const REQUIRED = ["/", "/en/", "/zh/", "/privacy/", "/en/privacy/", "/zh/privacy/", "/cookie/", "/en/cookie/", "/zh/cookie/"];
const LANG_ATTR = { "": "it", en: "en", zh: "zh-Hans" };
// Il testo minimo di una pagina, letto come lo legge chi non esegue JavaScript (crawler, motori di risposta).
// Il cinese dice le stesse cose in meno caratteri.
const MIN_TEXT = { it: 1500, en: 1500, "zh-Hans": 700 };
/** Le pagine che devono avere gia' il loro testo completo: la homepage nelle tre lingue. */
const TEXT_PAGES = new Set(["/", "/en/", "/zh/"]);
const HOME_ANCHORS = ["cos-e", "per-chi", "come-funziona", "portale", "documenti", "costo", "domande", "contatti"];
const bodyText = (html) =>
  (html.split(/<body[^>]*>/)[1] ?? "")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const problems = [];
const fail = (message) => problems.push(message);
const read = (path) => readFileSync(path, "utf8");

if (!existsSync(DIST)) {
  console.error("dist/ non esiste: eseguire prima `npx vite build`.");
  process.exit(1);
}

// 1. Il guscio del portale riservato.
const shellPath = join(DIST, "app.html");
if (!existsSync(shellPath)) fail("manca dist/app.html (il guscio del portale riservato)");
else {
  const shell = read(shellPath);
  if (!/<meta name="robots" content="noindex, nofollow, noarchive"/.test(shell)) fail("dist/app.html non ha il meta robots noindex");
  if (/<h1[\s>]/.test(shell)) fail("dist/app.html contiene un H1: e' una pagina pubblica finita al posto del guscio?");
  if (!/<div id="root"><\/div>/.test(shell)) fail("dist/app.html non contiene il punto di montaggio del portale");
}

// 2. Le pagine pubbliche: quelle attese, piu' ogni altra index.html generata.
const pages = new Set(REQUIRED);
const walk = (dir, url) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (url === "/" && ["assets", "api"].includes(name)) continue;
      walk(path, `${url}${name}/`);
    } else if (name === "index.html") pages.add(url);
  }
};
walk(DIST, "/");

const scripts = new Set();
for (const url of [...pages].sort()) {
  const path = join(DIST, url, "index.html");
  if (!existsSync(path)) {
    fail(`manca la pagina ${url}`);
    continue;
  }
  const html = read(path);
  if (!html.startsWith("<!doctype html>")) fail(`${url}: non inizia con <!doctype html>`);
  const first = url.split("/")[1];
  const lang = LANG_ATTR[first in LANG_ATTR ? first : ""];
  if (!html.includes(`<html lang="${lang}"`)) fail(`${url}: attributo lang diverso da ${lang}`);
  if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) fail(`${url}: deve avere un solo H1`);
  if (/<div id="root">/.test(html)) fail(`${url}: contiene il punto di montaggio del portale`);
  if (/\/assets\/main-/.test(html)) fail(`${url}: carica il codice del portale riservato`);
  if (/noindex/i.test(html)) fail(`${url}: una pagina pubblica non deve chiedere di non essere indicizzata`);
  if (!/<link rel="stylesheet" href="\/assets\/[^"]+\.css"/.test(html)) fail(`${url}: nessun foglio di stile`);
  for (const match of html.matchAll(/<(?:script[^>]*\ssrc|link rel="modulepreload"[^>]*\shref)="(\/assets\/[^"]+\.js)"/g)) scripts.add(match[1]);
  if (TEXT_PAGES.has(url)) {
    const text = bodyText(html);
    if (text.length < MIN_TEXT[lang]) fail(`${url}: solo ${text.length} caratteri di testo nell'HTML (minimo ${MIN_TEXT[lang]})`);
    for (const anchor of HOME_ANCHORS) if (!html.includes(`id="${anchor}"`)) fail(`${url}: manca la sezione #${anchor}`);
    if (!html.includes('"@type":"FAQPage"')) fail(`${url}: mancano i dati strutturati delle domande frequenti`);
  }
  // Uno script eseguibile in linea verrebbe bloccato dalla CSP: sono ammessi solo i blocchi di dati.
  for (const match of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>/g)) {
    if (!/type="application\/ld\+json"/.test(match[1])) fail(`${url}: script in linea non ammesso dalla CSP`);
  }
}

// 3. Il peso del JavaScript delle pagine pubbliche.
let total = 0;
for (const src of scripts) {
  const path = join(DIST, src);
  if (!existsSync(path)) fail(`script mancante: ${src}`);
  else total += gzipSync(readFileSync(path)).length;
}
if (scripts.size === 0) fail("le pagine pubbliche non caricano nessuno script del sito");
if (total > MAX_SITE_JS_GZIP) fail(`JavaScript del sito pubblico: ${total} byte compressi, oltre il limite di ${MAX_SITE_JS_GZIP}`);

if (problems.length > 0) {
  console.error(`Sito pubblico: ${problems.length} problemi\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Sito pubblico OK: ${pages.size} pagine, guscio del portale separato, JavaScript del sito ${total} byte compressi.`);
