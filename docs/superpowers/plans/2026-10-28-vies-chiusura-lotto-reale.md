# VIES: chiusura prima del lotto reale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** portare in produzione le correzioni VIES della PR #19 (credito esaurito, errori provvisori, log di consumo) e sapere quanti lotti coprono i 29 € di credito API prima del caricamento del lotto reale del 29/10.

**Architecture:** la PR #19 si chiude con la CI verde e un merge squash (Vercel pubblica il frontend da `main`). Le due funzioni Supabase si ridistribuiscono con il modulo condiviso `_shared/agent-errors.ts` e si controlla che partano. Il costo per lotto si misura dalle righe `vies_agent_reading` dei log della funzione, con una query documentata in `docs/monitoring.md`.

**Tech Stack:** Supabase Edge Functions (Deno), log Supabase (ClickHouse, `query_logs`), Vercel, GitHub Actions (`verify`, `e2e`).

**Spec:** descrizione della PR antoncarlo/policy-portal-pro#19 e richiesta del titolare del 28/10 («le API ora hanno credito di 29 euro»).

## Global Constraints

- Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01RgoD3hJ7JVAs5xyZYEi6xA`.
- Merge della PR: squash, titolo `<titolo della PR> (#19)`, come #14–#18.
- Funzioni: `verify_jwt: true`, entrypoint `index.ts`, il modulo condiviso caricato come `../_shared/agent-errors.ts`.
- Prezzi del modello dell'agent documentale: 2 $ per milione di token in entrata, 10 $ in uscita.
- Nessun push forzato; nessun test saltato o disattivato.

## Review Focus

- Il modulo condiviso non entra nel bundle della funzione: ogni lettura fallisce con un errore di avvio. Lo verifica il Task 2, Step 4.
- Una scheda del portale aperta prima del deploy usa ancora il vecchio codice: il credito esaurito verrebbe ritentato come prima. Il Task 3, Step 2 chiede di ricaricare la pagina prima del lotto.
- Il credito finisce a metà lotto. La lettura si ferma con il motivo (`e2e/vies-agent-errors.e2e.mjs`). Dopo la ricarica, ricaricando gli ZIP le letture già fatte non si ripagano (`e2e/vies-agent-excerpt.e2e.mjs`, «ricaricando lo ZIP l'agent non rilegge»).
- La riga di log manca o non si legge: la query restituisce zero letture. Lo verifica il Task 4, Step 2, con la Console Anthropic come riscontro.
- «Supabase Preview» rosso per le versioni di migrazione duplicate (20260604 ×3, 20260605, 20260608, 20261008–20261011), come su #13–#17. Non dipende dalla PR: una sola nota sulla PR (Task 1, Step 3).

---

### Task 1: Query del costo documentata, CI verde, merge della PR #19

**Files:**
- Modify: `docs/monitoring.md` (nuova sezione in fondo)

**Interfaces:**
- Consumes: le righe di log `{"event":"vies_agent_reading", "model", "input_tokens", "output_tokens", "ms", "pages", "kb", "media_type", "stop_reason" | "error"}` scritte da `supabase/functions/vies-document-agent/index.ts`.
- Produces: la query «Costo dell'agent documentale VIES», usata nel Task 4.

- [ ] **Step 1: Aggiungere a `docs/monitoring.md` la sezione «Costo dell'agent documentale VIES»**

La sezione contiene questa query, da eseguire nei log Supabase (finestra massima di 24 ore):

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

Aggiungere una riga di spiegazione: con il fallback lato server una lettura può passare a un altro modello, per questo si raggruppa per modello. Il costo del questionario antiriciclaggio è nelle righe `vies_aml_reading`.

- [ ] **Step 2: Commit e push sul ramo `claude/zen-pascal-pg3hgr`**

```bash
git add docs/monitoring.md docs/superpowers/plans/2026-10-28-vies-chiusura-lotto-reale.md
git commit -m "VIES: query del costo dell'agent nei log e piano di chiusura prima del lotto reale"
git push -u origin claude/zen-pascal-pg3hgr
```

- [ ] **Step 3: Attendere la CI sulla nuova testa**

Atteso: `verify` e `e2e` in stato success. Se «Supabase Preview» fallisce sulle versioni duplicate, lasciare un solo commento sulla PR che nomina il controllo, la causa (versioni di migrazione duplicate, già presenti su `main`) e che la PR non tocca le migrazioni. Se fallisce `verify` o `e2e`, la causa va trovata e corretta in questa PR prima del merge.

- [ ] **Step 4: Merge squash**

Titolo: `VIES: credito API esaurito come agent non disponibile; pratiche valutate solo a lettura finita (#19)`. Atteso: PR in stato merged, nuovo commit su `main`.

### Task 2: Deploy delle due funzioni e controllo di avvio

**Files:**
- Deploy (nessuna modifica): `supabase/functions/vies-document-agent/index.ts`, `supabase/functions/vies-aml-agent/index.ts`, `supabase/functions/_shared/agent-errors.ts`

**Interfaces:**
- Consumes: `main` dopo il Task 1.
- Produces: `vies-document-agent` v8 e `vies-aml-agent` v2 ACTIVE, uguali a `main`.

- [ ] **Step 1: Deploy di `vies-document-agent`**

File: `index.ts` (dal repo) e `../_shared/agent-errors.ts` (dal repo). Atteso: versione 8, stato ACTIVE.

- [ ] **Step 2: Deploy di `vies-aml-agent`**

Stessi due file della sua cartella. Atteso: versione 2, stato ACTIVE.

- [ ] **Step 3: Confronto con `main`**

Leggere le due funzioni distribuite. Atteso: `index.ts` identico al file su `main` e `agent-errors.ts` presente.

- [ ] **Step 4: Controllo di avvio**

Fare una POST a `https://nesblhtjqiavdfsrtfom.supabase.co/functions/v1/<funzione>` con corpo `{"probe":true}` e la chiave anon legacy come `Authorization: Bearer` e `apikey`. La chiave si legge con `get_publishable_keys`.

Atteso, per entrambe: `401 {"error":"Sessione non valida."}`. È la risposta del codice della funzione, quindi l'import del modulo condiviso è stato risolto.

Con un errore di avvio (500, `BOOT_ERROR`), ridistribuire con `isOutOfCredit` e `NO_CREDIT_MESSAGE` copiati nell'`index.ts` della funzione, poi ripetere lo Step 4.

### Task 3: Frontend in produzione

**Interfaces:**
- Consumes: il commit di merge del Task 1.

- [ ] **Step 1: Deploy Vercel**

Atteso: deployment di produzione READY con `githubCommitSha` uguale al commit di merge, e `get_runtime_errors` vuoto.

- [ ] **Step 2: Istruzione al titolare**

Prima di caricare il lotto, ricaricare la pagina VIES (Ctrl+F5) perché il browser usi il codice nuovo.

### Task 4: Credito di 29 € rispetto al costo per lotto

**Interfaces:**
- Consumes: la query del Task 1, Step 1.

- [ ] **Step 1: Stima prima del lotto, dai dati del lotto 1 del 28/10**

Dati di partenza: 20 clienti, circa 180 file letti dall'agent, PDF lunghi inviati per estratto. Ipotesi per lettura:
- entrata: da 3.000 token (una foto) a 16.000 (estratto di 3 pagine scansionate), più il prompt;
- uscita: da 1.000 a 2.500 token.

Ne risultano da 0,016 a 0,057 $ per lettura e da 3 a 11 $ per lotto, seconda lettura compresa. 29 € (circa 31–34 $) coprono quindi da 3 a 10 lotti. Riferire al titolare la soglia prudente: 3 lotti.

- [ ] **Step 2: Misura dopo il lotto reale**

Eseguire la query del Task 1. Atteso: `letture` pari al numero di file letti nel lotto e `errori` uguale a 0. Il costo del lotto è `usd`; i lotti coperti dal credito residuo sono il credito diviso `usd`.

Se `letture` è 0 mentre il lotto è stato letto, confrontare con la Console Anthropic (Usage) e controllare il Task 2, Step 3.

- [ ] **Step 3: Consiglio al titolare**

Attivare nella Console Anthropic (Billing) la ricarica automatica o l'avviso di saldo basso. Il portale non può leggere il saldo con la chiave dell'agent.
