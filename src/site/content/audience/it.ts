import type { AudienceContent, AudienceId } from "../types";

// Stessi fatti verificati degli articoli (Provvedimenti dell'Agenzia delle Entrate prot. n. 178713/2025 e n. 186368/2025,
// art. 17 c. 3 e art. 35 c. 7-quater DPR 633/1972) e funzionamento reale del portale (docs/vies-lot-cycle.md).
export const audiencePages: Record<AudienceId, AudienceContent> = {
  representatives: {
    lead: "Se rappresenti società extra UE, ogni rappresentata che vuole operare nel VIES deve prestare una garanzia di almeno 50.000 euro per 36 mesi. Nel portale Tecno carichi le richieste in lotti fino a 20 pratiche, i documenti vengono controllati, firmi in blocco e ricevi le polizze emesse, con un solo estratto conto per lotto.",
    sections: [
      {
        id: "cosa-chiede-la-norma",
        heading: "Cosa chiede la norma a chi rappresenta società extra UE",
        blocks: [
          {
            type: "p",
            text: "L'inclusione nel VIES di un soggetto non residente nell'Unione europea o nello Spazio economico europeo, che opera tramite rappresentante fiscale, avviene solo dopo il rilascio di una garanzia: lo prevede l'art. 35, comma 7-quater, del DPR 633/1972. La guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies) riassume importo, durata e termini.",
          },
          {
            type: "list",
            items: [
              "La garanzia è intestata al Direttore pro tempore della Direzione Provinciale competente per il tuo domicilio fiscale e si consegna alla stessa Direzione, anche tramite te.",
              "Quando trasmetti la dichiarazione con la richiesta di inclusione nel VIES devi verificare che i documenti e le informazioni della società siano completi e coerenti con ciò che sai.",
              "Se rappresenti due o più soggetti devi prestare anche una garanzia tua, distinta da quella VIES dei rappresentati.",
            ],
          },
        ],
      },
      {
        id: "nel-portale",
        heading: "Come lavori nel portale",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Carichi il lotto", text: "Un file Excel con i dati delle società e un archivio di documenti per ciascuna: fino a 20 pratiche per lotto." },
              { title: "Il portale controlla i documenti", text: "Legge ogni documento, riconosce di che tipo è, confronta i dati tra loro e ti mostra subito cosa manca o non coincide." },
              { title: "Verifichi le bozze e paghi", text: "Quando la compagnia ha valutato le richieste scarichi le bozze, le controlli e ricevi un estratto conto unico per il lotto." },
              { title: "Firmi in blocco", text: "Scarichi i documenti da firmare, li firmi digitalmente e li ricarichi insieme: ogni file torna alla sua pratica." },
              { title: "Ricevi le polizze emesse", text: "Le polizze definitive, firmate digitalmente dalla compagnia, sono pronte per la consegna alla Direzione Provinciale." },
            ],
          },
        ],
      },
      {
        id: "cosa-trovi",
        heading: "Cosa trovi nel portale",
        blocks: [
          {
            type: "list",
            items: [
              "Lo stato di ogni pratica e di ogni lotto, con chi deve fare il passaggio successivo.",
              "Lo scadenzario delle polizze, con un avviso un mese prima della scadenza.",
              "Tutti i documenti di un lotto scaricabili in un solo archivio.",
              "Il registro di ogni passaggio: chi l'ha fatto e quando.",
              "Il collegamento con il tuo gestionale: studi e piattaforme possono inviare pratiche e ricevere aggiornamenti dai propri sistemi.",
            ],
          },
        ],
      },
      {
        id: "per-iniziare",
        heading: "Cosa serve per iniziare",
        blocks: [
          {
            type: "p",
            text: "Scrivici dal [modulo di contatto](section:contatti) indicando quante società rappresenti: ti apriamo l'accesso al portale e ti inviamo il modello Excel del lotto e l'elenco dei [documenti necessari per ogni società](section:documenti).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quante pratiche posso caricare insieme?",
        a: "Fino a 20 pratiche per lotto. Ogni lotto nasce da un file Excel con i dati delle società e da un archivio di documenti per ciascuna. Puoi caricare più lotti: ognuno ha il proprio numero, il proprio stato e il proprio estratto conto, e resta consultabile nel portale insieme alle sue pratiche e ai suoi documenti.",
      },
      {
        q: "Chi firma i documenti delle pratiche?",
        a: "Nel portale firma chi ha caricato il lotto, con la propria firma digitale: dopo la valutazione della compagnia scarica i documenti da firmare di tutte le pratiche, li firma in blocco e li ricarica insieme. La bozza di polizza non si firma: si controlla e si conferma prima del pagamento.",
      },
      {
        q: "La garanzia VIES del rappresentato sostituisce la garanzia del rappresentante fiscale?",
        a: "No. Sono due obblighi distinti. La garanzia VIES la presta ogni società extra UE rappresentata che vuole operare nel VIES. La garanzia del rappresentante fiscale la presta chi rappresenta due o più soggetti, con un importo che cresce con il numero dei rappresentati, da 30.000 a 2.000.000 di euro, per almeno 48 mesi.",
      },
    ],
    cta: { title: "Quante pratiche VIES gestisci?", text: "Indicaci quante società rappresenti: ti apriamo l'accesso al portale e ti inviamo il modello del lotto.", button: "Richiedi contatto" },
    guidesTitle: "Guide per i rappresentanti fiscali",
  },
  sellers: {
    lead: "Se la tua società ha sede fuori dall'Unione europea e dallo Spazio economico europeo e opera in Italia con un rappresentante fiscale, per entrare o restare nel VIES deve prestare all'Agenzia delle Entrate una garanzia di almeno 50.000 euro per almeno 36 mesi. Con la polizza fideiussoria paghi un premio e non immobilizzi titoli.",
    sections: [
      {
        id: "quando-ti-riguarda",
        heading: "Quando la garanzia ti riguarda",
        blocks: [
          {
            type: "list",
            items: [
              "La società ha sede fuori dall'Unione europea e dallo Spazio economico europeo.",
              "Assolve gli obblighi IVA in Italia tramite un rappresentante fiscale.",
              "Vuole effettuare operazioni intracomunitarie, per le quali la partita IVA deve essere inclusa nell'archivio VIES.",
            ],
          },
          {
            type: "p",
            text: "Le regole, con le fonti ufficiali, sono nella guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies).",
          },
        ],
      },
      {
        id: "cosa-fare",
        heading: "Cosa devi fare",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Nomina un rappresentante fiscale", text: "La società opera in Italia tramite un rappresentante residente, che adempie per lei gli obblighi IVA." },
              { title: "Prepara i documenti", text: "Documento societario, documento d'identità del legale rappresentante, estratto dal registro del Paese d'origine, dichiarazione del titolare effettivo e mandato di rappresentanza fiscale." },
              { title: "Richiedi la polizza", text: "Tu o il tuo rappresentante fiscale caricate i documenti nel portale; la compagnia di assicurazione valuta la richiesta e stabilisce il premio." },
              { title: "Ricevi la polizza firmata", text: "Dopo il pagamento del premio la polizza viene emessa e firmata digitalmente dalla compagnia." },
              { title: "Consegna e chiedi l'inclusione", text: "La polizza si consegna alla Direzione Provinciale dell'Agenzia delle Entrate, anche tramite il rappresentante fiscale. Dopo la verifica dell'ufficio si può chiedere l'inclusione nel VIES." },
            ],
          },
        ],
      },
      {
        id: "documenti",
        heading: "I documenti che ti chiediamo",
        blocks: [
          {
            type: "p",
            text: "L'elenco completo è nella sezione [quali documenti servono](section:documenti). Per le società cinesi serve il report del sistema nazionale di informazione sul credito d'impresa; per Hong Kong il Business Registration Certificate. Il documento societario e il documento d'identità del legale rappresentante vanno caricati con la loro traduzione.",
          },
        ],
      },
      {
        id: "nella-tua-lingua",
        heading: "Nella tua lingua",
        blocks: [
          {
            type: "p",
            text: "Il sito e il portale sono in italiano, inglese e cinese. Se gestisci le pratiche di più società, la pagina sulle [fideiussioni VIES per rappresentanti fiscali](page:representatives) spiega come funzionano i lotti.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "La garanzia serve anche se la società ha già la partita IVA italiana?",
        a: "Sì, se vuole essere inclusa nel VIES. Chi ha già la partita IVA presta la garanzia prima di chiedere l'inclusione; chi non l'ha ancora la presta insieme alla dichiarazione di inizio attività. Le società che erano già nel VIES il 14 aprile 2025 hanno avuto sessanta giorni da quella data per adeguarsi.",
      },
      {
        q: "Posso richiedere la polizza senza passare dal rappresentante fiscale?",
        a: "Sì, puoi scriverci direttamente: ti indichiamo i documenti e come caricarli. Il rappresentante fiscale resta comunque coinvolto, perché la garanzia è intestata alla Direzione Provinciale competente per il suo domicilio fiscale e la norma gli chiede di verificare i documenti della società quando chiede per lei l'inclusione nel VIES.",
      },
      {
        q: "Quanto costa la polizza fideiussoria VIES?",
        a: "Il costo è il premio della polizza, stabilito dalla compagnia di assicurazione dopo l'esame dei documenti. Dipende dall'importo garantito, dalla durata e dal profilo della società. Non pubblichiamo un listino: inviamo una quotazione scritta per ogni richiesta, e chiederla non impegna a sottoscrivere la polizza.",
      },
    ],
    cta: { title: "Vendi in Europa da un Paese extra UE?", text: "Raccontaci dove ha sede la società e chi è il tuo rappresentante fiscale: ti inviamo l'elenco dei documenti e una quotazione scritta.", button: "Richiedi contatto" },
    guidesTitle: "Guide per le società extra UE",
  },
};
