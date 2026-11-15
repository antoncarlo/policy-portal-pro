# Sito pubblico VIES su portale.tecnomga.com: progetto

Data: 15/11/2026. Stato: in attesa di approvazione.

## 1. Perché

Oggi chi cerca una fideiussione VIES non può trovare Tecno Advance MGA Broker: il portale chiede ai motori di
ricerca di non indicizzarlo, la homepage è una porta d'ingresso senza testo utile e i motori basati su IA leggono
una pagina vuota. Il titolare vuole che `portale.tecnomga.com` diventi il sito dedicato alle fideiussioni VIES:
trovabile su Google e citabile dalle IA, con un modulo che porta contatti a `vies@tecnomga.com`, un blog che spiega
prodotto e portale, e un aspetto da grande società. Seguiranno campagne sponsorizzate.

Il sito WordPress `tecnomga.com` resta com'è: questo è un sito separato, solo VIES.

## 2. Cosa abbiamo trovato

### Stato del sito
- `public/robots.txt` vieta tutto (`Disallow: /`) e `vercel.json` manda `X-Robots-Tag: noindex, nofollow, noarchive`
  su ogni pagina.
- Il sito si disegna nel browser: l'HTML servito contiene solo `<div id="root">`. I crawler delle IA non eseguono
  JavaScript.
- La homepage carica un unico file JavaScript di 4,2 MB (1,37 MB compressi in rete), perché tutte le pagine del
  portale sono importate insieme in `src/App.tsx`.
- Misure del 15/11/2026 con Google PageSpeed, da telefono: punteggio di laboratorio 92/100, elemento principale
  in 0,9 secondi, blocco del thread 360 ms (sopra la soglia buona di 200 ms), nessun dato di utenti reali per
  mancanza di traffico. La velocità oggi non è il problema principale: lo sono il blocco e l'HTML vuoto. Il peso
  del JavaScript resta da ridurre sulle pagine pubbliche.
- Verifica di `robots.txt` con lo strumento di Search Console: Googlebot è bloccato sulla radice.
- Search Console: l'account collegato non ha nessuna proprietà verificata. Serve una proprietà di dominio
  `tecnomga.com` (un record TXT su Cloudflare), che copre anche `portale.tecnomga.com`.
- La homepage non contiene la parola «VIES», non ha recapiti e riporta «© 2024».
- Nessuna sitemap, nessun dato strutturato, un solo titolo generico per tutto il sito.
- Già presenti e riusabili: colori Tecno (blu `#0F3A5C`, bronzo `#B08968`), stile vetro (`lotGlass`), tre lingue,
  invio email (`api/_lib/mailer.ts`), limite di frequenza (`api/_lib/rate-limit.ts`).

### Ricerca (15/11/2026)
- **Chi occupa i risultati in italiano.** Testate fiscali (Fisco Oggi, Edotto, Fisco e Tasse, EC News, MySolution)
  per le ricerche informative. Concorrenti commerciali: `italiafideiussioni.it` (molto attivo, italiano e inglese,
  articoli sulle sentenze), `viesguarantee.com` (dominio dedicato), `hecamga.it` (un altro MGA),
  `servixint.com`.
- **In inglese:** Marosa VAT, VATupdate, VATai e gli stessi operatori commerciali.
- **In cinese:** `amz123.com`, Huxiu, Baijing. I venditori cinesi si informano lì, non su Google.
- **Vuoto da occupare:** nessuno risponde a «quanto costa» e nessuno mostra come funziona il processo dall'interno
  (documenti, controlli, tempi, firme). Tecno ha un portale vero che lo fa: è il suo vantaggio di esperienza.
- **Quadro normativo, come riportato dalle fonti:** art. 35, comma 7-quater, DPR 633/1972 (introdotto dal
  D.Lgs. 13/2024); DM MEF 4 dicembre 2024 (garanzia di almeno 50.000 euro per almeno 36 mesi, come cauzione in
  titoli di Stato, fideiussione bancaria o polizza fideiussoria); Provvedimento dell'Agenzia delle Entrate
  n. 178713 del 14 aprile 2025 (modalità operative; termine del 13 giugno 2025 per chi era già nel VIES).
  Fonti commerciali riportano una sospensione cautelare del Consiglio di Stato a giugno 2025 e la sentenza del TAR
  Lazio n. 4986/2026 che conferma l'obbligo, ma non concordano sul motivo. **Da verificare sulle fonti primarie
  prima di pubblicare** (vedi §9).
