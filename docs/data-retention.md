# Conservazione dei dati e registri

*Quanto restano i registri del portale, quando gli indirizzi IP diventano anonimi e come verificarlo. Vale per il database di produzione; le regole stanno in `supabase/migrations/20261022_retention.sql`.*

## SECTION 01 — Cosa succede ogni notte

Alle **02:15 UTC** `pg_cron` esegue `select public.run_retention()` (job `portal-retention`). Il risultato (quante righe per tabella) è l'esito della funzione; per i job passati: `select * from cron.job_run_details order by start_time desc limit 10;`.

| Registro | IP / dati personali | Cancellazione |
|---|---|---|
| `api_logs` (chiamate delle API partner) | IP troncato dopo 30 giorni (`203.0.113.77` → `203.0.113.0`; IPv6 solo i primi 48 bit) | dopo 12 mesi |
| `email_logs` (ogni email inviata) | indirizzi e oggetti | dopo 24 mesi |
| `integration_events` (chiamate con i portali esterni) | contenuto delle richieste | dopo 12 mesi |
| `outbound_deliveries` (notifiche verso i partner) | contenuto delle notifiche | consegnate dopo 6 mesi, fallite dopo 12 |
| `notification_events` (coda delle notifiche) | — | elaborate: dopo 30 giorni |
| `rate_limit_hits` (contatori dei limiti) | indirizzi nelle chiavi | dopo 1 giorno |
| `audit_log` (chi ha fatto cosa) | IP troncato e browser rimosso dopo 12 mesi | pratiche, clienti, documenti: 10 anni; il resto: 2 anni |

Il registro di audit resta **append-only**: l'unica modifica che il database consente su una riga è togliere IP e browser (e solo durante la pulizia notturna); nessuno può cambiare o cancellare altro, nemmeno con la chiave di servizio.

**Non toccati**: pratiche, clienti, documenti e le loro scadenze. La conservazione dell'archivio (10 anni dalla scadenza della polizza) è una decisione a parte e non è automatica.

## SECTION 02 — Cambiare le regole

Le durate sono nel testo di `run_retention()` e di `purge_old_audit_log()`. Per cambiarle: nuova migrazione con `create or replace function`, rivista come ogni altra modifica. Le funzioni di pulizia non sono chiamabili dagli utenti del portale né dall'API pubblica (solo ruolo di servizio).

## SECTION 03 — Verifica

```sql
select jobid, schedule, command, active from cron.job where jobname = 'portal-retention';
select public.run_retention();   -- da eseguire a mano con la chiave di servizio
select public.pseudonymize_ip('203.0.113.77');   -- 203.0.113.0
```

## SECTION 04 — Note

- Su Supabase la pulizia gira nel database (pg_cron): non dipende da Vercel e non consuma i cron giornalieri del piano Hobby.
- Un indirizzo già reso anonimo non viene ritoccato (la funzione è idempotente).
- **Esportazione** dei dati di un singolo interessato (GDPR art. 15/20): dal dettaglio cliente, «Esporta dati (GDPR)» (JSON con anagrafica, pratiche, storico, elenco documenti, email inviate; i file dei documenti non sono inclusi). Ogni esportazione è nel registro di audit.
- **Cancellazione** (art. 17): le pratiche e i dati contrattuali si conservano per il tempo previsto dalla normativa assicurativa, quindi non si cancellano a richiesta prima della scadenza di quel termine; i clienti della rubrica senza pratiche si possono eliminare da Clienti. Una richiesta di cancellazione va valutata caso per caso dal titolare del trattamento.
