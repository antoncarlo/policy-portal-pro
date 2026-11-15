# Sito pubblico VIES, prima consegna: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `portale.tecnomga.com` serve pagine pubbliche VIES in italiano, inglese e cinese come HTML completo, indicizzabili, con modulo contatti, banner dei cookie e grafica Tecno; il portale riservato resta privato.

**Architecture:** Un plugin di Vite genera le pagine pubbliche: in sviluppo le serve da un middleware, nella build le scrive in `dist/` e rinomina il guscio del portale in `app.html`. Le pagine sono componenti React resi a HTML statico (`renderToStaticMarkup`), senza idratazione; un ingresso JavaScript separato e leggero (TypeScript senza React) gestisce menu, animazioni, modulo e consenso. Il modulo contatti è una rotta di `api/vies-connect.ts`.

**Tech Stack:** Vite 5, React 18 (solo per generare HTML), Tailwind, TypeScript, Vercel, Supabase, Vitest, Playwright, Higgsfield (immagini e video), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-15-sito-pubblico-vies-design.md`

## Global Constraints

- Origine canonica: `https://portale.tecnomga.com` (`VITE_SITE_ORIGIN` la sostituisce).
- Lingue e prefissi: `it` → `/`, `en` → `/en/`, `zh` → `/zh/`; `hreflang`: `it`, `en`, `zh-Hans`, `x-default` → inglese.
- Titoli 50-60 caratteri e descrizioni 150-160 per italiano e inglese; valori esatti nel §6.9 della spec.
- Nessuno script in linea eseguibile. JSON-LD ammesso (blocco dati).
- JavaScript dell'ingresso pubblico sotto 150 kB compressi (gzip).
- La CSP del portale riservato non cambia; gli indirizzi di Google compaiono solo nella regola delle pagine pubbliche.
- Ogni pagina riservata resta `noindex, nofollow, noarchive` (intestazione e meta nel guscio).
- Nessun prezzo, nessun nome di compagnia, nessun dato di clienti reali, nessun numero non verificabile.
- Dati societari: Tecno Advance MGA Broker Srl · RUI B000746484 · P.IVA 17460381001 · Sede legale Via Po, 102 - 00198 Roma · Sede operativa Via Michele Mercati, 18 - 00197 Roma · Tel. 06.97638088 · PEC tecnoadvancemgabroker@legalmail.it · vies@tecnomga.com.
- Testi visibili all'utente del portale in italiano; commit in italiano con i trailer della sessione.
- Higgsfield: tetto di 150 crediti.
- Funzioni `/api`: nessuna nuova funzione, solo una rotta di `api/vies-connect.ts`.

## Review Focus

1. **Una rotta riservata resta senza «non indicizzare»** (es. `/dashboard`, `/api/health`, `/app.html`): deve avere `X-Robots-Tag`. Test in Task 2.
2. **Modulo abusato**: campo trappola compilato, invio in meno di 3 secondi, più di 5 invii l'ora dallo stesso indirizzo, campi enormi, HTML nel messaggio. Atteso: nessuna email, nessun errore visibile al bot, testo sempre con escape. Test in Task 5.
3. **Email non recapitata**: la richiesta resta salvata con l'errore e chi scrive vede comunque la conferma. Test in Task 5.
4. **Visitatore senza JavaScript o crawler di IA**: titolo, testo e recapiti nell'HTML; il modulo mostra l'indirizzo email come alternativa. Test in Task 4 e nello script di controllo della build.
5. **Consenso**: nessuna richiesta a Google prima della scelta né dopo il rifiuto; scelta scaduta dopo 180 giorni; identificativi assenti. Test in Task 6.
6. **Traduzione mancante**: una chiave assente in una lingua non deve produrre una pagina monca. Test di parità in Task 4.

---

## File Structure