- **Garanzia diversa, spesso confusa:** quella che deve prestare il rappresentante fiscale per sé (riportata a 48
  mesi, importo legato al numero di rappresentati). Va spiegata la differenza; non è il prodotto di questo sito.

### Limiti da sapere
- La parola «vies» da sola porta chi vuole verificare una partita IVA sul sito della Commissione europea. Non è
  un obiettivo realistico né conveniente per gli annunci.
- Google non è raggiungibile dalla Cina continentale e Baidu indicizza poco i siti ospitati all'estero. Le pagine
  in cinese servono agenti e rappresentanti, e i link condivisi. Le sponsorizzate su Google coprono Italia, India
  e Pakistan.

## 3. Obiettivi, non obiettivi, cose da evitare

**Obiettivi**
1. Le pagine pubbliche sono indicizzabili e leggibili senza JavaScript, in italiano, inglese e cinese.
2. La homepage spiega cosa vende Tecno e a chi, e raccoglie contatti che arrivano a `vies@tecnomga.com`.
3. Un blog con articoli basati su esperienza reale e fonti primarie.
4. Dati strutturati e risposte dirette, perché Google e le IA possano citare Tecno.
5. Aspetto da grande società: colori Tecno, banner in vetro, animazioni curate.
6. Misurazione delle campagne con consenso ai cookie.

**Non obiettivi**
- Modificare il sito WordPress `tecnomga.com`.
- Posizionarsi per «vies» da solo.
- Un editor del blog dentro il portale: gli articoli sono file del sito.
- Pubblicare prezzi o il nome della compagnia.
- Baidu, WeChat e articoli su siti cinesi (eventuale lavoro successivo).

**Da evitare (renderebbero il lavoro un fallimento anche se funziona)**
- Rendere indicizzabile una pagina riservata del portale, o allentarne la sicurezza.
- Pubblicare un'affermazione normativa non verificata o un numero non vero.
- Mostrare dati di clienti reali (schermate, nomi, partite IVA).
- Caricare script di Google prima del consenso.
- Peggiorare il portale per chi lo usa già: l'accesso deve restare a un clic.

## 4. Vincoli

- Stesso repository e stesso progetto Vercel. Le funzioni `/api` sono già 14: il modulo contatti usa una rotta
  di una funzione esistente, non una funzione nuova.
- La politica di sicurezza dei contenuti (CSP) del portale non si allenta. Gli indirizzi di Google sono ammessi
  solo sulle pagine pubbliche.
- Niente script in linea: la CSP non li consente.
- Testi in tre lingue con il sistema di traduzioni esistente; cinese semplificato.
- Controlli esistenti da tenere verdi: `npm test`, `npm run lint`, build, e2e, `test:csp-hosts`.
- Il test `e2e/landing-header.e2e.mjs` e quello sugli accessi falliti toccano la homepage: vanno aggiornati.

## 5. Strade considerate

1. **Pagine pubbliche sul portale, `portale.tecnomga.com`** — scelta dal titolare. Si costruisce e si prova tutto
   qui, online subito. L'indirizzo ricorda un'area riservata: si compensa con titoli e contenuti chiari.
2. Indirizzo dedicato (`vies.tecnomga.com`) sullo stesso progetto. Indirizzo migliore per gli annunci, ma richiede
   un record DNS. Scartata dal titolare per ora; si può aggiungere dopo con un reindirizzamento.
3. Dentro WordPress (`tecnomga.com/vies`). Sfrutta la storia del dominio, ma non è costruibile da qui e l'effetto
   grafico richiesto viene peggio.
4. Togliere solo il blocco e aggiungere parole chiave. Scartata: per le IA la pagina resta vuota e il peso di
   4,2 MB resta.

## 6. Cosa si costruisce

### 6.1 Architettura (decisione mia)
- **Due ingressi nello stesso progetto.** Il portale riservato resta un'applicazione nel browser, con il suo
  guscio vuoto e «non indicizzare». Le pagine pubbliche sono generate alla pubblicazione come file HTML completi,
  con un JavaScript proprio e leggero per menu, modulo, animazioni e banner dei cookie. Le pagine pubbliche non
  caricano il codice del portale.
- **Indirizzi.** Italiano alla radice, inglese sotto `/en/`, cinese sotto `/zh/`:
  `/`, `/blog/`, `/blog/<articolo>/`, `/rappresentanti-fiscali/`, `/venditori-esteri/`, `/privacy/`, `/cookie/`
  e gli equivalenti in `/en/` e `/zh/`.
