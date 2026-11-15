# Sito pubblico VIES

*La parte pubblica di `portale.tecnomga.com`: una homepage sulla garanzia VIES in italiano, inglese e cinese, due pagine per pubblico, un blog con otto guide firmate, le pagine Privacy e Cookie, il modulo di contatto verso `vies@tecnomga.com`. Le pagine sono HTML completo generato alla build, leggibile da motori di ricerca e motori di risposta senza JavaScript; il portale riservato resta dietro `/auth` e non è indicizzabile. Progetto in `docs/superpowers/specs/2026-11-15-sito-pubblico-vies-design.md`.*

## SECTION 01 — Cosa viene pubblicato

| Indirizzo | Contenuto |
|---|---|
| `/`, `/en/`, `/zh/` | Homepage: apertura, fascia di fiducia, cos'è la garanzia, per chi, cinque passi, il portale, documenti, costo, domande frequenti, contatti. Ogni sezione ha il solo titolo: nessuna scritta sopra, nessun sottotitolo sotto |
| `/rappresentanti-fiscali/`, `/en/fiscal-representatives/`, `/zh/fiscal-representatives/` | Pagina per rappresentanti fiscali e studi: cosa chiede la norma, come si lavora nel portale, domande, guide dedicate |
| `/venditori-esteri/`, `/en/non-eu-sellers/`, `/zh/non-eu-sellers/` | Pagina per le società extra UE: quando la garanzia le riguarda, cosa fare, documenti, domande |
| `/blog/`, `/en/blog/`, `/zh/blog/` | Indice delle guide |
| `/blog/<articolo>/`, `/en/blog/<article>/`, `/zh/blog/<article>/` | Le otto guide, firmate, con risposta diretta, sezioni, domande, fonti ufficiali e data dell'ultima verifica. Inglese e cinese usano lo stesso segmento |
| `/blog/feed.xml`, `/en/blog/feed.xml`, `/zh/blog/feed.xml` | Feed Atom delle guide, annunciato nella testata di ogni pagina |
| `/privacy/`, `/en/privacy/`, `/zh/privacy/` | Informativa sulla privacy del sito e del modulo |
| `/cookie/`, `/en/cookie/`, `/zh/cookie/` | Cosa il sito salva nel browser, per nome |
| `/sitemap.xml` | Tutte le pagine con le alternative per lingua; la data è quella dell'ultima verifica dei contenuti (per un articolo, la sua) |
| `/llms.txt` | Il sito descritto ai motori basati su IA, con le guide per lingua e chi le firma |
| `/<chiave>.txt` | La chiave di IndexNow (SECTION 03) |
| `/robots.txt` | Apre il sito ai crawler (anche delle IA), chiude solo `/api/` |
| `/site-media/*` | Immagini, video dell'apertura, immagini per i social |
| `/app.html` | Il guscio del portale riservato: lo riceve ogni altro indirizzo |

Le ancore delle sezioni sono uguali nelle tre lingue: `#cos-e`, `#per-chi`, `#come-funziona`, `#portale`, `#documenti`, `#costo`, `#domande`, `#contatti`.

## SECTION 02 — Come è fatto

| File | Responsabilità |
|---|---|
| `vite/public-site-plugin.ts` | In sviluppo serve le pagine; nella build le scrive in `dist/`, con `sitemap.xml` e `llms.txt`, e rinomina il guscio del portale in `app.html` |
| `src/site/config.ts` | Origine, lingue, dati dell'intermediario, variabili d'ambiente, data di aggiornamento dei contenuti |
| `src/site/routes.ts` | Elenco delle pagine e dei percorsi per lingua; ogni articolo è una pagina |
| `src/site/blog/` | Tipi degli articoli, registro (`index.ts`) e testi: `articles/<lingua>/<id>.ts` |
| `src/site/content/audience/{it,en,zh}.ts` | Testi delle due pagine per pubblico |
| `src/site/inline.ts`, `src/site/meta.ts` | Collegamenti scritti nel testo; titolo e descrizione di ogni pagina |
| `src/site/content/{types,it,en,zh}.ts` | Tutti i testi, con la stessa struttura nelle tre lingue |
| `src/site/components/`, `src/site/pages/` | Sezioni e pagine (React reso come HTML statico, senza idratazione) |
| `src/site/seo.ts`, `schema.ts`, `sitemap.ts` | Testata, dati strutturati, mappa del sito, `llms.txt`, feed |
| `scripts/site/indexnow.mjs` | Invio a IndexNow delle pagine cambiate |
| `src/site/site.css` | Stile indipendente da quello del portale: vetro, colori Tecno, movimento |
| `src/site/client/` | Script del browser: menu, comparsa, movimento, lingua, modulo, consenso, video |
| `src/site/consent-core.ts` | Regole del consenso ai cookie |
| `api/_lib/contact-requests.ts` | Modulo contatti sul server |