| File | Responsabilità |
|---|---|
| `vite/public-site-plugin.ts` | Plugin: middleware in sviluppo; nella build scrive pagine, `sitemap.xml`, `llms.txt`, rinomina `index.html` in `app.html` |
| `src/site/config.ts` | Origine, lingue, dati societari, variabili d'ambiente del sito |
| `src/site/routes.ts` | Elenco delle pagine pubbliche con i percorsi per lingua |
| `src/site/render.tsx` | `renderPage`, `renderAll`: da percorso a documento HTML |
| `src/site/seo.ts` | Tag della testata: titolo, descrizione, canonico, alternative, social |
| `src/site/schema.ts` | Dati strutturati JSON-LD |
| `src/site/sitemap.ts` | `buildSitemapXml`, `buildLlmsTxt` |
| `src/site/content/{types,it,en,zh}.ts` | Tutti i testi, tipizzati |
| `src/site/components/*.tsx` | Layout, barra, piè di pagina, sezioni, modulo, banner |
| `src/site/pages/{Home,Privacy,Cookie}.tsx` | Le tre pagine della prima consegna |
| `src/site/site.css` | Vetro, movimento, tipografia del sito |
| `src/site/client/*.ts` | Ingresso del browser: menu, comparsa, video, lingua, modulo, consenso |
| `src/site/consent-core.ts` | Logica pura del consenso |
| `api/_lib/contact-requests.ts` | Validazione, antispam, salvataggio, email |
| `supabase/migrations/20261115000000_contact_requests.sql` | Tabella e permessi |
| `src/components/settings/admin/ContactRequests.tsx` | Elenco per gli amministratori |
| `public/site-media/*` | Video, immagini, immagini per i social |
| `scripts/check-public-site.mjs` | Controllo della build pubblicata |

---

### Task 1: Infrastruttura delle pagine pubbliche

**Files:**
- Create: `vite/public-site-plugin.ts`, `src/site/config.ts`, `src/site/routes.ts`, `src/site/render.tsx`, `src/site/client/main.ts`, `src/site/site.css`, `scripts/check-public-site.mjs`
- Modify: `vite.config.ts`, `index.html` (meta robots nel guscio), `vercel.json` (riscrittura finale verso `/app.html`), `src/App.tsx` (rotta `/`), `src/components/dashboard/DashboardLayout.tsx:154` (logo verso `/dashboard`), `.github/workflows/*.yml` (passo di controllo dopo la build), `package.json` (`test:public-site`)
- Delete: `src/pages/Index.tsx`, `src/components/LoginDialog.tsx` se non più usato
- Test: `tests/site/render.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/site/config.ts
  export type Lang = "it" | "en" | "zh";
  export const LANGS: Lang[];
  export const HREFLANG: Record<Lang, string>;          // it, en, zh-Hans
  export const LANG_PREFIX: Record<Lang, string>;       // "", "/en", "/zh"
  export interface SiteEnv { origin: string; ga4Id?: string; adsId?: string; adsConversionLabel?: string; gscVerification?: string; bingVerification?: string }
  export const readSiteEnv: (env: Record<string, string | undefined>) => SiteEnv;
  export const COMPANY: { name; rui; vat; legalSeat; office; phone; pec; email };
  // src/site/routes.ts
  export type PageId = "home" | "privacy" | "cookie";
  export interface PageRef { id: PageId; lang: Lang; path: string }   // path con barra finale: "/", "/en/", "/privacy/"
  export const listPages: () => PageRef[];
  export const pathOf: (id: PageId, lang: Lang) => string;
  // src/site/render.tsx
  export interface SiteAssets { css: string[]; js: string }
  export const renderPage: (path: string, assets: SiteAssets, env: SiteEnv) => string | null;   // null se il percorso non è pubblico
  export const renderAll: (assets: SiteAssets, env: SiteEnv) => Array<{ path: string; html: string }>;
  ```
- Percorsi della prima consegna: `/`, `/privacy/`, `/cookie/` e gli stessi sotto `/en/` e `/zh/` (9 pagine). `renderPage` accetta il percorso con o senza barra finale.

