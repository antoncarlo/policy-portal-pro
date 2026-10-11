-- Rate limit condiviso tra le istanze delle funzioni.
--
-- Il limite precedente viveva nella memoria di ogni istanza serverless: con più istanze (o dopo un
-- riavvio a freddo) ogni istanza ripartiva da zero e il limite reale era un multiplo di quello dichiarato.
-- Qui il contatore sta nel database: una riga per (chiave del limite, finestra), incrementata in modo
-- atomico. Finestra fissa: al massimo il doppio del limite a cavallo di due finestre, mai di più.
--
--   rate_limit_hits          contatori; li tocca solo il server (service role)
--   rate_limit_hit()         conta una chiamata e dice se è ammessa e tra quanti secondi riprovare
--   purge_rate_limit_hits()  toglie le finestre vecchie (anche in modo opportunistico da rate_limit_hit)

create table if not exists public.rate_limit_hits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limit_hits_window_idx on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer, hits integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_window integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or btrim(p_bucket) = '' or p_limit is null or p_limit < 1 then
    raise exception 'rate_limit_hit: invalid arguments' using errcode = '22023';
  end if;

  v_start := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);

  insert into public.rate_limit_hits as r (bucket, window_start, hits)
  values (left(p_bucket, 200), v_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Cleanup: about one call in two hundred removes the windows that ended more than a day ago.
  if random() < 0.005 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  allowed := v_hits <= p_limit;
  retry_after := case when v_hits <= p_limit then 0
    else greatest(ceil(extract(epoch from (v_start + make_interval(secs => v_window) - now())))::integer, 1) end;
  hits := v_hits;
  return next;
end;
$function$;

create or replace function public.purge_rate_limit_hits()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.purge_rate_limit_hits() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.purge_rate_limit_hits() to service_role;
