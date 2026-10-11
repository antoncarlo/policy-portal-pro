-- Recapito delle email: registro completo e indirizzi non raggiungibili.
--
--   email_logs          ogni email inviata dal portale (promemoria, notifiche, accessi, avvisi agli
--                       amministratori); oltre a 'sent' / 'failed' lo stato segue l'esito di recapito
--                       comunicato dal provider (Resend): delivered, delayed, bounced, complained.
--   email_suppressions  indirizzi per cui il provider ha riferito un rimbalzo definitivo o un reclamo:
--                       non si scrive più a quell'indirizzo finché un amministratore non lo toglie, e
--                       gli amministratori ne sono avvisati (una casella errata = scadenza mai notificata).

alter table public.email_logs drop constraint if exists email_logs_status_check;
alter table public.email_logs
  add constraint email_logs_status_check check (status in ('sent', 'failed', 'delivered', 'delayed', 'bounced', 'complained'));

alter table public.email_logs add column if not exists provider text;
alter table public.email_logs add column if not exists delivery_updated_at timestamptz;
alter table public.email_logs add column if not exists delivery_detail text;

create index if not exists email_logs_provider_id_idx on public.email_logs (resend_email_id) where resend_email_id is not null;
create index if not exists email_logs_recipient_idx on public.email_logs (lower(recipient_email), created_at desc);
create index if not exists email_logs_created_idx on public.email_logs (created_at desc);

create table if not exists public.email_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('bounced', 'complained')),
  detail text,
  source text not null default 'provider',
  hits integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;

create policy "Administrators read suppressed addresses" on public.email_suppressions
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Whoever sees a practice sees whether the client's address is unreachable (the practice's own RLS applies).
create policy "Users see suppression of the clients they can see" on public.email_suppressions
  for select to authenticated
  using (exists (select 1 from public.practices p where lower(p.client_email) = email_suppressions.email));

create policy mfa_required on public.email_suppressions
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke all on public.email_suppressions from anon, authenticated;
grant select on public.email_suppressions to authenticated;

create or replace trigger audit_email_suppressions after insert or update or delete on public.email_suppressions
  for each row execute function public.audit_row_change('updated_at,hits,last_at');
