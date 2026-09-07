import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prepareGetEndpoint } from './_lib/partner-api.js';
import { computePetQuote, type PetQuoteRequest } from '../src/lib/petQuoteEngine.js';
import { buildPetSummary } from '../src/lib/practiceSummary.js';
import { buildPetQuoteFileName, generatePetQuotePdf, petQuotePdfToBytes } from '../src/lib/petQuotePdf.js';

/**
 * POST /api/pet-quote  (Preventivatore Pet - calcolo)
 * Body: animal_type (o pet_species + pet_weight) e la selezione coperture
 * (selected_coverages | plan_id | rsv/rct/tutela_legale). Opzionali:
 * pet_name, client_name, include_pdf=true per ricevere il "Ricapitolo
 * Richiesta" in base64 (anteprima, non salvato).
 * Restituisce coperture con premi, totale annuale/mensile, tabella garanzie e
 * l'oggetto `specific_fields` pronto per il webhook di creazione pratica.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/pet-quote', 'POST');
  if (!api) return;
  const { respond } = api;

  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Corpo della richiesta non valido o non JSON.' });
  }

  const outcome = computePetQuote(body as PetQuoteRequest);
  if (!outcome.ok) {
    return respond(422, { error: 'pet_quote_invalid', message: outcome.error, ...(outcome.details ?? {}) },
      { error_message: outcome.error });
  }

  const { quote } = outcome;
  const petName = typeof body.pet_name === 'string' ? body.pet_name.trim() : '';
  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';

  let pdf: { file_name: string; mime_type: string; content_base64: string } | null = null;
  const includePdf = body.include_pdf === true || body.include_pdf === 'true';
  if (includePdf) {
    const pet = buildPetSummary({
      practice_type: 'pet',
      specific_fields: { ...quote.specific_fields, pet_name: petName || null },
    });
    if (pet) {
      const doc = generatePetQuotePdf({
        practiceNumber: typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : 'PREVENTIVO',
        clientName: clientName || 'Cliente',
        pet,
      });
      const bytes = Buffer.from(petQuotePdfToBytes(doc));
      pdf = { file_name: buildPetQuoteFileName(petName), mime_type: 'application/pdf', content_base64: bytes.toString('base64') };
    }
  }

  return respond(200, {
    success: true,
    generated_at: new Date().toISOString(),
    pet_name: petName || null,
    ...quote,
    pdf,
  });
}