- **Accesso al portale.** Il pulsante «Area riservata» porta a `/auth`. La finestra di accesso sulla homepage
  sparisce. Le rotte riservate non cambiano.
- **Nessun reindirizzamento automatico per lingua:** un avviso propone la lingua del browser.

### 6.2 Homepage
Dall'alto in basso:
1. Barra in vetro: logo, voci di menu, lingue, «Area riservata».
2. Apertura: titolo «Fideiussione VIES per soggetti non residenti», i tre dati chiave (50.000 euro, 36 mesi,
   art. 35 c. 7-quater), due pulsanti («Richiedi contatto», «Area riservata»), sfondo animato.
3. Fascia di fiducia: iscrizione al RUI n. B000746484, vigilanza IVASS, controllo dei documenti, firma digitale.
   Solo fatti verificabili; nessun contatore.
4. «Cos'è la garanzia VIES»: chi deve prestarla, a chi, per quanto, in che forma. Risposta diretta in apertura di
   ogni paragrafo, con le fonti.
5. «Per chi»: due riquadri in vetro, rappresentanti fiscali e studi, società estere che vendono online.
   Rimandano alle due pagine dedicate.
6. «Come funziona»: cinque passi animati (documenti, verifica, bozza e pagamento, firma, polizza emessa).
7. «Il portale»: controllo automatico dei documenti, lotti fino a 20 pratiche, firme digitali, estratto conto,
   connessioni con altri sistemi (rimando a `/api-docs`). Interfaccia ridisegnata con dati inventati, mai schermate
   reali.
8. «Documenti necessari»: elenco.
9. «Quanto costa»: da cosa dipende il premio, senza importi; invito a chiedere una quotazione.
10. Domande frequenti: 8-10.
11. Ultimi tre articoli del blog (dalla seconda consegna).
12. Contatti: modulo in vetro e recapiti.
13. Piè di pagina: ragione sociale, RUI, P.IVA 17460381001, sede legale e operativa, telefono 06.97638088, PEC,
    `vies@tecnomga.com`, privacy, cookie, reclami, avvertenza sulla pubblicità assicurativa, © 2026.

### 6.3 Modulo contatti
- Campi: nome e cognome, società, ruolo (rappresentante fiscale, studio professionale, broker o agente, società
  estera, altro), paese, email, telefono (facoltativo), pratiche stimate (facoltativo), messaggio, consenso
  privacy obbligatorio.
- All'invio: la richiesta si salva in una tabella nuova e parte un'email a `vies@tecnomga.com` con risposta
  diretta al richiedente. Se l'email non parte, la richiesta resta salvata e l'errore si registra.
- Antispam senza servizi esterni: campo trappola, tempo minimo di compilazione, limite di frequenza per
  indirizzo, validazione sul server.
- Nel portale, solo per gli amministratori: elenco «Richieste di contatto» con stato «da gestire / gestita».
- La tabella è scrivibile solo dal server e leggibile solo dagli amministratori.

### 6.4 Motori di ricerca e IA
- `robots.txt` apre le pagine pubbliche, chiude `/api/` e le rotte riservate, ammette in modo esplicito i crawler
  delle IA (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot).
- «Non indicizzare» resta su tutte le pagine riservate, nell'intestazione e nel guscio del portale.
- Per ogni pagina: titolo e descrizione propri, indirizzo canonico, alternative per lingua (`it`, `en`,
  `zh-Hans`, predefinita inglese), immagine per i social generata alla pubblicazione.
- Dati strutturati: organizzazione (agenzia assicurativa con RUI, sedi, contatti), servizio, domande frequenti,
  istruzioni passo per passo, articolo, briciole di pane.
- `sitemap.xml` con le tre lingue e la data di aggiornamento; `llms.txt` con la descrizione del sito per le IA;
  feed del blog.
- Contenuti scritti per essere citati: una risposta di 40-60 parole sotto ogni domanda, tabelle di confronto,
  glossario, data di aggiornamento visibile, fonti primarie collegate.
- Verifica delle proprietà su Google Search Console e Bing Webmaster tramite codice impostabile senza modificare
  il sito. Bing conta perché alimenta ChatGPT e Copilot.
- Limiti di prestazione sulle pagine pubbliche da telefono: elemento principale visibile entro 2,5 secondi,
  spostamenti di impaginazione sotto 0,1, JavaScript iniziale sotto 150 kB compressi.

