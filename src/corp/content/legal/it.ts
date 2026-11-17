// Privacy e Cookie del sito aziendale, in italiano. Fatti verificati il 16/11/2026 sul codice e sulla configurazione:
// il modulo e' ricevuto dalla funzione del portale (regione dub1, vercel.json), salvato nella tabella
// contact_requests (cancellazione dopo 24 mesi), inoltrato per email; l'indirizzo IP non si salva (contatori con
// impronta a chiave); la scelta sui cookie dura 180 giorni (src/site/consent-core.ts).
import type { CorpLegal } from "./index";

const when = <T>(condition: boolean, ...items: T[]): T[] => (condition ? items : []);

export const legalIt = (measurement: boolean): CorpLegal => ({
  updated: "Ultimo aggiornamento:",
  noticeLabel: "informativa generale di Tecno Advance MGA Broker",
  privacy: {
    sections: [
      {
        title: "Chi tratta i tuoi dati",
        paragraphs: [
          "Il titolare del trattamento è Tecno Advance MGA Broker Srl, con sede legale in Via Po, 102 - 00198 Roma, P.IVA 17460381001, intermediario assicurativo iscritto al Registro Unico degli Intermediari con il n. B000746484.",
          "Per qualsiasi domanda sui tuoi dati puoi scrivere al responsabile della protezione dei dati (DPO), antoncarlo@tecnomga.com, o alla sede legale.",
          "Questa informativa riguarda il sito tecnomga.com e il suo modulo di richiesta preventivo. Per i rapporti contrattuali vale l'{notice}.",
        ],
        list: [],
      },
      {
        title: "Quali dati raccogliamo",
        paragraphs: [
          "Con la richiesta di preventivo non salviamo il tuo indirizzo IP. Per impedire gli abusi del modulo il sistema ne ricava un codice cifrato, da cui non si può risalire all'indirizzo, e lo conserva al massimo per un giorno.",
          "Dal modulo non chiediamo e non vogliamo ricevere dati particolari, per esempio sulla salute, né documenti: quelli che servono per una quotazione te li indichiamo dopo aver ricevuto la richiesta.",
        ],
        list: [
          "Dati che scrivi nel modulo di richiesta preventivo: nome e cognome, email, il testo del messaggio e, se li indichi, società, telefono e prodotto. Registriamo anche la lingua e la pagina da cui hai inviato la richiesta.",
          "Dati di navigazione: indirizzo IP, tipo di browser, pagine richieste, data e ora. Li registrano in modo automatico i sistemi che ospitano il sito, per farlo funzionare e proteggerlo.",
          measurement ? "Preferenze salvate nel tuo browser: la scelta sui cookie e quella sulla lingua." : "Preferenze salvate nel tuo browser: la scelta sulla lingua.",
          ...when(measurement, "Dati raccolti da Google Analytics, solo se hai dato il consenso: sono descritti nella pagina {cookie}."),
        ],
      },
      {
        title: "Perché li trattiamo e su quale base",
        paragraphs: [
          "Non usiamo i dati del modulo per inviarti newsletter o comunicazioni commerciali che non hai chiesto, e non prendiamo decisioni basate unicamente su trattamenti automatizzati.",
          "I campi obbligatori del modulo servono a risponderti: senza, non possiamo ricontattarti.",
        ],
        list: [
          "Rispondere alla tua richiesta e preparare la quotazione che chiedi: sono misure precontrattuali adottate su tua richiesta (art. 6, par. 1, lett. b, del Regolamento UE 2016/679).",
          "Far funzionare il sito, proteggerlo e impedire gli abusi del modulo: è un nostro legittimo interesse (art. 6, par. 1, lett. f).",
          ...when(measurement, "Statistiche di visita con Google Analytics: solo con il tuo consenso (art. 6, par. 1, lett. a), che puoi revocare in ogni momento da «Preferenze sui cookie» nel piè di pagina."),
        ],
      },
      {
        title: "Per quanto tempo li conserviamo",
        paragraphs: [],
        list: [
          "Richieste di preventivo: 24 mesi dall'invio, poi sono cancellate in modo automatico dall'archivio in cui le conserviamo. Se dalla richiesta nasce un rapporto contrattuale, i dati sono trattati secondo l'informativa generale.",
          "Email con la richiesta, nella casella di posta del titolare: per il tempo necessario a gestirla.",
          "Dati di navigazione: per i tempi tecnici dei registri del fornitore che ospita il sito.",
          ...when(measurement, "Scelta sui cookie: sei mesi nel tuo browser, poi la chiediamo di nuovo."),
        ],
      },
      {
        title: "Chi riceve i dati",
        paragraphs: [
          "I dati sono trattati dal personale autorizzato del titolare e dai fornitori che gli prestano servizi tecnici, come responsabili del trattamento:",
          "Alcuni di questi fornitori hanno sede negli Stati Uniti. Quando un trattamento comporta un trasferimento di dati fuori dallo Spazio economico europeo, avviene con le garanzie previste dagli articoli 45 e 46 del Regolamento: decisione di adeguatezza per i soggetti certificati al Data Privacy Framework oppure clausole contrattuali tipo.",
          "Non vendiamo i tuoi dati e non li comunichiamo ad altri soggetti, salvo che lo richieda la legge o un'autorità. Se dalla richiesta nasce un contratto, i dati necessari sono comunicati alla compagnia di assicurazione, come descritto nell'informativa generale.",
        ],
        list: [
          "Vercel Inc.: ospita il sito; la funzione che riceve il modulo è eseguita nel suo centro dati di Dublino (Irlanda).",
          "Supabase Inc.: ospita la banca dati in cui sono salvate le richieste, nel centro dati in Irlanda.",
          "Google (Google Workspace) e Resend: servizi di posta elettronica con cui la richiesta arriva alla casella del titolare.",
          ...when(measurement, "Google Ireland Limited: Google Analytics, solo se hai dato il consenso."),
          "Functional Software Inc. (Sentry): riceve gli errori tecnici imprevisti della funzione che riceve il modulo, senza i dati del modulo; i suoi sistemi sono in Germania.",
        ],
      },
      {
        title: "I tuoi diritti",
        paragraphs: [
          "Puoi chiedere in ogni momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del trattamento e la portabilità, e puoi opporti al trattamento fondato sul legittimo interesse (articoli da 15 a 22 del Regolamento). Se hai dato un consenso puoi revocarlo, senza effetti su ciò che è stato fatto prima.",
          "Per esercitare i tuoi diritti scrivi a antoncarlo@tecnomga.com o alla sede legale. Rispondiamo entro un mese, come prevede l'art. 12 del Regolamento.",
          "Se ritieni che il trattamento violi il Regolamento puoi proporre reclamo al Garante per la protezione dei dati personali (https://www.garanteprivacy.it/) o all'autorità di controllo del Paese in cui vivi o lavori.",
        ],
        list: [],
      },
      {
        title: "Modifiche a questa informativa",
        paragraphs: ["Aggiorniamo questa pagina quando cambiano i trattamenti o i fornitori. La data dell'ultimo aggiornamento è indicata in fondo alla pagina."],
        list: [],
      },
    ],
  },
  cookie: {
    intro: [
      {
        title: "Cosa sono",
        paragraphs: [
          "I cookie sono piccoli file che un sito salva nel tuo browser. Strumenti simili, come l'archivio locale del browser, servono allo stesso scopo: ricordare qualcosa tra una pagina e l'altra. Questa pagina elenca ciò che il sito tecnomga.com salva nel tuo browser, e perché.",
        ],
        list: [],
      },
      {
        title: "Cosa usiamo",
        paragraphs: measurement
          ? [
              "Il sito non usa cookie di profilazione propri. Usa strumenti tecnici per ricordare le tue scelte e, solo se acconsenti, Google Analytics per le statistiche di visita.",
              "Prima della tua scelta, e dopo un rifiuto, nessuno script di Google viene caricato. Se rifiuti, il sito funziona allo stesso modo.",
            ]
          : ["Il sito non usa cookie di profilazione né strumenti di misurazione. Salva nel tuo browser soltanto la scelta sulla lingua, per non riproporti l'avviso."],
        list: [],
      },
    ],
    tableTitle: "Elenco",
    columns: { name: "Nome", purpose: "A cosa serve", duration: "Durata", owner: "Di chi è" },
    rows: [
      ...when(measurement, { name: "tecno-consent-v1 (archivio locale)", purpose: "Necessario. Ricorda la tua scelta sui cookie.", duration: "6 mesi", owner: "Tecno MGA" }),
      { name: "tecno-lang-choice (archivio locale)", purpose: "Necessario. Ricorda che hai scelto la lingua, per non riproporti l'avviso.", duration: "Finché non cancelli i dati del browser", owner: "Tecno MGA" },
      ...when(
        measurement,
        { name: "_ga", purpose: "Statistiche, solo con il consenso. Google Analytics: distingue i visitatori.", duration: "2 anni", owner: "Google" },
        { name: "_ga_<ID>", purpose: "Statistiche, solo con il consenso. Google Analytics: mantiene lo stato della visita.", duration: "2 anni", owner: "Google" },
      ),
    ],
    after: [
      measurement
        ? {
            title: "Come cambiare la scelta",
            paragraphs: [
              "Puoi cambiare idea in ogni momento con «Preferenze sui cookie» nel piè di pagina: la nuova scelta vale subito, e con il rifiuto i cookie di Google Analytics salvati dal sito vengono cancellati. Puoi anche cancellare i cookie dalle impostazioni del browser.",
            ],
            list: [],
          }
        : {
            title: "Nessuna scelta da fare",
            paragraphs: ["Il sito non salva nulla che richieda il tuo consenso: per questo non compare nessun banner. Puoi comunque cancellare i dati salvati dalle impostazioni del browser."],
            list: [],
          },
      {
        title: "Chi tratta i dati",
        paragraphs: [`Il titolare è Tecno Advance MGA Broker Srl.${measurement ? " I dati raccolti da Google Analytics sono trattati anche da Google Ireland Limited." : ""} Per tutto il resto leggi la pagina {privacy}.`],
        list: [],
      },
    ],
  },
});
