-- Security hardening (audit 9 Oct 2026).
--
-- Before this migration an anonymous visitor holding only the public (anon) key could:
--   * read, overwrite and delete every file of the practice-documents bucket
--     (a policy meant for the service role was granted to every role);
--   * call SECURITY DEFINER functions that trusted the user id passed as a
--     parameter or did not check the caller at all, reading every user, every
--     practice with premiums and client contacts, and the production reports.
-- Signed-in users could also edit their own commission and collection data, and
-- settle their own VIES lots. This migration closes all of that and adds the
-- missing admin policies on user_roles (role change and agent assignment were
-- silently ignored).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
$$;

create or replace function public.is_admin_or_service()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role() or public.has_role(auth.uid(), 'admin')
$$;

-- ---------------------------------------------------------------------------
-- 1. Storage
-- ---------------------------------------------------------------------------

-- Meant for the service role, it was granted to every role and opened the bucket to
-- anyone holding the public key. The service role bypasses RLS anyway.
alter policy "Service role full access" on storage.objects to service_role;

-- The signature printed on the statements is shared: the administrators upload it,
-- every signed-in user can read it to issue the client statement of their lots.
create policy "Signed-in users can read the statement signature"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vies-batch-files'
    and name = '00000000-0000-0000-0000-000000000000/impostazioni/firma-estratti-conto'
  );

-- ---------------------------------------------------------------------------
-- 2. Functions that read data: check the caller
-- ---------------------------------------------------------------------------

create or replace function public.get_all_users_with_details()
returns table(id uuid, full_name text, email text, phone text, avatar_url text, role text, agent_name text, practice_count bigint, default_commission_percentage numeric, commission_bonus_tiers jsonb)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin_or_service() then
    raise exception 'Accesso riservato agli amministratori' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    ur.role::text as role,
    parent_profile.full_name as agent_name,
    coalesce(pc.practice_count, 0)::bigint as practice_count,
    coalesce(p.default_commission_percentage, 0)::numeric as default_commission_percentage,
    coalesce(p.commission_bonus_tiers, '[]'::jsonb) as commission_bonus_tiers
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  left join public.profiles parent_profile on parent_profile.id = ur.parent_agent_id
  left join (
    select pr.user_id, count(*)::bigint as practice_count
    from public.practices pr
    group by pr.user_id
  ) pc on pc.user_id = p.id
  order by p.created_at desc;
end;
$function$;

create or replace function public.get_hierarchical_user_ids(requesting_user_id uuid)
returns table(user_id uuid, full_name text, role text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  user_role text;
begin
  if not public.is_service_role() and requesting_user_id is distinct from auth.uid() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select ur.role::text into user_role from public.user_roles ur where ur.user_id = requesting_user_id;

  if user_role = 'admin' then
    return query
    select p.id, p.full_name, ur.role::text
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    order by ur.role::text, p.full_name;
    return;
  end if;

  if user_role = 'agente' then
    return query
    select p.id, p.full_name, ur.role::text
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = requesting_user_id
       or (ur.role = 'collaboratore' and ur.parent_agent_id = requesting_user_id)
    order by ur.role::text, p.full_name;
    return;
  end if;

  return query
  select p.id, p.full_name, ur.role::text
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where p.id = requesting_user_id;
end;
$function$;

create or replace function public.get_hierarchical_financial_summary(requesting_user_id uuid, target_user_id uuid default null::uuid)
returns table(total_practices bigint, total_premium_amount numeric, total_commission_amount numeric, non_incassate_count bigint, non_incassate_amount numeric, incassate_count bigint, incassate_commission numeric, provvigioni_ricevute_count bigint, provvigioni_ricevute_amount numeric)
language plpgsql
security definer
set search_path = public
as $function$
declare
  user_role text;
  allowed_user_ids uuid[];
begin
  if not public.is_service_role() and requesting_user_id is distinct from auth.uid() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select ur.role::text into user_role from public.user_roles ur where ur.user_id = requesting_user_id;

  if user_role = 'admin' then
    if target_user_id is not null then
      allowed_user_ids := array[target_user_id];
    else
      select array_agg(p.id) into allowed_user_ids from public.profiles p;
    end if;
  elsif user_role = 'agente' then
    if target_user_id is not null then
      if target_user_id = requesting_user_id or exists (
        select 1 from public.user_roles ur
        where ur.user_id = target_user_id and ur.role = 'collaboratore' and ur.parent_agent_id = requesting_user_id
      ) then
        allowed_user_ids := array[target_user_id];
      else
        allowed_user_ids := array[]::uuid[];
      end if;
    else
      select array_agg(ur.user_id) into allowed_user_ids
      from public.user_roles ur
      where ur.user_id = requesting_user_id or (ur.role = 'collaboratore' and ur.parent_agent_id = requesting_user_id);
    end if;
  else
    allowed_user_ids := array[requesting_user_id];
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(premium_net), 0),
    coalesce(sum(commission_amount), 0),
    count(*) filter (where financial_status = 'non_incassata')::bigint,
    coalesce(sum(premium_net) filter (where financial_status = 'non_incassata'), 0),
    count(*) filter (where financial_status = 'incassata')::bigint,
    coalesce(sum(commission_amount) filter (where financial_status = 'incassata'), 0),
    count(*) filter (where financial_status = 'provvigioni_ricevute')::bigint,
    coalesce(sum(commission_amount) filter (where financial_status = 'provvigioni_ricevute'), 0)
  from public.practices
  where user_id = any(allowed_user_ids);