- [ ] **Step 1: test che fallisce** in `tests/site/render.test.ts`:
  - `listPages()` ha 9 voci e percorsi unici;
  - `renderPage("/", assets, env)` inizia con `<!doctype html>`, contiene `<html lang="it"`, un solo `<h1`, il `<link rel="stylesheet"` e lo `<script type="module"` passati in `assets`;
  - `renderPage("/en", …)` e `renderPage("/en/", …)` danno lo stesso documento con `lang="en"`; `/zh/` ha `lang="zh-Hans"`;
  - `renderPage("/dashboard", …)` è `null`.
- [ ] **Step 2:** `npx vitest run tests/site/render.test.ts` → FAIL (modulo assente).
- [ ] **Step 3:** implementare `config.ts`, `routes.ts`, `render.tsx` con una pagina minima per ogni voce (titolo e H1 provvisori presi dal §6.9).
- [ ] **Step 4:** `vite/public-site-plugin.ts`:
  - `configureServer`: per GET su un percorso pubblico rende con `server.ssrLoadModule("/src/site/render.tsx")` e risponde HTML con `assets = { css: [], js: "/src/site/client/main.ts" }` più `/@vite/client`; serve anche `/sitemap.xml` e `/llms.txt`.
  - `config`: aggiunge `build.manifest = true` e `rollupOptions.input = { main: "index.html", site: "src/site/client/main.ts" }`.
  - `closeBundle` (solo build): legge `dist/.vite/manifest.json`, apre un server Vite in modalità middleware per `ssrLoadModule`, rinomina `dist/index.html` in `dist/app.html`, scrive ogni pagina in `dist/<percorso>/index.html`, poi `sitemap.xml` e `llms.txt`, chiude il server.
- [ ] **Step 5:** `index.html`: `<meta name="robots" content="noindex, nofollow, noarchive">`. `vercel.json`: ultima riscrittura `/(.*)` → `/app.html`; `Cache-Control: no-cache` anche per `/app.html`. `src/App.tsx`: rotta `/` → `<Navigate to="/dashboard" replace />`. Logo del portale → `/dashboard`.
- [ ] **Step 6:** `scripts/check-public-site.mjs` (dopo `vite build`): esistono `dist/app.html` e le 9 pagine; ogni pagina ha testo nel `<body>` oltre 1.500 caratteri e un `<h1>`; `dist/app.html` contiene il meta `noindex` e non contiene `<h1>`; il JavaScript dell'ingresso `site` pesa meno di 150 kB gzip; nessuna pagina pubblica referenzia il file JavaScript di `main`.
- [ ] **Step 7:** `npx vitest run tests/site`, `npx vite build && node scripts/check-public-site.mjs` → PASS. Aggiungere il passo alla CI dopo «Build».
- [ ] **Step 8:** commit «Sito pubblico: pagine generate come HTML, guscio del portale separato».

### Task 2: Regole di Vercel per indicizzazione e CSP

**Files:**
- Modify: `vercel.json`, `public/robots.txt`, `scripts/check-csp-connect-hosts.mjs` (solo se serve)
- Test: `tests/server/vercel-config.test.ts`

**Interfaces:**
- Produces: tre regole in `headers`, in quest'ordine:
  1. `/(.*)` — intestazioni di sicurezza comuni (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP).
  2. **Privata** — tutto tranne i percorsi pubblici: `X-Robots-Tag: noindex, nofollow, noarchive` e la CSP attuale, invariata. Resta la prima CSP del file, perché `check-csp-connect-hosts.mjs` legge la prima.
  3. **Pubblica** — `/`, `/en…`, `/zh…`, `/privacy…`, `/cookie…`, `/blog…`, `/rappresentanti-fiscali…`, `/venditori-esteri…`: CSP pubblica, senza `X-Robots-Tag`.
- CSP pubblica: come la privata senza gli indirizzi Supabase e Sentry, più `script-src https://www.googletagmanager.com`; `connect-src https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com https://googleads.g.doubleclick.net https://www.googleadservices.com`; `img-src https://www.googletagmanager.com https://www.google.com https://www.google.it https://googleads.g.doubleclick.net https://*.google-analytics.com`; `frame-src https://td.doubleclick.net https://www.googletagmanager.com`.
- `robots.txt`: `Allow: /`; `Disallow` per `/api/`, `/app.html` e ogni rotta riservata di `src/App.tsx`; gruppi espliciti con `Allow: /` per `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, `Bingbot`; `Sitemap: https://portale.tecnomga.com/sitemap.xml`.

