# Sito aziendale tecnomga.com

*Il nuovo sito di Tecno Advance MGA Broker Srl: pagine statiche in italiano e inglese, generate come HTML completo alla build e leggibili da motori di ricerca e motori di risposta senza JavaScript. È un sito a parte rispetto al portale (`portale.tecnomga.com`): stesso repository, pubblicazione separata, nessuna funzione propria. Il modulo di preventivo invia al servizio contatti del portale. Finché non passa il dominio, il sito non è indicizzabile. Progetto in `docs/superpowers/specs/2026-11-16-sito-aziendale-tecnomga-design.md`.*

## SECTION 01 — Cosa viene pubblicato

| Indirizzo | Contenuto |
|---|---|
| `/`, `/en/` | Homepage: apertura con il mondo di notte sotto lo scudo di vetro, undici prodotti (i sei principali in evidenza), perché rivolgersi a un broker, soci fondatori, società con cui lavoriamo (loghi), tre passi, modulo di preventivo e recapiti. Ogni sezione ha il solo titolo: nessuna scritta sopra, nessun sottotitolo sotto |
| `/privacy/`, `/en/privacy/` | Informativa sulla privacy del sito e del modulo di preventivo |
| `/cookie/`, `/en/cookie/` | Cosa il sito salva nel browser, per nome |
| `/sitemap.xml` | Tutte le pagine con le alternative per lingua (predefinita: italiano) |
| `/robots.txt` | Chiude il sito a tutti i motori finché `VITE_CORP_INDEXABLE` non vale `true`; poi lo apre e indica la sitemap |
| `/llms.txt` | Il sito descritto ai motori basati su IA: chi è l'intermediario, che cosa intermedia, dove sono le pagine |
| `/intro.js` | Lo script che decide l'apertura animata (SECTION 05) |
| `/media/*`, `/companies/*`, `/brand/*` | Video e immagine ferma dell'apertura, immagini per i social; loghi delle società; logo Tecno MGA |

Le ancore delle sezioni sono uguali nelle due lingue: `#prodotti`, `#broker`, `#come-funziona`, `#preventivo`.

Arrivano con le consegne successive: le pagine dei prodotti, le fideiussioni per tipo, Chi siamo, Reclami, Informative, le guide, il resto dell'inglese e il passaggio del dominio.

## SECTION 02 — Come è fatto

| File | Responsabilità |
|---|---|
| `vite.corp.config.ts` | Build separata del sito aziendale: uscita in `sites/tecnomga/dist/`, file statici da `sites/tecnomga/public/`, sviluppo sulla porta 5301 |
| `vite/public-site-plugin.ts` | Il motore comune ai due siti (`staticSitePlugin`): in sviluppo serve le pagine, nella build le scrive come HTML |
| `src/site-kit/` | Il kit comune: rotte, documento HTML, testata, dati strutturati, sitemap, colori (`tokens.css`), modulo di richiesta nel browser (`client/lead-form.ts`) |
| `src/corp/config.ts` | Origine, lingue, dati dell'intermediario, variabili d'ambiente, data di aggiornamento dei contenuti |
| `src/corp/routes.ts`, `meta.ts` | Pagine e percorsi per lingua; titolo e descrizione di ogni pagina |
| `src/corp/content/{types,it,en}.ts` | Tutti i testi, con la stessa struttura nelle due lingue |
| `src/corp/content/legal/{it,en}.ts` | Privacy e Cookie: funzione della configurazione (con o senza misurazione) |
| `src/corp/products.ts`, `media.ts` | Elenco dei prodotti; file grafici con le loro dimensioni reali e loghi delle società |
| `src/corp/components/`, `src/corp/pages/` | Sezioni e pagine (React reso come HTML statico, senza idratazione) |
| `src/corp/client/` | Ciò che gira nel browser: menu, comparsa allo scorrimento, vetro, modulo di preventivo, apertura animata, consenso |
| `src/corp/corp.css` | Stile proprio: blu notte e bronzo del marchio, riquadri in vetro liquido, movimento |
| `sites/tecnomga/vercel.json` | Regole di pubblicazione: build, barra finale, intestazioni di sicurezza, politica dei contenuti, cache |

