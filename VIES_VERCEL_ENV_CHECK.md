# Verifica variabili ambiente Vercel per orchestratore VIES

Data verifica: 2026-06-07

La pagina **Environment Variables** del progetto Vercel `policy-portal-pro` è accessibile e mostra le seguenti variabili rilevanti per l'orchestratore VIES, senza esposizione dei valori:

| Variabile | Stato osservato | Note |
|---|---:|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Presente | Variabile necessaria per operazioni server-side Supabase. |
| `VIES_WORKER_SECRET` | Presente | Può autenticare l'endpoint cron/worker in alternativa a `CRON_SECRET`, se il codice lo supporta. |
| `VIES_AGENT_DRY_RUN` | Presente | Necessaria per test controllato senza chiamate reali al portale esterno. |
| `VIES_PORTAL_URL` | Presente | Necessaria quando si disattiva dry-run per collegare l'adapter al portale esterno. |
| `VIES_SECRET` | Presente | Variabile aggiuntiva rilevata; verificare nel codice se è usata come alias o residuo. |
| `CRON_SECRET` | Non visibile tra i nomi rilevanti osservati | Non strettamente necessaria se `VIES_WORKER_SECRET` è configurata e supportata dal codice. |

Conclusione provvisoria: le variabili richieste per il deploy e il test dry-run risultano presenti, con autenticazione worker disponibile tramite `VIES_WORKER_SECRET`. Non sono stati rivelati né copiati valori segreti.

## 2026-06-07 — Verifica deploy dopo push VIES

Il commit `8f71ed0` è stato confermato su GitHub `main`, ma non è comparso immediatamente un nuovo deployment automatico nella lista deployment Vercel consultata via connettore. È stato quindi tentato un deployment esplicito tramite Vercel CLI. L’autorizzazione dispositivo Vercel CLI è stata completata con successo nel browser.

Il deployment CLI è stato bloccato prima della build da un vincolo del piano Vercel Hobby: la configurazione `vercel.json` contiene una schedulazione cron `*/15 * * * *` per `/api/cron-vies-orchestrator`, ma il piano corrente accetta solo cron giornalieri. Per rendere deployabile la versione corrente senza modificare dati o segreti, la mitigazione operativa è adattare il cron VIES a frequenza giornaliera e mantenere l’avvio manuale tramite pagina/endpoint di controllo per elaborazioni on-demand.
