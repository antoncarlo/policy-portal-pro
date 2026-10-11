-- Registro di audit append-only.
--
-- Per un intermediario assicurativo serve sapere chi ha fatto cosa e quando: creazione, modifica o
-- cancellazione di pratiche, clienti, utenti, ruoli, provvigioni, chiavi API, impostazioni.
-- La tabella activity_logs esisteva ma nessun codice vi scriveva.
--
--   audit_log                     una riga per ogni fatto; la scrivono solo i trigger e il server
--                                 (source 'db' = trigger sulla tabella, 'app' = azione del portale);
--                                 non si modifica e non si cancella (salvo la pulizia di retention)
--   audit_row_change()            trigger generico: chi (auth.uid()), da dove (ip, browser), quali colonne
--                                 sono cambiate (solo quelle, con valore prima e dopo)
--   purge_old_audit_log()         retention: 10 anni per pratiche, clienti e documenti, 2 anni per il resto

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  source text not null default 'db' check (source in ('db', 'app')),
  table_name text,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_keys text[],
  details jsonb,
  ip text,
  user_agent text
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, at desc);

alter table public.audit_log enable row level security;

create policy "Administrators read the audit log" on public.audit_log
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.audit_log
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Append only: nessuno modifica o cancella, nemmeno il server (la retention passa da purge_old_audit_log).
create or replace function public.audit_log_immutable()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if tg_op = 'DELETE' and current_setting('app.audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$function$;

create or replace trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Trigger generico. Argomenti: 1) colonne che da sole non fanno notizia in un UPDATE (separate da virgola),
-- 2) colonne mai registrate (segreti).
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_ignore text[] := string_to_array(coalesce(nullif(tg_argv[0], ''), 'updated_at'), ',');
  v_redact text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_keys text[];
  v_id text;
  v_key text;
  v_headers jsonb;
  v_actor uuid := auth.uid();
  v_role text;
begin
  -- A problem while writing the audit line must not stop the business operation: it is reported in the
  -- database log (WARNING) and the operation goes on.
  begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := coalesce(v_row->>'id', v_row->>'practice_id', v_row->>'api_key_id', v_row->>'user_id');
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  foreach v_key in array v_redact loop
    if v_key <> '' then
      v_old := v_old - v_key;
      v_new := v_new - v_key;
    end if;
  end loop;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_keys
      from jsonb_each(v_new) n
     where n.value is distinct from v_old -> n.key
       and not (n.key = any(v_ignore));
    -- Only columns that do not matter changed (updated_at, counters): not worth a line.
    if v_keys is null then
      return null;
    end if;
    v_old := (select jsonb_object_agg(k, v_old -> k) from unnest(v_keys) k);
    v_new := (select jsonb_object_agg(k, v_new -> k) from unnest(v_keys) k);
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  if v_actor is not null then
    select ur.role::text into v_role from public.user_roles ur where ur.user_id = v_actor limit 1;
  end if;

  insert into public.audit_log (actor_id, actor_role, source, table_name, row_id, action, old_data, new_data, changed_keys, ip, user_agent)
  values (
    v_actor,
    coalesce(v_role, case when v_actor is null then 'system' else null end),
    'db', tg_table_name, v_id, lower(tg_op), v_old, v_new, v_keys,
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    left(v_headers ->> 'user-agent', 300)
  );
  exception when others then
    raise warning 'audit_row_change(%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$function$;

create or replace trigger audit_practices after insert or update or delete on public.practices
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_clients after insert or update or delete on public.clients
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_user_product_permissions after insert or update or delete on public.user_product_permissions
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_api_key_user_mapping after insert or update or delete on public.api_key_user_mapping
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_api_keys after insert or update or delete on public.api_keys
  for each row execute function public.audit_row_change('updated_at,last_used_at', 'key_hash');
create or replace trigger audit_partner_webhooks after insert or update or delete on public.partner_webhooks
  for each row execute function public.audit_row_change('updated_at', 'secret');
create or replace trigger audit_practice_documents after insert or update or delete on public.practice_documents
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_system_settings after insert or update or delete on public.system_settings
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_user_notification_settings after insert or update or delete on public.user_notification_settings
  for each row execute function public.audit_row_change('updated_at');
create or replace trigger audit_vies_fiscal_representatives after insert or update or delete on public.vies_fiscal_representatives
  for each row execute function public.audit_row_change('updated_at');
-- Lotti VIES: i contatori dei job cambiano di continuo e non fanno notizia.
create or replace trigger audit_vies_batches after insert or update or delete on public.vies_batches
  for each row execute function public.audit_row_change('updated_at,ready_jobs,queued_jobs,processing_jobs,completed_jobs,failed_jobs,blocked_jobs,cancelled_jobs,last_worker_run_at,last_worker_message,processing_started_at,queued_at,completed_at,matched_requirements,missing_requirements,status');

-- Retention: 10 anni per pratiche, clienti e documenti (conservazione assicurativa), 2 anni per il resto.
create or replace function public.purge_old_audit_log()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_deleted integer;
begin
  perform set_config('app.audit_purge', 'on', true);
  delete from public.audit_log
   where (table_name in ('practices', 'clients', 'practice_documents') and at < now() - interval '10 years')
      or (coalesce(table_name, '') not in ('practices', 'clients', 'practice_documents') and at < now() - interval '2 years');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_old_audit_log() from public, anon, authenticated;
grant execute on function public.purge_old_audit_log() to service_role;
