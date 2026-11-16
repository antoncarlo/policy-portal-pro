# Nuovo sito aziendale tecnomga.com — progetto

*Approvato dal titolare il 16/11/2026. Il sito aziendale di Tecno Advance MGA Broker Srl viene rifatto da capo, in codice e fuori da WordPress, con la stessa tecnologia del sito pubblico del portale: pagine veloci, un'apertura scenica, una pagina solida per ogni prodotto, scritta per farsi trovare da Google e dalle IA. Questo documento fissa che cosa si costruisce e perché; il piano di lavoro viene dopo la sua approvazione.*

## SECTION 01 — Perché e per chi

Il sito attuale (WordPress + Elementor, modello «Minesure») è stato lasciato a metà: pagine con il contenuto di un altro prodotto, testi in inglese rimasti dal modello, due agenti inesistenti, link senza destinazione, 39 MB di video, 55/100 su telefono. L'elenco completo è nell'audit del 16/11/2026.

Il nuovo sito serve a tre cose:

1. **Dare credibilità**: chi arriva deve capire in pochi secondi chi è Tecno MGA, che cosa intermedia e che è un soggetto vigilato.
2. **Farsi trovare**: ogni prodotto ha una pagina che risponde alla ricerca di chi lo sta cercando, in Google e nelle risposte delle IA.
3. **Portare richieste**: da ogni pagina si arriva a una richiesta di preventivo che finisce a `info@tecnomga.com`.

Pubblico, per prodotto:

| Prodotto | A chi parla |
|---|---|
| Fideiussioni e cauzioni, CAR, decennale postuma | Imprese di costruzione, imprese che partecipano a gare, costruttori e venditori di immobili |
| RC professionale, D&O | Professionisti, amministratori e società |
| Pet, casa, auto, infortuni e malattia | Privati e famiglie |
| Fotovoltaico, impresa e commercio | Imprese e attività commerciali |
| VIES | Rappresentanti fiscali e società extra UE: resta sul portale, il sito aziendale rimanda lì |

Il titolare ha indicato come prodotti più venduti: fideiussioni (VIES comprese), CAR, postuma, RC, D&O e pet. Questi stanno in alto nel menu e in homepage.

## SECTION 02 — Obiettivi, cose fuori progetto, cose da evitare

**Obiettivi**

- Homepage con apertura scenica (il mondo di notte sotto uno scudo di vetro) e movimento curato in tutto il sito.
- Una pagina per ciascuno degli undici prodotti, più le pagine per tipo di fideiussione.
- Italiano e inglese.
- SEO e GEO su ogni pagina: titolo, descrizione, risposta diretta, domande frequenti, fonti, dati strutturati.
- Richiesta di preventivo da ogni pagina.
- Stessa famiglia visiva del sito del portale: blu notte e bronzo, riquadri in vetro liquido, caratteri Lora e Inter.
- Prestazioni: almeno 90/100 su telefono, pagina iniziale sotto 1 MB senza il video.

**Fuori progetto**

- Preventivi calcolati online e acquisto online.
- Area clienti: resta sul portale.
- Modifica dei contenuti da parte del titolare senza passare da una richiesta: è il limite accettato della strada scelta.
- Versione cinese: resta sul portale.
- Cancellazione di WordPress: viene spento e tenuto come archivio.

**Da evitare** (renderebbero il sito un fallimento anche se funziona)

- Numeri o primati non verificabili («50+ anni», «oltre 20 compagnie», «i primi»).
- Nomi e loghi di compagnie o di società del gruppo senza un'autorizzazione esplicita.
- Prezzi, tempi di emissione, promesse di accettazione.
- Persone inventate, foto di repertorio spacciate per il team, testi di modello.
- Affermazioni normative senza fonte primaria verificata.
- Video o immagini pesanti che rallentano il telefono.

## SECTION 03 — Vincoli

