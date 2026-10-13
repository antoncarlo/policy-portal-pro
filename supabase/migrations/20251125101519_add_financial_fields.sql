-- Add financial fields to practices table for commission and payment tracking

-- Create enum for financial status
CREATE TYPE financial_status AS ENUM (
  'non_incassata',        -- Practice not yet paid by client
  'incassata',            -- Client paid, waiting for commission
  'provvigioni_ricevute'  -- Commission received
);

-- Add financial columns to practices table
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS premium_amount DECIMAL(10,2),           -- Premio assicurativo (importo polizza)
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2),    -- Percentuale provvigione
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2),       -- Importo provvigione calcolato
ADD COLUMN IF NOT EXISTS financial_status financial_status DEFAULT 'non_incassata',
ADD COLUMN IF NOT EXISTS payment_date DATE,                     -- Data incasso cliente
ADD COLUMN IF NOT EXISTS commission_received_date DATE;         -- Data ricezione provvigioni

-- Add comments
COMMENT ON COLUMN practices.premium_amount IS 'Importo premio assicurativo pagato dal cliente';
COMMENT ON COLUMN practices.commission_percentage IS 'Percentuale di provvigione (es. 15.50 per 15.5%)';
COMMENT ON COLUMN practices.commission_amount IS 'Importo provvigione calcolato automaticamente';
COMMENT ON COLUMN practices.financial_status IS 'Stato finanziario: non_incassata, incassata, provvigioni_ricevute';
COMMENT ON COLUMN practices.payment_date IS 'Data in cui il cliente ha pagato il premio';
COMMENT ON COLUMN practices.commission_received_date IS 'Data in cui sono state ricevute le provvigioni';

-- Create function to automatically calculate commission amount
CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.premium_amount IS NOT NULL AND NEW.commission_percentage IS NOT NULL THEN
    NEW.commission_amount := ROUND((NEW.premium_amount * NEW.commission_percentage / 100)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate commission
DROP TRIGGER IF EXISTS trigger_calculate_commission ON practices;
CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF premium_amount, commission_percentage
  ON practices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission();

-- Create function to get financial summary for a user
CREATE OR REPLACE FUNCTION get_financial_summary(user_uuid uuid)
RETURNS TABLE (
  total_practices bigint,
  total_premium_amount numeric,
  total_commission_amount numeric,
  non_incassate_count bigint,
  non_incassate_amount numeric,
  incassate_count bigint,
  incassate_commission numeric,
  provvigioni_ricevute_count bigint,
  provvigioni_ricevute_amount numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_practices,
    COALESCE(SUM(premium_amount), 0) as total_premium_amount,
    COALESCE(SUM(commission_amount), 0) as total_commission_amount,
    COUNT(*) FILTER (WHERE financial_status = 'non_incassata')::bigint as non_incassate_count,
    COALESCE(SUM(premium_amount) FILTER (WHERE financial_status = 'non_incassata'), 0) as non_incassate_amount,
    COUNT(*) FILTER (WHERE financial_status = 'incassata')::bigint as incassate_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'incassata'), 0) as incassate_commission,
    COUNT(*) FILTER (WHERE financial_status = 'provvigioni_ricevute')::bigint as provvigioni_ricevute_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'provvigioni_ricevute'), 0) as provvigioni_ricevute_amount
  FROM practices
  WHERE user_id = user_uuid;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_financial_summary(uuid) TO authenticated;

COMMENT ON FUNCTION get_financial_summary(uuid) IS 'Returns financial summary for a specific user including commissions and payment status';
