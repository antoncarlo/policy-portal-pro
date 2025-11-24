-- Create function to get all users with their details
CREATE OR REPLACE FUNCTION get_all_users_with_details()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text,
  agent_name text,
  practice_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    COALESCE(p.phone, '') as phone,
    p.avatar_url,
    ur.role,
    agent_profile.full_name as agent_name,
    COALESCE(practice_counts.count, 0) as practice_count
  FROM profiles p
  INNER JOIN user_roles ur ON p.id = ur.user_id
  LEFT JOIN user_roles agent_role ON ur.parent_agent_id = agent_role.user_id
  LEFT JOIN profiles agent_profile ON agent_role.user_id = agent_profile.id
  LEFT JOIN (
    SELECT 
      CASE 
        WHEN ur2.role = 'admin' THEN pr.created_by
        WHEN ur2.role = 'agente' THEN pr.created_by
        WHEN ur2.role = 'collaboratore' THEN pr.created_by
      END as user_id,
      COUNT(*) as count
    FROM practices pr
    LEFT JOIN user_roles ur2 ON pr.created_by = ur2.user_id
    GROUP BY user_id
  ) practice_counts ON p.id = practice_counts.user_id
  ORDER BY 
    CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'agente' THEN 2
      WHEN 'collaboratore' THEN 3
      ELSE 4
    END,
    p.full_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_users_with_details() TO authenticated;

COMMENT ON FUNCTION get_all_users_with_details() IS 'Returns all users with their role, agent assignment, and practice count';
