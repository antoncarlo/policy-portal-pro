-- Add document type metadata to practice documents for mandatory document validation.
-- This keeps each uploaded file linked to the required document slot configured in the frontend.

ALTER TABLE public.practice_documents
  ADD COLUMN IF NOT EXISTS document_type text;

CREATE INDEX IF NOT EXISTS idx_practice_documents_document_type
  ON public.practice_documents(document_type);

COMMENT ON COLUMN public.practice_documents.document_type IS
  'Identifier of the required document slot uploaded for the practice, for example visura_camerale or questionario_sanitario.';
