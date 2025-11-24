-- Create agent_settings table for agent-specific configurations
CREATE TABLE IF NOT EXISTS public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_template text,
  digital_signature_url text,
  company_logo_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see and modify their own settings
CREATE POLICY "Users can view own agent settings"
  ON public.agent_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent settings"
  ON public.agent_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent settings"
  ON public.agent_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent settings"
  ON public.agent_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_agent_settings_updated_at
  BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index
CREATE INDEX idx_agent_settings_user_id ON public.agent_settings(user_id);

-- Add comments
COMMENT ON TABLE public.agent_settings IS 'Agent-specific settings for email templates, signatures, and logos';
COMMENT ON COLUMN public.agent_settings.email_template IS 'Email template for client communications';
COMMENT ON COLUMN public.agent_settings.digital_signature_url IS 'URL to digital signature image';
COMMENT ON COLUMN public.agent_settings.company_logo_url IS 'URL to company logo image';
