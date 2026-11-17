// Controllo della build del sito aziendale (sites/tecnomga/dist): le pagine esistono come HTML completo,
// non c'e' il guscio del portale, ogni pagina ha un solo titolo principale.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "sites/tecnomga/dist";
const REQUIRED = ["/", "/en/", "/privacy/", "/en/privacy/", "/cookie/", "/en/cookie/"];
const problems = [];
if (!existsSync(DIST)) problems.push(`manca ${DIST}: eseguire prima «npm run build:corp»`);
else {
  for (const path of REQUIRED) {
    const file = join(DIST, path, "index.html");
    if (!existsSync(file)) {
      problems.push(`manca la pagina ${path}`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    if (!html.startsWith("<!doctype html>")) problems.push(`${path}: non e' un documento HTML completo`);
    if ((html.match(/<h1\b/g) ?? []).length !== 1) problems.push(`${path}: deve avere un solo titolo principale`);
    if (!/<html lang="(it|en)" data-site="tecnomga"/.test(html)) problems.push(`${path}: lingua o sito non dichiarati`);
    if (/id="root"/.test(html)) problems.push(`${path}: contiene il guscio di un'applicazione`);
    for (const match of html.matchAll(/<(?:link rel="stylesheet" href|script type="module" src)="([^"]+)"/g)) {
      if (!existsSync(join(DIST, match[1]))) problems.push(`${path}: manca il file ${match[1]}`);
    }
  }
  // I file accanto alle pagine, e la coerenza dei segnali di indicizzazione tra loro.
  for (const name of ["sitemap.xml", "robots.txt", "llms.txt"]) if (!existsSync(join(DIST, name))) problems.push(`manca ${name}`);
  if (existsSync(join(DIST, "robots.txt")) && existsSync(join(DIST, "index.html"))) {
    const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
    const home = readFileSync(join(DIST, "index.html"), "utf8");
    const closed = /^Disallow: \/\s*$/m.test(robots);
    const noindex = /<meta name="robots" content="noindex/.test(home);
    if (closed !== noindex) problems.push("robots.txt e le pagine non dicono la stessa cosa sull'indicizzazione");
    if (!closed && !/^Sitemap: https:\/\//m.test(robots)) problems.push("robots.txt non indica la sitemap");
  }
  if (existsSync(join(DIST, "sitemap.xml"))) {
    const locs = [...readFileSync(join(DIST, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
    for (const path of REQUIRED) if (!locs.includes(path)) problems.push(`la sitemap non elenca ${path}`);
    for (const path of locs) if (!existsSync(join(DIST, path, "index.html"))) problems.push(`la sitemap elenca ${path}, che non esiste`);
  }
  for (const stray of ["app.html", "version.json"]) if (existsSync(join(DIST, stray))) problems.push(`${stray} appartiene al portale, non al sito aziendale`);
}
if (problems.length) {
  console.error(`Sito aziendale: ${problems.length} problemi\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Sito aziendale OK: ${REQUIRED.length} pagine.`);
