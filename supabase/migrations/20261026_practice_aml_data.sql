-- Dati per l'adeguata verifica antiriciclaggio letti dai documenti dello ZIP della pratica.
--
-- Licenza commerciale, documento del legale rappresentante e dichiarazione UBO (titolari effettivi) sono
-- documenti cinesi: un agente li legge e il risultato resta qui, in `data` (forma giuridica, data di
-- costituzione, legale rappresentante con documento, titolari effettivi con quote). I documenti da firmare
-- (questionario antiriciclaggio) si compilano con questi dati: sono una bozza da verificare, la firma e la
-- dichiarazione restano di chi firma. `sources` elenca i file letti e le segnalazioni dell'agente.

create table if not exists public.practice_aml_data (
  practice_id uuid primary key references public.practices(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  extracted_at timestamptz not null default now(),
  extracted_by uuid references auth.users(id) on delete set null
);

alter table public.practice_aml_data enable row level security;

-- Vede i dati chi vede la pratica.
create policy "Users see the AML data of the practices they can see" on public.practice_aml_data
  for select to authenticated
  using (exists (select 1 from public.practices p where p.id = practice_aml_data.practice_id));

-- Scrive chi possiede la pratica (il rappresentante fiscale che la gestisce) e gli amministratori.
create policy "Owners and admins write the AML data of their practices" on public.practice_aml_data
  for insert to authenticated
  with check (exists (
    select 1 from public.practices p
    where p.id = practice_aml_data.practice_id
      and (p.user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role))
  ));

create policy "Owners and admins update the AML data of their practices" on public.practice_aml_data
  for update to authenticated
  using (exists (
    select 1 from public.practices p
    where p.id = practice_aml_data.practice_id
      and (p.user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role))
  ))
  with check (exists (
    select 1 from public.practices p
    where p.id = practice_aml_data.practice_id
      and (p.user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role))
  ));

create policy mfa_required on public.practice_aml_data
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

comment on table public.practice_aml_data is
  'Dati antiriciclaggio letti dai documenti dello ZIP (licenza, documento del legale rappresentante, UBO): bozza da verificare per il questionario da firmare.';