Il sito aziendale riusa per importazione i moduli del portale che non dipendono dal portale: consenso ai cookie, menu, comparsa allo scorrimento, movimento, video dell'apertura, avviso della lingua (`src/site/client/*`, `src/site/consent-core.ts`). Il sito del portale non è stato spostato sul kit comune: resta com'è.

## SECTION 03 — Cambiare un testo, un prodotto, un logo

| Cosa | Dove | Attenzione |
|---|---|---|
| Un testo | `src/corp/content/it.ts` e `en.ts` | Stessa chiave nelle due lingue. Niente prezzi, tempi di emissione, primati («primi», «leader», «migliore»). Dopo una modifica di sostanza aggiornare `CORP_CONTENT_UPDATED` in `src/corp/config.ts` |
| «Perché rivolgersi a un broker» | `content/*.ts`, sezione `home.broker` | Ogni affermazione ha una fonte (art. 109 del Codice delle assicurazioni private, Modello Unico Precontrattuale): senza fonte non si scrive. Mai «imparziale», «indipendente», «consulenza personalizzata» |
| La frase sui soci fondatori | `home.founders.text` | È il testo approvato dal titolare: si pubblica senza varianti |
| Un prodotto | `src/corp/products.ts` (identificativo), `content/*.ts` (nome e riga), `api/_lib/contact-requests.ts` (`CONTACT_PRODUCTS` ed etichetta), vincolo `contact_requests_product_check` con una migrazione, `src/i18n/messages/contactRequests.ts` | Le prove tengono allineati sito, modulo e server |
| Una società con cui lavoriamo | `home.companies.names` nelle due lingue, `COMPANY_LOGOS` in `src/corp/media.ts`, file in `sites/tecnomga/public/companies/` | Il file è il doppio della misura mostrata. I loghi non si alterano: solo ritaglio dei margini e riduzione, su fondo bianco. Markel compare solo qui, mai accanto alle VIES |
| I dati societari | `COMPANY` in `src/corp/config.ts` | Sede legale Via Po 102, sede operativa Via Michele Mercati 18, reclami a `info@tecnomga.com` |

## SECTION 04 — Modulo di preventivo

Il modulo invia in JSON a `https://portale.tecnomga.com/api/contact` con `site: "corporate"`. Regole, antispam, casella, conservazione ed elenco per gli amministratori sono in `docs/public-site.md`, SECTION 04.

| Regola | Valore |
|---|---|
| Campi obbligatori | nome, email, messaggio (10-4000 caratteri), consenso. Società, telefono e prodotto facoltativi |
| Prodotto | scelto dall'elenco, oppure già impostato da «Chiedi un preventivo» nel riquadro di un prodotto |
| Senza JavaScript | il pulsante resta spento e un avviso dà l'indirizzo email: il server prende solo JSON |
| Da quali indirizzi | `tecnomga.com` e `www.tecnomga.com`. L'indirizzo di prova va aggiunto a `CONTACT_ALLOWED_ORIGINS` nel progetto Vercel del portale, altrimenti il modulo mostra l'errore con l'indirizzo email |

## SECTION 05 — Apertura: video e apertura animata

