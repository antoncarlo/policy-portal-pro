-- Second factor (TOTP) enforcement for portal users.
--
-- Rule: a user needs a session at level aal2 (password + authenticator code) when
--   * the user is an administrator, or
--   * the user has a verified authenticator factor.
-- Everyone else keeps working with password only.
--
-- Layers:
--   1. RLS: a RESTRICTIVE policy on every public table and on storage.objects
--      (covers table access, Storage and Realtime).
--   2. PostgREST pre-request hook: rejects every request, including calls to the
--      SECURITY DEFINER functions that bypass RLS, except public.has_role, which the
--      enrollment screen needs before the administrator has a factor.
--   3. /api/* functions ask public.mfa_required_for_user (see api/_lib/mfa.ts).
--
-- Deploy switch: enforcement is OFF until public.security_flags('mfa_enforcement') is
-- enabled, so the migration can go out before the frontend that asks for the code.
--   -- staged: only these users are enforced
--   update public.security_flags set enabled = true, only_users = array['<uuid>']::uuid[] where key = 'mfa_enforcement';
--   -- everyone
--   update public.security_flags set enabled = true, only_users = null where key = 'mfa_enforcement';
--   -- off (also the recovery path if an administrator is locked out)
--   update public.security_flags set enabled = false where key = 'mfa_enforcement';
--
-- New tables are covered by the pre-request hook; add the same policy to them for Realtime:
--   create policy mfa_required on public.<table> as restrictive for all to authenticated
--     using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
--
-- Run the statements one at a time if the SQL editor reports a lock timeout: CREATE POLICY needs a
-- short lock on each table.

create table if not exists public.security_flags (
  key text primary key,
  enabled boolean not null default false,
  only_users uuid[],
  updated_at timestamptz not null default now()
);
alter table public.security_flags add column if not exists only_users uuid[];
alter table public.security_flags enable row level security;
revoke all on public.security_flags from anon, authenticated;
insert into public.security_flags (key, enabled) values ('mfa_enforcement', false)
on conflict (key) do nothing;

-- True when this user must present a second factor on every session.
create or replace function public.mfa_required_for_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           (select f.enabled and (f.only_users is null or p_user_id = any (f.only_users))
              from public.security_flags f where f.key = 'mfa_enforcement'),
           false)
     and p_user_id is not null
     and (
       exists (select 1 from auth.mfa_factors f where f.user_id = p_user_id and f.status = 'verified')
       or exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role = 'admin')
     )
$$;
revoke all on function public.mfa_required_for_user(uuid) from public, anon, authenticated;
grant execute on function public.mfa_required_for_user(uuid) to service_role;

-- True when the current session is allowed in: aal2, or no second factor needed.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not public.mfa_required_for_user(auth.uid())
$$;
revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated, service_role;

-- 1. RLS ---------------------------------------------------------------------

do $$
declare
  t record;
begin
  perform set_config('lock_timeout', '10s', true);
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'mfa_required')
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.relname
    );
  end loop;
end
$$;

do $$
begin
  perform set_config('lock_timeout', '10s', true);
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'mfa_required') then
    create policy mfa_required on storage.objects
      as restrictive for all to authenticated
      using ((select public.mfa_satisfied()))
      with check ((select public.mfa_satisfied()));
  end if;
end
$$;

-- 2. PostgREST pre-request hook ------------------------------------------------

create or replace function public.enforce_mfa_on_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  req_path text := coalesce(current_setting('request.path', true), '');
begin
  -- Only signed-in users are checked: anon has no data access, service_role is the server.
  if claims ->> 'role' is distinct from 'authenticated' then
    return;
  end if;
  -- The enrollment screen decides who must enroll by asking has_role (suffix match: the
  -- path may or may not carry a gateway prefix).
  if req_path like '%/rpc/has\_role' then
    return;
  end if;
  if not public.mfa_satisfied() then
    raise exception 'Verifica in due passaggi richiesta'
      using errcode = 'PT403', hint = 'mfa_required';
  end if;
end
$$;
revoke all on function public.enforce_mfa_on_request() from public;
grant execute on function public.enforce_mfa_on_request() to anon, authenticated, service_role, authenticator;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_mfa_on_request';
notify pgrst, 'reload config';
