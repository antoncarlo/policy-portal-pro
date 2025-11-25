-- Add default commission to user profiles and detailed premium breakdown

-- Step 1: Add default commission percentage to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_commission_percentage DECIMAL(5,2) DEFAULT 0.00;

COMMENT ON COLUMN profiles.default_commission_percentage IS 'Percentuale provvigione predefinita per l''utente (es. 15.50 per 15.5%)';

-- Step 2: Rename and restructure premium fields in practices table
-- Rename existing premium_amount to premium_net (premio netto)
ALTER TABLE practices 
RENAME COLUMN premium_amount TO premium_net;

-- Add new premium breakdown fields
ALTER TABLE practices 
ADD COLUMN IF NOT EXISTS premium_taxable DECIMAL(10,2),      -- Imponibile
ADD COLUMN IF NOT EXISTS premium_taxes DECIMAL(10,2),        -- Imposte
ADD COLUMN IF NOT EXISTS premium_gross DECIMAL(10,2);        -- Premio Lordo (totale)

-- Add comments
COMMENT ON COLUMN practices.premium_net IS 'Premio Netto - Base imponibile su cui si calcolano le provvigioni';
COMMENT ON COLUMN practices.premium_taxable IS 'Imponibile - Premio netto + eventuali accessori';
COMMENT ON COLUMN practices.premium_taxes IS 'Imposte - Tasse applicate';
COMMENT ON COLUMN practices.premium_gross IS 'Premio Lordo - Totale che il cliente paga (Imponibile + Imposte)';

-- Step 3: Update the commission calculation trigger to use premium_net
DROP TRIGGER IF EXISTS trigger_calculate_commission ON practices;
DROP FUNCTION IF EXISTS calculate_commission();

CREATE OR REPLACE FUNCTION calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission based on PREMIO NETTO (not gross)
  IF NEW.premium_net IS NOT NULL AND NEW.commission_percentage IS NOT NULL THEN
    NEW.commission_amount := ROUND((NEW.premium_net * NEW.commission_percentage / 100)::numeric, 2);
  END IF;
  
  -- Auto-calculate premium_gross if not provided
  IF NEW.premium_taxable IS NOT NULL AND NEW.premium_taxes IS NOT NULL AND NEW.premium_gross IS NULL THEN
    NEW.premium_gross := NEW.premium_taxable + NEW.premium_taxes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF premium_net, premium_taxable, premium_taxes, commission_percentage
  ON practices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission();

-- Step 4: Update existing financial summary functions to use premium_net
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
    COALESCE(SUM(premium_net), 0) as total_premium_amount,  -- Changed from premium_amount
    COALESCE(SUM(commission_amount), 0) as total_commission_amount,
    COUNT(*) FILTER (WHERE financial_status = 'non_incassata')::bigint as non_incassate_count,
    COALESCE(SUM(premium_net) FILTER (WHERE financial_status = 'non_incassata'), 0) as non_incassate_amount,
    COUNT(*) FILTER (WHERE financial_status = 'incassata')::bigint as incassate_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'incassata'), 0) as incassate_commission,
    COUNT(*) FILTER (WHERE financial_status = 'provvigioni_ricevute')::bigint as provvigioni_ricevute_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'provvigioni_ricevute'), 0) as provvigioni_ricevute_amount
  FROM practices
  WHERE user_id = user_uuid;
END;
$$;

-- Step 5: Update hierarchical financial summary to use premium_net
CREATE OR REPLACE FUNCTION get_hierarchical_financial_summary(
  requesting_user_id uuid,
  target_user_id uuid DEFAULT NULL
)
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
DECLARE
  user_role text;
  allowed_user_ids uuid[];