| Elemento | Com'è fatto |
|---|---|
| Immagine ferma | `sites/tecnomga/public/media/apertura.webp`, 1920×1080, 157 kB: è il primo fotogramma del video, così il passaggio dall'immagine al video non si vede. Dimensioni dichiarate in `HERO_POSTER` |
| Video | `apertura.webm` (1,0 MB) e `apertura.mp4` (1,3 MB), 7,4 secondi a ciclo continuo, senza audio. Generato con Higgsfield dal fotogramma scelto dal titolare; il ciclo è chiuso con una dissolvenza tra fine e inizio. Parte solo a pagina pronta e a fine apertura animata, mai con «riduci movimento» o con il risparmio dati |
| Apertura animata | Al primo arrivo sulla homepage il mondo compare in grande e da solo, si allontana fino a passare in secondo piano, poi compaiono barra e testo. La decide `/intro.js` prima che la pagina sia disegnata, aggiungendo la classe `intro` alla pagina; l'animazione è nello stile (`corp.css`, blocco «Apertura animata»); la spegne `src/corp/client/intro.ts` |
| Quando non parte | Da un'altra pagina del sito, tornando indietro, verso una sezione (`/#preventivo`), con «riduci movimento», senza JavaScript. Non salva nulla nel browser |
| Chi non vuole aspettare | Il primo tocco, scorrimento o tasto la spegne subito |
| Tempi | Il titolo comincia a comparire dopo circa un secondo: è l'elemento su cui Google misura la velocità di caricamento. Allungare la fase «mondo da solo» peggiora quella misura per chi arriva da una ricerca |
| Immagini per i social | `og-it.png`, `og-en.png`, 1200×630: fotogramma dell'apertura, logo e titolo della pagina |

Per rifare il video: stesso fotogramma come inizio e fine, movimento lento senza rotazione completa; poi ciclo chiuso con dissolvenza, 1920×1080, senza audio, nei due formati, sotto i 3 MB ciascuno; l'immagine ferma si estrae dal primo fotogramma del ciclo.

## SECTION 06 — Motori di ricerca e IA

| Segnale | Stato |
|---|---|
| Indicizzazione | Spenta finché `VITE_CORP_INDEXABLE` non vale `true`: ogni pagina dichiara `noindex, nofollow` e `robots.txt` chiude il sito. Le due cose cambiano insieme (lo controlla `npm run test:corp-site`) |
| Titolo, descrizione, indirizzo canonico | Per ogni pagina, sull'origine `https://tecnomga.com` (`VITE_CORP_ORIGIN` per cambiarla) |
| Lingue | `hreflang` italiano e inglese, predefinita italiano |
| Dati strutturati | Intermediario assicurativo con numero RUI, sede e recapiti; servizio; i tre passi del preventivo; briciole di pane nelle pagine interne |
| `llms.txt`, `sitemap.xml` | Generati alla build dagli stessi contenuti delle pagine |
| Verifica di Search Console e Bing | `VITE_CORP_GSC_VERIFICATION`, `VITE_CORP_BING_VERIFICATION` (meta tag) |

## SECTION 07 — Cookie e misurazione

Senza `VITE_CORP_GA4_ID` il sito non carica nulla di Google, il banner non esiste e le pagine Privacy e Cookie non nominano Google: il sito salva nel browser solo la scelta sulla lingua. Con l'identificativo (solo nella forma `G-…`) compare il banner con un unico consenso, «Accetta» e «Rifiuta» di pari evidenza, e le due pagine elencano la scelta sui cookie e i due cookie di Google Analytics. Il sito aziendale non usa Google Ads.

## SECTION 08 — Variabili d'ambiente

Tutte lette alla build, nel progetto Vercel del sito aziendale: dopo una modifica serve una nuova pubblicazione.

| Variabile | A cosa serve |
|---|---|
| `VITE_CORP_INDEXABLE` | `true` apre il sito ai motori di ricerca. Da impostare solo al passaggio del dominio |
| `VITE_CORP_ORIGIN` | Origine canonica, se diversa da `https://tecnomga.com` |
| `VITE_CORP_CONTACT_ENDPOINT` | Indirizzo del servizio contatti, se diverso da `https://portale.tecnomga.com/api/contact`. Cambiandolo va aggiornata anche la politica dei contenuti in `sites/tecnomga/vercel.json` |
| `VITE_CORP_GA4_ID` | Identificativo di Google Analytics 4 (`G-…`) |
| `VITE_CORP_GSC_VERIFICATION`, `VITE_CORP_BING_VERIFICATION` | Codici di verifica di Google Search Console e Bing Webmaster |

Nel progetto Vercel del **portale**: `CORPORATE_CONTACT_INBOX` e `CONTACT_ALLOWED_ORIGINS` (`docs/public-site.md`, SECTION 06).