end;
$function$;

create or replace function public.get_hierarchical_practices(requesting_user_id uuid, target_user_id uuid default null::uuid)
returns table(id uuid, practice_number text, practice_type text, client_name text, premium_net numeric, premium_taxable numeric, premium_taxes numeric, premium_gross numeric, commission_percentage numeric, commission_amount numeric, financial_status text, payment_date date, commission_received_date date, created_at timestamp with time zone, user_id uuid, user_full_name text, user_role text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  user_role text;
  allowed_user_ids uuid[];
begin
  if not public.is_service_role() and requesting_user_id is distinct from auth.uid() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select ur.role::text into user_role from public.user_roles ur where ur.user_id = requesting_user_id;

  if user_role = 'admin' then
    allowed_user_ids := case when target_user_id is not null then array[target_user_id] else null end;
  elsif user_role = 'agente' then
    if target_user_id is not null then
      if target_user_id = requesting_user_id or exists (
        select 1 from public.user_roles ur
        where ur.user_id = target_user_id and ur.role = 'collaboratore' and ur.parent_agent_id = requesting_user_id
      ) then
        allowed_user_ids := array[target_user_id];
      else
        return;
      end if;
    else
      select array_agg(ur.user_id) into allowed_user_ids
      from public.user_roles ur
      where ur.user_id = requesting_user_id or (ur.role = 'collaboratore' and ur.parent_agent_id = requesting_user_id);
    end if;
  else
    allowed_user_ids := array[requesting_user_id];
  end if;

  return query
  select pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
         pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
         pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
         pr.payment_date, pr.commission_received_date, pr.created_at,
         pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
  from public.practices pr
  join public.profiles p on p.id = pr.user_id
  join public.user_roles ur on ur.user_id = pr.user_id
  where allowed_user_ids is null or pr.user_id = any(allowed_user_ids)
  order by pr.created_at desc, pr.id;
end;
$function$;

create or replace function public.get_financial_summary(user_uuid uuid)
returns table(total_practices bigint, total_premium_amount numeric, total_commission_amount numeric, non_incassate_count bigint, non_incassate_amount numeric, incassate_count bigint, incassate_commission numeric, provvigioni_ricevute_count bigint, provvigioni_ricevute_amount numeric)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin_or_service()
     and user_uuid is distinct from auth.uid()
     and not exists (select 1 from public.get_hierarchical_user_ids(auth.uid()) h where h.user_id = user_uuid) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(premium_net), 0),
    coalesce(sum(commission_amount), 0),
    count(*) filter (where financial_status = 'non_incassata')::bigint,
    coalesce(sum(premium_net) filter (where financial_status = 'non_incassata'), 0),
    count(*) filter (where financial_status = 'incassata')::bigint,
    coalesce(sum(commission_amount) filter (where financial_status = 'incassata'), 0),
    count(*) filter (where financial_status = 'provvigioni_ricevute')::bigint,
    coalesce(sum(commission_amount) filter (where financial_status = 'provvigioni_ricevute'), 0)
  from public.practices
  where user_id = user_uuid;
