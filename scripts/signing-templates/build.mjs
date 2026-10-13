// Genera i modelli dei documenti da firmare su carta intestata Tecno Advance MGA Broker Srl:
// informativa privacy e consensi, MUP (Allegato 3 al Reg. IVASS 40/2018) e questionario antiriciclaggio.
//
//   node scripts/signing-templates/build.mjs [cartella-di-uscita]     (predefinita: public/modelli-firma)
//
// I testi stanno in questo file: si modificano qui e si rigenerano i PDF. I file prodotti si caricano in
// Impostazioni > Documenti da firmare (nomi: privacy.pdf, mup.pdf, antiriciclaggio.pdf).
// Richiede Chromium di Playwright.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(process.argv[2] ?? resolve(HERE, "../../public/modelli-firma"));
const LOGO = `data:image/png;base64,${readFileSync(resolve(HERE, "../vies-template/logo.png")).toString("base64")}`;
const NAVY = "#1a2547";

// Riferimenti dell'intermediario (carta intestata).
const CO = {
  name: "Tecno Advance MGA Broker Srl",
  web: "www.tecnoinsurance.com",
  rui: "B000746484",
  vat: "17460381001",
  legal: "Via Po, 102 - 00198 Roma",
  office: "Via Michele Mercati, 18 - 00197 Roma",
  tel: "06.97638088",
  pec: "tecnoadvancemgabroker@legalmail.it",
};

const CSS = `
  @page { size: A4; margin: 27mm 16mm 21mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif; font-size: 9pt; line-height: 1.42; color: #1f2733; margin: 0; }
  h1 { font-size: 15pt; color: ${NAVY}; margin: 0 0 4px; line-height: 1.2; }
  .sub { color: #4b5563; font-size: 8.6pt; margin: 0 0 10px; }
  h2 { font-size: 10.5pt; color: ${NAVY}; margin: 14px 0 5px; padding: 3px 0 3px; border-bottom: 1.2px solid ${NAVY}; break-after: avoid; }
  h3 { font-size: 9.4pt; color: ${NAVY}; margin: 10px 0 3px; break-after: avoid; }
  p { margin: 0 0 6px; text-align: left; hyphens: auto; }
  ul { margin: 0 0 6px; padding-left: 18px; } li { margin: 1px 0; }
  .box { border: 1px solid #b8c1d3; background: #f6f8fb; padding: 6px 9px; margin: 6px 0 8px; border-radius: 3px; break-inside: avoid; }
  .lead { margin-bottom: 2px; break-after: avoid; }
  .note { font-size: 8pt; color: #4b5563; }
  .row { display: flex; gap: 10px; margin: 4px 0; align-items: flex-end; }
  .row > * { flex: 1; }
  .fld { display: block; }
  .fld small { display: block; font-size: 7.2pt; color: #6b7280; text-transform: uppercase; letter-spacing: .02em; }
  a.k { display: block; text-decoration: none; color: inherit; }
  .fld i { display: block; border-bottom: 1px solid #1f2733; min-height: 15px; }
  .w2 { flex: 2; } .w3 { flex: 3; } .w05 { flex: .5; }
  .cb { display: inline-block; width: 9px; height: 9px; border: 1px solid #1f2733; margin-right: 5px; vertical-align: -1px; }
  .opt { display: block; margin: 2px 0 2px 0; padding-left: 15px; text-indent: -15px; }
  .opts { margin: 3px 0 6px; }
  .opts .opt { display: inline-block; margin-right: 14px; }
  .sig { display: flex; gap: 24px; margin-top: 22px; break-inside: avoid; }
  .sig > div { flex: 1; border-top: 1px solid #1f2733; padding-top: 3px; font-size: 8pt; color: #4b5563; }
  .pb { break-before: page; }
  .keep { break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; font-size: 8.4pt; }
  th { background: ${NAVY}; color: #fff; text-align: left; padding: 3px 6px; }
  td { padding: 3px 6px; border-bottom: 1px solid #dfe5ef; vertical-align: top; }
`;

// Un campo con `key` e' precompilabile: il suo riquadro viene registrato in fields.json (vedi piu' sotto).
const KEY_URL = "https://prefill.invalid/";
const f = (label, cls = "", key = "") =>
  `<span class="fld ${cls}"><small>${label}</small>${key ? `<a class="k" href="${KEY_URL}${key}"><i></i></a>` : "<i></i>"}</span>`;
const row = (...cells) => `<div class="row">${cells.join("")}</div>`;
const cb = (text) => `<span class="opt"><span class="cb"></span>${text}</span>`;
const opts = (...items) => `<div class="opts">${items.map(cb).join("")}</div>`;
const stack = (...items) => `<div class="opts">${items.map(cb).join("")}</div>`.replace(/class="opts"/, 'class="opts" style="display:block"');
const policyLine = row(f("Pratica / Polizza n.", "w2", "pratica"), f("Contraente", "w3", "contraente"), f("Codice fiscale / P.IVA", "w2", "cf"));
const sign = (...captions) => `<div class="sig">${captions.map((c) => `<div>${c}</div>`).join("")}</div>`;
const placeDate = row(f("Luogo"), f("Data"));

