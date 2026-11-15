# Sito pubblico VIES, seconda consegna: blog, pagine per pubblico, feed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiungere al sito pubblico un blog con otto articoli firmati, due pagine per pubblico e il feed, nelle tre lingue, perché Google e i motori di risposta trovino e citino Tecno sulle domande informative intorno alla garanzia VIES.

**Architecture:** le pagine nuove usano la stessa generazione in HTML della prima consegna (`vite/public-site-plugin.ts`, `src/site/render.tsx`). Gli articoli sono moduli TypeScript tipizzati, uno per articolo e per lingua, letti da un registro; un articolo è una pagina con il proprio percorso per lingua. Nessuna libreria nuova, nessun HTML libero nei contenuti.

**Tech Stack:** React (solo `renderToStaticMarkup`), TypeScript, Vite 5, Vitest, Playwright, `src/site/site.css`.

**Spec:** `docs/superpowers/specs/2026-11-15-sito-pubblico-vies-design.md` (§6.1, §6.2 punto 11, §6.4, §6.5, §6.8, §6.9, §7).

## Global Constraints

- Testi dell'interfaccia e degli articoli in italiano, inglese e cinese semplificato; stessa struttura nelle tre lingue.
- Nessun prezzo, nessun nome di compagnia, nessun dato di clienti reali, nessun numero non verificabile, nessun tempo di emissione.
- Ogni affermazione normativa viene solo dalla tabella «Fatti verificati» qui sotto, con la fonte collegata nell'articolo.
- Titoli: 50-60 caratteri in italiano e inglese, parola chiave all'inizio; descrizioni 150-160; un solo H1 per pagina.
- Risposta diretta di 40-60 parole (italiano e inglese) in apertura di ogni articolo e sotto ogni domanda frequente.
- Solo il titolo sopra ogni sezione: nessuna scritta piccola prima dei titoli, nessun sottotitolo sotto (richiesta del titolare). Le briciole di pane stanno nei dati strutturati, non sopra l'H1.
- Autore degli articoli: Anton Carlo Santoro, Tecno Advance MGA Broker Srl (nessuna qualifica inventata).
- Nota su ogni contenuto normativo: informazione generale, non consulenza fiscale o legale.
- Le pagine riservate restano `noindex`; nessuno script in linea; JavaScript del sito sotto 150 kB compressi.
- Un gruppo di parole chiave = una pagina. La homepage tiene «fideiussione VIES»; gli articoli non la usano come parola chiave principale.

## Fatti verificati (15/11/2026)

