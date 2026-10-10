// Contenuto della guida operativa VIES, in italiano, inglese e cinese.
// Le tre lingue hanno la stessa struttura: ogni sezione e ogni tabella corrisponde riga per riga.
// Le stringhe sono HTML (solo <strong>, <em>); le "&" vanno scritte &amp;.
// Testo rivisto con le regole del humanizer: frasi dirette, niente annunci ("ecco i passaggi"),
// niente elenchi con titoletti in grassetto, grassetto solo per etichette di tabella e totali.

export const PORTAL_LINK = "https://portale.tecnomga.com";
export const VERIFY_LINK = "www.markelinsurance.it/prodotti/fideiussioni/verifica-polizze";
export const CONTACT_EMAIL = "info@tecnomga.com";
export const PEC = "tecnoadvancemgabroker@legalmail.it";

export const GUIDE = {
  it: {
    lang: "it",
    tag: "Italiano",
    title: "Guida operativa alle fideiussioni VIES",
    summary:
      "Dall'assunzione del rischio all'emissione della polizza: come presentare le pratiche, come funziona il portale Tecno Advance MGA e cosa accade a ogni passaggio.",
    overviewTitle: "Il percorso in sintesi",
    overview: [
      "Programma polizze e documenti del rappresentante",
      "Valutazione (circa 48 ore)",
      "Delibera del plafond e conferma",
      "Preparazione del lotto: Excel + ZIP",
      "Caricamento nel portale",
      "Bozze con testo completo",
      "Conferma dati e pagamento del premio",
      "Simplo firmato digitalmente",
      "Copie al beneficiario e al cliente",
      "Verifica delle polizze",
    ],
    sections: [
      {
        title: "Il prodotto e le condizioni",
        blocks: [
          {
            t: "p",
            x: "Tecno Advance MGA ha concluso un accordo in esclusiva per il rischio VIES con Markel Insurance SE, Stabilimento in Spagna, gruppo assicurativo americano già presente in tutta Europa. La polizza è una fideiussione prevista dall'art. 35, comma 7-quater, del DPR 633/1972, a favore dell'Agenzia delle Entrate. Serve ai soggetti non residenti che operano in Italia tramite un rappresentante fiscale.",
          },
          {
            t: "table",
            head: ["Voce", "Dettaglio"],
            rows: [
              ["Importo garantito", "€ 50.000"],
              ["Durata", "36 mesi dalla data di presentazione all'Ufficio dell'Agenzia delle Entrate competente"],
              ["Beneficiario", "Agenzia delle Entrate"],
              ["Premio di polizza", "€ 2.000"],
              ["Consulenza di gestione", "€ 600"],
              ["<strong>Costo totale per polizza</strong>", "<strong>€ 2.600</strong>"],
            ],
            widths: ["34%", "66%"],
          },
        ],
      },
      {
        title: "Procedura di assunzione del rischio",
        blocks: [
          {
            t: "p",
            x: "La sottoscrizione parte da una valutazione preliminare del rappresentante fiscale e della sua operatività con le società clienti che hanno bisogno della copertura.",
          },
          {
            t: "ol",
            items: [
              "Ci inviate il programma polizze: quante polizze vi servono da oggi a dicembre 2026, se possibile mese per mese. Ci serve per organizzare il plafond.",
              "Ci inviate i documenti del rappresentante: visura camerale o certificato dell'azienda, presentazione del gruppo, bilanci e relazione sulla gestione dei clienti in Italia.",
              "Valutiamo la documentazione. Servono circa 48 ore dal ricevimento del materiale completo.",
              "Deliberiamo il plafond e vi comunichiamo quante polizze possiamo emettere per voi.",
              "Dopo la conferma di sottoscrizione attiviamo il vostro accesso personale al portale, con il prodotto VIES abilitato.",
            ],
          },
          {
            t: "note",
            x: "La conferma indica il numero di polizze che possiamo emettere per ciascun rappresentante fiscale (plafond). Le pratiche si presentano poi come descritto nelle sezioni seguenti.",
          },
        ],
      },
      {
        title: "Accesso al portale",
        blocks: [
          { t: "link", label: "Indirizzo del portale" },
          {
            t: "p",
            x: "L'accesso è personale e lo attiviamo noi dopo la conferma di sottoscrizione. Il profilo deve avere il prodotto VIES abilitato: senza, il portale segnala che l'accesso non è autorizzato.",
          },
          {
            t: "p",
            x: "Il portale è disponibile in italiano, inglese e cinese; la lingua si cambia dal selettore «Lingua» nel menu. Gli estratti conto in PDF sono emessi in italiano.",
          },
          {
            t: "p",
            x: "Ogni rappresentante vede solo i lotti e le pratiche che ha caricato, mai quelli degli altri.",
          },
          {
            t: "note",
            x: "Le schermate di questa guida mostrano il portale con l'interfaccia in cinese. I nomi delle società e i dati inseriti sono di fantasia. Con l'interfaccia in italiano o in inglese le schermate sono le stesse, con le etichette tradotte.",
          },
        ],
      },
      {
        title: "Preparazione del lotto",
        blocks: [
          {
            t: "p",
            x: "Un file Excel corrisponde a un lotto di 20 pratiche. Dividiamo le polizze in lotti da 20 e per ogni lotto inviamo un estratto conto di ricapitolo con le pratiche da saldare: così i pagamenti si riconciliano più facilmente. Il modello Excel è in allegato e si scarica anche dalla pagina VIES del portale.",
          },
          { t: "h3", x: "Foglio PRATICHE: una riga per cliente" },
          {
            t: "p",
            x: "La colonna ZIP è già numerata da 1 a 20: il cliente della riga con ZIP 3 corrisponde al file 3.zip. Le righe in grigio con la scritta ESEMPIO mostrano come compilare e vanno sovrascritte; se restano nel file, il portale le ignora. Non modificate le intestazioni e non inserite righe sopra la tabella.",
          },
          {
            t: "table",
            head: ["Colonna", "Cosa inserire", "Obbligatoria"],
            rows: [
              ["<strong>ZIP</strong>", "Numero da 1 a 20, già presente.", "Sì"],
              ["<strong>Ragione Sociale</strong>", "Denominazione della società cliente, come nella licenza commerciale.", "Sì"],
              ["<strong>P.IVA</strong>", "Partita IVA italiana, se il cliente già la possiede.", "Una tra P.IVA e Codice credito sociale"],
              ["<strong>Codice credito sociale</strong>", "Codice unificato di credito sociale (18 caratteri).", "Una tra le due"],
              ["<strong>Denominazione CN</strong>", "Denominazione cinese della società.", "No"],
              ["<strong>Sede legale estera</strong>", "Indirizzo della sede legale all'estero.", "No"],
              ["<strong>Legale rappresentante</strong>", "Nome del legale rappresentante del cliente.", "No"],
              ["<strong>Telefono, Email</strong>", "Recapiti del cliente.", "No"],
              ["<strong>PEC</strong>", "PEC del cliente. Se vuota, si usa quella del rappresentante fiscale.", "No"],
            ],
            widths: ["26%", "50%", "24%"],
          },
          { t: "h3", x: "Foglio DATI FOGLIO: dati comuni a tutto il lotto" },
          {
            t: "p",
            x: "Il beneficiario è già indicato (Agenzia delle Entrate) e la sua PEC è facoltativa. Il rappresentante fiscale va compilato come risulta dalla visura: denominazione, codice fiscale o P.IVA, amministratore e suo codice fiscale, sede (è anche il domicilio fiscale in Italia delle società clienti) e PEC. La colonna Note mostra un esempio per ogni campo.",
          },
          { t: "h3", x: "File ZIP: uno per pratica" },
          { t: "p", x: "Ogni ZIP si chiama solo con il numero della riga: 1.zip, 2.zip … 20.zip." },
          {
            t: "table",
            head: ["Di chi", "Documenti"],
            rows: [
              [
                "<strong>Cliente</strong>",
                "Licenza commerciale con traduzione; documento d'identità del legale rappresentante con traduzione; report sul credito d'impresa con traduzione; dichiarazione sostitutiva a supporto della fideiussione; dichiarazione UBO; mandato di rappresentanza fiscale.",
              ],
              ["<strong>Rappresentante fiscale</strong>", "Visura; bilancio; statuto."],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "I documenti vengono riconosciuti dal contenuto e non dal nome del file. Una pratica con documenti mancanti o appartenenti a un'altra società viene bloccata.",
          },
        ],
      },
      {
        title: "Caricamento nel portale, passo per passo",
        blocks: [
          { t: "p", x: "Dal menu VIES si apre la pagina di caricamento del lotto, che procede in cinque passaggi." },
          {
            t: "table",
            head: ["Passaggio", "Cosa fare", "Cosa fa il portale"],
            rows: [
              [
                "<strong>1. File del lotto</strong>",
                "Caricare l'Excel e gli ZIP (anche un unico ZIP che contiene 1.zip … 20.zip).",
                "Legge l'Excel, scompatta gli ZIP e indicizza i documenti, anche quelli dentro ZIP annidati.",
              ],
              [
                "<strong>2. Dati del foglio</strong>",
                "Controllare beneficiario e rappresentante fiscale; in alternativa caricare la visura del rappresentante (PDF).",
                "Legge denominazione, codice fiscale, sede, PEC e amministratore dal foglio DATI FOGLIO o dalla visura e li propone da verificare.",
              ],
              [
                "<strong>3. Controllo pratiche</strong>",
                "Verificare l'esito di ogni riga: «Pronta» o «Bloccata».",
                "Abbina ogni riga al suo ZIP, riconosce i documenti dal contenuto, legge le scansioni e verifica l'identità della società. Indica il motivo del blocco e che cosa fare.",
              ],
              [
                "<strong>4. Documenti obbligatori VIES</strong>",
                "Controllare la mappa dei documenti.",
                "Mostra, per ogni tipologia, in quanti ZIP è presente e dove manca.",
              ],
              [
                "<strong>5. Crea le pratiche</strong>",
                "Premere «Crea N pratiche VIES», dove N è il numero di pratiche pronte.",
                "Crea solo le pratiche complete e corrette, ciascuna con il suo ZIP e il documento di polizza.",
              ],
            ],
            widths: ["20%", "38%", "42%"],
          },
          { t: "h3", x: "Motivi più frequenti di blocco" },
          {
            t: "ul",
            items: [
              "documenti mancanti o appartenenti a un'altra società;",
              "documento d'identità scaduto;",
              "P.IVA, codice di credito sociale o codice fiscale non validi;",
              "PEC non valida;",
              "società già presente nel portale.",
            ],
          },
          {
            t: "note",
            x: "Una riga bloccata non diventa una pratica: va corretta e caricata in un nuovo lotto (nuovo Excel con le sole righe corrette e i loro ZIP). Le altre righe procedono normalmente. Una società già presente nel portale, caricata da chiunque, viene riconosciuta e non viene creata due volte.",
          },
        ],
      },
      {
        title: "Come funziona il portale",
        blocks: [
          {
            t: "table",
            head: ["Area", "A cosa serve"],
            rows: [
              [
                "<strong>Pratiche</strong>",
                "Elenco delle vostre pratiche VIES con stato, ricerca e filtri. Aprendo una pratica trovate il riepilogo (contraente, beneficiario, rappresentante fiscale, garanzia e premio) e i documenti scaricabili (ZIP, documento di polizza).",
              ],
              [
                "<strong>Amministrazione → VIES</strong>",
                "Elenco dei vostri rappresentanti fiscali: selezionandone uno si apre il riepilogo con i lotti Excel caricati, l'Excel di ogni lotto (scaricabile), l'estratto conto in PDF e lo stato del pagamento.",
              ],
              ["<strong>VIES</strong>", "Caricamento di un nuovo lotto, in cinque passaggi (sezione precedente)."],
              ["<strong>Lingua</strong>", "Italiano, inglese, cinese."],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "Ogni utente vede soltanto i propri lotti. L'area Amministrazione mostra la sola parte cliente dell'estratto conto.",
          },
        ],
      },
      {
        title: "Dalla bozza all'emissione: i cinque passaggi",
        blocks: [
          {
            t: "table",
            head: ["", "Passaggio", "Cosa facciamo noi", "Cosa dovete fare voi"],
            rows: [
              [
                "<strong>1</strong>",
                "<strong>Bozze</strong>",
                "Produciamo le bozze con il testo completo della polizza per ogni singolo lotto, venti alla volta.",
                "Ricevere le bozze e controllarle.",
              ],
              [
                "<strong>2</strong>",
                "<strong>Conferma dati e pagamento</strong>",
                "Inviamo l'estratto conto del lotto con le pratiche da saldare e registriamo i pagamenti lotto per lotto.",
                "Confermare i dati della bozza e pagare il premio di polizza.",
              ],
              [
                "<strong>3</strong>",
                "<strong>Emissione del simplo</strong>",
                "Emettiamo il simplo della polizza della Compagnia.",
                "Firmarlo digitalmente e restituircelo firmato.",
              ],
              [
                "<strong>4</strong>",
                "<strong>Copie di polizza</strong>",
                "Emettiamo le copie di polizza simplo per il beneficiario e inviamo al cliente tutte le copie di polizza.",
                "Nessuna azione: il cliente riceve le copie.",
              ],
              [
                "<strong>5</strong>",
                "<strong>Verifica delle polizze</strong>",
                "Le polizze emesse si possono verificare: l'originalità della firma si controlla sul sito Markel, VERIFY_LINK, digitando il codice di controllo riportato sul documento.",
                "Verificare le polizze quando necessario.",
              ],
            ],
            widths: ["5%", "19%", "48%", "28%"],
          },
          {
            t: "p",
            x: "Bozze, pagamento e riconciliazione seguono lo stesso raggruppamento in lotti da venti polizze: a ogni lotto corrisponde un estratto conto.",
          },
        ],
      },
      {
        title: "Contatti",
        blocks: [
          { t: "contacts" },
          {
            t: "note",
            x: "Documento a carattere informativo: le condizioni definitive sono quelle della polizza emessa dalla Compagnia.",
          },
        ],
      },
    ],
  },

  en: {
    lang: "en",
    tag: "English",
    title: "Operating guide to VIES guarantees",
    summary:
      "From risk acceptance to policy issuance: how to submit applications, how the Tecno Advance MGA portal works, and what happens at each step.",
    overviewTitle: "The process at a glance",
    overview: [
      "Policy programme and representative's documents",
      "Assessment (about 48 hours)",
      "Plafond decision and confirmation",
      "Preparing the batch: Excel + ZIP",
      "Upload to the portal",
      "Drafts with the full text",
      "Data confirmation and premium payment",
      "Digitally signed simplo",
      "Copies to the beneficiary and the client",
      "Policy verification",
    ],
    sections: [
      {
        title: "The product and its terms",
        blocks: [
          {
            t: "p",
            x: "Tecno Advance MGA has concluded an exclusive agreement for VIES risk with Markel Insurance SE, Spanish branch, an American insurance group already present throughout Europe. The policy is a guarantee under Article 35(7-quater) of Presidential Decree 633/1972, in favour of the Italian Revenue Agency (Agenzia delle Entrate). It is meant for non-resident taxpayers who operate in Italy through a fiscal representative.",
          },
          {
            t: "table",
            head: ["Item", "Detail"],
            rows: [
              ["Guaranteed amount", "€ 50,000"],
              ["Duration", "36 months from the date of submission to the competent office of the Revenue Agency"],
              ["Beneficiary", "Italian Revenue Agency (Agenzia delle Entrate)"],
              ["Policy premium", "€ 2,000"],
              ["Management consultancy", "€ 600"],
              ["<strong>Total cost per policy</strong>", "<strong>€ 2,600</strong>"],
            ],
            widths: ["34%", "66%"],
          },
        ],
      },
      {
        title: "Risk acceptance procedure",
        blocks: [
          {
            t: "p",
            x: "Underwriting starts with a preliminary assessment of the fiscal representative and of its activity with the client companies that need the cover.",
          },
          {
            t: "ol",
            items: [
              "You send us the policy programme: how many policies you need from today to December 2026, month by month if possible. We use it to organise the plafond.",
              "You send us the representative's documents: company registry extract (visura camerale) or company certificate, group presentation, financial statements and a report on the management of clients in Italy.",
              "We assess the documents. This takes about 48 hours from receipt of the complete set.",
              "We decide the plafond and tell you how many policies we can issue for you.",
              "After the underwriting confirmation we activate your personal portal access, with the VIES product enabled.",
            ],
          },
          {
            t: "note",
            x: "The confirmation states how many policies we can issue for each fiscal representative (plafond). Applications are then submitted as described in the following sections.",
          },
        ],
      },
      {
        title: "Portal access",
        blocks: [
          { t: "link", label: "Portal address" },
          {
            t: "p",
            x: "Access is personal and we activate it after the underwriting confirmation. The profile must have the VIES product enabled; without it, the portal reports that access is not authorised.",
          },
          {
            t: "p",
            x: "The portal is available in Italian, English and Chinese; change the language with the \"Language\" selector in the menu. PDF statements are issued in Italian.",
          },
          {
            t: "p",
            x: "Each fiscal representative sees only the batches and applications they uploaded, never those of others.",
          },
          {
            t: "note",
            x: "The screenshots in this guide show the portal with the Chinese interface. Company names and the data entered are invented. With the Italian or English interface the screens are the same, with the labels translated.",
          },
        ],
      },
      {
        title: "Preparing the batch",
        blocks: [
          {
            t: "p",
            x: "One Excel file corresponds to one batch of 20 applications. We divide policies into batches of 20 and, for each batch, send a summary statement listing the applications to be settled, which makes payments easier to reconcile. The Excel template is attached and can also be downloaded from the portal's VIES page.",
          },
          { t: "h3", x: "PRATICHE sheet: one row per client" },
          {
            t: "p",
            x: "The ZIP column is already numbered 1 to 20: the client on the row with ZIP 3 corresponds to the file 3.zip. The grey rows marked ESEMPIO (example) show how to fill in the sheet and must be overwritten; if they stay in the file, the portal ignores them. Do not change the headers or insert rows above the table.",
          },
          {
            t: "table",
            head: ["Column", "What to enter", "Required"],
            rows: [
              ["<strong>ZIP</strong>", "Number from 1 to 20, already filled in.", "Yes"],
              ["<strong>Ragione Sociale</strong> (company name)", "Name of the client company, as in the business licence.", "Yes"],
              ["<strong>P.IVA</strong> (Italian VAT number)", "Italian VAT number, if the client already has one.", "One of P.IVA and Unified Social Credit Code"],
              ["<strong>Codice credito sociale</strong> (Unified Social Credit Code)", "Unified Social Credit Code (18 characters).", "One of the two"],
              ["<strong>Denominazione CN</strong> (Chinese name)", "Chinese name of the company.", "No"],
              ["<strong>Sede legale estera</strong> (registered office abroad)", "Address of the registered office abroad.", "No"],
              ["<strong>Legale rappresentante</strong> (legal representative)", "Name of the client's legal representative.", "No"],
              ["<strong>Telefono, Email</strong> (phone, email)", "The client's contact details.", "No"],
              ["<strong>PEC</strong> (certified email)", "The client's PEC. If left empty, the fiscal representative's PEC is used.", "No"],
            ],
            widths: ["30%", "46%", "24%"],
          },
          { t: "h3", x: "DATI FOGLIO sheet: data common to the whole batch" },
          {
            t: "p",
            x: "The beneficiary is already filled in (Italian Revenue Agency) and its PEC is optional. Fill in the fiscal representative as shown in the registry extract (visura): company name, tax code or VAT number, director and their tax code, registered office (also the Italian tax domicile of the client companies) and PEC. The Notes column gives an example for each field.",
          },
          { t: "h3", x: "ZIP files: one per application" },
          { t: "p", x: "Each ZIP is named only with the row number: 1.zip, 2.zip … 20.zip." },
          {
            t: "table",
            head: ["Of", "Documents"],
            rows: [
              [
                "<strong>Client</strong>",
                "Business licence with translation; legal representative's identity document with translation; corporate credit report with translation; self-certification supporting the guarantee; UBO declaration; fiscal representation mandate.",
              ],
              ["<strong>Fiscal representative</strong>", "Registry extract (visura); financial statements; articles of association."],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "Documents are recognised by their content, not by the file name. An application with missing documents, or documents belonging to another company, is blocked.",
          },
        ],
      },
      {
        title: "Uploading to the portal, step by step",
        blocks: [
          { t: "p", x: "From the VIES menu, open the batch upload page. It works in five steps." },
          {
            t: "table",
            head: ["Step", "What you do", "What the portal does"],
            rows: [
              [
                "<strong>1. Batch files</strong>",
                "Upload the Excel file and the ZIP files (or a single ZIP containing 1.zip … 20.zip).",
                "Reads the Excel file, unpacks the ZIPs and indexes the documents, including those inside nested ZIPs.",
              ],
              [
                "<strong>2. Sheet data</strong>",
                "Check the beneficiary and the fiscal representative; alternatively upload the representative's visura (PDF).",
                "Reads company name, tax code, address, PEC and director from the DATI FOGLIO sheet or the visura and proposes them for checking.",
              ],
              [
                "<strong>3. Application check</strong>",
                "Review the result of each row: \"Ready\" or \"Blocked\".",
                "Matches each row to its ZIP, recognises documents by content, reads scans and verifies the company's identity. States the reason for a block and what to do.",
              ],
              [
                "<strong>4. Required VIES documents</strong>",
                "Review the document map.",
                "Shows, for each type, in how many ZIPs it is present and where it is missing.",
              ],
              [
                "<strong>5. Create the applications</strong>",
                "Press \"Create N VIES applications\", where N is the number of ready applications.",
                "Creates only complete and correct applications, each with its ZIP and the policy document.",
              ],
            ],
            widths: ["20%", "38%", "42%"],
          },
          { t: "h3", x: "Most frequent reasons for a block" },
          {
            t: "ul",
            items: [
              "documents missing or belonging to another company;",
              "expired identity document;",
              "invalid VAT number, Unified Social Credit Code or tax code;",
              "invalid PEC;",
              "company already in the portal.",
            ],
          },
          {
            t: "note",
            x: "A blocked row does not become an application: correct it and upload it in a new batch (a new Excel file with only the corrected rows and their ZIPs). The other rows proceed normally. A company already in the portal, uploaded by anyone, is recognised and is not created twice.",
          },
        ],
      },
      {
        title: "How the portal works",
        blocks: [
          {
            t: "table",
            head: ["Area", "Purpose"],
            rows: [
              [
                "<strong>Applications</strong>",
                "List of your VIES applications with status, search and filters. Opening one shows the summary (policyholder, beneficiary, fiscal representative, guarantee and premium) and the downloadable documents (ZIP, policy document).",
              ],
              [
                "<strong>Accounting → VIES</strong>",
                "List of your fiscal representatives: select one to open the summary with the uploaded Excel batches, each batch's Excel file (downloadable), the PDF statement and the payment status.",
              ],
              ["<strong>VIES</strong>", "Upload of a new batch, in five steps (previous section)."],
              ["<strong>Language</strong>", "Italian, English, Chinese."],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "Each user sees only their own batches. The Accounting area shows only the client part of the statement.",
          },
        ],
      },
      {
        title: "From draft to issuance: the five steps",
        blocks: [
          {
            t: "table",
            head: ["", "Step", "What we do", "What you do"],
            rows: [
              [
                "<strong>1</strong>",
                "<strong>Drafts</strong>",
                "We produce drafts with the full policy text for each batch, twenty at a time.",
                "Receive and check the drafts.",
              ],
              [
                "<strong>2</strong>",
                "<strong>Data confirmation and payment</strong>",
                "We send the batch statement listing the applications to be settled and record payments batch by batch.",
                "Confirm the draft data and pay the policy premium.",
              ],
              [
                "<strong>3</strong>",
                "<strong>Issuing the simplo</strong>",
                "We issue the simplo copy of the Company's policy.",
                "Sign it digitally and return it to us signed.",
              ],
              [
                "<strong>4</strong>",
                "<strong>Policy copies</strong>",
                "We issue the simplo policy copies for the beneficiary and send the client all the policy copies.",
                "No action needed: the client receives the copies.",
              ],
              [
                "<strong>5</strong>",
                "<strong>Policy verification</strong>",
                "Issued policies can be verified: the authenticity of the signature is checked on Markel's website, VERIFY_LINK, by entering the control code shown on the document.",
                "Verify the policies when needed.",
              ],
            ],
            widths: ["5%", "19%", "48%", "28%"],
          },
          {
            t: "p",
            x: "Drafts, payment and reconciliation follow the same grouping in batches of twenty policies: each batch has its own statement.",
          },
        ],
      },
      {
        title: "Contacts",
        blocks: [
          { t: "contacts" },
          {
            t: "note",
            x: "This document is for information only: the final terms are those of the policy issued by the Company.",
          },
        ],
      },
    ],
  },

  zh: {
    lang: "zh",
    tag: "中文",
    title: "VIES 担保保单操作指南",
    summary: "从风险承保到保单出具：如何提交申请、Tecno Advance MGA 门户如何运作，以及每个环节会发生什么。",
    overviewTitle: "流程概览",
    overview: [
      "保单计划与税务代表资料",
      "评估（约 48 小时）",
      "核定额度并确认",
      "准备批次：Excel + ZIP",
      "上传至门户",
      "含完整文本的草稿",
      "确认数据并支付保费",
      "数字签署 simplo 保单",
      "向受益人和客户发送副本",
      "保单验证",
    ],
    sections: [
      {
        title: "产品与条件",
        blocks: [
          {
            t: "p",
            x: "Tecno Advance MGA 已与 Markel Insurance SE（西班牙分支机构）就 VIES 风险达成独家合作协议。Markel 是美国保险集团，业务已覆盖整个欧洲。该保单是依据第 633/1972 号总统令（DPR 633/1972）第 35 条第 7-quater 款出具的担保保单，受益人为意大利税务局（Agenzia delle Entrate），适用于通过税务代表在意大利开展业务的非居民主体。",
          },
          {
            t: "table",
            head: ["项目", "内容"],
            rows: [
              ["担保金额", "€ 50,000"],
              ["期限", "自向意大利税务局主管办公室提交之日起 36 个月"],
              ["受益人", "意大利税务局（Agenzia delle Entrate）"],
              ["保单保费", "€ 2,000"],
              ["管理咨询费", "€ 600"],
              ["<strong>每份保单总费用</strong>", "<strong>€ 2,600</strong>"],
            ],
            widths: ["34%", "66%"],
          },
        ],
      },
      {
        title: "风险承保流程",
        blocks: [
          {
            t: "p",
            x: "承保从对税务代表的初步评估开始，评估内容包括其与需要该保障的客户公司之间的业务往来。",
          },
          {
            t: "ol",
            items: [
              "请先把保单计划发给我们：从现在到 2026 年 12 月您需要多少份保单，最好按月列明。我们据此安排承保额度（plafond）。",
              "再提交税务代表的资料：公司注册证明（visura camerale）或企业证明、集团介绍、财务报表，以及意大利客户管理情况报告。",
              "我们评估这些资料，收到完整资料后约需 48 小时。",
              "我们核定额度，并告知可为您出具多少份保单。",
              "确认承保后，我们为您开通个人门户账号，并启用 VIES 产品。",
            ],
          },
          {
            t: "note",
            x: "确认通知会载明我们可为每位税务代表出具的保单数量（承保额度 plafond）。之后请按照后文所述流程提交申请。",
          },
        ],
      },
      {
        title: "门户登录",
        blocks: [
          { t: "link", label: "门户地址" },
          {
            t: "p",
            x: "登录账号为个人账号，由我们在确认承保后开通。账号须已启用 VIES 产品，否则门户会提示无权访问。",
          },
          {
            t: "p",
            x: "门户提供意大利语、英语和中文，可通过菜单中的“语言”选择器切换。PDF 对账单以意大利语出具。",
          },
          {
            t: "p",
            x: "每位税务代表只能看到自己上传的批次和申请，看不到他人的。",
          },
          {
            t: "note",
            x: "本指南中的截图均为门户的中文界面，其中的公司名称和填写的数据均为虚构。切换为意大利语或英语界面后，页面相同，仅标签文字不同。",
          },
        ],
      },
      {
        title: "准备批次",
        blocks: [
          {
            t: "p",
            x: "一个 Excel 文件对应一个包含 20 笔申请的批次。我们将保单按每 20 份划分为一个批次，并为每个批次发送一份汇总对账单，列明待结算的申请，这样付款更容易核对。Excel 模板见附件，也可在门户的 VIES 页面下载。",
          },
          { t: "h3", x: "PRATICHE 工作表：每个客户一行" },
          {
            t: "p",
            x: "ZIP 列已按 1 至 20 编号：ZIP 为 3 的那一行对应文件 3.zip。灰色且标有 ESEMPIO（示例）的行展示了填写方式，请用真实数据覆盖；如果留在文件中，门户会忽略这些行。请勿修改表头，也不要在表格上方插入行。",
          },
          {
            t: "table",
            head: ["列", "填写内容", "是否必填"],
            rows: [
              ["<strong>ZIP</strong>", "1 至 20 的编号，已预先填好。", "是"],
              ["<strong>Ragione Sociale</strong>（公司名称）", "客户公司名称，与营业执照一致。", "是"],
              ["<strong>P.IVA</strong>（意大利增值税号）", "意大利增值税号（如客户已有）。", "P.IVA 与统一社会信用代码二选一"],
              ["<strong>Codice credito sociale</strong>（统一社会信用代码）", "统一社会信用代码（18 位）。", "二选一"],
              ["<strong>Denominazione CN</strong>（中文名称）", "公司中文名称。", "否"],
              ["<strong>Sede legale estera</strong>（境外注册地址）", "境外注册办公地址。", "否"],
              ["<strong>Legale rappresentante</strong>（法定代表人）", "客户法定代表人姓名。", "否"],
              ["<strong>Telefono, Email</strong>（电话、邮箱）", "客户联系方式。", "否"],
              ["<strong>PEC</strong>（认证邮箱）", "客户的 PEC。留空则使用税务代表的 PEC。", "否"],
            ],
            widths: ["32%", "44%", "24%"],
          },
          { t: "h3", x: "DATI FOGLIO 工作表：整个批次通用的数据" },
          {
            t: "p",
            x: "受益人已填写（意大利税务局），其 PEC 为可选项。税务代表请按公司注册证明（visura）填写：公司名称、税号或增值税号、董事及其税号、注册地址（同时也是客户公司在意大利的税务住所）和 PEC。备注列为每个字段提供了示例。",
          },
          { t: "h3", x: "ZIP 文件：每笔申请一个" },
          { t: "p", x: "每个 ZIP 仅以行号命名：1.zip、2.zip … 20.zip。" },
          {
            t: "table",
            head: ["归属", "文件"],
            rows: [
              [
                "<strong>客户</strong>",
                "营业执照及翻译件；法定代表人身份证件及翻译件；企业信用信息报告及翻译件；担保所需声明（替代声明）；最终受益人（UBO）声明；税务代表授权书。",
              ],
              ["<strong>税务代表</strong>", "公司注册证明（visura）；财务报表；公司章程。"],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "系统按文件内容而非文件名识别文件。资料缺失或属于其他公司的申请将被阻止。",
          },
        ],
      },
      {
        title: "在门户中上传：分步说明",
        blocks: [
          { t: "p", x: "在菜单 VIES 中打开批次上传页面，共分五个步骤。" },
          {
            t: "table",
            head: ["步骤", "您需要做的", "门户的处理"],
            rows: [
              [
                "<strong>1. 批次文件</strong>",
                "上传 Excel 和各 ZIP（也可上传一个包含 1.zip … 20.zip 的总 ZIP）。",
                "读取 Excel、解压 ZIP 并为文件建立索引，包括嵌套 ZIP 内的文件。",
              ],
              [
                "<strong>2. 表格公共信息</strong>",
                "核对受益人和税务代表；也可上传税务代表的 visura（PDF）。",
                "从 DATI FOGLIO 工作表或 visura 读取公司名称、税号、地址、PEC 和董事信息，供您核对。",
              ],
              [
                "<strong>3. 申请审核</strong>",
                "查看每一行的结果：“就绪”或“已阻止”。",
                "将每一行与对应 ZIP 匹配，按内容识别文件，读取扫描件并核实公司身份；说明阻止原因及处理方法。",
              ],
              [
                "<strong>4. VIES 必备文件</strong>",
                "查看文件映射。",
                "按文件类型显示其出现在多少个 ZIP 中，以及缺少的位置。",
              ],
              [
                "<strong>5. 创建申请</strong>",
                "点击“创建 N 笔 VIES 申请”，N 为已就绪的申请数量。",
                "仅创建完整且无误的申请，每笔均附带其 ZIP 和保单文件。",
              ],
            ],
            widths: ["20%", "38%", "42%"],
          },
          { t: "h3", x: "常见的阻止原因" },
          {
            t: "ul",
            items: [
              "文件缺失或属于其他公司；",
              "身份证件已过期；",
              "增值税号、统一社会信用代码或税号无效；",
              "PEC 无效；",
              "该公司已存在于门户中。",
            ],
          },
          {
            t: "note",
            x: "被阻止的行不会成为申请：请更正后在新批次中重新上传（新的 Excel，仅含已更正的行及其 ZIP）。其他行正常处理。无论由谁上传，门户中已存在的公司都会被识别，不会重复创建。",
          },
        ],
      },
      {
        title: "门户如何运作",
        blocks: [
          {
            t: "table",
            head: ["区域", "用途"],
            rows: [
              [
                "<strong>业务申请</strong>",
                "您的 VIES 申请列表，含状态、搜索和筛选。打开某笔申请可查看摘要（投保人、受益人、税务代表、担保与保费）和可下载的文件（ZIP、保单文件）。",
              ],
              [
                "<strong>财务管理 → VIES</strong>",
                "您的税务代表列表：选择其中一位，即可打开汇总，查看已上传的 Excel 批次、每个批次的 Excel（可下载）、PDF 对账单及付款状态。",
              ],
              ["<strong>VIES</strong>", "上传新批次，分五个步骤（见上一节）。"],
              ["<strong>语言</strong>", "意大利语、英语、中文。"],
            ],
            widths: ["26%", "74%"],
          },
          {
            t: "note",
            x: "每位用户只能看到自己的批次。财务管理区域仅显示对账单中面向客户的部分。",
          },
        ],
      },
      {
        title: "从草稿到出具：五个步骤",
        blocks: [
          {
            t: "table",
            head: ["", "步骤", "我们负责", "您需要做"],
            rows: [
              [
                "<strong>1</strong>",
                "<strong>草稿</strong>",
                "为每个批次制作含保单完整文本的草稿，每次 20 份。",
                "收到草稿并核对。",
              ],
              [
                "<strong>2</strong>",
                "<strong>确认数据与付款</strong>",
                "发送该批次的对账单，列明待结算的申请，并按批次登记付款。",
                "确认草稿数据并支付保单保费。",
              ],
              [
                "<strong>3</strong>",
                "<strong>出具 simplo</strong>",
                "出具保险公司保单的单份文本（simplo）。",
                "以数字方式签署，并将已签署的文件回传给我们。",
              ],
              [
                "<strong>4</strong>",
                "<strong>保单副本</strong>",
                "出具供受益人使用的保单（simplo）副本，并将全部保单副本发送给客户。",
                "无需操作：客户会收到副本。",
              ],
              [
                "<strong>5</strong>",
                "<strong>保单验证</strong>",
                "已出具的保单可以验证：在 Markel 网站 VERIFY_LINK 输入文件上的校验码，即可核实签名的原始性。",
                "需要时进行验证。",
              ],
            ],
            widths: ["5%", "19%", "48%", "28%"],
          },
          {
            t: "p",
            x: "草稿、付款和核对均按每 20 份保单一个批次进行：每个批次对应一份对账单。",
          },
        ],
      },
      {
        title: "联系方式",
        blocks: [
          { t: "contacts" },
          {
            t: "note",
            x: "本文件仅供参考：最终条件以保险公司出具的保单为准。",
          },
        ],
      },
    ],
  },
};

// Schermate del portale (interfaccia in cinese, dati di fantasia). `width` e' la larghezza nella pagina.
// SECTION_FIGURES: indice della sezione (da 0) → schermate che la illustrano, in ordine. Le sezioni senza
// una schermata corrispondente (assunzione del rischio, contatti) restano senza figura.
export const FIGURES = {
  detailHead: {
    file: "08a_pratica_testata.jpg",
    width: "74%",
    caption: {
      it: "Pratica VIES aperta dal portale: contraente, beneficiario, date e durata della garanzia (3 anni).",
      en: "A VIES application opened in the portal: policyholder, beneficiary, dates and term of the guarantee (3 years).",
      zh: "在门户中打开的 VIES 申请：投保人、受益人、日期和担保期限（3 年）。",
    },
  },
  detailSummary: {
    file: "08b_pratica_riepilogo.jpg",
    width: "70%",
    caption: {
      it: "Riepilogo della stessa pratica: dati del contraente e del rappresentante fiscale.",
      en: "Summary of the same application: policyholder and fiscal representative data.",
      zh: "同一申请的摘要：投保人和税务代表资料。",
    },
  },
  login: {
    file: "01_login.jpg",
    width: "46%",
    caption: {
      it: "Pagina di accesso del portale.",
      en: "Portal login page.",
      zh: "门户登录页面。",
    },
  },
  step1: {
    file: "02_vies_step1.jpg",
    width: "86%",
    caption: {
      it: "Pagina VIES, passaggio 1 «File del lotto»: modello Excel da scaricare e caricamento di Excel e ZIP.",
      en: "VIES page, step 1 \"Batch files\": Excel template to download and upload of the Excel and ZIP files.",
      zh: "VIES 页面，步骤 1“批次文件”：可下载的 Excel 模板，以及 Excel 和 ZIP 的上传。",
    },
  },
  step2: {
    file: "03_vies_step2.jpg",
    width: "62%",
    caption: {
      it: "Passaggio 2 «Dati del foglio»: beneficiario e rappresentante fiscale.",
      en: "Step 2 \"Sheet data\": beneficiary and fiscal representative.",
      zh: "步骤 2“表格公共信息”：受益人和税务代表。",
    },
  },
  step3: {
    file: "04_vies_step3.jpg",
    width: "62%",
    caption: {
      it: "Passaggio 3 «Controllo pratiche»: esito di ogni riga, «Pronta» o «Bloccata», con il motivo del blocco.",
      en: "Step 3 \"Application check\": result of each row, \"Ready\" or \"Blocked\", with the reason for a block.",
      zh: "步骤 3“申请审核”：每一行的结果“就绪”或“已阻止”，并说明阻止原因。",
    },
  },
  step4: {
    file: "05_vies_step4.jpg",
    width: "68%",
    caption: {
      it: "Passaggio 4 «Documenti obbligatori VIES»: mappa dei documenti presenti in ogni ZIP.",
      en: "Step 4 \"Required VIES documents\": map of the documents present in each ZIP.",
      zh: "步骤 4“VIES 必备文件”：每个 ZIP 中的文件对照表。",
    },
  },
  step5: {
    file: "06_vies_step5.jpg",
    width: "68%",
    caption: {
      it: "Passaggio 5 «Crea le pratiche»: il pulsante crea solo le pratiche pronte.",
      en: "Step 5 \"Create the applications\": the button creates only the ready applications.",
      zh: "步骤 5“创建申请”：该按钮只创建已就绪的申请。",
    },
  },
  list: {
    file: "07_pratiche_lista.jpg",
    width: "76%",
    caption: {
      it: "Menu «Pratiche»: elenco delle pratiche VIES con stato, ricerca e filtri.",
      en: "\"Applications\" menu: list of VIES applications with status, search and filters.",
      zh: "“业务申请”菜单：VIES 申请列表，含状态、搜索和筛选。",
    },
  },
  adminList: {
    file: "09_amministrazione_vies_lista.jpg",
    width: "72%",
    caption: {
      it: "Amministrazione → VIES: elenco dei rappresentanti fiscali.",
      en: "Accounting → VIES: list of fiscal representatives.",
      zh: "财务管理 → VIES：税务代表列表。",
    },
  },
  adminSummary: {
    file: "10_amministrazione_vies_riepilogo.jpg",
    width: "58%",
    caption: {
      it: "Riepilogo di un rappresentante fiscale: lotti Excel caricati, estratto conto in PDF e stato del pagamento.",
      en: "Summary of a fiscal representative: uploaded Excel batches, PDF statement and payment status.",
      zh: "税务代表汇总：已上传的 Excel 批次、PDF 对账单及付款状态。",
    },
  },
  statement: {
    file: "11_estratto_conto_dialog.jpg",
    width: "52%",
    caption: {
      it: "Estratto conto di un lotto: numero di polizze e premio totale da pagare, con generazione del PDF.",
      en: "Statement of a batch: number of policies and total premium due, with PDF generation.",
      zh: "批次对账单：保单数量和应付保费合计，并可生成 PDF。",
    },
  },
};

export const SECTION_FIGURES = {
  0: ["detailHead"],
  2: ["login"],
  3: ["step1"],
  4: ["step2", "step3", "step4", "step5"],
  5: ["list", "detailSummary", "adminList", "adminSummary"],
  6: ["statement"],
};
