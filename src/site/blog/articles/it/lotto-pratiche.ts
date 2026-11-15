import type { Article } from "../../types";

// Il funzionamento descritto e' quello del portale (pagina VIES, docs/vies-lot-cycle.md). Fonti normative
// verificate il 15/11/2026: art. 35 c. 7-quater DPR 633/1972, Provvedimenti dell'Agenzia delle Entrate
// prot. n. 178713/2025 (punto 2.4) e n. 186368/2025 (punto 3.3).
export const lottoPratiche: Article = {
  slug: "lotto-20-pratiche-vies-rappresentanti-fiscali",
  title: "Lotto di pratiche VIES: guida per rappresentanti fiscali",
  description: "Come un rappresentante fiscale carica fino a 20 pratiche VIES in un lotto: il file Excel, gli archivi dei documenti, i controlli del portale e cosa viene dopo.",
  h1: "Gestire un lotto di 20 pratiche VIES: guida per rappresentanti fiscali",
  label: "Gestire un lotto di 20 pratiche",
  keyword: "lotto di pratiche VIES",
  summary:
    "Un lotto raccoglie fino a 20 pratiche VIES caricate insieme: un file Excel con i dati delle società e un archivio di documenti per ciascuna. Il portale abbina ogni riga al suo archivio, legge i documenti e segnala cosa manca. Da lì il lotto procede come un'unica pratica: bozze, un solo estratto conto, firme in blocco, polizze emesse.",
  sections: [
    {
      id: "cosa-serve",
      heading: "Cosa serve per preparare il lotto",
      blocks: [
        {
          type: "list",
          items: [
            "Il modello Excel del lotto, con tre fogli: CONTRAENTE, RAPPRESENTANTE FISCALE e BENEFICIARIO.",
            "Nel foglio CONTRAENTE una riga per società, con la colonna ZIP che indica il nome dell'archivio dei suoi documenti.",
            "Un archivio ZIP per società, con i documenti dell'elenco.",
            "Non più di 20 righe per lotto.",
          ],
        },
        { type: "p", text: "L'elenco dei documenti di ogni società è nella guida [documenti per la fideiussione VIES](article:documenti)." },
      ],
    },
    {
      id: "come-compilare-excel",
      heading: "Come compilare l'Excel",
      blocks: [
        {
          type: "list",
          items: [
            "La colonna ZIP può contenere un numero, una sigla o il codice interno del cliente: deve coincidere con il nome dell'archivio. Maiuscole, spazi ed estensione non contano.",
            "La società si identifica con il codice fiscale o la partita IVA italiani assegnati dall'Agenzia delle Entrate: un codice di registrazione estero in quelle colonne viene respinto con un messaggio.",
            "Rappresentante fiscale e beneficiario si leggono dai loro fogli.",
            "Il beneficiario è la Direzione Provinciale dell'Agenzia delle Entrate competente per il domicilio fiscale del rappresentante fiscale.",
          ],
        },
      ],
    },
    {
      id: "al-caricamento",
      heading: "Cosa succede al caricamento",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Abbinamento", text: "Il portale abbina ogni riga dell'Excel al suo archivio e segnala gli archivi che non corrispondono a nessuna riga." },
            { title: "Lettura", text: "Apre gli archivi e legge i documenti: finché la lettura è in corso la riga risulta in verifica." },
            { title: "Confronto", text: "Confronta i dati dei documenti con quelli dell'Excel e tra un documento e l'altro." },
            { title: "Esito", text: "Ogni riga risulta pronta oppure indica cosa manca o non coincide, con che cosa fare." },
            { title: "Creazione del lotto", text: "Con le righe pronte crei il lotto: ogni società diventa una pratica con il proprio numero." },
          ],
        },
      ],
    },
    {
      id: "riga-bloccata",
      heading: "Se una riga resta bloccata",
      blocks: [
        {
          type: "p",
          text: "Una riga si blocca per un documento mancante, scaduto o non leggibile. La riga bloccata non entra nel lotto: le altre società proseguono e quella corretta si carica in un lotto successivo.",
        },
        {
          type: "p",
          text: "La lettura automatica può sbagliare su una scansione difficile. Se una riga è ferma solo per un controllo sui documenti e il documento è stato verificato in altro modo, puoi forzarne l'invio assumendotene la responsabilità: il motivo, la nota, il tuo nome e l'ora restano registrati nella pratica.",
        },
      ],
    },
    {
      id: "dopo-la-creazione",
      heading: "Dopo la creazione del lotto",
      blocks: [
        {
          type: "p",
          text: "Da qui il lotto segue gli otto passaggi descritti in [dalla richiesta alla polizza VIES emessa](article:richiesta-polizza): una sola verifica delle bozze, un solo estratto conto, firme in blocco. Per le firme vedi [polizze firmate digitalmente in formato .p7m](article:firma-p7m).",
        },
        {
          type: "list",
          items: [
            "Nel menu delle pratiche ogni lotto ha il proprio numero e mostra quante pratiche sono in ciascuna fase.",
            "I documenti di tutto il lotto si scaricano in un solo archivio, con una cartella per pratica.",
            "Lo scadenzario elenca le polizze e avvisa un mese prima della scadenza.",
          ],
        },
      ],
    },
    {
      id: "garanzia-del-rappresentante",
      heading: "La garanzia che riguarda te",
      blocks: [
        {
          type: "p",
          text: "Chi rappresenta due o più soggetti deve prestare anche una garanzia propria, diversa da quella VIES dei rappresentati. Importi e durata sono nella guida [garanzia del rappresentante fiscale e garanzia VIES](article:garanzia-rappresentante).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Posso caricare più di 20 pratiche?",
      a: "Sì, dividendole in più lotti: ogni lotto contiene fino a 20 pratiche e ha il proprio numero, il proprio stato e il proprio estratto conto. I lotti restano tutti consultabili nel portale, con il riepilogo delle pratiche per fase, e si possono cercare, filtrare ed esportare insieme alle loro pratiche.",
    },
    {
      q: "Come deve chiamarsi l'archivio dei documenti?",
      a: "Come indicato nella colonna ZIP dell'Excel, nella riga di quella società: un numero, una sigla o il codice interno del cliente. Il portale abbina riga e archivio senza badare a maiuscole, spazi ed estensione, quindi il valore dell'Excel e il nome del file possono differire solo in questi dettagli. Serve un archivio per società.",
    },
    {
      q: "Chi paga e chi firma per il lotto?",
      a: "Chi ha caricato il lotto. L'estratto conto è intestato alla sua società: lo paga con bonifico e lo firma per accettazione. Dopo il pagamento firma digitalmente, in blocco, la copia di polizza destinata alla compagnia e i documenti precontrattuali di ogni pratica. La bozza di polizza non si firma: si controlla prima del pagamento.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35 (verifica dei documenti da parte del rappresentante fiscale)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Agenzia delle Entrate, Provvedimento del 17 aprile 2025, prot. n. 186368/2025 (garanzia dei rappresentanti fiscali)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-17-aprile-2025" },
  ],
};
