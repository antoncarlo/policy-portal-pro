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
