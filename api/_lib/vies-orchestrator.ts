import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ControllerReport } from '../../src/lib/viesController.js';
import { runBatchController } from './vies-controller-data.js';
import { assertSecondFactor } from './mfa.js';
import { listSignedPracticeDocuments } from './vies-documents.js';
import { applyWorkflowEvent, WorkflowError } from './vies-workflow.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const VIES_WORKER_SECRET = process.env.VIES_WORKER_SECRET;

export type ViesJob = {
  id: string;
  batch_id: string;
  user_id: string;
  /** Id of the practice created for the row. */
  external_reference: string | null;
  row_number: number;
  progressivo: string | null;
  contraente: string | null;
  indirizzo_rappresentante_fiscale: string | null;
  partita_iva_contraente: string | null;
  beneficiario: string | null;
  indirizzo_beneficiario: string | null;
  partita_iva_beneficiario: string | null;
  pec_beneficiario: string | null;
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
  notice?: string;
};

export function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configurazione Supabase mancante: impostare VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; the x-vercel-cron header
// is not proof of anything, anyone can send it.
export function verifyCronOrWorkerAuth(req: VercelRequest): boolean {
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
  await assertSecondFactor(supabase, token, data.user.id);

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
  if (batch.user_id !== userId && !(await isAdmin(supabase, userId))) {
    throw new Error('Accesso negato al batch VIES richiesto.');
  }
}

