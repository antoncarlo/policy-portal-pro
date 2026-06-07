# Verifica Supabase orchestratore VIES

## Contesto

Il progetto Supabase verificato è `nesblhtjqiavdfsrtfom`, associato alla dashboard `antoncarlo's Project`. L’accesso è stato completato via browser perché il connettore MCP Supabase continuava a fallire in OAuth con errore `Required parameter: client_secret`.

## Migrazioni applicate

Sono state applicate tramite SQL Editor Supabase le migrazioni VIES consolidate nello script locale:

| File | Scopo |
|---|---|
| `supabase/migrations/20260607_create_vies_batch_queue.sql` | Crea bucket privato, tabelle VIES, indici, vincoli e policy RLS/storage. |
| `supabase/migrations/20260607_vies_orchestrator_functions.sql` | Crea le funzioni RPC operative per orchestratore, claim, completamento, errore, retry e annullamento. |
| `supabase/migrations/20260607_apply_vies_full_orchestrator_safe.sql` | Versione unica, idempotente e sicura usata per l’applicazione via SQL Editor. |

## Evidenze database raccolte

La query di verifica non distruttiva eseguita nello SQL Editor ha confermato i seguenti risultati visibili nella griglia Supabase:

| Oggetto verificato | Evidenza |
|---|---|
| `public.vies_batches` | Presente. |
| `public.vies_jobs` | Presente. |
| `public.vies_batch_documents` | Presente. |
| `refresh_vies_batch_counters(uuid)` | Presente. |
| `enqueue_vies_batch(uuid)` | Presente. |
| `claim_vies_jobs(text,integer,integer)` | Presente. |
| `complete_vies_job(uuid,text,text,jsonb)` | Presente. |
| `fail_vies_job(uuid,text,text,text,integer,jsonb)` | Presente. |
| `block_vies_job(uuid,text,text)` | Presente. |
| `retry_vies_job(uuid)` | Presente. |
| `cancel_vies_batch(uuid,text)` | Presente. |
| Bucket `vies-batch-files` | Presente e privato (`true`). |
| Policy RLS pubbliche VIES | `12`. |
| Policy Storage VIES | `4`. |

## Evidenze locali raccolte

| Verifica | Esito |
|---|---|
| `npm run build` | Passato con exit code `0`; rimane solo warning Vite su chunk grande e browserslist obsoleto. |
| `npx tsc --noEmit` | Passato con exit code `0`. |
| `npm run lint` | Non pulito per errori preesistenti del repository non riconducibili ai nuovi file VIES, come già rilevato nella verifica precedente. |

## Limiti residui

L’applicazione dello schema database è confermata, ma l’orchestratore in produzione richiede ancora la configurazione delle variabili ambiente su Vercel. In particolare devono essere presenti `SUPABASE_SERVICE_ROLE_KEY` e almeno uno tra `CRON_SECRET` e `VIES_WORKER_SECRET`. Per una prima prova controllata è consigliato impostare `VIES_AGENT_DRY_RUN=true`.

## Prossimi passaggi consigliati

| Passaggio | Azione |
|---|---|
| Configurazione Vercel | Impostare le variabili ambiente richieste e ridistribuire. |
| Test operativo | Creare un piccolo batch VIES, avviare il worker manualmente dalla UI e controllare transizioni `queued`, `processing`, `completed` o `failed`. |
| Adapter reale | Quando il portale esterno è pronto, configurare `VIES_AGENT_ENDPOINT` e `VIES_AGENT_API_KEY`; fino ad allora usare dry-run. |
| Osservabilità | Controllare log Vercel per `/api/cron-vies-orchestrator` e `/api/vies-control` durante il primo test. |
