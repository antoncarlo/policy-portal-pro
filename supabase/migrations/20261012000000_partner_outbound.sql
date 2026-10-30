-- Flusso in uscita: notifiche firmate ai rappresentanti fiscali / portali sorgente (webhook) e
-- consegne verso il portale della compagnia, con registro e ritentativi.
--
--   partner_webhooks      dove e come avvisare il portale di una chiave API (indirizzo https e segreto
--                         con cui firmiamo). Il segreto lo legge solo il server: nessuna policy,
--                         nessun privilegio per anon e authenticated.
--   outbound_deliveries   ogni notifica da consegnare: destinatario, evento, corpo, esito, tentativi.
--                         Gli amministratori la leggono (Impostazioni -> Connessioni); scrive il server.
--
-- Tabelle nuove, nessuna modifica a quelle esistenti.

-- ---------------------------------------------------------------------------
-- 1. Webhook dei portali sorgente
-- ---------------------------------------------------------------------------

create table if not exists public.partner_webhooks (
  api_key_id uuid primary key references public.api_keys(id) on delete cascade,
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_webhooks enable row level security;
revoke all on public.partner_webhooks from anon, authenticated;

create trigger set_updated_at before update on public.partner_webhooks
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Consegne in uscita
-- ---------------------------------------------------------------------------

create table if not exists public.outbound_deliveries (
  id uuid primary key default gen_random_uuid(),
  -- identifica l'evento verso il destinatario (Idempotency-Key e event_id nel corpo)
  event_id uuid not null default gen_random_uuid() unique,
  target_kind text not null check (target_kind in ('source', 'portal')),
  -- 'source': id della chiave API; 'portal': id del portale in VIES_PORTALS
  target_id text not null,
  target_label text,
  practice_id uuid references public.practices(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  -- pending: da consegnare o ritentare; delivered: consegnata; failed: rinunciato (si puo' ritentare a mano)
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  last_http_status integer,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists outbound_deliveries_due_idx
  on public.outbound_deliveries (next_attempt_at) where status = 'pending';
create index if not exists outbound_deliveries_created_idx on public.outbound_deliveries (created_at desc);
create index if not exists outbound_deliveries_practice_idx on public.outbound_deliveries (practice_id);

alter table public.outbound_deliveries enable row level security;

create policy "Administrators read outbound deliveries" on public.outbound_deliveries
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy mfa_required on public.outbound_deliveries
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

revoke all on public.outbound_deliveries from anon;
revoke insert, update, delete, truncate on public.outbound_deliveries from authenticated;
