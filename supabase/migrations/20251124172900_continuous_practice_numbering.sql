-- Modify practice number generation to use continuous numbering across years
-- This migration changes the numbering from yearly reset (PR-2025-0001, PR-2026-0001)
-- to continuous numbering (PR-2025-0001, PR-2026-0002, etc.)

-- Drop the existing function
DROP FUNCTION IF EXISTS public.generate_practice_number();

-- Create the new function with continuous numbering
CREATE OR REPLACE FUNCTION public.generate_practice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_year text;
  v_next_number integer;
  v_practice_number text;
BEGIN
  -- Get current year
  v_current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the maximum number from ALL practices (not just current year)
  -- Extract the last 4 digits from all practice numbers and find the max
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN p.practice_number ~ '^PR-[0-9]{4}-[0-9]{4}$'
        THEN CAST(SUBSTRING(p.practice_number FROM '[0-9]{4}$') AS INTEGER)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO v_next_number
  FROM public.practices p;
  
  -- Generate the practice number with current year and continuous number
  v_practice_number := 'PR-' || v_current_year || '-' || LPAD(v_next_number::text, 4, '0');
  
  RETURN v_practice_number;
END;
$$;

-- Add comment explaining the continuous numbering
COMMENT ON FUNCTION public.generate_practice_number() IS 
'Generates practice numbers with continuous sequential numbering across years. Format: PR-YYYY-NNNN where NNNN continues incrementing regardless of year change. Example: PR-2025-0001, PR-2025-0002, ..., PR-2026-0003, PR-2026-0004';
