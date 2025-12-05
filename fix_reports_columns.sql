-- Fix: Corregge i nomi delle colonne nelle funzioni production reports
-- annual_premium → premium_gross
-- agent_commission → commission_amount

-- 1. Fix get_production_stats
DROP FUNCTION IF EXISTS public.get_production_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID);

CREATE OR REPLACE FUNCTION public.get_production_stats(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_practices BIGINT,
  total_premium NUMERIC,
  total_commission NUMERIC,
  avg_premium NUMERIC,
  practices_by_type JSONB,
  practices_by_status JSONB,
  practices_by_month JSONB,
  top_agents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_practices_by_type JSONB;
  v_practices_by_status JSONB;
  v_practices_by_month JSONB;
  v_top_agents JSONB;
BEGIN
  SELECT jsonb_object_agg(practice_type, count)
  INTO v_practices_by_type
  FROM (
    SELECT 
      practice_type,
      COUNT(*)::INTEGER AS count
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR user_id = p_agent_id)
    GROUP BY practice_type
    ORDER BY count DESC
  ) sub;

  SELECT jsonb_object_agg(status, count)
  INTO v_practices_by_status
  FROM (
    SELECT 
      status,
      COUNT(*)::INTEGER AS count
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR user_id = p_agent_id)
    GROUP BY status
    ORDER BY count DESC
  ) sub;

  SELECT jsonb_agg(month_data ORDER BY month)
  INTO v_practices_by_month
  FROM (
    SELECT 
      DATE_TRUNC('month', created_at) AS month,
      COUNT(*)::INTEGER AS practices,
      COALESCE(SUM(premium_gross), 0) AS premium
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR user_id = p_agent_id)
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
  ) month_data;

  SELECT jsonb_agg(agent_data ORDER BY total_premium DESC)
  INTO v_top_agents
  FROM (
    SELECT 
      user_id AS agent_id,
      COUNT(*)::INTEGER AS practices,
      COALESCE(SUM(premium_gross), 0) AS total_premium,
      COALESCE(SUM(commission_amount), 0) AS total_commission
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR user_id = p_agent_id)
    GROUP BY user_id
    ORDER BY COALESCE(SUM(premium_gross), 0) DESC
    LIMIT 10
  ) agent_data;

  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    COALESCE(SUM(premium_gross), 0),
    COALESCE(SUM(commission_amount), 0),
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(premium_gross), 0) / COUNT(*) ELSE 0 END,
    COALESCE(v_practices_by_type, '{}'::JSONB),
    COALESCE(v_practices_by_status, '{}'::JSONB),
    COALESCE(v_practices_by_month, '[]'::JSONB),
    COALESCE(v_top_agents, '[]'::JSONB)
  FROM public.practices
  WHERE created_at BETWEEN p_start_date AND p_end_date
  AND (p_agent_id IS NULL OR user_id = p_agent_id);
END;
$$;

