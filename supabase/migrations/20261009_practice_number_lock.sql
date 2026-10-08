-- Practice numbers (PR-YYYY-NNNN) are "highest number + 1". Two uploads at the same
-- moment (several clients loading VIES lots) could read the same highest number and
-- one of them would fail on the unique index. The advisory lock makes practices be
-- numbered one transaction at a time; it is released when the inserting transaction ends.
create or replace function public.generate_practice_number()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_current_year text;
  v_next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('practice-number'));

  v_current_year := to_char(now(), 'YYYY');
  select coalesce(max(
           case when p.practice_number ~ ('^PR-' || v_current_year || '-[0-9]+$')
                then cast(substring(p.practice_number from '[0-9]+$') as integer)
                else 0 end
         ), 0) + 1
    into v_next_number
  from public.practices p
  where p.practice_number like 'PR-' || v_current_year || '-%';

  return 'PR-' || v_current_year || '-' || lpad(v_next_number::text, 4, '0');
end;
$function$;