- [ ] **Step 1: test che fallisce** `tests/server/vercel-config.test.ts`, con una funzione `headersFor(path)` che applica le regole come espressioni regolari ancorate:
  - `/dashboard`, `/practices/abc`, `/auth`, `/api/health`, `/app.html`, `/vies`, `/assets/x.js` → `X-Robots-Tag` presente e CSP senza `google`;
  - `/`, `/en/`, `/zh`, `/privacy/`, `/en/cookie/`, `/blog/articolo/` → nessun `X-Robots-Tag`, CSP con `googletagmanager.com`;
  - ogni percorso ha `Strict-Transport-Security` e una sola CSP;
  - ogni `<Route path>` riservato di `src/App.tsx` compare tra i `Disallow` di `public/robots.txt`;
  - l'ultima riscrittura punta a `/app.html`.
- [ ] **Step 2:** FAIL. **Step 3:** scrivere le regole. **Step 4:** `npx vitest run tests/server/vercel-config.test.ts && npm run test:csp-hosts` → PASS.
- [ ] **Step 5:** commit «Sito pubblico: pagine pubbliche indicizzabili, portale ancora privato».

### Task 3: Testata, dati strutturati, sitemap, llms.txt

**Files:**
- Create: `src/site/seo.ts`, `src/site/schema.ts`, `src/site/sitemap.ts`
- Modify: `src/site/render.tsx`, `vite/public-site-plugin.ts`
- Test: `tests/site/seo.test.ts`

**Interfaces:**
- Consumes: `PageRef`, `SiteEnv`, `COMPANY`, contenuti (`title`, `description` per pagina).
- Produces:
  ```ts
  export const headTags: (page: PageRef, meta: { title: string; description: string }, env: SiteEnv) => string;
  export const organizationSchema: (env: SiteEnv) => object;             // InsuranceAgency
  export const serviceSchema: (lang: Lang, env: SiteEnv) => object;
  export const faqSchema: (items: Array<{ q: string; a: string }>) => object;
  export const howToSchema: (lang: Lang, steps: Array<{ name: string; text: string }>, env: SiteEnv) => object;
  export const breadcrumbSchema: (page: PageRef, label: string, env: SiteEnv) => object;
  export const jsonLd: (data: object) => string;                          // <script type="application/ld+json">, con escape di "<"
  export const buildSitemapXml: (env: SiteEnv, today: string) => string;
  export const buildLlmsTxt: (env: SiteEnv) => string;
  ```

- [ ] **Step 1: test che fallisce:**
  - per ogni pagina: canonico assoluto con barra finale; quattro `link rel="alternate"` (`it`, `en`, `zh-Hans`, `x-default`) reciproci tra le tre lingue;
  - titolo e descrizione della homepage in `it` e `en` uguali al §6.9, lunghezze 50-60 e 150-160;
  - `og:title`, `og:description`, `og:url`, `og:image` assoluta, `og:locale`, `twitter:card`;
  - meta di verifica Google e Bing solo se presenti in `env`;
  - ogni JSON-LD si legge con `JSON.parse`; l'organizzazione ha `@type: "InsuranceAgency"`, `name`, `url`, `telephone`, `email`, `address`, `identifier` con il RUI; le domande frequenti hanno una voce per domanda;
  - il testo `</script>` dentro un valore non chiude il blocco;
  - la sitemap elenca le 9 pagine con `xhtml:link` per lingua e `lastmod`; `llms.txt` contiene nome, descrizione, pagine e recapiti.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** PASS.
- [ ] **Step 5:** commit «Sito pubblico: testata, dati strutturati, sitemap e llms.txt».

### Task 4: Homepage nelle tre lingue, vetro e movimento

