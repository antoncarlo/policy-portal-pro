-- Le e-mail di comunicazione di ogni utente (massimo 3): gli avvisi del portale arrivano li' (l'e-mail di accesso
-- se non ne indica nessuna). Le sceglie l'amministratore da Gestione utenti e ora anche l'utente, dalle proprie
-- Impostazioni: l'utente cambia solo gli indirizzi, mai gli interruttori degli eventi, che restano dell'amministratore.

-- L'utente legge la propria riga (prima la leggevano solo gli amministratori).
drop policy if exists "Users read their own notification settings" on public.user_notification_settings;
create policy "Users read their own notification settings" on public.user_notification_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.set_my_notification_emails(p_emails text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_clean text[];
begin
  if v_user is null then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;
  if not public.mfa_satisfied() then
    raise exception 'Verifica a due fattori richiesta' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct lower(btrim(e))), '{}')
    into v_clean
    from unnest(coalesce(p_emails, '{}')) as e
   where btrim(e) <> '';

  if cardinality(v_clean) > 3 then
    raise exception 'Al massimo 3 indirizzi' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_clean) as e where e !~ '^[^[:space:]@,;]+@[^[:space:]@,;]+\.[^[:space:]@,;]+$' or length(e) > 254) then
    raise exception 'Indirizzo e-mail non valido' using errcode = '22023';
  end if;

  insert into public.user_notification_settings (user_id, notification_emails, updated_by)
  values (v_user, v_clean, v_user)
  on conflict (user_id) do update
    set notification_emails = excluded.notification_emails,
        updated_by = excluded.updated_by;

  return v_clean;
end;
$function$;

revoke all on function public.set_my_notification_emails(text[]) from public, anon;
grant execute on function public.set_my_notification_emails(text[]) to authenticated;

comment on function public.set_my_notification_emails(text[]) is
  'L''utente imposta le proprie e-mail di comunicazione (massimo 3); non cambia gli interruttori degli eventi.';