### 6.5 Esperienza e autorevolezza (E-E-A-T)
- Ogni articolo ha autore con nome e qualifica, eventuale revisore, data di pubblicazione e di aggiornamento.
- Ogni affermazione normativa rimanda alla fonte primaria (Normattiva, Agenzia delle Entrate, Gazzetta Ufficiale,
  giustizia amministrativa).
- L'esperienza si mostra con il processo reale: cosa controlla il portale, quali errori capitano nei documenti,
  come si firma un file `.p7m`.
- Pagina «Chi siamo» breve nella homepage: iscrizione al RUI verificabile sul sito IVASS, sedi, recapiti.
- Nota su ogni contenuto normativo: informazione generale, non consulenza fiscale.

### 6.6 Cookie e misurazione
- Banner alla prima visita con «Accetta», «Rifiuta» e «Personalizza» di pari evidenza; la chiusura vale rifiuto.
  Categorie: necessari, statistiche (Google Analytics 4), marketing (Google Ads). Scelta ricordata 6 mesi e
  modificabile dal piè di pagina.
- Modalità di consenso di Google versione 2: nessuno script di Google prima del consenso.
- Gli identificativi di Analytics e Ads si impostano nella configurazione di Vercel. Senza identificativi non si
  carica nulla e il banner non mostra le categorie vuote.
- Conversione registrata all'invio riuscito del modulo.
- Pagina «Cookie» con l'elenco dei cookie e pagina «Privacy» per il modulo, adattate dall'informativa già usata
  nei documenti del portale.

### 6.7 Grafica e movimento
- Colori Tecno, titoli con il carattere con grazie già usato nel ciclo del lotto, superfici in vetro per barra,
  riquadri, banner e modulo.
- Movimento: comparsa allo scorrimento, aloni che si spostano con la pagina, linea dei cinque passi che si
  disegna, riquadri che reagiscono al puntatore. Con «riduci movimento» attivo le animazioni si fermano.
- Sfondo dell'apertura generato con Higgsfield: forme astratte di vetro e luce in blu e bronzo, senza persone,
  come video breve in ciclo con immagine fissa di riserva. Peso massimo 1,5 MB; non parte con connessione lenta.
  Altre due o tre immagini astratte per le sezioni.
- Spesa Higgsfield: disponibili 270 crediti; tetto di 150 per tutto il lavoro, con resoconto a fine generazione.
- Il titolare ha chiesto di generare senza anteprima: il risultato si giudica sull'anteprima della PR.

### 6.8 Blog e pagine per pubblico (seconda consegna)
- Articoli come file di testo nel repository, uno per lingua, con titolo, descrizione, autore, date e fonti.
- Pagine dedicate: «Per rappresentanti fiscali e studi» e «Per società estere che vendono online».
- Primi otto articoli:
  1. Garanzia VIES: cos'è, chi deve prestarla e cosa dice l'art. 35, comma 7-quater.
  2. Cauzione, fideiussione bancaria o polizza fideiussoria: confronto.
  3. Documenti necessari per la fideiussione VIES di una società estera.
  4. Dalla richiesta alla polizza emessa: come funziona il portale Tecno.
  5. Gestire un lotto di 20 pratiche: guida per rappresentanti fiscali.
  6. Polizze firmate digitalmente (.p7m): cosa sono e come si firmano.
  7. Garanzia del rappresentante fiscale e garanzia VIES del rappresentato: le differenze.
  8. Venditori extra UE sui marketplace: partita IVA italiana e VIES, passo per passo.

### 6.9 Criteri on-page (skill SearchFit `on-page-seo`)

**Homepage attuale.** Parola chiave obiettivo: «fideiussione VIES». Punteggio: 5 su 100.
- Titolo «Tecno Advance MGA - Gestione Pratiche Assicurative» (50 caratteri): senza parola chiave.
- Descrizione di 137 caratteri: senza parola chiave e senza invito.
- H1 «Gestione Pratiche Assicurative», disegnato nel browser: assente nell'HTML servito.
- Un solo H2, circa 100 parole di testo generico, nessun link interno, nessun dato strutturato, pagina bloccata.

**Obiettivo per pagina.** Titoli di 50-60 caratteri con la parola chiave all'inizio, descrizioni di 150-160 con
un invito, un solo H1. I conteggi sono verificati.

