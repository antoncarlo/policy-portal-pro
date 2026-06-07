-- VIES orchestrator runtime helpers: atomic claim, retry handling and batch counters.
-- Apply after 20260607_create_vies_batch_queue.sql.

ALTER TABLE public.vies_batches
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ready_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queued_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_worker_run_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_worker_message TEXT;

ALTER TABLE public.vies_jobs
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS agent_result JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vies_jobs_attempts_within_limit_check'
      AND conrelid = 'public.vies_jobs'::regclass
  ) THEN
    ALTER TABLE public.vies_jobs
      ADD CONSTRAINT vies_jobs_attempts_within_limit_check
      CHECK (attempts >= 0 AND max_attempts >= 1 AND attempts <= max_attempts + 1);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_vies_jobs_claimable
ON public.vies_jobs (status, next_attempt_at, priority DESC, created_at ASC)
WHERE status IN ('ready', 'queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_vies_jobs_batch_status
ON public.vies_jobs (batch_id, status);

CREATE OR REPLACE FUNCTION public.refresh_vies_batch_counters(p_batch_id UUID)
RETURNS public.vies_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_batch public.vies_batches;
BEGIN
  UPDATE public.vies_batches b
  SET
    ready_jobs = COALESCE(c.ready_jobs, 0),
    queued_jobs = COALESCE(c.queued_jobs, 0),
    processing_jobs = COALESCE(c.processing_jobs, 0),
    completed_jobs = COALESCE(c.completed_jobs, 0),
    failed_jobs = COALESCE(c.failed_jobs, 0),
    blocked_jobs = COALESCE(c.blocked_jobs, 0),
    cancelled_jobs = COALESCE(c.cancelled_jobs, 0),
    completed_at = CASE
      WHEN COALESCE(c.total_jobs, 0) > 0
       AND COALESCE(c.completed_jobs, 0) + COALESCE(c.failed_jobs, 0) + COALESCE(c.blocked_jobs, 0) + COALESCE(c.cancelled_jobs, 0) = COALESCE(c.total_jobs, 0)
      THEN COALESCE(b.completed_at, now())
      ELSE b.completed_at
    END,
    status = CASE
      WHEN b.status = 'cancelled' THEN b.status
      WHEN COALESCE(c.total_jobs, 0) = 0 THEN b.status
      WHEN COALESCE(c.processing_jobs, 0) > 0 THEN 'processing'
      WHEN COALESCE(c.queued_jobs, 0) > 0 OR COALESCE(c.ready_jobs, 0) > 0 THEN 'queued'
      WHEN COALESCE(c.failed_jobs, 0) > 0 OR COALESCE(c.blocked_jobs, 0) > 0 THEN 'completed_with_errors'
      WHEN COALESCE(c.completed_jobs, 0) = COALESCE(c.total_jobs, 0) THEN 'completed'
      ELSE b.status
    END,
    last_worker_run_at = now()
  FROM (
    SELECT
      batch_id,
      COUNT(*)::INTEGER AS total_jobs,
      COUNT(*) FILTER (WHERE status = 'ready')::INTEGER AS ready_jobs,
      COUNT(*) FILTER (WHERE status = 'queued')::INTEGER AS queued_jobs,
      COUNT(*) FILTER (WHERE status = 'processing')::INTEGER AS processing_jobs,
      COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed_jobs,
      COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_jobs,
      COUNT(*) FILTER (WHERE status = 'blocked')::INTEGER AS blocked_jobs,
      COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER AS cancelled_jobs
    FROM public.vies_jobs
    WHERE batch_id = p_batch_id
    GROUP BY batch_id
  ) c
  WHERE b.id = c.batch_id
  RETURNING b.* INTO v_batch;

  IF v_batch.id IS NULL THEN
    SELECT * INTO v_batch FROM public.vies_batches WHERE id = p_batch_id;
  END IF;

  RETURN v_batch;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_vies_batch(p_batch_id UUID)
RETURNS public.vies_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_batch public.vies_batches;
BEGIN
  UPDATE public.vies_jobs
  SET
    status = 'queued',
    locked_by = NULL,
    locked_at = NULL,
    assigned_agent = NULL,
    next_attempt_at = now(),
    last_error = NULL,
    error_code = NULL
  WHERE batch_id = p_batch_id
    AND status IN ('ready', 'failed')
    AND attempts < max_attempts;

  UPDATE public.vies_batches
  SET
    status = 'queued',
    queued_at = COALESCE(queued_at, now()),
    completed_at = NULL,
    last_worker_message = 'Batch accodato per elaborazione VIES.'
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  PERFORM public.refresh_vies_batch_counters(p_batch_id);
  SELECT * INTO v_batch FROM public.vies_batches WHERE id = p_batch_id;
  RETURN v_batch;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_vies_jobs(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 1,
  p_lock_timeout_minutes INTEGER DEFAULT 20
)
RETURNS SETOF public.vies_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.vies_jobs
    WHERE status IN ('queued', 'ready', 'failed')
      AND attempts < max_attempts
      AND next_attempt_at <= now()
      AND (
        locked_at IS NULL
        OR locked_at < now() - make_interval(mins => GREATEST(p_lock_timeout_minutes, 1))
      )
    ORDER BY priority DESC, created_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
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
$$;

CREATE OR REPLACE FUNCTION public.complete_vies_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_external_reference TEXT DEFAULT NULL,
  p_agent_result JSONB DEFAULT '{}'::jsonb
)
RETURNS public.vies_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_job public.vies_jobs;
BEGIN
  UPDATE public.vies_jobs
  SET
    status = 'completed',
    locked_by = NULL,
    locked_at = NULL,
    last_heartbeat_at = now(),
    external_reference = COALESCE(p_external_reference, external_reference),
    agent_result = COALESCE(p_agent_result, '{}'::jsonb),
    processed_at = now(),
    completed_at = now(),
    failed_at = NULL,
    last_error = NULL,
    error_code = NULL
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job % non trovato o non bloccato dal worker %', p_job_id, p_worker_id;
  END IF;

  PERFORM public.refresh_vies_batch_counters(v_job.batch_id);
  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_vies_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_retry_delay_seconds INTEGER DEFAULT 300,
  p_agent_result JSONB DEFAULT '{}'::jsonb
)
RETURNS public.vies_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_job public.vies_jobs;
  v_next_status TEXT;
