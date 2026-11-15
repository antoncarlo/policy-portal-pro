import type { Article } from "../../types";

// L'elenco e' quello che il portale chiede (src/site/content/it.ts, «documents») e i controlli sono quelli che il
// portale esegue davvero. Fonti normative verificate il 15/11/2026: Provvedimento dell'Agenzia delle Entrate
// prot. n. 178713/2025 (punti 2.1-2.2), art. 35 c. 7-quater DPR 633/1972, art. 20 D.Lgs. 231/2007.
export const documenti: Article = {
  slug: "documenti-fideiussione-vies",
  title: "Documenti per la fideiussione VIES di una società estera",
  description: "I sei documenti che servono per la polizza fideiussoria VIES di una società extra UE, le traduzioni richieste e gli errori che bloccano più spesso una pratica.",
  h1: "Documenti per la fideiussione VIES di una società estera",
  label: "Documenti per la fideiussione VIES",
  keyword: "documenti per la fideiussione VIES",
  summary:
    "Per la polizza fideiussoria VIES di una società estera servono sei documenti: documento societario, documento d'identità del legale rappresentante, estratto dal registro del Paese d'origine, dichiarazione del titolare effettivo, mandato di rappresentanza fiscale e dichiarazione a supporto della fideiussione. Documento societario e documento d'identità si caricano con la loro traduzione.",
  sections: [
    {
      id: "elenco",
      heading: "I sei documenti",
      blocks: [
        {
          type: "table",
          columns: ["Documento", "Cos'è", "A cosa serve"],
          rows: [
            ["Documento societario", "Licenza commerciale o certificato di costituzione della società, con traduzione.", "Identifica la società: denominazione, sede, codici di registrazione."],
            ["Documento d'identità del legale rappresentante", "Passaporto o carta d'identità in corso di validità, con traduzione.", "Identifica chi firma per la società."],
            ["Estratto dal registro del Paese d'origine", "Per le società cinesi il report del sistema nazionale di informazione sul credito d'impresa; per Hong Kong il Business Registration Certificate.", "Conferma i dati di registrazione della società."],
            ["Dichiarazione del titolare effettivo", "Indica la persona fisica che possiede o controlla la società.", "Serve per le verifiche antiriciclaggio."],
            ["Mandato di rappresentanza fiscale", "L'atto con cui la società ha nominato il rappresentante fiscale in Italia.", "Collega la società al rappresentante fiscale e alla Direzione Provinciale competente."],
            ["Dichiarazione a supporto della fideiussione", "Dichiarazione sostitutiva firmata dal legale rappresentante.", "Accompagna la richiesta alla compagnia di assicurazione."],
          ],
        },
        { type: "note", text: "L'elenco può cambiare secondo il Paese della società e la valutazione della compagnia: dopo il primo contatto inviamo quello definitivo per il tuo caso." },
      ],
    },
    {
      id: "per-paese",
      heading: "Cosa cambia secondo il Paese",
      blocks: [
        {
          type: "list",
          items: [
            "Cina: licenza commerciale con il codice unificato di credito sociale, di 18 caratteri, e report del sistema nazionale di informazione sul credito d'impresa.",
            "Hong Kong: il Certificate of Incorporation o il Business Registration Certificate valgono al posto della licenza commerciale e del report.",
            "Altri Paesi: il documento equivalente rilasciato dal registro delle imprese locale, che concordiamo al primo contatto.",
          ],
        },
      ],
    },
    {
      id: "come-vengono-controllati",
      heading: "Come vengono controllati",
      blocks: [
        {
          type: "p",
          text: "Ogni documento caricato nel portale viene letto in automatico: il portale riconosce di che tipo è, ne estrae i dati e li confronta tra un documento e l'altro e con quelli indicati nella richiesta. Un operatore conferma l'esito prima che la pratica arrivi alla compagnia.",
        },
        {
          type: "list",
          items: [
            "La denominazione della società è la stessa in tutti i documenti.",
            "Il codice unificato di credito sociale ha il carattere di controllo corretto: un codice letto male da una scansione viene riconosciuto subito.",
            "Il documento d'identità del legale rappresentante non è scaduto.",
            "Ci sono tutti i documenti dell'elenco: quelli che mancano sono indicati per nome.",
          ],
        },
        {
          type: "p",
          text: "Il controllo serve anche al rappresentante fiscale, a cui la legge chiede di verificare che i documenti della società siano completi: lo spiega la guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies).",
        },
      ],
    },
    {
      id: "errori-frequenti",
      heading: "Gli errori che vediamo più spesso",
      blocks: [
        {
          type: "list",
          items: [
            "Documento d'identità scaduto.",
            "Scansioni ruotate, tagliate o con caratteri troppo piccoli, da cui i codici non si leggono.",
            "Nome della società scritto in modo diverso tra licenza, mandato e dichiarazioni.",
            "Traduzione mancante del documento societario o del documento d'identità.",
            "File molto pesanti: il portale comprime le immagini grandi prima della lettura, ma una scansione leggibile a risoluzione normale si carica più in fretta.",
          ],
        },
        {
          type: "p",
          text: "Se la partita IVA italiana non compare ancora nei documenti, perché è stata assegnata dopo la firma del mandato, il portale verifica l'identità della società dagli altri dati.",
        },
      ],
    },
    {
      id: "come-si-caricano",
      heading: "Come si caricano",
      blocks: [
        {
          type: "p",
          text: "I documenti di ogni società si caricano nel portale in un unico archivio. Chi gestisce più società usa i lotti, descritti nella pagina sulle [fideiussioni VIES per rappresentanti fiscali](page:representatives); chi deve prestare la garanzia per la propria società parte dalla pagina sulla [garanzia VIES per società extra UE](page:sellers). Quello che succede dopo il caricamento è in [dalla richiesta alla polizza VIES emessa](article:richiesta-polizza).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "I documenti devono essere tradotti?",
      a: "Sì. Il documento societario e il documento d'identità del legale rappresentante si caricano con la loro traduzione, così la compagnia e il portale possono leggere denominazione, sede e dati di chi firma. Dopo il primo contatto indichiamo quali traduzioni servono per il Paese della società e in quale lingua.",
    },
    {
      q: "Serve la partita IVA italiana per chiedere la polizza?",
      a: "Non necessariamente al momento del caricamento. Chi non ha ancora la partita IVA presta la garanzia insieme alla dichiarazione di inizio attività, quindi i documenti firmati prima possono non riportarla. In quel caso l'identità della società viene verificata dagli altri dati: denominazione, codici di registrazione, legale rappresentante e mandato di rappresentanza fiscale.",
    },
    {
      q: "Chi è il titolare effettivo?",
      a: "È la persona fisica, o le persone fisiche, a cui in ultima istanza è attribuibile la proprietà diretta o indiretta della società oppure il suo controllo: così lo definisce l'art. 20 del decreto legislativo 231/2007 sull'antiriciclaggio. La dichiarazione del titolare effettivo indica chi sono queste persone ed è richiesta per le verifiche antiriciclaggio sulla pratica.",
    },
    {
      q: "Cosa succede se manca un documento?",
      a: "Il portale lo segnala subito: accanto a ogni società compare l'elenco dei documenti presenti e di quelli mancanti, e la pratica non parte verso la compagnia finché l'elenco non è completo. Si carica di nuovo l'archivio della società con il documento che mancava e il controllo riparte; un operatore conferma prima dell'invio.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, D.Lgs. 21 novembre 2007, n. 231, art. 20 (titolare effettivo)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2007-11-21;231~art20" },
  ],
};
