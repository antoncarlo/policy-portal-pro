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
