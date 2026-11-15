# Sito pubblico VIES

*La parte pubblica di `portale.tecnomga.com`: una homepage sulla garanzia VIES in italiano, inglese e cinese, le pagine Privacy e Cookie, il modulo di contatto verso `vies@tecnomga.com`. Le pagine sono HTML completo generato alla build, leggibile da motori di ricerca e motori di risposta senza JavaScript; il portale riservato resta dietro `/auth` e non è indicizzabile. Progetto in `docs/superpowers/specs/2026-11-15-sito-pubblico-vies-design.md`.*

## SECTION 01 — Cosa viene pubblicato

| Indirizzo | Contenuto |
|---|---|
| `/`, `/en/`, `/zh/` | Homepage: apertura, fascia di fiducia, cos'è la garanzia, per chi, cinque passi, il portale, documenti, costo, domande frequenti, contatti. Ogni sezione ha il solo titolo: nessuna scritta sopra, nessun sottotitolo sotto |
| `/privacy/`, `/en/privacy/`, `/zh/privacy/` | Informativa sulla privacy del sito e del modulo |
| `/cookie/`, `/en/cookie/`, `/zh/cookie/` | Cosa il sito salva nel browser, per nome |
| `/sitemap.xml` | Le nove pagine con le alternative per lingua e la data della build |
| `/llms.txt` | Il sito descritto ai motori basati su IA |
| `/robots.txt` | Apre il sito ai crawler (anche delle IA), chiude solo `/api/` |
| `/site-media/*` | Immagini, video dell'apertura, immagini per i social |
| `/app.html` | Il guscio del portale riservato: lo riceve ogni altro indirizzo |

Le ancore delle sezioni sono uguali nelle tre lingue: `#cos-e`, `#per-chi`, `#come-funziona`, `#portale`, `#documenti`, `#costo`, `#domande`, `#contatti`.

## SECTION 02 — Come è fatto

| File | Responsabilità |
|---|---|
| `vite/public-site-plugin.ts` | In sviluppo serve le pagine; nella build le scrive in `dist/`, con `sitemap.xml` e `llms.txt`, e rinomina il guscio del portale in `app.html` |
| `src/site/config.ts` | Origine, lingue, dati dell'intermediario, variabili d'ambiente, data di aggiornamento dei contenuti |
| `src/site/routes.ts` | Elenco delle pagine e dei percorsi per lingua |
| `src/site/content/{types,it,en,zh}.ts` | Tutti i testi, con la stessa struttura nelle tre lingue |
| `src/site/components/`, `src/site/pages/` | Sezioni e pagine (React reso come HTML statico, senza idratazione) |
| `src/site/seo.ts`, `schema.ts`, `sitemap.ts` | Testata, dati strutturati, mappa del sito, `llms.txt` |
| `src/site/site.css` | Stile indipendente da quello del portale: vetro, colori Tecno, movimento |
| `src/site/client/` | Script del browser: menu, comparsa, movimento, lingua, modulo, consenso, video |
| `src/site/consent-core.ts` | Regole del consenso ai cookie |
| `api/_lib/contact-requests.ts` | Modulo contatti sul server |

**Cambiare un testo.** Si modifica la stessa chiave nei tre file `src/site/content/{it,en,zh}.ts`. `tests/site/content.test.ts` fallisce se una lingua resta indietro, se un testo è vuoto, se una risposta delle domande frequenti esce dalle 40-60 parole o se compare un prezzo o un nome di compagnia.

**Aggiornare una norma.** Ogni affermazione normativa rimanda a una fonte ufficiale in `whatIs.sources`. Dopo la verifica sulle fonti si aggiorna `CONTENT_UPDATED` in `src/site/config.ts`: è la data mostrata nella pagina.

**Aggiungere una pagina.** 1) un identificativo in `PageId` e i percorsi in `SLUGS` (`src/site/routes.ts`); 2) titolo, descrizione, H1 ed etichetta in `meta` nelle tre lingue; 3) il componente della pagina in `src/site/pages/` e la scelta in `src/site/render.tsx`; 4) il prefisso del percorso nelle due regole di `vercel.json` (quella riservata lo esclude, quella pubblica lo include) e in `tests/server/vercel-config.test.ts`; 5) il percorso tra quelli attesi in `scripts/check-public-site.mjs`.

## SECTION 03 — Indicizzazione e sicurezza

