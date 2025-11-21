-- Create a function to generate the next practice number
CREATE OR REPLACE FUNCTION public.generate_practice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_year text;
  next_number integer;
  practice_number text;
BEGIN
  -- Get current year
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the count of practices for this year and add 1
  SELECT COUNT(*) + 1 INTO next_number
  FROM public.practices
  WHERE practice_number LIKE 'PR-' || current_year || '-%';
  
  -- Format the practice number as PR-YYYY-NNN
  practice_number := 'PR-' || current_year || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN practice_number;
END;
$$;

-- Alter the practices table to use the function as default
ALTER TABLE public.practices 
ALTER COLUMN practice_number SET DEFAULT generate_practice_number();