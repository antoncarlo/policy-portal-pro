-- Production Reports Functions
-- Funzioni per generare report di produzione e analytics

-- Funzione per ottenere statistiche produzione per periodo
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
  -- Pratiche per tipo
  SELECT jsonb_object_agg(practice_type, count)
  INTO v_practices_by_type
  FROM (
    SELECT 
      practice_type,
      COUNT(*)::INTEGER AS count
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    GROUP BY practice_type
    ORDER BY count DESC
  ) sub;

  -- Pratiche per stato
  SELECT jsonb_object_agg(status, count)
  INTO v_practices_by_status
  FROM (
    SELECT 
      status,
      COUNT(*)::INTEGER AS count
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    GROUP BY status
    ORDER BY count DESC
  ) sub;

  -- Pratiche per mese
  SELECT jsonb_agg(jsonb_build_object(
    'month', month,
    'count', count,
    'premium', premium,
    'commission', commission
  ))
  INTO v_practices_by_month
  FROM (
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      COUNT(*)::INTEGER AS count,
      COALESCE(SUM(annual_premium), 0) AS premium,
      COALESCE(SUM(agent_commission), 0) AS commission
    FROM public.practices
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month
  ) sub;

  -- Top agenti (solo se non filtrato per agente)
  IF p_agent_id IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'agent_id', agent_id,
      'agent_name', agent_name,
      'practices_count', practices_count,
      'total_premium', total_premium,
      'total_commission', total_commission
    ))
    INTO v_top_agents
    FROM (
      SELECT 
        p.agent_id,
        u.full_name AS agent_name,
        COUNT(*)::INTEGER AS practices_count,
        COALESCE(SUM(p.annual_premium), 0) AS total_premium,
        COALESCE(SUM(p.agent_commission), 0) AS total_commission
      FROM public.practices p
      LEFT JOIN public.profiles u ON p.agent_id = u.id
      WHERE p.created_at BETWEEN p_start_date AND p_end_date
      GROUP BY p.agent_id, u.full_name
      ORDER BY practices_count DESC
      LIMIT 10
    ) sub;
  ELSE
    v_top_agents := '[]'::jsonb;
  END IF;

  -- Ritorna statistiche aggregate
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_practices,
    COALESCE(SUM(annual_premium), 0) AS total_premium,
    COALESCE(SUM(agent_commission), 0) AS total_commission,
    COALESCE(AVG(annual_premium), 0) AS avg_premium,
    COALESCE(v_practices_by_type, '{}'::jsonb) AS practices_by_type,
    COALESCE(v_practices_by_status, '{}'::jsonb) AS practices_by_status,
    COALESCE(v_practices_by_month, '[]'::jsonb) AS practices_by_month,
    COALESCE(v_top_agents, '[]'::jsonb) AS top_agents
  FROM public.practices
  WHERE created_at BETWEEN p_start_date AND p_end_date
  AND (p_agent_id IS NULL OR agent_id = p_agent_id);
END;
$$;

