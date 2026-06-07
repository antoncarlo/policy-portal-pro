import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  assertBatchAccess,
  assertJobAccess,
  getSupabaseAdmin,
  processViesQueue,
  resolveUserFromRequest,
  sendMethodNotAllowed,
} from './_lib/vies-orchestrator.js';

type ControlAction = 'enqueue_batch' | 'retry_job' | 'cancel_batch' | 'run_worker_once';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, 'POST');
  }

  try {
    const supabase = getSupabaseAdmin();
    const userId = await resolveUserFromRequest(req, supabase);
    const action = req.body?.action as ControlAction | undefined;

    if (!action) {
      return res.status(400).json({ error: 'Azione VIES mancante.' });
    }

    if (action === 'enqueue_batch') {
      const batchId = requireString(req.body?.batchId, 'batchId');
      await assertBatchAccess(supabase, batchId, userId);

      const { data, error } = await supabase.rpc('enqueue_vies_batch', { p_batch_id: batchId });
      if (error) throw new Error(error.message);

      return res.status(200).json({ ok: true, batch: data });
    }

    if (action === 'retry_job') {
      const jobId = requireString(req.body?.jobId, 'jobId');
      const batchId = await assertJobAccess(supabase, jobId, userId);

      const { data, error } = await supabase.rpc('retry_vies_job', { p_job_id: jobId });
      if (error) throw new Error(error.message);

      return res.status(200).json({ ok: true, batchId, job: data });
    }

    if (action === 'cancel_batch') {
      const batchId = requireString(req.body?.batchId, 'batchId');
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Batch annullato manualmente dalla UI.';
      await assertBatchAccess(supabase, batchId, userId);

      const { data, error } = await supabase.rpc('cancel_vies_batch', {
        p_batch_id: batchId,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);

      return res.status(200).json({ ok: true, batch: data });
    }

    if (action === 'run_worker_once') {
      const limit = Number.isFinite(Number(req.body?.limit)) ? Number(req.body.limit) : 3;
      const summary = await processViesQueue({
        limit,
        workerId: `vies-manual-${userId.slice(0, 8)}-${Date.now()}`,
      });

      return res.status(200).json({ ok: true, summary });
    }

    return res.status(400).json({ error: `Azione VIES non supportata: ${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto nel controllo VIES.';
    return res.status(400).json({ ok: false, error: message });
  }
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Parametro obbligatorio mancante: ${fieldName}.`);
  }

  return value.trim();
}