- **Intermediario vigilato.** Su ogni pagina: denominazione, iscrizione al RUI, sedi, PEC, vigilanza IVASS, modalità di reclamo, avviso «messaggio pubblicitario». Gli obblighi precisi per il sito di un intermediario si verificano sui regolamenti IVASS in fase di scrittura.
- **Regola di precisione.** Ogni fatto viene da una fonte primaria letta in sessione oppure dal titolare. Ciò che non è verificato non si scrive.
- **Dati societari.** I dati dell'intermediario si prendono dai documenti ufficiali della società (MUP, informativa privacy) e dal titolare (SECTION 11), non dal sito attuale, che riporta recapiti di un'altra società.
- **Gusto del titolare** (già espresso per il portale): niente scritte piccole sopra i titoli, niente sottotitoli sotto i titoli di sezione, banner dei cookie con un solo consenso.
- **Posta.** Il cambio di indirizzo del sito non deve toccare la posta di `tecnomga.com`.
- **Unione e pubblicazione** solo con l'ok esplicito del titolare, a controlli verdi.

## SECTION 04 — Strade considerate

| Strada | Com'è | Perché sì o no |
|---|---|---|
| **1. Sito nuovo in codice, fuori da WordPress** | Pagine generate come HTML, ospitate su Vercel, come il sito del portale | **Scelta dal titolare.** Pieno controllo su grafica e movimento, massima velocità. Limite accettato: le modifiche passano da una richiesta |
| 2. Stesso codice servito da WordPress come plugin | Stesso aspetto, ma dentro l'hosting attuale | Scartata: non è modificabile dal titolare e lascia WordPress da mantenere |
| 3. Rifatto dentro Elementor | Modificabile dal titolare | Scartata: le parti sceniche andrebbero comunque in codice, il peso di Elementor resta, e la scrittura delle pagine da remoto è lenta e fragile |

## SECTION 05 — Pagine

| Pagina | Ricerca a cui risponde | Note |
|---|---|---|
| Home | Tecno MGA, broker assicurativo | Apertura, prodotti in evidenza, perché un broker, il gruppo, come si chiede un preventivo |
| Prodotti | elenco | Tutti i prodotti, i sei principali per primi |
| Fideiussioni e cauzioni | fideiussione assicurativa | Pagina madre: che cosa sono, tipi, rimando al portale per le VIES |
| Fideiussioni per appalti | cauzione provvisoria, cauzione definitiva | Tipo |
| Fideiussione per rimborso IVA | fideiussione rimborso IVA | Tipo |
| Fideiussione per immobili da costruire | fideiussione acquirenti immobili da costruire | Tipo |
| Fideiussione per oneri di urbanizzazione | fideiussione oneri di urbanizzazione | Tipo |
| CAR | polizza CAR | Separata dalla postuma |
| Decennale postuma | polizza decennale postuma | Separata dalla CAR |
| RC professionale | assicurazione RC professionale | |
| D&O | polizza D&O | Pagina nuova |
| Pet | assicurazione cane e gatto | |
| Fotovoltaico | assicurazione impianto fotovoltaico | |
| Impresa e commercio | assicurazione multirischio attività | |
| Casa | assicurazione casa | |
| Auto | assicurazione auto | |
| Infortuni e malattia | assicurazione infortuni e malattia | |
| Chi siamo | Tecno Advance MGA Broker | Società, gruppo, dati RUI |
| Guide | domande più cercate | Indice e articoli firmati, come sul portale |
| Contatti | richiesta di preventivo | |
| Privacy, Cookie, Reclami, Informative | | Le informative raccolgono i documenti oggi in PDF |

I quattro tipi di fideiussione sono una proposta approvata con il progetto: il titolare ha detto «fideiussioni di tutti i tipi» senza elencarli e può toglierne o aggiungerne.

Ogni pagina esiste in italiano e in inglese, con indirizzi tradotti e rimandi reciproci tra le lingue; la lingua predefinita è l'italiano. L'inglese riporta gli stessi fatti dell'italiano, non testi diversi. Gli indirizzi esatti si scelgono in fase di piano, con una verifica delle parole cercate.

**Vecchi indirizzi.** Ogni indirizzo del sito attuale viene reindirizzato in modo permanente alla pagina nuova corrispondente:

| Oggi | Domani |
|---|---|
| `/about-us/` | Chi siamo |
| `/services/` | Prodotti |
| `/contact/` | Contatti |
| `/fideiussioni-e-cauzioni/` | Fideiussioni e cauzioni |
| `/decennale-postuma-e-car/` | Decennale postuma |
| `/ar-fotovoltaico/` | Fotovoltaico |
| `/business-insurance/` | Impresa e commercio |
| `/health-insurance/` | RC professionale (è il contenuto reale della pagina) |
| `/home-insurance/` | Infortuni e malattia (idem) |
| `/life-insurance/` | Pet (idem) |
| `/travel-insurance/` | Auto (idem) |
| `/vehicle-insurance/` | Casa (idem) |
| `/en/…` | La pagina inglese corrispondente |
| Pagine di prova, autori, categorie, pagine interne del costruttore | Risposta «non più disponibile» |

## SECTION 06 — Com'è fatta una pagina di prodotto

Tutte le pagine di prodotto hanno la stessa ossatura, così Google e le IA trovano sempre la risposta nello stesso punto.

1. Titolo principale con il nome del prodotto come lo cerca il cliente.
2. Risposta diretta in 40-60 parole: che cos'è, a chi serve, quando è richiesta.
3. A chi serve.
4. Che cosa copre in generale e che cosa di solito resta escluso, senza riferirsi alle condizioni di una compagnia.
5. Quando è obbligatoria o richiesta, con la norma e il link alla fonte ufficiale.
6. Che cosa serve per chiedere un preventivo.
7. Come si procede con Tecno MGA.
8. Domande frequenti, tre o più, con risposte di 40-60 parole.
9. Fonti ufficiali e data dell'ultima verifica.
10. Invito al preventivo e rimandi ai prodotti collegati.

Regole dei testi: le stesse del blog del portale. Titolo di 50-60 caratteri, descrizione di 150-160, nessun prezzo, nessun nome di compagnia, sole fonti ufficiali, stessa struttura nelle due lingue; i test lo verificano.

Dei testi attuali si riusa solo ciò che è corretto e in italiano; il resto si riscrive.

## SECTION 07 — Aspetto e movimento

- **Tavolozza:** blu notte e bronzo del logo, la stessa del sito del portale; fondi chiari color carta per le sezioni di lettura.
- **Apertura:** video a ciclo continuo del mondo di notte sotto uno scudo di vetro a esagoni (idea 4, scelta dal titolare), con l'alba sul bordo nel tono bronzo del logo. Movimento lento e continuo: luce che scorre sugli esagoni, città che pulsano, alba che respira; niente rotazione completa, così il ciclo non ha stacchi. Titolo e pulsanti a sinistra.
- **Peso del video:** sotto 3 MB, con immagine ferma mostrata subito e video caricato dopo; su connessioni lente o con «riduci movimento» attivo resta l'immagine.
- **Riquadri in vetro liquido** (richiesta esplicita del titolare): tutti i riquadri del sito, dai prodotti ai passi alle domande, sono lastre di vetro traslucido: sfondo sfocato che lascia intravedere ciò che sta dietro, bordo luminoso sottile, riflesso che segue il puntatore, leggera deformazione della luce al passaggio, ombra morbida. Su fondo scuro vetro chiaro, su fondo chiaro vetro appena brunito. Il testo dentro il vetro resta sempre leggibile (contrasto almeno AA); dove il browser non supporta la sfocatura il riquadro diventa una lastra piena dello stesso colore.
- **Movimento nel resto del sito:** comparsa delle sezioni allo scorrimento, profondità tra i piani mentre si scorre, barra di avanzamento, passaggi morbidi tra gli stati; tutto disattivato con «riduci movimento».
- **Immagini:** una per prodotto, generate con Higgsfield nello stesso stile (oggetti in vetro e bronzo su blu notte), più le immagini per i social. Nessuna foto di persone. Prima di generare video o serie di immagini si verifica il costo in crediti; se supera quelli disponibili si chiede al titolare.
- **Telefono:** progettato prima per il telefono; nessuno scorrimento laterale.