- `vercel.json` ha due regole di intestazioni: le pagine pubbliche (`/`, `/en`, `/zh`, `/privacy`, `/cookie`) hanno una politica di sicurezza propria, che ammette gli indirizzi di Google e non quelli del database; ogni altro indirizzo ha `X-Robots-Tag: noindex, nofollow, noarchive` e la politica del portale. `tests/server/vercel-config.test.ts` applica le regole come le applica Vercel.
- Nessuno script in linea: nelle pagine ci sono solo blocchi di dati strutturati. Il JavaScript del sito è un solo file.
- Dati strutturati: intermediario assicurativo con RUI e sedi, servizio, domande frequenti e passi (homepage), briciole di pane (pagine di testo).
- Alternative per lingua: `it`, `en`, `zh-Hans`; predefinita l'inglese.

## SECTION 04 — Modulo contatti

`POST /api/contact` (una rotta di `api/vies-connect.ts`) accetta solo JSON e risponde `200 { ok: true }`, `400 { error: "invalid", fields }`, `415`, `429 { error: "rate_limited" }` o `500 { error: "unavailable" }`.

| Regola | Valore |
|---|---|
| Campi obbligatori | nome, società, ruolo, paese, email, messaggio (10-4000 caratteri), consenso |
| Antispam | campo trappola `website`, almeno 3 secondi di compilazione, 5 richieste l'ora per chiamante, 60 chiamate l'ora in tutto |
| Indirizzo IP | mai salvato: i contatori usano un'impronta con chiave |
| Email | a `CONTACT_INBOX` (predefinito `vies@tecnomga.com`), risposta diretta a chi ha scritto |
| Se l'email non parte | la richiesta resta salvata con il motivo; chi scrive vede la conferma |
| Conservazione | 24 mesi, poi cancellazione automatica (`contact-requests-retention`) |

La tabella `contact_requests` è scrivibile solo dal server. Gli amministratori la leggono in **Impostazioni › Richieste di contatto** e possono cambiare solo lo stato («da gestire» / «gestita»).

## SECTION 05 — Cookie e misurazione

Senza identificativi il sito non carica nulla di Google e il banner non esiste. Con gli identificativi (solo nella forma `G-…` e `AW-…`, altrimenti sono ignorati) compare il banner con un unico consenso per statistiche e campagne: «Accetta» e «Rifiuta» di pari evidenza; la chiusura vale rifiuto. Prima della scelta e dopo un rifiuto non parte nessuna richiesta verso Google. La scelta dura 180 giorni e si cambia da «Preferenze cookie» nel piè di pagina. Una richiesta inviata dal modulo è contata come `generate_lead` (Analytics) e come conversione (Ads), solo con il consenso.

Il consenso unico è una scelta del titolare, confermata il 15/11/2026: le linee guida del Garante del 2021 prevedono anche la scelta per finalità, quindi qui la scelta è tutto o niente. Il modello dei dati tiene comunque separate statistiche e campagne, se in futuro servisse dividerle.

## SECTION 06 — Variabili d'ambiente

| Variabile | Dove | A cosa serve |
|---|---|---|
| `VITE_GA4_ID` | Vercel, letta alla build | Identificativo di Google Analytics 4 (`G-…`) |
| `VITE_GOOGLE_ADS_ID` | Vercel, letta alla build | Identificativo di Google Ads (`AW-…`) |
| `VITE_GOOGLE_ADS_CONVERSION_LABEL` | Vercel, letta alla build | Etichetta della conversione «richiesta di contatto» |
| `VITE_GSC_VERIFICATION` | Vercel, letta alla build | Codice di verifica di Google Search Console (meta tag) |
| `VITE_BING_VERIFICATION` | Vercel, letta alla build | Codice di verifica di Bing Webmaster |
| `VITE_SITE_ORIGIN` | Vercel, letta alla build | Origine canonica, se diversa da `https://portale.tecnomga.com` |
| `CONTACT_INBOX` | Vercel, letta dalle funzioni | Casella che riceve le richieste, se diversa da `vies@tecnomga.com` |

Le variabili `VITE_*` sono lette durante la build: dopo ogni modifica serve una nuova pubblicazione.

## SECTION 07 — Grafica

