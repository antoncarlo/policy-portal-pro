-- ---------------------------------------------------------------------------
-- api_key_user_mapping
-- Maps each API key (partner) to a portal user account, so that practices
-- received via the webhook can be owned by the partner's user_id and become
-- visible to that partner through the existing RLS policies.
--
-- The webhook resolves user_id from this table by api_key_id; when no mapping
-- exists it falls back to WEBHOOK_DEFAULT_USER_ID (backward compatible).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_key_user_mapping (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id uuid NOT NULL UNIQUE REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_key_user_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage api_key_user_mapping" ON public.api_key_user_mapping;
CREATE POLICY "Admins can manage api_key_user_mapping" ON public.api_key_user_mapping
  FOR ALL
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS idx_api_key_user_mapping_api_key_id ON public.api_key_user_mapping(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_user_mapping_user_id ON public.api_key_user_mapping(user_id);