## SECTION 09 — Pubblicazione e passaggio del dominio

Il sito aziendale è un progetto Vercel a parte, collegato allo stesso repository. Il collegamento usato per lo sviluppo non ha il permesso di creare progetti: lo crea il titolare.

| Impostazione del progetto | Valore |
|---|---|
| Nome | `tecnomga-site` |
| Repository | `antoncarlo/policy-portal-pro`, ramo di produzione `main` |
| Root Directory | `sites/tecnomga` |
| Framework Preset | Other |
| Build, Install, Output | Lasciati vuoti: li dà `sites/tecnomga/vercel.json` (installa e costruisce dalla radice del repository, pubblica `dist`) |
| «Include files outside the root directory in the Build Step» | Attivo (è il valore predefinito) |
| Variabili d'ambiente | Nessuna: senza `VITE_CORP_INDEXABLE` il sito resta non indicizzabile |

Con la protezione predefinita del gruppo, l'indirizzo `tecnomga-site.vercel.app` è visibile solo a chi ha accesso a Vercel: va bene per la verifica del titolare, ma PageSpeed non lo raggiunge. Per una misura pubblica serve un sottodominio di prova (per esempio `nuovo.tecnomga.com`) aggiunto al progetto.

Passaggio del dominio (consegna 6), nell'ordine:

1. Il titolare conferma che ogni società consente l'uso del proprio logo.
2. I documenti (informativa generale, set informativi) sono ospitati nel nuovo sito, con un reindirizzamento dal vecchio percorso `/wp-content/uploads/2025/12/Informativaprivacytecno-1_1.pdf`, a cui rimandano oggi il portale e la pagina Privacy.
3. Reindirizzamenti dalle pagine del vecchio sito alle nuove.
4. Nel progetto Vercel: domini `tecnomga.com` e `www.tecnomga.com`, `VITE_CORP_INDEXABLE=true`, codici di verifica.
5. Il titolare cambia nel DNS (Register.it) i soli record del sito; i record della posta non si toccano.
6. Verifica di pagine, reindirizzamenti, modulo e certificato; sitemap inviata a Search Console e Bing.
7. WordPress resta spento ma conservato: per tornare indietro basta rimettere i record di prima.

## SECTION 10 — Prove

| Controllo | Comando | Cosa copre |
|---|---|---|
| Regole del sito | `npx vitest run tests/corp` | rotte, testata e dati strutturati, contenuti (stesse chiavi, niente prezzi né primati, frase sui soci, elenco delle società), homepage, modulo, pagine legali, file grafici, apertura animata |
| Servizio contatti | `npx vitest run tests/server/contact-requests.test.ts` | richieste del sito aziendale, casella per sito, permesso tra siti |
| Regole di pubblicazione | `npx vitest run tests/server/vercel-config.test.ts` | intestazioni, politica dei contenuti, cache, formato delle regole |
| Build | `npm run build:corp && npm run test:corp-site` | pagine come HTML completo, segnali di indicizzazione coerenti, nessun guscio del portale |
| Browser | `npm run test:e2e -- corp-site` | senza JavaScript, telefono e tablet, menu, lingue, banner dei cookie, homepage, modulo di preventivo, pagine legali, apertura animata e video (server di sviluppo sulla porta 5301) |

Misura in locale del 16/11/2026 con Lighthouse 12 sulla build servita compressa: prestazioni 94-95 su telefono simulato e 100 su PC, accessibilità 100, buone pratiche 100. Il punteggio SEO della build di prova è basso per scelta: la pagina dichiara di non voler essere indicizzata.

## SECTION 11 — Dati che mancano

| Dato | Serve per |
|---|---|
| Conferma dell'uso dei loghi da parte di ogni società | Passaggio del dominio |
| Identificativo di Google Analytics | Misurazione delle visite |
| Documenti aggiornati (informativa generale, set informativi) | Pagina Informative, consegna 3 |
| Quali polizze di responsabilità civile oltre alla professionale, numeri documentabili, persone, profili social | Pagine dei prodotti e Chi siamo, consegne 2 e 3 |