-- Funzione per ottenere dettaglio pratiche per report
CREATE OR REPLACE FUNCTION public.get_production_details(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_agent_id UUID DEFAULT NULL,
  p_practice_type VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  practice_id UUID,
  practice_number VARCHAR,
  practice_type VARCHAR,
  status VARCHAR,
  client_name VARCHAR,
  client_email VARCHAR,
  agent_name VARCHAR,
  company_name VARCHAR,
  annual_premium NUMERIC,
  agent_commission NUMERIC,
  policy_start_date TIMESTAMP WITH TIME ZONE,
  policy_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  payment_frequency VARCHAR,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS practice_id,
    p.practice_number,
    p.practice_type,
    p.status,
    COALESCE(c.name, p.client_name) AS client_name,
    COALESCE(c.email, p.client_email) AS client_email,
    u.full_name AS agent_name,
    p.company_name,
    p.annual_premium,
    p.agent_commission,
    p.policy_start_date,
    p.policy_end_date,
    p.created_at,
    p.payment_frequency,
    p.notes
  FROM public.practices p
  LEFT JOIN public.clients c ON p.client_id = c.id
  LEFT JOIN public.profiles u ON p.agent_id = u.id
  WHERE p.created_at BETWEEN p_start_date AND p_end_date
  AND (p_agent_id IS NULL OR p.agent_id = p.agent_id)
  AND (p_practice_type IS NULL OR p.practice_type = p_practice_type)
  AND (p_status IS NULL OR p.status = p_status)
  ORDER BY p.created_at DESC;
END;
$$;

-- Funzione per ottenere KPI dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_period VARCHAR DEFAULT 'month' -- 'week', 'month', 'quarter', 'year'
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
  -- Calcola periodi in base al parametro
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
    ELSE -- 'month' default
      v_current_start := DATE_TRUNC('month', NOW());
      v_current_end := NOW();
      v_previous_start := v_current_start - INTERVAL '1 month';
      v_previous_end := v_current_start;
  END CASE;

  -- Statistiche periodo corrente
  SELECT 
    COUNT(*),
    COALESCE(SUM(annual_premium), 0),
    COALESCE(SUM(agent_commission), 0)
  INTO v_current_practices, v_current_premium, v_current_commission
  FROM public.practices
  WHERE created_at BETWEEN v_current_start AND v_current_end;

  -- Statistiche periodo precedente
  SELECT 
    COUNT(*),
    COALESCE(SUM(annual_premium), 0),
    COALESCE(SUM(agent_commission), 0)
  INTO v_previous_practices, v_previous_premium, v_previous_commission
  FROM public.practices
  WHERE created_at BETWEEN v_previous_start AND v_previous_end;

  -- Ritorna KPI
  RETURN QUERY
  SELECT 
    v_current_practices AS current_period_practices,
    v_current_premium AS current_period_premium,
    v_current_commission AS current_period_commission,
    v_previous_practices AS previous_period_practices,
    v_previous_premium AS previous_period_premium,
    v_previous_commission AS previous_period_commission,
    CASE 
      WHEN v_previous_practices > 0 THEN 
        ((v_current_practices::NUMERIC - v_previous_practices) / v_previous_practices * 100)
      ELSE 0 
    END AS growth_practices,
    CASE 
      WHEN v_previous_premium > 0 THEN 
        ((v_current_premium - v_previous_premium) / v_previous_premium * 100)
      ELSE 0 
    END AS growth_premium,
    CASE 
      WHEN v_previous_commission > 0 THEN 
        ((v_current_commission - v_previous_commission) / v_previous_commission * 100)
      ELSE 0 
    END AS growth_commission,
    CASE 
      WHEN v_current_practices > 0 THEN v_current_premium / v_current_practices
      ELSE 0 
    END AS avg_premium,
    CASE 
      WHEN v_current_practices > 0 THEN 
        (SELECT COUNT(*)::NUMERIC FROM public.practices 
         WHERE created_at BETWEEN v_current_start AND v_current_end 
         AND status = 'active') / v_current_practices * 100
      ELSE 0 
    END AS conversion_rate,
    (SELECT COUNT(DISTINCT agent_id) FROM public.practices 
     WHERE created_at BETWEEN v_current_start AND v_current_end) AS active_agents,
    (SELECT COUNT(*) FROM public.practices 
     WHERE policy_end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
     AND status != 'cancelled') AS expiring_soon;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_production_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_production_details(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(VARCHAR) TO authenticated, service_role;

-- Commenti
COMMENT ON FUNCTION public.get_production_stats IS 'Ottiene statistiche aggregate di produzione per periodo con breakdown per tipo, stato, mese e top agenti';
COMMENT ON FUNCTION public.get_production_details IS 'Ottiene dettaglio pratiche per export report con filtri opzionali';
COMMENT ON FUNCTION public.get_dashboard_kpis IS 'Ottiene KPI dashboard con confronto periodo precedente e growth rate';
