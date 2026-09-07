import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, createAdminClient, getClientIp, prepareGetEndpoint } from './_lib/partner-api.js';
import { attachPetQuoteDocument, type PetQuotePracticeRow } from './_lib/pet-quote-document.js';
import { buildPetQuoteCatalog, computePetQuote, type PetQuoteRequest } from '../src/lib/petQuoteEngine.js';
import { buildPetSummary } from '../src/lib/practiceSummary.js';
import { buildPetQuoteFileName, generatePetQuotePdf, petQuotePdfToBytes } from '../src/lib/petQuotePdf.js';

/**
 * GET  /api/pet-quote-catalog  (Preventivatore Pet - catalogo; rewrite -> GET /api/pet-quote)
 * Categorie animale, coperture con premi, piani predefiniti, regole di
 * composizione e tabella garanzie: tutto cio' che serve al partner per
 * replicare il configuratore Pet del portale.
 *
 * POST /api/pet-quote  (Preventivatore Pet - calcolo)
 * Body: animal_type (o pet_species + pet_weight) e la selezione coperture
 * (selected_coverages | plan_id | rsv/rct/tutela_legale). Opzionali:
 * pet_name, client_name, include_pdf=true per ricevere il "Ricapitolo
 * Richiesta" in base64 (anteprima, non salvato).
 * Restituisce coperture con premi, totale annuale/mensile, tabella garanzie e
 * l'oggetto `specific_fields` pronto per il webhook di creazione pratica.
 *
 * POST /api/pet-quote con { action: "attach", practice_id } e header
 * Authorization: Bearer <access token Supabase dell'utente del portale>:
 * genera lato server il Ricapitolo Richiesta (ZIP) e lo allega alla pratica.
 * Consentito al proprietario della pratica e agli amministratori.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST' && (req.body as Record<string, unknown> | undefined)?.action === 'attach') {
    return handleAttach(req, res);
  }

  if (req.method === 'GET') {
    const catalogApi = await prepareGetEndpoint(req, res, '/api/pet-quote-catalog', 'GET');
    if (!catalogApi) return;
    return catalogApi.respond(200, {
      success: true,
      generated_at: new Date().toISOString(),
      ...buildPetQuoteCatalog(),
    });
  }

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

async function handleAttach(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  const { allowed, retryAfter } = checkRateLimit(getClientIp(req));
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  const authHeader = req.headers.authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Autenticazione richiesta.' });

  const supabaseAdmin = createAdminClient();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Sessione non valida.' });
  const userId = userData.user.id as string;

  const body = req.body as Record<string, unknown>;
  const practiceId = typeof body.practice_id === 'string' ? body.practice_id : '';
  if (!practiceId) return res.status(422).json({ error: 'practice_id obbligatorio.' });

  const { data: practice, error: practiceError } = await supabaseAdmin
    .from('practices')
    .select('id, practice_number, practice_type, client_name, owner_tax_code, pet_microchip, premium_gross, notes, user_id')
    .eq('id', practiceId)
    .maybeSingle();
  if (practiceError) return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  if (!practice) return res.status(404).json({ error: 'Pratica non trovata.' });

  if (practice.user_id !== userId) {
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Non autorizzato su questa pratica.' });
  }

  if (practice.practice_type !== 'pet') {
    return res.status(422).json({ error: 'Il Ricapitolo Richiesta e\' disponibile solo per le pratiche Pet.' });
  }

  try {
    const result = await attachPetQuoteDocument(supabaseAdmin, practice as PetQuotePracticeRow, userId);
    if (!result) {
      return res.status(422).json({ error: 'Dati del preventivo insufficienti: servono le coperture selezionate o il premio annuale.' });
    }
    return res.status(201).json({ success: true, document: result });
  } catch (err) {
    console.error('Pet quote attach failed:', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Errore durante la generazione del Ricapitolo Richiesta.' });
  }
}
