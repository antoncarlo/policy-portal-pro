-- Richieste di contatto dal sito pubblico VIES (modulo della homepage di portale.tecnomga.com).
--
-- Le scrive solo il server (service role) dalla rotta /api/contact, dopo validazione, campo trappola e limite di
-- frequenza. Le leggono e le segnano come gestite solo gli amministratori. Non si salva l'indirizzo IP di chi
-- scrive. Le richieste si cancellano da sole dopo 24 mesi.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  company text not null check (char_length(company) between 1 and 120),
  role text not null check (role in ('fiscal_representative', 'professional_firm', 'broker', 'foreign_company', 'other')),
  country text not null check (char_length(country) between 1 and 80),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  volume text check (volume is null or char_length(volume) <= 40),
  message text not null check (char_length(message) between 10 and 4000),
  -- Lingua della pagina da cui e' partita la richiesta, e percorso della pagina.
  lang text not null default 'it' check (lang in ('it', 'en', 'zh')),
  page text check (page is null or char_length(page) <= 200),
  -- L'email verso la casella VIES e' partita? Se no, perche'.
  email_sent boolean not null default false,
  email_error text,
  status text not null default 'new' check (status in ('new', 'handled')),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index if not exists contact_requests_created_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_status_idx on public.contact_requests (status, created_at desc);

alter table public.contact_requests enable row level security;

-- Solo gli amministratori leggono le richieste.
create policy "Admins read the contact requests" on public.contact_requests
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Solo gli amministratori le segnano come gestite (o da gestire): vedi i permessi di colonna sotto.
create policy "Admins mark the contact requests" on public.contact_requests
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.contact_requests
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Nessuna policy di inserimento o cancellazione: dal browser non si scrive e non si cancella.
revoke all on public.contact_requests from anon, authenticated;
grant select on public.contact_requests to authenticated;
-- Di una richiesta si puo' cambiare solo lo stato: il testo scritto da chi ha chiesto il contatto resta com'e'.
grant update (status, handled_at, handled_by) on public.contact_requests to authenticated;

create or replace function public.purge_old_contact_requests()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_deleted integer;
begin
  delete from public.contact_requests where created_at < now() - interval '24 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_old_contact_requests() from public, anon, authenticated;
grant execute on function public.purge_old_contact_requests() to service_role;

select cron.schedule('contact-requests-retention', '15 3 1 * *', 'select public.purge_old_contact_requests()');