**Cambiare un testo.** Si modifica la stessa chiave nei tre file `src/site/content/{it,en,zh}.ts`. `tests/site/content.test.ts` fallisce se una lingua resta indietro, se un testo è vuoto, se una risposta delle domande frequenti esce dalle 40-60 parole o se compare un prezzo o un nome di compagnia.

**Aggiornare una norma.** Ogni affermazione normativa rimanda a una fonte ufficiale in `whatIs.sources`. Dopo la verifica sulle fonti si aggiorna `CONTENT_UPDATED` in `src/site/config.ts`: è la data mostrata nella pagina.

**Scrivere o aggiornare un articolo.** Un articolo è un modulo per lingua in `src/site/blog/articles/<lingua>/<id>.ts`: titolo, descrizione, H1, parola chiave, risposta diretta (`summary`), sezioni fatte di blocchi (paragrafo, elenco, passi, tabella, avvertenza), domande e fonti ufficiali. Niente HTML: i collegamenti si scrivono nel testo come `[testo](article:<id>)`, `[testo](page:<id>)`, `[testo](section:<ancora>)` o `[testo](https://…)`. Per un articolo nuovo: l'id in `ARTICLE_IDS` (`src/site/blog/types.ts`), i tre file, una riga in ciascun `articles/<lingua>/index.ts`, date e guide collegate in `META` (`src/site/blog/index.ts`). L'articolo compare nel sito solo quando esiste in tutte e tre le lingue. Dopo una verifica sulle fonti si aggiorna `updated` in `META`: è la data mostrata, quella della sitemap e quella del feed. `tests/site/blog.test.ts` controlla lunghezze (titolo 50-60, descrizione 150-160, risposte 40-60 parole), stessa struttura nelle tre lingue, collegamenti che portano a pagine esistenti, sole fonti ufficiali, nessun prezzo e nessun nome di compagnia.

**Aggiungere una pagina.** 1) un identificativo in `PageId` e i percorsi in `SLUGS` (`src/site/routes.ts`); 2) titolo, descrizione, H1 ed etichetta in `meta` nelle tre lingue; 3) il componente della pagina in `src/site/pages/` e la scelta in `src/site/render.tsx`; 4) il prefisso del percorso nelle due regole di `vercel.json` (quella riservata lo esclude, quella pubblica lo include): un test verifica che ogni pagina generata sia pubblica; 5) il percorso tra quelli attesi in `scripts/check-public-site.mjs`.

## SECTION 03 — Indicizzazione e sicurezza

- `vercel.json` ha due regole di intestazioni: le pagine pubbliche (`/`, `/en`, `/zh`, `/privacy`, `/cookie`, `/blog`, `/rappresentanti-fiscali`, `/venditori-esteri`) hanno una politica di sicurezza propria, che ammette gli indirizzi di Google e non quelli del database; ogni altro indirizzo ha `X-Robots-Tag: noindex, nofollow, noarchive` e la politica del portale. `tests/server/vercel-config.test.ts` applica le regole come le applica Vercel.
- Nessuno script in linea: nelle pagine ci sono solo blocchi di dati strutturati. Il JavaScript del sito è un solo file.
- Dati strutturati: intermediario assicurativo con RUI e sedi su ogni pagina; servizio, domande frequenti e passi (homepage); servizio, domande e briciole (pagine per pubblico); articolo firmato (`BlogPosting` con autore, date, fonti), domande e briciole a tre livelli (articoli); `Blog` con i suoi articoli (indice).
- Alternative per lingua: `it`, `en`, `zh-Hans`; predefinita l'inglese.
- **IndexNow.** Bing, Yandex, Naver e Seznam rileggono subito le pagine segnalate con IndexNow (Bing alimenta Copilot e la ricerca di ChatGPT). La chiave è il file `public/<chiave>.txt`; `scripts/site/indexnow.mjs` legge la sitemap online e invia le pagine la cui data è degli ultimi due giorni, quindi una pubblicazione del portale che non tocca il sito pubblico non invia nulla. Dopo ogni push su `main` il job `indexnow` della CI aspetta che la pubblicazione sia online e fa l'invio; a mano: `npm run site:indexnow -- --all` (tutte le pagine) o `--dry-run` (mostra senza inviare). Google non usa IndexNow.
- **Google.** Serve una proprietà in Search Console (SECTION 09): da lì si invia `sitemap.xml` e si chiede l'indicizzazione delle pagine principali. Senza, Google trova il sito solo seguendo i link di altri siti, e oggi `tecnomga.com` non collega il portale.

