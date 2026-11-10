-- Dati della società di chi carica le pratiche (es. il collaboratore Italy4VAT S.r.l.) e protezione dei dati del
-- profilo che contano economicamente.
--
-- 1. L'estratto conto del lotto e' intestato a chi ha caricato il lotto (il collaboratore che incassa e paga), non al
--    rappresentante fiscale delle pratiche: servono ragione sociale, codice fiscale o partita IVA e sede.
-- 2. Fino a oggi ogni utente poteva cambiare la propria provvigione (default_commission_percentage) e gli scaglioni
--    bonus dal proprio profilo, e il calcolo automatico delle provvigioni sulle pratiche li usa. Al 10/11/2026 il
--    registro di audit non mostra nessuna modifica di questo tipo. Ora provvigioni e dati della societa' li cambia
--    solo un amministratore (o il server).
-- 3. L'amministratore non poteva aggiornare il profilo degli altri (nessuna policy): la finestra delle provvigioni in
--    Gestione utenti non salvava nulla, senza errore. Ora gli amministratori aggiornano qualunque profilo.

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists company_tax_code text,
  add column if not exists company_address text;

comment on column public.profiles.company_name is 'Ragione sociale della societa'' dell''utente (intestatario dell''estratto conto dei suoi lotti)';
comment on column public.profiles.company_tax_code is 'Codice fiscale o partita IVA della societa'' dell''utente';
comment on column public.profiles.company_address is 'Sede della societa'' dell''utente';

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_service() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Un profilo nuovo (registrazione, invito) parte senza provvigioni ne' dati della societa': li imposta l'amministratore.
    new.default_commission_percentage := 0;
    new.commission_bonus_tiers := '[]'::jsonb;
    new.company_name := null;
    new.company_tax_code := null;
    new.company_address := null;
    return new;
  end if;
  if new.default_commission_percentage is distinct from old.default_commission_percentage
     or new.commission_bonus_tiers is distinct from old.commission_bonus_tiers
     or new.company_name is distinct from old.company_name
     or new.company_tax_code is distinct from old.company_tax_code
     or new.company_address is distinct from old.company_address then
    raise exception 'Solo gli amministratori possono modificare provvigioni e dati della societa'' del profilo'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_admin_fields on public.profiles;
create trigger guard_profile_admin_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_admin_fields();

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
