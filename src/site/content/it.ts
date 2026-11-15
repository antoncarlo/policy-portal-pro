import { audiencePages } from "./audience/it";
import type { SiteContent } from "./types";

// Ogni affermazione normativa e' verificata sul testo ufficiale: Provvedimento dell'Agenzia delle Entrate
// prot. n. 178713/2025 del 14 aprile 2025 (punti 1.1, 2.1-2.9, 3.1-3.4) e D.Lgs. 19 gennaio 2026, n. 10
// (artt. 68 c. 10, 170 e 171) su Normattiva. Nessun importo di premio, nessun nome di compagnia.
export const it: SiteContent = {
  meta: {
    home: {
      title: "Fideiussione VIES per soggetti non residenti | Tecno MGA",
      description: "Polizza fideiussoria VIES da 50.000 euro per 36 mesi, art. 35 c. 7-quater DPR 633/1972. Per rappresentanti fiscali e società estere. Richiedi un contatto.",
      h1: "Fideiussione VIES per soggetti non residenti",
      label: "Home",
    },
    representatives: {
      title: "Fideiussioni VIES per rappresentanti fiscali | Tecno MGA",
      description: "Gestisci le fideiussioni VIES dei tuoi rappresentati in lotti fino a 20 pratiche: controllo dei documenti, firme digitali ed estratto conto in un solo portale.",
      h1: "Fideiussioni VIES per rappresentanti fiscali e studi",
      label: "Rappresentanti fiscali",
    },
    sellers: {
      title: "Garanzia VIES per società extra UE che vendono in Italia",
      description: "Vendi in Italia da fuori UE? Per l'iscrizione al VIES serve una garanzia di 50.000 euro per 36 mesi. Scopri documenti, passaggi e come richiedere la polizza.",
      h1: "Garanzia VIES per società extra UE",
      label: "Società extra UE",
    },
    blog: {
      title: "Garanzia VIES: norme, documenti e guide | Blog Tecno MGA",
      description: "Guide e aggiornamenti sulla garanzia VIES: art. 35 comma 7-quater, documenti necessari, firma digitale delle polizze e gestione dei lotti nel portale Tecno.",
      h1: "Guide sulla garanzia VIES",
      label: "Guide",
    },
    privacy: {
      title: "Informativa sulla privacy del sito VIES | Tecno MGA Broker",
      description: "Come Tecno Advance MGA Broker Srl tratta i dati di chi visita il sito VIES e invia una richiesta di contatto: finalità, basi giuridiche, tempi e diritti.",
      h1: "Informativa sulla privacy",
      label: "Privacy",
    },
    cookie: {
      title: "Cookie del sito VIES: quali usiamo e perché | Tecno MGA",
      description: "Quali cookie usa il sito VIES di Tecno Advance MGA Broker: tecnici sempre attivi, statistiche e marketing di Google solo con il consenso. Come cambiarlo.",
      h1: "Cookie",
      label: "Cookie",
    },
  },
  nav: {
    items: [
      { anchor: "cos-e", label: "Cos'è" },
      { anchor: "per-chi", label: "Per chi" },
      { anchor: "come-funziona", label: "Come funziona" },
      { anchor: "portale", label: "Il portale" },
      { anchor: "documenti", label: "Documenti" },
      { anchor: "costo", label: "Costo" },
      { anchor: "domande", label: "Domande" },
      { anchor: "contatti", label: "Contatti" },
    ],
    guides: "Guide",
    portal: "Area riservata",
    contact: "Richiedi contatto",
    menu: "Apri o chiudi il menu",
    languages: "Lingua del sito",
    skip: "Vai al contenuto",
    home: "Tecno Advance MGA Broker: pagina iniziale",
  },
  hero: {
    lead: "La polizza fideiussoria che le società non residenti nell'UE o nello SEE, con rappresentante fiscale in Italia, prestano all'Agenzia delle Entrate per entrare e restare nel VIES. La richiedi online, la segui passo per passo, la ricevi firmata digitalmente.",
    facts: [
      { value: "50.000 €", label: "valore minimo della garanzia" },
      { value: "36 mesi", label: "durata minima" },
      { value: "Art. 35, c. 7-quater", label: "DPR 633/1972" },
    ],
    primary: "Richiedi contatto",
    secondary: "Area riservata",
    note: "Per rappresentanti fiscali, studi professionali, broker e società estere.",
    card: { title: "Polizza fideiussoria VIES", beneficiaryLabel: "A favore di", beneficiary: "Direzione Provinciale dell'Agenzia delle Entrate", signed: "Firmata digitalmente", status: "Emessa" },
  },
  trust: {
    label: "Perché affidarsi a Tecno MGA",
    items: [
      { title: "Intermediario iscritto al RUI", text: "Sezione B del Registro Unico degli Intermediari assicurativi, n. B000746484. L'iscrizione si verifica sul sito dell'IVASS." },
      { title: "Sotto la vigilanza dell'IVASS", text: "L'attività di intermediazione assicurativa è soggetta alla vigilanza dell'Istituto per la Vigilanza sulle Assicurazioni." },
      { title: "Documenti controllati", text: "Ogni pratica passa un controllo automatico dei documenti e la verifica di un operatore prima di arrivare alla compagnia." },
      { title: "Polizze firmate digitalmente", text: "La polizza è emessa dalla compagnia come documento con firma digitale (.p7m), da consegnare alla Direzione Provinciale competente." },
    ],
    ruiCheck: "Verifica l'iscrizione sul Registro Unico degli Intermediari",
  },
  whatIs: {
    title: "Cos'è la garanzia VIES?",
    answer:
      "La garanzia VIES è la garanzia che una società non residente nell'Unione europea o nello Spazio economico europeo, con rappresentante fiscale in Italia, presta all'Agenzia delle Entrate per essere inclusa o restare nella banca dati VIES delle operazioni intracomunitarie. Vale almeno 50.000 euro e dura almeno 36 mesi.",
    facts: [
      { term: "Chi deve prestarla", text: "I soggetti non residenti in uno Stato dell'UE o dello SEE che assolvono gli obblighi IVA in Italia tramite un rappresentante fiscale nominato ai sensi dell'art. 17, terzo comma, del DPR 633/1972 e che vogliono effettuare operazioni intracomunitarie." },
      { term: "Importo", text: "Valore massimale minimo di 50.000 euro." },
      { term: "Durata", text: "Non meno di 36 mesi dalla data di consegna alla Direzione Provinciale dell'Agenzia delle Entrate." },
      { term: "A favore di chi", text: "Del Direttore pro tempore della Direzione Provinciale dell'Agenzia delle Entrate competente per il domicilio fiscale del rappresentante fiscale. Si consegna alla stessa Direzione, personalmente o tramite il rappresentante fiscale." },
      { term: "Quando", text: "Prima della richiesta di inclusione nel VIES per chi ha già la partita IVA; insieme alla dichiarazione di inizio attività per chi non l'ha ancora." },
      { term: "Dopo la consegna", text: "La Direzione Provinciale verifica che la garanzia sia conforme e comunica l'esito: da quella comunicazione si può chiedere l'inclusione nel VIES." },
    ],
    formsTitle: "Cauzione, fideiussione bancaria o polizza fideiussoria",
    formsColumns: { form: "Forma", issuer: "Chi la rilascia", commitment: "Cosa comporta" },
    forms: [
      { form: "Cauzione in titoli di Stato o garantiti dallo Stato", issuer: "Deposito vincolato dei titoli presso un depositario", commitment: "I titoli restano vincolati per tutta la durata della garanzia." },
      { form: "Fideiussione bancaria", issuer: "Una banca, ai sensi dell'art. 1 della legge 348/1982", commitment: "Serve una banca disposta a rilasciarla a una società con sede fuori dall'UE." },
      { form: "Polizza fideiussoria", issuer: "Un'impresa di assicurazione, ai sensi dell'art. 1 della legge 348/1982", commitment: "Il contraente paga un premio e non deposita titoli. È la forma che intermediamo." },
    ],
    lawTitle: "Dal 1° gennaio 2027 cambia l'articolo, non la regola",
    law: "Fino al 31 dicembre 2026 la garanzia è prevista dall'art. 35, comma 7-quater, del DPR 633/1972, attuato dal decreto del Ministro dell'Economia e delle Finanze del 4 dicembre 2024 (Gazzetta Ufficiale n. 292 del 13 dicembre 2024) e dal Provvedimento dell'Agenzia delle Entrate prot. n. 178713/2025 del 14 aprile 2025. Dal 1° gennaio 2027 si applica il Testo unico IVA, il D.Lgs. 10/2026 (decreto legislativo 19 gennaio 2026, n. 10): la stessa regola è nell'art. 68, comma 10, e i riferimenti alla norma abrogata valgono per la nuova (art. 170, comma 3).",
    sourcesTitle: "Fonti ufficiali",
    sources: [
      { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
      { label: "Agenzia delle Entrate, Inclusione nell'archivio VIES: normativa e prassi", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
      { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
      { label: "Normattiva, D.Lgs. 19 gennaio 2026, n. 10, Testo unico IVA (artt. 68, 170 e 171)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
      { label: "FiscoOggi, rivista dell'Agenzia delle Entrate: soggetti extra UE con rappresentante, nuove regole per operare nel VIES", href: "https://www.fiscooggi.it/portale/-/soggetti-extra-ue-con-rappresentante-nuove-regole-per-operare-nel-vies" },
      { label: "Commissione europea, verifica di una partita IVA nel VIES", href: "https://ec.europa.eu/taxation_customs/vies/" },
    ],
    disclaimer: "Informazione generale, non consulenza fiscale o legale. Per il tuo caso rivolgiti al rappresentante fiscale o al tuo consulente.",
    updated: "Aggiornato il",
  },
  audiences: {
    title: "A chi serve la fideiussione VIES?",
    items: [
      {
        title: "Rappresentanti fiscali, studi e broker",
        text: "Gestisci da un solo portale le garanzie VIES di tutte le società che rappresenti.",
        points: ["Lotti fino a 20 pratiche con un file Excel e una cartella di documenti per società", "Controllo automatico dei documenti, con l'elenco di quelli che mancano", "Estratto conto, firme digitali e polizze emesse nello stesso posto"],
        cta: "Parlaci dei tuoi volumi",
        more: "Fideiussioni VIES per rappresentanti fiscali",
      },
      {
        title: "Società estere che vendono in Italia e nell'UE",
        text: "Hai sede fuori dall'UE e dallo SEE, vendi online o a clienti europei e hai nominato un rappresentante fiscale in Italia: per operare nel VIES serve la garanzia.",
        points: ["Sito e portale in italiano, inglese e cinese", "Elenco chiaro dei documenti, con le traduzioni richieste", "Polizza firmata digitalmente, da consegnare tramite il tuo rappresentante fiscale"],
        cta: "Chiedi come iniziare",
        more: "Garanzia VIES per società extra UE",
      },
    ],
  },
  audiencePages,
  steps: {
    title: "Come si ottiene la polizza fideiussoria VIES?",
    items: [
      { title: "Carichi i documenti", text: "Il rappresentante fiscale o la società carica i dati e i documenti nel portale: una pratica alla volta oppure in lotti fino a 20." },
      { title: "Controlliamo la pratica", text: "Il portale legge i documenti, verifica che ci siano tutti e che i dati coincidano. Un operatore conferma e segnala cosa manca." },
      { title: "Bozza e pagamento", text: "La compagnia valuta la richiesta e prepara la bozza di polizza. Ricevi l'estratto conto e paghi il premio." },
      { title: "Firma digitale", text: "Scarichi i documenti da firmare, li firmi digitalmente e li ricarichi: il portale riconosce ogni file firmato e lo abbina alla sua pratica." },
      { title: "Polizza emessa", text: "Ricevi la polizza definitiva firmata digitalmente dalla compagnia, pronta per la consegna alla Direzione Provinciale dell'Agenzia delle Entrate." },
    ],
    outcome: "Dopo la consegna, la Direzione Provinciale verifica la garanzia e comunica l'esito: da quel momento si può chiedere l'inclusione nel VIES.",
  },
  portal: {
    title: "Il portale per rappresentanti fiscali",
    features: [
      { title: "Controllo automatico dei documenti", text: "Il portale legge i documenti caricati, riconosce di che tipo sono e verifica che i dati della società coincidano tra loro." },
      { title: "Lotti fino a 20 pratiche", text: "Un file Excel con i dati e un archivio di documenti per ogni società: il lotto nasce con un solo caricamento." },
      { title: "Firme digitali in blocco", text: "I documenti da firmare si scaricano insieme e si ricaricano insieme: ogni file .p7m torna alla sua pratica." },
      { title: "Estratto conto", text: "Per ogni lotto, un estratto conto con i premi delle polizze approvate, da pagare prima dell'emissione." },
      { title: "Stato e scadenze", text: "Ogni pratica mostra a che punto è. Lo scadenzario elenca le polizze che si avvicinano al termine dei 36 mesi." },
      { title: "Connessioni con altri sistemi", text: "Studi e piattaforme possono inviare pratiche e ricevere aggiornamenti dai propri sistemi." },
    ],
    api: { text: "Lavori con un tuo gestionale?", cta: "Leggi la documentazione delle API" },
    mock: {
      title: "Lotto di esempio",
      lot: "4 pratiche",
      columns: { company: "Società", documents: "Documenti", status: "Stato" },
      rows: [
        { company: "Alfa Trading Ltd", documents: "6 su 6", status: "Polizza emessa", tone: "done" },
        { company: "Beta Home Co.", documents: "6 su 6", status: "In firma", tone: "progress" },
        { company: "Gamma Tech Ltd", documents: "6 su 6", status: "In verifica", tone: "waiting" },
        { company: "Delta Sports Co.", documents: "5 su 6", status: "Manca un documento", tone: "missing" },
      ],
      note: "Dati di esempio, non riferiti a clienti reali.",
    },
  },
  documents: {
    title: "Quali documenti servono?",
    items: [
      { title: "Documento societario", text: "Licenza commerciale o certificato di costituzione della società estera, con traduzione." },
      { title: "Documento d'identità del legale rappresentante", text: "Passaporto o carta d'identità in corso di validità, con traduzione." },
      { title: "Estratto dal registro del Paese d'origine", text: "Per le società cinesi il report del sistema nazionale di informazione sul credito d'impresa; per Hong Kong il Business Registration Certificate." },
      { title: "Dichiarazione del titolare effettivo", text: "Indica chi controlla la società; serve per le verifiche antiriciclaggio." },
      { title: "Mandato di rappresentanza fiscale", text: "L'atto con cui la società ha nominato il rappresentante fiscale in Italia." },
      { title: "Dichiarazione a supporto della fideiussione", text: "Dichiarazione sostitutiva firmata dal legale rappresentante della società." },
    ],
    note: "L'elenco può cambiare secondo il Paese della società e la valutazione della compagnia: dopo il primo contatto inviamo quello definitivo per il tuo caso.",
  },
  cost: {
    title: "Quanto costa la fideiussione VIES?",
    answer:
      "Il costo della fideiussione VIES è il premio della polizza, stabilito dalla compagnia di assicurazione dopo l'esame dei documenti. Dipende dall'importo garantito, dalla durata e dal profilo della società estera. Non pubblichiamo un listino: inviamo una quotazione scritta per ogni richiesta, e il premio si paga prima dell'emissione.",
    factors: [
      { title: "Importo garantito", text: "Il minimo di legge è 50.000 euro." },
      { title: "Durata", text: "Almeno 36 mesi dalla consegna all'Agenzia delle Entrate." },
      { title: "Profilo della società", text: "Documenti societari, attività svolta e Paese di stabilimento." },
      { title: "Numero di pratiche", text: "Chi gestisce più società presenta le richieste in lotti." },
    ],
    cta: "Chiedi una quotazione",
    note: "Chiedere una quotazione non impegna a sottoscrivere la polizza.",
  },
  faq: {
    title: "Domande frequenti",
    items: [
      {
        q: "Chi deve prestare la garanzia VIES?",
        a: "I soggetti passivi non residenti in uno Stato dell'Unione europea o dello Spazio economico europeo che assolvono gli obblighi IVA in Italia tramite un rappresentante fiscale e vogliono effettuare operazioni intracomunitarie. Le società stabilite nell'UE o nello SEE non rientrano nell'obbligo. Lo stabilisce il punto 1.1 del Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025.",
      },
      {
        q: "Quanto vale e quanto dura la garanzia?",
        a: "Il valore massimale minimo è di 50.000 euro e la durata non può essere inferiore a 36 mesi, contati dalla data di consegna alla Direzione Provinciale dell'Agenzia delle Entrate competente. Lo indicano i punti 2.3 e 2.7 del Provvedimento del 14 aprile 2025, che attua il decreto ministeriale del 4 dicembre 2024.",
      },
      {
        q: "In quali forme si può prestare la garanzia VIES?",
        a: "In tre forme: cauzione in titoli di Stato o garantiti dallo Stato, fideiussione bancaria oppure polizza fideiussoria rilasciata da un'impresa di assicurazione, queste ultime ai sensi dell'art. 1 della legge 348/1982. Con la polizza fideiussoria il contraente paga un premio e non deve depositare titoli per tutta la durata della garanzia.",
      },
      {
        q: "A chi è intestata la garanzia e dove si consegna?",
        a: "La garanzia è prestata a favore del Direttore pro tempore della Direzione Provinciale dell'Agenzia delle Entrate competente per il domicilio fiscale del rappresentante fiscale. Si consegna alla stessa Direzione Provinciale, personalmente o tramite il rappresentante fiscale. L'ufficio ne verifica la conformità e comunica l'esito; da allora si può chiedere l'inclusione nel VIES.",
      },
      {
        q: "Quando va prestata la garanzia?",
        a: "Chi ha già la partita IVA italiana presta la garanzia prima di chiedere l'inclusione nel VIES. Chi non l'ha ancora la presta insieme alla dichiarazione di inizio attività in cui chiede l'inclusione. Chi era già incluso nel VIES alla pubblicazione del Provvedimento, il 14 aprile 2025, ha avuto sessanta giorni di tempo per adeguarsi.",
      },
      {
        q: "Cosa succede se la garanzia non viene prestata?",
        a: "L'Agenzia delle Entrate comunica al rappresentante fiscale, con posta elettronica certificata o raccomandata, l'avvio della procedura di esclusione dal VIES. Dal ricevimento decorrono altri sessanta giorni per prestare la garanzia. Se la garanzia non arriva, la partita IVA viene esclusa d'ufficio dalla banca dati dei soggetti che effettuano operazioni intracomunitarie.",
      },
      {
        q: "Dal 2027 cambia il riferimento normativo?",
        a: "Sì: cambia il numero dell'articolo, non la regola. Dal 1° gennaio 2027 si applica il Testo unico IVA, decreto legislativo 19 gennaio 2026, n. 10. La garanzia VIES è prevista dall'art. 68, comma 10, che riprende l'art. 35, comma 7-quater, del DPR 633/1972. I riferimenti alla norma abrogata si intendono fatti alla nuova.",
      },
      {
        q: "Un rappresentante fiscale può gestire più pratiche insieme?",
        a: "Sì. Nel portale un rappresentante fiscale o uno studio carica fino a 20 pratiche per lotto, con un file Excel dei dati e una cartella di documenti per ciascuna società. Il portale controlla i documenti, segnala quelli mancanti e segue ogni pratica fino alla polizza emessa, con un solo estratto conto per lotto.",
      },
      {
        q: "Tecno MGA emette la polizza?",
        a: "No. La polizza è emessa da una compagnia di assicurazione. Tecno Advance MGA Broker Srl è un intermediario assicurativo iscritto al Registro Unico degli Intermediari con il n. B000746484, sotto la vigilanza dell'IVASS: raccoglie e controlla i documenti, presenta la richiesta alla compagnia e consegna la polizza emessa e firmata digitalmente.",
      },
      {
        q: "Serve la traduzione dei documenti della società estera?",
        a: "Sì. La licenza commerciale o il certificato di costituzione della società e il documento d'identità del legale rappresentante vanno caricati con la loro traduzione, così la compagnia e il portale possono leggere denominazione, sede e dati di chi firma. Dopo il primo contatto indichiamo quali traduzioni servono e in quale lingua.",
      },
    ],
  },
  contact: {
    title: "Contatti",
    form: {
      name: "Nome e cognome",
      company: "Società o studio",
      role: "Chi sei",
      rolePlaceholder: "Scegli una voce",
      roles: {
        fiscal_representative: "Rappresentante fiscale",
        professional_firm: "Studio professionale",
        broker: "Broker o agente assicurativo",
        foreign_company: "Società estera",
        other: "Altro",
      },
      country: "Paese",
      email: "Email",
      phone: "Telefono",
      volume: "Pratiche stimate",
      volumeHint: "Per esempio: 1, 20 al mese, 100 l'anno",
      message: "Messaggio",
      optional: "facoltativo",
      consent: "Ho letto l'{privacy} e chiedo di essere ricontattato.",
      privacyLink: "informativa sulla privacy",
      submit: "Invia la richiesta",
      sending: "Invio in corso…",
      success: "Richiesta inviata. Ti rispondiamo all'indirizzo che hai indicato.",
      error: "Non siamo riusciti a inviare la richiesta. Riprova tra poco oppure scrivi a vies@tecnomga.com.",
      invalid: "Controlla i campi evidenziati.",
      fieldErrors: {
        required: "Campo obbligatorio.",
        email: "Indirizzo email non valido.",
        message: "Scrivi almeno dieci caratteri.",
        consent: "Serve il consenso per ricontattarti.",
      },
      noscript: "Il modulo richiede JavaScript. In alternativa scrivi a vies@tecnomga.com.",
    },
    details: {
      title: "Recapiti",
      email: "Email",
      phone: "Telefono",
      pec: "PEC",
      legalSeat: "Sede legale",
      office: "Sede operativa",
    },
  },
  blog: {
    by: "di",
    published: "Pubblicato il",
    updated: "Verificato sulle fonti il",
    summaryTitle: "In breve",
    faqTitle: "Domande frequenti",
    sourcesTitle: "Fonti ufficiali",
    relatedTitle: "Guide collegate",
    allGuides: "Tutte le guide sulla garanzia VIES",
    latestTitle: "Guide sulla garanzia VIES",
    feedTitle: "Guide sulla garanzia VIES di Tecno MGA",
    cta: { title: "Devi prestare la garanzia VIES?", text: "Raccontaci il tuo caso: ti indichiamo i documenti che servono e ti inviamo una quotazione scritta.", button: "Richiedi contatto" },
  },
  footer: {
    about: "Intermediario assicurativo. Questo sito è dedicato alla garanzia VIES per i soggetti non residenti con rappresentante fiscale in Italia.",
    rui: "Iscritta alla sezione B del Registro Unico degli Intermediari assicurativi (RUI) n.",
    vat: "P.IVA",
    site: "Il sito",
    legal: "Informazioni legali",
    contacts: "Recapiti",
    privacy: "Privacy",
    cookie: "Cookie",
    cookiePreferences: "Preferenze cookie",
    apiDocs: "Documentazione API",
    complaintsTitle: "Reclami",
    complaints: "I reclami sull'attività dell'intermediario si presentano per iscritto alla sede legale o all'indirizzo PEC. Resta la possibilità di rivolgersi all'IVASS, con le modalità indicate su ivass.it.",
    rights: "Tutti i diritti riservati.",
  },
  legal: {
    updated: "Ultimo aggiornamento:",
    noticeLabel: "informativa generale di Tecno Advance MGA Broker",
    privacy: {
      sections: [
        {
          title: "Chi tratta i tuoi dati",
          paragraphs: [
            "Il titolare del trattamento è Tecno Advance MGA Broker Srl, con sede legale in Via Po, 102 - 00198 Roma, P.IVA 17460381001, intermediario assicurativo iscritto al Registro Unico degli Intermediari con il n. B000746484.",
            "Per qualsiasi domanda sui tuoi dati puoi scrivere al responsabile della protezione dei dati (DPO), antoncarlo@tecnomga.com, o alla sede legale.",
            "Questa informativa riguarda la parte pubblica del sito portale.tecnomga.com e il suo modulo di contatto. Per i rapporti contrattuali e per l'area riservata vale l'{notice}.",
          ],
          list: [],
        },
        {
          title: "Quali dati raccogliamo",
          paragraphs: [
            "Con la richiesta di contatto non salviamo il tuo indirizzo IP. Per impedire gli abusi del modulo il sistema ne ricava un codice cifrato, da cui non si può risalire all'indirizzo, e lo conserva al massimo per un giorno.",
            "Dal modulo non chiediamo e non vogliamo ricevere dati particolari, per esempio sulla salute, né documenti: i documenti di una pratica si caricano solo nell'area riservata.",
          ],
          list: [
            "Dati che scrivi nel modulo di contatto: nome e cognome, società o studio, ruolo, Paese, email, il testo del messaggio e, se li indichi, telefono e numero di pratiche stimate. Registriamo anche la lingua e la pagina da cui hai inviato la richiesta.",
            "Dati di navigazione: indirizzo IP, tipo di browser, pagine richieste, data e ora. Li registrano in modo automatico i sistemi che ospitano il sito, per farlo funzionare e proteggerlo.",
            "Preferenze salvate nel tuo browser: la scelta sui cookie e quella sulla lingua.",
            "Dati raccolti dagli strumenti di Google, solo se hai dato il consenso: sono descritti nella pagina {cookie}.",
          ],
        },
        {
          title: "Perché li trattiamo e su quale base",
          paragraphs: [
            "Non usiamo i dati del modulo per inviarti newsletter o comunicazioni commerciali che non hai chiesto, e non prendiamo decisioni basate unicamente su trattamenti automatizzati.",
            "I campi obbligatori del modulo servono a risponderti: senza, non possiamo ricontattarti.",
          ],
          list: [
            "Rispondere alla tua richiesta e, se la chiedi, preparare una quotazione: sono misure precontrattuali adottate su tua richiesta (art. 6, par. 1, lett. b, del Regolamento UE 2016/679).",
            "Far funzionare il sito, proteggerlo e impedire gli abusi del modulo: è un nostro legittimo interesse (art. 6, par. 1, lett. f).",
            "Statistiche di visita e misurazione delle campagne pubblicitarie con gli strumenti di Google: solo con il tuo consenso (art. 6, par. 1, lett. a), che puoi revocare in ogni momento da «Preferenze cookie» nel piè di pagina.",
          ],
        },
        {
          title: "Per quanto tempo li conserviamo",
          paragraphs: [],
          list: [
            "Richieste di contatto: 24 mesi dall'invio, poi sono cancellate in modo automatico dall'elenco del portale. Se dalla richiesta nasce un rapporto contrattuale, i dati sono trattati secondo l'informativa generale.",
            "Email con la richiesta, nella casella di posta del titolare: per il tempo necessario a gestirla.",
            "Dati di navigazione: per i tempi tecnici dei registri del fornitore che ospita il sito.",
            "Scelta sui cookie: sei mesi nel tuo browser, poi la chiediamo di nuovo.",
          ],
        },
        {
          title: "Chi riceve i dati",
          paragraphs: [
            "I dati sono trattati dal personale autorizzato del titolare e dai fornitori che gli prestano servizi tecnici, come responsabili del trattamento:",
            "Alcuni di questi fornitori hanno sede negli Stati Uniti. Quando un trattamento comporta un trasferimento di dati fuori dallo Spazio economico europeo, avviene con le garanzie previste dagli articoli 45 e 46 del Regolamento: decisione di adeguatezza per i soggetti certificati al Data Privacy Framework oppure clausole contrattuali tipo.",
            "Non vendiamo i tuoi dati e non li comunichiamo ad altri soggetti, salvo che lo richieda la legge o un'autorità. Se la richiesta diventa una pratica, i dati necessari sono comunicati alla compagnia di assicurazione, come descritto nell'informativa generale.",
          ],
          list: [
            "Vercel Inc.: ospita il sito ed esegue le sue funzioni, nel centro dati di Dublino (Irlanda).",
            "Supabase Inc.: ospita la banca dati in cui sono salvate le richieste, nel centro dati in Irlanda.",
            "Google (Google Workspace) e Resend: servizi di posta elettronica con cui la richiesta arriva alla casella del titolare.",
            "Google Ireland Limited: Google Analytics e Google Ads, solo se hai dato il consenso.",
            "Functional Software Inc. (Sentry): riceve gli errori tecnici imprevisti del sito, senza i dati del modulo; i suoi sistemi sono in Germania.",
          ],
        },
        {
          title: "I tuoi diritti",
          paragraphs: [
            "Puoi chiedere in ogni momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del trattamento e la portabilità, e puoi opporti al trattamento fondato sul legittimo interesse (articoli da 15 a 22 del Regolamento). Se hai dato un consenso puoi revocarlo, senza effetti su ciò che è stato fatto prima.",
            "Per esercitare i tuoi diritti scrivi a antoncarlo@tecnomga.com o alla sede legale. Rispondiamo entro un mese, come prevede l'art. 12 del Regolamento.",
            "Se ritieni che il trattamento violi il Regolamento puoi proporre reclamo al Garante per la protezione dei dati personali (https://www.garanteprivacy.it/) o all'autorità di controllo del Paese in cui vivi o lavori.",
          ],
          list: [],
        },
        {
          title: "Modifiche a questa informativa",
          paragraphs: ["Aggiorniamo questa pagina quando cambiano i trattamenti o i fornitori. La data dell'ultimo aggiornamento è indicata in fondo alla pagina."],
          list: [],
        },
      ],
    },
    cookie: {
      intro: [
        {
          title: "Cosa sono",
          paragraphs: [
            "I cookie sono piccoli file che un sito salva nel tuo browser. Strumenti simili, come l'archivio locale del browser, servono allo stesso scopo: ricordare qualcosa tra una pagina e l'altra. Questa pagina elenca ciò che la parte pubblica del sito portale.tecnomga.com salva nel tuo browser, e perché.",
          ],
          list: [],
        },
        {
          title: "Cosa usiamo",
          paragraphs: [
            "Il sito non usa cookie di profilazione propri. Usa strumenti tecnici per ricordare le tue scelte e, solo se acconsenti, gli strumenti di Google per le statistiche di visita e per misurare le campagne pubblicitarie.",
            "Prima della tua scelta, e dopo un rifiuto, nessuno script di Google viene caricato. Se rifiuti, il sito funziona allo stesso modo.",
          ],
          list: [],
        },
      ],
      tableTitle: "Elenco",
      columns: { name: "Nome", purpose: "A cosa serve", duration: "Durata", owner: "Di chi è" },
      rows: [
        { name: "tecno-consent-v1 (archivio locale)", purpose: "Necessario. Ricorda la tua scelta sui cookie.", duration: "6 mesi", owner: "Tecno MGA" },
        { name: "tecno-lang-choice (archivio locale)", purpose: "Necessario. Ricorda che hai scelto la lingua, per non riproporti l'avviso.", duration: "Finché non cancelli i dati del browser", owner: "Tecno MGA" },
        { name: "_ga", purpose: "Statistiche, solo con il consenso. Google Analytics: distingue i visitatori.", duration: "2 anni", owner: "Google" },
        { name: "_ga_<ID>", purpose: "Statistiche, solo con il consenso. Google Analytics: mantiene lo stato della visita.", duration: "2 anni", owner: "Google" },
        { name: "_gcl_au", purpose: "Marketing, solo con il consenso. Google Ads: collega la visita a un annuncio per contare le richieste di contatto.", duration: "90 giorni", owner: "Google" },
        { name: "_gcl_aw", purpose: "Marketing, solo con il consenso. Google Ads: ricorda il clic sull'annuncio da cui sei arrivato.", duration: "90 giorni", owner: "Google" },
        { name: "IDE (doubleclick.net)", purpose: "Marketing, solo con il consenso. Google Ads: misura degli annunci sui domini di Google.", duration: "Fino a 13 mesi", owner: "Google" },
      ],
      after: [
        {
          title: "Come cambiare la scelta",
          paragraphs: [
            "Puoi cambiare idea in ogni momento con «Preferenze cookie» nel piè di pagina: la nuova scelta vale subito, e con il rifiuto i cookie di Google salvati dal sito vengono cancellati. Puoi anche cancellare i cookie dalle impostazioni del browser.",
            "Quando gli strumenti di Google non sono attivi sul sito non c'è nessuna scelta da fare, e il comando «Preferenze cookie» non compare.",
          ],
          list: [],
        },
        {
          title: "L'area riservata",
          paragraphs: ["Dopo l'accesso, l'area riservata del portale usa strumenti tecnici propri per mantenere la sessione e ricordare la lingua. Non servono a profilare."],
          list: [],
        },
        {
          title: "Chi tratta i dati",
          paragraphs: ["Il titolare è Tecno Advance MGA Broker Srl. I dati raccolti dagli strumenti di Google sono trattati anche da Google Ireland Limited. Per tutto il resto leggi la pagina {privacy}."],
          list: [],
        },
      ],
    },
  },
  legalNotice: "Messaggio pubblicitario con finalità promozionale. Prima della sottoscrizione leggere il set informativo.",
  cookieBanner: {
    title: "Cookie",
    text: "Usiamo cookie tecnici per far funzionare il sito. Con il tuo consenso usiamo anche i cookie di Google per le statistiche di visita e per misurare le campagne pubblicitarie.",
    accept: "Accetta",
    reject: "Rifiuta",
    close: "Chiudi e rifiuta",
    policyLink: "Leggi l'informativa sui cookie",
  },
  langNotice: {
    text: "Questa pagina è disponibile in italiano.",
    action: "Passa all'italiano",
    dismiss: "Chiudi",
  },
};
