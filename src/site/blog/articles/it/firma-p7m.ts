import type { Article } from "../../types";

// Fonti verificate il 15/11/2026: regolamento (UE) 910/2014, art. 3 n. 12 e art. 25; decisione di esecuzione (UE)
// 2015/1506, art. 1; D.Lgs. 82/2005, art. 20 c. 1-bis e art. 24 c. 3 e 4-bis (Normattiva). Il riconoscimento dei
// file firmati e' quello del portale (src/lib/signedRecognition.ts).
export const firmaP7m: Article = {
  slug: "polizze-firmate-digitalmente-p7m",
  title: "File p7m: polizze VIES firmate digitalmente, come si fa",
  description: "Cos'è un file .p7m, che valore ha la firma digitale, come si apre e come si firma una polizza VIES, e come il portale riconosce i file firmati caricati insieme.",
  h1: "Polizze firmate digitalmente (.p7m): cosa sono e come si firmano",
  label: "Polizze firmate digitalmente (.p7m)",
  keyword: "file p7m",
  summary:
    "Un file .p7m è una busta che contiene il documento originale e la firma digitale di chi l'ha sottoscritto, in formato CAdES. La firma digitale dà al documento la forma scritta e l'efficacia della scrittura privata. Le polizze VIES arrivano firmate così dalla compagnia; i documenti che firmi tu si caricano nel portale anche tutti insieme.",
  sections: [
    {
      id: "cos-e",
      heading: "Cos'è un file .p7m",
      blocks: [
        {
          type: "p",
          text: "È il formato con cui la firma digitale «imbusta» un documento: dentro il file polizza.pdf.p7m ci sono il PDF originale, la firma e il certificato di chi ha firmato. Il formato si chiama CAdES ed è uno dei tre che gli Stati dell'Unione europea riconoscono, con la firma dentro il PDF (PAdES) e quella per i file XML (XAdES).",
        },
        {
          type: "table",
          columns: ["Caratteristica", "CAdES (.p7m)", "PAdES (.pdf)"],
          rows: [
            ["Come si presenta", "Un file nuovo, con estensione .p7m, che contiene il documento.", "Lo stesso PDF, con la firma al suo interno."],
            ["Cosa si può firmare", "Qualsiasi tipo di file.", "Solo file PDF."],
            ["Come si legge", "Serve un programma di verifica della firma, che estrae il documento.", "Si apre con un normale lettore di PDF."],
          ],
        },
      ],
    },
    {
      id: "valore",
      heading: "Che valore ha la firma digitale",
      blocks: [
        {
          type: "list",
          items: [
            "Una firma elettronica qualificata ha effetti giuridici equivalenti a quelli di una firma autografa ed è riconosciuta in tutti gli Stati membri (art. 25 del regolamento UE 910/2014).",
            "In Italia il documento informatico con firma digitale soddisfa il requisito della forma scritta e ha l'efficacia della scrittura privata prevista dall'art. 2702 del codice civile (art. 20, comma 1-bis, del Codice dell'amministrazione digitale).",
            "Il certificato deve essere valido al momento della firma: una firma apposta con un certificato scaduto, revocato o sospeso equivale a mancata sottoscrizione (art. 24, comma 4-bis).",
          ],
        },
      ],
    },
    {
      id: "come-si-apre",
      heading: "Come si apre e si verifica",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Apri la busta", text: "Con il programma di firma del tuo certificatore, oppure con uno dei programmi di verifica indicati dall'Agenzia per l'Italia Digitale." },
            { title: "Controlla l'esito", text: "Il programma indica chi ha firmato, quando, e se il certificato era valido." },
            { title: "Estrai il documento", text: "Dalla busta si salva il documento originale, per esempio il PDF della polizza." },
          ],
        },
      ],
    },
    {
      id: "come-si-firma",
      heading: "Come si firmano i documenti di una pratica",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "Scarica", text: "Dal portale scarichi in un solo archivio i documenti da firmare di tutte le pratiche." },
            { title: "Firma", text: "Li firmi con la tua firma digitale, anche tutti insieme se il tuo programma di firma lo consente." },
            { title: "Ricarica", text: "Ricarichi l'archivio, oppure i singoli file, come PDF firmati o come .p7m." },
            { title: "Controlla", text: "Il portale riporta ogni file alla sua pratica ed elenca quelli che non ha riconosciuto." },
          ],
        },
        {
          type: "p",
          text: "Si firmano la copia di polizza destinata alla compagnia e i documenti precontrattuali. La bozza non si firma. L'ordine dei passaggi è in [dalla richiesta alla polizza VIES emessa](article:richiesta-polizza); per chi gestisce più società, in [gestire un lotto di 20 pratiche VIES](article:lotto-pratiche).",
        },
      ],
    },
    {
      id: "come-riconosce",
      heading: "Come il portale riconosce i file firmati",
      blocks: [
        {
          type: "list",
          items: [
            "Dal nome del file o della cartella: numero della pratica oppure numero della bozza assegnato dalla compagnia.",
            "Dal contenuto: se il nome non basta, il portale apre la busta e cerca nel documento il numero di pratica, il numero di bozza, la partita IVA o il numero di polizza.",
            "Anche con due firme: una busta firmata due volte, una firma dentro l'altra oppure affiancate, viene letta lo stesso.",
            "Il solo nome del cliente non basta per allegare un documento firmato a una pratica.",
            "Le copie di polizza destinate al beneficiario non vanno ricaricate: servono per la consegna all'Agenzia delle Entrate. Se le carichi, il portale le scarta.",
          ],
        },
      ],
    },
    {
      id: "errori-da-evitare",
      heading: "Gli errori da evitare",
      blocks: [
        {
          type: "list",
          items: [
            "Firmare con un certificato scaduto.",
            "Firmare la bozza al posto della copia di polizza arrivata dopo il pagamento.",
            "Togliere dal nome del file il numero della pratica o della bozza: il portale può riconoscerlo dal contenuto, ma con il nome è immediato.",
          ],
        },
        {
          type: "p",
          text: "A chi va consegnata la polizza emessa, e che cosa succede dopo, è spiegato nella guida [garanzia VIES: cos'è e chi deve prestarla](article:garanzia-vies).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Come si apre un file .p7m?",
      a: "Con un programma di verifica della firma digitale: quello fornito dal tuo certificatore oppure uno dei programmi indicati dall'Agenzia per l'Italia Digitale. Il programma apre la busta, mostra chi ha firmato e se il certificato era valido, e permette di salvare il documento originale, per esempio il PDF della polizza.",
    },
    {
      q: "Un file .p7m vale quanto un documento firmato a mano?",
      a: "Sì, se la firma è una firma digitale o un'altra firma elettronica qualificata. Il regolamento europeo 910/2014 le attribuisce effetti equivalenti alla firma autografa, e il Codice dell'amministrazione digitale riconosce al documento così firmato la forma scritta e l'efficacia della scrittura privata. Il certificato deve essere valido al momento della firma.",
    },
    {
      q: "Posso caricare nel portale tutti i file firmati insieme?",
      a: "Sì. Puoi caricare un solo archivio con i file firmati di tutte le pratiche, oppure i singoli file, anche mescolando PDF firmati e .p7m. Il portale riporta ogni file alla sua pratica dal nome oppure, se serve, dal contenuto del documento, e ti elenca quelli che non è riuscito a riconoscere.",
    },
  ],
  sources: [
    { label: "EUR-Lex, regolamento (UE) n. 910/2014 (eIDAS), artt. 3 e 25", href: "https://eur-lex.europa.eu/eli/reg/2014/910/oj" },
    { label: "EUR-Lex, decisione di esecuzione (UE) 2015/1506 sui formati delle firme elettroniche", href: "https://eur-lex.europa.eu/eli/dec_impl/2015/1506/oj" },
    { label: "Normattiva, D.Lgs. 7 marzo 2005, n. 82, Codice dell'amministrazione digitale (artt. 20 e 24)", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-03-07;82" },
    { label: "Agenzia per l'Italia Digitale, firma elettronica qualificata e software di verifica", href: "https://www.agid.gov.it/it/piattaforme/firma-elettronica-qualificata" },
  ],
};
