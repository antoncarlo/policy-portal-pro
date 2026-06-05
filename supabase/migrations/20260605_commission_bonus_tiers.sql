-- Add configurable production bonus tiers for agent/collaborator commissions
-- Base commission remains profiles.default_commission_percentage.
-- Bonus tiers are JSON objects: { "threshold": 50000, "bonus_percentage": 1, "label": "Oltre 50k" }

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS commission_bonus_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.commission_bonus_tiers IS
  'Scaglioni premio produzione per utente. Array JSON: [{"threshold":50000,"bonus_percentage":1,"label":"Oltre 50k"}]. La percentuale bonus si somma alla provvigione base.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_commission_bonus_tiers_is_array'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_commission_bonus_tiers_is_array
    CHECK (jsonb_typeof(commission_bonus_tiers) = 'array');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_effective_commission_percentage(
  p_user_id uuid,
  p_current_premium numeric DEFAULT 0,
  p_reference_date timestamptz DEFAULT now(),
  p_exclude_practice_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_percentage numeric := 0;
  total_production numeric := 0;
  bonus_percentage numeric := 0;
BEGIN
  SELECT COALESCE(pr.default_commission_percentage, 0)
  INTO base_percentage
  FROM public.profiles pr
  WHERE pr.id = p_user_id;

  SELECT COALESCE(SUM(pa.premium_net), 0)
  INTO total_production
  FROM public.practices pa
  WHERE pa.user_id = p_user_id
    AND pa.premium_net IS NOT NULL
    AND date_trunc('year', pa.created_at) = date_trunc('year', COALESCE(p_reference_date, now()))
    AND (p_exclude_practice_id IS NULL OR pa.id <> p_exclude_practice_id);

  total_production := total_production + COALESCE(p_current_premium, 0);

  SELECT COALESCE(SUM(
    CASE
      WHEN total_production >= COALESCE((tier.value->>'threshold')::numeric, 0)
      THEN COALESCE((tier.value->>'bonus_percentage')::numeric, 0)
      ELSE 0
    END
  ), 0)
  INTO bonus_percentage
  FROM public.profiles pr
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pr.commission_bonus_tiers, '[]'::jsonb)) AS tier(value)
  WHERE pr.id = p_user_id
    AND jsonb_typeof(tier.value) = 'object'
    AND (tier.value ? 'threshold')
    AND (tier.value ? 'bonus_percentage');

  RETURN ROUND((COALESCE(base_percentage, 0) + COALESCE(bonus_percentage, 0))::numeric, 2);
END;
$$;

COMMENT ON FUNCTION public.get_effective_commission_percentage(uuid, numeric, timestamptz, uuid) IS
  'Calcola la provvigione effettiva: provvigione base utente + bonus maturati su produzione annua cumulata.';

DROP TRIGGER IF EXISTS trigger_calculate_commission ON public.practices;
DROP FUNCTION IF EXISTS public.calculate_commission();

CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On insert and when the economic base changes, derive the effective commission from the user profile rules.
  IF NEW.premium_net IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR NEW.commission_percentage IS NULL
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.premium_net IS DISTINCT FROM OLD.premium_net
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      NEW.commission_percentage := public.get_effective_commission_percentage(
        NEW.user_id,
        NEW.premium_net,
        COALESCE(NEW.created_at, now()),
        NEW.id
      );
    END IF;

    IF NEW.commission_percentage IS NOT NULL THEN
      NEW.commission_amount := ROUND((NEW.premium_net * NEW.commission_percentage / 100)::numeric, 2);
    END IF;
  END IF;

  IF NEW.premium_taxable IS NOT NULL AND NEW.premium_taxes IS NOT NULL AND NEW.premium_gross IS NULL THEN
    NEW.premium_gross := NEW.premium_taxable + NEW.premium_taxes;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF premium_net, premium_taxable, premium_taxes, premium_gross, commission_percentage, user_id, created_at
  ON public.practices
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_commission();

DROP FUNCTION IF EXISTS public.get_all_users_with_details();

CREATE OR REPLACE FUNCTION public.get_all_users_with_details()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text,
  agent_name text,
  practice_count bigint,
  default_commission_percentage numeric,
  commission_bonus_tiers jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    ur.role::text AS role,
    parent_profile.full_name AS agent_name,
    COALESCE(pc.practice_count, 0)::bigint AS practice_count,
    COALESCE(p.default_commission_percentage, 0)::numeric AS default_commission_percentage,
    COALESCE(p.commission_bonus_tiers, '[]'::jsonb) AS commission_bonus_tiers
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.profiles parent_profile ON parent_profile.id = ur.parent_agent_id
  LEFT JOIN (
    SELECT user_id, COUNT(*)::bigint AS practice_count
    FROM public.practices
    GROUP BY user_id
  ) pc ON pc.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_commission_percentage(uuid, numeric, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_with_details() TO authenticated;
