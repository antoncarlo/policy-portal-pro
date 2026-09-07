-- Lo stato della pratica puo' essere modificato solo dagli amministratori.
-- Gli agenti (es. partner con accesso al portale) e i collaboratori possono
-- aggiornare i propri dati ma non lo stato di lavorazione, che resta in capo
-- all'ufficio assunzione. Le API server-side (service_role) restano esenti.

CREATE OR REPLACE FUNCTION public.prevent_unprivileged_practice_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     AND NOT public.has_role((SELECT auth.uid()), 'admin') THEN
    RAISE EXCEPTION 'Solo gli amministratori possono modificare lo stato della pratica';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unprivileged_practice_status_change ON public.practices;

CREATE TRIGGER prevent_unprivileged_practice_status_change
BEFORE UPDATE OF status ON public.practices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unprivileged_practice_status_change();