end;
$function$;

create or replace function public.get_upcoming_expiries(p_user_id uuid, p_days_ahead integer default 90, p_practice_type text default null::text)
returns table(practice_id uuid, practice_number text, practice_type text, client_name text, client_email text, client_phone text, policy_end_date date, days_until_expiry integer, notification_90_sent boolean, notification_60_sent boolean, notification_30_sent boolean, notification_7_sent boolean, user_id uuid, user_full_name text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role() and p_user_id is distinct from auth.uid() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  return query
  select p.id, p.practice_number, p.practice_type::text, p.client_name, p.client_email, p.client_phone, p.policy_end_date,
         (p.policy_end_date - current_date)::integer as days_until_expiry,
         coalesce((select en.sent from public.expiry_notifications en where en.practice_id = p.id and en.notification_type = '90_days'), false),
         coalesce((select en.sent from public.expiry_notifications en where en.practice_id = p.id and en.notification_type = '60_days'), false),
         coalesce((select en.sent from public.expiry_notifications en where en.practice_id = p.id and en.notification_type = '30_days'), false),
         coalesce((select en.sent from public.expiry_notifications en where en.practice_id = p.id and en.notification_type = '7_days'), false),
         p.user_id, prof.full_name as user_full_name
  from public.practices p
  left join public.profiles prof on p.user_id = prof.id
  where p.policy_end_date is not null
    and p.policy_end_date between current_date and current_date + p_days_ahead
    and p.status in ('completata', 'approvata', 'in_lavorazione')
    and p.user_id in (select ghu.user_id from public.get_hierarchical_user_ids(p_user_id) ghu)
    and (p_practice_type is null or p.practice_type::text = p_practice_type)
  order by p.policy_end_date asc;
end;
$function$;

-- Users whose practices the caller may see in reports: null means all (admin, service role).
create or replace function public.report_scope_user_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if public.is_admin_or_service() then
    return null;
  end if;
  return coalesce(array(select h.user_id from public.get_hierarchical_user_ids(auth.uid()) h), array[]::uuid[]);
end;
$function$;

create or replace function public.get_production_details(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_agent_id uuid default null::uuid, p_practice_type character varying default null::character varying, p_status character varying default null::character varying)
returns table(practice_number text, practice_type text, client_name text, policy_number text, policy_start_date date, policy_end_date date, premium_gross numeric, commission_amount numeric, status text, created_at timestamp with time zone)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scope uuid[] := public.report_scope_user_ids();
begin
  return query
  select p.practice_number, p.practice_type::text, p.client_name, p.policy_number, p.policy_start_date, p.policy_end_date,
         p.premium_gross, p.commission_amount, p.status::text, p.created_at
  from public.practices p
  where p.created_at between p_start_date and p_end_date
    and (v_scope is null or p.user_id = any(v_scope))
    and (p_agent_id is null or p.user_id = p_agent_id)
    and (p_practice_type is null or p.practice_type::text = p_practice_type)
    and (p_status is null or p.status::text = p_status)
  order by p.created_at desc, p.id;
end;
$function$;

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
              from (select date_trunc('month', rp.created_at) as month, count(*)::integer as practices,
                           coalesce(sum(rp.premium_gross), 0) as premium
                    from rp group by date_trunc('month', rp.created_at)) m), '[]'::jsonb),
    coalesce((select jsonb_agg(a order by a.total_premium desc)
              from (select rp.user_id as agent_id, count(*)::integer as practices,
                           coalesce(sum(rp.premium_gross), 0) as total_premium,
                           coalesce(sum(rp.commission_amount), 0) as total_commission
                    from rp group by rp.user_id
                    order by coalesce(sum(rp.premium_gross), 0) desc
                    limit 10) a), '[]'::jsonb);
end;
$function$;

