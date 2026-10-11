-- Notifiche email: a ogni fatto che riguarda una pratica (caricata, cambio di stato o di incasso,
-- documenti aggiunti, note cambiate) il database mette un evento in coda; il server li legge, decide
-- a chi scrivere e invia email personalizzate (api/_lib/notification-dispatch.ts).
--
--   notification_events          coda degli eventi: la scrive solo il database (trigger), la legge solo il server
--   user_notification_settings   scelte dell'amministratore per ogni utente: a quali indirizzi scrivere e
--                                per quali eventi. Senza riga valgono i valori di partenza: email di accesso,
--                                tutti gli eventi attivi.
--
-- Tabelle nuove e trigger nuovi: nessuna modifica a tabelle o funzioni esistenti.

-- ---------------------------------------------------------------------------
-- 1. Coda degli eventi
-- ---------------------------------------------------------------------------

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('practice_created', 'status_changed', 'documents_added', 'note_changed')),
  practice_id uuid not null references public.practices(id) on delete cascade,
  -- chi ha agito (null: il sistema, per esempio una risposta della compagnia o una chiamata API)
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists notification_events_pending_idx on public.notification_events (created_at) where processed_at is null;
create index if not exists notification_events_practice_idx on public.notification_events (practice_id);

alter table public.notification_events enable row level security;
revoke all on public.notification_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Scelte per utente (le fa l'amministratore)
-- ---------------------------------------------------------------------------

create table if not exists public.user_notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- indirizzi a cui scrivere; vuoto = l'email di accesso
  notification_emails text[] not null default '{}',
  status_change boolean not null default true,
  new_practice boolean not null default true,
  documents boolean not null default true,
  notes boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint user_notification_settings_max_emails check (cardinality(notification_emails) <= 3)
);

alter table public.user_notification_settings enable row level security;

create policy "Administrators manage notification settings" on public.user_notification_settings
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.user_notification_settings
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke all on public.user_notification_settings from anon;

create trigger set_updated_at before update on public.user_notification_settings
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Trigger: mettono gli eventi in coda (qualunque strada porti al cambiamento)
-- ---------------------------------------------------------------------------

create or replace function public.queue_practice_created()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.notification_events (event_type, practice_id, actor_id)
  values ('practice_created', new.id, auth.uid());
  return new;
end;
$function$;

create or replace function public.queue_practice_changed()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if old.status is distinct from new.status or old.financial_status is distinct from new.financial_status then
    insert into public.notification_events (event_type, practice_id, actor_id, payload)
    values ('status_changed', new.id, auth.uid(), jsonb_build_object(
      'old_status', old.status, 'new_status', new.status,
      'old_financial_status', old.financial_status, 'new_financial_status', new.financial_status));
  end if;
  if old.notes is distinct from new.notes then
    insert into public.notification_events (event_type, practice_id, actor_id)
    values ('note_changed', new.id, auth.uid());
  end if;
  return new;
end;
$function$;

create or replace function public.queue_document_added()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_actor uuid := coalesce(auth.uid(), new.uploaded_by);
begin
  -- bozza deliberata e polizza emessa viaggiano con il cambio di stato
  if new.document_type is distinct from 'bozza_deliberata' and new.document_type is distinct from 'polizza_emessa'
     -- i documenti caricati insieme alla pratica fanno parte della sua email "nuova pratica"
     and not exists (
       select 1 from public.notification_events e
       where e.practice_id = new.practice_id
         and e.event_type = 'practice_created'
         and e.created_at > now() - interval '30 minutes'
         and (v_actor is null or e.actor_id is not distinct from v_actor)
     )
  then
    insert into public.notification_events (event_type, practice_id, actor_id, payload)
    values ('documents_added', new.practice_id, v_actor,
            jsonb_build_object('file_name', new.file_name, 'document_type', new.document_type));
  end if;
  return new;
end;
$function$;

create or replace trigger queue_practice_created after insert on public.practices
  for each row execute function public.queue_practice_created();

create or replace trigger queue_practice_changed after update on public.practices
  for each row execute function public.queue_practice_changed();

create or replace trigger queue_document_added after insert on public.practice_documents
  for each row execute function public.queue_document_added();
