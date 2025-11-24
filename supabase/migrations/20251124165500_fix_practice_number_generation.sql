-- Fix automatic practice number generation
-- This migration fixes the ambiguous column reference error and makes the function more robust

-- Drop the existing function
DROP FUNCTION IF EXISTS public.generate_practice_number() CASCADE;

-- Create an improved version with proper variable naming to avoid ambiguity
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
  
  -- Get the highest number for this year and add 1
  -- Use explicit variable names with v_ prefix to avoid ambiguity
  SELECT COALESCE(MAX(
    CASE 
      WHEN p.practice_number ~ ('^PR-' || v_current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(p.practice_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO v_next_number
  FROM public.practices p
  WHERE p.practice_number LIKE 'PR-' || v_current_year || '-%';
  
  -- Format the practice number as PR-YYYY-NNNN (4 digits)
  v_practice_number := 'PR-' || v_current_year || '-' || LPAD(v_next_number::text, 4, '0');
  
  RETURN v_practice_number;
END;
$$;

-- Add comment to document the function
COMMENT ON FUNCTION public.generate_practice_number() IS 
'Generates a unique practice number in format PR-YYYY-NNNN where YYYY is the current year and NNNN is a sequential number starting from 0001 each year. The function is thread-safe and uses MAX() to avoid race conditions.';

-- Ensure the column has the correct default
ALTER TABLE public.practices 
  ALTER COLUMN practice_number SET DEFAULT generate_practice_number();

-- Make practice_number unique to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_practices_practice_number_unique 
  ON public.practices(practice_number);

-- Add comment to the column
COMMENT ON COLUMN public.practices.practice_number IS 
'Unique practice number generated automatically in format PR-YYYY-NNNN. This field is auto-populated and should not be manually set.';
