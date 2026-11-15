import type { Article } from "../../types";

// Fonti verificate il 15/11/2026: art. 17 c. 3, art. 35 c. 2 lett. e-bis), c. 7-bis e c. 7-quater DPR 633/1972;
// art. 70 c. 5 del Testo unico IVA (D.Lgs. 10/2026, gia' art. 35-ter c. 5); Provvedimento dell'Agenzia delle
// Entrate prot. n. 178713/2025 (punti 2.1-2.9); scheda dell'Agenzia «Inclusione archivio Vies».
export const venditoriMarketplace: Article = {
  slug: "venditori-extra-ue-partita-iva-vies",
  title: "Partita IVA italiana e VIES per venditori extra UE: i passi",
  description: "Dal rappresentante fiscale all'inclusione nel VIES: i passi per una società extra UE che vende in Italia e in Europa, con la garanzia da 50.000 euro spiegata.",
  h1: "Venditori extra UE: partita IVA italiana e VIES, passo per passo",
  label: "Venditori extra UE: partita IVA e VIES",
  keyword: "partita IVA italiana",
  summary:
    "Una società extra UE che vuole effettuare operazioni intracomunitarie dall'Italia nomina un rappresentante fiscale, ottiene la partita IVA, presta una garanzia di almeno 50.000 euro per almeno 36 mesi e, dopo la verifica dell'Agenzia delle Entrate, chiede l'inclusione nel VIES. Senza la garanzia l'inclusione non avviene.",
  sections: [
    {
      id: "quando-serve",
      heading: "Quando servono partita IVA italiana e VIES",
      blocks: [
        {
          type: "p",
          text: "Se e quando una società estera debba aprire una partita IVA in Italia dipende da come vende e da dove parte la merce: lo valuta il suo consulente fiscale. Questa guida riguarda il passo successivo: la società si identifica in Italia e vuole effettuare operazioni intracomunitarie, cioè scambi con soggetti IVA di altri Stati dell'Unione europea. Per farlo la partita IVA deve essere inclusa nell'archivio VIES.",
        },
        {
          type: "p",
          text: "La regola sulla garanzia vale per ogni società con sede fuori dall'Unione europea e dallo Spazio economico europeo che opera tramite rappresentante fiscale: per esempio in Cina, Giappone, India, Pakistan, Stati Uniti, Brasile o Vietnam.",
        },
      ],
    },
    {
      id: "rappresentante-o-identificazione",
      heading: "Rappresentante fiscale o identificazione diretta",
      blocks: [
        {
          type: "table",
          columns: ["Strada", "Chi può usarla", "Garanzia VIES"],
          rows: [
            ["Identificazione diretta", "Chi esercita l'attività in un altro Stato dell'Unione europea o in un Paese terzo con cui esistono strumenti di reciproca assistenza in materia di imposizione indiretta.", "Non riguarda questa strada: la regola parla di chi opera tramite rappresentante fiscale."],
            ["Rappresentante fiscale", "Gli altri soggetti non residenti senza stabile organizzazione in Italia.", "Sì, per chi ha sede fuori dall'UE e dallo SEE e vuole operare nel VIES."],
          ],
        },
        {
          type: "p",
          text: "Il rappresentante fiscale è residente in Italia, viene nominato nelle forme previste dall'art. 1, comma 4, del DPR 441/1997 e risponde in solido con la società degli obblighi IVA. La nomina va comunicata all'altro contraente prima dell'operazione.",
        },
      ],
    },
    {
      id: "i-passi",
      heading: "I passi, in ordine",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Nomina del rappresentante fiscale", text: "La società sceglie un rappresentante residente in Italia e gli conferisce il mandato." },
            { title: "Dichiarazione di inizio attività", text: "Con la dichiarazione si chiede la partita IVA; per i soggetti diversi dalle persone fisiche il modello è l'AA7." },
            { title: "Opzione per il VIES", text: "Nella dichiarazione, oppure in un momento successivo per via telematica, si esprime la volontà di effettuare operazioni intracomunitarie." },
            { title: "Garanzia", text: "Chi non ha ancora la partita IVA presta la garanzia insieme alla dichiarazione di inizio attività; chi l'ha già, prima di chiedere l'inclusione." },
            { title: "Verifica dell'ufficio", text: "La Direzione Provinciale dell'Agenzia delle Entrate verifica che la garanzia sia conforme e comunica l'esito." },
            { title: "Inclusione nel VIES", text: "Dalla data della comunicazione si può chiedere l'inclusione." },
          ],
        },
      ],
    },
    {
      id: "la-garanzia",
      heading: "La garanzia, in breve",
      blocks: [
        {
          type: "list",
          items: [
            "Almeno 50.000 euro, per almeno 36 mesi dalla consegna.",
            "A favore del Direttore pro tempore della Direzione Provinciale competente per il domicilio fiscale del rappresentante fiscale.",
            "In una di tre forme, confrontate in [cauzione, fideiussione bancaria o polizza fideiussoria](article:forme-garanzia).",
          ],
        },
        {
          type: "p",
          text: "Per la polizza fideiussoria servono i documenti elencati in [documenti per la fideiussione VIES](article:documenti). Il quadro completo delle regole è in [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies).",
        },
      ],
    },
    {
      id: "restare-nel-vies",
      heading: "Come si resta nel VIES",
      blocks: [
        {
          type: "list",
          items: [
            "Presentare gli elenchi riepilogativi delle operazioni intracomunitarie: se non ne viene presentato nessuno per quattro trimestri consecutivi, l'Agenzia presume che il soggetto non voglia più effettuarle e lo esclude, dopo averlo avvisato.",
            "Tenere sotto controllo la scadenza della garanzia, che dura almeno 36 mesi dalla consegna.",
          ],
        },
        {
          type: "p",
          text: "Se la tua società è in questa situazione, la pagina sulla [garanzia VIES per società extra UE](page:sellers) spiega come richiedere la polizza.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Una società extra UE può avere la partita IVA italiana senza rappresentante fiscale?",
      a: "Solo se può identificarsi direttamente: l'identificazione diretta è ammessa per chi esercita l'attività in un altro Stato dell'Unione europea o in un Paese terzo con cui esistono strumenti giuridici di reciproca assistenza in materia di imposizione indiretta. Negli altri casi il soggetto non residente senza stabile organizzazione opera tramite un rappresentante fiscale residente in Italia.",
    },
    {
      q: "La garanzia VIES va prestata prima o dopo la partita IVA?",
      a: "Dipende. Chi non ha ancora la partita IVA presta la garanzia insieme alla dichiarazione di inizio attività in cui chiede l'inclusione nel VIES. Chi ha già la partita IVA la presta prima di chiedere l'inclusione. In entrambi i casi l'inclusione si può chiedere solo dopo che la Direzione Provinciale ha verificato la garanzia e comunicato l'esito.",
    },
    {
      q: "Cosa succede se la società non usa il VIES per un anno?",
      a: "Se per quattro trimestri consecutivi non viene presentato alcun elenco riepilogativo delle operazioni intracomunitarie, l'Agenzia delle Entrate presume che il soggetto non intenda più effettuarle ed esclude la partita IVA dal VIES, dopo avere inviato una comunicazione. Lo prevede l'art. 35, comma 7-bis, del DPR 633/1972; dal 2027 la regola è nell'art. 68, comma 9, del Testo unico IVA.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Inclusione nell'archivio VIES: che cos'è", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/scheda-info-partite-iva_intra" },
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 17 (rappresentante fiscale)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art17" },
    { label: "Normattiva, DPR 26 ottobre 1972, n. 633, art. 35", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva, D.Lgs. 19 gennaio 2026, n. 10, Testo unico IVA (artt. 68 e 70)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
  ],
};
