-- Create system_settings table for global portal configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  portal_name text DEFAULT 'AssicuraPortal' NOT NULL,
  portal_logo_url text,
  
  -- Email
  sender_email text DEFAULT 'noreply@assicuraportal.com',
  sender_name text DEFAULT 'AssicuraPortal',
  support_email text,
  
  -- Security
  password_min_length integer DEFAULT 8,
  password_require_uppercase boolean DEFAULT true,
  password_require_numbers boolean DEFAULT true,
  session_timeout_minutes integer DEFAULT 30,
  max_login_attempts integer DEFAULT 5,
  lockout_duration_minutes integer DEFAULT 15,
  
  -- Storage
  storage_limit_per_user_gb numeric DEFAULT 1,
  
  -- Localization
  default_language text DEFAULT 'it',
  default_timezone text DEFAULT 'Europe/Rome',
  default_date_format text DEFAULT 'DD/MM/YYYY',
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default settings
INSERT INTO public.system_settings (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify system settings
CREATE POLICY "Admins can view system settings"
  ON public.system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update system settings"
  ON public.system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  action text NOT NULL,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view their own logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert logs (no RLS restriction for INSERT)
CREATE POLICY "System can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_event_type ON public.activity_logs(event_type);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Add comments
COMMENT ON TABLE public.system_settings IS 'Global portal configuration settings';
COMMENT ON TABLE public.activity_logs IS 'Audit trail for user activities and system events';
