import type { Article } from "../../types";

// Fonti verificate il 15/11/2026: Provvedimento dell'Agenzia delle Entrate prot. n. 178713/2025 (punti 1.1, 2.1-2.9,
// 3.1-3.4); art. 35, commi 7-bis e 7-quater, DPR 633/1972 e D.Lgs. 10/2026 (artt. 68 e 170) su Normattiva.
export const garanziaVies: Article = {
  slug: "garanzia-vies-cos-e-chi-deve-prestarla",
  title: "Garanzia VIES: cos'è, chi deve prestarla, quanto dura",
  description: "La garanzia VIES è dovuta dalle società extra UE con rappresentante fiscale in Italia: almeno 50.000 euro per 36 mesi. Chi è obbligato, quando, a chi si presta.",
  h1: "Garanzia VIES: cos'è e chi deve prestarla",
  label: "Garanzia VIES: cos'è e chi è obbligato",
  keyword: "garanzia VIES",
  summary:
    "La garanzia VIES è la garanzia che una società non residente nell'Unione europea o nello Spazio economico europeo, con rappresentante fiscale in Italia, presta all'Agenzia delle Entrate per essere inclusa o restare nel VIES. Vale almeno 50.000 euro, dura almeno 36 mesi dalla consegna e può essere una cauzione, una fideiussione bancaria o una polizza fideiussoria.",
  sections: [
    {
      id: "chi-e-obbligato",
      heading: "Chi deve prestare la garanzia VIES",
      blocks: [
        {
          type: "p",
          text: "Devono prestarla i soggetti passivi non residenti in uno Stato membro dell'Unione europea o in uno Stato dello Spazio economico europeo che assolvono gli obblighi IVA in Italia tramite un rappresentante fiscale e vogliono effettuare operazioni intracomunitarie. Lo stabilisce l'art. 35, comma 7-quater, del DPR 633/1972; il punto 1.1 del Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025 lo applica sia a chi chiede l'inclusione nel VIES sia a chi vuole restarci.",
        },
        {
          type: "list",
          items: [
            "La società ha sede fuori dall'Unione europea e dallo Spazio economico europeo.",
            "Opera in Italia con un rappresentante fiscale nominato ai sensi dell'art. 17, terzo comma, del DPR 633/1972.",
            "Vuole essere inclusa, o restare, nella banca dati VIES dei soggetti che effettuano operazioni intracomunitarie.",
          ],
        },
        {
          type: "p",
          text: "Le società stabilite nell'Unione europea o nello Spazio economico europeo non rientrano nell'obbligo. Se la tua società vende in Europa da un Paese extra UE, la pagina sulla [garanzia VIES per le società extra UE](page:sellers) spiega da dove partire.",
        },
      ],
    },
    {
      id: "importo-e-durata",
      heading: "Quanto vale, quanto dura, a favore di chi",
      blocks: [
        {
          type: "table",
          columns: ["Elemento", "Regola", "Dove è scritto"],
          rows: [
            ["Importo", "Valore massimale minimo di 50.000 euro.", "Provvedimento, punto 2.3"],
            ["Durata", "Non meno di 36 mesi dalla data di consegna alla Direzione Provinciale.", "Provvedimento, punto 2.7"],
            ["Forma", "Cauzione in titoli di Stato o garantiti dallo Stato, fideiussione bancaria oppure polizza fideiussoria.", "Provvedimento, punto 2.3"],
            ["Beneficiario", "Il Direttore pro tempore della Direzione Provinciale dell'Agenzia delle Entrate competente per il domicilio fiscale del rappresentante fiscale.", "Provvedimento, punto 2.4"],
          ],
        },
        {
          type: "p",
          text: "Con la polizza fideiussoria il contraente paga un premio e non deposita titoli. Il premio lo stabilisce la compagnia di assicurazione dopo l'esame dei documenti: la sezione [quanto costa la fideiussione VIES](section:costo) spiega da cosa dipende.",
        },
      ],
    },
    {
      id: "quando",
      heading: "Quando va prestata",
      blocks: [
        {
          type: "list",
          items: [
            "Chi ha già la partita IVA italiana presta la garanzia prima di chiedere l'inclusione nel VIES (punto 2.1).",
            "Chi non ha ancora la partita IVA la presta insieme alla dichiarazione di inizio attività in cui chiede l'inclusione (punto 2.2).",
            "Chi era già incluso nel VIES il 14 aprile 2025 ha avuto sessanta giorni da quella data per prestarla (punto 3.1).",
          ],
        },
      ],
    },
    {
      id: "consegna",
      heading: "Come si consegna e cosa succede dopo",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Consegna", text: "La garanzia si consegna alla Direzione Provinciale competente, personalmente o tramite il rappresentante fiscale." },
            { title: "Verifica", text: "La Direzione Provinciale verifica che la garanzia sia conforme ai requisiti previsti." },
            { title: "Esito", text: "L'ufficio comunica l'esito della verifica a chi ha prestato la garanzia." },
            { title: "Richiesta di inclusione", text: "Dalla data di quella comunicazione si può chiedere l'inclusione nel VIES, con le modalità del Provvedimento dell'Agenzia delle Entrate del 15 dicembre 2014." },
          ],
        },
      ],
    },
    {
      id: "senza-garanzia",
      heading: "Cosa succede senza garanzia",
      blocks: [
        { type: "p", text: "Per chi non è ancora nel VIES la regola è semplice: l'inclusione avviene solo dopo il rilascio della garanzia." },
        {
          type: "p",
          text: "Per chi era già incluso e non l'ha prestata, l'Agenzia delle Entrate comunica al rappresentante fiscale, con posta elettronica certificata o raccomandata, l'avvio della procedura di esclusione. Dal ricevimento decorrono altri sessanta giorni; se la garanzia non arriva, la partita IVA è esclusa d'ufficio dal VIES (punti 3.2-3.4).",
        },
        {
          type: "p",
          text: "Resta la regola che vale per tutti: se per quattro trimestri consecutivi non viene presentato alcun elenco riepilogativo delle operazioni intracomunitarie, l'Agenzia presume che il soggetto non voglia più effettuarle e lo esclude dal VIES, dopo averlo avvisato (art. 35, comma 7-bis).",
        },
      ],
    },
    {
      id: "rappresentante-fiscale",
      heading: "Cosa deve fare il rappresentante fiscale",
      blocks: [
        {
          type: "p",
          text: "Lo stesso comma 7-quater dà un compito al rappresentante fiscale: quando trasmette la dichiarazione di inizio o di variazione attività con la richiesta di inclusione nel VIES, deve verificare che i documenti e le informazioni forniti dalla società siano completi e corrispondano alle notizie in suo possesso.",
        },
        {
          type: "p",
          text: "Per questo chi rappresenta molte società ha bisogno di un controllo ordinato dei documenti. La pagina sulle [fideiussioni VIES per rappresentanti fiscali](page:representatives) mostra come il portale lo fa per lotti fino a 20 pratiche.",
        },
      ],
    },
    {
      id: "dal-2027",
      heading: "Dal 2027 cambia l'articolo, non la regola",
      blocks: [
        {
          type: "p",
          text: "Fino al 31 dicembre 2026 il riferimento è l'art. 35, comma 7-quater, del DPR 633/1972. Dal 1° gennaio 2027 si applica il Testo unico IVA (decreto legislativo 19 gennaio 2026, n. 10): la garanzia è nell'art. 68, comma 10, con lo stesso contenuto, e i riferimenti alle norme abrogate si intendono fatti alle nuove (art. 170, comma 3).",
        },
      ],
    },
    {
      id: "come-ottenerla",
      heading: "Come si ottiene la polizza fideiussoria",
      blocks: [
        {
          type: "p",
          text: "Tecno Advance MGA Broker Srl è un intermediario assicurativo: raccoglie e controlla i documenti, presenta la richiesta alla compagnia e consegna la polizza emessa e firmata digitalmente. I passaggi sono descritti in [come si ottiene la polizza fideiussoria VIES](section:come-funziona), l'elenco in [quali documenti servono](section:documenti).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "La garanzia VIES riguarda anche le società con sede nell'Unione europea?",
      a: "No. L'obbligo riguarda i soggetti non residenti in uno Stato dell'Unione europea o dello Spazio economico europeo che operano in Italia tramite un rappresentante fiscale. Una società stabilita in un altro Stato membro, anche se ha un rappresentante fiscale in Italia, non deve prestare questa garanzia per essere inclusa nel VIES.",
    },
    {
      q: "La garanzia VIES e la garanzia del rappresentante fiscale sono la stessa cosa?",
      a: "No, sono due garanzie diverse. La garanzia VIES la presta la società rappresentata: almeno 50.000 euro per 36 mesi (art. 35, comma 7-quater). Quella del rappresentante fiscale la presta chi assume il ruolo per due o più soggetti: da 30.000 a 2.000.000 di euro secondo il numero dei rappresentati, per almeno 48 mesi (art. 17, terzo comma).",
    },
    {
      q: "Chi consegna la garanzia all'Agenzia delle Entrate?",
      a: "La consegna la società non residente, personalmente o tramite il suo rappresentante fiscale, alla Direzione Provinciale dell'Agenzia delle Entrate competente per il domicilio fiscale del rappresentante. La garanzia è intestata al Direttore pro tempore della stessa Direzione, che ne verifica la conformità e comunica l'esito: da quella comunicazione si può chiedere l'inclusione nel VIES.",
    },
    {
      q: "Quali norme prevedono la garanzia VIES?",
      a: "Il comma 7-quater è stato introdotto nell'art. 35 del DPR 633/1972 dal decreto legislativo 13/2024. Criteri e modalità sono nel decreto del Ministro dell'Economia e delle Finanze del 4 dicembre 2024 (Gazzetta Ufficiale n. 292 del 13 dicembre 2024); le regole operative nel Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025, prot. n. 178713/2025.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Agenzia delle Entrate, Inclusione nell'archivio VIES: normativa e prassi", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, D.Lgs. 19 gennaio 2026, n. 10, Testo unico IVA (artt. 68 e 170)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
    { label: "FiscoOggi, rivista dell'Agenzia delle Entrate: soggetti extra UE con rappresentante, nuove regole per operare nel VIES", href: "https://www.fiscooggi.it/portale/-/soggetti-extra-ue-con-rappresentante-nuove-regole-per-operare-nel-vies" },
  ],
};