create or replace function public.get_dashboard_kpis(p_period character varying default 'month'::character varying)
returns table(current_period_practices bigint, current_period_premium numeric, current_period_commission numeric, previous_period_practices bigint, previous_period_premium numeric, previous_period_commission numeric, growth_practices numeric, growth_premium numeric, growth_commission numeric, avg_premium numeric, conversion_rate numeric, active_agents bigint, expiring_soon bigint)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scope uuid[] := public.report_scope_user_ids();
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_previous_start timestamptz;
  v_previous_end timestamptz;
  v_current_practices bigint;
  v_current_premium numeric;
  v_current_commission numeric;
  v_previous_practices bigint;
  v_previous_premium numeric;
  v_previous_commission numeric;
begin
  case p_period
    when 'week' then
      v_current_start := date_trunc('week', now()); v_previous_start := v_current_start - interval '1 week';
    when 'quarter' then
      v_current_start := date_trunc('quarter', now()); v_previous_start := v_current_start - interval '3 months';
    when 'year' then
      v_current_start := date_trunc('year', now()); v_previous_start := v_current_start - interval '1 year';
    else
      v_current_start := date_trunc('month', now()); v_previous_start := v_current_start - interval '1 month';
  end case;
  v_current_end := now();
  v_previous_end := v_current_start;

  select count(*), coalesce(sum(premium_gross), 0), coalesce(sum(commission_amount), 0)
    into v_current_practices, v_current_premium, v_current_commission
  from public.practices
  where created_at between v_current_start and v_current_end and (v_scope is null or user_id = any(v_scope));

  select count(*), coalesce(sum(premium_gross), 0), coalesce(sum(commission_amount), 0)
    into v_previous_practices, v_previous_premium, v_previous_commission
  from public.practices
  where created_at between v_previous_start and v_previous_end and (v_scope is null or user_id = any(v_scope));

  return query
  select v_current_practices, v_current_premium, v_current_commission,
         v_previous_practices, v_previous_premium, v_previous_commission,
         case when v_previous_practices > 0 then ((v_current_practices::numeric - v_previous_practices) / v_previous_practices * 100) else 0 end,
         case when v_previous_premium > 0 then ((v_current_premium - v_previous_premium) / v_previous_premium * 100) else 0 end,
         case when v_previous_commission > 0 then ((v_current_commission - v_previous_commission) / v_previous_commission * 100) else 0 end,
         case when v_current_practices > 0 then v_current_premium / v_current_practices else 0 end,
         case when v_current_practices > 0 then
           (select count(*)::numeric from public.practices
            where created_at between v_current_start and v_current_end and status = 'completata'
              and (v_scope is null or user_id = any(v_scope))) / v_current_practices * 100
         else 0 end,
         (select count(distinct user_id) from public.practices
          where created_at between v_current_start and v_current_end and (v_scope is null or user_id = any(v_scope))),
         (select count(*) from public.practices
          where policy_end_date between now() and now() + interval '30 days' and status != 'rifiutata'
            and (v_scope is null or user_id = any(v_scope)));
end;
$function$;

create or replace function public.get_effective_commission_percentage(p_user_id uuid, p_current_premium numeric default 0, p_reference_date timestamp with time zone default now(), p_exclude_practice_id uuid default null::uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  base_percentage numeric := 0;
  total_production numeric := 0;
  bonus_percentage numeric := 0;
begin
  if not public.is_admin_or_service()
     and p_user_id is distinct from auth.uid()
     and not exists (select 1 from public.get_hierarchical_user_ids(auth.uid()) h where h.user_id = p_user_id) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select coalesce(pr.default_commission_percentage, 0) into base_percentage
  from public.profiles pr where pr.id = p_user_id;

  select coalesce(sum(pa.premium_net), 0) into total_production
  from public.practices pa
  where pa.user_id = p_user_id
    and pa.premium_net is not null
    and date_trunc('year', pa.created_at) = date_trunc('year', coalesce(p_reference_date, now()))
    and (p_exclude_practice_id is null or pa.id <> p_exclude_practice_id);

  total_production := total_production + coalesce(p_current_premium, 0);

  select coalesce(sum(
    case
      when total_production >= coalesce((tier.value->>'threshold')::numeric, 0)
      then coalesce((tier.value->>'bonus_percentage')::numeric, 0)
      else 0
    end
  ), 0) into bonus_percentage
  from public.profiles pr
  cross join lateral jsonb_array_elements(coalesce(pr.commission_bonus_tiers, '[]'::jsonb)) as tier(value)
  where pr.id = p_user_id
    and jsonb_typeof(tier.value) = 'object'
    and (tier.value ? 'threshold')
    and (tier.value ? 'bonus_percentage');

  return round((coalesce(base_percentage, 0) + coalesce(bonus_percentage, 0))::numeric, 2);
end;
$function$;

-- The expiry trigger runs with the owner's rights, so the generator can be closed to clients.
create or replace function public.trigger_generate_expiry_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.policy_end_date is distinct from new.policy_end_date)) then
    perform public.generate_expiry_notifications(new.id);
  end if;
  return new;
