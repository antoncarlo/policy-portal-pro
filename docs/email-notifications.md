# Notifiche email delle pratiche

*Chi riceve una email quando una pratica cambia stato o viene caricata, e come l'amministratore sceglie indirizzi ed eventi per ogni utente.*

## SECTION 01 — Come funziona

Il database mette in coda un evento a ogni fatto che riguarda una pratica, **qualunque strada lo produca** (portale, API, portale della compagnia, azione dell'amministratore). Il server legge la coda, decide a chi scrivere e invia email personali.

| Evento | Quando | Tabella |
|---|---|---|
| `practice_created` | pratica caricata (anche da API o da lotto VIES) | `notification_events` |
| `status_changed` | cambia lo stato o l'incasso | `notification_events` |
| `documents_added` | documento aggiunto a una pratica esistente | `notification_events` |
| `note_changed` | cambiano le note | `notification_events` |

La bozza deliberata e la polizza emessa viaggiano con il cambio di stato (nessuna email a parte). I documenti caricati insieme alla pratica (entro 30 minuti) fanno parte della email «nuova pratica».

## SECTION 02 — Chi riceve cosa

| Evento | Destinatari |
|---|---|
| Cambio di stato | il titolare della pratica e il suo **agente di riferimento**; anche gli amministratori, se a cambiare lo stato non è stato un amministratore (portale della compagnia, API, sistema) |
| Nuova pratica | tutti gli **amministratori**, l'agente di riferimento di chi l'ha caricata, e le caselle fisse `ADMIN_NOTIFICATION_EMAILS` |
| Documenti, note | amministratori, agente di riferimento e titolare |

Chi ha causato l'evento non riceve mai l'email su di esso. Gli amministratori che hanno caricato documenti dopo un'integrazione richiesta ricevono il promemoria di segnare le integrazioni come fornite.

Esempio (cambio di stato in «deliberata»):

> **Pratica n. PR-2026-0412: deliberata**
> Gentile Carlo Collaboratore, la pratica n. PR-2026-0412 (Auto · Rossi Marco) è stata deliberata. Entra nel portale per controllare le azioni da fare: scarica la bozza e procedi al pagamento entro il 20/12/2026.

Il testo cambia per ognuna delle sette sezioni (integrazioni richieste con il testo della richiesta, non deliberata con il motivo, pagamento registrato, polizza emessa…) ed è uguale per tutte le tipologie di pratica. Lingua dell'email = lingua del profilo del destinatario (italiano, inglese, cinese).

**Più eventi, una sola email.** Più cambi di stato per la stessa persona nella stessa elaborazione diventano un'unica email con l'elenco (massimo 15 righe, poi «… e altre N»). Un lotto VIES di 3000 pratiche è una sola email per amministratore. Una pratica che torna dov'era (stessa sezione di partenza e di arrivo) non genera nulla.

## SECTION 03 — Scelte dell'amministratore

**Gestione Utenti → ⋮ → Notifiche email** (solo amministratori), per ogni utente:

- fino a **3 indirizzi** a cui inviare le notifiche; senza indirizzi si usa l'email di accesso;
- quali eventi inviare: cambio di stato, nuove pratiche, documenti, note;
- **Invia email di prova** agli indirizzi salvati.

L'utente può inoltre disattivare gli avvisi dalle proprie *Impostazioni → Preferenze*: entrambe le scelte valgono.

Impostazioni in `user_notification_settings` (solo l'amministratore le legge e le scrive; richiede la verifica a due fattori se attiva). Senza riga valgono i valori di partenza: email di accesso, tutti gli eventi attivi.

## SECTION 04 — Quando partono

- **Subito**: al termine di ogni azione il browser chiede al server di inviare (`flush_notifications` su `/api/portal-actions`), e i flussi del server (azioni dell'amministratore, risposte della compagnia, invio dei lotti, API polizze) inviano da sé.
- **Ciclo giornaliero** (`/api/cron-vies-orchestrator`): invia quello che fosse rimasto. Il piano Hobby di Vercel consente solo un ciclo al giorno.
- Se l'invio fallisce l'evento resta in coda e riprova (massimo 5 tentativi); gli eventi più vecchi di 3 giorni non vengono inviati.
- Ogni email è registrata in `email_logs` (stato `sent` o `failed`, con il motivo).

Il canale email è quello già configurato (`GMAIL_USER`/`GMAIL_APP_PASSWORD` oppure `RESEND_API_KEY`). `PORTAL_URL` fissa l'indirizzo dei link.

## SECTION 05 — Variabili

| Variabile | Effetto |
|---|---|
| `ADMIN_NOTIFICATION_EMAILS` | caselle fisse che ricevono **le nuove pratiche** (come prima: `info@tecnomga.com`, `antoncarlo@tecnomga.com`). `none` le disattiva. Non ricevono le email di chi ha caricato la pratica né duplicati degli indirizzi scelti dagli amministratori |

## SECTION 06 — Limiti noti

- Una nuova deliberazione su una pratica già deliberata (nuova bozza, nuova scadenza) non cambia stato: non genera email; è comunque nello storico e viene comunicata alla compagnia o al partner.
- Il cambio di stato in blocco dall'elenco pratiche avviene senza passare dal flusso (non avvisa compagnia e partner), ma genera le email come gli altri cambi.
- Con il solo ciclo giornaliero, un evento non seguito dall'invio immediato (per esempio una pratica modificata direttamente nel database) parte al ciclo successivo.
