-- VIES: invio solo verso un portale scelto dall'operatore, e funzioni di coda
-- non più eseguibili dal browser.
--
-- 1. vies_batches.target_portal: il portale esterno scelto per il lotto. Il
--    worker prende in carico solo i job dei lotti con un portale scelto, così
--    nessuna pratica parte da sola quando un collegamento viene attivato.
-- 2. retry_vies_job rimette in coda solo i job falliti in invio: un job bloccato
--    da documenti mancanti o di un'altra società resta bloccato.
-- 3. Le funzioni SECURITY DEFINER della coda erano eseguibili da anon e
--    authenticated senza controllo del proprietario: ora solo dal service role
--    (le API del portale le chiamano già con il service role).

ALTER TABLE public.vies_batches ADD COLUMN IF NOT EXISTS target_portal text;

CREATE OR REPLACE FUNCTION public.claim_vies_jobs(p_worker_id text, p_limit integer DEFAULT 1, p_lock_timeout_minutes integer DEFAULT 20)
 RETURNS SETOF vies_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch_id UUID;
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.vies_jobs j
    JOIN public.vies_batches b ON b.id = j.batch_id
    WHERE j.status IN ('queued', 'ready', 'failed')
      AND b.target_portal IS NOT NULL
      AND j.attempts < j.max_attempts
      AND j.next_attempt_at <= now()
      AND (
        j.locked_at IS NULL
        OR j.locked_at < now() - make_interval(mins => GREATEST(p_lock_timeout_minutes, 1))
      )
    ORDER BY j.priority DESC, j.created_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE OF j SKIP LOCKED
  ), claimed AS (
    UPDATE public.vies_jobs j
    SET
      status = 'processing',
      locked_by = p_worker_id,
      assigned_agent = p_worker_id,
      locked_at = now(),
      processing_started_at = COALESCE(j.processing_started_at, now()),
      last_heartbeat_at = now(),
      attempts = j.attempts + 1,
      last_error = NULL,
      error_code = NULL
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT * FROM claimed;

  UPDATE public.vies_batches b
  SET
    status = 'processing',
    processing_started_at = COALESCE(processing_started_at, now()),
    last_worker_run_at = now(),
    last_worker_message = 'Uno o più job sono stati presi in carico dal worker VIES.'
  WHERE EXISTS (
    SELECT 1 FROM public.vies_jobs j
    WHERE j.batch_id = b.id AND j.locked_by = p_worker_id AND j.status = 'processing'
  );

  FOR v_batch_id IN
    SELECT DISTINCT batch_id
    FROM public.vies_jobs
    WHERE locked_by = p_worker_id
      AND status = 'processing'
  LOOP
    PERFORM public.refresh_vies_batch_counters(v_batch_id);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_vies_job(p_job_id uuid)
 RETURNS vies_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.vies_jobs;
BEGIN
  UPDATE public.vies_jobs
  SET
    status = 'queued',
    locked_by = NULL,
    locked_at = NULL,
    next_attempt_at = now(),
    failed_at = NULL,
    last_error = NULL,
    error_code = NULL
  WHERE id = p_job_id
    AND status = 'failed'
  RETURNING * INTO v_job;

  IF v_job.id IS NOT NULL THEN
    PERFORM public.refresh_vies_batch_counters(v_job.batch_id);
  END IF;

  RETURN v_job;
END;
$function$;

DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.block_vies_job(uuid, text, text)',
    'public.cancel_vies_batch(uuid, text)',
    'public.claim_vies_jobs(text, integer, integer)',
    'public.complete_vies_job(uuid, text, text, jsonb)',
    'public.enqueue_vies_batch(uuid)',
    'public.fail_vies_job(uuid, text, text, text, integer, jsonb)',
    'public.refresh_vies_batch_counters(uuid)',
    'public.retry_vies_job(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END $$;
