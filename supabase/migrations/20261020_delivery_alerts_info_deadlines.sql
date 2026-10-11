-- Due cicli che restavano aperti.
--
--  C4  Consegne verso portali esterni: dopo l'ultimo tentativo lo stato diventa 'failed' e nessuno lo
--      sapeva. `alerted_at` ricorda che gli amministratori sono già stati avvisati di quella consegna.
--  C2  Richiesta di integrazioni: l'amministratore chiede dei documenti ma non c'era termine, promemoria
--      né sollecito. practice_workflow ricorda quando sono state chieste, entro quando vanno fornite e
--      quali avvisi sono già partiti; la coda delle notifiche conosce due nuovi eventi.

alter table public.outbound_deliveries add column if not exists alerted_at timestamptz;
create index if not exists outbound_deliveries_unalerted_idx on public.outbound_deliveries (created_at)
  where status = 'failed' and alerted_at is null;

alter table public.practice_workflow add column if not exists info_requested_at timestamptz;
alter table public.practice_workflow add column if not exists info_due_date date;
alter table public.practice_workflow add column if not exists info_reminded_at timestamptz;
alter table public.practice_workflow add column if not exists info_overdue_notified_at timestamptz;

create index if not exists practice_workflow_info_due_idx on public.practice_workflow (info_due_date)
  where info_due_date is not null;

alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in ('practice_created', 'status_changed', 'documents_added', 'note_changed', 'info_reminder', 'info_overdue'));
