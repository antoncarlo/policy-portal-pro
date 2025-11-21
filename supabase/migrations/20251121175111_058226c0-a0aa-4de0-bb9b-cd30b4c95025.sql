-- Create storage bucket for practice documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-documents', 'practice-documents', false);

-- Create practice_documents table
CREATE TABLE public.practice_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on practice_documents
ALTER TABLE public.practice_documents ENABLE ROW LEVEL SECURITY;

-- Create practice_events table for timeline
CREATE TABLE public.practice_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on practice_events
ALTER TABLE public.practice_events ENABLE ROW LEVEL SECURITY;

-- Helper function to extract practice_id from storage path
CREATE OR REPLACE FUNCTION public.get_practice_id_from_path(path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT SPLIT_PART(path, '/', 1)::uuid;
$$;

-- Storage policies for practice documents
CREATE POLICY "Users can view their own practice documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'practice-documents' AND
  (
    -- User owns the practice
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = get_practice_id_from_path(name)
        AND p.user_id = auth.uid()
    )
    OR
    -- User is an agent viewing collaborator's practice
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = get_practice_id_from_path(name)
        AND can_view_practice(auth.uid(), p.user_id)
    )
    OR
    -- User is admin
    has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can upload documents to their practices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'practice-documents' AND
  (
    -- User owns the practice
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = get_practice_id_from_path(name)
        AND p.user_id = auth.uid()
    )
    OR
    -- User is admin
    has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can delete documents from their practices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'practice-documents' AND
  (
    -- User owns the practice
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = get_practice_id_from_path(name)
        AND p.user_id = auth.uid()
    )
    OR
    -- User is admin
    has_role(auth.uid(), 'admin')
  )
);

-- RLS Policies for practice_documents table
CREATE POLICY "Users can view their own practice documents"
ON public.practice_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.practices p
    WHERE p.id = practice_id
      AND (p.user_id = auth.uid() OR can_view_practice(auth.uid(), p.user_id) OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Users can insert documents to their practices"
ON public.practice_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practices p
    WHERE p.id = practice_id
      AND (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Users can delete their practice documents"
ON public.practice_documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.practices p
    WHERE p.id = practice_id
      AND (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

-- RLS Policies for practice_events table
CREATE POLICY "Users can view events for their practices"
ON public.practice_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.practices p
    WHERE p.id = practice_id
      AND (p.user_id = auth.uid() OR can_view_practice(auth.uid(), p.user_id) OR has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Users can insert events for their practices"
ON public.practice_events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.practices p
    WHERE p.id = practice_id
      AND (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

-- Create trigger to log practice status changes
CREATE OR REPLACE FUNCTION public.log_practice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.practice_events (practice_id, event_type, description, created_by)
    VALUES (
      NEW.id,
      'status_change',
      'Stato cambiato da ' || OLD.status || ' a ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_status_change_trigger
AFTER UPDATE ON public.practices
FOR EACH ROW
EXECUTE FUNCTION public.log_practice_status_change();

-- Create function to log practice creation
CREATE OR REPLACE FUNCTION public.log_practice_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.practice_events (practice_id, event_type, description, created_by)
  VALUES (
    NEW.id,
    'created',
    'Pratica creata',
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_creation_trigger
AFTER INSERT ON public.practices
FOR EACH ROW
EXECUTE FUNCTION public.log_practice_creation();