| Fatto | Fonte |
|---|---|
| Obbligati: soggetti non residenti in UE o SEE con rappresentante fiscale ex art. 17 c. 3, per chiedere o mantenere l'inclusione nel VIES | Provv. AdE prot. 178713/2025 del 14/4/2025, p. 1.1; art. 35 c. 7-quater DPR 633/1972 |
| Chi ha già la partita IVA presta la garanzia prima della richiesta di inclusione; chi non l'ha, insieme alla dichiarazione di inizio attività | Provv. 178713/2025, p. 2.1-2.2 |
| Forme: cauzione in titoli di Stato o garantiti dallo Stato, polizza fideiussoria, fideiussione bancaria (art. 1 L. 348/1982); massimale minimo 50.000 euro | p. 2.3 |
| A favore del Direttore pro tempore della Direzione Provinciale competente per il domicilio fiscale del rappresentante fiscale; consegnata personalmente o tramite il rappresentante fiscale | p. 2.4 |
| Contenuto della cauzione (deposito vincolato, eventuale terzo intestatario, composizione del deposito…) e di polizza o fideiussione (fideiussore, inadempimento, rinuncia alla preventiva escussione e surrogazione, foro…) | p. 2.5-2.6 |
| Durata non inferiore a 36 mesi dalla consegna | p. 2.7 |
| La Direzione Provinciale verifica la conformità e comunica l'esito; da allora si può chiedere l'inclusione (Provv. prot. 159941 del 15/12/2014) | p. 2.8-2.9 |
| Già inclusi al 14/4/2025: 60 giorni; poi comunicazione al rappresentante fiscale (PEC o raccomandata), altri 60 giorni, esclusione d'ufficio | p. 3.1-3.4 |
| DM MEF 4/12/2024, GU n. 292 del 13/12/2024; comma 7-quater introdotto dall'art. 4 c. 1 lett. b) D.Lgs. 13/2024 | Provv. 178713/2025, motivazioni |
| Il rappresentante fiscale che trasmette la dichiarazione con l'opzione VIES deve verificare la completezza del corredo documentale e informativo e la corrispondenza alle notizie in suo possesso | art. 35 c. 7-quater, terzo periodo (Normattiva) |
| L'opzione determina l'inclusione nel VIES; senza elenchi riepilogativi per quattro trimestri consecutivi si presume la rinuncia e l'Agenzia esclude la partita IVA previa comunicazione | art. 35 c. 2 lett. e-bis) e c. 7-bis |
| Dal 1/1/2027: Testo unico IVA, D.Lgs. 10/2026; garanzia nell'art. 68 c. 10; inclusione ed esclusione nell'art. 68 c. 9; identificazione diretta nell'art. 70; i riferimenti alle norme abrogate valgono per le nuove (art. 170 c. 3) | Normattiva |
| Non residenti senza stabile organizzazione: adempiono direttamente se identificati ex art. 35-ter, oppure tramite rappresentante residente nominato nelle forme dell'art. 1 c. 4 DPR 441/1997; il rappresentante risponde in solido; la nomina è comunicata all'altro contraente prima dell'operazione | art. 17 c. 3 DPR 633/1972 (Normattiva) |
| Identificazione diretta: solo per chi esercita l'attività in un altro Stato UE o in un Paese terzo con strumenti di reciproca assistenza in materia di imposizione indiretta | art. 35-ter c. 5 (= art. 70 c. 5 TU) |
| Opzione VIES: campo «Operazioni intracomunitarie» del quadro I dei modelli AA7 (soggetti diversi dalle persone fisiche) o AA9, oppure dopo, per via telematica | Scheda AdE «Inclusione archivio Vies» |
| Rappresentante fiscale: requisiti dell'art. 8 c. 1 lett. a)-d) DM 164/1999, attestati con dichiarazione ex artt. 46-47 DPR 445/2000; garanzia graduata sul numero dei rappresentati | art. 17 c. 3; Provv. AdE prot. 186368/2025 del 17/4/2025, p. 1.1, 2.1 |
| Garanzia del rappresentante: 30.000 euro (2-9 rappresentati), 100.000 (10-50), 300.000 (51-100), 1.000.000 (101-1.000), 2.000.000 (oltre 1.000); nessuna garanzia con un solo rappresentato | Provv. 186368/2025, p. 3.3-3.4 |
| Garanzia del rappresentante: a favore del Direttore pro tempore della DP del domicilio fiscale del rappresentante, consegnata personalmente; almeno 48 mesi dalla consegna; fascia superiore = nuova garanzia, poi liberazione della precedente | p. 3.5, 3.8, 3.9, 3.12 |
| Rappresentanti già operanti al 17/4/2025: 60 giorni, comunicazione, altri 60, cessazione d'ufficio delle partite IVA dei rappresentati | p. 4.1-4.4 |
| DM MEF 9/12/2024, GU n. 297 del 19/12/2024; periodo aggiunto all'art. 17 c. 3 dall'art. 4 c. 1 lett. a) D.Lgs. 13/2024 | Provv. 186368/2025, motivazioni |
| Art. 1 L. 348/1982: a) reale e valida cauzione; b) fideiussione bancaria (aziende di credito o confidi vigilati dalla Banca d'Italia); c) polizza assicurativa di impresa autorizzata al ramo cauzioni, operante in Italia in stabilimento o libera prestazione di servizi | Normattiva |
| Firma elettronica qualificata: effetti giuridici equivalenti alla firma autografa; riconosciuta in tutti gli Stati membri | Reg. (UE) 910/2014, art. 25 par. 2-3 (EUR-Lex) |
| Documento informatico con firma digitale: forma scritta ed efficacia dell'art. 2702 c.c.; firma con certificato scaduto, revocato o sospeso = mancata sottoscrizione | D.Lgs. 82/2005, art. 20 c. 1-bis, art. 24 c. 3 e 4-bis (Normattiva) |
| Formati di firma riconosciuti: XML, CMS, PDF (XAdES, CAdES, PAdES) | Decisione di esecuzione (UE) 2015/1506, art. 1 |

Dal portale (verificato sul codice e su `docs/vies-lot-cycle.md`): lotti fino a 20 pratiche; modello Excel con i fogli CONTRAENTE, RAPPRESENTANTE FISCALE, BENEFICIARIO e colonna ZIP; uno ZIP di documenti per società; lettura automatica dei documenti, riconoscimento del tipo, confronto dei dati, cifra di controllo del codice unificato di credito sociale, documenti d'identità scaduti segnalati; per Hong Kong Certificate of Incorporation e/o Business Registration Certificate; otto passaggi del lotto (bozze, verifica, pagamento, conferma, copie, firme, invio, emesse); la bozza si controlla e non si firma; estratto conto del lotto firmato da chi paga; firma in blocco e ricaricamento (PDF o .p7m, anche buste con due firme); copie per il beneficiario non da ricaricare; scadenzario con avviso a 30 giorni; API.

## Mappa parole chiave → pagine (skill SearchFit `keyword-clustering`)

| Pagina | Id | Parola chiave (it) | Intento |
|---|---|---|---|
| `/` | home | fideiussione VIES | commerciale |
| `/rappresentanti-fiscali/` · `/en/fiscal-representatives/` | representatives | fideiussione VIES rappresentante fiscale | commerciale, tra aziende |
| `/venditori-esteri/` · `/en/non-eu-sellers/` | sellers | garanzia VIES società extra UE | commerciale |
| `/blog/` | blog | garanzia VIES guida | informativo (hub) |
| `/blog/garanzia-vies-cos-e-chi-deve-prestarla/` | garanzia-vies | garanzia VIES cos'è | informativo (pilastro) |
| `/blog/cauzione-fideiussione-bancaria-polizza-fideiussoria/` | forme-garanzia | cauzione o polizza fideiussoria VIES | confronto |
| `/blog/documenti-fideiussione-vies/` | documenti | documenti garanzia VIES società estera | informativo |
| `/blog/dalla-richiesta-alla-polizza-vies/` | richiesta-polizza | come ottenere la polizza VIES | guida |
| `/blog/lotto-20-pratiche-vies-rappresentanti-fiscali/` | lotto-pratiche | lotto pratiche VIES | guida, tra aziende |
| `/blog/polizze-firmate-digitalmente-p7m/` | firma-p7m | polizza p7m firma digitale | informativo |
| `/blog/garanzia-rappresentante-fiscale-e-garanzia-vies/` | garanzia-rappresentante | garanzia rappresentante fiscale | confronto |
| `/blog/venditori-extra-ue-partita-iva-vies/` | venditori-marketplace | partita IVA italiana società extra UE | guida |

Inglese e cinese usano lo stesso segmento inglese (`/en/blog/<slug>/`, `/zh/blog/<slug>/`). Nessun volume di ricerca: l'account Search Console collegato non ha proprietà.

Collegamenti interni (skill `internal-linking`): indice del blog = hub; ogni articolo collega almeno tre pagine (altri articoli, una pagina per pubblico, la homepage) con testo descrittivo e torna all'indice; le pagine per pubblico collegano le loro guide; la homepage mostra tre guide e collega le due pagine dai riquadri «Per chi».

## Review Focus

1. Un collegamento nel testo verso un articolo o una pagina che non esiste: deve far fallire i test, non generare un link rotto.
2. Cambio lingua da un articolo: porta alla traduzione dello stesso articolo (segmento diverso), non alla homepage.
3. Tabelle larghe degli articoli su telefono: scorrono nel riquadro, la pagina non esce dal bordo.
4. Un percorso pubblico nuovo dimenticato in `vercel.json` risponderebbe `noindex` con la CSP del portale: i test delle regole coprono un percorso per ogni prefisso.
5. Feed e sitemap con caratteri speciali (`&`, virgolette, cinese): XML ben formato.

---

### Task 1: Modello degli articoli, rotte per lingua, articolo guida

**Files:**
- Create: `src/site/blog/types.ts`, `src/site/blog/index.ts`, `src/site/blog/articles/{it,en,zh}/garanzia-vies.ts`, `src/site/inline.ts`, `src/site/meta.ts`
- Modify: `src/site/routes.ts`, `src/site/content/types.ts`, `src/site/content/{it,en,zh}.ts` (meta di `representatives`, `sellers`, `blog`)
- Test: `tests/site/blog.test.ts`, `tests/site/render.test.ts`

**Interfaces:**
- Produces:
  - `type ArticleId` (gli otto id della mappa), `ARTICLE_IDS`, `Block = {type:"p";text} | {type:"list";items:string[]} | {type:"steps";items:Array<{title;text}>} | {type:"table";columns:string[];rows:string[][]} | {type:"note";text}`, `ArticleSection {id;heading;blocks}`, `Article {slug;title;description;h1;label;keyword;summary;sections;faq;sources}`, `ArticleEntry {id;published;updated;related:ArticleId[];content:Record<Lang,Article>}`
  - `ARTICLES: ArticleEntry[]`, `articleOf(id): ArticleEntry`, `AUTHOR = { name: "Anton Carlo Santoro" }`
  - `type StaticPageId = "home"|"representatives"|"sellers"|"blog"|"privacy"|"cookie"`, `type PageId = StaticPageId | ArticleId`, `isArticleId(id)`, `pageKind(id): "home"|"audience"|"blog"|"article"|"legal"`, `pathOf(id, lang)`, `listPages()`, `findPage(path)`
  - `metaOf(page: PageRef): PageMeta`
  - `parseInline(text): Array<string | {label:string; target:string}>`, `resolveTarget(target, lang): {href:string; external:boolean} | null` con i bersagli `article:<id>`, `page:<StaticPageId>`, `section:<anchor>`, `https://…`

- [ ] **Step 1:** test in `tests/site/blog.test.ts`: per ogni articolo registrato e ogni lingua: segmento `^[a-z0-9]+(-[a-z0-9]+)*$`; titolo 50-60 e descrizione 150-160 (it, en); riassunto 40-60 parole (it, en); stesse sezioni (id, tipi dei blocchi, numero di righe e voci) nelle tre lingue; almeno 3 domande con risposta 40-60 parole (it, en); almeno 3 collegamenti interni, tutti risolti da `resolveTarget`; fonti `https://`; `related` valido con almeno 2 voci; testo senza `Markel`, senza `€ ` seguito da cifre diverse dagli importi di legge. Rotte: `pathOf("garanzia-vies","en") === "/en/blog/vies-guarantee-italy-explained/"`, `findPage` trova l'articolo, `listPages()` senza doppioni.
- [ ] **Step 2:** `npx vitest run tests/site/blog.test.ts` → FAIL (moduli mancanti).
- [ ] **Step 3:** implementare tipi, registro, rotte, `metaOf`, `inline.ts`; scrivere l'articolo `garanzia-vies` nelle tre lingue.
- [ ] **Step 4:** `npx vitest run tests/site` → PASS.
- [ ] **Step 5:** commit.

### Task 2: Pagina articolo, indice del blog, testata, dati strutturati

**Files:**
- Create: `src/site/components/Inline.tsx`, `src/site/components/Blocks.tsx`, `src/site/components/GuideCards.tsx`, `src/site/pages/ArticlePage.tsx`, `src/site/pages/BlogIndex.tsx`
- Modify: `src/site/render.tsx`, `src/site/seo.ts`, `src/site/schema.ts`, `src/site/site.css`, `src/site/content/types.ts` e `{it,en,zh}.ts` (`blog`: etichette)
- Test: `tests/site/blog-pages.test.ts`, `tests/site/seo.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `headTags(page, meta, env, extra?: { article?: {published; updated; author}; feed?: {href; title} })`; `articleSchema(page, entry, env)` (`BlogPosting`), `blogSchema(page, meta, env)` (`Blog` con `blogPost`), `breadcrumbSchema(items: Array<{name; path}>, env)`; `SiteContent.blog`.

- [ ] **Step 1:** test: l'HTML dell'articolo ha un solo H1, autore e date (`<time datetime>`), riassunto, sezioni con `id`, domande, fonti con `rel="noopener noreferrer"`, guide collegate, link all'indice; `og:type` `article`, `article:published_time`, `<meta name="author" content="Anton Carlo Santoro">`; JSON-LD `BlogPosting` (headline, datePublished, dateModified, author Person, publisher, inLanguage, mainEntityOfPage), `FAQPage`, `BreadcrumbList` a tre voci; `hreflang` reciproci con i segmenti per lingua; l'indice elenca gli articoli con link e ha JSON-LD `Blog`.
- [ ] **Step 2:** eseguire → FAIL. **Step 3:** implementare. **Step 4:** `npx vitest run tests/site` → PASS. **Step 5:** commit.

### Task 3: Pagine per pubblico e collegamenti dalla homepage

**Files:**
- Create: `src/site/content/audience/{it,en,zh}.ts`, `src/site/pages/AudiencePage.tsx`, `src/site/components/LatestGuides.tsx`
- Modify: `src/site/content/types.ts`, `{it,en,zh}.ts`, `src/site/components/{Audiences,Header,Footer}.tsx`, `src/site/pages/Home.tsx`, `src/site/render.tsx`, `src/site/site.css`
- Test: `tests/site/audience-pages.test.ts`, `tests/site/content.test.ts`

**Interfaces:**
- Produces: `SiteContent.audiencePages: Record<"representatives"|"sellers", { lead; sections: ArticleSection[]; faq; cta: {title; text; button}; guides: ArticleId[] }>`; `nav.guides`; `audiences.items[].more`.

- [ ] **Step 1:** test: le due pagine nelle tre lingue hanno H1 della mappa, stesse sezioni, domande, JSON-LD `Service` + `FAQPage` + `BreadcrumbList`, collegano le loro guide e i contatti; i riquadri «Per chi» della homepage collegano le due pagine; la homepage mostra tre guide; barra e piè di pagina collegano il blog.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** PASS. **Step 5:** commit.

### Task 4: Sitemap, llms.txt, feed, regole Vercel, controllo della build

**Files:**
- Modify: `src/site/sitemap.ts`, `src/site/render.tsx` (`renderExtraFiles`), `vite/public-site-plugin.ts`, `vercel.json`, `scripts/check-public-site.mjs`
- Test: `tests/site/seo.test.ts`, `tests/site/feed.test.ts`, `tests/server/vercel-config.test.ts`

**Interfaces:**
- Produces: `buildFeed(env, lang): string` (Atom 1.0) servito in `/blog/feed.xml`, `/en/blog/feed.xml`, `/zh/blog/feed.xml`; `lastmod` dell'articolo = `updated`.

- [ ] **Step 1:** test: sitemap con tutte le pagine e la data dell'articolo; llms.txt con le guide; feed ben formato con escape; `vercel.json`: `/blog/`, `/blog/x/`, `/rappresentanti-fiscali/`, `/venditori-esteri/`, `/en/blog/x/`, `/blog/feed.xml` pubblici con la CSP pubblica; `/blogger`, `/venditori` restano privati.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** `npx vitest run tests/site tests/server/vercel-config.test.ts` e `npx vite build && npm run test:public-site` → PASS. **Step 5:** commit.

### Task 5: Articoli 2-4

**Files:** Create `src/site/blog/articles/{it,en,zh}/{forme-garanzia,documenti,richiesta-polizza}.ts`; Modify `src/site/blog/index.ts`.

- [ ] Registrare ogni articolo (i test del Task 1 valgono per tutti), scrivere le tre lingue, `npx vitest run tests/site` → PASS, commit.

### Task 6: Articoli 5-8

**Files:** Create `src/site/blog/articles/{it,en,zh}/{lotto-pratiche,firma-p7m,garanzia-rappresentante,venditori-marketplace}.ts`; Modify `src/site/blog/index.ts`; Test `tests/site/blog.test.ts`.

- [ ] **Step 1:** test «il registro contiene gli otto articoli del progetto, nell'ordine della mappa» → FAIL.
- [ ] **Step 2:** scrivere gli articoli → PASS, commit.

### Task 7: Browser, documentazione, audit, PR

**Files:** Modify `e2e/public-site.e2e.mjs`, `e2e/responsive.e2e.mjs`, `docs/public-site.md`, `docs/testing.md`, `CHANGELOG.md`.

- [ ] Scenari: indice del blog e un articolo senza JavaScript; cambio lingua dall'articolo; pagina per pubblico; articolo con tabella su telefono senza scorrimento orizzontale della pagina.
- [ ] `npm run lint && npm run typecheck && npm run test:checks && npm test && node scripts/audit-gate.mjs && npx vite build && npm run test:public-site`; `node e2e/run.mjs public-site landing-header responsive`.
- [ ] Audit SEO sulle pagine generate (skill `seo-audit`), correzioni, PR.
