# Ambiente di prova (sandbox) — guida operativa interna

*Come è fatta la sandbox del portale, a cosa serve e come si usa per il collaudo con la compagnia. Nessun dato della sandbox tocca la produzione.*

## 1. Com'è fatta

| | Produzione | Sandbox |
|---|---|---|
| Indirizzo | `https://portale.tecnomga.com` | `https://tecnosandbox.app` |
| Database Supabase | `nesblhtjqiavdfsrtfom` | `zwbvpfmdccbdockwksoy` (`policy-portal-sandbox`, Irlanda) |
| Codice | ramo `main` | ramo `sandbox` (stesso codice, aggiornato da `main`) |
| Vercel | ambiente *Production* | ambiente *Preview* del ramo `sandbox`, con variabili proprie |
| E-mail | attive | **spente** (nessun fornitore configurato): nessuna e-mail parte verso collaboratori o clienti |
| Attività giornaliere (cron) | attive | **non attive** (Vercel le esegue solo in produzione): i ritentativi delle consegne si fanno a mano con **Riprova** |
| Agent di lettura documenti | attivi | **non configurati**: i PDF con testo si riconoscono normalmente; le sole scansioni restano «non lette» |

Il database della sandbox ha **tutte le 75 migrazioni** del repository, applicate da zero il 27/10/2026, e gli stessi archivi dei file (`practice-documents`, `vies-batch-files`, `vies-lot-documents`, `signing-templates`) con gli stessi limiti della produzione. Rispetto alla produzione ha in più qualche oggetto storico che in produzione era stato tolto a mano (tabella `email_templates` e tre funzioni legate) e in meno la funzione `retention_logs`, creata a mano in produzione e non usata dal codice: nessuna delle due differenze cambia il funzionamento.

## 2. Utenti di prova

| Utente | Ruolo | Prodotti |
|---|---|---|
| `admin.sandbox@tecnomga.com` | Amministratore | VIES |
| `collaboratore.sandbox@tecnomga.com` | Collaboratore (rappresentante fiscale) | VIES |

Le password sono state consegnate a parte e non sono scritte nel repository. Gli utenti esistono solo nella sandbox.

## 3. Variabili Vercel del ramo `sandbox` (ambiente Preview, solo ramo `sandbox`)

| Variabile | Valore |
|---|---|
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | `https://zwbvpfmdccbdockwksoy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chiave pubblica (anon) del progetto sandbox |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave di servizio del progetto sandbox (**sensibile**: si copia dal pannello Supabase, Project Settings → API) |
| `PORTAL_URL` | `https://tecnosandbox.app` |
| `CRON_SECRET` | segreto casuale della sandbox |
| `ADMIN_NOTIFICATION_EMAILS` | `none` |
| `VIES_PORTALS` | il portale di prova della compagnia (indirizzo di prova, chiave, segreto di firma), quando la compagnia li comunica |

Le variabili della produzione restano limitate all'ambiente *Production*: un'anteprima di un altro ramo non deve mai puntare alla sandbox né la sandbox alla produzione. **Il ramo `sandbox` si pubblica solo dopo che queste variabili esistono**, altrimenti Vercel costruirebbe l'anteprima con le variabili di default.

L'indirizzo `tecnosandbox.app` è un dominio acquistato su Vercel (DNS gestito da Vercel) e collegato come dominio del progetto al ramo `sandbox`. Le anteprime Vercel sono protette dall'accesso Vercel, anche sugli indirizzi `*.vercel.app`; i domini personalizzati ne sono esclusi, per questo la compagnia può chiamare `/api/vies-portal-callback` solo su `tecnosandbox.app`.

## 4. Come si aggiorna

1. Si porta il ramo `sandbox` allo stato di `main` (`git push origin main:sandbox`): Vercel ricostruisce la sandbox.
2. Se `main` contiene nuove migrazioni del database, si applicano anche alla sandbox (prima alla sandbox, poi alla produzione).

## 5. Collaudo con la compagnia

1. La compagnia ci dà il suo indirizzo **di prova** (invio pratiche e, se separato, eventi), la chiave che quell'indirizzo accetta e i domini da cui scaricheremo i suoi documenti; li inseriamo in `VIES_PORTALS` della sandbox con un **segreto di firma solo per la sandbox**.
2. Le consegniamo la *Guida al collegamento* e il foglio con indirizzo, id del portale e segreto della sandbox.
3. Con l'utente collaboratore carichiamo un lotto di prova (Excel con le partite IVA italiane + ZIP), con l'amministratore lo inviamo alla compagnia.
4. Seguiamo insieme alla compagnia l'elenco delle prove della sezione 8 della guida (5 pratiche, dalla presa in carico all'emissione delle 4 copie).
5. Gli esiti si controllano in **Impostazioni → Connessioni** (registro degli scambi in entrata e delle consegne in uscita).

Finito il collaudo, i dati di prova restano nella sandbox: non serve cancellarli, la produzione non li vede.

## 6. Cose da non fare

- Non usare mai dati reali di clienti nella sandbox.
- Non copiare chiavi o segreti della produzione nella sandbox (né il contrario).
- Non collegare il repository GitHub al progetto Supabase: le migrazioni si applicano in modo controllato, prima alla sandbox.
