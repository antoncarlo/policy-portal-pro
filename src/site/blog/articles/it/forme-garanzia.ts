import type { Article } from "../../types";

// Fonti verificate il 15/11/2026: Provvedimento dell'Agenzia delle Entrate prot. n. 178713/2025 (punti 2.3-2.8) e
// art. 1 della legge 10 giugno 1982, n. 348, su Normattiva.
export const formeGaranzia: Article = {
  slug: "cauzione-fideiussione-bancaria-polizza-fideiussoria",
  title: "Polizza fideiussoria, cauzione o fideiussione bancaria VIES",
  description: "La garanzia VIES si può prestare in tre forme: cauzione in titoli di Stato, fideiussione bancaria o polizza fideiussoria. Chi le rilascia e cosa comportano.",
  h1: "Garanzia VIES: cauzione, fideiussione bancaria o polizza fideiussoria",
  label: "Cauzione, fideiussione bancaria o polizza",
  keyword: "polizza fideiussoria",
  summary:
    "La garanzia VIES può essere prestata in tre forme: cauzione in titoli di Stato o garantiti dallo Stato, fideiussione bancaria oppure polizza fideiussoria rilasciata da un'impresa di assicurazione. Importo minimo, durata e beneficiario sono gli stessi; cambiano chi rilascia la garanzia e ciò che chiede in cambio: il deposito dei titoli, il rapporto con una banca oppure il pagamento di un premio.",
  sections: [
    {
      id: "tre-forme",
      heading: "Le tre forme ammesse",
      blocks: [
        {
          type: "p",
          text: "Il punto 2.3 del Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025 ammette tre forme: la cauzione in titoli di Stato o garantiti dallo Stato, la fideiussione bancaria e la polizza fideiussoria, queste ultime rilasciate ai sensi dell'art. 1 della legge 10 giugno 1982, n. 348, la legge che regola le cauzioni a favore dello Stato e degli altri enti pubblici.",
        },
        {
          type: "table",
          columns: ["Forma", "Chi la rilascia", "Cosa resta impegnato"],
          rows: [
            ["Cauzione in titoli di Stato o garantiti dallo Stato", "Il soggetto presso cui è costituito il deposito vincolato dei titoli.", "I titoli, vincolati per tutta la durata della garanzia."],
            ["Fideiussione bancaria", "Una banca; la legge 348/1982 ammette anche i consorzi di garanzia collettiva dei fidi iscritti all'albo e vigilati dalla Banca d'Italia.", "Il rapporto con la banca che si costituisce fideiussore."],
            ["Polizza fideiussoria", "Un'impresa di assicurazione autorizzata al ramo cauzioni, che opera in Italia in regime di stabilimento o di libera prestazione di servizi.", "Il premio pagato alla compagnia; nessun titolo depositato."],
          ],
        },
      ],
    },
    {
      id: "cosa-non-cambia",
      heading: "Cosa non cambia tra una forma e l'altra",
      blocks: [
        {
          type: "list",
          items: [
            "Il valore massimale minimo: 50.000 euro (punto 2.3).",
            "La durata: non meno di 36 mesi dalla consegna alla Direzione Provinciale (punto 2.7).",
            "Il beneficiario: il Direttore pro tempore della Direzione Provinciale competente per il domicilio fiscale del rappresentante fiscale (punto 2.4).",
            "La verifica: la Direzione Provinciale controlla che la garanzia sia conforme e comunica l'esito (punto 2.8).",
          ],
        },
        { type: "p", text: "Chi è obbligato e quando è spiegato nella guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies)." },
      ],
    },
    {
      id: "cosa-contiene",
      heading: "Cosa deve contenere il documento",
      blocks: [
        { type: "p", text: "Il Provvedimento allega un fac-simile per ciascuna forma ed elenca, ai punti 2.5 e 2.6, le informazioni che non possono mancare." },
        {
          type: "table",
          columns: ["Informazione", "Cauzione in titoli", "Polizza o fideiussione bancaria"],
          rows: [
            ["Chi chiede l'inclusione nel VIES", "Sì", "Sì"],
            ["Chi presta la garanzia", "Il soggetto presso cui è costituito il deposito vincolato e l'eventuale terzo intestatario dei titoli", "Il soggetto che si costituisce fideiussore del contraente"],
            ["Direzione Provinciale beneficiaria", "Sì", "Sì"],
            ["Delimitazione, durata e importo", "Sì", "Sì"],
            ["Clausole proprie", "Composizione del deposito", "Inadempimento del contraente, rinuncia alla preventiva escussione e surrogazione"],
            ["Obbligazioni delle parti, forma delle comunicazioni, foro competente", "Sì", "Sì"],
          ],
        },
        {
          type: "p",
          text: "La rinuncia alla preventiva escussione significa che l'Agenzia delle Entrate può rivolgersi direttamente al fideiussore, senza dover agire prima contro la società garantita. Con la surrogazione il fideiussore che ha pagato subentra nei diritti verso la società.",
        },
      ],
    },
    {
      id: "come-scegliere",
      heading: "Come si sceglie",
      blocks: [
        {
          type: "p",
          text: "La scelta spetta alla società e al suo consulente. Di solito pesano tre elementi: la disponibilità di titoli da vincolare per almeno 36 mesi, la possibilità di ottenere una fideiussione da una banca per una società con sede fuori dall'Unione europea, e il premio di una polizza.",
        },
        {
          type: "p",
          text: "Tecno Advance MGA Broker Srl intermedia la polizza fideiussoria: la compagnia stabilisce il premio dopo l'esame dei documenti. I passaggi sono in [come si ottiene la polizza fideiussoria VIES](section:come-funziona), i fattori del premio in [quanto costa la fideiussione VIES](section:costo).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Qual è la differenza tra cauzione e fideiussione?",
      a: "Con la cauzione la società vincola propri titoli di Stato, o garantiti dallo Stato, in un deposito a favore dell'Agenzia delle Entrate. Con la fideiussione un terzo, banca o impresa di assicurazione, si impegna a pagare al posto della società se questa non adempie: la società non deposita titoli, ma ottiene l'impegno del fideiussore.",
    },
    {
      q: "La polizza fideiussoria vale quanto una fideiussione bancaria?",
      a: "Sì. Il Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025 mette sullo stesso piano la polizza fideiussoria e la fideiussione bancaria, entrambe rilasciate ai sensi dell'art. 1 della legge 348/1982, e chiede per le due lo stesso contenuto. L'impresa di assicurazione deve essere autorizzata all'esercizio del ramo cauzioni.",
    },
    {
      q: "Si può versare una cauzione in denaro per il VIES?",
      a: "Il Provvedimento dell'Agenzia delle Entrate del 14 aprile 2025 non prevede il deposito di denaro: al punto 2.3 elenca la cauzione in titoli di Stato o garantiti dallo Stato, la polizza fideiussoria e la fideiussione bancaria. Chi non vuole vincolare titoli può quindi scegliere tra la fideiussione di una banca e la polizza di un'impresa di assicurazione.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva, legge 10 giugno 1982, n. 348, art. 1", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1982-06-10;348" },
    { label: "Agenzia delle Entrate, Inclusione nell'archivio VIES: normativa e prassi", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
  ],
};
