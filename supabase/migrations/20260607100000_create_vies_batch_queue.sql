-- VIES massive import queue: batches, jobs and indexed ZIP documents

-- Private bucket used to keep original Excel and ZIP files uploaded from the VIES page.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vies-batch-files', 'vies-batch-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.vies_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_excel_file_name TEXT,
  source_zip_file_name TEXT,
  excel_storage_path TEXT,
  zip_storage_path TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  total_documents INTEGER NOT NULL DEFAULT 0,
  matched_requirements INTEGER NOT NULL DEFAULT 0,
  missing_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  notes TEXT,
  queued_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.vies_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.vies_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  row_number INTEGER NOT NULL,
  progressivo TEXT,
  contraente TEXT,
  indirizzo_rappresentante_fiscale TEXT,
  partita_iva_contraente TEXT,
  beneficiario TEXT,
  indirizzo_beneficiario TEXT,
  partita_iva_beneficiario TEXT,
  pec TEXT,
  pagamento TEXT,
  documenti_indicati TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_validation' CHECK (status IN ('pending_validation', 'ready', 'queued', 'processing', 'completed', 'failed', 'blocked', 'cancelled')),
  assigned_agent TEXT,
  locked_by TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  external_reference TEXT,
  last_error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.vies_batch_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.vies_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_extension TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  is_nested_zip BOOLEAN NOT NULL DEFAULT false,
  requirement_matches TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'indexed' CHECK (status IN ('indexed', 'linked', 'ignored', 'missing', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (batch_id, file_path)
);

CREATE INDEX idx_vies_batches_user_id ON public.vies_batches(user_id);
CREATE INDEX idx_vies_batches_status ON public.vies_batches(status);
CREATE INDEX idx_vies_batches_created_at ON public.vies_batches(created_at DESC);
CREATE INDEX idx_vies_jobs_batch_id ON public.vies_jobs(batch_id);
CREATE INDEX idx_vies_jobs_user_status ON public.vies_jobs(user_id, status);
CREATE INDEX idx_vies_jobs_locked_at ON public.vies_jobs(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX idx_vies_batch_documents_batch_id ON public.vies_batch_documents(batch_id);
CREATE INDEX idx_vies_batch_documents_user_id ON public.vies_batch_documents(user_id);

ALTER TABLE public.vies_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vies_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vies_batch_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_vies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_vies_batches_updated_at
BEFORE UPDATE ON public.vies_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_vies_updated_at();

CREATE TRIGGER update_vies_jobs_updated_at
BEFORE UPDATE ON public.vies_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_vies_updated_at();

-- Batch policies
CREATE POLICY "Users can view their own VIES batches"
ON public.vies_batches FOR SELECT
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can create their own VIES batches"
ON public.vies_batches FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can update their own VIES batches"
ON public.vies_batches FOR UPDATE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can delete their own VIES batches"
ON public.vies_batches FOR DELETE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

-- Job policies
CREATE POLICY "Users can view their own VIES jobs"
ON public.vies_jobs FOR SELECT
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can create their own VIES jobs"
ON public.vies_jobs FOR INSERT
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.vies_batches b
    WHERE b.id = batch_id AND b.user_id = (SELECT auth.uid())
  )
  OR has_role((SELECT auth.uid()), 'admin')
);

CREATE POLICY "Users can update their own VIES jobs"
ON public.vies_jobs FOR UPDATE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can delete their own VIES jobs"
ON public.vies_jobs FOR DELETE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

-- Document index policies
CREATE POLICY "Users can view their own VIES documents"
ON public.vies_batch_documents FOR SELECT
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can create their own VIES documents"
ON public.vies_batch_documents FOR INSERT
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.vies_batches b
    WHERE b.id = batch_id AND b.user_id = (SELECT auth.uid())
  )
  OR has_role((SELECT auth.uid()), 'admin')
);

CREATE POLICY "Users can update their own VIES documents"
ON public.vies_batch_documents FOR UPDATE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can delete their own VIES documents"
ON public.vies_batch_documents FOR DELETE
USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

-- Storage policies: path convention is {user_id}/{batch_id}/{file_name}
CREATE POLICY "Users can view their own VIES batch files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vies-batch-files'
  AND (
    split_part(name, '/', 1)::uuid = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin')
  )
);

CREATE POLICY "Users can upload their own VIES batch files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vies-batch-files'
  AND (
    split_part(name, '/', 1)::uuid = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin')
  )
);

CREATE POLICY "Users can update their own VIES batch files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vies-batch-files'
  AND (
    split_part(name, '/', 1)::uuid = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin')
  )
)
WITH CHECK (
  bucket_id = 'vies-batch-files'
  AND (
    split_part(name, '/', 1)::uuid = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin')
  )
);

CREATE POLICY "Users can delete their own VIES batch files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vies-batch-files'
  AND (
    split_part(name, '/', 1)::uuid = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin')
  )
);
