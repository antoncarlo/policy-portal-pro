# Sezione VIES e orchestratore batch/job

La sezione **VIES** è stata integrata in Policy Portal Pro come area dedicata del menu principale. Il flusso applicativo consente di caricare un file Excel e un archivio ZIP, leggere le righe del tracciato, indicizzare i documenti anche in presenza di ZIP annidati, validare i requisiti documentali minimi e salvare un batch persistente su Supabase. Il sistema prepara quindi una coda di job lavorabile da un orchestratore server-side.

Il flusso operativo è: caricamento Excel, caricamento ZIP documentale, lettura del primo foglio Excel, riconoscimento delle intestazioni, estrazione delle righe contraente, scansione ricorsiva dello ZIP, normalizzazione dei nomi documento, verifica del set documentale VIES e creazione di batch, job e indice documentale su database.

| Livello | Oggetto | Responsabilità |
|---|---|---|
| Interfaccia | `src/pages/Vies.tsx` | Caricamento Excel/ZIP, validazione preliminare, salvataggio batch e monitoraggio stato. |
| Database | `vies_batches`, `vies_jobs`, `vies_batch_documents` | Persistenza di lotti, pratiche operative e mappa documentale. |
| RPC Supabase | `claim_vies_jobs`, `complete_vies_job`, `fail_vies_job`, `retry_vies_job`, `cancel_vies_batch` | Transizioni atomiche, retry, contatori e lock dei job. |
| API Vercel | `api/vies-control.ts`, `api/cron-vies-orchestrator.ts` | Controlli manuali da UI e ciclo cron dell’orchestratore. |
| Adapter agent | `api/_lib/vies-orchestrator.ts` | Esecuzione controllata del job verso dry-run o portale esterno configurabile. |

## Set documentale iniziale

Il set documentale VIES iniziale comprende polizza fideiussoria, beneficiario firmato, documenti identità del titolare effettivo o rappresentante legale, certificato partita IVA, UBO e financials, dichiarazione sostitutiva, licenza commerciale, mandato di rappresentanza fiscale, cassetto fiscale e documenti correlati alla fideiussione.

## Migrazioni Supabase

Sono presenti due migrazioni da applicare in ordine. La prima crea le strutture base, il bucket privato e le policy RLS; la seconda aggiunge colonne runtime, indici e funzioni RPC dell’orchestratore.

| Ordine | File | Scopo |
|---:|---|---|
| 1 | `supabase/migrations/20260607_create_vies_batch_queue.sql` | Crea bucket `vies-batch-files`, tabelle `vies_batches`, `vies_jobs`, `vies_batch_documents`, trigger `updated_at`, indici e policy RLS. |
| 2 | `supabase/migrations/20260607_vies_orchestrator_functions.sql` | Aggiunge contatori e metadati runtime, funzioni atomiche di claim/completamento/fallimento/retry/cancel e ricalcolo contatori. |

Il connettore Supabase della sessione non ha potuto applicare direttamente le migrazioni perché l’OAuth fallisce con errore `Required parameter: client_secret`. Per procedere in produzione, copiare ed eseguire i due file SQL nell’editor SQL del progetto Supabase, nello stesso ordine indicato sopra. In alternativa, usare la CLI Supabase o un accesso amministrativo al database, purché le migrazioni vengano applicate nello stesso ordine.

## Variabili ambiente richieste

L’orchestratore usa il client Supabase server-side con service role e protegge gli endpoint operativi tramite autenticazione utente o segreto cron/worker. In Vercel devono essere configurate le seguenti variabili.

| Variabile | Obbligatoria | Uso |
|---|---:|---|
| `VITE_SUPABASE_URL` | Sì | URL del progetto Supabase, già usato anche dal frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sì | Accesso server-side per RPC, claim job e aggiornamenti protetti. |
| `CRON_SECRET` | Consigliata | Segreto bearer per chiamate cron/manuali non provenienti da Vercel Cron. |
| `VIES_WORKER_SECRET` | Consigliata | Segreto bearer dedicato a worker esterni o automazioni persistenti. |
| `VIES_AGENT_DRY_RUN` | Per test | Se impostata a `true`, il worker marca i job come completati senza chiamare portali esterni. |
| `VIES_PORTAL_API_URL` | Produzione | Endpoint dell’adapter verso il portale esterno quando non si usa dry-run. |
| `VIES_PORTAL_API_KEY` | Produzione | Credenziale bearer per l’adapter del portale esterno. |

## Comportamento dell’orchestratore

Il worker chiama `claim_vies_jobs` per prendere in carico in modo atomico un numero limitato di job `queued`, `ready` o `failed` con `next_attempt_at` scaduto. Ogni job viene bloccato con `locked_by`, `locked_at`, `assigned_agent`, incremento di `attempts` e stato `processing`. Al termine, `complete_vies_job` registra l’esito positivo e l’eventuale riferimento esterno; in caso di errore, `fail_vies_job` registra codice e messaggio e riaccoda il job con backoff esponenziale finché non raggiunge `max_attempts`.

Il cron Vercel è configurato in `vercel.json` su `/api/cron-vies-orchestrator` ogni 15 minuti. La UI permette inoltre di accodare un batch, eseguire un ciclo manuale, ritentare singoli job falliti o bloccati e annullare un batch.

## Stato attuale dell’agent portale esterno

L’adapter operativo è predisposto ma prudente: in assenza di `VIES_PORTAL_API_URL` e `VIES_PORTAL_API_KEY`, i job non vengono inviati a servizi esterni e vengono marcati come non configurati con errore non retryable. Per test funzionali senza invio reale, impostare `VIES_AGENT_DRY_RUN=true`. Per l’integrazione reale sarà necessario sostituire o collegare l’adapter HTTP con il flusso autorizzato del portale esterno, includendo gestione credenziali, tracciamento riferimento pratica e validazione della risposta.

## Verifiche eseguite

Sono state eseguite con esito positivo `npm run build` e `npx tsc --noEmit`. Il comando `npm run lint` non passa a causa di errori già diffusi nel repository, principalmente `no-explicit-any`, hook dependency warning e un `require()` in `tailwind.config.ts`; dal report estratto non risultano errori lint specifici sui nuovi file VIES.
