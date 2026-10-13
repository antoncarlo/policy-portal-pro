-- Add hierarchical financial functions for Admin/Agent/Collaborator roles

-- Function to get user IDs based on hierarchical role
CREATE OR REPLACE FUNCTION get_hierarchical_user_ids(requesting_user_id uuid)
RETURNS TABLE (user_id uuid, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the role of the requesting user
  SELECT ur.role::text INTO user_role
  FROM user_roles ur
  WHERE ur.user_id = requesting_user_id;

  -- If admin, return all users
  IF user_role = 'admin' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.full_name,
      ur.role::text
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    ORDER BY ur.role::text, p.full_name;
    RETURN;
  END IF;

  -- If agente, return self + collaborators
  IF user_role = 'agente' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.full_name,
      ur.role::text
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = requesting_user_id
       OR (ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id)
    ORDER BY ur.role::text, p.full_name;
    RETURN;
  END IF;

  -- If collaboratore or other, return only self
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    ur.role::text
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = requesting_user_id;
END;
$$;

-- Enhanced financial summary with hierarchical support
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
    -- Admin can see all users
    IF target_user_id IS NOT NULL THEN
      allowed_user_ids := ARRAY[target_user_id];
    ELSE
      -- Get all user IDs
      SELECT ARRAY_AGG(p.id) INTO allowed_user_ids
      FROM profiles p;
    END IF;
  ELSIF user_role = 'agente' THEN
    -- Agent can see self + collaborators
    IF target_user_id IS NOT NULL THEN
      -- Check if target is self or a collaborator
      IF target_user_id = requesting_user_id OR 
         EXISTS (
           SELECT 1 FROM user_roles ur 
           WHERE ur.user_id = target_user_id 
             AND ur.role = 'collaboratore' 
             AND ur.parent_agent_id = requesting_user_id
         ) THEN
        allowed_user_ids := ARRAY[target_user_id];
      ELSE
        -- Not authorized
        allowed_user_ids := ARRAY[]::uuid[];
      END IF;
    ELSE
      -- Get self + all collaborators
      SELECT ARRAY_AGG(ur.user_id) INTO allowed_user_ids
      FROM user_roles ur
      WHERE ur.user_id = requesting_user_id
         OR (ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id);
    END IF;
  ELSE
    -- Collaborator can only see self
    allowed_user_ids := ARRAY[requesting_user_id];
  END IF;

  -- Return aggregated financial data for allowed users
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
  WHERE user_id = ANY(allowed_user_ids);
END;
$$;

-- Function to get practices with user info for hierarchical view
CREATE OR REPLACE FUNCTION get_hierarchical_practices(
  requesting_user_id uuid,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  practice_number text,
  practice_type text,
  client_name text,
  premium_amount numeric,
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
  -- Get the role of the requesting user
  SELECT ur.role::text INTO user_role
  FROM user_roles ur
  WHERE ur.user_id = requesting_user_id;

  -- Admin can see all practices
  IF user_role = 'admin' THEN
    IF target_user_id IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        pr.id,
        pr.practice_number,
        pr.practice_type::text,
        pr.client_name,
        pr.premium_amount,
        pr.commission_percentage,
        pr.commission_amount,
        pr.financial_status::text,
        pr.payment_date,
        pr.commission_received_date,
        pr.created_at,
        pr.user_id,
        p.full_name as user_full_name,
        ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      WHERE pr.user_id = target_user_id
      ORDER BY pr.created_at DESC;
    ELSE
      RETURN QUERY
      SELECT 
        pr.id,
        pr.practice_number,
        pr.practice_type::text,
        pr.client_name,
        pr.premium_amount,
        pr.commission_percentage,
        pr.commission_amount,
        pr.financial_status::text,
        pr.payment_date,
        pr.commission_received_date,
        pr.created_at,
        pr.user_id,
        p.full_name as user_full_name,
        ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      ORDER BY pr.created_at DESC;
    END IF;
    RETURN;
  END IF;

  -- Agent can see own + collaborators' practices
  IF user_role = 'agente' THEN
    IF target_user_id IS NOT NULL THEN
      -- Check authorization
      IF target_user_id = requesting_user_id OR 
         EXISTS (
           SELECT 1 FROM user_roles ur 
           WHERE ur.user_id = target_user_id 
             AND ur.role = 'collaboratore' 
             AND ur.parent_agent_id = requesting_user_id
         ) THEN
        RETURN QUERY
        SELECT 
          pr.id,
          pr.practice_number,
          pr.practice_type::text,
          pr.client_name,
          pr.premium_amount,
          pr.commission_percentage,
          pr.commission_amount,
          pr.financial_status::text,
          pr.payment_date,
          pr.commission_received_date,
          pr.created_at,
          pr.user_id,
          p.full_name as user_full_name,
          ur.role::text as user_role
        FROM practices pr
        JOIN profiles p ON p.id = pr.user_id
        JOIN user_roles ur ON ur.user_id = pr.user_id
        WHERE pr.user_id = target_user_id
        ORDER BY pr.created_at DESC;
      END IF;
    ELSE
      RETURN QUERY
      SELECT 
        pr.id,
        pr.practice_number,
        pr.practice_type::text,
        pr.client_name,
        pr.premium_amount,
        pr.commission_percentage,
        pr.commission_amount,
        pr.financial_status::text,
        pr.payment_date,
        pr.commission_received_date,
        pr.created_at,
        pr.user_id,
        p.full_name as user_full_name,
        ur.role::text as user_role
      FROM practices pr
      JOIN profiles p ON p.id = pr.user_id
      JOIN user_roles ur ON ur.user_id = pr.user_id
      WHERE pr.user_id = requesting_user_id
         OR (ur.role = 'collaboratore' AND ur.parent_agent_id = requesting_user_id)
      ORDER BY pr.created_at DESC;
    END IF;
    RETURN;
  END IF;

  -- Collaborator can only see own practices
  RETURN QUERY
  SELECT 
    pr.id,
    pr.practice_number,
    pr.practice_type::text,
    pr.client_name,
    pr.premium_amount,
    pr.commission_percentage,
    pr.commission_amount,
    pr.financial_status::text,
    pr.payment_date,
    pr.commission_received_date,
    pr.created_at,
    pr.user_id,
    p.full_name as user_full_name,
    ur.role::text as user_role
  FROM practices pr
  JOIN profiles p ON p.id = pr.user_id
  JOIN user_roles ur ON ur.user_id = pr.user_id
  WHERE pr.user_id = requesting_user_id
  ORDER BY pr.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_hierarchical_user_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hierarchical_financial_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hierarchical_practices(uuid, uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_hierarchical_user_ids(uuid) IS 'Returns user IDs accessible by the requesting user based on role hierarchy';
COMMENT ON FUNCTION get_hierarchical_financial_summary(uuid, uuid) IS 'Returns financial summary with hierarchical access control';
COMMENT ON FUNCTION get_hierarchical_practices(uuid, uuid) IS 'Returns practices with user info respecting hierarchical permissions';