**Files:**
- Create: `src/site/content/{types,it,en,zh}.ts`, `src/site/components/{Layout,Header,Footer,Hero,TrustStrip,WhatIs,Audiences,Steps,PortalShowcase,Documents,Cost,Faq,Contact,LangNotice}.tsx`, `src/site/pages/Home.tsx`, `src/site/client/{menu,reveal,lang,hero-video}.ts`
- Modify: `src/site/site.css`, `src/site/render.tsx`, `tailwind.config.ts` solo se serve
- Test: `tests/site/content.test.ts`, `e2e/public-site.e2e.mjs`
- Update: `e2e/landing-header.e2e.mjs`, `e2e/login-failure.e2e.mjs`

**Interfaces:**
- Produces: `SiteContent` in `content/types.ts` con le sezioni `meta`, `nav`, `hero`, `trust`, `whatIs`, `audiences`, `steps` (5), `portal`, `documents`, `cost`, `faq` (8-10), `contact`, `footer`, `legalNotice`, `cookieBanner`; `contentFor(lang): SiteContent`.
- Ancore delle sezioni: `cos-e`, `per-chi`, `come-funziona`, `portale`, `documenti`, `costo`, `domande`, `contatti` (uguali nelle tre lingue).
- `data-reveal` sugli elementi che compaiono allo scorrimento; `data-testid` come `site-hero`, `site-nav`, `site-menu-toggle`, `site-lang-<lang>`, `site-portal-link`.
- Contenuto normativo: solo ciò che è verificato su fonte primaria, con link; nota «informazione generale, non consulenza fiscale»; data di aggiornamento.
- Avvertenza nel piè di pagina: «Messaggio pubblicitario con finalità promozionale. Prima della sottoscrizione leggere il set informativo.»

- [ ] **Step 1: test che fallisce** `tests/site/content.test.ts`:
  - le tre lingue hanno le stesse chiavi e le stesse lunghezze di elenchi (parità ricorsiva);
  - nessuna stringa vuota;
  - l'HTML della homepage contiene le otto ancore, i cinque passi, l'H1 del §6.9, RUI, P.IVA, PEC e `vies@tecnomga.com`;
  - nessuna pagina contiene `Markel`, `€ 2.000`, `2.000,00` o un numero pratica `VIES-20`;
  - ogni `<img>` ha `alt`, `width` e `height`; i link interni non contengono «clicca qui» / «click here»;
  - la pagina `/zh/` contiene caratteri cinesi nell'H1.
- [ ] **Step 2:** FAIL. **Step 3:** verificare sulle fonti primarie i fatti normativi, poi scrivere i contenuti e i componenti.
- [ ] **Step 4:** `site.css`: superfici in vetro (`.glass`, `.glass-strong`, `.glass-dark`), aloni, comparsa (`[data-reveal]`), linea dei passi, `@media (prefers-reduced-motion: reduce)` che ferma tutto.
- [ ] **Step 5:** client: menu su telefono, comparsa con `IntersectionObserver`, avviso della lingua del browser, video dell'apertura che non parte con `prefers-reduced-motion` o `navigator.connection.saveData`.
- [ ] **Step 6: e2e** `e2e/public-site.e2e.mjs`: con JavaScript disattivato H1, sezioni e recapiti sono visibili; il menu su telefono si apre; i link di lingua portano a `/en/` e `/zh/`; «Area riservata» porta a `/auth`; nessun errore JavaScript; nessuno scorrimento orizzontale a 360 px.
- [ ] **Step 7:** aggiornare i due e2e esistenti alla nuova homepage. `node e2e/run.mjs public-site landing-header login-failure` → PASS.
- [ ] **Step 8:** commit «Sito pubblico: homepage VIES in italiano, inglese e cinese».

### Task 5: Modulo contatti

**Files:**
- Create: `api/_lib/contact-requests.ts`, `supabase/migrations/20261115000000_contact_requests.sql`, `src/site/client/contact.ts`, `src/components/settings/admin/ContactRequests.tsx`
- Modify: `api/vies-connect.ts` (rotta `contact`), `vercel.json` (riscrittura `/api/contact`), `api/_lib/mailer.ts` (`replyTo` facoltativo), `src/site/components/Contact.tsx`, pagina delle impostazioni degli amministratori, `src/integrations/supabase/types.ts`
- Test: `tests/server/contact-requests.test.ts`, `e2e/public-site.e2e.mjs`, e2e delle impostazioni

