-- Create table for expiry notifications
CREATE TABLE IF NOT EXISTS expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('90_days', '60_days', '30_days', '7_days')),
  notification_date DATE NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_expiry_notifications_practice_id ON expiry_notifications(practice_id);
CREATE INDEX idx_expiry_notifications_notification_date ON expiry_notifications(notification_date);
CREATE INDEX idx_expiry_notifications_sent ON expiry_notifications(sent) WHERE sent = FALSE;
CREATE INDEX idx_expiry_notifications_email_sent ON expiry_notifications(email_sent) WHERE email_sent = FALSE;

-- Add RLS policies
ALTER TABLE expiry_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notifications for their own practices
CREATE POLICY "Users can view their practice notifications"
  ON expiry_notifications
  FOR SELECT
  USING (
    practice_id IN (
      SELECT id FROM practices WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert/update notifications
CREATE POLICY "System can manage notifications"
  ON expiry_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to generate expiry notifications for a practice
CREATE OR REPLACE FUNCTION generate_expiry_notifications(p_practice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_policy_end_date DATE;
BEGIN
  -- Get policy end date
  SELECT policy_end_date INTO v_policy_end_date
  FROM practices
  WHERE id = p_practice_id;

  -- Only generate if policy_end_date exists
  IF v_policy_end_date IS NOT NULL THEN
    -- Delete existing notifications for this practice
    DELETE FROM expiry_notifications WHERE practice_id = p_practice_id;

    -- Insert 90 days notification
    IF v_policy_end_date - INTERVAL '90 days' > CURRENT_DATE THEN
      INSERT INTO expiry_notifications (practice_id, notification_type, notification_date)
      VALUES (p_practice_id, '90_days', v_policy_end_date - INTERVAL '90 days');
    END IF;

    -- Insert 60 days notification
    IF v_policy_end_date - INTERVAL '60 days' > CURRENT_DATE THEN
      INSERT INTO expiry_notifications (practice_id, notification_type, notification_date)
      VALUES (p_practice_id, '60_days', v_policy_end_date - INTERVAL '60 days');
    END IF;

    -- Insert 30 days notification
    IF v_policy_end_date - INTERVAL '30 days' > CURRENT_DATE THEN
      INSERT INTO expiry_notifications (practice_id, notification_type, notification_date)
      VALUES (p_practice_id, '30_days', v_policy_end_date - INTERVAL '30 days');
    END IF;

    -- Insert 7 days notification
    IF v_policy_end_date - INTERVAL '7 days' > CURRENT_DATE THEN
      INSERT INTO expiry_notifications (practice_id, notification_type, notification_date)
      VALUES (p_practice_id, '7_days', v_policy_end_date - INTERVAL '7 days');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-generate notifications when practice is created/updated
CREATE OR REPLACE FUNCTION trigger_generate_expiry_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if policy_end_date changed or new practice
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.policy_end_date IS DISTINCT FROM NEW.policy_end_date)) THEN
    PERFORM generate_expiry_notifications(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practices_expiry_notifications_trigger
  AFTER INSERT OR UPDATE ON practices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_expiry_notifications();

-- Function to get upcoming expiries for a user (hierarchical)
CREATE OR REPLACE FUNCTION get_upcoming_expiries(
  p_user_id UUID,
  p_days_ahead INTEGER DEFAULT 90,
  p_practice_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  practice_id UUID,
  practice_number TEXT,
  practice_type TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  policy_end_date DATE,
  days_until_expiry INTEGER,
  notification_90_sent BOOLEAN,
  notification_60_sent BOOLEAN,
  notification_30_sent BOOLEAN,
  notification_7_sent BOOLEAN,
  user_id UUID,
  user_full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.practice_number,
    p.practice_type,
    p.client_name,
    p.client_email,
    p.client_phone,
    p.policy_end_date,
    (p.policy_end_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    COALESCE((SELECT sent FROM expiry_notifications WHERE practice_id = p.id AND notification_type = '90_days'), FALSE) as notification_90_sent,
    COALESCE((SELECT sent FROM expiry_notifications WHERE practice_id = p.id AND notification_type = '60_days'), FALSE) as notification_60_sent,
    COALESCE((SELECT sent FROM expiry_notifications WHERE practice_id = p.id AND notification_type = '30_days'), FALSE) as notification_30_sent,
    COALESCE((SELECT sent FROM expiry_notifications WHERE practice_id = p.id AND notification_type = '7_days'), FALSE) as notification_7_sent,
    p.user_id,
    prof.full_name as user_full_name
  FROM practices p
  LEFT JOIN profiles prof ON p.user_id = prof.id
  WHERE 
    p.policy_end_date IS NOT NULL
    AND p.policy_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_days_ahead
    AND p.status = 'attiva'
    AND p.user_id IN (
      SELECT user_id FROM get_hierarchical_user_ids(p_user_id)
    )
    AND (p_practice_type IS NULL OR p.practice_type = p_practice_type)
  ORDER BY p.policy_end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as sent
CREATE OR REPLACE FUNCTION mark_notification_sent(
  p_practice_id UUID,
  p_notification_type TEXT,
  p_email_sent BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  UPDATE expiry_notifications
  SET 
    sent = TRUE,
    sent_at = NOW(),
    email_sent = CASE WHEN p_email_sent THEN TRUE ELSE email_sent END,
    email_sent_at = CASE WHEN p_email_sent THEN NOW() ELSE email_sent_at END,
    updated_at = NOW()
  WHERE 
    practice_id = p_practice_id 
    AND notification_type = p_notification_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate notifications for all existing practices
DO $$
DECLARE
  practice_record RECORD;
BEGIN
  FOR practice_record IN SELECT id FROM practices WHERE policy_end_date IS NOT NULL LOOP
    PERFORM generate_expiry_notifications(practice_record.id);
  END LOOP;
END $$;
