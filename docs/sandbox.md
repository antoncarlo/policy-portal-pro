# Ambiente di prova (sandbox) — guida operativa interna

*Come è fatta la sandbox del portale, a cosa serve e come si usa per il collaudo con la compagnia. Nessun dato della sandbox tocca la produzione.*

## 1. Com'è fatta

| | Produzione | Sandbox |
|---|---|---|
| Indirizzo | `https://portale.tecnomga.com` | `https://tecnosandbox.app` |
| Database Supabase | `nesblhtjqiavdfsrtfom` | `zwbvpfmdccbdockwksoy` (`policy-portal-sandbox`, Irlanda) |
| Codice | ramo `main` | ramo `sandbox` (stesso codice, aggiornato da `main`) |
| Vercel | progetto `policy-portal-pro` (produzione: ramo `main`) | progetto separato `tecnomga-sandbox` (produzione: ramo `sandbox`), con variabili proprie |
| E-mail | attive | **spente** (nessun fornitore configurato): nessuna e-mail parte verso collaboratori o clienti |
| Attività giornaliere (cron) | attive | attive, solo sul database di prova (le e-mail restano spente) |
| Agent di lettura documenti | attivi | **non configurati**: i PDF con testo si riconoscono normalmente; le sole scansioni restano «non lette» |

Il database della sandbox ha **tutte le 75 migrazioni** del repository, applicate da zero il 27/10/2026, e gli stessi archivi dei file (`practice-documents`, `vies-batch-files`, `vies-lot-documents`, `signing-templates`) con gli stessi limiti della produzione. Rispetto alla produzione ha in più qualche oggetto storico che in produzione era stato tolto a mano (tabella `email_templates` e tre funzioni legate) e in meno la funzione `retention_logs`, creata a mano in produzione e non usata dal codice: nessuna delle due differenze cambia il funzionamento.

## 2. Utenti di prova

| Utente | Ruolo | Prodotti |
|---|---|---|
| `admin.sandbox@tecnomga.com` | Amministratore | VIES |
| `collaboratore.sandbox@tecnomga.com` | Collaboratore (rappresentante fiscale) | VIES |
| `compagnia.admin@tecnosandbox.app` | Amministratore, **consegnato alla compagnia** per il collaudo | tutti |
| `compagnia.collaboratore@tecnosandbox.app` | Collaboratore, **consegnato alla compagnia** (fa la parte del rappresentante fiscale) | VIES |

Le password sono state consegnate a parte e non sono scritte nel repository. Gli utenti esistono solo nella sandbox. Gli utenti della compagnia sono stati creati con il cambio password obbligatorio al primo accesso.

Credenziali di collegamento consegnate alla compagnia (valori nella *scheda credenziali* riservata, mai nel repository):

| Cosa | Dove si gestisce |
|---|---|
| Chiave API `Compagnia – collaudo sandbox` (prefisso `tmga_`), associata a `compagnia.collaboratore@tecnosandbox.app` | Impostazioni → Chiavi API del portale di prova (si disattiva o si rigenera da lì) |
| Id portale `compagnia-test` e segreto di firma | Variabili `VIES_PORTALS` e `VIES_PORTAL_COMPAGNIA_TEST_SECRET` del progetto Vercel `tecnomga-sandbox` |

Il kit consegnato alla compagnia è `docs/api/GuidaSandboxCompagnia.pdf` (kit di collaudo seguito dalla guida completa al collegamento) con i lotti di prova (`npm run build:vies-test-data`), i documenti fittizi da restituire (bozza, copia `.p7m` firmata con un certificato di prova, quattro copie della polizza) e `scripts/vies-portal-simulator.mjs`.

## 3. Progetto Vercel `tecnomga-sandbox`

La sandbox è un **progetto Vercel separato** collegato allo stesso repository, con ramo di produzione `sandbox`. Serve un progetto a parte perché la protezione standard di Vercel (accesso con account Vercel) esclude solo i domini di **produzione** di un progetto: un dominio agganciato a un ramo di anteprima resterebbe dietro il login e la compagnia non potrebbe chiamare `/api/vies-portal-callback`. Nel progetto della sandbox `tecnosandbox.app` è il dominio di produzione, quindi è raggiungibile senza login; la produzione vera resta nel progetto `policy-portal-pro` e non condivide variabili con la sandbox.

| Impostazione | Valore |
|---|---|
| Repository | `antoncarlo/policy-portal-pro` |
| Ramo di produzione | `sandbox` |
| Framework | Vite (rilevato da `vercel.json` / `package.json`) |
| Dominio di produzione | `tecnosandbox.app` (acquistato su Vercel, DNS Vercel; `www.tecnosandbox.app` facoltativo, solo come rinvio a `tecnosandbox.app`) |
| Protezione | standard (`all_except_custom_domains`): gli indirizzi `*.vercel.app` restano dietro il login, `tecnosandbox.app` no |

Variabili, tutte con ambiente **Production**:

| Variabile | Valore |
|---|---|
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | `https://zwbvpfmdccbdockwksoy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_GXy2sdw9DBbdRIu4z0eRdw_W_bzpVXd` (chiave pubblica del progetto sandbox) |
| `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` | chiave «anon» legacy del progetto sandbox (Supabase → Project Settings → API Keys → Legacy) |
| `VITE_SUPABASE_PROJECT_ID` | `zwbvpfmdccbdockwksoy` |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave «service_role» del progetto sandbox, tipo **Sensitive**: la inserisce a mano un amministratore dal pannello, non passa da chat o repository |
| `PORTAL_URL` | `https://tecnosandbox.app` |
| `CRON_SECRET` | segreto casuale generato per la sandbox (almeno 32 caratteri), tipo **Sensitive**, diverso da quello di produzione |
| `ADMIN_NOTIFICATION_EMAILS` | `none` |
| `WEBHOOK_DEFAULT_USER_ID` | `1a6afa14-ac11-47af-9479-361bd4bba28f` (utente `admin.sandbox@tecnomga.com`) |
| `VIES_PORTALS` | `[{"id":"compagnia-test","name":"Compagnia (collaudo)","url":"<indirizzo di prova della compagnia>","apiKeyEnv":"VIES_PORTAL_COMPAGNIA_TEST_KEY","callbackSecretEnv":"VIES_PORTAL_COMPAGNIA_TEST_SECRET","documentHosts":[],"eventsUrl":""}]`: finché la compagnia non comunica l'indirizzo, `url` resta vuoto (le risposte firmate funzionano, gli invii no) |
| `VIES_PORTAL_COMPAGNIA_TEST_SECRET` | segreto di firma della sandbox consegnato alla compagnia, tipo **Sensitive** |
| `VIES_PORTAL_COMPAGNIA_TEST_KEY` | la chiave che l'indirizzo di prova della compagnia accetta, tipo **Sensitive** (quando la comunica) |

Nessuna chiave o segreto della produzione va copiato in questo progetto (né il contrario). Le variabili del ramo `sandbox` create in precedenza nel progetto `policy-portal-pro` (ambiente Preview) non servono più e si possono cancellare.

## 4. Come si aggiorna

1. Si porta il ramo `sandbox` allo stato di `main` (`git push origin main:sandbox`): Vercel ricostruisce la produzione del progetto `tecnomga-sandbox`.
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