**Interfaces:**
- Produces:
  ```ts
  export const CONTACT_ROLES = ["fiscal_representative", "professional_firm", "broker", "foreign_company", "other"] as const;
  export const CONTACT_MIN_ELAPSED_MS = 3000;
  export const CONTACT_MAX_PER_HOUR = 5;
  export interface ContactInput { name; company; role; country; email; phone?; volume?; message; consent: boolean; lang: Lang; website?: string; elapsedMs?: number; page?: string }
  export const validateContact: (body: unknown) => { ok: true; value: ContactInput } | { ok: false; fields: string[] };
  export const isLikelyBot: (input: ContactInput) => boolean;      // campo trappola compilato o tempo sotto soglia
  export async function handleContactRequest(deps: { supabase; sendMail; rateLimit; now: () => Date }, body: unknown, ip: string): Promise<{ status: number; body: Record<string, unknown> }>;
  ```
- `POST /api/contact` (JSON): `200 { ok: true }`; `400 { ok: false, error: "invalid", fields }`; `429 { ok: false, error: "rate_limited" }`; solo POST.
- Limiti: nome e società 120 caratteri, paese 80, email 200 valida, telefono 40, pratiche stimate 40, messaggio 10-4000.
- Tabella `contact_requests`: `id`, `created_at`, `name`, `company`, `role`, `country`, `email`, `phone`, `volume`, `message`, `lang`, `page`, `email_sent`, `email_error`, `status` (`new`/`handled`), `handled_at`, `handled_by`. RLS attiva; lettura e aggiornamento solo agli amministratori; nessuna policy di inserimento. Nessun indirizzo IP salvato.
- Email a `CONTACT_INBOX` (predefinito `vies@tecnomga.com`), oggetto `Richiesta di contatto VIES: <società> (<paese>)`, `replyTo` il richiedente, valori con `escapeHtml`.

- [ ] **Step 1: test che falliscono:** campi obbligatori e limiti; consenso mancante → 400; campo trappola o tempo sotto 3 secondi → 200 senza salvataggio né email; sesto invio in un'ora → 429; invio valido → riga salvata e una email con `replyTo`; email fallita → 200, riga con `email_sent = false` e `email_error`; `<script>` nel messaggio compare con escape nell'HTML dell'email; metodo GET → 405.
- [ ] **Step 2:** FAIL. **Step 3:** implementare libreria, rotta, migrazione, `replyTo`. **Step 4:** PASS; migrazione provata sul database locale.
- [ ] **Step 5:** modulo nel browser: invio con `fetch`, stati «invio», «inviato», «errore» annunciati (`aria-live`), errori per campo, `<noscript>` con l'indirizzo email. e2e: invio riuscito, errore del server, campi mancanti.
- [ ] **Step 6:** elenco per amministratori con stato e «segna come gestita»; e2e: l'amministratore vede e aggiorna, l'agente non vede la voce.
- [ ] **Step 7:** commit «Sito pubblico: modulo contatti verso vies@tecnomga.com con elenco per gli amministratori».

### Task 6: Privacy, cookie, consenso e Google

**Files:**
- Create: `src/site/consent-core.ts`, `src/site/client/consent.ts`, `src/site/components/CookieBanner.tsx`, `src/site/pages/{Privacy,Cookie}.tsx`
- Modify: contenuti nelle tre lingue, `src/site/render.tsx`, `e2e/run.mjs` (identificativi di prova)
- Test: `tests/site/consent.test.ts`, `e2e/public-site.e2e.mjs`

