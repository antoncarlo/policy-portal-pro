-- Add VIES as a practice type distinct from fidejussioni and persist Excel-ZIP reconciliation metadata.
ALTER TYPE practice_type ADD VALUE IF NOT EXISTS 'vies';

-- Reconciliation columns for nominative ZIP uploads keyed by Excel field NOME ZIP.
ALTER TABLE public.vies_jobs ADD COLUMN IF NOT EXISTS nome_zip TEXT;
ALTER TABLE public.vies_jobs ADD COLUMN IF NOT EXISTS zip_file_name TEXT;
ALTER TABLE public.vies_jobs ADD COLUMN IF NOT EXISTS reconciliation_errors JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vies_batch_documents ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES public.practices(id) ON DELETE SET NULL;
ALTER TABLE public.vies_batch_documents ADD COLUMN IF NOT EXISTS row_number INTEGER;
ALTER TABLE public.vies_batch_documents ADD COLUMN IF NOT EXISTS nome_zip TEXT;
ALTER TABLE public.vies_batch_documents ADD COLUMN IF NOT EXISTS zip_file_name TEXT;
