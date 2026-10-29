# Monitoraggio, errori e controllo della configurazione

*Cosa succede quando qualcosa si rompe, chi lo viene a sapere e come controllare che il portale sia configurato. Nessun servizio esterno è obbligatorio.*

## SECTION 01 — Pagina di errore

Un errore imprevisto mentre si disegna una pagina non lascia più lo schermo bianco: compare una pagina con «Riprova», «Torna alla dashboard» e «Ricarica la pagina», un riferimento da citare all'assistenza e il dettaglio tecnico. Cambiando pagina il portale riprova da solo. Gli errori che nessuno intercetta (fuori da React, promesse fallite) finiscono nella console del browser.

## SECTION 02 — Sentry (facoltativo)

| Variabile | Dove | Effetto |
|---|---|---|
| `VITE_SENTRY_DSN` | Vercel, sola produzione (si rilegge a ogni build) | gli errori del browser vengono inviati a Sentry |
| `SENTRY_DSN` | Vercel, sola produzione | gli errori inattesi delle funzioni (risposte 5xx di `/api/portal-actions`, `/api/vies-connect`, cron interrotti) vengono inviati a Sentry |

Un DSN ha la forma `https://chiave@o123.ingest.de.sentry.io/456`. Senza DSN non parte nulla. L'invio è una singola richiesta (senza SDK): l'evento ha messaggio, stack (in «Additional data»), pagina o funzione, id utente e versione; lo stesso errore dal browser è inviato una volta sola e al massimo 5 al minuto (20 al minuto dalle funzioni). La CSP consente `*.ingest.sentry.io`, `*.ingest.de.sentry.io` e `*.ingest.us.sentry.io`.

## SECTION 03 — Avvisi agli amministratori

- **Attività automatica interrotta** (cron email, ciclo VIES): email subito.
- **Riepilogo giornaliero** (03:30 UTC): include i problemi di configurazione bloccanti ogni giorno e gli avvisi di configurazione il lunedì.

## SECTION 04 — `/api/health`

- `GET /api/health` (pubblico): `{ "status": "ok" | "down", "database": "ok" | "down" | "unconfigured", "time": … }`. Risponde 503 se il database non risponde o manca la configurazione essenziale: adatto a un monitor esterno (UptimeRobot, Better Stack…).
- Con `Authorization: Bearer <CRON_SECRET>` aggiunge la versione e il rapporto sull'ambiente: variabili mancanti o malformate (solo i nomi e il motivo, mai i valori) e quali funzioni sono attive (canale email, rapporti di recapito, cron, API partner, connettore VIES, monitoraggio).

```bash
curl -s https://portale.tecnomga.com/api/health
curl -s -H "Authorization: Bearer $CRON_SECRET" https://portale.tecnomga.com/api/health | jq .environment
```

## SECTION 05 — Cosa viene controllato

Bloccanti: indirizzo del database (https) e chiave di servizio. Avvisi: nessun canale email (Gmail o Resend), `CRON_SECRET` e `WEBHOOK_SECRET` mancanti o corti (< 16 caratteri), `WEBHOOK_DEFAULT_USER_ID` non UUID, `PORTAL_URL` non https, `VIES_PORTALS` non JSON, `ADMIN_NOTIFICATION_EMAILS` con indirizzi non validi, `RESEND_WEBHOOK_SECRET` mancante con Resend, `SENTRY_DSN` malformato. Le regole sono in `api/_lib/env.ts` (zod).

## SECTION 06 — Accessi falliti

Quando la schermata di accesso del portale respinge un indirizzo o una password, il browser lo segnala a `/api/login-failure`: nel registro di audit (Impostazioni › Log, azione «Accesso non riuscito») compare una riga con l'indirizzo digitato, l'indirizzo IP, il browser e se l'indirizzo corrisponde a un account. **La password non viene mai inviata al portale.** Se lo stesso indirizzo fallisce cinque volte in dieci minuti gli amministratori ricevono un avviso (una volta l'ora per indirizzo, al massimo dieci avvisi l'ora in tutto).

Limiti da conoscere:

- L'accesso lo fa Supabase direttamente dal browser: un tentativo fatto contro l'indirizzo di autenticazione di Supabase senza passare dalla schermata del portale non viene segnalato e resta solo nel registro di autenticazione di Supabase (Dashboard › Logs › Auth). Il controllo a livello di Supabase («Password verification hook») è disponibile solo nei piani Teams ed Enterprise.
- La segnalazione è pubblica, quindi falsificabile: serve a leggere e a farsi avvisare, mai a bloccare un account. Si accettano 30 segnalazioni ogni dieci minuti per indirizzo IP e si scrivono al massimo 20 righe ogni dieci minuti per indirizzo.
- Gli accessi riusciti e le uscite sono già nel registro (azioni «Accesso» e «Uscita»).

## SECTION 07 — Costo dell'agent documentale VIES

Ogni lettura dell'agent documentale (`vies-document-agent`) scrive nei log della funzione una riga `vies_agent_reading` con modello, token in entrata e in uscita, pagine inviate, dimensione, durata ed esito (mai il nome del file). Nei log Supabase (Logs › Explorer, oppure `query_logs`; finestra massima di 24 ore) questa query dà letture, errori, token, costo in dollari ai prezzi di listino (2 $ per milione di token in entrata, 10 $ in uscita) e durata media:

```sql
select JSONExtractString(event_message, 'model') as modello,
       count() as letture,
       countIf(JSONHas(event_message, 'error')) as errori,
       sum(JSONExtractInt(event_message, 'input_tokens')) as token_in,
       sum(JSONExtractInt(event_message, 'output_tokens')) as token_out,
       round(sum(JSONExtractInt(event_message, 'input_tokens')) * 2 / 1e6
           + sum(JSONExtractInt(event_message, 'output_tokens')) * 10 / 1e6, 2) as usd,
       round(avg(JSONExtractInt(event_message, 'ms')) / 1000, 1) as secondi_medi
from logs
where source = 'function_logs' and event_message like '{"event":"vies_agent_reading"%'
group by modello
```

Si raggruppa per modello perché, con il fallback lato server, una lettura rifiutata può essere completata da un altro modello, con un altro prezzo. Il costo del questionario antiriciclaggio (`vies-aml-agent`) è nelle righe `vies_aml_reading`, con gli stessi campi dei token. Il saldo del credito non è leggibile con la chiave dell'agent: si controlla nella Console Anthropic (Billing), dove conviene attivare la ricarica automatica o l'avviso di saldo basso.
