# Changelog

Tutte le modifiche rilevanti del portale. Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni [SemVer](https://semver.org/lang/it/).

## [1.0.0] — 2026-10-11

Prima versione numerata. Riepilogo di ciò che il portale fa oggi:

- Pratiche di tutte le tipologie con sette sezioni di flusso, valutazione manuale o tramite il portale della compagnia, documenti, note e storico.
- Connettori bidirezionali firmati con i portali esterni e i rappresentanti fiscali (lotti VIES in ingresso, bozze e risposte in uscita).
- Notifiche email personali per cambio di stato, nuove pratiche, documenti e note, con indirizzi ed eventi scelti dall'amministratore per ogni utente.
- Autenticazione con verifica a due fattori facoltativa, password robuste, reset sicuro, interfaccia in italiano, inglese e cinese.
- Controllo dei tipi nella build, CI su ogni modifica, `docs/` come unica cartella di documentazione.

### Corretto
- Amministrazione: premio ed esportazione leggevano un campo che non esiste più (`premium_amount`, ora `premium_net`); il salvataggio delle modifiche contabili veniva rifiutato.
- Report: le colonne premio/provvigione dell'esportazione Excel/PDF erano vuote; i grafici per mese e la classifica agenti non ricevevano i campi attesi.

### Rimosso
- Funzioni segnaposto: sessioni finte, backup automatico e ripristino finti, statistiche inventate nella pagina pubblica, stima dello spazio a 0,5 MB per documento.
- Funzione Edge `create-user` (sostituita da `/api/portal-actions`).
