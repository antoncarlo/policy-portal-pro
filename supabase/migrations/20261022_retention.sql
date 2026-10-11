-- Conservazione dei dati: quanto restano i registri e quando gli indirizzi IP vengono resi anonimi.
--
-- Un registro che cresce senza limiti e con dati personali (indirizzi IP, email dei clienti, corpi delle
-- notifiche) è un rischio: art. 5(1)(e) GDPR, limitazione della conservazione. Ogni notte (pg_cron, 02:15 UTC)
-- run_retention() applica queste regole:
--
--   api_logs             IP troncato dopo 30 giorni (ultimo ottetto a 0; IPv6 solo i primi 48 bit); cancellati dopo 12 mesi
--   email_logs           cancellati dopo 24 mesi
--   integration_events   cancellati dopo 12 mesi
--   outbound_deliveries  consegnate: dopo 6 mesi; fallite: dopo 12 mesi
--   notification_events  elaborate: dopo 30 giorni
--   rate_limit_hits      dopo 1 giorno
--   activity_logs        (tabella storica, non più scritta) dopo 24 mesi
--   audit_log            IP e browser resi anonimi dopo 12 mesi; righe cancellate dopo 10 anni (pratiche, clienti,
--                        documenti) o 2 anni (il resto), come prima
--
-- Le pratiche e i clienti non sono toccati: la loro conservazione (10 anni dalla scadenza) è una decisione
-- sull'archivio, non sui registri.

-- Indirizzo reso anonimo: IPv4 con l'ultimo ottetto a 0, IPv6 con i soli primi tre gruppi. Idempotente.
create or replace function public.pseudonymize_ip(p_ip text)
returns text language sql immutable set search_path to 'public' as $function$
  select case
    when p_ip is null then null
    when p_ip ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then regexp_replace(p_ip, '\.[0-9]{1,3}$', '.0')
    when p_ip ~ '^[0-9A-Fa-f]{0,4}:[0-9A-Fa-f]{0,4}:[0-9A-Fa-f]{0,4}:.+$' then regexp_replace(p_ip, '^([0-9A-Fa-f]{0,4}:[0-9A-Fa-f]{0,4}:[0-9A-Fa-f]{0,4}):.*$', '\1::')
    else p_ip
  end;
$function$;

-- L'audit resta append-only; solo la pulizia notturna può togliere IP e browser da una riga (nient'altro cambia).
create or replace function public.audit_log_immutable()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if current_setting('app.audit_purge', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'ip' - 'user_agent') = (to_jsonb(old) - 'ip' - 'user_agent') then
      return new;
    end if;
  end if;
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$function$;

-- Cancellazione con condizione: l'unico punto del database che compone un DELETE da testo, usato solo dalle
-- funzioni di conservazione qui sotto (nessuno può chiamarlo dall'esterno).
create or replace function public.retention_delete(p_table regclass, p_condition text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_deleted integer;
begin
  execute format($q$delete from %s
    where %s$q$, p_table, p_condition);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

create or replace function public.purge_old_audit_log()
returns integer language plpgsql security definer set search_path to 'public' as $function$
begin
  perform set_config('app.audit_purge', 'on', true);
  return public.retention_delete(
    'public.audit_log',
    $q$(table_name in ('practices', 'clients', 'practice_documents') and at < now() - interval '10 years')
       or (coalesce(table_name, '') not in ('practices', 'clients', 'practice_documents') and at < now() - interval '2 years')$q$
  );
end;
$function$;

create or replace function public.run_retention()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_result jsonb := '{}'::jsonb;
  v_count integer;
begin
  perform set_config('app.audit_purge', 'on', true);

  update public.api_logs set ip_address = public.pseudonymize_ip(ip_address)
   where created_at < now() - interval '30 days' and ip_address is distinct from public.pseudonymize_ip(ip_address);
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('api_logs_ip_pseudonymised', v_count);

  v_result := v_result || jsonb_build_object(
    'api_logs_deleted', public.retention_delete('public.api_logs', $q$created_at < now() - interval '12 months'$q$),
    'email_logs_deleted', public.retention_delete('public.email_logs', $q$created_at < now() - interval '24 months'$q$),
    'integration_events_deleted', public.retention_delete('public.integration_events', $q$created_at < now() - interval '12 months'$q$),
    'outbound_deliveries_deleted', public.retention_delete(
      'public.outbound_deliveries',
      $q$(status = 'delivered' and created_at < now() - interval '6 months') or (status = 'failed' and created_at < now() - interval '12 months')$q$
    ),
    'notification_events_deleted', public.retention_delete('public.notification_events', $q$processed_at is not null and processed_at < now() - interval '30 days'$q$),
    'rate_limit_hits_deleted', public.retention_delete('public.rate_limit_hits', $q$window_start < now() - interval '1 day'$q$),
    'activity_logs_deleted', public.retention_delete('public.activity_logs', $q$created_at < now() - interval '24 months'$q$)
  );

  -- Audit: IP and browser anonymised after 12 months (the only change the append-only trigger lets through).
  update public.audit_log set ip = public.pseudonymize_ip(ip), user_agent = null
   where at < now() - interval '12 months' and (ip is distinct from public.pseudonymize_ip(ip) or user_agent is not null);
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('audit_log_pseudonymised', v_count, 'audit_log_deleted', public.purge_old_audit_log());

  return v_result;
end;
$function$;

revoke all on function public.pseudonymize_ip(text) from public, anon, authenticated;
revoke all on function public.retention_delete(regclass, text) from public, anon, authenticated;
revoke all on function public.purge_old_audit_log() from public, anon, authenticated;
revoke all on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;
grant execute on function public.purge_old_audit_log() to service_role;

-- Pianificazione notturna.
create extension if not exists pg_cron;

select cron.schedule('portal-retention', '15 2 * * *', 'select public.run_retention()');