// ---------------------------------------------------------------------------------------------------
// 1. INFORMATIVA PRIVACY E CONSENSI
// ---------------------------------------------------------------------------------------------------
const privacy = `
<h1>Informativa sul trattamento dei dati personali e consensi</h1>
<p class="sub">Artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) · Clienti, contraenti, assicurati, beneficiari e loro rappresentanti</p>
${policyLine}

<p>Gentile Cliente, ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (di seguito “GDPR”) La informiamo che, per effetto della richiesta di un preventivo, della sottoscrizione di una polizza assicurativa o dello svolgimento del relativo rapporto, <b>${CO.name}</b>, in qualità di intermediario assicurativo, tratta alcuni dati personali che riguardano Lei, la società che Lei rappresenta e le altre persone coinvolte nel contratto (assicurato, beneficiario, titolari effettivi). I dati sono trattati secondo i principi di correttezza, liceità, trasparenza, minimizzazione e riservatezza.</p>

<h2>1. Titolare del trattamento e contatti</h2>
<p>Titolare del trattamento è <b>${CO.name}</b>, sede legale in ${CO.legal}, sede operativa in ${CO.office}, iscritta al Registro Unico degli Intermediari (RUI) con il n. ${CO.rui}, P.IVA ${CO.vat}. Per ogni richiesta relativa ai dati personali: PEC <b>${CO.pec}</b>, tel. ${CO.tel}, oppure lettera presso la sede legale all’attenzione del Servizio Privacy. Sito: ${CO.web}.</p>
<p>Il Responsabile della protezione dei dati (DPO) può essere contattato all’indirizzo PEC <b>${CO.pec}</b>.</p>

<h2>2. Categorie di dati trattati</h2>
<ul>
<li><b>dati comuni</b>: anagrafici e identificativi, codice fiscale e partita IVA, recapiti (telefono, e-mail, PEC), dati dell’impresa, dati del rappresentante e dei poteri di firma (procura), estremi del documento di identità;</li>
<li><b>dati economici e di pagamento</b>: premio, modalità e coordinate di pagamento, dati fiscali e contabili, informazioni sulla situazione economica necessarie all’adeguata verifica;</li>
<li><b>dati di categorie particolari</b> (art. 9 GDPR, per esempio relativi alla salute) e <b>dati giudiziari</b> (art. 10), solo quando strettamente necessari alla copertura richiesta, alla gestione di un sinistro o agli obblighi antifrode e antiriciclaggio;</li>
<li><b>dati di terzi</b> che Lei ci fornisce (assicurato, beneficiario, titolari effettivi): è Suo onere informare tali persone e, ove necessario, acquisirne il consenso.</li>
</ul>
<p>I dati sono raccolti direttamente presso di Lei o presso soggetti terzi inerenti al rapporto (imprese di assicurazione, altri intermediari, rappresentante fiscale o delegato, banche dati e registri pubblici, società di informazione commerciale).</p>

<h2>3. Finalità e basi giuridiche del trattamento</h2>
<table>
<tr><th style="width:62%">Finalità</th><th>Base giuridica</th></tr>
<tr><td>a) attività di intermediazione e consulenza: rilevazione delle esigenze assicurative, valutazione di adeguatezza, preventivo, proposta e conclusione del contratto, servizi connessi o accessori</td><td>Esecuzione del contratto o di misure precontrattuali richieste dall’interessato (art. 6.1.b)</td></tr>
<tr><td>b) gestione ed esecuzione del rapporto: emissione e rinnovo della polizza, incasso e regolazione dei premi, gestione dei sinistri, assistenza e riscontro a richieste e reclami</td><td>Esecuzione del contratto (art. 6.1.b)</td></tr>
<tr><td>c) obblighi di legge e di vigilanza: normativa assicurativa e IVASS, adeguata verifica e antiriciclaggio (D.Lgs. 231/2007), obblighi fiscali e contabili, richieste di Autorità</td><td>Obbligo di legge (art. 6.1.c)</td></tr>
<tr><td>d) prevenzione e individuazione delle frodi assicurative; tutela dei diritti in sede giudiziaria; sicurezza dei sistemi informatici; analisi statistiche e di portafoglio</td><td>Legittimo interesse del Titolare (art. 6.1.f)</td></tr>
<tr><td>e) trattamento dei dati di categorie particolari per le finalità a) e b)</td><td>Consenso esplicito (art. 9.2.a) o, ove ricorra, necessità di far valere un diritto in sede giudiziaria</td></tr>
<tr><td>f) comunicazioni commerciali e promozionali sui prodotti e servizi del Titolare; indagini di soddisfazione</td><td>Consenso, separato per ogni finalità (art. 6.1.a)</td></tr>
<tr><td>g) profilazione per marketing: analisi dei dati per proporre offerte personalizzate</td><td>Consenso specifico (art. 6.1.a)</td></tr>
</table>
<p>Il conferimento dei dati per le finalità a), b), c) è necessario: il rifiuto rende impossibile intermediare e gestire il contratto. Il conferimento per le finalità f) e g) è facoltativo e il rifiuto non ha alcuna conseguenza sul rapporto assicurativo.</p>

<h2>4. Modalità del trattamento</h2>
<p>Il trattamento avviene con strumenti cartacei, informatici e telematici, con logiche strettamente correlate alle finalità indicate e con misure tecniche e organizzative adeguate a garantire sicurezza e riservatezza. I dati non sono diffusi. Non è adottato alcun processo decisionale esclusivamente automatizzato che produca effetti giuridici sull’interessato.</p>

<h2>5. Destinatari dei dati</h2>
<p>I dati possono essere comunicati, secondo i casi e per le sole finalità indicate, ad altri soggetti della cosiddetta “catena assicurativa”, che li trattano come autonomi titolari o come responsabili del trattamento: imprese di assicurazione e di riassicurazione, coassicuratori, altri intermediari e collaboratori, rappresentanti fiscali e soggetti delegati, periti, medici, legali e consulenti, società di servizi informatici, di archiviazione e di gestione dei pagamenti, banche, società di recupero crediti e di controllo delle frodi, organismi associativi e consortili del settore assicurativo. I dati possono inoltre essere comunicati alle Autorità e agli enti pubblici a ciò legittimati (tra cui IVASS, UIF, Agenzia delle Entrate, Autorità Giudiziaria e Forze dell’ordine). Il personale del Titolare li tratta in qualità di soggetto autorizzato. L’elenco aggiornato dei responsabili è disponibile a richiesta.</p>

<h2>6. Trasferimento dei dati all’estero</h2>
<p>I dati sono trattati all’interno dello Spazio Economico Europeo. Un trasferimento verso Paesi terzi può avvenire solo se la Commissione europea ha emesso una decisione di adeguatezza o, in mancanza, con le clausole contrattuali standard approvate dalla Commissione e le garanzie supplementari necessarie.</p>

<h2>7. Periodo di conservazione</h2>
<ul>
<li>dati contrattuali: per la durata del rapporto e, dopo la sua cessazione, per il tempo necessario ad adempiere agli obblighi di legge e a far valere o difendere diritti (di regola dieci anni, tenuto conto dei termini di prescrizione e dell’art. 2220 c.c.);</li>
<li>documentazione di adeguata verifica antiriciclaggio: dieci anni dalla fine del rapporto (art. 31 D.Lgs. 231/2007);</li>
<li>dati per marketing: fino alla revoca del consenso e comunque non oltre 24 mesi dalla cessazione del rapporto; dati per profilazione: non oltre 12 mesi.</li>
</ul>
<p>Decorsi i termini i dati sono cancellati o resi anonimi.</p>

<h2>8. Diritti dell’interessato</h2>
<p>Lei può chiedere al Titolare, in ogni momento e nei limiti previsti dal GDPR: l’accesso ai dati (art. 15); la rettifica o l’integrazione (art. 16); la cancellazione (art. 17); la limitazione del trattamento (art. 18); la portabilità dei dati forniti (art. 20); di opporsi al trattamento fondato sul legittimo interesse e, sempre, al marketing diretto (art. 21). Ove il trattamento si basi sul consenso, può revocarlo in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente. Le richieste vanno inviate alla PEC <b>${CO.pec}</b> o alla sede legale.</p>
<h2>9. Reclamo all’Autorità di controllo</h2>
<p>Fatto salvo ogni altro ricorso, Lei ha il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it) se ritiene che il trattamento violi il GDPR.</p>
<h2>10. Aggiornamenti</h2>
<p>La presente informativa può essere integrata o aggiornata, anche a seguito di modifiche normative; la versione vigente è comunicata ai clienti con le modalità previste dalla legge.</p>

<div class="pb"></div>
<h1>Dichiarazione di presa visione e consensi</h1>
<p class="sub">Da compilare e firmare dal Contraente o dal suo rappresentante munito di procura</p>
${policyLine}
<div class="row">${f("Il/La sottoscritto/a (cognome e nome)", "w3", "firmatario")}${f("Codice fiscale", "w2", "firmatario_cf")}</div>
<div class="row">${f("in qualità di (rappresentante legale / procuratore speciale / altro)", "w3", "qualita")}${f("della società", "w3", "contraente")}</div>
<p>dichiara di aver ricevuto e letto l’informativa che precede, resa da ${CO.name} ai sensi degli artt. 13 e 14 del GDPR, anche per conto delle persone di cui ha fornito i dati.</p>

<h3>A. Dati di categorie particolari (art. 9 GDPR) · finalità a) e b)</h3>
<p>Presto il consenso al trattamento dei dati di categorie particolari necessari all’intermediazione e alla gestione del contratto e dei sinistri. Il mancato consenso può impedire la conclusione o la gestione del contratto per le coperture che li richiedono.</p>
${opts("DO il consenso", "NEGO il consenso")}
<h3>B. Marketing diretto · finalità f)</h3>
<p>Presto il consenso a ricevere comunicazioni promozionali e commerciali dal Titolare, con modalità tradizionali (posta, telefono con operatore) e automatizzate (e-mail, SMS, messaggistica).</p>
${opts("DO il consenso", "NEGO il consenso")}
<h3>C. Indagini di soddisfazione e ricerche di mercato · finalità f)</h3>
${opts("DO il consenso", "NEGO il consenso")}
<h3>D. Profilazione per marketing · finalità g)</h3>
<p>Presto il consenso all’analisi dei miei dati per ricevere offerte personalizzate.</p>
${opts("DO il consenso", "NEGO il consenso")}
<h3>E. Comunicazione a terzi per le loro finalità commerciali</h3>
<p>Presto il consenso alla comunicazione dei miei dati a società partner del Titolare per l’invio di loro proposte commerciali.</p>
${opts("DO il consenso", "NEGO il consenso")}
<p class="note">I consensi B–E sono facoltativi e indipendenti l’uno dall’altro; possono essere modificati o revocati in ogni momento scrivendo alla PEC ${CO.pec}.</p>
${placeDate}
${sign("Firma del Contraente o del rappresentante con procura (leggibile) e timbro", `Per ricevuta · ${CO.name}`)}
`;

