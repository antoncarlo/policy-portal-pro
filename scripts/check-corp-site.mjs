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
  for (const stray of ["app.html", "version.json"]) if (existsSync(join(DIST, stray))) problems.push(`${stray} appartiene al portale, non al sito aziendale`);
}
if (problems.length) {
  console.error(`Sito aziendale: ${problems.length} problemi\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Sito aziendale OK: ${REQUIRED.length} pagine.`);
