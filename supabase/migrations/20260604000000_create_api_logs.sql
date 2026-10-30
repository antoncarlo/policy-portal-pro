CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_masked text,
  source text,
  ip_address text,
  endpoint text,
  method text,
  status_code integer,
  practice_id uuid REFERENCES public.practices(id) ON DELETE SET NULL,
  error_message text,
  request_body_size integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api logs" ON public.api_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_source ON public.api_logs(source);