// ---------------------------------------------------------------------------------------------------
// 2. MUP - ALLEGATO 3 AL REGOLAMENTO IVASS N. 40/2018
// ---------------------------------------------------------------------------------------------------
const mup = `
<h1>Allegato 3 · Modulo Unico Precontrattuale (MUP) per i prodotti assicurativi</h1>
<p class="sub">Regolamento IVASS n. 40 del 2 agosto 2018 · art. 120-quater del Codice delle Assicurazioni Private</p>
<div class="box"><p style="margin:0">Il distributore ha l’obbligo di consegnare o trasmettere al contraente il presente Modulo prima della sottoscrizione della proposta o del contratto di assicurazione. Il documento può essere fornito con modalità non cartacea se appropriato e il contraente lo consente.</p></div>
${policyLine}

<h2>Sezione I · Informazioni generali sul distributore che entra in contatto con il contraente</h2>
<div class="box"><b>Gli estremi identificativi e di iscrizione dell’intermediario possono essere verificati consultando il Registro Unico degli Intermediari (RUI) sul sito internet dell’IVASS: www.ivass.it.</b></div>
<table>
<tr><td style="width:36%"><b>Denominazione</b></td><td>${CO.name} · società di intermediazione assicurativa</td></tr>
<tr><td><b>Iscrizione al RUI</b></td><td>n. ${CO.rui} · sezione B (Broker) · iscritta il 29/02/2024 · attività assicurativa · operativa</td></tr>
<tr><td><b>Legale rappresentante e responsabile dell’attività di intermediazione</b></td><td>Barbara Santoro · RUI n. B000614489, sezione B (Broker), iscritta dal 20/11/2018 · in carica dal 29/02/2024</td></tr>
<tr><td><b>Sede legale</b></td><td>${CO.legal}</td></tr>
<tr><td><b>Sede operativa</b></td><td>${CO.office}</td></tr>
<tr><td><b>Recapiti</b></td><td>Tel. ${CO.tel} · PEC ${CO.pec} · e-mail ____________________</td></tr>
<tr><td><b>Sito internet</b></td><td>${CO.web}</td></tr>
<tr><td><b>Autorità di vigilanza</b></td><td>Istituto per la Vigilanza sulle Assicurazioni (IVASS), competente a vigilare sull’attività dell’intermediario</td></tr>
<tr><td><b>P. IVA</b></td><td>${CO.vat}</td></tr>
</table>

<h2>Sezione II · Informazioni sul modello di distribuzione</h2>
<p>L’intermediario dichiara di operare:</p>
${stack("su incarico del cliente (mediazione, art. 109 comma 2 lett. b) del Codice delle Assicurazioni Private)", "in nome e per conto dell’impresa di assicurazione: ______________________________ (denominazione dell’impresa di cui distribuisce il prodotto)", "sulla base di un accordo di collaborazione orizzontale con altri intermediari: ______________________________ (identità, sezione RUI e ruolo svolto)")}
<p class="note">Art. 22, comma 10, D.L. 18 ottobre 2012 n. 179, convertito in L. 17 dicembre 2012 n. 221.</p>

<h2>Sezione III · Situazioni di potenziale conflitto d’interesse</h2>
${stack("l’intermediario NON detiene una partecipazione diretta o indiretta pari o superiore al 10% del capitale sociale o dei diritti di voto di un’impresa di assicurazione", "l’intermediario detiene tale partecipazione nell’impresa: ______________________________", "nessuna impresa di assicurazione, né impresa controllante un’impresa di assicurazione, detiene una partecipazione diretta o indiretta pari o superiore al 10% del capitale sociale o dei diritti di voto dell’intermediario", "tale partecipazione è detenuta da: ______________________________")}

<h2>Sezione IV · Informazioni sull’attività di distribuzione e consulenza</h2>
${stack("fornisce consulenza ai sensi dell’art. 119-ter, comma 3, del Codice delle Assicurazioni Private (raccomandazione personalizzata)", "fornisce consulenza fondata su un’analisi imparziale e personale (art. 119-ter, comma 4), su un numero sufficiente di prodotti disponibili sul mercato", "distribuisce in modo esclusivo i contratti di una o più imprese di assicurazione: ______________________________", "distribuisce contratti in assenza di obblighi che gli impongano di offrire esclusivamente contratti di una o più imprese e non fornisce consulenza fondata su analisi imparziale e personale: l’elenco delle imprese con cui ha o potrebbe avere rapporti d’affari è pubblicato sul sito internet dell’intermediario o disponibile su richiesta del contraente")}
${row(f("Attività prestate nell’ambito della consulenza, caratteristiche e contenuto delle prestazioni", "w3"))}

<h2>Sezione V · Informazioni sulle remunerazioni</h2>
<p>La natura del compenso percepito in relazione al contratto proposto è:</p>
${stack("commissione inclusa nel premio assicurativo", "onorario corrisposto direttamente dal cliente · importo o metodo di calcolo: ______________________________", "altro tipo di compenso, compresi i benefici economici di qualsiasi tipo offerti o ricevuti in virtù dell’intermediazione: ______________________________", "combinazione delle diverse tipologie di compensi indicate")}
<p class="note">Nel caso di collaborazioni orizzontali o con altri intermediari iscritti nella sezione E del RUI, l’informativa è complessivamente relativa ai compensi percepiti dagli intermediari coinvolti nella distribuzione del prodotto.</p>

<h2>Sezione VI · Informazioni sul pagamento dei premi</h2>
<ul>
<li>I premi pagati dal contraente all’intermediario e le somme destinate ai risarcimenti o ai pagamenti dovuti dalle imprese, se regolati per il tramite dell’intermediario, costituiscono patrimonio autonomo e separato dal patrimonio dell’intermediario stesso. ${cb("oppure: l’intermediario ha stipulato una fideiussione bancaria idonea a garantire una capacità finanziaria pari al 4% dei premi incassati, con un minimo di euro 18.750")}</li>
<li>Modalità di pagamento dei premi ammesse:
  <br>1. assegni bancari, postali o circolari, muniti della clausola di non trasferibilità, intestati o girati all’impresa di assicurazione oppure all’intermediario, espressamente in tale qualità;
  <br>2. ordini di bonifico, altri mezzi di pagamento bancario o postale, inclusi gli strumenti di pagamento elettronici, anche on line, che abbiano come beneficiario uno dei soggetti indicati al punto 1;
  <br>3. denaro contante, esclusivamente per i contratti di assicurazione contro i danni del ramo responsabilità civile auto e relative garanzie accessorie, nonché per i contratti degli altri rami danni con il limite di settecentocinquanta euro annui per ciascun contratto.</li>
<li>Se l’intermediario non è autorizzato all’incasso ai sensi dell’accordo sottoscritto o ratificato dall’impresa, il pagamento dei premi all’intermediario o a un suo collaboratore non è liberatorio ai sensi dell’art. 118 del Codice delle Assicurazioni Private.</li>
</ul>

<h2>Sezione VII · Informazioni sugli strumenti di tutela del contraente</h2>
<ul>
<li>L’attività di distribuzione è garantita da un contratto di assicurazione della responsabilità civile, che copre i danni arrecati ai contraenti da negligenze ed errori professionali dell’intermediario o da negligenze, errori professionali ed infedeltà dei dipendenti, dei collaboratori o delle persone del cui operato l’intermediario deve rispondere a norma di legge.</li>
<li>Il contraente, ferma restando la possibilità di rivolgersi all’Autorità Giudiziaria, può inoltrare reclamo per iscritto all’intermediario: <b>${CO.name}</b>, ${CO.legal}, PEC <b>${CO.pec}</b>; oppure all’impresa preponente, secondo le modalità e i recapiti indicati nel DIP aggiuntivo.</li>
<li>Se non si ritiene soddisfatto dall’esito del reclamo o in caso di assenza di riscontro entro il termine di legge (45 giorni), il contraente può rivolgersi all’IVASS, Servizio Tutela degli Utenti, Via del Quirinale 21, 00187 Roma, secondo quanto previsto nei DIP aggiuntivi (www.ivass.it).</li>
<li>Il contraente può avvalersi degli altri sistemi alternativi di risoluzione delle controversie previsti dalla normativa vigente e indicati nei DIP aggiuntivi.</li>
</ul>

<h2>Presa visione</h2>
<p>Il sottoscritto dichiara di aver ricevuto, prima della sottoscrizione della proposta o del contratto, il presente Modulo Unico Precontrattuale, di averne preso visione e di averne compreso il contenuto.</p>
${policyLine}
<div class="row">${f("Firmatario (cognome e nome)", "w3", "firmatario")}${f("in qualità di (contraente / rappresentante fiscale con procura speciale)", "w3", "qualita")}</div>
${placeDate}
${sign("Firma del Contraente o del rappresentante con procura (leggibile) e timbro", "Firma dell’intermediario o dell’incaricato")}
`;

