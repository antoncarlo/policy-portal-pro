-- Expiry reminder emails. The daily cron (api/cron-send-emails.ts) reads the reminders
-- that are due, sends them with Resend and records the outcome. The three functions it
-- calls did not exist, so no reminder email ever went out.
--
-- Rules for a reminder to be sent:
--   * its date has come, but by no more than 7 days: a reminder the cron missed for
--     weeks is not sent late with an out-of-date message;
--   * the policy has not expired yet and the practice is active
--     (in_lavorazione, approvata, completata: the same practices the Scadenze page lists);
--   * the client has an email address;
--   * VIES practices are left out: their renewals go through the fiscal representative
--     who uploaded the lot, not to the representative's clients directly;
--   * one email per practice per day: when two reminders are due together, only the
--     closest to the expiry date is sent, and an older reminder is never sent after a
--     newer one has gone out.
-- Only the service role (the cron) can call these functions.

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practices(id) on delete set null,
  notification_id uuid references public.expiry_notifications(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  subject text,
  template_used text,
  notification_type text,
  resend_email_id text,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_practice_id_idx on public.email_logs (practice_id);
create index if not exists email_logs_created_at_idx on public.email_logs (created_at desc);

-- Row level security with a single read policy: only administrators read the log,
-- nobody writes it from the browser (the cron writes through log_email_sent).
alter table public.email_logs enable row level security;

create policy "Admins can view email logs"
  on public.email_logs for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

create or replace function public.get_pending_email_notifications()
returns table (
  notification_id uuid,
  practice_id uuid,
  practice_number text,
  practice_type text,
  policy_end_date date,
  days_until_expiry integer,
  notification_type text,
  notification_date date,
  client_name text,
  client_email text,
  agent_name text,
  agent_email text,
  agent_phone text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
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
    and en.notification_date <= current_date
    and en.notification_date > current_date - 7
    and p.policy_end_date >= current_date
    and p.status in ('in_lavorazione', 'approvata', 'completata')
    and p.practice_type <> 'vies'
    and btrim(coalesce(p.client_email, '')) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  order by p.id, en.notification_date desc;
end;
$function$;

create or replace function public.mark_email_notification_sent(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  update public.expiry_notifications
     set sent = true,
         sent_at = now(),
         email_sent = true,
         email_sent_at = now(),
         updated_at = now()
   where id = p_notification_id;
end;
$function$;

create or replace function public.log_email_sent(
  p_practice_id uuid,
  p_notification_id uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_subject text,
  p_template_used text,
  p_notification_type text,
  p_resend_email_id text,
  p_status text,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
begin
  if not public.is_service_role() then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  insert into public.email_logs (
    practice_id, notification_id, recipient_email, recipient_name, subject,
    template_used, notification_type, resend_email_id, status, error_message
  ) values (
    p_practice_id,
    case when exists (select 1 from public.expiry_notifications en where en.id = p_notification_id)
         then p_notification_id end,
    p_recipient_email, p_recipient_name, p_subject,
    p_template_used, p_notification_type, p_resend_email_id,
    case when p_status = 'sent' then 'sent' else 'failed' end,
    left(p_error_message, 2000)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.get_pending_email_notifications() from public, anon, authenticated;
revoke execute on function public.mark_email_notification_sent(uuid) from public, anon, authenticated;
revoke execute on function public.log_email_sent(uuid, uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_pending_email_notifications() to service_role;
grant execute on function public.mark_email_notification_sent(uuid) to service_role;
grant execute on function public.log_email_sent(uuid, uuid, text, text, text, text, text, text, text, text) to service_role;
