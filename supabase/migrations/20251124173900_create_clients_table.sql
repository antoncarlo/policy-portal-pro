-- Create clients table for comprehensive client directory
-- This migration creates a dedicated clients table and associates it with practices

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal Information
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  
  -- Company Information (optional)
  company_name text,
  vat_number text, -- Partita IVA
  tax_code text, -- Codice Fiscale
  
  -- Contact Information
  email text,
  phone text,
  mobile text,
  
  -- Address
  address_street text,
  address_city text,
  address_province text,
  address_postal_code text,
  address_country text DEFAULT 'Italia',
  
  -- Additional Information
  notes text,
  
  -- Metadata
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT clients_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
  CONSTRAINT clients_phone_check CHECK (phone ~* '^[0-9+\s()-]+$' OR phone IS NULL),
  CONSTRAINT clients_mobile_check CHECK (mobile ~* '^[0-9+\s()-]+$' OR mobile IS NULL)
);

-- Create indexes for better performance
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;
CREATE INDEX idx_clients_full_name ON public.clients USING gin(to_tsvector('italian', first_name || ' ' || last_name));
CREATE INDEX idx_clients_company_name ON public.clients USING gin(to_tsvector('italian', company_name)) WHERE company_name IS NOT NULL;

-- Add client_id to practices table
ALTER TABLE public.practices 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create index on client_id
CREATE INDEX IF NOT EXISTS idx_practices_client_id ON public.practices(client_id);

-- Enable RLS on clients table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table

-- Admin can see all clients
CREATE POLICY "Admin can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'admin'
    )
  );

-- Agents can see their own clients and their collaborators' clients
CREATE POLICY "Agents can view own and collaborators clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR
    user_id IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.parent_agent_id = (SELECT auth.uid())
    )
  );

-- Users can see their own clients
CREATE POLICY "Users can view own clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admin can insert any client
CREATE POLICY "Admin can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'admin'
    )
  );

-- Users can insert their own clients
CREATE POLICY "Users can insert own clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admin can update any client
CREATE POLICY "Admin can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'admin'
    )
  );

-- Users can update their own clients
CREATE POLICY "Users can update own clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admin can delete any client
CREATE POLICY "Admin can delete clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = 'admin'
    )
  );

-- Users can delete their own clients
CREATE POLICY "Users can delete own clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_clients_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_clients_updated_at();

-- Migrate existing client data from practices to clients table
-- This will create unique client records based on email (if available) or name+phone combination
INSERT INTO public.clients (first_name, last_name, email, phone, user_id, created_at)
SELECT DISTINCT ON (LOWER(COALESCE(p.client_email, p.client_name || p.client_phone)))
  -- Split client_name into first_name and last_name
  CASE 
    WHEN position(' ' in p.client_name) > 0 
    THEN substring(p.client_name from 1 for position(' ' in p.client_name) - 1)
    ELSE p.client_name
  END as first_name,
  CASE 
    WHEN position(' ' in p.client_name) > 0 
    THEN substring(p.client_name from position(' ' in p.client_name) + 1)
    ELSE ''
  END as last_name,
  NULLIF(p.client_email, '') as email,
  NULLIF(p.client_phone, '') as phone,
  p.user_id,
  MIN(p.created_at) as created_at
FROM public.practices p
WHERE NOT EXISTS (
  -- Don't create duplicate clients
  SELECT 1 FROM public.clients c
  WHERE (c.email IS NOT NULL AND LOWER(c.email) = LOWER(p.client_email))
     OR (c.email IS NULL AND c.first_name || ' ' || c.last_name = p.client_name AND c.phone = p.client_phone)
)
GROUP BY p.client_name, p.client_email, p.client_phone, p.user_id
ORDER BY LOWER(COALESCE(p.client_email, p.client_name || p.client_phone)), MIN(p.created_at);

-- Update practices to link with clients
UPDATE public.practices p
SET client_id = c.id
FROM public.clients c
WHERE (
  (c.email IS NOT NULL AND LOWER(c.email) = LOWER(p.client_email))
  OR
  (c.email IS NULL AND c.first_name || ' ' || c.last_name = p.client_name AND c.phone = p.client_phone)
)
AND p.client_id IS NULL;

-- Add comment to table
COMMENT ON TABLE public.clients IS 'Comprehensive client directory with full contact and company information';
