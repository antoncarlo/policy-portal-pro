-- Etichetta italiana dello stato "integrazioni" nel registro delle modifiche e nelle notifiche.
-- Identica alla funzione esistente, con una riga in piu' nelle due CASE.

create or replace function public.log_practice_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_status_label text;
  v_new_status_label text;
  v_user_id uuid;
begin
  if old.status is distinct from new.status then
    v_old_status_label := case old.status::text
      when 'in_lavorazione' then 'In Lavorazione'
      when 'in_attesa' then 'In Attesa'
      when 'integrazioni' then 'Integrazioni richieste'
      when 'approvata' then 'Approvata'
      when 'completata' then 'Completata'
      when 'rifiutata' then 'Rifiutata'
      else old.status::text
    end;
    v_new_status_label := case new.status::text
      when 'in_lavorazione' then 'In Lavorazione'
      when 'in_attesa' then 'In Attesa'
      when 'integrazioni' then 'Integrazioni richieste'
      when 'approvata' then 'Approvata'
      when 'completata' then 'Completata'
      when 'rifiutata' then 'Rifiutata'
      else new.status::text
    end;
    v_user_id := coalesce(auth.uid(), new.user_id);

    insert into public.practice_events (practice_id, event_type, description, created_by)
    values (new.id, 'status_change', 'Stato cambiato da ' || v_old_status_label || ' a ' || v_new_status_label, v_user_id);

    insert into public.notifications (user_id, practice_id, type, title, message)
    values (new.user_id, new.id, 'status_change', 'Cambio Stato Pratica',
            'Lo stato della pratica ' || new.practice_number || ' è stato cambiato da ' || v_old_status_label || ' a ' || v_new_status_label);
  end if;
  return new;
end;
$function$;
