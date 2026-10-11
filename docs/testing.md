# Test del portale

*Cosa si controlla a ogni modifica, come lanciarlo in locale e come aggiungere una prova.*

## SECTION 01 — Cosa gira in CI

| Controllo | Comando | Cosa copre |
|---|---|---|
| Lint, tipi (app e API), regressioni | `npm run lint` · `npm run typecheck` · `npm run test:checks` | stile, errori di tipo, script di sorveglianza su VIES, importazioni delle funzioni |
| Prove sul server | `npm test` (Vitest) | funzioni delle API con un database finto: notifiche email, flusso delle pratiche e callback della compagnia, consegne in uscita, account e recupero password, rate limit, firma dei webhook, registro email, avvisi, rinnovi, termini delle integrazioni, offboarding, monitoraggio |
| Prove nel browser | `npm run test:e2e` (Playwright) | pagine reali con la rete simulata: accesso e 2FA, sezioni del flusso, lotti, notifiche, offboarding, registro di audit, rinnovi, pagina di errore, adattamento a telefono/iPad/PC |
| Audit dipendenze, build | `node scripts/audit-gate.mjs` · `npx vite build` | vulnerabilità alte e critiche, compilazione |

## SECTION 02 — In locale

```bash
npm test                                   # tutte le prove sul server (≈ 30 s)
npx vitest run tests/server/renewals       # una sola
npx playwright install chromium            # una volta
npm run test:e2e                           # tutti gli scenari nel browser (≈ 3 min)
npm run test:e2e -- renewals audit         # solo quelli il cui nome contiene queste parole
AUDIT=1 ONLY=clienti,utenti VIEWPORT=telefono-390 npm run test:e2e -- responsive   # solo alcune pagine/larghezze, con le schermate in e2e/artifacts/responsive/
```

Le prove nel browser avviano da sole il server di sviluppo sulla porta 5300 (`E2E_PORT` per cambiarla) e salvano le schermate in `e2e/artifacts/` (non versionata).

## SECTION 03 — Scrivere una prova

- **Server, regola isolata**: un file `tests/server/<nome>.test.ts` con `describe/it` e il database finto `tests/helpers/fakedb.ts` (stessa interfaccia del client Supabase: `from/select/insert/update/eq/in/…`). Per le richieste HTTP: `tests/helpers/http.ts`. Per sostituire il client reale: `vi.mock("@supabase/supabase-js")`.
- **Server, scenario lungo** (casella di posta finta, porte, ordine dei passaggi): come `tests/server/*-flow.test.ts`; usano `tests/helpers/suite.ts`, che esegue i controlli in ordine e li espone come test separati.
- **Browser**: un file `e2e/<nome>.e2e.mjs`; copiare lo schema di uno esistente (sessione finta, risposte di Supabase e `/api` simulate, verifiche con `check(...)`). Il runner lo trova da solo.

## SECTION 04 — Limiti noti

- Le prove con il database finto non vedono i trigger, le policy RLS e le funzioni SQL: quelle si verificano sul database (blocchi `DO` annullati, vedi le note delle migrazioni).
- Le prove nel browser simulano il server: non provano la consegna reale delle email né il collegamento con Vercel.