| Pagina | Parola chiave | Intento | Titolo | H1 |
|---|---|---|---|---|
| `/` | fideiussione VIES | commerciale | Fideiussione VIES per soggetti non residenti \| Tecno MGA | Fideiussione VIES per soggetti non residenti |
| `/rappresentanti-fiscali/` | fideiussione VIES rappresentante fiscale | commerciale, tra aziende | Fideiussioni VIES per rappresentanti fiscali \| Tecno MGA | Fideiussioni VIES per rappresentanti fiscali e studi |
| `/venditori-esteri/` | garanzia VIES società extra UE | commerciale | Garanzia VIES per società extra UE che vendono in Italia | Garanzia VIES per società extra UE |
| `/blog/` | garanzia VIES guida | informativo | Garanzia VIES: norme, documenti e guide \| Blog Tecno MGA | Guide sulla garanzia VIES |
| `/en/` | VIES guarantee Italy | commerciale | VIES Guarantee Italy: €50,000 Surety Bond \| Tecno MGA | VIES guarantee in Italy for non-EU companies |
| `/en/fiscal-representatives/` | VIES surety bond fiscal representative | commerciale, tra aziende | VIES Surety Bonds for Fiscal Representatives \| Tecno MGA | VIES surety bonds for fiscal representatives |
| `/en/non-eu-sellers/` | Italy VIES guarantee non-EU sellers | commerciale | Italy VIES Guarantee for Non-EU Sellers \| Tecno MGA | Italy VIES guarantee for non-EU sellers |
| `/zh/` | 意大利VIES保函 | commerciale | 意大利VIES保函：5万欧元、36个月 \| Tecno MGA | 面向非欧盟企业的意大利VIES保函 |

Descrizioni:
- `/`: «Polizza fideiussoria VIES da 50.000 euro per 36 mesi, art. 35 c. 7-quater DPR 633/1972. Per rappresentanti
  fiscali e società estere. Richiedi un contatto.»
- `/rappresentanti-fiscali/`: «Gestisci le fideiussioni VIES dei tuoi rappresentati in lotti fino a 20 pratiche:
  controllo dei documenti, firme digitali ed estratto conto in un portale.»
- `/venditori-esteri/`: «Vendi in Italia da fuori UE? Per l'iscrizione al VIES serve una garanzia di 50.000 euro
  per 36 mesi. Scopri documenti, passaggi e come richiedere la polizza.»
- `/blog/`: «Guide e aggiornamenti sulla garanzia VIES: art. 35 comma 7-quater, documenti necessari, firma
  digitale delle polizze e gestione dei lotti nel portale Tecno.»
- `/en/`: «Surety bond for the Italian VIES guarantee: €50,000 for 36 months, for non-EU companies with a fiscal
  representative. See documents, steps and get in touch.»
- `/zh/`: «非欧盟企业通过税务代表在意大利登记VIES，须提供不少于5万欧元、期限不少于36个月的担保。了解所需文件与办理流程，并在线提交咨询。»

**H2 della homepage**, in forma di domanda dove serve una risposta diretta: Cos'è la garanzia VIES? · A chi
serve la fideiussione VIES? · Come si ottiene la polizza fideiussoria VIES? · Il portale per rappresentanti
fiscali · Quali documenti servono? · Quanto costa la fideiussione VIES? · Domande frequenti · Contatti.

**Regole per tutte le pagine**
- Indirizzi brevi, in minuscolo, con trattini e con la parola chiave; nessun parametro.
- Parole collegate usate in modo naturale: polizza fideiussoria, cauzione, rappresentante fiscale, soggetti non
  residenti, Agenzia delle Entrate, operazioni intracomunitarie, partita IVA, marketplace.
- Formati adatti alle risposte in evidenza: definizione in 40-60 parole, elenco numerato dei passi, tabella di
  confronto tra cauzione, fideiussione bancaria e polizza fideiussoria.
- Immagini: nome del file descrittivo, testo alternativo, dimensioni dichiarate, formato moderno e compresso.
- Almeno 3-5 link interni per pagina con testo descrittivo, mai «clicca qui».
- Dati strutturati con tutti i campi obbligatori, secondo il tipo di pagina (§6.4).

Le altre skill SearchFit si usano quando servono: `technical-seo` e `schema-markup` nella prima consegna;
`keyword-clustering`, `content-brief`, `internal-linking` e `content-translation` nella seconda; `ai-visibility`
in entrambe; `seo-audit` come controllo finale prima di ogni pubblicazione.

## 7. Consegne