// ---------------------------------------------------------------------------------------------------
// 3. QUESTIONARIO ANTIRICICLAGGIO
// ---------------------------------------------------------------------------------------------------
const person = (title, extra = "", p = "") => {
  const k = (name) => (p ? p + name : "");
  return `
<h3>${title}</h3>
${row(f("Cognome e nome", "w3", k("nome")), f("Codice fiscale", "w2", k("cf")), f("Sesso", "", k("sesso")), f("Data di nascita", "", k("nascita")))}
${row(f("Comune di nascita", "w2", k("luogo")), f("Prov."), f("Nazione", "", k("nazione_nascita")), f("Cittadinanza", "", k("cittadinanza")), f("Seconda cittadinanza"))}
${row(f("Residenza: indirizzo e n. civico", "w3", k("residenza")), f("CAP"), f("Comune"), f("Prov."), f("Nazione", "", k("residenza_nazione")))}
${row(f("Settore e professione", "w2", k("professione")), f("Paese attività prevalente", "", k("paese_attivita")))}
<div class="opts"><b>Persona politicamente esposta (PEP):</b> ${cb("NO")} ${cb("SI")} · altre cariche pubbliche: ${cb("nessuna")} ${cb("amministratore locale")} ${cb("ruolo apicale in P.A. / consorzio pubblico / associazione di natura pubblica")} ${cb("altro: ____________")}</div>
${row(f("Documento: carta d’identità / passaporto / patente", "w2", k("doc_tipo")), f("Numero", "", k("doc_numero")), f("Rilasciato il", "", k("doc_rilascio")), f("Scadenza", "", k("doc_scadenza")), f("Ente e località di rilascio", "w2", k("doc_ente")))}
${extra}`;
};

