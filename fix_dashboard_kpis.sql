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
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(VARCHAR) TO authenticated, service_role;

-- Commento
COMMENT ON FUNCTION public.get_dashboard_kpis IS 'Ottiene KPI dashboard con confronto periodo precedente e growth rate';
