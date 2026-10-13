#!/usr/bin/env bash
# Simulates the Supabase Preview check: applies supabase/migrations/*.sql in file-name order on an
# empty Postgres with the Supabase roles/schemas stubbed (auth, storage, cron). Stops at the first
# failing file and prints the error.
set -u
P=/tmp/pgsim
PSQL="psql -h $P -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
DB=${1:-sim}
MIG_DIR=${2:-$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations}

$PSQL -d postgres -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -d "$DB" <<'EOF' >/dev/null
do $$ begin
  perform 1 from pg_roles where rolname = 'anon'; if not found then create role anon nologin; end if;
  perform 1 from pg_roles where rolname = 'authenticated'; if not found then create role authenticated nologin; end if;
  perform 1 from pg_roles where rolname = 'service_role'; if not found then create role service_role nologin bypassrls; end if;
  perform 1 from pg_roles where rolname = 'supabase_admin'; if not found then create role supabase_admin nologin superuser; end if;
  perform 1 from pg_roles where rolname = 'supabase_auth_admin'; if not found then create role supabase_auth_admin nologin; end if;
  perform 1 from pg_roles where rolname = 'supabase_storage_admin'; if not found then create role supabase_storage_admin nologin; end if;
  perform 1 from pg_roles where rolname = 'authenticator'; if not found then create role authenticator nologin; end if;
  perform 1 from pg_roles where rolname = 'dashboard_user'; if not found then create role dashboard_user nologin; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- auth
create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text, phone text, encrypted_password text,
  email_confirmed_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, banned_until timestamptz, is_sso_user boolean default false, is_anonymous boolean default false, aud text, role text,
  instance_id uuid, invited_at timestamptz, confirmation_token text, confirmation_sent_at timestamptz, recovery_token text, recovery_sent_at timestamptz,
  email_change_token_new text, email_change text, email_change_sent_at timestamptz, email_change_token_current text, email_change_confirm_status smallint default 0,
  phone_confirmed_at timestamptz, phone_change text, phone_change_token text, phone_change_sent_at timestamptz, confirmed_at timestamptz,
  reauthentication_token text, reauthentication_sent_at timestamptz, is_super_admin boolean
);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, provider text, provider_id text, identity_data jsonb, last_sign_in_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table auth.audit_log_entries (id uuid primary key default gen_random_uuid(), instance_id uuid, payload json, created_at timestamptz default now(), ip_address text);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, friendly_name text, factor_type text, status text, created_at timestamptz default now(), updated_at timestamptz default now());
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), aal text, not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb->>'sub'), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(coalesce(current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true)::jsonb->>'role'), '')::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- storage
create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null unique, owner uuid, public boolean default false, avif_autodetection boolean default false, file_size_limit bigint, allowed_mime_types text[], owner_id text, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), metadata jsonb, path_tokens text[] generated always as (string_to_array(name, '/')) stored, version text, user_metadata jsonb);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
create function storage.filename(name text) returns text language plpgsql as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[array_length(_parts,1)]; end $$;
create function storage.extension(name text) returns text language plpgsql as $$ declare _parts text[]; _filename text; begin select string_to_array(name, '/') into _parts; select _parts[array_length(_parts,1)] into _filename; return reverse(split_part(reverse(_filename), '.', 1)); end $$;
create policy "Service role full access" on storage.objects for all using (true) with check (true);
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
create publication supabase_realtime;
-- cron (pg_cron is not installable here)
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, schedule text, command text, jobname text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ insert into cron.job(schedule, command, jobname) values (schedule, command, job_name) returning jobid $$;
create function cron.schedule(schedule text, command text) returns bigint language sql as $$ insert into cron.job(schedule, command) values (schedule, command) returning jobid $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ delete from cron.job where jobname = job_name; select true $$;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
EOF
# the search_path setting above used a placeholder: apply it for real
$PSQL -d "$DB" -c "alter database $DB set search_path to public, extensions;" >/dev/null

applied=0
for f in $(ls "$MIG_DIR"/*.sql | sort); do
  name=$(basename "$f")
  # pg_cron cannot be installed locally: the stubbed cron schema stands in for it
  tmp=$(mktemp /tmp/pgsim/mig.XXXXXX.sql)
  sed -E 's/^\s*create extension if not exists pg_cron[^;]*;/select 1;/I' "$f" > "$tmp"
  if out=$($PSQL -d "$DB" -1 -f "$tmp" 2>&1); then
    applied=$((applied+1))
  else
    echo "FAILED at: $name (after $applied applied)"
    echo "$out" | grep -v "^$" | head -12
    rm -f "$tmp"
    exit 1
  fi
  rm -f "$tmp"
done
echo "ALL APPLIED: $applied files"
