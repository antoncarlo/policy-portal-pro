// Ogni indirizzo di Supabase che il browser contatta deve essere ammesso da connect-src nella CSP di vercel.json.
// Nasce da un guasto reale: il caricamento dei file del lotto VIES (upload resumable) usa l'indirizzo
// <progetto>.storage.supabase.co, diverso da <progetto>.supabase.co; la CSP lo bloccava e la creazione del
// lotto falliva con «upload ... caused by ProgressEvent».
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const csp = vercel.headers.flatMap((entry) => entry.headers).find((header) => header.key === "Content-Security-Policy")?.value;
if (!csp) throw new Error("vercel.json: nessuna Content-Security-Policy");
const connectSources = (csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("connect-src ")) ?? "").split(/\s+/).slice(1);
const projectHost = connectSources.find((source) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(source));
if (!projectHost) throw new Error("connect-src: manca l'indirizzo del progetto Supabase");
const projectRef = projectHost.replace("https://", "").split(".")[0];

const allowed = (url) => {
  const host = new URL(url).host;
  return connectSources.some((source) => {
    if (source === "'self'" || source === "blob:") return false;
    const sourceHost = source.replace(/^[a-z]+:\/\//, "");
    if (!source.startsWith(`${url.split(":")[0]}://`)) return false;
    return sourceHost.startsWith("*.") ? host.endsWith(sourceHost.slice(1)) : host === sourceHost;
  });
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
};
walk("src");

// "https://${projectId}.storage.supabase.co/..." o "https://<ref>.supabase.co/...": l'indirizzo con il segnaposto vale il progetto.
const pattern = /(https|wss):\/\/((?:\$\{[^}]+\}|[a-z0-9-]+)(?:\.[a-z0-9-]+)*\.supabase\.co)/g;
const found = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(pattern)) {
    const host = match[2].replace(/\$\{[^}]+\}/g, projectRef);
    // Only this project's addresses count: examples in the documentation ("https://xxx.supabase.co") are not requests.
    if (!host.startsWith(`${projectRef}.`)) continue;
    const url = `${match[1]}://${host}`;
    if (!found.has(url)) found.set(url, file);
  }
}

const missing = [...found].filter(([url]) => !allowed(url));
if (missing.length) {
  for (const [url, file] of missing) console.error(`CSP: ${url} (usato in ${file}) non è ammesso da connect-src in vercel.json`);
  process.exit(1);
}
console.log(`Controllo CSP superato: ${found.size} indirizzi Supabase usati dal codice, tutti ammessi (${[...found.keys()].join(", ")}).`);
