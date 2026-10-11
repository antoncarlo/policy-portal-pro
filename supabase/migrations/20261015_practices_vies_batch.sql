-- Pratiche raggruppate per lotto VIES.
--
-- Una pratica VIES nasce da un lotto (vies_batches). Fino a ora il legame era indiretto
-- (vies_jobs.external_reference = id pratica): la lista Pratiche non poteva raggruppare per lotto.
--   practices.vies_batch_id     il lotto da cui viene la pratica (null: non e' una pratica di lotto)
--   get_practice_lots(...)      i lotti con le pratiche che il chiamante puo' vedere e il loro numero
-- Nessun dato in piu' per nessuno: la funzione applica lo stesso perimetro delle policy di practices
-- (proprie, collaboratori per l'agente, tutte per l'amministratore) e la verifica a due fattori.

alter table public.practices add column if not exists vies_batch_id uuid references public.vies_batches(id) on delete set null;
create index if not exists practices_vies_batch_idx on public.practices (vies_batch_id) where vies_batch_id is not null;

-- Pratiche gia' esistenti: il lotto si ricava dai job.
update public.practices p
   set vies_batch_id = j.batch_id
  from public.vies_jobs j
 where p.vies_batch_id is null
   and j.batch_id is not null
   and j.external_reference = p.id::text;

-- Da ora, qualunque strada crei o aggiorni il job tiene allineata la pratica.
create or replace function public.link_practice_to_batch()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.batch_id is not null and new.external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.practices
       set vies_batch_id = new.batch_id
     where id = new.external_reference::uuid
       and vies_batch_id is distinct from new.batch_id;
  end if;
  return new;
end;
$function$;

create or replace trigger link_practice_to_batch after insert or update of external_reference, batch_id on public.vies_jobs
  for each row execute function public.link_practice_to_batch();

-- I lotti con almeno una pratica visibile al chiamante, dal piu' recente.
create or replace function public.get_practice_lots(p_batch_ids uuid[] default null, p_limit integer default null)
returns table (batch_id uuid, lot_number integer, name text, fiscal_representative_name text, created_at timestamptz, practice_count integer)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.mfa_satisfied() then
    return;
  end if;
  return query
  with visible as (
    select p.vies_batch_id as bid
      from public.practices p
     where p.vies_batch_id is not null
       and (p_batch_ids is null or p.vies_batch_id = any(p_batch_ids))
       and (
         public.is_admin_or_service()
         or p.user_id = auth.uid()
         or (public.has_role(auth.uid(), 'agente'::public.app_role) and public.can_view_practice(auth.uid(), p.user_id))
       )
  ), per_lot as (
    select v.bid, count(*)::integer as n from visible v group by v.bid
  )
  select b.id, b.lot_number, b.name, fr.name, b.created_at, pl.n
    from per_lot pl
    join public.vies_batches b on b.id = pl.bid
    left join public.vies_fiscal_representatives fr on fr.id = b.fiscal_representative_id
   order by b.created_at desc, b.id
   limit p_limit;
end;
$function$;

revoke all on function public.get_practice_lots(uuid[], integer) from public, anon;
grant execute on function public.get_practice_lots(uuid[], integer) to authenticated, service_role;