BEGIN
  SELECT CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END
  INTO v_next_status
  FROM public.vies_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  UPDATE public.vies_jobs
  SET
    status = COALESCE(v_next_status, 'failed'),
    locked_by = NULL,
    locked_at = NULL,
    last_heartbeat_at = now(),
    next_attempt_at = CASE
      WHEN COALESCE(v_next_status, 'failed') = 'queued'
      THEN now() + make_interval(secs => GREATEST(p_retry_delay_seconds, 0))
      ELSE next_attempt_at
    END,
    last_error = LEFT(COALESCE(p_error_message, 'Errore non specificato'), 2000),
    error_code = p_error_code,
    agent_result = COALESCE(p_agent_result, '{}'::jsonb),
    failed_at = CASE WHEN COALESCE(v_next_status, 'failed') = 'failed' THEN now() ELSE failed_at END
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_by = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job % non trovato o non bloccato dal worker %', p_job_id, p_worker_id;
  END IF;

  PERFORM public.refresh_vies_batch_counters(v_job.batch_id);
  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_vies_job(
  p_job_id UUID,
  p_reason TEXT,
  p_error_code TEXT DEFAULT 'BLOCKED_VALIDATION'
)
RETURNS public.vies_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_job public.vies_jobs;
BEGIN
  UPDATE public.vies_jobs
  SET
    status = 'blocked',
    locked_by = NULL,
    locked_at = NULL,
    last_error = LEFT(COALESCE(p_reason, 'Job bloccato'), 2000),
    error_code = p_error_code,
    failed_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF v_job.id IS NOT NULL THEN
    PERFORM public.refresh_vies_batch_counters(v_job.batch_id);
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_vies_job(p_job_id UUID)
RETURNS public.vies_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    AND status IN ('failed', 'blocked')
  RETURNING * INTO v_job;

  IF v_job.id IS NOT NULL THEN
    PERFORM public.refresh_vies_batch_counters(v_job.batch_id);
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_vies_batch(p_batch_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS public.vies_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_batch public.vies_batches;
BEGIN
  UPDATE public.vies_jobs
  SET
    status = 'cancelled',
    locked_by = NULL,
    locked_at = NULL,
    last_error = COALESCE(p_reason, last_error)
  WHERE batch_id = p_batch_id
    AND status IN ('pending_validation', 'ready', 'queued', 'processing', 'failed', 'blocked');

  UPDATE public.vies_batches
  SET
    status = 'cancelled',
    completed_at = now(),
    last_worker_message = COALESCE(p_reason, 'Batch annullato manualmente.')
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  PERFORM public.refresh_vies_batch_counters(p_batch_id);
  SELECT * INTO v_batch FROM public.vies_batches WHERE id = p_batch_id;
  RETURN v_batch;
END;
$$;