end;
$function$;

alter function public.generate_expiry_notifications(uuid) set search_path = public;
alter function public.mark_notification_sent(uuid, text, boolean) set search_path = public;
alter function public.generate_practice_number() set search_path = public;
alter function public.log_practice_status_change() set search_path = public;
alter function public.update_clients_updated_at() set search_path = public;

-- ---------------------------------------------------------------------------
-- 3. Execute rights
-- ---------------------------------------------------------------------------

-- Nothing here is meant for visitors who are not signed in.
revoke execute on function
  public.get_all_users_with_details(),
  public.get_hierarchical_user_ids(uuid),
  public.get_hierarchical_financial_summary(uuid, uuid),
  public.get_hierarchical_practices(uuid, uuid),
  public.get_financial_summary(uuid),
  public.get_upcoming_expiries(uuid, integer, text),
  public.report_scope_user_ids(),
  public.get_production_details(timestamp with time zone, timestamp with time zone, uuid, character varying, character varying),
  public.get_production_stats(timestamp with time zone, timestamp with time zone, uuid),
  public.get_dashboard_kpis(character varying),
  public.get_effective_commission_percentage(uuid, numeric, timestamp with time zone, uuid),
  public.generate_practice_number(),
  public.get_parent_agent(uuid),
  public.get_user_allowed_practice_types(uuid),
  public.has_product_permission(uuid, public.practice_type),
  public.is_admin_or_service()
from public, anon;

-- Only the database itself (triggers, service role) uses these.
revoke execute on function
  public.generate_expiry_notifications(uuid),
  public.mark_notification_sent(uuid, text, boolean),
  public.calculate_commission(),
  public.handle_new_user(),
  public.handle_updated_at(),
  public.log_practice_creation(),
  public.log_practice_status_change(),
  public.notify_document_added(),
  public.prevent_unprivileged_practice_status_change(),
  public.update_clients_updated_at(),
  public.trigger_generate_expiry_notifications()
from public, anon, authenticated;

grant execute on function
  public.get_all_users_with_details(),
  public.get_hierarchical_user_ids(uuid),
  public.get_hierarchical_financial_summary(uuid, uuid),
  public.get_hierarchical_practices(uuid, uuid),
  public.get_financial_summary(uuid),
  public.get_upcoming_expiries(uuid, integer, text),
  public.report_scope_user_ids(),
  public.get_production_details(timestamp with time zone, timestamp with time zone, uuid, character varying, character varying),
  public.get_production_stats(timestamp with time zone, timestamp with time zone, uuid),
  public.get_dashboard_kpis(character varying),
  public.get_effective_commission_percentage(uuid, numeric, timestamp with time zone, uuid),
  public.generate_practice_number(),
  public.get_parent_agent(uuid),
  public.get_user_allowed_practice_types(uuid),
  public.has_product_permission(uuid, public.practice_type),
  public.is_admin_or_service()
to authenticated, service_role;

grant execute on function
  public.generate_expiry_notifications(uuid),
  public.mark_notification_sent(uuid, text, boolean)
to service_role;

-- ---------------------------------------------------------------------------
-- 4. Table policies
-- ---------------------------------------------------------------------------

-- Expiry schedule: written only by the database and the cron (service role).
alter policy "System can manage notifications" on public.expiry_notifications to service_role;
create policy "Admins can view all expiry notifications"
  on public.expiry_notifications for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- In-app notifications are created by database triggers only.
alter policy "System can insert notifications" on public.notifications to service_role;

-- Activity log: a signed-in user can only log their own actions.
alter policy "System can insert activity logs" on public.activity_logs to service_role;
create policy "Users can insert their own activity logs"
  on public.activity_logs for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Roles: administrators change roles and agent assignments; an agent can release
