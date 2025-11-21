-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('status_change', 'document_added', 'practice_created')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable Realtime for practices (for status changes)
ALTER TABLE public.practices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practices;

-- Enable Realtime for practice_documents
ALTER TABLE public.practice_documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_documents;

-- Function to create notification when document is added
CREATE OR REPLACE FUNCTION public.notify_document_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_owner UUID;
  practice_num TEXT;
BEGIN
  -- Get practice owner and number
  SELECT user_id, practice_number INTO practice_owner, practice_num
  FROM public.practices
  WHERE id = NEW.practice_id;

  -- Create notification for practice owner
  INSERT INTO public.notifications (user_id, practice_id, type, title, message)
  VALUES (
    practice_owner,
    NEW.practice_id,
    'document_added',
    'Nuovo Documento Caricato',
    'È stato caricato un nuovo documento per la pratica ' || practice_num
  );

  RETURN NEW;
END;
$$;

-- Trigger for document added
CREATE TRIGGER on_document_added
  AFTER INSERT ON public.practice_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_added();

-- Update the existing log_practice_status_change function to also create notifications
CREATE OR REPLACE FUNCTION public.log_practice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status_label TEXT;
  new_status_label TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map status to Italian labels
    old_status_label := CASE OLD.status
      WHEN 'in_lavorazione' THEN 'In Lavorazione'
      WHEN 'in_attesa' THEN 'In Attesa'
      WHEN 'approvata' THEN 'Approvata'
      WHEN 'completata' THEN 'Completata'
      WHEN 'rifiutata' THEN 'Rifiutata'
      ELSE OLD.status
    END;
    
    new_status_label := CASE NEW.status
      WHEN 'in_lavorazione' THEN 'In Lavorazione'
      WHEN 'in_attesa' THEN 'In Attesa'
      WHEN 'approvata' THEN 'Approvata'
      WHEN 'completata' THEN 'Completata'
      WHEN 'rifiutata' THEN 'Rifiutata'
      ELSE NEW.status
    END;

    -- Insert event log
    INSERT INTO public.practice_events (practice_id, event_type, description, created_by)
    VALUES (
      NEW.id,
      'status_change',
      'Stato cambiato da ' || old_status_label || ' a ' || new_status_label,
      auth.uid()
    );

    -- Create notification for practice owner
    INSERT INTO public.notifications (user_id, practice_id, type, title, message)
    VALUES (
      NEW.user_id,
      NEW.id,
      'status_change',
      'Cambio Stato Pratica',
      'Lo stato della pratica ' || NEW.practice_number || ' è stato cambiato da ' || old_status_label || ' a ' || new_status_label
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create index for better query performance
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);