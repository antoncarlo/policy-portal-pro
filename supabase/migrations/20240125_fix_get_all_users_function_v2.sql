-- Fix function to get all users with their details (correct column name and type cast)
DROP FUNCTION IF EXISTS get_all_users_with_details();

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
    ur.role::text,
    agent_profile.full_name as agent_name,
    COALESCE(practice_counts.count, 0) as practice_count
  FROM profiles p
  INNER JOIN user_roles ur ON p.id = ur.user_id
  LEFT JOIN user_roles agent_role ON ur.parent_agent_id = agent_role.user_id
  LEFT JOIN profiles agent_profile ON agent_role.user_id = agent_profile.id
  LEFT JOIN (
    SELECT 
      pr.user_id,
      COUNT(*) as count
    FROM practices pr
    GROUP BY pr.user_id
  ) practice_counts ON p.id = practice_counts.user_id
  ORDER BY 
    CASE ur.role::text
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

COMMENT ON FUNCTION get_all_users_with_details() IS 'Returns all users with their role, agent assignment, and practice count (FIXED: uses user_id and casts app_role to text)';
