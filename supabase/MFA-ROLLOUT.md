# Verifica in due passaggi (TOTP): attivazione e recupero

## Come funziona

- La verifica è facoltativa, per tutti (amministratori compresi): ognuno la attiva da Impostazioni > Sicurezza.
- Chi ha un'app di autenticazione collegata deve inserire il codice a ogni accesso.
- Il controllo vero sta nel database (migrazione `20261010_mfa_enforcement.sql`):
  regola RLS restrittiva su ogni tabella e su `storage.objects`, controllo su ogni richiesta PostgREST
  (anche le funzioni RPC) e controllo nelle funzioni `/api/*` (`api/_lib/mfa.ts`).
  Una sessione con solo la password (aal1) non legge né scrive nulla, finché non passa il codice (aal2).

## Interruttore (tabella `public.security_flags`, chiave `mfa_enforcement`)

La migrazione installa tutto **spento**. Si accende solo dopo che il frontend con la schermata del codice
è online. Acceso, riguarda soltanto chi ha attivato l'app: gli altri utenti non cambiano.

```sql
-- prova su pochi utenti
update public.security_flags set enabled = true, only_users = array['<uuid utente>']::uuid[] where key = 'mfa_enforcement';
-- tutti
update public.security_flags set enabled = true, only_users = null where key = 'mfa_enforcement';
-- spento (anche per sbloccare un amministratore)
update public.security_flags set enabled = false where key = 'mfa_enforcement';
```

## Telefono perso

- Un amministratore può reimpostare la verifica di un altro utente da Gestione Utenti
  (menu dei tre puntini > «Reimposta verifica in due passaggi»). L'utente accede con la sola password e può riattivare l'app da Impostazioni > Sicurezza.
- Se nessun amministratore riesce a entrare: spegnere l'interruttore (sopra), poi eliminare i fattori dell'utente:
  `delete from auth.mfa_factors where user_id = '<uuid>';` e riaccendere.

## Nuove tabelle

Le richieste PostgREST sono coperte dal controllo centrale. Per Realtime aggiungere anche la regola alla nuova tabella:

```sql
create policy mfa_required on public.<tabella> as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
```
