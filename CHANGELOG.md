# Changelog

Tutte le modifiche rilevanti del portale. Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni [SemVer](https://semver.org/lang/it/).

## [1.0.0] — 2026-10-11

Prima versione numerata. Riepilogo di ciò che il portale fa oggi:

- Pratiche di tutte le tipologie con sette sezioni di flusso, valutazione manuale o tramite il portale della compagnia, documenti, note e storico.
- Connettori bidirezionali firmati con i portali esterni e i rappresentanti fiscali (lotti VIES in ingresso, bozze e risposte in uscita).
- Notifiche email personali per cambio di stato, nuove pratiche, documenti e note, con indirizzi ed eventi scelti dall'amministratore per ogni utente.
- Autenticazione con verifica a due fattori facoltativa, password robuste, reset sicuro, interfaccia in italiano, inglese e cinese.
- Controllo dei tipi nella build, CI su ogni modifica, `docs/` come unica cartella di documentazione.

### Aggiunto
- Pratiche per lotto VIES: nel menu «Pratiche» i lotti si aprono sulle loro pratiche (ognuna col proprio numero); nell'elenco una riga per lotto con conteggio, rappresentante fiscale e riepilogo per sezione, vista «Per lotto / Elenco» ricordata, filtro sul lotto, ricerca per lotto, esportazione con le colonne del lotto; nel dettaglio il percorso «Pratiche › Lotto › numero» con pratica precedente/successiva. `practices.vies_batch_id`, `get_practice_lots()`; `/api/get-practices` espone `lot`.

- Uscita sicura degli utenti: prima di eliminare un account il portale mostra cosa possiede (pratiche, clienti, collaboratori, lotti, chiavi API) e lo passa a un altro utente con una riga nello storico di ogni pratica; un account che possiede ancora dati non si può eliminare (trigger sul database, 409 dall'API). `supabase/migrations/20261016_offboarding_guard.sql`, `api/_lib/offboarding.ts`.
- Registro di audit append-only (`audit_log`): trigger su pratiche, clienti, utenti, ruoli, permessi, chiavi API, webhook, documenti, impostazioni, rappresentanti fiscali e lotti registrano chi, quando, da dove e quali campi sono cambiati (valori prima/dopo; segreti mai registrati); azioni del portale (eliminazione utente, reset password, azioni del flusso, accessi/uscite) registrate dal server. Consultazione per l'amministratore in Impostazioni › Log, con filtri ed esportazione. Retention: 10 anni per pratiche, clienti e documenti, 2 anni per il resto (`purge_old_audit_log()`).

- Rate limit condiviso tra le istanze: i contatori sono nel database (`rate_limit_hit`, incremento atomico) e valgono per indirizzo e per endpoint (100/min), per chiave API (300/min) e per il recupero password (5 ogni 10 min per IP, 3 l'ora per indirizzo). Se il database non risponde si ripiega sul contatore dell'istanza. Indirizzo del chiamante dagli header della piattaforma (`x-vercel-forwarded-for`, `x-real-ip`).

- Registro di tutte le email (`email_logs`) e rapporti di recapito Resend (`/api/resend-webhook`): stati `delivered`, `delayed`, `bounced`, `complained`; rimbalzo definitivo o reclamo chiudono l'indirizzo (`email_suppressions`) e avvisano gli amministratori.
- Avvisi agli amministratori: consegne verso portali esterni fallite (una volta), attività automatiche interrotte, indirizzi non raggiungibili; riepilogo giornaliero di ciò che è ancora aperto.
- Termine delle integrazioni richieste: data da fornire (proposta a 7 giorni, modificabile; `due_date` anche nella risposta della compagnia e nella notifica ai partner), promemoria due giorni prima e avviso di ritardo agli amministratori il giorno dopo; scadenza visibile nella scheda Flusso.

- Rinnovo delle polizze: azione «Rinnova» nello scadenzario e nel dettaglio pratica; crea una pratica collegata (`practices.renewal_of`, una sola per pratica) con i dati del cliente e il periodo che parte dalla scadenza e dura quanto il precedente, con una riga nello storico di entrambe; la pratica rinnovata esce dai promemoria di scadenza. Tasso di rinnovo (ultimi 12 mesi e prossimi 90 giorni) nello scadenzario.

- Conservazione dei registri (`docs/data-retention.md`): ogni notte (pg_cron) `run_retention()` tronca gli IP dopo 30 giorni (api_logs) o 12 mesi (audit), cancella i registri oltre le durate stabilite (api_logs 12 mesi, email 24 mesi, eventi di integrazione 12 mesi, consegne 6/12 mesi, coda notifiche 30 giorni, audit 10 anni per pratiche, clienti e documenti e 2 anni per il resto). L'audit resta append-only.

### Corretto
- Amministrazione: premio ed esportazione leggevano un campo che non esiste più (`premium_amount`, ora `premium_net`); il salvataggio delle modifiche contabili veniva rifiutato.
- Report: le colonne premio/provvigione dell'esportazione Excel/PDF erano vuote; i grafici per mese e la classifica agenti non ricevevano i campi attesi.

- Webhook di creazione pratica: la firma HMAC è verificata sui byte esatti ricevuti (non più sul JSON riserializzato), quindi qualunque formattazione del JSON firmato come inviato è accettata. Per la transizione la firma sul JSON compatto riserializzato è ancora accettata con header `Warning: 299`; si disattiva con `WEBHOOK_REENCODED_SIGNATURE=off`.

### Rimosso
- Funzioni segnaposto: sessioni finte, backup automatico e ripristino finti, statistiche inventate nella pagina pubblica, stima dello spazio a 0,5 MB per documento.
- Funzione Edge `create-user` (sostituita da `/api/portal-actions`).