-- one of their collaborators. Without these, the changes were silently ignored.
create policy "Admins can update roles"
  on public.user_roles for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

create policy "Admins can delete roles"
  on public.user_roles for delete to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

create policy "Agents can release their collaborators"
  on public.user_roles for update to authenticated
  using (public.has_role((select auth.uid()), 'agente') and parent_agent_id = (select auth.uid()) and role = 'collaboratore')
  with check (parent_agent_id is null and role = 'collaboratore');

create or replace function public.guard_user_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_admin_or_service() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.role is distinct from old.role then
    raise exception 'Solo gli amministratori possono modificare ruoli e utenti' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger guard_user_role_changes
  before update on public.user_roles
  for each row execute function public.guard_user_role_changes();

-- ---------------------------------------------------------------------------
-- 5. Accounting data: administrators only
-- ---------------------------------------------------------------------------

-- Commission, collection and settlement are set by the administrators. Runs before
-- trigger_calculate_commission (alphabetical order), so the commission the database
-- derives from the profile when the premium changes is still applied.
create or replace function public.guard_practice_financial_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_admin_or_service() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.commission_percentage := null;
    new.financial_status := 'non_incassata';
    new.payment_date := null;
    new.commission_received_date := null;
    return new;
  end if;

  if new.commission_percentage is distinct from old.commission_percentage
     or new.financial_status is distinct from old.financial_status
     or new.payment_date is distinct from old.payment_date
     or new.commission_received_date is distinct from old.commission_received_date then
    raise exception 'Solo gli amministratori possono modificare provvigioni, incasso e date contabili della pratica'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger guard_practice_financial_fields
  before insert or update on public.practices
  for each row execute function public.guard_practice_financial_fields();

-- The client who uploads a lot owns it, but its settlement and commission terms are
-- the administrators'.
create or replace function public.guard_vies_batch_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_admin_or_service() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.paid_at := null;
    new.commissions_received_at := null;
    new.commission_percentage := null;
    new.withholding_percentage := null;
    return new;
  end if;

  if new.paid_at is distinct from old.paid_at
     or new.commissions_received_at is distinct from old.commissions_received_at
     or new.commission_percentage is distinct from old.commission_percentage
     or new.withholding_percentage is distinct from old.withholding_percentage
     or new.lot_number is distinct from old.lot_number
     or new.fiscal_representative_id is distinct from old.fiscal_representative_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Solo gli amministratori possono saldare un lotto o modificarne provvigioni e numerazione'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger guard_vies_batch_settlement
  before insert or update on public.vies_batches
  for each row execute function public.guard_vies_batch_settlement();

-- ---------------------------------------------------------------------------
-- 6. VIES lots numbered per fiscal representative across every uploader
-- ---------------------------------------------------------------------------

-- The registry keeps one row per uploader and tax code, so the lot number is taken
-- over every row with the same tax code: a client and the agency uploading for the
-- same representative continue the same numbering. The advisory lock makes two
-- uploads at the same time get different numbers.
create or replace function public.assign_vies_lot_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tax_code text;
  v_next integer;
begin
  if new.fiscal_representative_id is null then
    return new;
  end if;
  select r.tax_code into v_tax_code from public.vies_fiscal_representatives r where r.id = new.fiscal_representative_id;
  if v_tax_code is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('vies-lot:' || v_tax_code));
  select coalesce(max(b.lot_number), 0) + 1 into v_next
  from public.vies_batches b
  join public.vies_fiscal_representatives r on r.id = b.fiscal_representative_id
  where r.tax_code = v_tax_code;

  new.lot_number := v_next;
  new.name := regexp_replace(new.name, '^Excel Lotto [0-9]+', 'Excel Lotto ' || v_next);
  return new;
end;
$function$;

create trigger assign_vies_lot_number
  before insert on public.vies_batches
  for each row execute function public.assign_vies_lot_number();

revoke execute on function
  public.assign_vies_lot_number(),
  public.guard_user_role_changes(),
  public.guard_practice_financial_fields(),
  public.guard_vies_batch_settlement()
from public, anon, authenticated;