## SECTION 08 — SEO e GEO

- Una ricerca, una pagina: nessuna pagina concorre con un'altra per la stessa ricerca. Le VIES restano del portale.
- Su ogni pagina: titolo, descrizione, indirizzo canonico, alternative per lingua, dati strutturati (intermediario assicurativo con RUI e sedi, servizio, domande frequenti, briciole; articolo firmato per le guide).
- `sitemap.xml`, `robots.txt`, `llms.txt`, feed delle guide per lingua, invio a IndexNow dopo ogni pubblicazione.
- Search Console: proprietà di dominio `tecnomga.com` (un record nel DNS, lo inserisce il titolare), invio della sitemap, richiesta di indicizzazione delle pagine principali. Bing: importazione da Search Console.
- Collegamenti: dal sito aziendale al portale per le VIES e dal portale al sito aziendale nel piè di pagina.
- Guide: almeno una per ciascuno dei sei prodotti principali alla prima uscita, sulle domande più cercate.
- **Che cosa non si può promettere:** la prima posizione. Dipende anche da concorrenti, link in ingresso e tempo. Il progetto garantisce la parte che dipende dal sito.

## SECTION 09 — Richieste di preventivo

- Modulo in ogni pagina di prodotto e nella pagina Contatti: nome, società (facoltativa), email, telefono, prodotto, messaggio, consenso alla privacy.
- La richiesta viene salvata e inviata a `info@tecnomga.com`; gli amministratori la vedono nell'elenco delle richieste già presente nel portale, con l'indicazione del sito e del prodotto.
- Protezioni come sul portale: campo trappola, limite di invii, validazione nel browser e sul server.
- Nessun caricamento di file.

## SECTION 10 — Tecnica

- **Un motore, due siti.** Il codice che oggi genera il sito del portale (pagine, testata, dati strutturati, sitemap, guide, consenso, modulo) diventa un motore comune; portale e sito aziendale sono due definizioni di sito sopra lo stesso motore, nello stesso repository. I test del portale devono restare verdi dopo la separazione.
- **Pubblicazione separata.** Il sito aziendale è un progetto Vercel a sé, con il dominio `tecnomga.com` e `www`, e con una configurazione di pubblicazione propria, distinta da quella del portale: le regole di intestazioni e indirizzi dell'uno non devono valere per l'altro. È solo statico. Fino al passaggio del dominio vive su un indirizzo di prova non indicizzabile.
- **Modulo.** Invia al servizio contatti del portale, che accetta le richieste provenienti da `tecnomga.com`.
- **Sicurezza:** intestazioni e politica dei contenuti come le pagine pubbliche del portale; nessuno script in linea.
- **Consenso e misurazione:** stesso banner del portale; Analytics solo dopo il consenso e solo se il titolare fornisce l'identificativo. Informativa privacy e cookie con lo stesso titolare del trattamento e lo stesso contatto per la protezione dei dati già decisi per il portale.
- **Accessibilità:** navigazione da tastiera, contrasto AA, testi alternativi, rispetto di «riduci movimento».
- **Passaggio dal vecchio al nuovo sito:**
  1. Il nuovo sito viene completato e verificato su un indirizzo di prova.
  2. Il titolare approva.
  3. Il titolare cambia nel DNS (Register.it) i record del sito; i record della posta non si toccano.
  4. Verifica di pagine, reindirizzamenti, modulo e certificato.
  5. WordPress resta spento ma conservato. Per tornare indietro basta rimettere i record di prima.

## SECTION 11 — Dati del titolare

Ricevuti il 16/11/2026 con l'approvazione del progetto:

