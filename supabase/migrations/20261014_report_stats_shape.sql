-- Report di produzione: i grafici e la classifica agenti della pagina Report leggono
--   mese:   count, premium, commission
--   agente: agent_name, practices_count, total_premium, total_commission
-- ma la funzione restituiva solo "practices" per mese e nessun nome dell'agente: grafici dei mesi e
-- classifica restavano vuoti. Si aggiungono le chiavi mancanti (le esistenti restano, per chi le usa).
-- Stesso perimetro di prima (report_scope_user_ids): nessun dato in piu' per nessuno.

create or replace function public.get_production_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_agent_id uuid default null::uuid)
returns table(total_practices bigint, total_premium numeric, total_commission numeric, avg_premium numeric, practices_by_type jsonb, practices_by_status jsonb, practices_by_month jsonb, top_agents jsonb)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scope uuid[] := public.report_scope_user_ids();
begin
  return query
  with rp as (
    select pr.practice_type, pr.status, pr.created_at, pr.premium_gross, pr.commission_amount, pr.user_id
    from public.practices pr
    where pr.created_at between p_start_date and p_end_date
      and (v_scope is null or pr.user_id = any(v_scope))
      and (p_agent_id is null or pr.user_id = p_agent_id)
  )
  select
    (select count(*)::bigint from rp),
    (select coalesce(sum(rp.premium_gross), 0) from rp),
    (select coalesce(sum(rp.commission_amount), 0) from rp),
    (select case when count(*) > 0 then coalesce(sum(rp.premium_gross), 0) / count(*) else 0 end from rp),
    coalesce((select jsonb_object_agg(t.practice_type, t.count)
              from (select rp.practice_type, count(*)::integer as count from rp group by rp.practice_type) t), '{}'::jsonb),
    coalesce((select jsonb_object_agg(t.status, t.count)
              from (select rp.status, count(*)::integer as count from rp group by rp.status) t), '{}'::jsonb),
    coalesce((select jsonb_agg(m order by m.month)
              from (select date_trunc('month', rp.created_at) as month,
                           count(*)::integer as practices,
                           count(*)::integer as count,
                           coalesce(sum(rp.premium_gross), 0) as premium,
                           coalesce(sum(rp.commission_amount), 0) as commission
                    from rp group by date_trunc('month', rp.created_at)) m), '[]'::jsonb),
    coalesce((select jsonb_agg(a order by a.total_premium desc)
              from (select rp.user_id as agent_id,
                           coalesce(max(pf.full_name), '-') as agent_name,
                           count(*)::integer as practices,
                           count(*)::integer as practices_count,
                           coalesce(sum(rp.premium_gross), 0) as total_premium,
                           coalesce(sum(rp.commission_amount), 0) as total_commission
                    from rp left join public.profiles pf on pf.id = rp.user_id
                    group by rp.user_id
                    order by coalesce(sum(rp.premium_gross), 0) desc
                    limit 10) a), '[]'::jsonb);
end;
$function$;
