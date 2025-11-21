-- Create enum for practice status
CREATE TYPE public.practice_status AS ENUM (
  'in_lavorazione',
  'in_attesa',
  'approvata',
  'rifiutata',
  'completata'
);

-- Create enum for practice type
CREATE TYPE public.practice_type AS ENUM (
  'auto',
  'casa',
  'vita',
  'salute',
  'responsabilita',
  'altro'
);

-- Create practices table
CREATE TABLE public.practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_number TEXT NOT NULL UNIQUE,
  practice_type public.practice_type NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT NOT NULL,
  policy_number TEXT,
  notes TEXT,
  status public.practice_status NOT NULL DEFAULT 'in_lavorazione',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_practices_user_id ON public.practices(user_id);
CREATE INDEX idx_practices_status ON public.practices(status);
CREATE INDEX idx_practices_created_at ON public.practices(created_at DESC);

-- Enable RLS
ALTER TABLE public.practices ENABLE ROW LEVEL SECURITY;

-- Function to check if user can view practice (for agents checking collaborators)
CREATE OR REPLACE FUNCTION public.can_view_practice(_user_id UUID, _practice_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- User can view their own practices
  SELECT CASE
    WHEN _user_id = _practice_user_id THEN true
    -- Agent can view practices of their collaborators
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _practice_user_id
        AND ur.parent_agent_id = _user_id
        AND ur.role = 'collaboratore'
    ) THEN true
    ELSE false
  END
$$;

-- RLS Policies for practices table

-- Admins can view all practices
CREATE POLICY "Admins can view all practices"
  ON public.practices FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own practices
CREATE POLICY "Users can view their own practices"
  ON public.practices FOR SELECT
  USING (auth.uid() = user_id);

-- Agents can view practices of their collaborators
CREATE POLICY "Agents can view collaborators practices"
  ON public.practices FOR SELECT
  USING (
    public.has_role(auth.uid(), 'agente')
    AND public.can_view_practice(auth.uid(), user_id)
  );

-- Users can insert their own practices
CREATE POLICY "Users can insert their own practices"
  ON public.practices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own practices
CREATE POLICY "Users can update their own practices"
  ON public.practices FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can update all practices
CREATE POLICY "Admins can update all practices"
  ON public.practices FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Agents can update their collaborators' practices
CREATE POLICY "Agents can update collaborators practices"
  ON public.practices FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'agente')
    AND public.can_view_practice(auth.uid(), user_id)
  );

-- Users can delete their own practices
CREATE POLICY "Users can delete their own practices"
  ON public.practices FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete all practices
CREATE POLICY "Admins can delete all practices"
  ON public.practices FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_practices_updated_at
  BEFORE UPDATE ON public.practices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();