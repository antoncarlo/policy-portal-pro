import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findExistingViesPractices, runBatchController } from './_lib/vies-controller-data.js';
import {
  assertBatchAccess,
  assertJobAccess,
  getConfiguredPortals,
  getSupabaseAdmin,
  processViesQueue,
  resolveUserFromRequest,
  sendMethodNotAllowed,
} from './_lib/vies-orchestrator.js';

type ControlAction =
  | 'list_portals'
  | 'check_duplicates'
  | 'verify_batch'
  | 'send_batch'
  | 'retry_job'
  | 'cancel_batch';

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

    // Portals the practices can be sent to: names only, never URLs or keys.
    if (action === 'list_portals') {
      return res.status(200).json({ ok: true, portals: getConfiguredPortals().map(({ id, name }) => ({ id, name })) });
    }

    // VIES practices already in the portal for the companies of a sheet, before creating them.
    if (action === 'check_duplicates') {
      const companies = Array.isArray(req.body?.companies) ? (req.body.companies as Array<Record<string, unknown>>) : [];
      const codes = companies.slice(0, 50).map((company) => ({
        uscc: typeof company.uscc === 'string' ? company.uscc.trim().toUpperCase() || null : null,
        vat: typeof company.vat === 'string' ? company.vat.trim() || null : null,
      }));
      const existing = await findExistingViesPractices(supabase, codes);
      return res.status(200).json({ ok: true, existing });
    }

    // Final check, read-only: what would be sent and what is blocked, with the reasons.
    if (action === 'verify_batch') {
      const batchId = requireString(req.body?.batchId, 'batchId');
      await assertBatchAccess(supabase, batchId, userId);
      const report = await runBatchController(supabase, batchId);
      return res.status(200).json({ ok: true, report });
    }

    // Send to the chosen portal: final check first; practices that fail it are
    // blocked with the reason and never sent. The worker checks again right
    // before each send.
    if (action === 'send_batch') {
      const batchId = requireString(req.body?.batchId, 'batchId');
      const portalId = requireString(req.body?.portalId, 'portalId');
      await assertBatchAccess(supabase, batchId, userId);
      const portal = getConfiguredPortals().find((candidate) => candidate.id === portalId);
      if (!portal) throw new Error('Il portale scelto non è collegato.');

      const report = await runBatchController(supabase, batchId);
      for (const result of report.jobs.filter((job) => job.outcome === 'error')) {
        const { error } = await supabase.rpc('block_vies_job', {
          p_job_id: result.jobId,
          p_reason: `Controllo finale non superato: ${result.errors.join('; ')}`,
          p_error_code: 'BLOCKED_FINAL_CHECK',
        });
        if (error) throw new Error(error.message);
      }
      if (!report.ok) {
        return res.status(200).json({ ok: false, report, error: 'Nessuna pratica del lotto supera il controllo finale: nulla è stato inviato.' });
      }

      const { error: targetError } = await supabase.from('vies_batches').update({ target_portal: portal.id }).eq('id', batchId);
      if (targetError) throw new Error(targetError.message);
      const { error: enqueueError } = await supabase.rpc('enqueue_vies_batch', { p_batch_id: batchId });
      if (enqueueError) throw new Error(enqueueError.message);

      const summary = await processViesQueue({
        limit: report.ok,
        workerId: `vies-send-${userId.slice(0, 8)}-${Date.now()}`,
      });
      return res.status(200).json({ ok: true, portal: { id: portal.id, name: portal.name }, report, summary });
    }

    if (action === 'retry_job') {
      const jobId = requireString(req.body?.jobId, 'jobId');
      const batchId = await assertJobAccess(supabase, jobId, userId);

      const { data, error } = await supabase.rpc('retry_vies_job', { p_job_id: jobId });
      if (error) throw new Error(error.message);
      // Only a failed send is retried: a job blocked by the checks stays blocked.
      if (!data?.id) throw new Error('Si può riprovare solo un invio non riuscito: le pratiche bloccate dai controlli restano bloccate.');

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
