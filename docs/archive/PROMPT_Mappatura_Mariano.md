# Prompt — Associa API key "Portale Mariano" all'utente Mariano Del Priore (Claude Code)

Incolla il blocco sottostante in Claude Code (sessione nuova).

---

## Objective
Associate the existing API key named "Portale Mariano - integrazione real-time" to the portal user Mariano Del Priore (`commerciale@ipconsulenzaformativa.it`, role `agente`), by creating one row in `api_key_user_mapping`. WHY: practices received via that key's webhook must be owned by Mariano's `user_id` so they are visible to him via RLS AND so his commission plan (default_commission_percentage + commission_bonus_tiers on his profile) is applied — otherwise commissions and premiums are never calculated.

## Context
- Stack: Supabase (Postgres) backend for Policy Portal Pro. Use the Supabase MCP tools (`execute_sql`) — do NOT edit application code or migrations.
- Table `public.api_key_user_mapping (id uuid pk, api_key_id uuid NOT NULL UNIQUE → api_keys.id, user_id uuid NOT NULL → auth.users.id, created_at)` already exists. `UNIQUE(api_key_id)` = one owner per key.
- The API key lives in `public.api_keys` (columns: `id, name, partner_email, is_active`). Target name: `Portale Mariano - integrazione real-time`.
- The user lives in `public.profiles` (columns: `id` = auth.users.id, `full_name, email`). Target email: `commerciale@ipconsulenzaformativa.it`. Role is stored in `public.user_roles (user_id, role)` and must be `agente`.

## Steps
1. Resolve the API key id: `SELECT id, name FROM public.api_keys WHERE name = 'Portale Mariano - integrazione real-time';`
2. Resolve the user id: `SELECT id, full_name, email FROM public.profiles WHERE email = 'commerciale@ipconsulenzaformativa.it';`
3. Verify the role: `SELECT role FROM public.user_roles WHERE user_id = <user_id> AND role = 'agente';`
4. If exactly one api_key row, one profile row, and the agente role exist, UPSERT the mapping:
```sql
INSERT INTO public.api_key_user_mapping (api_key_id, user_id)
VALUES (<api_key_id>, <user_id>)
ON CONFLICT (api_key_id) DO UPDATE SET user_id = EXCLUDED.user_id;
```
5. Confirm: `SELECT m.api_key_id, k.name, m.user_id, p.email FROM public.api_key_user_mapping m JOIN public.api_keys k ON k.id = m.api_key_id JOIN public.profiles p ON p.id = m.user_id WHERE k.name = 'Portale Mariano - integrazione real-time';`

## Scope
- Only run SQL against the tables above via the Supabase MCP. Do NOT touch application code, migrations, RLS, .env, or any other table.

## Stop Conditions
Stop and ask before proceeding if:
- Step 1 returns zero or more than one API key matching that name.
- Step 2 returns zero or more than one profile for that email.
- Step 3 shows the user is NOT `agente` (do not force the mapping — flag it).
- Any query errors.

## Acceptance Criteria
- [ ] Exactly one row in `api_key_user_mapping` links that key's id to Mariano's user_id.
- [ ] The confirmation query in Step 5 returns name = "Portale Mariano - integrazione real-time" and email = `commerciale@ipconsulenzaformativa.it`.

## Progress
After each step: ✅ [what was done] — [result].

Prioritize correctness over speed. This is a production data change.

---

**Target:** Claude Code (Opus 4.7) + Supabase MCP.
**Nota:** prompt per tool agentico con accesso reale al database. Verifica scope e stop conditions prima di incollare.