1. **Prima PR:** due ingressi, homepage nelle tre lingue, modulo contatti con elenco per gli amministratori,
   privacy e cookie, banner e misurazione, robots, sitemap, dati strutturati, `llms.txt`, grafica.
2. **Seconda PR:** blog, due pagine per pubblico, otto articoli, feed.
3. **Documento per le campagne:** parole chiave per gruppo, parole da escludere, testi degli annunci per Italia,
   India e Pakistan.

Ogni PR si unisce e si pubblica solo con l'ok del titolare, a controlli verdi, come di consueto.

## 8. Lasciato a chi costruisce

- Come generare l'HTML alla pubblicazione e come servire i due ingressi in sviluppo.
- La forma esatta delle regole di Vercel per intestazioni, riscritture e CSP per percorso.
- La libreria per leggere gli articoli; se usare una libreria di animazione, entro il limite di peso.
- Nome e colonne della tabella delle richieste, e la posizione dell'elenco nel portale.
- Formato e compressione del video.

## 9. Serve dal titolare

1. **Verifica dei testi normativi.** Li leggo sulle fonti primarie e li segno con la data; prima della
   pubblicazione li rilegge il titolare o un professionista, sull'anteprima della PR. Senza verifica della sentenza
   del TAR, il testo resta neutro.
2. **Chi firma gli articoli:** nome e qualifica. Proposta: Anton Carlo Santoro.
3. **Casella `vies@tecnomga.com`:** deve esistere e ricevere.
4. **Google:** proprietà di dominio `tecnomga.com` in Search Console (oggi l'account collegato non ne ha),
   identificativi di Analytics 4 e Ads, e accesso a Bing Webmaster. Possono arrivare anche dopo la pubblicazione.
5. **Conferma di chi segue la compliance** su avvertenza pubblicitaria, informativa privacy e pagina reclami.
6. Consigliato, fuori da questo lavoro: un link dal sito WordPress verso il portale e la correzione del link a
   `info@example.com` presente lì.

## 10. Come si verifica

- L'HTML di ogni pagina pubblica, scaricato senza eseguire JavaScript, contiene titolo e testo.
- Le pagine riservate rispondono ancora «non indicizzare» e la loro CSP non contiene indirizzi di Google.
- Prima del consenso non parte nessuna richiesta verso Google; dopo il rifiuto nemmeno.
- Il modulo salva la richiesta, invia l'email, rifiuta il campo trappola e rispetta il limite di frequenza.
- I dati strutturati sono validi e le alternative per lingua sono reciproche.
- Misura delle prestazioni da telefono entro i limiti del §6.4.
- Tutti i controlli esistenti restano verdi; i due test che toccano la homepage sono aggiornati.

## Fonti della ricerca

- Agenzia delle Entrate, scheda «Inclusione archivio Vies», normativa e prassi:
  https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva
- Fisco Oggi, «Soggetti extra Ue con rappresentante, nuove regole per operare nel Vies»:
  https://www.fiscooggi.it/portale/-/soggetti-extra-ue-con-rappresentante-nuove-regole-per-operare-nel-vies
- Edotto, «Garanzia VIES per soggetti non residenti: istruzioni operative»:
  https://www.edotto.com/articolo/garanzia-vies-per-esteri-le-regole-del-fisco
- NT+ Diritto, «Garanzie per i soggetti non-UE […], al TAR l'ultima parola»:
  https://ntplusdiritto.ilsole24ore.com/art/garanzie-i-soggetti-non-ue-che-effettuano-operazioni-intracomunitarie-tar-l-ultima-parola-AHHItpmB
- Italia Fideiussioni, «TAR Lazio 4986/2026: garanzia VIES 50.000 € confermata» (fonte commerciale):
  https://www.italiafideiussioni.it/sentenza-tar-lazio-4986-2026-garanzia-vies-50000-euro/
- VIES Guarantee, «Italy VAT VIES Guarantee 2026: Obligation Confirmed by TAR» (fonte commerciale):
  https://www.viesguarantee.com/finance/italy-vat-vies-guarantee-2026/
- Marosa VAT, «Italy: New Fiscal Representation and VIES Guarantees Required by June 2025»:
  https://marosavat.com/vat-news/italy-guarantee-fiscal-representation-non-eu-vies
- Heca MGA, «Fideiussione Rappresentante Fiscale: nuovi obblighi 2024»:
  https://www.hecamga.it/news/assicurazioni/nuovo-obbligo-garanzia-rappresentanti-fiscali.html
