import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prepareGetEndpoint } from './_lib/partner-api.js';
import { buildPetQuoteCatalog } from '../src/lib/petQuoteEngine.js';

/**
 * GET /api/pet-quote-catalog  (Preventivatore Pet - catalogo)
 * Categorie animale, coperture con premi, piani predefiniti, regole di
 * composizione e tabella garanzie: tutto cio' che serve al partner per
 * replicare il configuratore Pet del portale.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/pet-quote-catalog');
  if (!api) return;

  return api.respond(200, {
    success: true,
    generated_at: new Date().toISOString(),
    ...buildPetQuoteCatalog(),
  });
}
