-- Rinnovi: dalla scadenza alla nuova pratica collegata.
--
--   practices.renewal_of      la pratica da cui nasce questa (il rinnovo); una pratica ha al più un rinnovo
--   get_pending_email_notifications  non scrive più al cliente di una polizza già rinnovata
--   get_renewal_stats         quante polizze scadute sono state rinnovate (le sole pratiche visibili a chi chiede)

alter table public.practices add column if not exists renewal_of uuid references public.practices(id) on delete set null;
create unique index if not exists practices_renewal_of_key on public.practices (renewal_of) where renewal_of is not null;

create or replace function public.get_pending_email_notifications()
returns table (
  notification_id uuid, practice_id uuid, practice_number text, practice_type text, policy_end_date date,
  days_until_expiry integer, notification_type text, notification_date date, client_name text, client_email text,
  agent_name text, agent_email text, agent_phone text
)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_service_role() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  return query
  select distinct on (p.id)
         en.id,
         p.id,
         p.practice_number,
         p.practice_type::text,
         p.policy_end_date,
         (p.policy_end_date - current_date)::integer,
         en.notification_type,
         en.notification_date,
         p.client_name,
         btrim(p.client_email),
         prof.full_name,
         prof.email,
         prof.phone
  from public.expiry_notifications en
  join public.practices p on p.id = en.practice_id
  left join public.profiles prof on prof.id = p.user_id
  where en.email_sent is not true
    and not exists (
      select 1 from public.expiry_notifications newer
      where newer.practice_id = en.practice_id
        and newer.email_sent
        and newer.notification_date >= en.notification_date
    )
    -- A policy already renewed needs no reminder.
    and not exists (select 1 from public.practices renewal where renewal.renewal_of = p.id)
    and en.notification_date <= current_date
    and en.notification_date > current_date - 7
    and p.policy_end_date >= current_date
    and p.status in ('in_lavorazione', 'approvata', 'completata')
    and p.practice_type <> 'vies'
    and btrim(coalesce(p.client_email, '')) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  order by p.id, en.notification_date desc;
end;
$function$;

revoke all on function public.get_pending_email_notifications() from public, anon, authenticated;
grant execute on function public.get_pending_email_notifications() to service_role;

-- Invoker rights: row level security decides which practices are counted.
create or replace function public.get_renewal_stats(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path to 'public' as $function$
  select jsonb_build_object(
    'expired', count(*) filter (where p.policy_end_date < current_date),
    'expired_renewed', count(*) filter (where p.policy_end_date < current_date and r.id is not null),
    'upcoming', count(*) filter (where p.policy_end_date >= current_date),
    'upcoming_renewed', count(*) filter (where p.policy_end_date >= current_date and r.id is not null)
  )
  from public.practices p
  left join lateral (select c.id from public.practices c where c.renewal_of = p.id limit 1) r on true
  where p.policy_end_date between p_from and p_to
    and p.status in ('completata', 'approvata')
    and p.practice_type <> 'vies';
$function$;

revoke all on function public.get_renewal_stats(date, date) from public, anon;
grant execute on function public.get_renewal_stats(date, date) to authenticated, service_role;
