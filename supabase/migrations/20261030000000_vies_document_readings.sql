-- Registro delle verifiche dei documenti VIES: per ogni documento degli ZIP di un lotto, come il portale lo ha
-- riconosciuto (dal testo o dall'agent documentale), con quale modello, cosa ha letto, quali codici ha accettato
-- (cifra di controllo) e cosa ha segnalato. Si scrive alla creazione del lotto, una riga per documento, e non si
-- modifica più: è la traccia dell'adeguata verifica (D.Lgs. 231/2007, conservazione 10 anni).
--
-- Niente chiavi esterne verso lotti e pratiche: la traccia resta anche se il lotto o la pratica vengono eliminati.
-- L'impronta SHA-256 del file dice quale documento è stato letto (il file resta nello ZIP archiviato del lotto).
-- Il risultato dell'agent contiene dati personali del legale rappresentante: lo vedono solo chi ha caricato il
-- lotto e gli amministratori.

create table if not exists public.vies_document_readings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  lot_number integer,
  practice_id uuid,
  practice_number text,
  row_number integer,
  zip_name text,
  zip_file_name text,
  document_path text not null,
  file_name text not null,
  file_size bigint,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  recognised_by text check (recognised_by is null or recognised_by in ('testo', 'agent')),
  document_type text,
  extra_document_types text[] not null default '{}',
  -- Tipi di documento obbligatori per cui il documento conta nella pratica.
  accepted_types text[] not null default '{}',
  -- Codici accettati per il documento (cifra di controllo valida), dal testo e dall'agent.
  codes jsonb not null default '{}'::jsonb,
  -- Ogni lettura dell'agent: scopo, esito, modello, estratto o documento intero, rilettura, risultato, codici.
  agent_readings jsonb not null default '[]'::jsonb,
  issues text[] not null default '{}',
  recorded_by uuid not null default auth.uid(),
  recorded_at timestamptz not null default now()
);

create index if not exists vies_document_readings_batch_idx on public.vies_document_readings (batch_id, row_number);
create index if not exists vies_document_readings_practice_idx on public.vies_document_readings (practice_id);
create index if not exists vies_document_readings_recorded_idx on public.vies_document_readings (recorded_at desc);

alter table public.vies_document_readings enable row level security;

-- Chi ha caricato il lotto e gli amministratori.
create policy "Uploaders and admins read the document readings" on public.vies_document_readings
  for select to authenticated
  using (
    recorded_by = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (select 1 from public.vies_batches b where b.id = vies_document_readings.batch_id and b.user_id = (select auth.uid()))
  );

-- Si scrive solo a proprio nome e per un lotto proprio (o da amministratori).
create policy "Uploaders record the readings of their lots" on public.vies_document_readings
  for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and (
      exists (select 1 from public.vies_batches b where b.id = vies_document_readings.batch_id and b.user_id = (select auth.uid()))
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
    )
  );

create policy mfa_required on public.vies_document_readings
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke all on public.vies_document_readings from anon, authenticated;
grant select, insert on public.vies_document_readings to authenticated;

-- Le righe non si modificano né si cancellano, salvo la pulizia dopo 10 anni.
create or replace function public.vies_document_readings_immutable()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if tg_op = 'DELETE' and current_setting('app.readings_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'Il registro delle verifiche dei documenti non si modifica';
end;
$function$;

create or replace trigger vies_document_readings_immutable before update or delete on public.vies_document_readings
  for each row execute function public.vies_document_readings_immutable();

create or replace function public.purge_old_document_readings()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_deleted integer;
begin
  perform set_config('app.readings_purge', 'on', true);
  delete from public.vies_document_readings where recorded_at < now() - interval '10 years';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_old_document_readings() from public, anon, authenticated;
grant execute on function public.purge_old_document_readings() to service_role;

select cron.schedule('vies-document-readings-retention', '45 2 1 * *', 'select public.purge_old_document_readings()');

comment on table public.vies_document_readings is
  'Verifiche dei documenti VIES, una riga per documento del lotto: riconoscimento, letture dell''agent, codici accettati e segnalazioni. Solo aggiunta, conservazione 10 anni.';

-- Dati antiriciclaggio letti dall'agente: ogni lettura e ogni correzione nel registro di audit, conservato 10 anni
-- come quello delle pratiche.
create or replace trigger audit_practice_aml_data after insert or update or delete on public.practice_aml_data
  for each row execute function public.audit_row_change('extracted_at');

create or replace function public.purge_old_audit_log()
returns integer language plpgsql security definer set search_path to 'public' as $function$
begin
  perform set_config('app.audit_purge', 'on', true);
  return public.retention_delete(
    'public.audit_log',
    $q$(table_name in ('practices', 'clients', 'practice_documents', 'practice_aml_data') and at < now() - interval '10 years')
       or (coalesce(table_name, '') not in ('practices', 'clients', 'practice_documents', 'practice_aml_data') and at < now() - interval '2 years')$q$
  );
end;
$function$;
