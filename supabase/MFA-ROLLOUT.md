# Verifica in due passaggi (TOTP): attivazione e recupero

## Come funziona

- Chi ha un'app di autenticazione collegata deve inserire il codice a ogni accesso.
- Gli amministratori devono averla: al primo accesso il portale li porta alla configurazione (`/mfa-setup`).
- Agenti e collaboratori possono attivarla da Impostazioni > Sicurezza.
- Il controllo vero sta nel database (migrazione `20261010_mfa_enforcement.sql`):
  regola RLS restrittiva su ogni tabella e su `storage.objects`, controllo su ogni richiesta PostgREST
  (anche le funzioni RPC) e controllo nelle funzioni `/api/*` (`api/_lib/mfa.ts`).
  Una sessione con solo la password (aal1) non legge né scrive nulla, finché non passa il codice (aal2).

## Interruttore (tabella `public.security_flags`, chiave `mfa_enforcement`)

La migrazione installa tutto con l'obbligo **spento**. Si accende solo dopo che il frontend con la
schermata del codice è online, altrimenti gli amministratori resterebbero senza dati.

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
  (menu dei tre puntini > «Reimposta verifica in due passaggi»). L'utente configura di nuovo l'app al prossimo accesso.
- Se è bloccato l'unico amministratore: spegnere l'interruttore (sopra), poi eliminare i suoi fattori:
  `delete from auth.mfa_factors where user_id = '<uuid>';` e riaccendere.

## Nuove tabelle

Le richieste PostgREST sono coperte dal controllo centrale. Per Realtime aggiungere anche la regola alla nuova tabella:

```sql
create policy mfa_required on public.<tabella> as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
```
