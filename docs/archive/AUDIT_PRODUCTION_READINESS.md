> **Stato al 12 ottobre 2026 — documento storico.** Questo rapporto è la fotografia dell'11 ottobre da cui è partito il lavoro di produzione. I rilievi sono stati trattati nelle PR #3 e #4 (dettaglio in `CHANGELOG.md`, versione 1.0.0 e successive); i numeri e i giudizi qui sotto descrivono la situazione di allora, non quella attuale.
>
> **Non realizzati:** S6 (MFA obbligatoria per gli amministratori: il titolare l'ha voluta facoltativa), S7 (protezione anti-automazione sul login), M7 (preventivatori oltre Pet), C11 (sinistri, CRM e lead). **C9 solo in parte:** la registrazione del pagamento e i passaggi del flusso avvisano il partner, altre modifiche fatte dall'amministratore no.

# Policy Portal Pro — Audit Completo e Piano di Production Readiness

*Audit tecnico, di sicurezza e funzionale dell'intera piattaforma (frontend, API serverless, database Supabase, deploy Vercel, sito di produzione), eseguito l'11 ottobre 2026 sul branch `claude/eloquent-ramanujan-i21dum` (commit `0d384d8`). Il documento classifica ogni rilievo per gravità, conferma il livello reale di completezza modulo per modulo e definisce il piano operativo per portare il portale al 100% di prontezza per l'uso di massa.*

---

## SINTESI ESECUTIVA

| Dimensione | Valutazione | Nota |
|---|---|---|
| **Postura di sicurezza** | **85 / 100** | Solida: hardening RLS del 9 ottobre, MFA a tre livelli, API key hashate, HMAC, CSP rigorosa. Tutti i 18 endpoint live rifiutano richieste non autenticate. |
| **Completezza funzionale** | **~78 %** | Il documento `ANALISI_GAP_FUNZIONALI.md` (55-60 %) è obsoleto: scadenzario, email, report, API partner, VIES, i18n e MFA sono stati implementati. |
| **Prontezza alla produzione di massa** | **~68 %** | Bloccanti: audit trail inesistente, build con errori TypeScript, nessuna CI, cancellazione utente distruttiva, cicli funzionali aperti. |
| **Qualità ingegneristica** | **55 / 100** | Nessun framework di test, 3 script di regressione su 8 falliti, file da 3.500 righe, 25 report Markdown sparsi nella root. |

**Verdetto**: la piattaforma è utilizzabile in produzione controllata (poche decine di utenti fidati) ma **non è pronta per la produzione di massa**. I tre rischi che da soli giustificano lo stop sono: (1) nessuna tracciabilità delle azioni degli operatori, requisito di compliance per un intermediario assicurativo; (2) la funzione `delete_user` cancella a cascata tutte le pratiche dell'utente; (3) nessun controllo automatico impedisce di pubblicare codice che non compila.

---

## SECTION 01 — PERIMETRO E METODO

### 1.1 Stack verificato

| Livello | Tecnologia | Dimensione |
|---|---|---|
| Frontend | Vite 5, React 18, TypeScript, shadcn/ui, TanStack Query, i18n it/en/zh | 43.366 righe, 20 pagine, 117 componenti |
| API | 14 Vercel Functions (Node) + 16 moduli condivisi in `api/_lib` | 6.810 righe |
| Database | Supabase Postgres, 60 migrazioni, RLS, SECURITY DEFINER, 2 Edge Functions (Deno) | 7.601 righe SQL |
| Integrazioni | Resend / Gmail SMTP, Anthropic (agente documentale VIES), portali partner (HMAC), Vercel Cron | — |
| Deploy | Vercel (`portale.tecnomga.com`, redirect 307 da `policy-portal-pro.vercel.app`) | 2 cron: email 09:00, orchestratore VIES 03:30 |

### 1.2 Metodo

1. Lettura integrale del codice di autenticazione, autorizzazione, API partner, webhook, cron, orchestratore VIES, policy RLS.
2. Esecuzione locale di `tsc`, `eslint`, 8 script di regressione, `npm audit`.
3. Verifica passiva e non distruttiva del sito di produzione: header HTTP, risposta di ogni endpoint senza credenziali, esposizione di file di configurazione, CORS.
4. Scansione di segreti nei file tracciati e nella storia Git.
5. Ricerca sistematica di dati mock, placeholder, codice morto, funzionalità dichiarate ma non collegate.

---

## SECTION 02 — SICUREZZA: COSA FUNZIONA (VERIFICATO LIVE)

| Controllo | Esito | Evidenza |
|---|---|---|
| Endpoint senza credenziali | ✅ 18/18 rifiutati | 401 su tutti gli endpoint partner, cron, portal-actions, vies-control; 405 su metodo errato |
| Header di sicurezza | ✅ Completi | HSTS 2 anni, CSP `default-src 'self'`, `frame-ancestors 'none'`, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy, noindex |
| Esposizione file sensibili | ✅ Nessuna | `/.env`, `/.git/HEAD`, `/package.json`, `/api/_lib/*` restituiscono la SPA, non il file |
| Segreti nel repository | ✅ Nessuno | Solo la anon key Supabase (pubblica per design) in `README_DEPLOYMENT.md`; `.env` mai committato |
| API key partner | ✅ Hash SHA-256 in DB, confronto timing-safe per la chiave legacy, scadenza, disattivazione, `last_used_at` | `api/_lib/partner-api.ts` |
| Webhook ingresso | ✅ IP allowlist, API key, HMAC-SHA256 timing-safe, MIME e dimensione documenti (10 MB), idempotency | `api/webhook-receive-policy.ts` |
| Callback portali VIES | ✅ Firma su byte grezzi (`bodyParser: false`), timestamp, portale deve aver ricevuto la pratica | `api/_lib/vies-callback.ts` |
| Notifiche uscita (SSRF) | ✅ Solo HTTPS, host pubblici, nessuna credenziale in URL, `redirect: 'error'`, timeout | `api/_lib/vies-outbound.ts` |
| Cron | ✅ Chiusi senza `CRON_SECRET`; nessun default | entrambi i cron |
| Azioni amministrative | ✅ Controllo ruolo lato server su `user_roles`, verifica MFA, token sessione | `api/portal-actions.ts` |
| Password | ✅ Policy applicata dal server, `must_change_password` in `app_metadata` (non modificabile dal browser), reset anti-enumerazione con padding temporale e cooldown | `password-reset.ts`, `portal-actions.ts` |
| MFA TOTP | ✅ Tre livelli: policy RLS restrittiva, hook PostgREST pre-request, controllo nelle API; switch di rollout graduale | `20261010_mfa_enforcement.sql` |
| RLS | ✅ Hardening del 9 ottobre: bucket storage chiuso, funzioni SECURITY DEFINER revocate ad anon/authenticated, campi finanziari non modificabili dall'utente | `20261009_security_hardening.sql`, `20261008_*_rpc_lockdown.sql` |
| Stato pratica | ✅ Trigger DB impedisce cambio stato a chi non è admin/agente, anche bypassando la UI | `20260608_fix_practices_rls_recursion.sql` |
| XSS | ✅ Nessun `dangerouslySetInnerHTML` applicativo (solo il componente chart di shadcn); email con `escapeHtml` | — |
| security.txt | ✅ Presente con scadenza e contatto | `public/.well-known/security.txt` |

---

## SECTION 03 — VULNERABILITÀ E RISCHI DI SICUREZZA

Classificazione: **CRITICO** = perdita dati o compromissione; **ALTO** = da risolvere prima della produzione di massa; **MEDIO** = entro il primo trimestre; **BASSO** = igiene.

| # | Gravità | Rilievo | Dove | Rimedio |
|---|---|---|---|---|
| S1 | **CRITICO** | **`delete_user` cancella a cascata tutte le pratiche, documenti, clienti ed eventi dell'utente.** `practices.user_id` e `clients.user_id` hanno `ON DELETE CASCADE` verso `auth.users`; l'azione admin chiama `auth.admin.deleteUser` senza riassegnazione. Un click elimina il portafoglio di un agente: violazione degli obblighi di conservazione (Reg. IVASS 40/2018, 10 anni). | `api/portal-actions.ts:210`, migrazioni `20251121171453`, `20251121172646` | Sostituire con flusso **disattiva → riassegna pratiche a un altro utente → archivia**; cambiare le FK in `ON DELETE RESTRICT`; soft-delete (`deleted_at`) sui profili. Bloccare `delete_user` se l'utente ha pratiche. |
| S2 | **ALTO** | **Audit trail inesistente.** La tabella `activity_logs` esiste, la pagina admin "Log attività" la legge, ma **nessun codice vi scrive** (né frontend, né API, né trigger). Login, cambi ruolo, modifiche provvigioni, creazione/revoca API key, cancellazioni documenti e clienti, modifiche impostazioni: nessuna traccia. | `src/components/settings/admin/ActivityLogs.tsx`, nessun writer | Vedi SECTION 05 (piano audit log). |
| S3 | **ALTO** | **Rate limiting inefficace.** `Map` in memoria per istanza serverless: ogni istanza Vercel ha il proprio contatore, il limite di 100/min è moltiplicato per il numero di istanze e azzerato a ogni cold start. L'IP è il primo valore di `X-Forwarded-For` (controllabile dal client su molte infrastrutture). Riguarda API partner, webhook, reset password, callback VIES. | `partner-api.ts:40-55`, `webhook-receive-policy.ts:103`, `password-reset.ts:18` | Rate limit distribuito (Upstash Redis o tabella Postgres con `pg_cron` di pulizia) con chiave `api_key_id + ip`; usare `x-real-ip` o l'ultimo hop fidato. |
| S4 | **ALTO** | **Firma HMAC del webhook calcolata su `JSON.stringify(req.body)`** (corpo ri-serializzato dopo il parsing della piattaforma) anziché sui byte ricevuti. Fragile (fallisce con JSON indentato, escape unicode, chiavi riordinate) e non conforme allo standard; `vies-connect.ts` lo fa correttamente con `bodyParser: false`. | `webhook-receive-policy.ts:385-396` | Disattivare il body parser e firmare il raw body, come in `vies-connect.ts`; aggiornare la guida API partner. |
| S5 | **MEDIO** | **Edge Function legacy `create-user` ancora nel repo** (e forse deployata). Superata da `portal-actions`, non più invocata dal frontend, logga URL e presenza header, usa `.single()` su `user_roles` (errore se l'utente ha più ruoli). Superficie d'attacco inutile. | `supabase/functions/create-user/index.ts` | Eliminare dal repo e `supabase functions delete create-user`. |
| S6 | **MEDIO** | **MFA facoltativa anche per gli amministratori.** Un admin con sola password può creare utenti, revocare MFA altrui, esportare l'intero DB. | `20261010_mfa_enforcement.sql` (per design) | Rendere obbligatoria l'iscrizione TOTP per il ruolo `admin` (gate in `ProtectedRoute` + `security_flags.only_roles`). |
| S7 | **MEDIO** | **Nessuna protezione anti-automazione sul login e sul reset password** oltre ai limiti di default di Supabase Auth. | `src/pages/Auth.tsx`, `ForgotPassword.tsx` | Cloudflare Turnstile (supportato nativamente da Supabase Auth) su `/auth` e `/forgot-password`. |
| S8 | **MEDIO** | **Log illimitati con dati personali.** `api_logs` (IP, body size), `email_logs` (email clienti), `integration_events` crescono senza retention né purge. GDPR art. 5(1)(e). | migrazioni `20260604_create_api_logs.sql`, `20241205_email_automation.sql` | Job `pg_cron` di retention (es. 180 giorni api_logs, 24 mesi email_logs) + pseudonimizzazione IP. |
| S9 | **BASSO** | **Dipendenze vulnerabili**: 10 avvisi `npm audit` (5 high, 5 moderate). I 5 high sono build-time (`braces`/`micromatch`/`chokidar` via Tailwind, DoS su pattern). Runtime: `react-router-dom` 6.30 con open redirect via backslash (CVE-2025-68470 bypass). | `package.json` | `npm audit fix`; valutare `react-router` 6.30.x patch o migrazione a 7; pin Tailwind aggiornato. |
| S10 | **BASSO** | **CORS `Access-Control-Allow-Origin: *`** su tutti gli endpoint partner. Mitigato dall'autenticazione via header, ma permette a qualsiasi pagina web di invocare l'API con una chiave trafugata. | `partner-api.ts:217` | Rimuovere CORS (API server-to-server) o limitare a origini esplicite per `api-docs`. |
| S11 | **BASSO** | `.vercel/project.json` (projectId, orgId) tracciato in Git; `supabase/config.toml` punta a un progetto (`hqhnvmpwqkdjnsuosrpw`) diverso dalla produzione (`nesblhtjqiavdfsrtfom`). | root | Aggiungere `.vercel/` a `.gitignore`; allineare `config.toml`. |
| S12 | **BASSO** | Confronto `CRON_SECRET` non timing-safe (`===`); `generatePracticeNumber()` con `Math.random` nel webhook è codice morto ma induce in errore. | `cron-send-emails.ts:44`, `webhook-receive-policy.ts:146` | `crypto.timingSafeEqual`; rimuovere la funzione. |
| S13 | **BASSO** | `tenantScopeFilter` interpola `keyId`/`mappedUserId` in una stringa PostgREST `.or()` senza validarli come UUID. Oggi provengono dal DB, quindi sicuri, ma il pattern è fragile. | `partner-api.ts:190` | Validare con regex UUID prima dell'interpolazione. |

---

## SECTION 04 — DATI MOCK, PLACEHOLDER E CODICE MORTO

| # | Tipo | Rilievo | Dove | Azione |
|---|---|---|---|---|
| M1 | **Mock funzionale** | **Sessioni attive**: la pagina mostra una sola "sessione" costruita dal `navigator.userAgent` del browser corrente (`mockSessions`). Non esiste gestione dispositivi né revoca remota. | `src/components/settings/SessionsSettings.tsx:49` | Implementare via `portal-actions` (`auth.admin.listUserSessions`, `signOut({ scope: 'others' })`) oppure rimuovere la scheda. |
| M2 | **Dato finto** | **Statistiche portale**: lo spazio storage è `documenti × 0,5 MB` ("mock for now"). | `src/components/settings/admin/PortalStatistics.tsx:125` | Sommare `practice_documents.file_size` (colonna già presente). |
| M3 | **Marketing fittizio** | **Landing page pubblica** mostra `10,000+`, `500+`, `99.9%`, `24/7` hardcoded. Dichiarazioni non veritiere su un sito di un intermediario regolamentato. | `src/pages/Index.tsx:31` | Rimuovere o alimentare da dati reali (`get_dashboard_kpis`). |
| M4 | **File di backup nel repo** | `UploadForm.tsx.backup` (756 righe), `index.css.backup` tracciati in Git. | `src/components/upload/`, `src/` | Eliminare; la storia è in Git. |
| M5 | **SQL fuori migrazioni** | `fix_dashboard_kpis.sql`, `fix_reports_columns.sql` nella root: patch applicate a mano → drift tra schema reale e migrazioni. | root | Verificare che il contenuto sia già in `20241205_production_reports.sql`/`20261009_security_hardening.sql`, poi eliminare. |
| M6 | **Backup pseudo** | "Backup" = export JSON dal browser delle tabelle visibili all'utente. Nessun restore, nessuna schedulazione, dipende dalle RLS del chiamante. | `src/components/settings/admin/BackupSettings.tsx` | Rinominare "Esporta dati"; documentare PITR Supabase come backup reale; runbook di restore. |
| M7 | **Preventivatori** | Solo **Pet** ha un motore di calcolo (`petQuoteEngine.ts`). Le altre 11 tipologie non hanno preventivatore. | `src/lib/petQuoteEngine.ts` | Decisione di prodotto: roadmap per Casa, RC, Fidejussioni (volumi maggiori). |
| M8 | **PWA incompleta** | Icone 192/512 e `apple-touch-icon` presenti, ma nessun `manifest.webmanifest` né service worker; CSP già pronta (`manifest-src 'self'`). | `public/`, `index.html` | Aggiungere manifest o rimuovere le icone orfane. |
| M9 | **Documentazione obsoleta** | 25 file `.md` nella root (report di sessioni passate). `ANALISI_GAP_FUNZIONALI.md` dichiara mancanti funzioni già implementate. Due copie della guida API (root e `doc_audit/`, 1 MB di PDF ciascuna). | root, `doc_audit/` | Spostare in `docs/archive/`, tenere un solo `docs/README.md` aggiornato. |
| M10 | **Script di test rotto** | `check-vies-product-permissions.mjs` legge `src/pages/AdminUsers.tsx`, file eliminato (ora `UserManagement.tsx`). | `scripts/` | Aggiornare il percorso. |

---

## SECTION 05 — LOGGING E AUDIT TRAIL (RILIEVO CONFERMATO)

### 5.1 Stato attuale: cosa viene tracciato e cosa no

| Tabella | Chi scrive | Copre | Non copre |
|---|---|---|---|
| `api_logs` | Tutte le API partner (`X-API-Key`) | Endpoint, IP, status, chiave mascherata, dimensione body | Nulla delle azioni UI |
| `email_logs` | Solo `cron-send-emails` | Promemoria scadenza al cliente | Email di benvenuto, reset password, notifica admin nuova pratica, email di test, notifiche VIES |
| `practice_events` | Workflow, VIES, note partner, azioni admin sulla pratica | Timeline della singola pratica | Cancellazioni, modifiche campi finanziari dalla UI, documenti |
| `integration_events` | Connettori VIES (intake, callback, outbound) | Scambi con i portali | — |
| **`activity_logs`** | **Nessuno** | **Nulla** | **Tutto**: la pagina admin è permanentemente vuota |

### 5.2 Azioni oggi completamente prive di traccia

- Autenticazione: login riuscito/fallito, logout, iscrizione/reset MFA, cambio password (solo in `auth.audit_log_entries` di Supabase, non esposto).
- Utenti: creazione, disattivazione, **cancellazione**, cambio ruolo, assegnazione agente, modifica provvigione e scaglioni bonus, permessi prodotto.
- Pratiche: creazione/modifica/cancellazione da UI, modifica stato finanziario e date incasso, azioni massive, upload e **cancellazione documenti**.
- Clienti: modifica e cancellazione.
- Sistema: creazione/revoca API key, mapping chiave-utente, webhook partner, impostazioni SMTP/sistema, export "backup", cancellazione batch VIES.

### 5.3 Piano di implementazione (2 livelli)

**Livello 1 — Trigger Postgres (copre tutto, anche ciò che bypassa la UI)**

```sql
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,                     -- auth.uid(), null = service role
  actor_role text,                   -- auth.role()
  table_name text not null,
  row_id uuid,
  action text not null,              -- INSERT | UPDATE | DELETE
  old_data jsonb, new_data jsonb,
  changed_keys text[],               -- solo le colonne cambiate
  ip inet, user_agent text           -- da request headers via current_setting
);
-- trigger generico audit.log_row_change() applicato a:
-- practices, clients, profiles, user_roles, user_product_permissions,
-- api_keys, api_key_user_mapping, partner_webhooks, practice_documents,
-- system_settings, vies_batches, commission tiers
```

Policy: `INSERT` solo da trigger (SECURITY DEFINER), `SELECT` solo admin, nessun `UPDATE/DELETE` (append-only). Retention 10 anni per pratiche/clienti, 2 anni per il resto.

**Livello 2 — Eventi applicativi (contesto che il DB non vede)**

- `logActivity(supabase, { actor, action, target, metadata, ip, ua })` in `api/_lib/audit.ts`, chiamato da ogni `case` di `portal-actions.ts` (`create_user`, `delete_user`, `reset_mfa`, `set_password`, ecc.) e da `vies-control.ts`.
- Login/logout/MFA: Supabase **Auth Hook** (`send_email`/`password_verification`) o lettura periodica di `auth.audit_log_entries` in `activity_logs`.
- Tutte le `sendMail()` passano da un wrapper che scrive `email_logs` (provider, message id, esito, bounce).
- UI: pagina `ActivityLogs` con filtri per attore, tabella, azione, periodo, diff old/new, export CSV.

---

## SECTION 06 — CICLI FUNZIONALI APERTI

Funzionalità che partono ma non si chiudono: l'utente avvia un processo e nessun evento, notifica o stato lo completa.

| # | Ciclo | Cosa manca per chiuderlo | Priorità |
|---|---|---|---|
| C1 | **Cambio stato pratica** (in_lavorazione → in_attesa → integrazioni → approvata/rifiutata → completata) | **Nessuna notifica** al proprietario della pratica (agente/collaboratore) né al cliente. L'agente deve ricaricare la UI. Solo le pratiche partner ricevono eventi outbound. | **P0** |
| C2 | **Richiesta integrazioni** | L'admin chiede documenti, ma non parte alcuna email, non c'è scadenza, promemoria né escalation se l'agente non risponde. | **P0** |
| C3 | **Scadenzario → rinnovo** | I promemoria 90/60/30/7 giorni partono al cliente, ma non esiste azione "Rinnova" che crei la nuova pratica collegata alla precedente, né statistiche di retention. Il ciclo si apre e finisce in un'email. | **P1** |
| C4 | **Consegne outbound fallite** | Dopo 7 tentativi lo stato diventa `failed` e resta silenzioso: nessun alert all'admin. Il pulsante "Riprova" esiste ma nessuno sa quando usarlo. | **P1** |
| C5 | **Deliverability email** | Nessun webhook Resend per bounce/complaint/delivered: email alla casella sbagliata = scadenza mai notificata, senza che nessuno lo sappia. | **P1** |
| C6 | **Offboarding utente** | `delete_user` distrugge i dati (S1). Manca: riassegnazione pratiche e clienti, disattivazione con conservazione, revoca API key mappate. | **P0** |
| C7 | **Clienti** | Creati automaticamente dalle pratiche: nessuna deduplica/merge, nessun export o cancellazione GDPR per singolo interessato. | **P2** |
| C8 | **Email transazionali non loggate** | Benvenuto, reset, notifica admin, VIES: inviate ma non registrate → impossibile rispondere a "l'email è partita?". | **P1** |
| C9 | **Pratiche create da UI verso partner** | `emitPracticeEvent` è chiamato solo da workflow VIES e callback. Modifiche finanziarie o documentali fatte dall'admin su una pratica partner non generano evento al partner. | **P2** |
| C10 | **Centro notifiche in-app** | Preferenze notifica esistono (`PreferencesSettings`) ma non c'è inbox/campanella: le preferenze governano solo email. | **P2** |
| C11 | **Sinistri, CRM/lead, rinnovi** | Moduli assenti (coerente con il gap doc). | Roadmap prodotto |
| C12 | **Vista Pratiche per lotto VIES** | Un rappresentante fiscale che carica 5 lotti in un giorno vede 100 righe piatte nella sezione Pratiche, non 5 lotti espandibili. Specifica completa in §6.1. | **P1** |

### 6.1 Specifica: raggruppamento per lotto nella sezione Pratiche

**Problema.** Le pratiche VIES nascono a lotti (un file Excel + ZIP = un lotto, fino a 20 pratiche). Nella pagina Pratiche ogni pratica è una riga indipendente: con 5 lotti al giorno l'elenco diventa illeggibile e l'utente non ritrova il lotto da cui una pratica proviene.

**Comportamento richiesto.**
- Nella sezione Pratiche le pratiche VIES compaiono raggruppate per lotto: una riga per lotto (`Lotto 3 — Rapp. fiscale Rossi — 20 pratiche — 12/10/2026 — 18 approvate, 2 integrazioni`).
- Click sulla riga lotto → espansione in-place delle pratiche del lotto, ciascuna con il proprio numero `PR-YYYY-NNNN`, stato, cliente, azioni, esattamente come oggi.
- Le pratiche non VIES restano righe singole. Toggle "Vista per lotto / Vista piatta" ricordato nelle preferenze utente.
- Filtri e ricerca continuano a funzionare sulla singola pratica: se un filtro colpisce una pratica dentro un lotto, il lotto appare già espanso con le sole pratiche che corrispondono e un contatore "3 di 20".
- Le azioni massive (export, cambio stato dove consentito) sono disponibili sia sul lotto intero sia sulla selezione di pratiche.
- Lo stesso raggruppamento va replicato in Amministrazione (già parzialmente presente in `ViesAdministration.tsx`) e nell'export Excel (colonne `lotto_numero`, `lotto_id`, `rappresentante_fiscale`).

**Stato del dato oggi.** La tabella `practices` **non ha** una colonna che la leghi al lotto. Il collegamento esiste solo in modo indiretto: `vies_jobs.external_reference` (testo) contiene l'id della pratica e `vies_jobs.batch_id` punta a `vies_batches`, che ha `lot_number`, `name`, `fiscal_representative_id`. La pagina Pratiche non effettua questo join.

**Implementazione proposta (ordine).**
1. Migrazione: `ALTER TABLE practices ADD COLUMN vies_batch_id uuid REFERENCES vies_batches(id) ON DELETE SET NULL; CREATE INDEX practices_vies_batch_idx ON practices(vies_batch_id);` + backfill `UPDATE practices p SET vies_batch_id = j.batch_id FROM vies_jobs j WHERE j.external_reference = p.id::text AND p.vies_batch_id IS NULL;`.
2. Scrittura: `api/_lib/vies-orchestrator.ts` e `vies-intake.ts` valorizzano `vies_batch_id` alla creazione della pratica (oggi scrivono solo `external_reference` sul job).
3. Lettura: una vista o RPC `get_practices_grouped(filters)` che restituisce le pratiche con `vies_batch_id`, `lot_number`, `batch_name`, `fiscal_representative_name` e i contatori per stato del lotto (riusare `refresh_vies_batch_counters`). RLS: il lotto è visibile se almeno una pratica del lotto è visibile al chiamante.
4. UI: in `src/components/practices/PracticesTable.tsx` introdurre righe di gruppo collassabili (pattern già usato da shadcn `Collapsible`), stato di espansione per lotto, badge contatori, toggle vista; `PracticesFilters.tsx` aggiunge il filtro "Lotto" e "Rappresentante fiscale"; `PracticesExport.tsx` aggiunge le tre colonne.
5. Dettaglio pratica: breadcrumb "Lotto 3 › PR-2026-0412" con link al lotto e navigazione precedente/successiva all'interno del lotto.
6. API partner: `GET /api/get-practices` espone `lot: { id, number, name }` per coerenza con la dashboard del partner.

**Effort stimato:** 4 giorni (1 DB/backfill, 1 API, 2 UI + export).

---

## SECTION 07 — QUALITÀ, BUILD E PROCESSO

| # | Gravità | Rilievo | Evidenza | Rimedio |
|---|---|---|---|---|
| Q1 | **ALTO** | **La build di produzione compila con errori TypeScript.** `tsc --noEmit` fallisce; Vite+SWC non esegue il type-check, quindi Vercel pubblica comunque. | `src/pages/Vies.tsx:934` (`Uint8Array` non assegnabile a `BlobPart`), `Vies.tsx:2212` (`message` assente sul tipo `ViesZipUploadResult`) | Correggere; aggiungere `tsc --noEmit &&` al `buildCommand`. |
| Q2 | **ALTO** | **Nessuna CI.** Nessun `.github/workflows`: lint, tipi e script di regressione non girano mai automaticamente. | root | GitHub Actions su PR: `npm ci`, `eslint`, `tsc`, tutti gli `npm run test:*`, `npm audit --audit-level=high`. Protezione branch `main`. |
| Q3 | **ALTO** | **3 script di regressione su 8 falliscono**: `test:vies-zip-upload` (errori senza nome ZIP), `test:vies-resumable-upload` (2 regressioni: batch non si ferma se ZIP non caricato; progresso aggregato), `test:vies-product-permissions` (crash, file rinominato). | output locale | Ripristinare i comportamenti o aggiornare i check; mai lasciare rossi. |
| Q4 | **MEDIO** | **Nessun framework di test** (no vitest, no playwright). I "test" sono script che cercano stringhe nel sorgente. Zero copertura su logica di dominio: `petQuoteEngine`, `practiceSummary`, `vies-workflow`, `partner-api`, policy password. | `package.json` | Vitest per `src/lib` e `api/_lib` (funzioni pure, già ben separate); Playwright per 5 flussi critici (login+MFA, upload pratica, cambio stato, API partner, VIES batch). |
| Q5 | **MEDIO** | **Nessun monitoraggio errori** né `ErrorBoundary`: un'eccezione React mostra pagina bianca; gli errori server finiscono solo nei log Vercel. | — | Sentry (frontend + functions), `ErrorBoundary` nel layout, alert su cron falliti. |
| Q6 | **MEDIO** | **File monolitici**: `Vies.tsx` 3.534 righe, `ViesAdministration.tsx` 947, `ApiDocs.tsx` 809, `UploadForm.tsx` 768. | `src/pages`, `src/components` | Estrarre step wizard VIES, hook di upload, tabelle. |
| Q7 | **MEDIO** | **Nessuna validazione delle variabili d'ambiente** (31 variabili server). Una configurazione mancante emerge come 503 a runtime (es. `WEBHOOK_SECRET`). | `api/*` | `api/_lib/env.ts` con schema zod valutato al primo import; endpoint `/api/health` che riporta i provider configurati (senza valori). |
| Q8 | **BASSO** | Due convenzioni per la stessa URL Supabase (`SUPABASE_URL` vs `VITE_SUPABASE_URL`) e per il mittente email (`EMAIL_FROM`, `VITE_EMAIL_FROM`, `GMAIL_FROM`). | env inventory | Unificare; documentare in `.env.example` (oggi incompleto: mancano `CRON_SECRET`, `VIES_*`, `GMAIL_*`). |
| Q9 | **BASSO** | `package.json` ha `name: vite_react_shadcn_ts`, `version: 0.0.0`; nessun changelog, nessun tag di release. | `package.json` | Nome reale, semver, `CHANGELOG.md`, tag per deploy. |
| Q10 | **BASSO** | 14 Vercel Functions: oltre il limite Hobby (12). Verificare piano Pro attivo per non bloccare il deploy aggiungendo la prossima. | `api/` | Confermare piano; eventualmente consolidare i 4 `get-*` in un router. |

---

## SECTION 08 — COMPLETEZZA PER MODULO

| Modulo | Completezza | Cosa c'è | Cosa manca |
|---|---|---|---|
| Autenticazione, MFA, password | **90 %** | Login, TOTP a tre livelli, reset anti-enumerazione, password provvisoria obbligatoria, template email it/en/zh | Turnstile, MFA obbligatoria admin, sessioni reali |
| Utenti, ruoli, gerarchia | **85 %** | Admin/agente/collaboratore, permessi per prodotto, provvigioni e scaglioni, invito con email | Offboarding sicuro (S1), audit |
| Pratiche (12 tipologie) | **85 %** | Upload con campi dinamici, documenti con validazione server, workflow a 6 stati con trigger di protezione, timeline, note, export | Notifiche cambio stato, versioning documenti |
| Clienti | **60 %** | Auto-creazione, anagrafica, dettaglio con pratiche | Dedup/merge, GDPR export/erasure, storico comunicazioni |
| Amministrazione / provvigioni | **80 %** | Tre stati finanziari, calcolo automatico, filtri per team, export Excel, VIES admin | Riconciliazione incassi, chiusure periodiche |
| Scadenzario | **70 %** | Calendario, urgenze, notifiche 90/60/30/7 via cron, log invii | Rinnovo, retention, bounce |
| Report | **75 %** | KPI con crescita, produzione per agente/periodo, grafici, export | PDF, forecast, salvataggio report |
| Email automation | **60 %** | Resend/Gmail, template DB, cron, test da UI, stato canale | Log completo, bounce, template editabili da UI |
| API partner + webhook | **85 %** | 9 endpoint documentati, multi-tenant, HMAC, idempotency, log, pagina docs con esempi in 3 linguaggi | Rate limit distribuito, update pratica, raw-body HMAC |
| Modulo VIES | **85 %** | Wizard 5 step, ZIP/Excel, agente documentale AI, batch queue, orchestratore, connettori bidirezionali firmati, simulatore portale, lotti ricevuti | Errori TypeScript, 3 regressioni rosse, file da 3.500 righe |
| Preventivatori | **8 %** (1 su 12) | Pet completo con PDF | Tutti gli altri |
| Impostazioni | **65 %** | Profilo, preferenze, lingua, SMTP, API key, mapping, connessioni, outbound, statistiche | Sessioni (mock), storage (mock), backup (pseudo) |
| Audit log | **10 %** | Tabella e UI | Qualsiasi scrittura |
| Osservabilità | **10 %** | `console.error`, `api_logs` | Sentry, health, alert, dashboard |
| Test e CI | **15 %** | 8 script grep-based (5 verdi) | Framework, CI, coverage |
| i18n | **90 %** | it/en/zh su tutta la UI e le email | Verifica automatica parità chiavi |

**Media ponderata: ~78 % funzionale, ~68 % production-ready.**

---

## SECTION 09 — PIANO OPERATIVO VERSO IL 100 %

### Fase 0 — Bloccanti (settimane 1-2)

| # | Attività | Riferimento | Effort |
|---|---|---|---|
| 0.1 | Correggere i 2 errori TypeScript e far fallire la build su errori di tipo | Q1 | 0,5 g |
| 0.2 | Pipeline CI (lint, tsc, test:*, audit) + branch protection su `main` | Q2 | 1 g |
| 0.3 | Riparare i 3 script di regressione | Q3, M10 | 1 g |
| 0.4 | **Audit log**: tabella append-only + trigger su 12 tabelle + `logActivity()` in `portal-actions` + UI con filtri | S2, §5 | 4 g |
| 0.5 | **Offboarding sicuro**: bloccare `delete_user` con pratiche, FK `RESTRICT`, flusso riassegna→disattiva | S1, C6 | 2 g |
| 0.6 | Notifica email + evento timeline al proprietario a ogni cambio stato; email dedicata per "integrazioni" | C1, C2 | 2 g |
| 0.7 | Rate limit distribuito (Upstash o Postgres) con chiave `api_key + ip` | S3 | 1 g |
| 0.8 | HMAC webhook su raw body; nota di migrazione nella guida partner | S4 | 1 g |
| 0.9 | Eliminare Edge Function `create-user`, file `.backup`, SQL in root, `generatePracticeNumber`; `.vercel` in gitignore | S5, M4, M5, S11, S12 | 0,5 g |
| 0.10 | Rimuovere statistiche finte dalla landing; storage reale nelle statistiche | M3, M2 | 0,5 g |
| 0.11 | Sentry + `ErrorBoundary` + alert cron | Q5 | 1 g |
| 0.12 | Validazione env con zod + `/api/health` | Q7 | 1 g |
| 0.13 | `npm audit fix`, aggiornare `react-router-dom` | S9 | 0,5 g |

**Totale Fase 0: ~16 giorni/persona.**

### Fase 1 — Chiusura dei cicli (settimane 3-6)

| # | Attività | Riferimento | Effort |
|---|---|---|---|
| 1.1 | Wrapper `sendMail` con `email_logs` per ogni invio; webhook Resend bounce/complaint → flag su cliente e alert | C5, C8 | 2 g |
| 1.2 | Alert admin su consegne outbound `failed` + digest giornaliero | C4 | 1 g |
| 1.3 | Workflow rinnovo: azione "Rinnova" da scadenzario, pratica figlia collegata, KPI retention | C3 | 4 g |
| 1.4 | Promemoria e scadenza su "integrazioni" (es. 7 giorni) con escalation all'admin | C2 | 1,5 g |
| 1.5 | Retention log con `pg_cron`; pseudonimizzazione IP | S8 | 1 g |
| 1.6 | MFA obbligatoria per admin; Turnstile su login e reset | S6, S7 | 1,5 g |
| 1.7 | Sessioni reali (lista dispositivi, revoca) o rimozione scheda | M1 | 1,5 g |
| 1.8 | Vitest su `src/lib` + `api/_lib` (target 70 % sulle funzioni pure); Playwright sui 5 flussi critici | Q4 | 5 g |
| 1.9 | CORS esplicito; validazione UUID nel tenant filter; timing-safe cron | S10, S13, S12 | 0,5 g |
| 1.10 | **Vista Pratiche raggruppata per lotto VIES** (colonna `vies_batch_id`, backfill, RPC, righe espandibili, filtri, export) | C12, §6.1 | 4 g |

**Totale Fase 1: ~22 giorni/persona.**

### Fase 2 — Scala e prodotto (mesi 2-3)

| # | Attività | Riferimento |
|---|---|---|
| 2.1 | Refactor `Vies.tsx` in step/hook; `UploadForm` in sotto-form per tipologia | Q6 |
| 2.2 | Centro notifiche in-app (tabella `notifications`, Realtime, campanella) | C10 |
| 2.3 | GDPR tooling: export e cancellazione per cliente, registro trattamenti, retention pratiche 10 anni | C7, S8 |
| 2.4 | Dedup e merge clienti | C7 |
| 2.5 | Runbook backup/restore (PITR Supabase), test di restore trimestrale; rinominare "Backup" in "Esporta" | M6 |
| 2.6 | Eventi outbound anche per modifiche admin su pratiche partner; endpoint `PATCH` pratica | C9 |
| 2.7 | Preventivatori per le 3 tipologie a maggior volume | M7 |
| 2.8 | PWA manifest + offline shell | M8 |
| 2.9 | Riordino documentazione: `docs/` unico, archivio report, `CHANGELOG`, semver | M9, Q9 |
| 2.10 | Moduli sinistri e CRM/lead (decisione di prodotto) | C11 |

### Checklist go-live produzione di massa

- [ ] CI verde su `main` (lint, tipi, test, audit)
- [ ] Audit log attivo e verificato su: login, cambio ruolo, cancellazione documento, modifica provvigione
- [ ] `delete_user` non può distruggere pratiche
- [ ] Ogni cambio stato pratica genera email + evento
- [ ] Rate limit distribuito testato con 2 istanze concorrenti
- [ ] Sentry riceve un errore di prova da frontend e da una function
- [ ] `/api/health` verde con tutti i provider configurati
- [ ] MFA attiva su tutti gli account admin
- [ ] Nessun dato finto in landing, statistiche, sessioni
- [ ] Retention log schedulata e documentata
- [ ] Restore da PITR provato almeno una volta
- [ ] Guida API partner aggiornata con HMAC su raw body e CORS

---

## SECTION 10 — RIEPILOGO PER GRAVITÀ

| Gravità | Conteggio | Codici |
|---|---|---|
| **CRITICO** | 1 | S1 |
| **ALTO** | 6 | S2, S3, S4, Q1, Q2, Q3 |
| **MEDIO** | 10 | S5, S6, S7, S8, Q4, Q5, Q6, Q7, C1–C2 (P0 funzionali) |
| **BASSO** | 11 | S9–S13, Q8–Q10, M-serie |
| **Cicli aperti / UX** | 12 | C1–C12 |
| **Mock / placeholder** | 10 | M1–M10 |

*Documento generato dall'audit dell'11 ottobre 2026. Nessuna modifica al codice applicativo è stata introdotta in questa sessione: tutte le evidenze sono riproducibili con i comandi `npx tsc -p tsconfig.app.json --noEmit`, `npm run test:*`, `npm audit` e con richieste HTTP non autenticate verso `https://portale.tecnomga.com/api/*`.*
