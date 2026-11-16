# Sito aziendale tecnomga.com, consegna 1 — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mettere su un indirizzo di prova il nuovo sito aziendale con homepage, apertura scenica, riquadri in vetro liquido, piè di pagina con i dati dell'intermediario, privacy, cookie e richiesta di preventivo.

**Architecture:** il sito aziendale è una seconda definizione di sito nello stesso repository (`src/corp/`), generata come HTML statico da una build separata (`vite.corp.config.ts`, uscita in `sites/tecnomga/dist/`). Le parti indipendenti dal sito stanno in `src/site-kit/` e sono guidate da una `SiteDefinition`; i moduli del portale già indipendenti (consenso, comportamenti nel browser) si riusano per importazione. Il sito aziendale è solo statico: il modulo invia al servizio contatti del portale.

**Tech Stack:** TypeScript, React (`renderToStaticMarkup`, nessuna idratazione), Vite 5, Vitest, Playwright, Vercel, Supabase (solo per la tabella delle richieste), Higgsfield e ffmpeg per i media.

**Spec:** `docs/superpowers/specs/2026-11-16-sito-aziendale-tecnomga-design.md`

## Global Constraints

- Lingue: italiano (predefinita, alla radice) e inglese (`/en/`). Nessun cinese.
- Dati dell'intermediario: Tecno Advance MGA Broker Srl, RUI B000746484, P.IVA 17460381001, sede legale Via Po 102 - 00198 Roma, sede operativa Via Michele Mercati 18 - 00197 Roma, telefono 06.97638088, PEC `tecnoadvancemgabroker@legalmail.it`, email `info@tecnomga.com`.
- Reclami: via email a `info@tecnomga.com`, per iscritto alla sede legale. Helpet non compare nei reclami né nei documenti.
- Testo sul gruppo, da pubblicare identico: «I soci fondatori di Tecno MGA, Anton Carlo Santoro e Barbara Santoro, hanno fondato anche Helpet, realtà dedicata agli animali domestici cresciuta in Vittoria hub, l'incubatore di Vittoria Assicurazioni. Da questa esperienza nasce la nostra linea per i pet, sviluppata con Mapfre.» Vittoria e Mapfre non compaiono altrove riferite al gruppo.
- Compagnie con cui Tecno lavora: Generali, AXA, Vittoria, Helpet, Markel. Dal 16/11/2026, su richiesta del titolare, con il loro logo (file forniti da lui, non alterati, su fondo bianco); il nome resta come testo alternativo. Markel solo in questo elenco, mai accanto alle VIES.
- Vietati: prezzi, tempi di emissione, promesse di accettazione, numeri o primati non documentati, persone inventate, testi di modello, affermazioni normative senza fonte primaria letta in sessione.
- Dove un dato del titolare manca, la sezione non compare.
- Gusto: niente scritte piccole sopra i titoli, niente sottotitoli sotto i titoli di sezione, banner dei cookie con un solo consenso («Accetta» / «Rifiuta»).
- Tutti i riquadri sono in vetro liquido; testo con contrasto almeno AA; lastra piena dove `backdrop-filter` manca; tutto il movimento rispetta `prefers-reduced-motion`.
- Titolo 50-60 caratteri, descrizione 150-160, in entrambe le lingue; stessa struttura nelle due lingue.
- Prestazioni: homepage almeno 90/100 su telefono; pagina iniziale sotto 1 MB senza il video; video sotto 3 MB.
- L'indirizzo di prova non è indicizzabile.
- I test e la build del portale restano verdi e l'uscita del portale non cambia.
- Tutto il testo visibile all'utente e i messaggi di commit in italiano. Unione e pubblicazione solo con l'ok del titolare.

## Review Focus