## SECTION 03-bis — Parole chiave e pubblico

Una ricerca, una pagina: la homepage tiene «fideiussione VIES» e gli articoli non la usano come parola chiave principale. «VIES» da solo porta al sito della Commissione europea e non è un obiettivo.

| Pagina | Ricerca a cui risponde |
|---|---|
| `/` | fideiussione VIES |
| `/rappresentanti-fiscali/` | fideiussione VIES rappresentante fiscale |
| `/venditori-esteri/` | garanzia VIES società extra UE |
| `/blog/garanzia-vies-cos-e-chi-deve-prestarla/` | garanzia VIES: cos'è, chi deve prestarla |
| `/blog/cauzione-fideiussione-bancaria-polizza-fideiussoria/` | cauzione o polizza fideiussoria VIES |
| `/blog/documenti-fideiussione-vies/` | documenti per la fideiussione VIES |
| `/blog/dalla-richiesta-alla-polizza-vies/` | come si ottiene la polizza VIES |
| `/blog/lotto-20-pratiche-vies-rappresentanti-fiscali/` | lotto di pratiche VIES |
| `/blog/polizze-firmate-digitalmente-p7m/` | file p7m, polizza firmata digitalmente |
| `/blog/garanzia-rappresentante-fiscale-e-garanzia-vies/` | garanzia del rappresentante fiscale |
| `/blog/venditori-extra-ue-partita-iva-vies/` | partita IVA italiana e VIES per società extra UE |

Paesi di riferimento indicati dal titolare: Italia, Europa, Cina, Giappone, India, Pakistan, Stati Uniti, Brasile, Vietnam. Le pagine in inglese servono India, Pakistan, Stati Uniti e il resto d'Europa; quelle in cinese agenti e rappresentanti che lavorano con società cinesi. Giapponese, portoghese e vietnamita non ci sono ancora: la struttura le accoglie aggiungendo una lingua in `src/site/config.ts` e i testi tradotti.

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
| `npx vitest run tests/site` | Testi, pagine, articoli e pagine per pubblico, testata, dati strutturati, feed, IndexNow, consenso, modulo, immagini |
| `npx vitest run tests/server/contact-requests.test.ts` | Modulo contatti sul server |
| `npx vite build && npm run test:public-site` | Tutte le pagine generate (otto articoli per lingua), feed, sitemap, il guscio del portale separato, pesi |
| `node e2e/run.mjs public-site contact-requests landing-header` | Il sito nel browser: senza JavaScript, telefono, lingue, modulo, cookie, blog e articoli, pagine per pubblico, elenco per gli amministratori |

## SECTION 09 — Cosa serve dal titolare

Nessuno di questi punti blocca la pubblicazione: il sito è indicizzabile anche senza. Sono proprietà e account del titolare (Google, Microsoft): vanno creati da lui; gli identificativi si impostano poi su Vercel e serve una nuova pubblicazione.

| Cosa | Perché | Senza |
|---|---|---|
| Google Search Console: proprietà di dominio `tecnomga.com` (record TXT nel DNS; `VITE_GSC_VERIFICATION` non serve) oppure proprietà con prefisso `https://portale.tecnomga.com/` (meta tag: il codice va in `VITE_GSC_VERIFICATION`) | Leggere ricerche, clic e stato dell'indicizzazione; inviare `sitemap.xml` | Google trova comunque il sito, ma non si vede cosa cerca chi arriva né eventuali errori |
| Bing Webmaster: importazione da Search Console (nessuna variabile) oppure meta tag (`VITE_BING_VERIFICATION`) | Bing alimenta Copilot e la ricerca di ChatGPT | Come sopra, per Bing |
| Un link dal sito aziendale `tecnomga.com` verso `portale.tecnomga.com` | È la strada con cui Google scopre un sito nuovo e gli dà fiducia | Il portale resta senza link in ingresso |
| Qualifica di chi firma gli articoli | Oggi la firma è «Anton Carlo Santoro, Tecno Advance MGA Broker Srl»: con una qualifica verificabile l'autorevolezza cresce | Firma senza qualifica |
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
