-- Offboarding sicuro: eliminare un utente non deve portarsi via le sue pratiche.
--
-- practices.user_id e clients.user_id sono ON DELETE CASCADE verso auth.users: cancellare un utente
-- cancellava a cascata pratiche, documenti, clienti e storico (che per un intermediario si conservano
-- dieci anni). Il profilo dell'utente (profiles) cade a cascata con l'account: un trigger prima della
-- cancellazione del profilo la ferma finche' l'utente ha ancora pratiche o clienti. Il portale li riassegna
-- a un altro utente (azione reassign_user_data) e poi disattiva o elimina l'account.

create or replace function public.prevent_profile_delete_with_data()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if exists (select 1 from public.practices where user_id = old.id)
     or exists (select 1 from public.clients where user_id = old.id) then
    raise exception 'user_has_data: l''utente ha ancora pratiche o clienti; vanno riassegnati prima di eliminarlo'
      using errcode = 'P0001';
  end if;
  return old;
end;
$function$;

create or replace trigger prevent_profile_delete_with_data before delete on public.profiles
  for each row execute function public.prevent_profile_delete_with_data();