1. La generalizzazione del plugin di build non cambia l'uscita del portale: stesse pagine, stesso guscio `app.html`.
2. Indirizzo di prova non indicizzabile: `robots.txt`, meta robots e sitemap coerenti; attivando l'indicizzazione cambiano tutti insieme.
3. Modulo tra due domini: il servizio accetta solo le origini previste, risponde al preflight, e il modulo del portale continua a funzionare.
4. Vetro liquido senza `backdrop-filter` o con «riduci movimento»: il contenuto resta leggibile e fermo.
5. Un dato del titolare assente (per esempio i profili social) non lascia in pagina un titolo vuoto o un testo provvisorio.

---

### Task 1: Kit del sito, ossatura del sito aziendale e build separata

**Files:**
- Create: `src/site-kit/types.ts`, `src/site-kit/routes.ts`, `src/site-kit/html.ts`
- Create: `src/corp/config.ts`, `src/corp/routes.ts`, `src/corp/content/types.ts`, `src/corp/content/it.ts`, `src/corp/content/en.ts`, `src/corp/content/index.ts`, `src/corp/render.tsx`, `src/corp/client/main.ts`
- Create: `vite.corp.config.ts`, `sites/tecnomga/.gitignore`, `scripts/check-corp-site.mjs`
- Modify: `vite/public-site-plugin.ts`, `package.json`, `.github/workflows/ci.yml`, `tsconfig` del progetto se serve includere `src/corp`
- Test: `tests/corp/routes.test.ts`, `tests/corp/render.test.ts`, `tests/site/plugin-options.test.ts`

**Interfaces:**
- Produces:
  - `SiteDefinition<L extends string>`: `{ id: string; defaultOrigin: string; langs: L[]; hreflang: Record<L,string>; langPrefix: Record<L,string>; xDefault: L; langNames: Record<L,string>; langShort: Record<L,string> }`
  - `createRoutes<L, Id extends string>(def: SiteDefinition<L>, slugs: Record<Id, Record<L,string>>): { pathOf(id: Id, lang: L): string; listPages(): Array<{id: Id; lang: L; path: string}>; findPage(path: string): {id: Id; lang: L; path: string} | null; normalizePath(path: string): string }`
  - `escapeHtml(value: string): string` e `htmlDocument(input: { lang: string; pageId: string; head: string; body: string; bodyClass: string; attrs?: Record<string,string|undefined> }): string` in `src/site-kit/html.ts`
  - `CORP: SiteDefinition<"it"|"en">`, `CorpLang`, `CorpEnv { origin: string; indexable: boolean; contactEndpoint: string; ga4Id?: string; gscVerification?: string; bingVerification?: string }`, `readCorpEnv(env)`, `COMPANY` (dati dei Global Constraints) in `src/corp/config.ts`
  - `CorpPageId = "home" | "privacy" | "cookie"` con `pathOf`, `listPages`, `findPage` in `src/corp/routes.ts`
  - `renderPage(path, assets, env)`, `renderAll(assets, env)`, `renderExtraFiles(env)` in `src/corp/render.tsx`, con la stessa forma di `src/site/render.tsx`
  - `staticSitePlugin(options: { name: string; renderModule: string; configModule: string; envReader: string; clientEntry: string; shell: "rename-to-app" | "none"; fonts?: {heading: string; body: string} })`; `publicSitePlugin()` resta e chiama `staticSitePlugin` con i valori di oggi

