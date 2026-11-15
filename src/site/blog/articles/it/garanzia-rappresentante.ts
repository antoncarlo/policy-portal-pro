import type { Article } from "../../types";

// Fonti verificate il 15/11/2026: art. 17, terzo comma, DPR 633/1972 (Normattiva); Provvedimento dell'Agenzia delle
// Entrate prot. n. 186368/2025 del 17 aprile 2025 (punti 1.1, 2.1-2.5, 3.1-3.12, 4.1-4.4); Provvedimento
// prot. n. 178713/2025 del 14 aprile 2025.
export const garanziaRappresentante: Article = {
  slug: "garanzia-rappresentante-fiscale-e-garanzia-vies",
  title: "Garanzia del rappresentante fiscale o garanzia VIES?",
  description: "Due garanzie diverse: quella del rappresentante fiscale, da 30.000 a 2.000.000 di euro per 48 mesi, e quella VIES del rappresentato, 50.000 euro per 36 mesi.",
  h1: "Garanzia del rappresentante fiscale e garanzia VIES del rappresentato: le differenze",
  label: "Garanzia del rappresentante e garanzia VIES",
  keyword: "garanzia del rappresentante fiscale",
  summary:
    "Sono due garanzie distinte. La garanzia del rappresentante fiscale la presta chi assume quel ruolo per due o più soggetti: da 30.000 a 2.000.000 di euro secondo il numero dei rappresentati, per almeno 48 mesi. La garanzia VIES la presta ogni società extra UE rappresentata che vuole operare nel VIES: almeno 50.000 euro per almeno 36 mesi.",
  sections: [
    {
      id: "confronto",
      heading: "Le due garanzie a confronto",
      blocks: [
        {
          type: "table",
          columns: ["Aspetto", "Garanzia del rappresentante fiscale", "Garanzia VIES del rappresentato"],
          rows: [
            ["Norma", "Art. 17, terzo comma, DPR 633/1972", "Art. 35, comma 7-quater, DPR 633/1972"],
            ["Decreto ministeriale", "9 dicembre 2024 (Gazzetta Ufficiale n. 297 del 19 dicembre 2024)", "4 dicembre 2024 (Gazzetta Ufficiale n. 292 del 13 dicembre 2024)"],
            ["Provvedimento dell'Agenzia delle Entrate", "17 aprile 2025, prot. n. 186368/2025", "14 aprile 2025, prot. n. 178713/2025"],
            ["Chi la presta", "Chi assume il ruolo di rappresentante fiscale per due o più soggetti", "Il soggetto rappresentato, non residente nell'UE o nello SEE"],
            ["A cosa serve", "Assumere e mantenere il ruolo di rappresentante fiscale", "Chiedere o mantenere l'inclusione nel VIES"],
            ["Importo minimo", "Da 30.000 a 2.000.000 di euro, secondo il numero dei rappresentati", "50.000 euro"],
            ["Durata minima", "48 mesi dalla consegna", "36 mesi dalla consegna"],
            ["Consegna", "Personalmente, alla Direzione Provinciale del domicilio fiscale del rappresentante", "Personalmente o tramite il rappresentante fiscale, alla stessa Direzione Provinciale"],
            ["Se manca", "Cessazione d'ufficio delle partite IVA dei rappresentati", "Esclusione d'ufficio dal VIES"],
          ],
        },
      ],
    },
    {
      id: "garanzia-del-rappresentante",
      heading: "La garanzia del rappresentante fiscale",
      blocks: [
        {
          type: "p",
          text: "Il decreto legislativo 13/2024 ha aggiunto all'art. 17, terzo comma, del DPR 633/1972 due condizioni per chi fa il rappresentante fiscale: il possesso di requisiti soggettivi, da attestare con una dichiarazione, e una garanzia graduata sul numero dei soggetti rappresentati.",
        },
        {
          type: "table",
          columns: ["Soggetti rappresentati", "Valore massimale minimo"],
          rows: [
            ["Uno", "Nessuna garanzia: basta la dichiarazione sui requisiti"],
            ["Da 2 a 9", "30.000 euro"],
            ["Da 10 a 50", "100.000 euro"],
            ["Da 51 a 100", "300.000 euro"],
            ["Da 101 a 1.000", "1.000.000 euro"],
            ["Oltre 1.000", "2.000.000 euro"],
          ],
        },
        {
          type: "list",
          items: [
            "La dichiarazione attesta l'assenza di condanne e di procedimenti penali pendenti per reati finanziari, di violazioni gravi e ripetute in materia contributiva e tributaria e delle condizioni dell'art. 15, comma 1, della legge 55/1990.",
            "Se il rappresentante è una società, la dichiarazione la rendono tutti i legali rappresentanti.",
            "Se il numero dei rappresentati sale a una fascia superiore serve una nuova garanzia; dopo l'esito positivo della verifica si può chiedere la liberazione della precedente.",
            "Chi operava già come rappresentante fiscale il 17 aprile 2025 ha avuto sessanta giorni da quella data per adeguarsi.",
          ],
        },
      ],
    },
    {
      id: "garanzia-vies",
      heading: "La garanzia VIES del rappresentato",
      blocks: [
        {
          type: "p",
          text: "Riguarda la società, non il suo rappresentante: i soggetti non residenti nell'Unione europea o nello Spazio economico europeo che operano tramite rappresentante fiscale vengono inclusi nel VIES solo dopo aver prestato una garanzia di almeno 50.000 euro per almeno 36 mesi. Regole e termini sono nella guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies); le forme ammesse in [cauzione, fideiussione bancaria o polizza fideiussoria](article:forme-garanzia).",
        },
      ],
    },
    {
      id: "quando-servono-entrambe",
      heading: "Quando servono tutte e due",
      blocks: [
        {
          type: "p",
          text: "Le due garanzie non si sostituiscono. Per esempio: uno studio che rappresenta dodici società extra UE presta la propria garanzia nella fascia da dieci a cinquanta soggetti, e ciascuna delle dodici società che vuole operare nel VIES presta la propria garanzia VIES.",
        },
        {
          type: "p",
          text: "Questo sito è dedicato alla garanzia VIES del rappresentato. Chi gestisce le garanzie di più società le carica nel portale in lotti: vedi [gestire un lotto di 20 pratiche VIES](article:lotto-pratiche) e la pagina sulle [fideiussioni VIES per rappresentanti fiscali](page:representatives).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Chi rappresenta una sola società deve prestare la garanzia del rappresentante fiscale?",
      a: "No. Il punto 3.4 del Provvedimento dell'Agenzia delle Entrate del 17 aprile 2025 esonera dalla garanzia chi intende rappresentare un solo soggetto; resta l'obbligo di presentare la dichiarazione sui requisiti soggettivi. La società rappresentata, se ha sede fuori dall'UE e dallo SEE e vuole operare nel VIES, deve comunque prestare la propria garanzia VIES.",
    },
    {
      q: "La garanzia del rappresentante fiscale copre anche i rappresentati?",
      a: "No. È una garanzia che riguarda il ruolo del rappresentante ed è intestata alla Direzione Provinciale competente per il suo domicilio fiscale. Non sostituisce la garanzia VIES, che ogni società extra UE rappresentata presta per sé: almeno 50.000 euro per almeno 36 mesi, per chiedere o mantenere l'inclusione nel VIES.",
    },
    {
      q: "Cosa succede al rappresentante fiscale che non presta la garanzia?",
      a: "L'Agenzia delle Entrate gli comunica, con posta elettronica certificata o raccomandata, l'avvio della procedura di cessazione d'ufficio delle partite IVA dei soggetti rappresentati. Dal ricevimento ha altri sessanta giorni per presentare la dichiarazione e prestare la garanzia; se non lo fa, le partite IVA dei rappresentati vengono cessate d'ufficio.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 17 aprile 2025, prot. n. 186368/2025 (garanzia dei rappresentanti fiscali)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-17-aprile-2025" },
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025 (garanzia VIES)", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 17", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art17" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
  ],
};