**Interfaces:**
- Produces:
  ```ts
  export const CONSENT_KEY = "tecno-consent-v1";
  export const CONSENT_MAX_AGE_DAYS = 180;
  export interface ConsentChoice { statistics: boolean; marketing: boolean; decidedAt: string }
  export const parseConsent: (raw: string | null, now: Date) => ConsentChoice | null;
  export const serializeConsent: (choice: Omit<ConsentChoice, "decidedAt">, now: Date) => string;
  export const gtagConsent: (choice: ConsentChoice) => Record<"ad_storage" | "ad_user_data" | "ad_personalization" | "analytics_storage", "granted" | "denied">;
  export const googleTagsToLoad: (choice: ConsentChoice | null, ids: { ga4Id?: string; adsId?: string }) => string[];
  ```
- Gli identificativi arrivano al browser come attributi `data-ga4`, `data-ads`, `data-ads-conversion` su `<html>`.
- Banner: «Accetta», «Rifiuta», «Personalizza» con lo stesso stile; la chiusura vale rifiuto; link «Preferenze cookie» nel piè di pagina che lo riapre. Senza identificativi il banner non compare.
- Conversione: evento `generate_lead` e, con `adsConversionLabel`, `conversion` all'invio riuscito del modulo.

- [ ] **Step 1: test che falliscono:** scelta assente, non valida o più vecchia di 180 giorni → `null`; rifiuto → tutto `denied` e nessun tag; solo statistiche → carica solo Analytics; marketing senza identificativo Ads → nulla; senza identificativi → nulla.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** PASS.
- [ ] **Step 5: e2e** con identificativi di prova: prima della scelta zero richieste verso `googletagmanager.com` e `google-analytics.com`; dopo «Rifiuta» zero, e il banner non torna al ricaricamento; dopo «Accetta» parte `gtag/js?id=`; «Preferenze cookie» riapre il banner.
- [ ] **Step 6:** pagine Privacy e Cookie nelle tre lingue, dall'informativa già usata nel portale, con i fornitori reali (Supabase, Vercel, servizio di posta, Google solo con consenso) e l'elenco dei cookie.
- [ ] **Step 7:** commit «Sito pubblico: privacy, cookie e misurazione con consenso».

### Task 7: Grafica

**Files:**
- Create: `public/site-media/*` (video in ciclo, immagine fissa, due o tre immagini astratte, immagini per i social per lingua), `scripts/site/og-images.mjs`
- Modify: `src/site/components/Hero.tsx` e sezioni, `scripts/check-public-site.mjs`

- [ ] **Step 1:** Higgsfield: scegliere il modello con `models_explore`, generare l'immagine dell'apertura e il video in ciclo (forme astratte di vetro e luce, blu `#0F3A5C` e bronzo `#B08968`, niente persone né testo), più due o tre immagini. Tetto 150 crediti; annotare la spesa.
- [ ] **Step 2:** `ffmpeg`: video in WebM e MP4, senza audio, al massimo 1,5 MB ciascuno; immagini in WebP con dimensioni dichiarate.
- [ ] **Step 3:** immagini per i social 1200×630 generate da un modello HTML con Chromium, una per lingua.
- [ ] **Step 4:** `check-public-site.mjs`: ogni file di `public/site-media` rispetta i limiti di peso; l'apertura ha `poster`, `muted`, `playsinline`, `preload="none"`.
- [ ] **Step 5:** controllo visivo con schermate a 390 px e 1440 px nelle tre lingue; correggere ciò che non regge.
- [ ] **Step 6:** commit «Sito pubblico: grafica dell'apertura e immagini».

### Task 8: Chiusura

- [ ] `CHANGELOG.md` (sezione «Aggiunto»), `docs/public-site.md` (come aggiungere una pagina, variabili d'ambiente, cosa serve dal titolare).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:checks`, `npm test`, `npx vite build && node scripts/check-public-site.mjs`, `npm run test:e2e`.
- [ ] Skill SearchFit `seo-audit` sulle pagine generate; correggere i rilievi.
- [ ] PR con anteprima; verificare sull'anteprima con `curl -I` le intestazioni di `/`, `/en/`, `/dashboard`, `/api/health`.
- [ ] Unione e pubblicazione solo con l'ok del titolare.