- [ ] **Step 1: test delle rotte** — `tests/corp/routes.test.ts`: `pathOf("home","it") === "/"`, `pathOf("home","en") === "/en/"`, `pathOf("privacy","en") === "/en/privacy/"`, `listPages()` ha 6 voci, `findPage("/en/cookie") ` trova la pagina, `findPage("/zh/")` è `null`.
- [ ] **Step 2:** `npx vitest run tests/corp/routes.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3:** scrivere `src/site-kit/types.ts`, `src/site-kit/routes.ts`, `src/corp/config.ts`, `src/corp/routes.ts`.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: test della pagina minima** — `tests/corp/render.test.ts`: `renderPage("/", assets, env)` inizia con `<!doctype html>`, ha `<html lang="it"`, un solo `<h1>`, nessun `data-reactroot`, `renderPage("/zh/", …)` è `null`, `renderAll` produce 6 pagine.
- [ ] **Step 6:** FAIL, poi scrivere `src/site-kit/html.ts`, i contenuti minimi e `src/corp/render.tsx` con una homepage con il solo titolo → PASS.
- [ ] **Step 7: test del plugin** — `tests/site/plugin-options.test.ts`: `publicSitePlugin()` ha nome `policy-portal-public-site` e nella sua `config()` gli ingressi sono `main: "index.html"` e `site: "src/site/client/main.ts"`; `staticSitePlugin({ shell: "none", … })` non dichiara l'ingresso `main`.
- [ ] **Step 8:** FAIL, poi generalizzare `vite/public-site-plugin.ts`; con `shell: "none"` la build non cerca né rinomina `index.html` → PASS.
- [ ] **Step 9:** `vite.corp.config.ts` (radice del progetto, `build.outDir: "sites/tecnomga/dist"`, `publicDir: "sites/tecnomga/public"`, plugin con i moduli di `src/corp`), script `dev:corp` (porta 5301), `build:corp`, `test:corp-site`.
- [ ] **Step 10:** `scripts/check-corp-site.mjs`: dopo la build esistono `index.html`, `en/index.html`, `privacy/index.html`, `en/privacy/index.html`, `cookie/index.html`, `en/cookie/index.html`; nessun `app.html`; ogni pagina ha un solo `<h1>`.
- [ ] **Step 11:** `npx vite build && npm run test:public-site` → `Sito pubblico OK: 42 pagine` (uscita del portale invariata); `npm run build:corp && npm run test:corp-site` → OK.
- [ ] **Step 12:** passi `build:corp` e `test:corp-site` nel job `verify` della CI; commit.

### Task 2: Testata, dati strutturati, sitemap, robots e llms.txt

**Files:**
- Create: `src/site-kit/head.ts`, `src/site-kit/schema.ts`, `src/site-kit/sitemap.ts`, `src/corp/meta.ts`
- Modify: `src/corp/render.tsx`, `src/corp/content/*`, `scripts/check-corp-site.mjs`
- Test: `tests/corp/seo.test.ts`

**Interfaces:**
- Consumes: `SiteDefinition`, `createRoutes`, `CORP`, `CorpEnv`, `COMPANY`.
- Produces:
  - `headTags(input: { def; page: {id; lang; path}; alternates: Array<{lang; path}>; meta: {title; description}; origin: string; indexable: boolean; socialImage: string; siteName: string; verification?: {google?: string; bing?: string}; article?: {published; updated; author}; feed?: {href; title} }): string`
  - `organizationSchema(company, origin, langs)`, `serviceSchema(...)`, `faqSchema(items)`, `breadcrumbSchema(items, origin)`, `jsonLd(data)` in `src/site-kit/schema.ts`
  - `buildSitemapXml(input: { def; origin; pages: Array<{id; lang; path; lastmod}>; pathOf })`, `buildRobotsTxt({ origin, indexable })`, `buildLlmsTxt(input)`
  - `CORP_CONTENT_UPDATED = "2026-11-16"`

- [ ] **Step 1: test** — titolo e descrizione nelle lunghezze dei Global Constraints per ogni pagina e lingua; canonical `https://tecnomga.com/…`; alternative `it`, `en`, `x-default` (italiano); con `indexable: false` la testata ha `noindex, nofollow`, `robots.txt` ha `Disallow: /` e non cita la sitemap; con `indexable: true` la testata ha `index, follow`, `robots.txt` cita `Sitemap: https://tecnomga.com/sitemap.xml`; dati strutturati `InsuranceAgency` con RUI `B000746484`, sede legale `Via Po, 102`, email `info@tecnomga.com`; sitemap con 6 indirizzi e XML ben formato; nessuno script in linea oltre ai blocchi `application/ld+json`.
- [ ] **Step 2:** FAIL → scrivere i moduli → PASS.
- [ ] **Step 3:** `renderExtraFiles` scrive `sitemap.xml`, `robots.txt`, `llms.txt`; il controllo della build li verifica; commit.

### Task 3: Vetro liquido, intestazione, piè di pagina, banner dei cookie

**Files:**
- Create: `src/site-kit/tokens.css` (le variabili di `:root` oggi in `src/site/site.css`, importate da entrambi i siti), `src/corp/corp.css`, `src/corp/components/Layout.tsx`, `Header.tsx`, `Footer.tsx`, `GlassCard.tsx`, `CookieBanner.tsx`, `src/corp/client/glass.ts`
- Modify: `src/site/site.css` (importa i token), `src/corp/client/main.ts`, `src/corp/render.tsx`, `e2e/run.mjs` (avvia il server del sito aziendale sulla porta 5301 per gli scenari `corp-*`)
- Test: `tests/corp/layout.test.ts`, `e2e/corp-site.e2e.mjs`

**Interfaces:**
- Consumes: `initConsent` (`src/site/client/consent.ts`), `initMenu`, `initReveal`, `initMotion` del portale; `CorpContent`.
- Produces: `GlassCard({ as?, className?, children })` che rende un elemento con classe `glass-card` e attributo `data-glass`; `initGlass()` che aggiorna le variabili CSS `--glass-x` e `--glass-y` al movimento del puntatore e non fa nulla con «riduci movimento».

- [ ] **Step 1: test del piè di pagina** — in ogni pagina e lingua compaiono denominazione, RUI, P.IVA, sede legale Via Po 102, sede operativa, PEC, `info@tecnomga.com`, la frase sulla vigilanza IVASS, i reclami verso `info@tecnomga.com`, l'avviso «Messaggio pubblicitario»; non compaiono `helpet`, `Parioli`, `example.com`, `tecnoinsurance`; il link di verifica al RUI è presente; il selettore della lingua porta alla stessa pagina nell'altra lingua.
- [ ] **Step 2:** FAIL → componenti e stile → PASS.
- [ ] **Step 3:** `src/corp/corp.css`: classe `.glass-card` con `backdrop-filter`, bordo luminoso, riflesso che segue `--glass-x/--glass-y`; `@supports not (backdrop-filter: blur(1px))` → fondo pieno; `@media (prefers-reduced-motion: reduce)` → nessuna transizione.
- [ ] **Step 4: prove nel browser** — `e2e/corp-site.e2e.mjs`: senza JavaScript la homepage ha titolo, menu e piè di pagina; a 360 e 390 px `scrollWidth === clientWidth`; il menu su telefono si apre e si chiude; il banner dei cookie ha due pulsanti e, scelto «Rifiuta», non carica nulla di Google; nessun errore JavaScript.
- [ ] **Step 5:** `node e2e/run.mjs corp-site` → tutti OK; `npm run test:e2e -- public-site landing-header` → ancora OK; commit.

### Task 4: Homepage

**Files:**
- Create: `src/corp/products.ts`, `src/corp/components/Hero.tsx`, `Products.tsx`, `Broker.tsx`, `Founders.tsx`, `Companies.tsx`, `Steps.tsx`, `src/corp/pages/Home.tsx`
- Modify: `src/corp/content/*`, `src/corp/render.tsx`
- Test: `tests/corp/home.test.ts`, `tests/corp/content.test.ts`

**Interfaces:**
- Produces: `PRODUCT_IDS = ["fideiussioni","car","decennale-postuma","rc-professionale","d-and-o","pet","fotovoltaico","impresa-commercio","casa","auto","infortuni-malattia"] as const`, `FEATURED: ProductId[]` (i primi sei), `ProductId`; `CorpContent` con `home.hero`, `home.products.items: Record<ProductId, { name: string; line: string }>`, `home.broker`, `home.founders`, `home.companies`, `home.steps`.

Prima di scrivere «perché un broker» si leggono su Normattiva gli articoli del Codice delle assicurazioni private (D.Lgs. 209/2005) sul broker e sul RUI; nel file dei contenuti si annota in un commento articolo e data di verifica. Se un'affermazione non trova la fonte, non si scrive.

- [ ] **Step 1: test dei contenuti** — stesse chiavi nelle due lingue; nessun testo vuoto; nessun prezzo (`€`, `euro` seguiti da cifre), nessun tempo di emissione, nessuna delle parole `primi`, `leader`, `migliore`, `n. 1`; undici prodotti, i sei in evidenza per primi; la frase sul gruppo in italiano è identica a quella dei Global Constraints; l'elenco delle compagnie è esattamente Generali, AXA, Vittoria, Helpet, Markel; «Markel» compare una sola volta nella pagina; la parola «VIES» compare solo nel rimando al portale.
- [ ] **Step 2:** FAIL → contenuti → PASS.
- [ ] **Step 3: test della pagina** — un solo `<h1>`; ordine delle sezioni `apertura, prodotti, broker, fondatori, compagnie, come-funziona, preventivo`; ogni riquadro di prodotto è un `glass-card` con il nome in un titolo; il riquadro delle fideiussioni ha un link a `https://portale.tecnomga.com/` per le VIES; l'apertura ha un'immagine ferma con `width` e `height` e un `<video>` senza `src` (lo imposta il browser); dati strutturati `InsuranceAgency`, `Service`, `HowTo`.
- [ ] **Step 4:** FAIL → componenti → PASS; prove nel browser aggiornate; commit.

### Task 5: Richiesta di preventivo

**Files:**
- Create: `supabase/migrations/<data>_contact_requests_site.sql`, `src/corp/components/QuoteForm.tsx`, `src/corp/client/quote.ts`
- Modify: `api/_lib/contact-requests.ts`, `api/vies-connect.ts`, il componente dell'elenco delle richieste nel portale, `src/corp/pages/Home.tsx`, `docs/monitoring.md` se elenca la tabella
- Test: `tests/server/contact-requests.test.ts` (nuovi casi), `tests/corp/quote.test.ts`, `e2e/corp-site.e2e.mjs`, `e2e/contact-requests.e2e.mjs`

**Interfaces:**
- Produces:
  - Tabella: colonne nuove `site text not null default 'portal' check (site in ('portal','corporate'))`, `product text check (product is null or product in (<undici id>, 'altro'))`; `company`, `role`, `country` diventano facoltative quando `site = 'corporate'` (vincolo riscritto, righe esistenti valide).
  - `validateContact(body)` accetta `site` e `product`; per `corporate` obbligatori `name`, `email`, `message`, `consent`.
  - `contactInbox(site)`: `portal` → `vies@tecnomga.com`, `corporate` → `info@tecnomga.com`.
  - `allowedOrigin(origin: string | undefined, allowed: string[]): string | null` e gestione di `OPTIONS` sulla rotta `contact`; le origini ammesse vengono da `CONTACT_ALLOWED_ORIGINS` (predefinite `https://tecnomga.com`, `https://www.tecnomga.com`).
  - Nel browser: `quoteProblems(values)` e `quotePayload(values, extra)` in `src/corp/client/quote.ts`; il modulo invia a `CorpEnv.contactEndpoint` (predefinito `https://portale.tecnomga.com/api/contact`).

- [ ] **Step 1: test sul server** — richiesta `corporate` senza società né paese è accettata, salvata con `site: "corporate"` e `product`, e l'email parte verso `info@tecnomga.com`; richiesta `portal` come oggi verso `vies@tecnomga.com`; `product` fuori elenco è rifiutato; preflight da `https://tecnomga.com` riceve `Access-Control-Allow-Origin` con quell'origine; da un'origine non ammessa non lo riceve; una richiesta senza intestazione `Origin` (stesso dominio) funziona come oggi.
- [ ] **Step 2:** FAIL → codice e migrazione → PASS; `scripts/check-migrations-fresh.sh` → tutte applicate.
- [ ] **Step 3: test nel browser** — il modulo vuoto non parte e segna i campi; con dati validi invia a un indirizzo simulato un corpo con `site: "corporate"`, `product` e `lang`; il campo trappola resta vuoto.
- [ ] **Step 4:** l'elenco degli amministratori mostra sito e prodotto; `e2e/contact-requests.e2e.mjs` aggiornato → OK; commit.

### Task 6: Privacy e cookie

**Files:**
- Create: `src/corp/pages/Legal.tsx`, `src/corp/content/legal/it.ts`, `src/corp/content/legal/en.ts`
- Test: `tests/corp/legal.test.ts`

- [ ] **Step 1: test** — le due pagine esistono nelle due lingue; titolare del trattamento Tecno Advance MGA Broker Srl con sede legale Via Po 102; contatto privacy e DPO come sul portale; la pagina dei cookie elenca solo ciò che il sito usa davvero (preferenza del consenso; Google solo dopo il consenso e solo se configurato); nessun riferimento a Helpet; data dell'ultima verifica presente.
- [ ] **Step 2:** FAIL → contenuti adattati da quelli del portale → PASS; commit.

### Task 7: Video dell'apertura e immagini

**Files:**
- Create: `sites/tecnomga/public/media/apertura.mp4`, `apertura.webm`, `apertura.webp`, `og-it.png`, `og-en.png`, `sites/tecnomga/public/favicon.svg` e icone (dal logo già nel repository)
- Modify: `src/corp/components/Hero.tsx`, `src/corp/client/main.ts`
- Test: `tests/corp/media.test.ts`

- [ ] **Step 1: test** — ogni file esiste; video sotto 3 MB ciascuno; immagine ferma sotto 200 kB con le dimensioni dichiarate nella pagina; immagini social 1200×630.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** verificare il costo in crediti del video con Higgsfield; generarlo dal fotogramma scelto (lavoro `16b5dbb6-41a4-4848-b29d-7d62d0e5d31e`) con movimento lento e senza rotazione completa; con ffmpeg portarlo a ciclo senza stacco (dissolvenza incrociata tra fine e inizio), 1920×1080, senza audio, nei due formati; estrarre l'immagine ferma.
- [ ] **Step 4:** PASS; guardare il video e l'apertura in pagina a 1440 e 390 px; commit.

### Task 8: Indirizzo di prova, documentazione, controlli, richiesta di unione

**Files:**
- Create: `sites/tecnomga/vercel.json`, `docs/corporate-site.md`
- Modify: `docs/testing.md`, `CHANGELOG.md`, `tests/server/vercel-config.test.ts` (nuovo blocco per la configurazione del sito aziendale)

- [ ] **Step 1: test della configurazione** — `sites/tecnomga/vercel.json`: intestazioni di sicurezza su ogni pagina; la politica dei contenuti ammette `connect-src` verso `https://portale.tecnomga.com` e, per Google, gli stessi indirizzi delle pagine pubbliche del portale; nessun indirizzo di Supabase; barra finale coerente con le rotte.
- [ ] **Step 2:** FAIL → configurazione → PASS.
- [ ] **Step 3:** progetto Vercel `tecnomga-site` collegato allo stesso repository, cartella radice `sites/tecnomga`, comando di build che parte dalla radice del repository, nessuna variabile che attivi l'indicizzazione; origine dell'indirizzo di prova aggiunta alle origini ammesse dal servizio contatti dell'ambiente di prova.
- [ ] **Step 4:** verifiche sull'indirizzo di prova: pagine 200, `robots.txt` con `Disallow: /`, nessun errore in un browser reale, PageSpeed su telefono almeno 90.
- [ ] **Step 5:** `docs/corporate-site.md` (come è fatto, come si cambia un testo, come si attiva l'indicizzazione, passaggio del dominio), `docs/testing.md`, `CHANGELOG.md`.
- [ ] **Step 6:** controlli completi: `npm run lint`, `npm run typecheck`, `npm run test:checks`, `npm test`, `node scripts/audit-gate.mjs`, `npx vite build && npm run test:public-site`, `npm run build:corp && npm run test:corp-site`, `npm run test:e2e`.
- [ ] **Step 7:** richiesta di unione con l'elenco delle decisioni prese.
