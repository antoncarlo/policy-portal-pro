-- Flusso delle pratiche con la compagnia e collegamenti con portali esterni.
--
-- Tre tabelle nuove, tutte additive (nessuna tabella esistente viene modificata):
--   practice_workflow   dati del flusso di una pratica: da dove e' arrivata, a quale portale e'
--                       stata inviata, deliberazione, scadenza di pagamento, rifiuto, emissione.
--   integration_events  registro delle chiamate con i portali esterni (arrivate e partite), con
--                       l'identificativo dell'evento per non elaborare due volte lo stesso.
--   vies_intake_lots    lotti VIES ricevuti da un portale esterno tramite API, in attesa che un
--                       amministratore li carichi nel flusso (Excel + ZIP, come il caricamento a mano).
--
-- Le sezioni (da lavorare, in valutazione, deliberate, pagate, emesse, non deliberate) non hanno una
-- colonna: derivano da stato e stato di incasso della pratica (src/lib/practiceStages.ts).
--
-- Chi scrive e' il server (service role): per gli utenti del portale le tabelle sono in sola lettura,
-- tranne l'aggiornamento dei lotti ricevuti da parte degli amministratori.

-- ---------------------------------------------------------------------------
-- 1. Flusso di una pratica
-- ---------------------------------------------------------------------------

create table if not exists public.practice_workflow (
  practice_id uuid primary key references public.practices(id) on delete cascade,
  source_portal text,
  source_reference text,
  target_portal text,
  target_reference text,
  sent_at timestamptz,
  deliberated_at timestamptz,
  deliberation_note text,
  payment_due_date date,
  rejected_at timestamptz,
  rejection_reason text,
  issued_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists practice_workflow_target_reference_idx
  on public.practice_workflow (target_portal, target_reference)
  where target_reference is not null;

alter table public.practice_workflow enable row level security;

create policy "Users see the workflow of the practices they can see" on public.practice_workflow
  for select to authenticated
  using (exists (select 1 from public.practices p where p.id = practice_workflow.practice_id));

create policy mfa_required on public.practice_workflow
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

create trigger set_updated_at before update on public.practice_workflow
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Registro delle chiamate con i portali esterni
-- ---------------------------------------------------------------------------

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  portal_id text not null,
  event_type text not null,
  external_event_id text,
  practice_id uuid references public.practices(id) on delete set null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Lo stesso evento in arrivo dallo stesso portale si elabora una volta sola.
create unique index if not exists integration_events_inbound_event_key
  on public.integration_events (portal_id, external_event_id)
  where direction = 'inbound' and external_event_id is not null;
create index if not exists integration_events_created_idx on public.integration_events (created_at desc);
create index if not exists integration_events_practice_idx on public.integration_events (practice_id);

alter table public.integration_events enable row level security;

create policy "Administrators read the integration log" on public.integration_events
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.integration_events
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- ---------------------------------------------------------------------------
-- 3. Lotti VIES ricevuti via API
-- ---------------------------------------------------------------------------

create table if not exists public.vies_intake_lots (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid,
  source_portal text not null,
  source_reference text not null,
  owner_user_id uuid not null,
  fiscal_representative_name text,
  fiscal_representative_tax_code text,
  expected_rows integer,
  notes text,
  status text not null default 'uploading'
    check (status in ('uploading', 'received', 'processing', 'processed', 'rejected')),
  -- [{ kind: 'excel' | 'zip' | 'visura', file_name, storage_path, size, uploaded }]
  files jsonb not null default '[]'::jsonb,
  batch_id uuid references public.vies_batches(id) on delete set null,
  rejected_reason text,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint vies_intake_lots_source_key unique (source_portal, source_reference)
);

create index if not exists vies_intake_lots_status_idx on public.vies_intake_lots (status, created_at desc);
create index if not exists vies_intake_lots_owner_idx on public.vies_intake_lots (owner_user_id);

alter table public.vies_intake_lots enable row level security;

create policy "Owners and administrators read received lots" on public.vies_intake_lots
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administrators update received lots" on public.vies_intake_lots
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.vies_intake_lots
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

create trigger set_updated_at before update on public.vies_intake_lots
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Privilegi: nessun accesso anonimo, scrittura solo dal server
-- ---------------------------------------------------------------------------

revoke all on public.practice_workflow, public.integration_events, public.vies_intake_lots from anon;
revoke insert, update, delete, truncate on public.practice_workflow from authenticated;
revoke insert, update, delete, truncate on public.integration_events from authenticated;
revoke insert, delete, truncate on public.vies_intake_lots from authenticated;
