-- Ciclo del lotto VIES: dalla bozza della compagnia alle polizze emesse, con ogni passaggio tracciato.
--
--   vies_lot_flow       dove e' il lotto: chi e quando ha fatto ogni passaggio (bozze caricate e verificate,
--                       pagamento dell'estratto conto inviato e confermato, copie per la compagnia caricate,
--                       firme inviate alla compagnia, polizze emesse caricate, lotto chiuso).
--   vies_lot_events     il registro dei passaggi del lotto (chi, quando, cosa e con quali numeri): non si modifica.
--   vies_lot_documents  i documenti del lotto che non appartengono a una pratica: estratto conto firmato e bonifico.
--
-- Chi scrive e' il server (service role), che controlla ruolo e stato del lotto a ogni passaggio e lascia la riga
-- nel registro di audit. Gli utenti del portale leggono soltanto, e solo i lotti di cui vedono almeno una pratica.

create table if not exists public.vies_lot_flow (
  batch_id uuid primary key references public.vies_batches(id) on delete cascade,
  drafts_uploaded_at timestamptz,
  drafts_uploaded_by uuid references auth.users(id) on delete set null,
  drafts_confirmed_at timestamptz,
  drafts_confirmed_by uuid references auth.users(id) on delete set null,
  payment_submitted_at timestamptz,
  payment_submitted_by uuid references auth.users(id) on delete set null,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references auth.users(id) on delete set null,
  copies_uploaded_at timestamptz,
  copies_uploaded_by uuid references auth.users(id) on delete set null,
  sent_to_company_at timestamptz,
  sent_to_company_by uuid references auth.users(id) on delete set null,
  issued_uploaded_at timestamptz,
  issued_uploaded_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.vies_lot_events (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.vies_batches(id) on delete cascade,
  event_type text not null,
  description text not null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vies_lot_events_batch_idx on public.vies_lot_events (batch_id, created_at desc);

create table if not exists public.vies_lot_documents (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.vies_batches(id) on delete cascade,
  kind text not null check (kind in ('estratto_conto_firmato', 'bonifico', 'altro')),
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vies_lot_documents_batch_idx on public.vies_lot_documents (batch_id, created_at desc);

alter table public.vies_lot_flow enable row level security;
alter table public.vies_lot_events enable row level security;
alter table public.vies_lot_documents enable row level security;

create policy "Users see the flow of the lots they can see" on public.vies_lot_flow
  for select to authenticated
  using (exists (select 1 from public.practices p where p.vies_batch_id = vies_lot_flow.batch_id));
create policy "Users see the events of the lots they can see" on public.vies_lot_events
  for select to authenticated
  using (exists (select 1 from public.practices p where p.vies_batch_id = vies_lot_events.batch_id));
create policy "Users see the documents of the lots they can see" on public.vies_lot_documents
  for select to authenticated
  using (exists (select 1 from public.practices p where p.vies_batch_id = vies_lot_documents.batch_id));

create policy mfa_required on public.vies_lot_flow
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
create policy mfa_required on public.vies_lot_events
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));
create policy mfa_required on public.vies_lot_documents
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

create trigger set_updated_at before update on public.vies_lot_flow
  for each row execute function public.handle_updated_at();

-- Il registro dei passaggi non si modifica ne' si cancella (il lotto che sparisce porta con se' le sue righe).
create or replace function public.vies_lot_events_append_only()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Il registro del lotto non si modifica' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and exists (select 1 from public.vies_batches b where b.id = old.batch_id) then
    raise exception 'Il registro del lotto non si cancella' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger vies_lot_events_append_only
  before update or delete on public.vies_lot_events
  for each row execute function public.vies_lot_events_append_only();

revoke execute on function public.vies_lot_events_append_only() from public, anon, authenticated;

-- Estratto conto firmato e bonifico del lotto: archivio privato, cartella = id del lotto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vies-lot-documents', 'vies-lot-documents', false, 52428800, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lot members can read lot documents" on storage.objects;
create policy "Lot members can read lot documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vies-lot-documents'
    and (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or exists (select 1 from public.practices p where p.vies_batch_id::text = (storage.foldername(name))[1])
    )
  );

drop policy if exists "Lot members can upload lot documents" on storage.objects;
create policy "Lot members can upload lot documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vies-lot-documents'
    and (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or exists (select 1 from public.practices p where p.vies_batch_id::text = (storage.foldername(name))[1] and p.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Admins can delete lot documents" on storage.objects;
create policy "Admins can delete lot documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vies-lot-documents' and public.has_role((select auth.uid()), 'admin'::public.app_role));

comment on table public.vies_lot_flow is 'Passaggi del ciclo di un lotto VIES: chi e quando ha fatto ogni passaggio.';
comment on table public.vies_lot_events is 'Registro dei passaggi del lotto VIES (append-only).';
comment on table public.vies_lot_documents is 'Documenti del lotto che non appartengono a una pratica: estratto conto firmato e bonifico.';
