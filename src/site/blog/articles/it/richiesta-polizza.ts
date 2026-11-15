import type { Article } from "../../types";

// I passaggi sono quelli del portale (docs/vies-lot-cycle.md). Fonte normativa verificata il 15/11/2026:
// Provvedimento dell'Agenzia delle Entrate prot. n. 178713/2025, punti 2.4 e 2.7-2.9.
export const richiestaPolizza: Article = {
  slug: "dalla-richiesta-alla-polizza-vies",
  title: "Polizza VIES: dalla richiesta all'emissione nel portale",
  description: "Gli otto passaggi di una richiesta di polizza VIES nel portale Tecno: caricamento, bozze, pagamento, firme, emissione. Chi fa cosa e cosa resta tracciato.",
  h1: "Dalla richiesta alla polizza VIES emessa: come funziona il portale",
  label: "Dalla richiesta alla polizza emessa",
  keyword: "polizza VIES",
  summary:
    "Una richiesta di polizza fideiussoria VIES passa per otto passaggi: bozze, verifica, pagamento, conferma, copie, firme, invio alla compagnia ed emissione. Chi ha caricato le pratiche controlla le bozze, paga e firma; Tecno presenta la richiesta alla compagnia e carica le polizze emesse. Ogni passaggio resta registrato con chi l'ha fatto e quando.",
  sections: [
    {
      id: "prima-del-lotto",
      heading: "Prima: caricamento e controllo dei documenti",
      blocks: [
        {
          type: "p",
          text: "Tutto parte dal caricamento: un file Excel con i dati delle società e un archivio di documenti per ciascuna. Il portale legge i documenti, li confronta con i dati e mostra per ogni società se la pratica è verificata, ancora in verifica o ferma per un documento mancante. L'elenco è nella guida [documenti per la fideiussione VIES](article:documenti).",
        },
      ],
    },
    {
      id: "otto-passaggi",
      heading: "Gli otto passaggi",
      blocks: [
        {
          type: "table",
          columns: ["Passaggio", "Chi agisce", "Cosa succede"],
          rows: [
            ["1. Bozze", "Tecno", "La compagnia valuta le richieste; Tecno carica nel portale la bozza di polizza di ogni pratica."],
            ["2. Verifica", "Chi ha caricato le pratiche", "Scarica le bozze, le controlla e conferma di averle verificate. La bozza non si firma."],
            ["3. Pagamento", "Chi ha caricato le pratiche", "Scarica l'estratto conto, paga il saldo, firma l'estratto e lo allega con la ricevuta del bonifico."],
            ["4. Conferma", "Tecno", "Controlla i documenti e conferma l'incasso: le pratiche passano in emissione."],
            ["5. Copie", "Tecno", "Carica per ogni pratica la copia di polizza destinata alla compagnia, da firmare."],
            ["6. Firme", "Chi ha caricato le pratiche", "Scarica i documenti da firmare, li firma digitalmente in blocco e li ricarica: il portale li riporta ciascuno alla sua pratica."],
            ["7. Invio", "Tecno", "Invia alla compagnia le pratiche con tutte le firme."],
            ["8. Emesse", "Tecno", "Carica le polizze emesse dalla compagnia: il lotto si chiude e si può scaricare tutto."],
          ],
        },
        {
          type: "p",
          text: "Il portale mostra in ogni momento a che punto è il lotto e chi deve fare il passaggio successivo. Se arrivano bozze nuove prima del pagamento, la verifica va ripetuta.",
        },
      ],
    },
    {
      id: "cosa-resta-tracciato",
      heading: "Cosa resta tracciato",
      blocks: [
        {
          type: "list",
          items: [
            "Il registro del lotto: chi ha fatto ogni passaggio e quando. Non si modifica e non si cancella.",
            "Lo storico di ogni pratica: bozza allegata, bozza verificata, pagamento registrato, copie inviate alla compagnia.",
            "Un avviso email per passaggio a chi ha caricato le pratiche, non uno per ogni pratica.",
          ],
        },
      ],
    },
    {
      id: "dopo-emissione",
      heading: "Dopo l'emissione",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Consegna", text: "La polizza si consegna alla Direzione Provinciale dell'Agenzia delle Entrate competente, personalmente o tramite il rappresentante fiscale." },
            { title: "Verifica dell'ufficio", text: "La Direzione Provinciale verifica che la garanzia sia conforme e comunica l'esito." },
            { title: "Inclusione nel VIES", text: "Dalla data della comunicazione si può chiedere l'inclusione nel VIES." },
            { title: "Scadenza", text: "Lo scadenzario del portale segnala la polizza un mese prima della scadenza." },
          ],
        },
        {
          type: "p",
          text: "Le regole su consegna, durata e verifica sono nella guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies).",
        },
      ],
    },
    {
      id: "una-sola-societa",
      heading: "E per una sola società",
      blocks: [
        {
          type: "p",
          text: "Il percorso è lo stesso anche per una pratica singola. Se devi prestare la garanzia per la tua società parti dalla pagina sulla [garanzia VIES per società extra UE](page:sellers) oppure scrivici dal [modulo di contatto](section:contatti).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "La bozza di polizza va firmata?",
      a: "No. La bozza serve a controllare che i dati della società, del rappresentante fiscale e del beneficiario siano corretti prima del pagamento. Chi ha caricato le pratiche la scarica, la verifica e conferma nel portale di averlo fatto. Si firmano invece, dopo il pagamento, la copia di polizza destinata alla compagnia e i documenti precontrattuali.",
    },
    {
      q: "Come si paga il premio?",
      a: "Il portale prepara un estratto conto unico per il lotto, con le polizze deliberate dalla compagnia e il totale dei premi. Chi ha caricato le pratiche paga il saldo con bonifico, firma l'estratto conto e lo allega insieme alla ricevuta. Quando Tecno conferma l'incasso, tutte le pratiche del lotto passano in emissione.",
    },
    {
      q: "Dove trovo la polizza emessa?",
      a: "Nel portale, dentro la pratica e nel lotto: quando la compagnia emette le polizze, Tecno le carica e il lotto si chiude. Chi ha caricato le pratiche riceve un avviso email e può scaricare ogni polizza, oppure l'intero lotto in un solo archivio con i documenti di tutte le pratiche.",
    },
  ],
  sources: [
    { label: "Agenzia delle Entrate, Provvedimento del 14 aprile 2025, prot. n. 178713/2025", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Agenzia delle Entrate, Inclusione nell'archivio VIES: normativa e prassi", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/normativa-e-prassi-partita-iva" },
  ],
};
