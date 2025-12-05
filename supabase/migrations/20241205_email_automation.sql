-- =====================================================
-- EMAIL AUTOMATION SYSTEM
-- Migration: 20241205_email_automation.sql
-- Description: Tabelle e funzioni per invio automatico email scadenze
-- =====================================================

-- =====================================================
-- 1. TABELLA EMAIL_TEMPLATES
-- Salva i template email HTML
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- '90_days', '60_days', '30_days', '7_days'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index per ricerca veloce template
CREATE INDEX IF NOT EXISTS idx_email_templates_notification_type 
ON public.email_templates(notification_type);

CREATE INDEX IF NOT EXISTS idx_email_templates_active 
ON public.email_templates(is_active);

-- =====================================================
-- 2. TABELLA EMAIL_LOGS
-- Traccia tutti gli invii email per audit
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.expiry_notifications(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    template_used VARCHAR(100),
    notification_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
    resend_email_id VARCHAR(255), -- ID email da Resend per tracking
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_email_logs_practice_id 
ON public.email_logs(practice_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_notification_id 
ON public.email_logs(notification_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_status 
ON public.email_logs(status);

CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at 
ON public.email_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email 
ON public.email_logs(recipient_email);

-- =====================================================
-- 3. FUNZIONE: get_pending_email_notifications
-- Recupera tutte le notifiche che devono essere inviate via email
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_email_notifications()
RETURNS TABLE (
    notification_id UUID,
    practice_id UUID,
    practice_number VARCHAR,
    practice_type VARCHAR,
    policy_end_date DATE,
    days_until_expiry INTEGER,
    notification_type VARCHAR,
    notification_date DATE,
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
        (p.policy_end_date - CURRENT_DATE) AS days_until_expiry,
        en.notification_type,
        en.notification_date,
        c.full_name AS client_name,
        c.email AS client_email,
        u.full_name AS agent_name,
        u.email AS agent_email,
        u.phone AS agent_phone
    FROM 
        public.expiry_notifications en
    INNER JOIN 
        public.practices p ON en.practice_id = p.id
    INNER JOIN 
        public.clients c ON p.client_id = c.id
    INNER JOIN 
        public.users u ON p.assigned_to = u.id
    WHERE 
        -- Notifica non ancora inviata via email
        en.email_sent = false
        -- Data notifica è oggi o passata
        AND en.notification_date <= CURRENT_DATE
        -- Pratica ancora attiva
        AND p.status = 'attiva'
        -- Polizza non ancora scaduta
        AND p.policy_end_date >= CURRENT_DATE
        -- Cliente ha email valida
        AND c.email IS NOT NULL
        AND c.email != ''
    ORDER BY 
        en.notification_date ASC,
        p.policy_end_date ASC;
END;
$$;

-- =====================================================
-- 4. FUNZIONE: render_email_template
-- Sostituisce i placeholder nel template con i dati reali
-- =====================================================

CREATE OR REPLACE FUNCTION render_email_template(
    template_html TEXT,
    p_client_name VARCHAR,
    p_practice_number VARCHAR,
    p_practice_type VARCHAR,
    p_policy_end_date DATE,
    p_days_until_expiry INTEGER,
    p_agent_name VARCHAR,
    p_agent_email VARCHAR,
    p_agent_phone VARCHAR
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    rendered_html TEXT;
    current_year VARCHAR;
BEGIN
    -- Anno corrente per footer
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Sostituisci tutti i placeholder
    rendered_html := template_html;
    rendered_html := REPLACE(rendered_html, '{{client_name}}', COALESCE(p_client_name, 'Cliente'));
    rendered_html := REPLACE(rendered_html, '{{practice_number}}', COALESCE(p_practice_number, 'N/A'));
    rendered_html := REPLACE(rendered_html, '{{practice_type}}', COALESCE(p_practice_type, 'N/A'));
    rendered_html := REPLACE(rendered_html, '{{policy_end_date}}', TO_CHAR(p_policy_end_date, 'DD/MM/YYYY'));
    rendered_html := REPLACE(rendered_html, '{{days_until_expiry}}', p_days_until_expiry::VARCHAR);
    rendered_html := REPLACE(rendered_html, '{{agent_name}}', COALESCE(p_agent_name, 'Il tuo Agente'));
    rendered_html := REPLACE(rendered_html, '{{agent_email}}', COALESCE(p_agent_email, ''));
    rendered_html := REPLACE(rendered_html, '{{agent_phone}}', COALESCE(p_agent_phone, ''));
    rendered_html := REPLACE(rendered_html, '{{current_year}}', current_year);
    
    RETURN rendered_html;
END;
$$;

-- =====================================================
-- 5. FUNZIONE: log_email_sent
-- Registra l'invio di un'email nel log
-- =====================================================

CREATE OR REPLACE FUNCTION log_email_sent(
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
    log_id UUID;
BEGIN
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
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- =====================================================
-- 6. FUNZIONE: mark_email_notification_sent
-- Marca una notifica come inviata via email
-- =====================================================

CREATE OR REPLACE FUNCTION mark_email_notification_sent(
    p_notification_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.expiry_notifications
    SET 
        email_sent = true,
        email_sent_at = NOW(),
        updated_at = NOW()
    WHERE id = p_notification_id;
END;
$$;

-- =====================================================
-- 7. FUNZIONE: update_email_log_status
-- Aggiorna lo stato di un log email (per webhook Resend)
-- =====================================================

CREATE OR REPLACE FUNCTION update_email_log_status(
    p_resend_email_id VARCHAR,
    p_status VARCHAR,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.email_logs
    SET 
        status = p_status,
        opened_at = CASE WHEN p_status = 'opened' THEN p_timestamp ELSE opened_at END,
        clicked_at = CASE WHEN p_status = 'clicked' THEN p_timestamp ELSE clicked_at END,
        bounced_at = CASE WHEN p_status = 'bounced' THEN p_timestamp ELSE bounced_at END
    WHERE resend_email_id = p_resend_email_id;
END;
$$;

-- =====================================================
-- 8. INSERIMENTO TEMPLATE EMAIL INIZIALI
-- =====================================================

INSERT INTO public.email_templates (name, subject, html_content, notification_type, is_active)
VALUES 
(
    'expiry_90_days',
    'Promemoria: La tua polizza scade tra 90 giorni',
    '<!-- Template placeholder - verrà caricato dal file HTML -->',
    '90_days',
    true
),
(
    'expiry_60_days',
    'Promemoria Importante: La tua polizza scade tra 60 giorni',
    '<!-- Template placeholder - verrà caricato dal file HTML -->',
    '60_days',
    true
),
(
    'expiry_30_days',
    'Urgente: La tua polizza scade tra 30 giorni - Azione Richiesta',
    '<!-- Template placeholder - verrà caricato dal file HTML -->',
    '30_days',
    true
),
(
    'expiry_7_days',
    '🚨 URGENTE: La tua polizza scade tra 7 giorni - Contatta subito il tuo agente',
    '<!-- Template placeholder - verrà caricato dal file HTML -->',
    '7_days',
    true
)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

-- Email Templates: Solo admin possono modificare
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_select_all" ON public.email_templates
    FOR SELECT USING (true);

CREATE POLICY "email_templates_admin_all" ON public.email_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Email Logs: Utenti vedono solo i propri log
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select_own" ON public.email_logs
    FOR SELECT USING (
        -- Admin vede tutti
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
        OR
        -- Agente vede solo le sue pratiche
        EXISTS (
            SELECT 1 FROM public.practices p
            WHERE p.id = email_logs.practice_id
            AND p.assigned_to = auth.uid()
        )
        OR
        -- Collaboratore vede pratiche del suo team
        EXISTS (
            SELECT 1 FROM public.practices p
            INNER JOIN public.users u ON p.assigned_to = u.id
            WHERE p.id = email_logs.practice_id
            AND u.parent_id = auth.uid()
        )
    );

-- Sistema può inserire log
CREATE POLICY "email_logs_system_insert" ON public.email_logs
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- 10. COMMENTI TABELLE
-- =====================================================

COMMENT ON TABLE public.email_templates IS 'Template HTML per email automatiche scadenze';
COMMENT ON TABLE public.email_logs IS 'Log completo di tutti gli invii email per audit e tracking';

COMMENT ON FUNCTION get_pending_email_notifications() IS 'Recupera tutte le notifiche scadenza che devono essere inviate via email';
COMMENT ON FUNCTION render_email_template(TEXT, VARCHAR, VARCHAR, VARCHAR, DATE, INTEGER, VARCHAR, VARCHAR, VARCHAR) IS 'Sostituisce placeholder nel template con dati reali';
COMMENT ON FUNCTION log_email_sent(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) IS 'Registra invio email nel log';
COMMENT ON FUNCTION mark_email_notification_sent(UUID) IS 'Marca notifica come inviata via email';
COMMENT ON FUNCTION update_email_log_status(VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE) IS 'Aggiorna stato email da webhook Resend';

-- =====================================================
-- FINE MIGRATION
-- =====================================================