-- 2. Fix get_production_details
DROP FUNCTION IF EXISTS public.get_production_details(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.get_production_details(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL,
  p_practice_type VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  practice_number TEXT,
  practice_type TEXT,
  client_name TEXT,
  policy_number TEXT,
  policy_start_date DATE,
  policy_end_date DATE,
  premium_gross NUMERIC,
  commission_amount NUMERIC,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.practice_number,
    p.practice_type::TEXT,
    p.client_name,
    p.policy_number,
    p.policy_start_date,
    p.policy_end_date,
    p.premium_gross,
    p.commission_amount,
    p.status::TEXT,
    p.created_at
  FROM public.practices p
  WHERE p.created_at BETWEEN p_start_date AND p_end_date
  AND (p_agent_id IS NULL OR p.user_id = p_agent_id)
  AND (p_practice_type IS NULL OR p.practice_type::TEXT = p_practice_type)
  AND (p_status IS NULL OR p.status::TEXT = p_status)
  ORDER BY p.created_at DESC;
END;
$$;

-- 3. Fix get_dashboard_kpis
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(VARCHAR);

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_period VARCHAR DEFAULT 'month'
)
RETURNS TABLE (
  current_period_practices BIGINT,
  current_period_premium NUMERIC,
  current_period_commission NUMERIC,
  previous_period_practices BIGINT,
  previous_period_premium NUMERIC,
  previous_period_commission NUMERIC,
  growth_practices NUMERIC,
  growth_premium NUMERIC,
  growth_commission NUMERIC,
  avg_premium NUMERIC,
  conversion_rate NUMERIC,
  active_agents BIGINT,
  expiring_soon BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_start TIMESTAMP WITH TIME ZONE;
  v_current_end TIMESTAMP WITH TIME ZONE;
  v_previous_start TIMESTAMP WITH TIME ZONE;
  v_previous_end TIMESTAMP WITH TIME ZONE;
  v_current_practices BIGINT;
  v_current_premium NUMERIC;
  v_current_commission NUMERIC;
  v_previous_practices BIGINT;
  v_previous_premium NUMERIC;
  v_previous_commission NUMERIC;
BEGIN
  CASE p_period
    WHEN 'week' THEN
      v_current_start := DATE_TRUNC('week', NOW());
      v_current_end := NOW();
      v_previous_start := v_current_start - INTERVAL '1 week';
      v_previous_end := v_current_start;
    WHEN 'quarter' THEN
      v_current_start := DATE_TRUNC('quarter', NOW());
      v_current_end := NOW();
      v_previous_start := v_current_start - INTERVAL '3 months';
      v_previous_end := v_current_start;
    WHEN 'year' THEN
      v_current_start := DATE_TRUNC('year', NOW());
      v_current_end := NOW();
      v_previous_start := v_current_start - INTERVAL '1 year';
      v_previous_end := v_current_start;
    ELSE
      v_current_start := DATE_TRUNC('month', NOW());
      v_current_end := NOW();
      v_previous_start := v_current_start - INTERVAL '1 month';
      v_previous_end := v_current_start;
  END CASE;

  SELECT 
    COUNT(*),
    COALESCE(SUM(premium_gross), 0),
    COALESCE(SUM(commission_amount), 0)
  INTO v_current_practices, v_current_premium, v_current_commission
  FROM public.practices
  WHERE created_at BETWEEN v_current_start AND v_current_end;

  SELECT 
    COUNT(*),
    COALESCE(SUM(premium_gross), 0),
    COALESCE(SUM(commission_amount), 0)
  INTO v_previous_practices, v_previous_premium, v_previous_commission
  FROM public.practices
  WHERE created_at BETWEEN v_previous_start AND v_previous_end;

  RETURN QUERY
  SELECT 
    v_current_practices,
    v_current_premium,
    v_current_commission,
    v_previous_practices,
    v_previous_premium,
    v_previous_commission,
    CASE WHEN v_previous_practices > 0 THEN ((v_current_practices::NUMERIC - v_previous_practices) / v_previous_practices * 100) ELSE 0 END,
    CASE WHEN v_previous_premium > 0 THEN ((v_current_premium - v_previous_premium) / v_previous_premium * 100) ELSE 0 END,
    CASE WHEN v_previous_commission > 0 THEN ((v_current_commission - v_previous_commission) / v_previous_commission * 100) ELSE 0 END,
    CASE WHEN v_current_practices > 0 THEN v_current_premium / v_current_practices ELSE 0 END,
    CASE WHEN v_current_practices > 0 THEN (SELECT COUNT(*)::NUMERIC FROM public.practices WHERE created_at BETWEEN v_current_start AND v_current_end AND status = 'active') / v_current_practices * 100 ELSE 0 END,
    (SELECT COUNT(DISTINCT user_id) FROM public.practices WHERE created_at BETWEEN v_current_start AND v_current_end),
    (SELECT COUNT(*) FROM public.practices WHERE policy_end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND status != 'cancelled');
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_production_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_production_details(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(VARCHAR) TO authenticated, service_role;
