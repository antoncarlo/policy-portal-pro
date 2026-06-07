import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processViesQueue, sendMethodNotAllowed, verifyCronOrWorkerAuth } from './_lib/vies-orchestrator.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendMethodNotAllowed(res, 'GET, POST');
  }

  if (!verifyCronOrWorkerAuth(req)) {
    return res.status(401).json({ error: 'Autorizzazione cron/worker non valida.' });
  }

  try {
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitFromBody = typeof req.body?.limit === 'number' ? req.body.limit : undefined;
    const limit = limitFromBody ?? (rawLimit ? Number(rawLimit) : 5);

    const summary = await processViesQueue({
      limit: Number.isFinite(limit) ? limit : 5,
      workerId: `vies-cron-${process.env.VERCEL_REGION ?? 'local'}-${Date.now()}`,
    });

    return res.status(200).json({
      ok: true,
      message: 'Ciclo orchestratore VIES completato.',
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto durante il ciclo orchestratore VIES.';
    return res.status(500).json({ ok: false, error: message });
  }
}