// The agency's administrators work on every lot, including those uploaded by clients.
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) throw new Error(`Errore verifica ruolo: ${error.message}`);
  return Boolean(data);
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
  if (job.user_id !== userId && !(await isAdmin(supabase, userId))) {
    throw new Error('Accesso negato al job VIES richiesto.');
  }
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

  // The portal runs standalone until an external connection is configured:
  // queued jobs stay ready and are never marked completed by simulation.
  const portals = getConfiguredPortals();
  if (!portals.length) {
    summary.notice = 'Nessun portale esterno collegato: le pratiche restano pronte nel portale, nessun invio eseguito.';
    return summary;
  }

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

  // Destination chosen for each batch, and the final check, re-run right before
  // sending: a job is sent only if it passes it on the data saved now.
  const batchIds = [...new Set(claimedJobs.map((job) => job.batch_id))];
  const targetByBatch = new Map<string, string | null>();
  if (batchIds.length) {
    const { data: batches, error: batchesError } = await supabase.from('vies_batches').select('id, target_portal').in('id', batchIds);
    if (batchesError) throw new Error(`Lettura portale di destinazione non riuscita: ${batchesError.message}`);
    for (const batch of batches ?? []) targetByBatch.set(batch.id, batch.target_portal ?? null);
  }
  const reportByBatch = new Map<string, ControllerReport>();

  for (const job of claimedJobs) {
    try {
      const portal = portals.find((candidate) => candidate.id === targetByBatch.get(job.batch_id));
      if (!portal) {
        const { error: portalError } = await supabase.rpc('fail_vies_job', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_error_message: 'Il portale scelto per questo lotto non è collegato: sceglierne un altro e inviare di nuovo.',
          p_error_code: 'PORTAL_NOT_AVAILABLE',
          p_retry_delay_seconds: 3600,
          p_agent_result: { portal: targetByBatch.get(job.batch_id) ?? null },
        });
        if (portalError) throw new Error(`Aggiornamento errore job fallito: ${portalError.message}`);
        summary.failed += 1;
        continue;
      }

      if (!reportByBatch.has(job.batch_id)) reportByBatch.set(job.batch_id, await runBatchController(supabase, job.batch_id));
      const check = reportByBatch.get(job.batch_id)?.jobs.find((result) => result.jobId === job.id);
      if (!check || check.outcome !== 'ok') {
        const { error: blockError } = await supabase.rpc('block_vies_job', {
          p_job_id: job.id,
          p_reason: `Controllo finale non superato: ${(check?.errors ?? ['pratica non verificabile']).join('; ')}`,
          p_error_code: 'BLOCKED_FINAL_CHECK',
        });
        if (blockError) throw new Error(`Blocco job non riuscito: ${blockError.message}`);
        summary.skipped += 1;
        continue;
      }

      const result = await executeViesAgent(job, portal);

      if (result.success) {
        // external_reference holds the practice id that links the job to its
        // practice: the portal's own reference goes in agent_result instead.
        const { error: completeError } = await supabase.rpc('complete_vies_job', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_external_reference: null,
          p_agent_result: {
            ...(result.details ?? {}),
            portal_id: portal.id,
            portal_name: portal.name,
            portal_reference: result.externalReference ?? null,
          },
        });

        if (completeError) throw new Error(`Completamento job fallito: ${completeError.message}`);
        summary.completed += 1;

        // The practice moves to "in valutazione" and records where it went. The send itself is done:
        // if this step fails the job stays completed and the error is reported.
        if (job.external_reference) {
          try {
            await applyWorkflowEvent(
              supabase,
              job.external_reference,
              { type: 'sent', portalId: portal.id, portalName: portal.name, reference: result.externalReference ?? null },
              { actor: { label: 'Invio al portale' } },
            );
          } catch (workflowError) {
            const message = workflowError instanceof WorkflowError || workflowError instanceof Error ? workflowError.message : 'Errore sconosciuto';
            summary.errors.push({ jobId: job.id, message: `Pratica inviata ma non aggiornata nel flusso: ${message}` });
          }
        }
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

export type ViesPortal = {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  /** Shared secret the portal signs its callbacks with (HMAC-SHA256). Empty: callbacks are not accepted. */
  callbackSecret: string;
  /** Hosts, besides the portal's own, the portal may hand documents out from. */
  documentHosts: string[];
};

/** Public address of this portal, where external portals send their answers. */
export function getPublicBaseUrl(): string {
  return (process.env.PORTAL_URL?.trim() || 'https://portale.tecnomga.com').replace(/\/+$/, '');
}

/** Hosts a portal may fetch/hand out documents from: its own and the ones listed for it. */
export function portalDocumentHosts(portal: Pick<ViesPortal, 'url' | 'documentHosts'>): string[] {
  const hosts = [...portal.documentHosts];
  try {
    hosts.push(new URL(portal.url).hostname);
  } catch {
    // A portal without a valid address contributes no host.
  }
  return hosts.map((host) => host.toLowerCase());
}

/**
 * External portals the practices can be sent to, configured on the server only:
 * - VIES_PORTALS: JSON list [{"id":"…","name":"…","url":"https://…","apiKeyEnv":"VIES_PORTAL_…_KEY",
 *   "callbackSecretEnv":"VIES_PORTAL_…_CALLBACK_SECRET","documentHosts":["files.example.com"]}],
 *   each secret in its own environment variable;
 * - or a single portal with VIES_PORTAL_API_URL, VIES_PORTAL_API_KEY, VIES_PORTAL_NAME
 *   and VIES_PORTAL_CALLBACK_SECRET.
 * A portal without URL or key is not listed. URLs, keys and secrets never reach the browser.
 */
export function readPortalRegistry(): ViesPortal[] {
  const portals: ViesPortal[] = [];
  try {
    const configured = JSON.parse(process.env.VIES_PORTALS ?? '[]') as Array<Record<string, unknown>>;
    for (const entry of Array.isArray(configured) ? configured : []) {
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      const keyEnv = typeof entry.apiKeyEnv === 'string' ? entry.apiKeyEnv : '';
      const secretEnv = typeof entry.callbackSecretEnv === 'string' ? entry.callbackSecretEnv : '';
      portals.push({
        id,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : id,
        url: typeof entry.url === 'string' ? entry.url.trim() : '',
        apiKey: keyEnv ? process.env[keyEnv] ?? '' : '',
        callbackSecret: secretEnv ? process.env[secretEnv] ?? '' : '',
        documentHosts: Array.isArray(entry.documentHosts)
          ? entry.documentHosts.filter((host): host is string => typeof host === 'string' && host.trim().length > 0).map((host) => host.trim())
          : [],
      });
    }
  } catch {
    // An unreadable VIES_PORTALS lists no portal rather than a wrong one.
  }
  if (process.env.VIES_PORTAL_API_URL && !portals.some((portal) => portal.id === 'default')) {
    portals.push({
      id: 'default',
      name: process.env.VIES_PORTAL_NAME?.trim() || 'Portale VIES',
      url: process.env.VIES_PORTAL_API_URL,
      apiKey: process.env.VIES_PORTAL_API_KEY ?? '',
      callbackSecret: process.env.VIES_PORTAL_CALLBACK_SECRET ?? '',
      documentHosts: [],
    });
  }
  return portals;
}

/** Portals a practice can be sent to. */
export function getConfiguredPortals(): ViesPortal[] {
  return readPortalRegistry().filter((portal) => portal.id && portal.url && portal.apiKey);
}

export function isExternalPortalConfigured(): boolean {
  return getConfiguredPortals().length > 0;
}

/** The body sent to a portal (schema_version 2). Kept apart from the call so it can be checked on its own. */
export function buildPortalPayload(
  job: ViesJob,
  portal: Pick<ViesPortal, 'id' | 'callbackSecret'>,
  practice: { id: string; practice_number: string; practice_type: string; client_name: string } | null,
  documents: Awaited<ReturnType<typeof listSignedPracticeDocuments>>,
) {
  return {
    schema_version: 2,
    idempotency_key: job.id,
    practice: practice
      ? { id: practice.id, number: practice.practice_number, type: practice.practice_type, client_name: practice.client_name }
      : null,
    documents,
    callback: portal.callbackSecret
      ? {
          url: `${getPublicBaseUrl()}/api/vies-portal-callback`,
          portal_id: portal.id,
          signature: 'HMAC-SHA256: X-Signature = "sha256=" + hex(HMAC(secret, X-Timestamp + "." + raw body))',
          events: ['practice.received', 'practice.info_requested', 'practice.deliberated', 'practice.rejected', 'practice.issued'],
        }
      : null,
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
    pec_beneficiario: job.pec_beneficiario,
    pec: job.pec,
    pagamento: job.pagamento,
    documenti_indicati: job.documenti_indicati,
    raw_payload: job.raw_payload,
  };
}

// Adapter for the external connection. There is deliberately no simulation mode.
//
// Contract with the receiving portal (schema_version 2; the flat v1 fields are kept as they were):
//   POST <portal url>, Authorization: Bearer <key>, Idempotency-Key: <job id>
//   practice   our id and number: the portal quotes them back in its callbacks
//   documents  every file of the practice, as download links valid for three days
//   callback   where and how the portal answers (see docs/vies-connector.md)
async function executeViesAgent(job: ViesJob, portal: ViesPortal): Promise<ViesAgentResult> {
  const supabase = getSupabaseAdmin();
  let practice: { id: string; practice_number: string; practice_type: string; client_name: string } | null = null;
  let documents: Awaited<ReturnType<typeof listSignedPracticeDocuments>> = [];
  if (job.external_reference) {
    const { data, error } = await supabase
      .from('practices')
      .select('id, practice_number, practice_type, client_name')
      .eq('id', job.external_reference)
      .maybeSingle();
    if (error) throw new Error(`Lettura della pratica non riuscita: ${error.message}`);
    practice = data;
    if (practice) documents = await listSignedPracticeDocuments(supabase, practice.id);
  }

  const response = await fetch(portal.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${portal.apiKey}`,
      'Idempotency-Key': job.id,
    },
    body: JSON.stringify(buildPortalPayload(job, portal, practice, documents)),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    return {
      success: false,
      retryable: response.status >= 500 || response.status === 429,
      errorCode: `PORTAL_HTTP_${response.status}`,
      errorMessage: typeof payload?.error === 'string' ? payload.error : `${portal.name} ha risposto con HTTP ${response.status}.`,
      details: { status: response.status, payload: payload ?? null },
    };
  }

  return {
    success: true,
    externalReference: typeof payload?.external_reference === 'string' ? payload.external_reference : undefined,
    details: { portal_response: payload ?? null, documents_sent: documents.length },
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
