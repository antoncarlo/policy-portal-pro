// Avvisa i motori di ricerca che usano IndexNow (Bing, Yandex, Naver, Seznam, Yep) che alcune pagine pubbliche sono
// cambiate, cosi' le rileggono subito invece di aspettare il prossimo passaggio. Google non usa IndexNow: per Google
// servono Search Console e la sitemap.
//
// Uso:  node scripts/site/indexnow.mjs [--all] [--days=2] [--after=<data ISO>] [--dry-run] [--origin=https://...]
//   senza opzioni invia le pagine la cui data nella sitemap e' degli ultimi 2 giorni: una pubblicazione del portale
//   che non tocca il sito pubblico non invia nulla;
//   --all      invia tutte le pagine della sitemap;
//   --after    aspetta che la versione online sia stata costruita dopo quel momento (in CI: l'ora del commit);
//   --dry-run  mostra cosa invierebbe, senza inviare.
// La chiave e' pubblica per costruzione: e' il file public/<chiave>.txt, che dimostra ai motori che l'invio viene dal sito.
import { pathToFileURL } from "node:url";

export const INDEXNOW_KEY = "3e1a3a5f24b4e9fd9b996e7eb09d0434";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_ORIGIN = "https://portale.tecnomga.com";

export const parseArgs = (argv) => {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  return {
    all: argv.includes("--all"),
    days: Number(value("days") ?? 2),
    after: value("after") || undefined,
    dryRun: argv.includes("--dry-run"),
    origin: (value("origin") ?? DEFAULT_ORIGIN).replace(/\/+$/, ""),
  };
};

/** Le pagine della sitemap con la loro data (AAAA-MM-GG). */
export const sitemapEntries = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((match) => ({ loc: match[1], lastmod: match[2] }));

/** Le pagine da inviare: tutte, oppure quelle con la data negli ultimi `days` giorni. */
export const selectUrls = (entries, { all = false, days = 2, today = new Date().toISOString().slice(0, 10) } = {}) => {
  if (all) return entries.map((entry) => entry.loc);
  const limit = new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000;
  return entries.filter((entry) => new Date(`${entry.lastmod}T00:00:00Z`).getTime() >= limit && entry.lastmod <= today).map((entry) => entry.loc);
};

/** La richiesta del protocollo: solo indirizzi di questo sito, senza doppioni. */
export const buildPayload = (origin, key, urls) => {
  const host = new URL(origin).host;
  const urlList = [...new Set(urls.filter((url) => new URL(url).host === host))];
  return { host, key, keyLocation: `${origin}/${key}.txt`, urlList };
};

/** Vero quando la versione online (version.json) e' stata costruita dopo il momento indicato. */
export const deployIsLive = (version, after) => {
  if (!after) return true;
  const built = Date.parse(version?.builtAt ?? "");
  return Number.isFinite(built) && built >= Date.parse(after);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const get = async (url) => {
  const response = await fetch(url, { headers: { "user-agent": "tecno-site-indexnow" }, cache: "no-store" });
  return { status: response.status, text: await response.text() };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  // 1. La pubblicazione che contiene la modifica deve essere online, con il file della chiave.
  for (let attempt = 0; ; attempt += 1) {
    const version = await get(`${options.origin}/version.json?t=${Date.now()}`).then((result) => JSON.parse(result.text)).catch(() => ({}));
    const key = await get(`${options.origin}/${INDEXNOW_KEY}.txt`).catch(() => ({ status: 0, text: "" }));
    if (deployIsLive(version, options.after) && key.status === 200 && key.text.trim() === INDEXNOW_KEY) break;
    if (attempt >= 40) throw new Error("la pubblicazione con il file della chiave non e' online dopo 10 minuti: nessun invio");
    await sleep(15_000);
  }
  // 2. Le pagine da inviare, dalla sitemap online.
  const sitemap = await get(`${options.origin}/sitemap.xml?t=${Date.now()}`);
  if (sitemap.status !== 200) throw new Error(`sitemap.xml ha risposto ${sitemap.status}`);
  const urls = selectUrls(sitemapEntries(sitemap.text), options);
  if (urls.length === 0) return console.log("IndexNow: nessuna pagina cambiata di recente, nessun invio.");
  const payload = buildPayload(options.origin, INDEXNOW_KEY, urls);
  if (options.dryRun) return console.log(`IndexNow (prova, nulla inviato): ${payload.urlList.length} pagine\n${payload.urlList.join("\n")}`);
  // 3. L'invio.
  const response = await fetch(INDEXNOW_ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) });
  if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow ha risposto ${response.status}: ${(await response.text()).slice(0, 200)}`);
  console.log(`IndexNow: inviate ${payload.urlList.length} pagine (risposta ${response.status}).`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`IndexNow: ${error.message}`);
    process.exit(1);
  });
}
