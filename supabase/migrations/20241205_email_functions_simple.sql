-- Email Automation Functions
-- Funzioni semplificate per gestione email

-- Funzione per recuperare notifiche in attesa di invio email
CREATE OR REPLACE FUNCTION public.get_pending_email_notifications()
RETURNS TABLE (
  notification_id UUID,
  practice_id UUID,
  practice_number VARCHAR,
  practice_type VARCHAR,
  policy_end_date TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER,
  notification_type VARCHAR,
  notification_date TIMESTAMP WITH TIME ZONE,
  client_name VARCHAR,
  client_email VARCHAR,
  agent_name VARCHAR,
  agent_email VARCHAR,
  agent_phone VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    en.id AS notification_id,
    p.id AS practice_id,
    p.practice_number,
    p.practice_type,
    p.policy_end_date,
    en.days_before_expiry AS days_until_expiry,
    en.notification_type,
    en.notification_date,
    COALESCE(c.name, p.client_name) AS client_name,
    COALESCE(c.email, p.client_email) AS client_email,
    u.full_name AS agent_name,
    u.email AS agent_email,
    u.phone AS agent_phone
  FROM 
    public.expiry_notifications en
    INNER JOIN public.practices p ON en.practice_id = p.id
    LEFT JOIN public.clients c ON p.client_id = c.id
    LEFT JOIN public.profiles u ON p.agent_id = u.id
  WHERE 
    en.notification_date <= NOW()
    AND en.email_sent = FALSE
    AND p.status != 'cancelled'
    AND COALESCE(c.email, p.client_email) IS NOT NULL
    AND COALESCE(c.email, p.client_email) != ''
  ORDER BY 
    en.notification_date ASC,
    en.days_before_expiry ASC
  LIMIT 100;
END;
$$;

-- Funzione per marcare notifica come inviata via email
CREATE OR REPLACE FUNCTION public.mark_email_notification_sent(
  p_notification_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.expiry_notifications
  SET 
    email_sent = TRUE,
    email_sent_at = NOW()
  WHERE id = p_notification_id;
END;
$$;

-- Funzione per loggare invio email
CREATE OR REPLACE FUNCTION public.log_email_sent(
  p_practice_id UUID,
  p_notification_id UUID,
  p_recipient_email VARCHAR,
  p_recipient_name VARCHAR,
  p_subject VARCHAR,
  p_template_used VARCHAR,
  p_notification_type VARCHAR,
  p_resend_email_id VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT 'sent'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Crea tabella email_logs se non esiste (fallback)
  CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.expiry_notifications(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    template_used VARCHAR(100),
    notification_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    resend_email_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  INSERT INTO public.email_logs (
    practice_id,
    notification_id,
    recipient_email,
    recipient_name,
    subject,
    template_used,
    notification_type,
    status,
    resend_email_id,
    sent_at
  ) VALUES (
    p_practice_id,
    p_notification_id,
    p_recipient_email,
    p_recipient_name,
    p_subject,
    p_template_used,
    p_notification_type,
    p_status,
    p_resend_email_id,
    CASE WHEN p_status = 'sent' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_pending_email_notifications() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_notification_sent(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_email_sent(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;
