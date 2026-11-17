// Testo dell'informativa privacy generale di Tecno Advance MGA Broker Srl (art. 13 GDPR), pubblicata dal sito
// aziendale in /documenti/informativa-privacy.pdf. Si modifica qui e si rigenera il PDF con
//   node scripts/legal/build-privacy-notice.mjs
//
// Base: la versione di dicembre 2025 pubblicata sul vecchio sito WordPress. Il 17/11/2026, su indicazione del
// titolare ("ci deve stare solo Tecno MGA", "l'Avv. Maugeri non c'entra nulla con noi", recapito sempre
// info@tecnomga.com), sono state tolte le parti che non riguardano Tecno MGA e corretti i dati sbagliati:
// - App, account personale e invio tramite App (erano dell'app Helpet);
// - il rimando al sito www.tecnoinsurance.com (oggi reindirizza a tecnomga.com);
// - la lettera d sulla cessione di dati anonimizzati per ricerca scientifica ed epidemiologica (era di Helpet);
// - i contitolari del trattamento: il titolare e' solo Tecno Advance MGA Broker Srl;
// - il nome del DPO e le caselle privacy@ e dpo@: unico recapito info@tecnomga.com;
// - "Privacy Shield", annullato dalla Corte di giustizia UE il 16/07/2020 (causa C-311/18): ora Data Privacy
//   Framework UE-USA, come nelle pagine Privacy dei siti;
// - il CAP della sede legale nel punto 8 (00197 invece di 00198) e i rimandi a punti che non esistevano.
// Il resto del testo e' quello della versione di dicembre 2025.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Il PDF pubblicato dal sito aziendale. */
export const NOTICE_FILE = resolve(HERE, "../../sites/tecnomga/public/documenti/informativa-privacy.pdf");

export const NOTICE_TITLE = "Informativa per il trattamento dei dati personali · Tecno Advance MGA Broker Srl";
export const NOTICE_VERSION = "Versione Novembre 2026";

/** Recapiti per la carta intestata. */
export const COMPANY = {
  name: "Tecno Advance MGA Broker Srl",
  rui: "B000746484",
  vat: "17460381001",
  legal: "Via Po, 102 - 00198 Roma",
  office: "Via Michele Mercati, 18 - 00197 Roma",
  tel: "06.97638088",
  email: "info@tecnomga.com",
  pec: "tecnoadvancemgabroker@legalmail.it",
  web: "tecnomga.com",
};

const CONTROLLER = "Titolare del Trattamento";

/**
 * Il documento, blocco per blocco: { h } titolo di punto, { p } paragrafo, { ul } elenco puntato,
 * { ol } elenco con lettere ({ label, text }).
 */
