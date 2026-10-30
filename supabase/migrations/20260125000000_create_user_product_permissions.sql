-- Create user_product_permissions table
-- This table stores which practice types (products) each user is allowed to manage
CREATE TABLE public.user_product_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_type public.practice_type NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, practice_type)
);

-- Enable RLS
ALTER TABLE public.user_product_permissions ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_user_product_permissions_user_id ON public.user_product_permissions(user_id);
CREATE INDEX idx_user_product_permissions_practice_type ON public.user_product_permissions(practice_type);

-- RLS Policies
-- Users can view their own product permissions
CREATE POLICY "Users can view their own product permissions"
ON public.user_product_permissions FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all product permissions
CREATE POLICY "Admins can view all product permissions"
ON public.user_product_permissions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Agents can view their collaborators' product permissions
CREATE POLICY "Agents can view their collaborators product permissions"
ON public.user_product_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_product_permissions.user_id
      AND ur.parent_agent_id = auth.uid()
  )
);

-- Admins can insert/update/delete product permissions
CREATE POLICY "Admins can manage all product permissions"
ON public.user_product_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Agents can manage their collaborators' product permissions
CREATE POLICY "Agents can manage their collaborators product permissions"
ON public.user_product_permissions FOR ALL
USING (
  has_role(auth.uid(), 'agente') AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_product_permissions.user_id
      AND ur.parent_agent_id = auth.uid()
      AND ur.role = 'collaboratore'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agente') AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_product_permissions.user_id
      AND ur.parent_agent_id = auth.uid()
      AND ur.role = 'collaboratore'
  )
);

-- Create function to check if user has permission for a practice type
CREATE OR REPLACE FUNCTION public.has_product_permission(_user_id UUID, _practice_type public.practice_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins have permission for all products
  SELECT CASE
    WHEN has_role(_user_id, 'admin') THEN true
    -- Check if user has specific permission for this practice type
    ELSE EXISTS (
      SELECT 1 FROM public.user_product_permissions
      WHERE user_id = _user_id
        AND practice_type = _practice_type
    )
  END;
$$;

-- Create function to get user's allowed practice types
CREATE OR REPLACE FUNCTION public.get_user_allowed_practice_types(_user_id UUID)
RETURNS TABLE(practice_type public.practice_type)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins can see all practice types
  SELECT CASE
    WHEN has_role(_user_id, 'admin') THEN
      (SELECT unnest(enum_range(NULL::public.practice_type)))
    ELSE
      (SELECT upp.practice_type FROM public.user_product_permissions upp WHERE upp.user_id = _user_id)
  END;
$$;

-- Add comment to table
COMMENT ON TABLE public.user_product_permissions IS 'Stores which practice types (insurance products) each user is allowed to manage. Admins have access to all products by default.';
