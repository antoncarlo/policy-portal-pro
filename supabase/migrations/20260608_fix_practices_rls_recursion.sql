-- Fix infinite recursion in practices RLS policy.
-- The previous policy compared NEW.status with a SELECT from public.practices,
-- which forces PostgreSQL to evaluate RLS on the same table while updating it.

DROP POLICY IF EXISTS "Users can update their own practices (no status change)" ON public.practices;
DROP POLICY IF EXISTS "Users can update their own practices" ON public.practices;

CREATE POLICY "Users can update their own practices"
ON public.practices
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

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
     AND NOT (
       public.has_role((SELECT auth.uid()), 'admin')
       OR public.has_role((SELECT auth.uid()), 'agente')
     ) THEN
    RAISE EXCEPTION 'Solo admin e agenti possono modificare lo stato della pratica';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unprivileged_practice_status_change ON public.practices;

CREATE TRIGGER prevent_unprivileged_practice_status_change
BEFORE UPDATE OF status ON public.practices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unprivileged_practice_status_change();
