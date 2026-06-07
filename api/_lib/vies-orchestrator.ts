import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const VIES_WORKER_SECRET = process.env.VIES_WORKER_SECRET;

export type ViesJob = {
  id: string;
  batch_id: string;
  user_id: string;
  row_number: number;
  progressivo: string | null;
  contraente: string | null;
  indirizzo_rappresentante_fiscale: string | null;
  partita_iva_contraente: string | null;
  beneficiario: string | null;
  indirizzo_beneficiario: string | null;
  partita_iva_beneficiario: string | null;
  pec: string | null;
  pagamento: string | null;
  documenti_indicati: string | null;
  raw_payload: Record<string, unknown>;
  validation_errors: unknown[];
  status: string;
  attempts: number;
  max_attempts: number;
};

export type ViesAgentResult = {
  success: boolean;
  externalReference?: string;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
};

export type ProcessRunSummary = {
  workerId: string;
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ jobId?: string; message: string }>;
};

export function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configurazione Supabase mancante: impostare VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function verifyCronOrWorkerAuth(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron']) return true;

  const authHeader = req.headers.authorization;
  const acceptedSecrets = [VIES_WORKER_SECRET, CRON_SECRET].filter(Boolean);
  return acceptedSecrets.some((secret) => authHeader === `Bearer ${secret}`);
}

export async function resolveUserFromRequest(req: VercelRequest, supabase = getSupabaseAdmin()): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Token utente mancante. Effettuare il login e riprovare.');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Sessione non valida o scaduta. Effettuare nuovamente il login.');
  }

  return data.user.id;
}

export function sendMethodNotAllowed(res: VercelResponse, allowed: string): void {
  res.setHeader('Allow', allowed);
  res.status(405).json({ error: `Metodo non consentito. Utilizzare ${allowed}.` });
}

export async function assertBatchAccess(
  supabase: SupabaseClient,
  batchId: string,
  userId: string,
): Promise<void> {
  const { data: batch, error } = await supabase
    .from('vies_batches')
    .select('id, user_id')
    .eq('id', batchId)
    .maybeSingle();

  if (error) throw new Error(`Errore verifica batch VIES: ${error.message}`);
  if (!batch) throw new Error('Batch VIES non trovato.');
  if (batch.user_id !== userId) throw new Error('Accesso negato al batch VIES richiesto.');
}

export async function assertJobAccess(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<string> {
  const { data: job, error } = await supabase
    .from('vies_jobs')
    .select('id, batch_id, user_id')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw new Error(`Errore verifica job VIES: ${error.message}`);
  if (!job) throw new Error('Job VIES non trovato.');
  if (job.user_id !== userId) throw new Error('Accesso negato al job VIES richiesto.');
  return job.batch_id as string;
}

export async function processViesQueue(options: {
  limit?: number;
  workerId?: string;
  lockTimeoutMinutes?: number;
} = {}): Promise<ProcessRunSummary> {
  const supabase = getSupabaseAdmin();
  const workerId = options.workerId ?? `vies-worker-${Date.now()}`;
  const limit = Math.max(1, Math.min(options.limit ?? 5, 25));
  const lockTimeoutMinutes = Math.max(1, options.lockTimeoutMinutes ?? 20);

  const summary: ProcessRunSummary = {
    workerId,
    claimed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const { data: jobs, error: claimError } = await supabase.rpc('claim_vies_jobs', {
    p_worker_id: workerId,
    p_limit: limit,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  });

  if (claimError) {
    throw new Error(`Claim job VIES fallito: ${claimError.message}`);
  }

  const claimedJobs = (jobs ?? []) as ViesJob[];
  summary.claimed = claimedJobs.length;

  for (const job of claimedJobs) {
    try {
      const result = await executeViesAgent(job);

      if (result.success) {
        const { error: completeError } = await supabase.rpc('complete_vies_job', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_external_reference: result.externalReference ?? null,
          p_agent_result: result.details ?? {},
        });

        if (completeError) throw new Error(`Completamento job fallito: ${completeError.message}`);
        summary.completed += 1;
        continue;
      }

      const retryDelaySeconds = result.retryable === false ? 0 : computeRetryDelaySeconds(job.attempts);
      const { error: failError } = await supabase.rpc('fail_vies_job', {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error_message: result.errorMessage ?? 'Elaborazione VIES non completata.',
        p_error_code: result.errorCode ?? 'VIES_AGENT_ERROR',
        p_retry_delay_seconds: retryDelaySeconds,
        p_agent_result: result.details ?? {},
      });

      if (failError) throw new Error(`Aggiornamento errore job fallito: ${failError.message}`);
      summary.failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto nel worker VIES.';
      summary.errors.push({ jobId: job.id, message });

      await supabase.rpc('fail_vies_job', {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error_message: message,
        p_error_code: 'WORKER_EXCEPTION',
        p_retry_delay_seconds: computeRetryDelaySeconds(job.attempts),
        p_agent_result: { exception: true },
      });
      summary.failed += 1;
    }
  }

  return summary;
}

function computeRetryDelaySeconds(attempts: number): number {
  const baseSeconds = 5 * 60;
  const cappedAttempt = Math.max(0, Math.min(attempts, 5));
  return baseSeconds * 2 ** cappedAttempt;
}

async function executeViesAgent(job: ViesJob): Promise<ViesAgentResult> {
  const dryRun = process.env.VIES_AGENT_DRY_RUN === 'true';
  const portalApiUrl = process.env.VIES_PORTAL_API_URL;
  const portalApiKey = process.env.VIES_PORTAL_API_KEY;

  if (dryRun) {
    return {
      success: true,
      externalReference: `dry-run-${job.id}`,
      details: {
        mode: 'dry_run',
        message: 'Job marcato come completato in modalità simulazione controllata.',
        row_number: job.row_number,
        progressivo: job.progressivo,
      },
    };
  }

  if (!portalApiUrl || !portalApiKey) {
    return {
      success: false,
      retryable: false,
      errorCode: 'VIES_PORTAL_NOT_CONFIGURED',
      errorMessage: 'Adapter portale VIES non configurato. Impostare VIES_PORTAL_API_URL/VIES_PORTAL_API_KEY o VIES_AGENT_DRY_RUN=true per test controllati.',
      details: { missing: ['VIES_PORTAL_API_URL', 'VIES_PORTAL_API_KEY'] },
    };
  }

  const response = await fetch(portalApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${portalApiKey}`,
    },
    body: JSON.stringify({
      job_id: job.id,
      batch_id: job.batch_id,
      row_number: job.row_number,
      progressivo: job.progressivo,
      contraente: job.contraente,
      indirizzo_rappresentante_fiscale: job.indirizzo_rappresentante_fiscale,
      partita_iva_contraente: job.partita_iva_contraente,
      beneficiario: job.beneficiario,
      indirizzo_beneficiario: job.indirizzo_beneficiario,
      partita_iva_beneficiario: job.partita_iva_beneficiario,
      pec: job.pec,
      pagamento: job.pagamento,
      documenti_indicati: job.documenti_indicati,
      raw_payload: job.raw_payload,
    }),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    return {
      success: false,
      retryable: response.status >= 500 || response.status === 429,
      errorCode: `PORTAL_HTTP_${response.status}`,
      errorMessage: typeof payload?.error === 'string' ? payload.error : `Portale VIES ha risposto con HTTP ${response.status}.`,
      details: { status: response.status, payload: payload ?? null },
    };
  }

  return {
    success: true,
    externalReference: typeof payload?.external_reference === 'string' ? payload.external_reference : undefined,
    details: { portal_response: payload ?? null },
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
