// Testo del MUP unico (MUP + incarico di consulenza + raccomandazione + dichiarazione di consegna + informativa
// privacy + questionario antiriciclaggio): un solo documento, quello che il cliente firma. Il testo e' quello
// predisposto dal rappresentante fiscale (MUP_Polizza_VIES_Italy4VAT, rev. ottobre 2026), messo sulla carta intestata
// Tecno Advance MGA Broker. Le note di compilazione del modello originale ("Compilare solo se...", "Da confermare",
// "indicare i Paesi effettivi"...) non sono riportate: restano in bianco le righe dei dati che il portale non conosce.
//
// Consensi come nel vecchio MUP firmato dai clienti: consenso al trattamento dei dati e al supporto durevole non
// cartaceo SI'; comunicazioni commerciali NO; motivo della raccomandazione "Specificita' di alcune garanzie".

export function buildMup({ CO, f, row, cb, on, opts, stack, sign, placeDate, inl }) {
  const blank = (label, cls = "") => f(label, cls);
  const policyLine = row(f("Pratica / Polizza n.", "w2", "pratica"), f("Contraente", "w3", "contraente"), f("Codice fiscale / P.IVA", "w2", "cf"));
  const intermediary = (title, rows) => `<h3>${title}</h3><table>${rows.map(([k, v]) => `<tr><td style="width:36%"><b>${k}</b></td><td>${v || "&nbsp;"}</td></tr>`).join("")}</table>`;
  const owner = (n) => `
<h3>C) Titolare effettivo n. ${n} (artt. 20-22 D.Lgs. 231/2007)${n > 1 ? " · se presente" : ""}</h3>
${row(f("Cognome e nome", "w3", `te${n}_nome`), f("Luogo e data di nascita", "w2", `te${n}_nascita_luogo`))}
${row(f("Residenza", "w3", `te${n}_residenza`), f("Quota di partecipazione / modalità di controllo", "w2", `te${n}_quota`))}`;

  return `
<h1>Allegato 3 · Modulo Unico Precontrattuale (MUP) per i prodotti assicurativi</h1>
<p class="sub">Regolamento IVASS n. 40/2018, come modificato da ultimo dal Provvedimento IVASS n. 163 del 25 novembre 2025</p>
<div class="box"><p style="margin:0">Il distributore ha l’obbligo di consegnare/trasmettere al contraente il presente Modulo prima della sottoscrizione della proposta o del contratto di assicurazione. Il documento può essere fornito su supporto durevole non cartaceo se appropriato rispetto alle modalità di distribuzione del prodotto assicurativo e se il contraente lo consente (art. 120-quater del Codice delle Assicurazioni Private, di seguito “CAP”).</p></div>
${policyLine}

<h2>Sezione I · Informazioni generali sul distributore che entra in contatto con il contraente</h2>
<p>Gli estremi identificativi e di iscrizione dell’intermediario possono essere verificati consultando il Registro Unico degli Intermediari assicurativi e riassicurativi (RUI) sul sito internet dell’IVASS (www.ivass.it).</p>
${intermediary("A) Intermediario che entra in contatto con il contraente", [
  ["Denominazione sociale", "Italy4VAT S.r.l."],
  ["Numero e data di iscrizione RUI (sezione)", "Sezione E – n. ____________ del ____________"],
  ["Veste in cui opera", "Collaboratore di intermediario iscritto nella Sezione E del RUI"],
  ["Responsabile dell’attività di distribuzione", "Nome e cognome ____________________ – RUI n. ____________"],
  ["Sede legale e operativa", ""],
  ["Recapito telefonico", ""],
  ["Indirizzo internet", ""],
  ["Posta elettronica", ""],
  ["Posta elettronica certificata (PEC)", ""],
  ["Modalità di distribuzione", "L’intermediario non colloca contratti tramite il proprio sito internet, che ha esclusivamente finalità informative. Il contratto può essere concluso anche a distanza (posta elettronica, firma digitale/elettronica), con trasmissione della documentazione su supporto durevole."],
  ["Autorità competente alla vigilanza", "Istituto per la Vigilanza sulle Assicurazioni (IVASS) – Via del Quirinale 21, 00187 Roma"],
])}
${intermediary("B) Intermediario per conto del quale è svolta l’attività di distribuzione", [
  ["Denominazione sociale", `${CO.name} · broker di riferimento`],
  ["Numero e data di iscrizione RUI (sezione)", `Sezione B – n. ${CO.rui} del 29/02/2024`],
  ["Sede legale", CO.legal],
  ["Recapiti (telefono, e-mail, PEC, sito)", `tel. ${CO.tel} · PEC ${CO.pec} · ${CO.web}`],
])}
${intermediary("C) Eventuale collaborazione orizzontale (art. 22, comma 10, D.L. 179/2012)", [
  ["Intermediario collaboratore orizzontale", ""],
  ["Numero e data di iscrizione RUI (sezione)", ""],
  ["Impresa/e di assicurazione", ""],
  ["Ripartizione dei ruoli", "Indicare quale intermediario cura la consulenza, l’incasso dei premi e la gestione dei reclami"],
])}
<p>Provvigioni RC auto: non applicabile (il prodotto distribuito non appartiene al ramo RC auto).</p>

<h2>Sezione II · Informazioni sul modello di distribuzione</h2>
<p>L’intermediario svolge la propria attività su incarico del cliente, in qualità di collaboratore iscritto nella Sezione E del RUI del broker indicato alla Sezione I, lettera B.</p>

<h2>Sezione III · Informazioni relative a situazioni di potenziale conflitto d’interessi</h2>
<p>L’intermediario dichiara che:</p>
<ul>
<li>non detiene una partecipazione, diretta o indiretta, pari o superiore al 10% del capitale sociale o dei diritti di voto di un’impresa di assicurazione;</li>
<li>nessuna impresa di assicurazione o impresa controllante un’impresa di assicurazione detiene una partecipazione, diretta o indiretta, pari o superiore al 10% del capitale sociale o dei diritti di voto dell’intermediario;</li>
<li>è collegato, per comunanza di soci e/o amministratori, a Se&amp;Se Auditors &amp; Chartered Accountants S.p.A. STP e alle società del gruppo Servix International, che possono prestare al contraente il servizio di rappresentanza fiscale in Italia. La garanzia di cui all’art. 35, comma 7-quater, del D.P.R. 633/1972 è un requisito normativo per tale servizio. Per questo motivo l’intermediario può avere un interesse economico, sia nel collocamento della polizza sia nel servizio fiscale collegato;</li>
<li>il contraente è libero di acquistare la garanzia presso altro intermediario o impresa di assicurazione. La scelta non condiziona l’accettazione né le condizioni del servizio di rappresentanza fiscale. L’intermediario adotta misure organizzative per gestire il conflitto, tra cui la separazione dei compensi e la trasparenza sugli importi indicati alla Sezione V.</li>
</ul>

<h2>Sezione IV · Informazioni sull’attività di distribuzione e consulenza</h2>
<p>L’intermediario:</p>
<ul>
<li>fornisce consulenza ai sensi dell’art. 119-ter, comma 3, del CAP, ossia una raccomandazione personalizzata contenente i motivi per cui un particolare contratto è ritenuto più indicato a soddisfare le richieste e le esigenze del contraente;</li>
<li>non fornisce consulenza fondata su un’analisi imparziale e personale ai sensi dell’art. 119-ter, comma 4, del CAP. La raccomandazione si basa sul confronto tra i prodotti delle imprese con cui l’intermediario, direttamente o tramite il broker di riferimento, intrattiene rapporti d’affari, e non su un numero sufficiente di prodotti disponibili sul mercato;</li>
<li>distribuisce contratti in assenza di obblighi contrattuali che gli impongano di offrire esclusivamente i contratti di una o più imprese di assicurazione. L’elenco delle imprese con cui ha o potrebbe avere rapporti d’affari è pubblicato sul sito internet ____________________ ed è trasmesso al contraente su supporto durevole, insieme al presente Modulo;</li>
<li>mette a disposizione del contraente l’elenco delle regole di comportamento del distributore (Allegato 4-ter al Regolamento IVASS n. 40/2018), pubblicato sul sito internet e trasmesso su supporto durevole in caso di distribuzione a distanza;</li>
<li>fornisce ogni altra informazione utile a garantire il rispetto delle regole di trasparenza previste dall’art. 119-bis, comma 7, del CAP.</li>
</ul>

<h2>Sezione V · Informazioni sulle remunerazioni</h2>
<p>L’intermediario:</p>
<ul>
<li>percepisce un compenso costituito da: (i) una commissione inclusa nel premio assicurativo, corrisposta dall’impresa o dal broker di riferimento; (ii) un onorario per l’attività di consulenza, corrisposto direttamente dal contraente;</li>
<li>l’onorario corrisposto direttamente dal contraente è pari a € ____________ per ciascuna polizza (IVA inclusa / esclusa, se dovuta). È indicato anche nell’“Incarico e preventivo di consulenza” allegato;</li>
<li>la commissione inclusa nel premio è pari a € ____________ / ____ % del premio, oppure: “importo disponibile su richiesta del contraente”;</li>
</ul>
${stack("non percepisce incentivi legati alla distribuzione di uno specifico prodotto né al raggiungimento di obiettivi quantitativi", "può percepire ulteriori compensi legati al raggiungimento di obiettivi quantitativi definiti per aggregato di prodotti e di parametri qualitativi, e tali compensi non sono collegati alla distribuzione di uno specifico prodotto")}

<h2>Sezione VI · Informazioni sul pagamento dei premi</h2>
<p>L’intermediario fornisce informazioni in merito ai seguenti aspetti:</p>
<ul>
<li>i premi pagati dal contraente all’intermediario e le somme destinate ai risarcimenti o ai pagamenti dovuti dalle imprese costituiscono patrimonio autonomo e separato dal patrimonio dell’intermediario stesso (art. 117 CAP). Sono depositati su un conto corrente separato, intestato all’intermediario in tale qualità, distinto da quello su cui è accreditato l’onorario di consulenza;</li>
<li>l’intermediario è autorizzato all’incasso dei premi in forza di accordo con l’impresa/broker di riferimento e di specifica autorizzazione del contraente per la singola impresa. Gli effetti liberatori del pagamento sono regolati dall’art. 118 del CAP;</li>
<li>le modalità di pagamento dei premi ammesse sono: (1) assegni bancari, postali o circolari, muniti della clausola di non trasferibilità, intestati o girati all’impresa di assicurazione oppure all’intermediario, espressamente in tale qualità; (2) ordini di bonifico e altri mezzi di pagamento bancario o postale, inclusi gli strumenti di pagamento elettronici, anche on line, che abbiano come beneficiario uno dei soggetti indicati al punto 1; (3) denaro contante, esclusivamente per i contratti RC auto e relative garanzie accessorie, nonché per i contratti degli altri rami danni con il limite di € 750 annui per ciascun contratto.</li>
</ul>

<h2>Sezione VII · Informazioni sugli strumenti di tutela del contraente</h2>
<p>L’intermediario fornisce informazioni in merito ai seguenti aspetti:</p>
<ul>
<li>l’attività di distribuzione è garantita da un contratto di assicurazione della responsabilità civile, che copre i danni arrecati ai contraenti da negligenze ed errori professionali dell’intermediario, nonché da negligenze, errori professionali ed infedeltà dei dipendenti, dei collaboratori o delle persone del cui operato l’intermediario deve rispondere a norma di legge;</li>
<li>il contraente ha facoltà di presentare reclamo per iscritto all’intermediario, ai recapiti indicati alla Sezione I, oppure all’impresa di assicurazione, secondo quanto indicato nel DIP aggiuntivo. Il reclamo riceve riscontro entro 45 giorni dal ricevimento. Resta ferma la possibilità di rivolgersi all’Autorità Giudiziaria;</li>
<li>se non è soddisfatto dell’esito del reclamo, o in assenza di riscontro nel termine indicato, il contraente può rivolgersi all’IVASS secondo le modalità indicate su www.ivass.it;</li>
<li>in alternativa, ricorrendone i presupposti, il contraente può presentare ricorso all’Arbitro Assicurativo, operativo dal 15 gennaio 2026, secondo le modalità e nei limiti di valore indicati sul sito www.arbitroassicurativo.org. Il ricorso presuppone la previa presentazione di un reclamo;</li>
<li>per le controversie transfrontaliere, il contraente può rivolgersi al sistema estero competente, individuabile tramite la rete FIN-NET (sito internet della Commissione europea), oppure chiedere all’IVASS l’attivazione della procedura FIN-NET;</li>
<li>il contraente ha facoltà di avvalersi degli altri sistemi alternativi di risoluzione delle controversie previsti dalla normativa vigente (es. mediazione ai sensi del D.Lgs. 28/2010).</li>
</ul>

<h2>Sezione VIII · Informativa sul diritto all’oblio oncologico</h2>
<p>L’intermediario informa il contraente che, ai sensi della Legge 7 dicembre 2023, n. 193 e del Regolamento IVASS n. 40/2018, come modificato dal Provvedimento IVASS n. 169 del 15 gennaio 2026:</p>
<ul>
<li>il contraente e/o l’assicurato non sono tenuti a fornire informazioni relative a patologie oncologiche pregresse, da cui siano stati precedentemente affetti, quando il relativo trattamento attivo si sia concluso senza episodi di recidiva da oltre i termini previsti dall’articolo 2, commi 1 e 2, della Legge n. 193/2023 e dai relativi decreti attuativi;</li>
<li>l’intermediario si astiene dall’acquisire e utilizzare, da qualsiasi fonte, informazioni sullo stato di salute del contraente o dell’assicurato relative a tali patologie oncologiche pregresse, e tali informazioni non possono in alcun caso incidere sulle condizioni economiche o sull’accesso ai prodotti assicurativi offerti;</li>
<li>a seguito della presentazione di apposita certificazione attestante l’avvenuto oblio oncologico, l’intermediario cancella ogni informazione sulla patologia pregressa eventualmente già in suo possesso, su ogni supporto informatico o cartaceo, entro trenta giorni dal ricevimento della certificazione (art. 56-ter del Regolamento IVASS n. 40/2018);</li>
<li>le presenti disposizioni non si applicano alle polizze RC auto.</li>
</ul>
<p class="note">Il prodotto distribuito (polizza VIES ex art. 35, comma 7-quater, D.P.R. 633/1972) non richiede la raccolta di dati relativi alla salute.</p>

<div class="pb"></div>
<h1>Incarico e preventivo di consulenza</h1>
<p class="sub">Art. 57, comma 2, Regolamento IVASS n. 40/2018</p>
<p>Il cliente ${inl("contraente", "62%")} conferisce a Italy4VAT S.r.l. (di seguito “l’intermediario”) l’incarico, a titolo oneroso, di prestare consulenza assicurativa sulle esigenze manifestate e assistenza finalizzata a tale attività, in relazione alla garanzia prevista dall’art. 35, comma 7-quater, del D.P.R. 633/1972 (di seguito “polizza VIES”).</p>
<p>La consulenza prestata dall’intermediario è strettamente connessa alla distribuzione dei prodotti assicurativi ed è quindi resa in relazione a un contratto di assicurazione.</p>
<p>Il cliente prende atto che la consulenza non è indipendente. L’intermediario intrattiene infatti rapporti con altri intermediari e/o imprese di assicurazione, dai quali percepisce le commissioni indicate alla Sezione V del MUP.</p>
<h3>Attività comprese nell’incarico</h3>
<ul>
<li>Analisi preliminare delle esigenze assicurative manifestate dal cliente;</li>
<li>Valutazione della situazione del cliente ai fini della tipologia e dell’entità della garanzia richiesta;</li>
<li>Confronto tra le soluzioni offerte dalle imprese con cui l’intermediario, direttamente o tramite il broker di riferimento, intrattiene rapporti d’affari;</li>
<li>Valutazione tecnica delle condizioni contrattuali proposte;</li>
<li>Individuazione e proposta della soluzione più adatta, in termini di garanzie, costi e affidabilità della compagnia;</li>
<li>Assistenza nella compilazione e trasmissione della documentazione necessaria alla conclusione del contratto;</li>
<li>Supporto successivo alla conclusione del contratto per chiarimenti, aggiornamenti ed esigenze del cliente.</li>
</ul>
<h3>Compenso</h3>
<table>
<tr><td style="width:46%"><b>Onorario di consulenza per polizza</b></td><td>€ ____________ (IVA inclusa/esclusa, se dovuta)</td></tr>
<tr><td><b>Premio assicurativo (rimesso all’impresa)</b></td><td>€ ____________</td></tr>
<tr><td><b>Totale a carico del cliente</b></td><td>€ ____________</td></tr>
<tr><td><b>Modalità e tempi di pagamento</b></td><td>&nbsp;</td></tr>
<tr><td><b>Durata dell’incarico</b></td><td>Fino alla scadenza della polizza / annuale con rinnovo</td></tr>
</table>
<p>L’onorario è distinto dal premio ed è accreditato su un conto diverso da quello separato riservato ai premi.</p>
${placeDate}
${sign("Firma del cliente", "Firma dell’intermediario")}

<div class="pb"></div>
<h1>Raccomandazione personalizzata</h1>
<p class="sub">Art. 59, Regolamento IVASS n. 40/2018</p>
<p>Lo scrivente intermediario Italy4VAT S.r.l., dopo l’esame delle esigenze e delle informazioni fornite dal cliente e dopo aver valutato i prodotti delle imprese con cui intrattiene rapporti d’affari, raccomanda la stipulazione del seguente contratto:</p>
<table>
<tr><td style="width:30%"><b>Denominazione cliente</b></td><td>${inl("contraente", "95%")}</td></tr>
<tr><td><b>Prodotto</b></td><td>Polizza VIES – ai sensi dell’art. 35, comma 7-quater, del D.P.R. 633/1972</td></tr>
<tr><td><b>Compagnia</b></td><td>&nbsp;</td></tr>
<tr><td><b>N. polizza / proposta</b></td><td>${inl("polizza", "95%")}</td></tr>
</table>
<p class="lead"><b>per i seguenti motivi:</b></p>
${stack("Convenienza tariffaria", "Ampiezza delle coperture offerte", on("Specificità di alcune garanzie"), "Maggiori garanzie a parità di costo", "Minor costo a parità di garanzie", "Altro: ____________________________")}
<h3>Analisi comparativa e coerenza con le esigenze del cliente</h3>
<p>Alternative esaminate (compagnia, premio, massimale/durata, condizioni principali) e motivo della scelta; se non è stato effettuato alcun confronto, riportarlo espressamente.</p>
<div style="border-bottom:1px solid #1f2733;height:20px"></div><div style="border-bottom:1px solid #1f2733;height:20px"></div><div style="border-bottom:1px solid #1f2733;height:20px"></div>
<p style="margin-top:8px">Esigenza manifestata dal cliente: prestare la garanzia richiesta dalla normativa IVA italiana per l’identificazione tramite rappresentante fiscale e per la permanenza nell’archivio VIES.</p>
${placeDate}
${sign("Firma dell’intermediario", "Firma del cliente per presa visione")}

<div class="pb"></div>
<h1>Dichiarazione di avvenuta consegna dell’informativa precontrattuale</h1>
<p class="sub">Art. 56, comma 8, Regolamento IVASS n. 40/2018</p>
<div class="row">${f("Il sottoscritto (cognome e nome)", "w3", "firmatario")}${f("in qualità di", "w2", "qualita")}</div>
<div class="row">${f("del contraente", "w3", "contraente")}${f("con riferimento alla polizza/proposta n.", "w2", "polizza")}${f("dell’impresa", "w2")}</div>
<p>dichiara di aver ricevuto, prima della sottoscrizione del contratto:</p>
<ul>
<li>il Modulo Unico Precontrattuale (MUP) per i prodotti assicurativi – Allegato 3;</li>
<li>l’elenco delle regole di comportamento del distributore (Allegato 4-ter);</li>
<li>il DIP Danni, il DIP aggiuntivo e le condizioni di assicurazione del prodotto;</li>
<li>l’Incarico e preventivo di consulenza e la Raccomandazione personalizzata;</li>
<li>l’informativa sul trattamento dei dati personali (artt. 13-14 GDPR);</li>
<li>il documento “Termini e Condizioni del Servizio”.</li>
</ul>
<h3>Consenso all’utilizzo del supporto durevole non cartaceo (art. 120-quater CAP)</h3>
<p>Il contraente acconsente a ricevere la documentazione precontrattuale e contrattuale su supporto durevole non cartaceo, al seguente indirizzo di posta elettronica: ${inl("email", "50%")}. Il contraente può revocare il consenso in qualsiasi momento e chiedere la documentazione su carta senza costi aggiuntivi.</p>
${opts(on("Sì, acconsento"), "No, preferisco il formato cartaceo")}
${placeDate}
${sign("Firma del contraente")}

<div class="pb"></div>
<h1>Informativa sul trattamento dei dati personali</h1>
<p class="sub">Artt. 13-14 Regolamento UE 2016/679 – “GDPR”; D.Lgs. 196/2003; Regolamento IVASS n. 40/2018</p>
<h3>1. Titolare del trattamento</h3>
<p>Titolare del trattamento è Italy4VAT S.r.l., con sede in ____________________, iscritta al RUI dell’IVASS, Sezione E, n. ____________ (di seguito “il Titolare”). Contatti: e-mail ____________, PEC ____________, telefono ____________.</p>
<p>Se il contraente è una persona giuridica, la presente informativa riguarda i dati delle persone fisiche che agiscono per suo conto (legale rappresentante, titolare effettivo, referenti).</p>
<h3>2. Finalità del trattamento</h3>
<ul>
<li>svolgimento dell’attività di consulenza e di distribuzione assicurativa, in esecuzione dell’incarico conferito;</li>
<li>preventivazione, conclusione e gestione dei contratti di assicurazione, compresi i rapporti con le imprese di assicurazione e con il broker di riferimento;</li>
<li>adempimento degli obblighi di legge e regolamentari (normativa IVASS, fiscale, contabile e, ove applicabile, antiriciclaggio ai sensi del D.Lgs. 231/2007);</li>
<li>gestione amministrativa del rapporto, incasso dei premi e archiviazione della documentazione;</li>
<li>assistenza successiva alla conclusione del contratto e gestione di eventuali reclami;</li>
<li>invio di comunicazioni commerciali, esclusivamente previo consenso espresso.</li>
</ul>
<h3>3. Base giuridica del trattamento</h3>
<ul>
<li>Esecuzione del contratto o di misure precontrattuali (art. 6, par. 1, lett. b, GDPR): finalità 2.a, 2.b, 2.d, 2.e;</li>
<li>Adempimento di un obbligo legale (art. 6, par. 1, lett. c, GDPR): finalità 2.c;</li>
<li>Consenso (art. 6, par. 1, lett. a, GDPR): finalità 2.f, revocabile in qualsiasi momento.</li>
</ul>
<p>Per le finalità 2.a–2.e il conferimento dei dati è necessario e non richiede il consenso; l’eventuale rifiuto impedisce la conclusione del contratto.</p>
<h3>4. Categorie di dati trattati</h3>
<p>Dati anagrafici e di contatto, dati identificativi (anche da documento d’identità), dati fiscali (codice fiscale, partita IVA, numero di identificazione estero), dati bancari per i pagamenti, dati societari e relativi al titolare effettivo. Per il prodotto distribuito non sono raccolti dati appartenenti a categorie particolari (art. 9 GDPR) né dati relativi a condanne penali e reati (art. 10 GDPR).</p>
<h3>5. Modalità di trattamento, luogo di conservazione e misure di sicurezza</h3>
<p>I dati sono trattati con strumenti elettronici e, in misura limitata, cartacei. La documentazione dei clienti è conservata in un archivio digitale centralizzato sulla piattaforma ViesItaly, ospitata su server situati in Paese UE / fornitore di hosting, e nei sistemi gestionali del Titolare. L’eventuale documentazione cartacea è custodita presso la sede di ____________________ in archivi chiusi ad accesso riservato.</p>
<p>In conformità all’art. 32 GDPR, il Titolare adotta misure tecniche e organizzative adeguate. Tra queste: accesso con credenziali personali e profili autorizzativi limitati al personale incaricato, cifratura delle comunicazioni, backup periodici, registrazione degli accessi e autenticazione a più fattori.</p>
<h3>6. Destinatari dei dati</h3>
<p>I dati possono essere comunicati a:</p>
<ul>
<li>imprese di assicurazione, broker di riferimento e intermediari collaboratori, per la consulenza e la conclusione dei contratti;</li>
<li>autorità pubbliche e organi di controllo (IVASS, Agenzia delle Entrate, Guardia di Finanza, UIF), quando previsto dalla legge;</li>
<li>fornitori di servizi informatici, di hosting e di gestione documentale, nominati responsabili del trattamento ai sensi dell’art. 28 GDPR (tra cui il fornitore della piattaforma ViesItaly);</li>
<li>società collegate (Se&amp;Se Auditors &amp; Chartered Accountants S.p.A. STP e società del gruppo Servix International), nei limiti necessari alla gestione del rapporto e del servizio di rappresentanza fiscale collegato;</li>
<li>consulenti e professionisti incaricati (legali, revisori), vincolati al segreto professionale.</li>
</ul>
<p>I dati non sono diffusi.</p>
<h3>7. Trasferimento dei dati verso Paesi terzi</h3>
<p>Poiché i clienti hanno sede fuori dall’Unione europea e il rapporto è gestito anche tramite società del gruppo e partner esteri, i dati possono essere comunicati a soggetti situati in Repubblica Popolare Cinese, Hong Kong (RAS), Stati Uniti. Questi trasferimenti avvengono sulla base delle clausole contrattuali standard approvate dalla Commissione europea (art. 46 GDPR). In alternativa, ove ricorrano i presupposti, avvengono in quanto necessari all’esecuzione del contratto concluso con l’interessato o su sua richiesta (art. 49, par. 1, lett. b, GDPR). Una copia delle garanzie adottate può essere richiesta al Titolare.</p>
<h3>8. Periodo di conservazione</h3>
<p>I dati sono conservati per la durata del rapporto e, dopo la sua cessazione, per 10 anni, in adempimento degli obblighi civilistici (art. 2220 c.c.) e, ove applicabili, antiriciclaggio (art. 31 D.Lgs. 231/2007), salvo termini più lunghi in caso di contenzioso. Alla scadenza i dati sono cancellati o resi anonimi. I dati trattati per finalità commerciali sono conservati fino alla revoca del consenso e comunque non oltre 24 mesi dall’ultimo contatto.</p>
<h3>9. Diritti dell’interessato</h3>
<p>L’interessato ha diritto di: accedere ai propri dati (art. 15); ottenerne la rettifica (art. 16) o la cancellazione, salvo i dati conservati per obbligo di legge (art. 17); ottenere la limitazione del trattamento (art. 18); ricevere i dati in formato strutturato e trasferirli ad altro titolare (art. 20); opporsi al trattamento per finalità di marketing (art. 21); non essere sottoposto a decisioni basate unicamente su trattamenti automatizzati (art. 22); revocare il consenso in qualsiasi momento, senza pregiudizio per la liceità del trattamento precedente. Le richieste vanno inviate al Titolare ai recapiti indicati al punto 1.</p>
<h3>10. Reclamo all’Autorità di controllo</h3>
<p>L’interessato ha diritto di proporre reclamo al Garante per la protezione dei dati personali – Piazza Venezia 11, 00187 Roma – PEC protocollo@pec.gpdp.it – www.garanteprivacy.it. Resta ferma la possibilità di ricorrere all’Autorità giudiziaria.</p>
<h3>Presa visione e consensi</h3>
<p>Il sottoscritto ${inl("firmatario", "55%")} dichiara di aver ricevuto e letto la presente informativa.</p>
<p class="lead"><b>Comunicazioni commerciali (finalità 2.f) – facoltativo:</b></p>
${opts("Acconsento", on("Non acconsento"))}
${placeDate}
${sign("Firma dell’interessato")}

<div class="pb"></div>
<h1>Questionario per l’identificazione e l’adeguata verifica del cliente</h1>
<p class="sub">D.Lgs. 21 novembre 2007, n. 231, ove applicabile</p>
<p>Il questionario è utilizzato per l’identificazione del contraente e del titolare effettivo, e per gli obblighi di adeguata verifica dei soggetti obbligati ai sensi del D.Lgs. 231/2007, ove applicabili al rapporto. Allegare copia di un documento di identità in corso di validità del dichiarante e la visura (o documento equivalente) del contraente.</p>
<h3>A) Dichiarante</h3>
${row(f("Cognome e nome", "w3", "dichiarante"), f("Luogo e data di nascita", "w2", "dichiarante_nascita"))}
${row(f("Documento d’identità (tipo, numero, scadenza)", "w3", "dichiarante_doc"), f("Codice fiscale", "w2", "firmatario_cf"))}
<div class="opts"><b>Ruolo rispetto al contraente:</b> ${cb("Legale rappresentante")} ${cb("Procuratore")} ${cb("Rappresentante fiscale in Italia")}</div>
<h3>B) Contraente</h3>
${row(f("Denominazione", "w3", "contraente"), f("Paese e numero di registrazione", "w2", "registro"))}
${row(f("Sede legale", "w3", "sede"), f("Partita IVA italiana / codice fiscale", "w2", "cf"))}
${row(f("Attività economica", "w3"))}
${owner(1)}
${owner(2)}
${owner(3)}
<h3>D) Persone politicamente esposte</h3>
${stack("Il titolare effettivo e/o il legale rappresentante NON sono persone politicamente esposte", "Il titolare effettivo e/o il legale rappresentante SONO persone politicamente esposte (specificare): ____________________")}
<h3>E) Scopo e natura del rapporto</h3>
<p>Rilascio della garanzia di cui all’art. 35, comma 7-quater, D.P.R. 633/1972, connessa all’identificazione ai fini IVA in Italia per l’attività di vendita ______________________ (es. e-commerce su marketplace).</p>
<div class="keep"><h3>Dichiarazione</h3>
<p>Il sottoscritto dichiara, sotto la propria responsabilità, che le informazioni fornite sono complete e veritiere. Si impegna inoltre a comunicare tempestivamente ogni variazione. Il dichiarante è consapevole che, ai sensi dell’art. 55, comma 3, del D.Lgs. 231/2007, chi, essendo obbligato a fornire i dati e le informazioni necessari ai fini dell’adeguata verifica, fornisce dati falsi o informazioni non veritiere è punito, salvo che il fatto costituisca più grave reato, con la reclusione da sei mesi a tre anni e con la multa da 10.000 a 30.000 euro.</p>
${placeDate}
${sign("Firma del dichiarante", "Firma dell’intermediario")}</div>
`;
}