| File in `public/site-media/` | Uso |
|---|---|
| `vies-vetro-apertura.webp`, `.webm`, `.mp4` | Immagine fissa e video in ciclo dell'apertura (6,5 secondi, senza audio) |
| `vies-onde-blu.webp` | Sfondo delle sezioni scure |
| `vies-lastre-vetro.webp` | Decorazione della sezione sul costo |
| `og-it.png`, `og-en.png`, `og-zh.png` | Immagini per i social, 1200×630 |
| `tecno-mga-logo-chiaro.svg` | Logo per gli sfondi scuri |

Il video è caricato dallo script a pagina pronta; con «riduci movimento» o risparmio dati resta l'immagine. Le immagini per i social si rigenerano con `node scripts/site/og-images.mjs` quando cambiano il titolo della homepage, i tre dati o l'immagine dell'apertura. Limiti controllati alla build: 1,5 MB per un video, 700 kB per un'immagine.

## SECTION 08 — Controlli

| Comando | Cosa verifica |
|---|---|
| `npx vitest run tests/site` | Testi, pagine, testata, dati strutturati, consenso, modulo, immagini |
| `npx vitest run tests/server/contact-requests.test.ts` | Modulo contatti sul server |
| `npx vite build && npm run test:public-site` | Le nove pagine generate, il guscio del portale separato, pesi |
| `node e2e/run.mjs public-site contact-requests landing-header` | Il sito nel browser: senza JavaScript, telefono, lingue, modulo, cookie, elenco per gli amministratori |

## SECTION 09 — Cosa serve dal titolare

Nessuno di questi punti blocca la pubblicazione: il sito è indicizzabile anche senza. Sono proprietà e account del titolare (Google, Microsoft): vanno creati da lui; gli identificativi si impostano poi su Vercel e serve una nuova pubblicazione.

| Cosa | Perché | Senza |
|---|---|---|
| Google Search Console: proprietà di dominio `tecnomga.com` (record TXT nel DNS; `VITE_GSC_VERIFICATION` non serve) oppure proprietà con prefisso `https://portale.tecnomga.com/` (meta tag: il codice va in `VITE_GSC_VERIFICATION`) | Leggere ricerche, clic e stato dell'indicizzazione; inviare `sitemap.xml` | Google trova comunque il sito, ma non si vede cosa cerca chi arriva né eventuali errori |
| Bing Webmaster: importazione da Search Console (nessuna variabile) oppure meta tag (`VITE_BING_VERIFICATION`) | Bing alimenta Copilot e la ricerca di ChatGPT | Come sopra, per Bing |
| Google Analytics 4 (`VITE_GA4_ID`) | Visite e richieste inviate dal modulo | Nessun dato sulle visite; il banner dei cookie non compare |
| Google Ads (`VITE_GOOGLE_ADS_ID`, `VITE_GOOGLE_ADS_CONVERSION_LABEL`) | Contare le richieste come conversioni delle campagne | Le campagne partono lo stesso, ma senza sapere quali annunci portano richieste |
| Conferma dell'avvertenza pubblicitaria e del testo sui reclami | Requisiti IVASS sulla pubblicità dei prodotti assicurativi | — |
| Conferma delle lingue in cui l'ufficio risponde | I dati strutturati indicano italiano, inglese e cinese | — |

Decisioni del titolare (15/11/2026): consenso unico ai cookie (SECTION 05); recapito del responsabile della protezione dei dati `antoncarlo@tecnomga.com`, lo stesso dei documenti del portale.

## SECTION 10 — Norme verificate

| Fatto | Fonte |
|---|---|
| Obbligo di garanzia per i soggetti non residenti in UE o SEE con rappresentante fiscale | Art. 35, comma 7-quater, DPR 633/1972 (introdotto dal D.Lgs. 13/2024) |
| 50.000 euro, 36 mesi, forme ammesse, beneficiario, consegna, verifica | Provvedimento dell'Agenzia delle Entrate prot. n. 178713/2025 del 14 aprile 2025, punti 1.1 e 2.1-2.9 |
| Sessanta giorni per chi era già nel VIES; esclusione d'ufficio | Stesso Provvedimento, punti 3.1-3.4 |
| Dal 1° gennaio 2027 la regola è nell'art. 68, comma 10, del Testo unico IVA | D.Lgs. 19 gennaio 2026, n. 10, artt. 68, 170 e 171 (Normattiva, verificato il 15/11/2026) |

Titoli e descrizioni citano ancora «art. 35 c. 7-quater», che è ciò che si cerca; il testo spiega il passaggio al Testo unico. Dal 2027 conviene rivedere descrizioni e occhiello dell'apertura.
