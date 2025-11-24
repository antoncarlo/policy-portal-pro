-- Fix practice status change trigger
-- This migration fixes the enum type casting error in the log_practice_status_change trigger

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_practice_status_change ON public.practices;
DROP FUNCTION IF EXISTS public.log_practice_status_change();

-- Recreate the function with explicit TEXT casting and COALESCE for auth.uid()
CREATE OR REPLACE FUNCTION public.log_practice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status_label TEXT;
  v_new_status_label TEXT;
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map status to Italian labels with explicit TEXT casting
    v_old_status_label := CASE OLD.status::text
      WHEN 'in_lavorazione' THEN 'In Lavorazione'
      WHEN 'in_attesa' THEN 'In Attesa'
      WHEN 'approvata' THEN 'Approvata'
      WHEN 'completata' THEN 'Completata'
      WHEN 'rifiutata' THEN 'Rifiutata'
      ELSE OLD.status::text
    END;
    
    v_new_status_label := CASE NEW.status::text
      WHEN 'in_lavorazione' THEN 'In Lavorazione'
      WHEN 'in_attesa' THEN 'In Attesa'
      WHEN 'approvata' THEN 'Approvata'
      WHEN 'completata' THEN 'Completata'
      WHEN 'rifiutata' THEN 'Rifiutata'
      ELSE NEW.status::text
    END;

    -- Use COALESCE to handle cases where auth.uid() is null (e.g., system updates)
    v_user_id := COALESCE(auth.uid(), NEW.user_id);

    -- Insert event log
    INSERT INTO public.practice_events (practice_id, event_type, description, created_by)
    VALUES (
      NEW.id,
      'status_change',
      'Stato cambiato da ' || v_old_status_label || ' a ' || v_new_status_label,
      v_user_id
    );

    -- Create notification for practice owner
    INSERT INTO public.notifications (user_id, practice_id, type, title, message)
    VALUES (
      NEW.user_id,
      NEW.id,
      'status_change',
      'Cambio Stato Pratica',
      'Lo stato della pratica ' || NEW.practice_number || ' è stato cambiato da ' || v_old_status_label || ' a ' || v_new_status_label
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_practice_status_change
  AFTER UPDATE ON public.practices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_practice_status_change();

-- Add comment
COMMENT ON FUNCTION public.log_practice_status_change() IS 
'Logs practice status changes to practice_events and creates notifications. Uses explicit TEXT casting to avoid enum type conflicts and COALESCE to handle null auth.uid().';