export const NOTICE = [
  { title: "INFORMATIVA PER IL TRATTAMENTO DEI DATI PERSONALI EX ART. 13 GDPR 2016/679" },
  {
    p: "Tecno Advance MGA Broker Srl, con sede legale in Via Po 102, 00198 Roma (Italy), con P. IVA 17460381001, in qualità di titolare del trattamento dei dati (in seguito “Titolare”), fornisce qui di seguito l'informativa privacy ai sensi dell'art. 13 del Regolamento UE 2016/679 del 27 aprile 2016 (di seguito, “Regolamento” o GDPR) e La informa che i Suoi dati saranno trattati con le modalità e per le finalità di seguito descritte.",
  },
  { h: "1. Oggetto del trattamento" },
  {
    p: "Il Titolare tratta i dati personali, quali es. immagini, nominativo, email, numero telefonico, indirizzo postale, riferimenti di sistemi di pagamento (in seguito “Dati”) da Lei forniti in occasione dell'acquisto o la sottoscrizione di servizi o, in genere, del rapporto contrattuale in essere col Titolare.",
  },
  { h: "2. Finalità e base giuridica del trattamento" },
  {
    p: "I Suoi Dati personali sono trattati, senza Suo previo consenso (art. 6 lett. b), c) GDPR), per le sole finalità di gestione e l'esecuzione di rapporti precontrattuali e contrattuali; degli adempimenti connessi alla gestione amministrativa e contabile; degli obblighi previsti da leggi, regolamenti o dalla normativa Comunitaria ovvero imposti dalle Autorità; per la tutela dei diritti del Titolare in sede giudiziaria e gestione degli eventuali contenziosi; per la prevenzione e repressione di atti illeciti.",
  },
  { h: "2.1 Ulteriori finalità del trattamento" },
  {
    p: "I dati raccolti, Suo previo consenso libero ed esplicito (art. 6 lett. a GDPR), potranno essere utilizzati anche per le ulteriori finalità indicate di seguito ai termini e alle condizioni ivi precisate:",
  },
  {
    ol: [
      {
        label: "a.",
        text: "I Suoi Dati personali sono trattati previo consenso (art. 9 comma 2) per le finalità di gestione e l'esecuzione di rapporti precontrattuali e contrattuali; degli adempimenti connessi alla gestione amministrativa e contabile; degli obblighi previsti da leggi, regolamenti o dalla normativa Comunitaria ovvero imposti dalle Autorità; per la tutela dei diritti del Titolare in sede giudiziaria e gestione degli eventuali contenziosi; per la prevenzione e repressione di atti illeciti.",
      },
      {
        label: "b.",
        text: "Marketing: per inviarLe newsletters, materiale promozionale e comunicazioni commerciali, attraverso modalità di contatto sia automatizzate (es. e-mail, SMS, MMS) che tradizionali (posta cartacea e chiamate non pre registrate) anche da parte dei nostri partner commerciali.",
      },
      {
        label: "c.",
        text: "Profilazione: per finalità di profilazione, ossia per analizzare o prevedere, grazie ad algoritmi ed altri sistemi automatizzati, le sue potenziali abitudini, le scelte di consumo, le preferenze personali, gli interessi, la situazione economica, l'affidabilità, il comportamento, l'ubicazione, per poterle offrire prodotti e servizi sempre più adatti ai suoi reali interessi ed esigenze e poter elaborare offerte e comunicazioni commerciali personalizzate.",
      },
    ],
  },
  { h: "3. Modalità del trattamento e Conservazione" },
  {
    p: "Il trattamento sarà effettuato per mezzo delle operazioni indicate all'art. 4 GDPR e potrà avvenire sia mediante sistemi informatici (cloud, Internet, intranet, computer e dispositivi mobili) e processi automatizzati, sia in modalità cartacea (archivi).",
  },
  {
    p: "Nel rispetto di quanto previsto dall'art. 5 comma 1 lett. e) del Reg. UE 2016/679, i dati personali raccolti verranno conservati in una forma che consenta l'identificazione degli interessati per un arco di tempo non superiore al conseguimento delle finalità per le quali i dati personali sono trattati; i dati personali possono essere conservati per periodi più lunghi a condizione che siano trattati esclusivamente a fini di archiviazione nel pubblico interesse, di ricerca scientifica o storica o a fini statistici, conformemente all'articolo 89, paragrafo 1, fatte salve l'attuazione di misure tecniche e organizzative adeguate come richieste dal presente regolamento a tutela dei diritti e delle libertà dell'interessato.",
  },
  {
    p: `Alla luce di tale principio, i suoi Dati Personali saranno trattati dal ${CONTROLLER} limitatamente a quanto necessario per il perseguimento delle finalità di cui al punto 2 della presente Informativa. In particolare, i suoi Dati Personali saranno trattati per un periodo di tempo pari al minimo necessario, ossia fino a dieci anni dalla cessazione dei rapporti contrattuali in essere tra Lei ed il ${CONTROLLER}, fatto salvo un ulteriore periodo di conservazione che potrà essere imposto o consentito da norme di legge.`,
  },
  {
    p: `Relativamente ai trattamenti svolti per il conseguimento delle finalità di cui al punto 2.1 della presente Informativa, il ${CONTROLLER} potrà lecitamente trattare i suoi Dati Personali fino a quando non comunicherà, in una delle modalità previste dalla presente Informativa, la sua volontà di revocare il consenso ad una o tutte le finalità per le quali Le è stato chiesto e/o di opporsi al trattamento. L'eventuale revoca del consenso o l'esercizio del diritto di opposizione imporranno, di fatto, al ${CONTROLLER} di cessare le attività di Trattamento dei suoi Dati Personali per tali finalità.`,
  },
  { h: "4. Natura del conferimento dei Dati e conseguenze del rifiuto" },
  {
    p: "Il conferimento dei dati personali di cui al punto 1 della presente Informativa è necessario per l'esecuzione del rapporto contrattuale e degli obblighi derivanti dagli adempimenti di legge, regolamenti o dalla normativa comunitaria; l'eventuale rifiuto comporta l'impossibilità dell'erogazione totale o parziale dei servizi o prestazioni richieste.",
  },
  {
    p: "Resta inteso che, laddove Lei non voglia prestare il suo consenso al trattamento dei suoi dati per le finalità di cui al punto 2.1, questo non Le impedirà di accedere al sito web.",
  },
  { h: "5. Accesso ai Dati" },
  { p: "I suoi Dati Personali potranno essere comunicati a specifici soggetti considerati destinatari di tali Dati Personali, come definito dall'art. 4 al punto 9." },
  { p: "In tale ottica potranno trovarsi nella condizione di trattare i suoi Dati Personali i seguenti Destinatari:" },
  {
    ul: [
      "Singoli individui, dipendenti e/o collaboratori del Titolare nella loro qualità di incaricati del trattamento e/o referenti interni del trattamento e/o amministratori di sistema;",
      `soggetti terzi che svolgono parte delle attività di Trattamento e/o attività connesse e strumentali alle stesse per conto del ${CONTROLLER}. Tali soggetti sono stati nominati responsabili del trattamento, dovendosi intendere singolarmente con tale locuzione, a norma dell'articolo 4 al punto 8) del Regolamento;`,
      "Soggetti terzi che svolgono attività di Trattamento e/o attività connesse e strumentali alle stesse in qualità di titolari autonomi del trattamento, ivi incluse a titolo esemplificativo e non esaustivo società di consulenza, liberi professionisti, Istituti di Credito, Compagnie di Assicurazione, società terze e/o facenti parte del Titolare.",
      "Ove richiesto per legge o per prevenire o reprimere la commissione di un reato i suoi Dati Personali potranno essere comunicati ad Enti Pubblici o all'Autorità Giudiziaria senza che questi vengano definiti come Destinatari.",
    ],
  },
  { h: "6. Comunicazione dei Dati" },
  {
    p: "Senza Suo espresso consenso (ex art. 6 lett. b, c GDPR), il Titolare potrà comunicare i Suoi Dati ad Enti Pubblici per ottemperare agli obblighi previsti da leggi, regolamenti o dalla normativa Comunitaria ovvero imposti dalle Autorità, che li tratteranno nella loro qualità di titolari autonomi del trattamento.",
  },
  {
    p: "Potranno essere altresì comunicati a Soggetti Terzi (ad esempio, partner e aziende clienti), che tratteranno i dati per lo svolgimento di attività strumentali ai servizi richiesti e alle finalità di cui sopra.",
  },
  {
    p: "In genere i fornitori di servizi prescelti operano tramite data center localizzati sul territorio dell'Unione Europea. Nel caso i suoi dati saranno oggetto di trasferimento fuori dallo Spazio Economico Europeo (SEE), anche per finalità di gestione tecnica dei dati raccolti, questo avverrà esclusivamente nel pieno rispetto del GDPR, verso imprese certificate secondo il Data Privacy Framework UE-USA o Paesi terzi con riconosciute specifiche garanzie di adeguatezza dalla Commissione europea o siano fornite adeguate garanzie di tutela dei dati personali per mezzo di accordi o clausole contrattuali (fra cui le norme vincolanti d'impresa - BCR, e clausole contrattuali tipo).",
  },
  { h: "7. Diritti dell'interessato" },
  { p: "In ogni momento potrà esercitare i Suoi diritti nei confronti del titolare del trattamento, ai sensi degli artt. 15-22 del Regolamento UE 2016/679, ed in particolare:" },
  {
    ul: [
      `Diritto di accesso: avrà diritto, a norma dell'articolo 15, paragrafo 1 del Regolamento, di ottenere dal ${CONTROLLER} la conferma che sia o meno in corso un Trattamento dei suoi Dati Personali.`,
      "Diritto di rettifica: potrà ottenere a norma dell'articolo 16 del Regolamento, la rettifica dei suoi Dati Personali che risultino inesatti. Tenuto conto delle finalità del Trattamento, inoltre, potrà ottenere l'integrazione dei suoi Dati Personali che risultino incompleti, anche fornendo una dichiarazione integrativa.",
      `Diritto di cancellazione: potrà ottenere, a norma dell'articolo 17, paragrafo 1 del Regolamento, la cancellazione dei suoi Dati Personali senza ingiustificato ritardo ed il ${CONTROLLER} avrà l'obbligo di cancellare i suoi Dati Personali. In alcuni casi, come previsto dall'articolo 17, paragrafo 3 del Regolamento, il ${CONTROLLER} è legittimato a non provvedere alla cancellazione dei suoi Dati Personali qualora il loro Trattamento sia necessario, ad esempio, per l'esercizio del diritto alla libertà di espressione e d'informazione, per l'adempimento di un obbligo di legge, per motivi di interesse pubblico, per fini di archiviazione nel pubblico interesse, di ricerca scientifica o storica o a fini statistici, per l'accertamento, l'esercizio o la difesa di un diritto in sede giudiziaria.`,
      `Diritto alla limitazione del trattamento: potrà ottenere la limitazione del Trattamento, a norma dell'articolo 18 del Regolamento, nel caso in cui ricorra una delle seguenti ipotesi: a) ha contestato l'esattezza dei suoi Dati Personali (la limitazione si protrarrà per il periodo necessario al ${CONTROLLER} per verificare l'esattezza di tali Dati Personali); b) il Trattamento è illecito ma si è opposto alla cancellazione dei suoi Dati Personali chiedendone, invece, che ne sia limitato l'utilizzo; c) benché il ${CONTROLLER} non ne abbia più bisogno ai fini del Trattamento, i suoi Dati Personali servono per l'accertamento, l'esercizio o la difesa di un diritto in Sede Giudiziaria; d) si è opposto al Trattamento ai sensi dell'articolo 21, paragrafo 1, del Regolamento e si è in attesa della verifica in merito all'eventuale prevalenza dei motivi legittimi del ${CONTROLLER} rispetto ai suoi. In caso di limitazione del Trattamento, i suoi Dati Personali saranno trattati, salvo che per la conservazione, soltanto con il suo consenso, o per l'accertamento, l'esercizio o la difesa di un diritto in Sede Giudiziaria oppure per tutelare i diritti di un'altra persona fisica o giuridica o per motivi di interesse pubblico rilevante. La informeremo, in ogni caso, prima che tale limitazione venga revocata.`,
      `Diritto alla portabilità dei dati: potrà, in qualsiasi momento, richiedere e ricevere, a norma dell'articolo 20, paragrafo 1 del Regolamento, tutti i suoi Dati Personali trattati dal ${CONTROLLER} in un formato strutturato, di uso comune e leggibile oppure richiederne la trasmissione ad altro titolare del trattamento senza impedimenti. In questo caso, sarà sua cura fornirci tutti gli estremi esatti del nuovo titolare del trattamento a cui intende trasferire i suoi Dati Personali fornendoci autorizzazione scritta.`,
      "Diritto di opposizione: a norma dell'articolo 21 del Regolamento potrà opporsi, in qualsiasi momento, al Trattamento dei suoi Dati Personali a) qualora questi vengano trattati per finalità di marketing, compresa la profilazione nella misura in cui sia connessa a tale marketing, o b) per motivi connessi alla sua situazione particolare, qualora i suoi Dati Personali vengano trattati sulla base del legittimo interesse del Titolare o di terzi, salvo che esistano motivi legittimi cogenti per procedere al Trattamento che prevalgono sui suoi interessi, diritti e libertà o che il Trattamento sia necessario per l'accertamento, l'esercizio o la difesa di un diritto in sede giudiziale.",
    ],
  },
  { p: `Per esercitare tutti i suoi diritti come sopra identificati, Le basterà contattare il ${CONTROLLER} con le modalità indicate al punto 8 della presente Informativa.` },
  { p: "Le ricordiamo che, in qualsiasi momento, potrà rivolgersi anche al DPO della Società Tecno Advance MGA Broker Srl nelle modalità previste dal punto 8 della presente Informativa." },
  {
    p: `Inoltre, ha il diritto di proporre un reclamo all'autorità di controllo: fatto salvo il suo diritto di ricorrere in ogni altra Sede Amministrativa o Giurisdizionale, qualora ritenesse che il Trattamento dei suoi Dati Personali, condotto dal ${CONTROLLER}, avvenga in violazione del Regolamento e/o della normativa applicabile potrà proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali o altra autorità di controllo competente.`,
  },
  { h: "8. Responsabile della protezione dei dati personali (DPO)" },
  { p: `Il ${CONTROLLER} può essere contattato tramite i seguenti canali:` },
  {
    ul: [
      "scrivendo all'ufficio Privacy della società Tecno Advance MGA Broker Srl, Via Po 102, 00198 Roma (RM);",
      "inviando una e-mail alla casella di posta elettronica info@tecnomga.com alla cortese attenzione dell'Ufficio Privacy.",
    ],
  },
  {
    p: `Inoltre, al fine di agevolare i rapporti tra Lei, quale soggetto interessato, ossia la “persona fisica identificata o identificabile” cui si riferiscono i Dati Personali ai sensi dell'articolo 4 al punto 1 del Regolamento ed il ${CONTROLLER}, il Regolamento ha previsto, in alcuni specifici casi, la nomina di una figura di controllo e supporto che, tra i vari compiti affidati, agisca anche come punto di contatto con l'Interessato. La società Tecno Advance MGA Broker Srl ha adottato tale figura di “Responsabile della Protezione dei Dati”, c.d. “Data Protection Officer”, nominata a norma dell'articolo 37 del Regolamento (nel seguito il “DPO”).`,
  },
  { p: "Il DPO, ai sensi e per gli effetti di cui all'articolo 39 del Regolamento, è chiamato a svolgere, inter alia, le seguenti attività:" },
  {
    ul: [
      `informare e fornire consulenza al ${CONTROLLER}, al responsabile del trattamento nonché ai dipendenti che eseguono il Trattamento in merito agli obblighi derivanti dal Regolamento nonché da altre disposizioni dell'Unione Europea o degli Stati membri relative alla protezione dei Dati Personali;`,
      `monitorare e vigilare l'osservanza del Regolamento, delle normative applicabili in materia di protezione dei Dati Personali nonché delle Condizioni Generali e procedure adottate dal ${CONTROLLER};`,
      "fornire supporto nei riscontri all'Interessato;",
      "cooperare con l'Autorità Garante per la Protezione dei Dati Personali o altra Autorità di Controllo competente.",
    ],
  },
  {
    p: "Come previsto dall'articolo 38 del Regolamento, potrà liberamente contattare il DPO per tutte le questioni relative al Trattamento dei suoi Dati Personali e/o nel caso volesse esercitare i suoi diritti come previsti dal punto 7 della presente Informativa, inviando una comunicazione scritta all'indirizzo di posta elettronica info@tecnomga.com.",
  },
  {
    p: `In qualsiasi momento potrà consultare la sezione “Privacy” del sito internet tecnomga.com, all'interno della quale troverà tutte le informazioni concernenti l'utilizzo ed il Trattamento dei suoi Dati Personali, i riferimenti dettagliati della società, informazioni aggiornate in merito ai contatti ed ai canali di comunicazione resi disponibili a tutti gli Interessati da parte del ${CONTROLLER}.`,
  },
  { version: NOTICE_VERSION },
];

/** Il testo del documento, un blocco per riga: e' quello che il PDF contiene, e la sua impronta va nel PDF. */
export function noticeText() {
  return NOTICE.map((block) => {
    if (block.title) return block.title;
    if (block.h) return block.h;
    if (block.p) return block.p;
    if (block.ul) return block.ul.map((item) => `• ${item}`).join("\n");
    if (block.ol) return block.ol.map((item) => `${item.label} ${item.text}`).join("\n");
    return block.version;
  }).join("\n");
}

const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Il corpo HTML del documento, per la stampa in PDF. */
export function noticeHtml() {
  return NOTICE.map((block) => {
    if (block.title) return `<h1>${escape(block.title)}</h1>`;
    if (block.h) return `<h2>${escape(block.h)}</h2>`;
    if (block.p) return `<p>${escape(block.p)}</p>`;
    if (block.ul) return `<ul>${block.ul.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
    if (block.ol) return `<ol>${block.ol.map((item) => `<li><b>${escape(item.label)}</b> ${escape(item.text)}</li>`).join("")}</ol>`;
    return `<p class="version">${escape(block.version)}</p>`;
  }).join("\n");
}