const aml = `
<h1>Modulo per l’identificazione e l’adeguata verifica della clientela</h1>
<p class="sub">Questionario antiriciclaggio · artt. 15 e seguenti del D.Lgs. 231/2007 e s.m.i. · Da compilare in ogni sua parte, in stampatello</p>
${row(f("Polizza / Contratto / Pratica n.", "w2", "pratica"), f("Impresa di assicurazione", "w2"), f("Prodotto", "w2", "prodotto"))}

<h2>1. Contraente (persona giuridica)</h2>
${row(f("Denominazione", "w3", "contraente"), f("Forma giuridica", "w2", "forma"), f("Codice fiscale / P.IVA", "w2", "cf"))}
${row(f("Sede legale: indirizzo e n. civico", "w3", "sede"), f("CAP"), f("Comune"), f("Prov."), f("Nazione", "", "sede_nazione"))}
${row(f("Recapito (se diverso dalla sede legale)", "w3"), f("SAE / ATECO"), f("Data di costituzione", "", "costituzione"), f("Registro e n. di iscrizione", "w2", "registro"))}
${row(f("Paese sede attività economica prevalente", "", "paese_attivita"), f("Paese sede legale della capogruppo"), f("Paesi esteri con cui intrattiene relazioni commerciali", "w2"))}
<div class="opts"><b>Catena partecipativa complessa:</b> ${cb("NO")} ${cb("SI (allegare organigramma)")} · <b>Ente no profit:</b> ${cb("NO")} ${cb("SI · categoria dei beneficiari: ____________")}</div>
<p class="lead"><b>Fatturato annuo:</b></p>
${opts("fino a € 250.000", "da € 250.000,01 a € 1.000.000", "da € 1.000.000,01 a € 10.000.000", "da € 10.000.000,01 a € 50.000.000", "oltre € 50.000.000")}
<p class="lead"><b>Capitale versato / controvalore dei beni conferiti:</b></p>
${opts("fino a € 20.000", "da € 20.000,01 a € 250.000", "da € 250.000,01 a € 1.000.000", "da € 1.000.000,01 a € 10.000.000", "oltre € 10.000.000")}

<h2>1-bis. Contraente (persona fisica) · solo se il contraente non è una società</h2>
${person("Dati del contraente persona fisica", row(f("Reddito annuo"), f("Patrimonio complessivo")))}

<h2>2. Legale rappresentante / esecutore</h2>
${person("Dati del legale rappresentante o di chi agisce per il contraente (es. rappresentante fiscale con procura speciale)", `
<div class="opts"><b>Rapporto con il contraente:</b> ${cb("legale rappresentante")} ${cb("procuratore speciale (rappresentante fiscale)")} ${cb("rapporto di lavoro/affari")} ${cb("altro: ____________")}</div>
<div class="opts"><b>Poteri di rappresentanza comprovati da (allegare):</b> ${cb("statuto")} ${cb("delibera di nomina")} ${cb("procura / delega")} ${cb("visura camerale")} ${cb("altro: ____________")}</div>`, "lr_")}

<h2>3. Titolare effettivo</h2>
<p><b>Dichiarazione resa ai sensi del D.Lgs. 231/2007.</b> Il sottoscritto, consapevole delle responsabilità anche penali in caso di omessa o falsa dichiarazione in tema di titolarità effettiva, dichiara che i titolari effettivi sono n. ____ ${cb("coincidenti con il legale rappresentante / esecutore (non compilare le schede)")} ${cb("diversi, indicati di seguito")}.</p>
<p class="note">Titolare effettivo è la persona fisica cui, in ultima istanza, è attribuibile la proprietà diretta o indiretta dell’ente (partecipazione superiore al 25% del capitale) o il relativo controllo; se non è individuabile, coincide con chi detiene poteri di rappresentanza legale, amministrazione o direzione (art. 20 D.Lgs. 231/2007).</p>
${person("Titolare effettivo n. 1", row(f("Quota di partecipazione / controllo (%)", "", "te1_quota"), f("Natura del controllo", "w2", "te1_controllo")), "te1_")}
${person("Titolare effettivo n. 2", row(f("Quota di partecipazione / controllo (%)", "", "te2_quota"), f("Natura del controllo", "w2", "te2_controllo")), "te2_")}
${person("Titolare effettivo n. 3", row(f("Quota di partecipazione / controllo (%)", "", "te3_quota"), f("Natura del controllo", "w2", "te3_controllo")), "te3_")}

<h2>4. Assicurato, beneficiario e soggetto che effettua il pagamento</h2>
${row(f("Assicurato (se diverso dal contraente): cognome e nome / denominazione", "w3"), f("Codice fiscale / P.IVA", "w2"), f("Motivo e rapporto con il contraente", "w2"))}
${row(f("Beneficiario della garanzia (denominazione)", "w3", "beneficiario"), f("Codice fiscale / P.IVA", "w2", "beneficiario_cf"), f("Rapporto con il contraente", "w2"))}
${row(f("Soggetto che effettua il pagamento del premio, se diverso dal contraente", "w3"), f("Codice fiscale / P.IVA", "w2"), f("Rapporto con il contraente", "w2"))}
<div class="opts"><b>Il soggetto pagante è PEP:</b> ${cb("NO")} ${cb("SI")}</div>

<h2>5. Natura e scopo del rapporto</h2>
<div class="opts"><b>Scopo prevalente:</b> ${cb("protezione")} ${cb("risparmio")} ${cb("investimento")} ${cb("altro (es. garanzia fideiussoria / polizza a copertura di obbligazioni di legge): ____________")}</div>
${row(f("Paese di provenienza delle somme versate"), f("Paese di destinazione delle somme liquidate"))}
<p class="lead"><b>Origine delle somme versate:</b></p>
${opts("reddito d’impresa", "lavoro dipendente", "lavoro autonomo", "pensione", "rendite da immobili", "reinvestimento da liquidazione", "reinvestimento da sinistro danni", "lascito / eredità / donazione", "altro: ____________")}
<p>Le operazioni di importo pari o superiore a 5.000 euro si presumono effettuate per conto del contraente e non di un soggetto terzo, salva Sua diversa indicazione. Se intende operare per conto di un terzo deve comunicarlo all’intermediario al momento dell’operazione, fornendo i dati necessari all’identificazione del terzo e, se è una società, del suo titolare effettivo. In assenza delle informazioni necessarie l’operazione non potrà essere eseguita.</p>

<h2>6. Dichiarazione del contraente</h2>
<p>Il sottoscritto, consapevole della responsabilità penale derivante da mendaci affermazioni in tale sede, dichiara di aver preso visione dell’informativa sugli obblighi di cui al D.Lgs. 231/2007 riportata di seguito, parte integrante del presente questionario, di aver fornito tutte le informazioni necessarie e aggiornate di cui è a conoscenza, anche relative al titolare effettivo del rapporto, di garantirne l’esattezza e la veridicità e di impegnarsi a comunicarne ogni futura variazione.</p>
${placeDate}
${sign("Timbro e firma del Contraente o del rappresentante con procura (leggibile)")}

<div class="box keep"><b>Riservato all’intermediario · ${CO.name} (RUI n. ${CO.rui})</b>
<p style="margin:3px 0 0">Si dichiara che il presente modulo è stato correttamente compilato e che l’incaricato ha proceduto all’identificazione e alla verifica dell’identità dei firmatari, ai sensi della vigente normativa antiriciclaggio.</p>
${row(f("Modalità di identificazione (di persona / a distanza / altro)", "w2"), f("Livello di rischio assegnato (basso / medio / alto)"), f("Data"))}
${sign("Firma dell’operatore o dell’incaricato")}
</div>

<div class="pb"></div>
<h1>Informativa sugli obblighi di cui al D.Lgs. 231/2007</h1>
<p class="sub">Antiriciclaggio e contrasto al finanziamento del terrorismo · parte integrante del questionario</p>
<p>Le dichiarazioni richieste ai sensi del D.Lgs. 231/2007 e dei relativi regolamenti attuativi sono raccolte per adempiere a obblighi di legge e permettono all’intermediario di verificare che il contratto o l’operazione connessa non perseguano finalità di riciclaggio o di finanziamento del terrorismo. Il conferimento dei dati è obbligatorio: il mancato rilascio delle informazioni non consente di dar corso alla sottoscrizione del contratto o all’operazione e può determinare la risoluzione del rapporto in essere. Il trattamento è svolto anche con strumenti elettronici, solo da personale incaricato, con garanzia di sicurezza e riservatezza; i dati non sono diffusi ma possono essere comunicati alle Autorità e agli Organi di Vigilanza e Controllo, come per legge. I documenti di adeguata verifica sono conservati per dieci anni dalla fine del rapporto (art. 31). Titolare del trattamento: ${CO.name}, PEC ${CO.pec}.</p>

<h2>Obblighi del cliente · art. 22 D.Lgs. 231/2007</h2>
<p>I clienti forniscono per iscritto, sotto la propria responsabilità, tutte le informazioni necessarie e aggiornate per consentire ai soggetti obbligati di adempiere agli obblighi di adeguata verifica. Le imprese dotate di personalità giuridica e le persone giuridiche private ottengono e conservano, per almeno cinque anni, informazioni adeguate, accurate e aggiornate sulla propria titolarità effettiva e le forniscono ai soggetti obbligati in occasione degli adempimenti di adeguata verifica.</p>

<h2>Persone politicamente esposte · art. 1, comma 2, lett. dd)</h2>
<p>Sono persone politicamente esposte le persone fisiche che occupano o hanno cessato di occupare da meno di un anno importanti cariche pubbliche, nonché i loro familiari e coloro che con loro intrattengono notoriamente stretti legami. Sono importanti cariche pubbliche, tra le altre: Presidente della Repubblica, Presidente del Consiglio, Ministro, Vice-Ministro e Sottosegretario, Presidente di Regione, assessore regionale, Sindaco di capoluogo di provincia o città metropolitana e di comune con almeno 15.000 abitanti; deputato, senatore, parlamentare europeo, consigliere regionale; membro degli organi direttivi centrali di partiti politici; giudice della Corte Costituzionale, magistrato della Cassazione o della Corte dei conti, consigliere di Stato; membro degli organi direttivi delle banche centrali e delle autorità indipendenti; ambasciatore, incaricato d’affari, ufficiale di grado apicale delle forze armate; componente degli organi di amministrazione, direzione o controllo di imprese controllate dallo Stato o partecipate in misura prevalente da enti locali; direttore generale di ASL e di aziende ospedaliere; direttore, vicedirettore e membro dell’organo di gestione di organizzazioni internazionali. Sono familiari i genitori, il coniuge o la persona legata da unione civile o convivenza di fatto, i figli e i loro coniugi o conviventi.</p>

<h2>Titolare effettivo · art. 20</h2>
<p>Per le società di capitali costituisce indicazione di proprietà diretta la titolarità di una partecipazione superiore al 25% del capitale detenuta da una persona fisica; di proprietà indiretta, la titolarità di una percentuale superiore al 25% posseduta tramite società controllate, fiduciarie o interposta persona. Se l’assetto proprietario non consente di individuare la persona fisica, il titolare effettivo è chi esercita in ultima istanza il controllo (maggioranza dei voti in assemblea ordinaria, influenza dominante, particolari vincoli contrattuali). Se neppure così è possibile, coincide con chi detiene poteri di rappresentanza legale, amministrazione o direzione. In presenza di più titolari effettivi gli adempimenti riguardano ciascuno di essi.</p>

<h2>Obbligo di astensione · art. 42</h2>
<p>I soggetti obbligati che non possono effettuare l’adeguata verifica si astengono dall’instaurare, eseguire o proseguire il rapporto e valutano se effettuare una segnalazione di operazione sospetta alla UIF. Si astengono inoltre dal rapporto con società fiduciarie, trust, società anonime o controllate tramite azioni al portatore aventi sede in Paesi terzi ad alto rischio.</p>

<h2>Sanzioni penali · art. 55</h2>
<p>Chiunque, essendo tenuto agli obblighi di adeguata verifica, falsifica i dati e le informazioni relative al cliente, al titolare effettivo, all’esecutore, allo scopo e alla natura del rapporto è punito con la reclusione da sei mesi a tre anni e con la multa da 10.000 a 30.000 euro. La stessa pena si applica a chi fornisce dati falsi o informazioni non veritiere necessari all’adeguata verifica.</p>
`;