BEGIN
  -- Get the role of the requesting user
  SELECT ur.role::text INTO user_role
  FROM user_roles ur
  WHERE ur.user_id = requesting_user_id;

  -- Determine which user IDs the requesting user can access
  IF user_role = 'admin' THEN
    IF target_user_id IS NOT NULL THEN
      allowed_user_ids := ARRAY[target_user_id];
    ELSE
      SELECT ARRAY_AGG(p.id) INTO allowed_user_ids FROM profiles p;
    END IF;
  ELSIF user_role = 'agente' THEN
    IF target_user_id IS NOT NULL THEN
      IF target_user_id = requesting_user_id OR 
         EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = target_user_id AND ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id) THEN
        allowed_user_ids := ARRAY[target_user_id];
      ELSE
        allowed_user_ids := ARRAY[]::uuid[];
      END IF;
    ELSE
      SELECT ARRAY_AGG(ur.user_id) INTO allowed_user_ids
      FROM user_roles ur
      WHERE ur.user_id = requesting_user_id OR (ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id);
    END IF;
  ELSE
    allowed_user_ids := ARRAY[requesting_user_id];
  END IF;

  -- Return aggregated financial data using premium_net
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_practices,
    COALESCE(SUM(premium_net), 0) as total_premium_amount,  -- Changed from premium_amount
    COALESCE(SUM(commission_amount), 0) as total_commission_amount,
    COUNT(*) FILTER (WHERE financial_status = 'non_incassata')::bigint as non_incassate_count,
    COALESCE(SUM(premium_net) FILTER (WHERE financial_status = 'non_incassata'), 0) as non_incassate_amount,
    COUNT(*) FILTER (WHERE financial_status = 'incassata')::bigint as incassate_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'incassata'), 0) as incassate_commission,
    COUNT(*) FILTER (WHERE financial_status = 'provvigioni_ricevute')::bigint as provvigioni_ricevute_count,
    COALESCE(SUM(commission_amount) FILTER (WHERE financial_status = 'provvigioni_ricevute'), 0) as provvigioni_ricevute_amount
  FROM practices
  WHERE user_id = ANY(allowed_user_ids);
END;
$$;

-- Step 6: Update hierarchical practices function to include new premium fields
DROP FUNCTION IF EXISTS get_hierarchical_practices(uuid, uuid);

CREATE OR REPLACE FUNCTION get_hierarchical_practices(
  requesting_user_id uuid,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  practice_number text,
  practice_type text,
  client_name text,
  premium_net numeric,
  premium_taxable numeric,
  premium_taxes numeric,
  premium_gross numeric,
  commission_percentage numeric,
  commission_amount numeric,
  financial_status text,
  payment_date date,
  commission_received_date date,
  created_at timestamptz,
  user_id uuid,
  user_full_name text,
  user_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT ur.role::text INTO user_role FROM user_roles ur WHERE ur.user_id = requesting_user_id;

  IF user_role = 'admin' THEN
    IF target_user_id IS NOT NULL THEN
      RETURN QUERY
      SELECT pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
             pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
             pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
             pr.payment_date, pr.commission_received_date, pr.created_at,
             pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      WHERE pr.user_id = target_user_id
      ORDER BY pr.created_at DESC;
    ELSE
      RETURN QUERY
      SELECT pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
             pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
             pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
             pr.payment_date, pr.commission_received_date, pr.created_at,
             pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      ORDER BY pr.created_at DESC;
    END IF;
    RETURN;
  END IF;

  IF user_role = 'agente' THEN
    IF target_user_id IS NOT NULL THEN
      IF target_user_id = requesting_user_id OR 
         EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = target_user_id AND ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id) THEN
        RETURN QUERY
        SELECT pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
               pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
               pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
               pr.payment_date, pr.commission_received_date, pr.created_at,
               pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
        FROM practices pr
        JOIN profiles p ON p.id = pr.user_id
        JOIN user_roles ur ON ur.user_id = pr.user_id
        WHERE pr.user_id = target_user_id
        ORDER BY pr.created_at DESC;
      END IF;
    ELSE
      RETURN QUERY
      SELECT pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
             pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
             pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
             pr.payment_date, pr.commission_received_date, pr.created_at,
             pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      WHERE pr.user_id = requesting_user_id OR (ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id)
      ORDER BY pr.created_at DESC;
    END IF;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pr.id, pr.practice_number, pr.practice_type::text, pr.client_name,
         pr.premium_net, pr.premium_taxable, pr.premium_taxes, pr.premium_gross,
         pr.commission_percentage, pr.commission_amount, pr.financial_status::text,
         pr.payment_date, pr.commission_received_date, pr.created_at,
         pr.user_id, p.full_name as user_full_name, ur.role::text as user_role
  FROM practices pr
  JOIN profiles p ON p.id = pr.user_id
  JOIN user_roles ur ON ur.user_id = pr.user_id
  WHERE pr.user_id = requesting_user_id
  ORDER BY pr.created_at DESC;
END;
$$;

COMMENT ON COLUMN profiles.default_commission_percentage IS 'Percentuale provvigione predefinita - viene usata automaticamente quando l''utente crea una nuova pratica';
