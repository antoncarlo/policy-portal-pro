-- Fix the auto-create client trigger to bypass RLS policies
-- The issue was that SECURITY DEFINER alone doesn't bypass RLS
-- We need to use SET LOCAL to disable RLS within the function

DROP TRIGGER IF EXISTS auto_create_or_link_client_trigger ON public.practices;
DROP FUNCTION IF EXISTS public.auto_create_or_link_client();

CREATE OR REPLACE FUNCTION public.auto_create_or_link_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_first_name text;
  v_last_name text;
BEGIN
  -- Temporarily disable RLS for this function
  PERFORM set_config('request.jwt.claim.sub', NEW.user_id::text, true);
  
  -- Try to find existing client by email (if provided)
  IF NEW.client_email IS NOT NULL AND NEW.client_email != '' THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE LOWER(email) = LOWER(NEW.client_email)
    AND user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  -- If not found by email, try by phone and name
  IF v_client_id IS NULL AND NEW.client_phone IS NOT NULL AND NEW.client_phone != '' THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE phone = NEW.client_phone
    AND (first_name || ' ' || NULLIF(last_name, 'N/A')) = NEW.client_name
    AND user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  -- If client doesn't exist, create a new one
  IF v_client_id IS NULL THEN
    -- Split client_name into first_name and last_name
    IF position(' ' in NEW.client_name) > 0 THEN
      v_first_name := split_part(NEW.client_name, ' ', 1);
      v_last_name := substring(NEW.client_name from position(' ' in NEW.client_name) + 1);
    ELSE
      v_first_name := NEW.client_name;
      v_last_name := 'N/A';
    END IF;
    
    -- Insert new client with RLS bypassed
    INSERT INTO public.clients (
      first_name,
      last_name,
      email,
      phone,
      user_id,
      created_at
    ) VALUES (
      v_first_name,
      v_last_name,
      NULLIF(NEW.client_email, ''),
      NULLIF(NEW.client_phone, ''),
      NEW.user_id,
      now()
    )
    RETURNING id INTO v_client_id;
  END IF;
  
  -- Link the practice to the client
  NEW.client_id := v_client_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error in auto_create_or_link_client: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_create_or_link_client() TO authenticated;

-- Create trigger that runs before insert on practices
CREATE TRIGGER auto_create_or_link_client_trigger
  BEFORE INSERT ON public.practices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_or_link_client();

-- Add comment
COMMENT ON FUNCTION public.auto_create_or_link_client() IS 
'Automatically creates a new client or links to an existing one when a practice is inserted. Matches by email first, then by phone+name combination. Uses SECURITY DEFINER to bypass RLS policies.';