// ---------------------------------------------------------------------------------------------------
const docs = [
  { file: "privacy.pdf", title: "Informativa privacy e consensi", body: privacy },
  { file: "mup.pdf", title: "Modulo Unico Precontrattuale (MUP)", body: mup },
  { file: "antiriciclaggio.pdf", title: "Questionario antiriciclaggio", body: aml },
];

const page = (title, body) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${title} · ${CO.name}</title><style>${CSS}</style></head><body>${body}</body></html>`;

const header = `<div style="width:100%;padding:0 16mm;display:flex;align-items:center;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;border-bottom:2px solid ${NAVY};padding-bottom:5px;-webkit-print-color-adjust:exact">
  <img src="${LOGO}" style="height:34px">
  <div style="text-align:right;color:${NAVY};font-size:8.5pt;line-height:1.25"><b style="font-size:10.5pt">${CO.name}</b><br>Intermediario assicurativo · RUI n. ${CO.rui}</div></div>`;

const footer = (title) => `<div style="width:100%;padding:0 16mm;font-family:Helvetica,Arial,sans-serif;font-size:6.8pt;color:#4b5563;border-top:1px solid #b8c1d3;padding-top:4px;line-height:1.35">
  <div style="display:flex;justify-content:space-between"><span><b>${CO.name}</b> · Iscr. IVASS (RUI) n. ${CO.rui} · P.IVA ${CO.vat} · ${CO.web}</span><span>${title} · pag. <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>
  <div>Sede legale: ${CO.legal} · Sede operativa: ${CO.office} · Tel. ${CO.tel} · PEC: ${CO.pec}</div></div>`;

/**
 * I campi con chiave sono link verso un indirizzo finto: Chromium li scrive come annotazioni con il loro
 * riquadro. Qui si leggono (pagina, posizione, misura), si salvano in fields.json e si tolgono dal PDF.
 */
async function extractFields(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const fields = [];
  pdf.getPages().forEach((page, pageIndex) => {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) return;
    for (let i = 0; i < annots.size(); i += 1) {
      const annot = annots.lookupMaybe(i, PDFDict);
      const action = annot?.lookupMaybe(PDFName.of("A"), PDFDict);
      const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString);
      const text = uri?.decodeText();
      if (!text?.startsWith(KEY_URL)) continue;
      const rect = annot.lookup(PDFName.of("Rect"), PDFArray).asRectangle();
      fields.push({ key: text.slice(KEY_URL.length), page: pageIndex, x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height) });
    }
    page.node.delete(PDFName.of("Annots"));
  });
  return { fields, bytes: await pdf.save() };
}
const round = (value) => Math.round(value * 10) / 10;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const map = {};
try {
  for (const doc of docs) {
    const tab = await browser.newPage();
    await tab.setContent(page(doc.title, doc.body), { waitUntil: "load" });
    const raw = await tab.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer(doc.title),
      margin: { top: "27mm", bottom: "21mm", left: "16mm", right: "16mm" },
    });
    await tab.close();
    const { fields, bytes } = await extractFields(raw);
    writeFileSync(join(OUT_DIR, doc.file), bytes);
    map[doc.file.replace(/\.pdf$/, "")] = fields;
    console.log(`PDF scritto: ${join(OUT_DIR, doc.file)} (${fields.length} campi precompilabili)`);
  }
  writeFileSync(join(OUT_DIR, "fields.json"), `${JSON.stringify(map, null, 1)}\n`);
} finally {
  await browser.close();
}