| Dato | Valore | Stato |
|---|---|---|
| Sede legale | Via Po 102, 00198 Roma, come nel MUP, nell'informativa privacy e nel portale | Confermato |
| Sede operativa | Via Michele Mercati 18, 00197 Roma | Come sul portale |
| Reclami | Via email a `info@tecnomga.com`, per iscritto alla sede legale. Helpet non c'entra | Confermato |
| Compagnie con cui Tecno lavora | Generali, AXA, Vittoria, Helpet, Markel | Confermato; solo i nomi, senza loghi finché non c'è un'autorizzazione scritta. Markel solo nell'elenco generale, mai accanto alle VIES |
| Soci fondatori | Anton Carlo Santoro e Barbara Santoro | Confermato |
| Testo sul gruppo | «I soci fondatori di Tecno MGA, Anton Carlo Santoro e Barbara Santoro, hanno fondato anche Helpet, realtà dedicata agli animali domestici cresciuta in Vittoria hub, l'incubatore di Vittoria Assicurazioni. Da questa esperienza nasce la nostra linea per i pet, sviluppata con Mapfre.» Vittoria e Mapfre si citano solo in questa frase, riferita ai soci fondatori | Approvato dal titolare; si pubblica così, senza varianti |
| Termini e condizioni | Il PDF collegato oggi è quello dell'app Helpet | Non si riporta nel nuovo sito |

Ancora da ricevere. Finché un dato manca, la parte che lo usa non viene pubblicata.

| Dato | Dove serve |
|---|---|
| Autorizzazione all'uso dei loghi delle compagnie | Home |
| Numeri da dichiarare, se documentabili | Home, Chi siamo |
| Quale RC oltre alla professionale (per esempio RC d'impresa) | Prodotti |
| Profili social reali | Piè di pagina, Contatti |
| Documenti aggiornati: informativa privacy, MUP, vendita a distanza | Informative |
| Persone da mostrare, se volute: nome, ruolo, foto, consenso | Chi siamo |
| Identificativo di Analytics | Misurazione |

## SECTION 12 — Consegne

Ogni consegna è una richiesta di unione a sé, unita con l'ok del titolare. Una consegna è pronta quando: i controlli automatici sono verdi (compresi quelli del portale), la verifica SEO delle pagine generate non ha rilievi, le prove nel browser passano su telefono e PC, e la homepage misura almeno 90/100 su telefono.

1. Motore comune, ossatura del sito aziendale, homepage con apertura, piè di pagina, privacy, cookie, modulo, indirizzo di prova.
2. Le sei pagine principali: fideiussioni (madre), CAR, decennale postuma, RC professionale, D&O, pet.
3. Gli altri prodotti, i tipi di fideiussione, Chi siamo, Reclami, Informative.
4. Guide.
5. Inglese.
6. Passaggio del dominio, reindirizzamenti, Search Console, Bing.

## SECTION 13 — Lasciato a chi costruisce

- Indirizzi esatti delle pagine, dopo la verifica delle parole cercate.
- Come dividere il motore comune dalle due definizioni di sito.
- Formato e durata del video, purché entro il peso indicato e senza stacchi.
- Quali immagini generare per ciascun prodotto, nello stile indicato.
- Dove risiedono i testi del sito aziendale nel repository.

## SECTION 14 — Scelte fatte da chi scrive

Il titolare non le ha decise: può correggerle.

1. Italiano e inglese; niente cinese sul sito aziendale.
2. CAR e decennale postuma in due pagine separate.
3. Quattro pagine per tipo di fideiussione: appalti, rimborso IVA, immobili da costruire, oneri di urbanizzazione.
4. Le VIES non hanno una pagina sul sito aziendale: rimando al portale.
5. Nessun contatore di numeri in homepage.
6. Nessuna foto di persone finché non arrivano dati reali.
7. Il modulo del sito aziendale usa il servizio contatti del portale e le richieste compaiono nell'elenco degli amministratori.
8. Sito aziendale nello stesso repository del portale, pubblicato come progetto separato.
9. Il video dell'apertura non ruota per intero.
10. Le pagine con indirizzo inglese e contenuto diverso vengono reindirizzate al prodotto di cui parlano davvero.
11. Dove un dato del titolare manca (gruppo, compagnie, numeri, persone), la sezione che lo usa non compare, invece di mostrare un testo provvisorio.
