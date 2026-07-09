import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Rate limiter (sliding window, per IP)
// ---------------------------------------------------------------------------

interface RateLimitEntry { count: number; windowStart: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

async function logRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  data: {
    api_key_masked: string;
    source: string;
    ip_address: string;
    endpoint: string;
    method: string;
    status_code: number;
    practice_id?: string;
    error_message?: string;
    request_body_size: number;
    api_key_id?: string;
  }
): Promise<void> {
  await supabaseAdmin.from('api_logs').insert(data).then(({ error }) => {
    if (error) console.error('Failed to write api_log:', error.message);
  });
}

// ---------------------------------------------------------------------------
// Required documents configuration (mirrors frontend config)
// ---------------------------------------------------------------------------

interface RequiredDocDef {
  id: string;
  label: string;
  description: string;
  isQuestionnaire: boolean;
}

const REQUIRED_DOCUMENTS_BY_TYPE: Record<string, RequiredDocDef[]> = {
  pet: [
    { id: 'documento_identita', label: "Documento d'Identita Proprietario", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'libretto_sanitario', label: 'Libretto Sanitario o Certificato Microchip', description: "Documento veterinario attestante l'identita dell'animale", isQuestionnaire: false },
    { id: 'questionario_pet', label: 'Questionario Pet Compilato e Firmato', description: "Questionario sullo stato di salute dell'animale", isQuestionnaire: true },
  ],
  car: [
    { id: 'visura_camerale', label: 'Visura Camerale', description: "Documento ufficiale camerale dell'impresa", isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita Legale Rappresentante", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'preventivo_o_contratto', label: 'Preventivo o Contratto Lavori', description: "Documento che attesta l'importo e la natura dei lavori", isQuestionnaire: false },
    { id: 'questionario_car', label: 'Questionario CAR Compilato e Firmato', description: 'Questionario tutti i rischi della costruzione', isQuestionnaire: true },
  ],
  casa: [
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'visura_catastale', label: 'Visura Catastale', description: "Visura dell'immobile da assicurare", isQuestionnaire: false },
    { id: 'questionario_globale_fabbricati', label: 'Questionario Globale Fabbricati Compilato e Firmato', description: 'Questionario per fabbricati e condomini', isQuestionnaire: true },
  ],
  fidejussioni: [
    { id: 'visura_camerale', label: 'Visura Camerale', description: "Documento ufficiale camerale dell'impresa", isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita Legale Rappresentante", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'bilancio_ultimo_anno', label: 'Bilancio Ultimo Anno', description: 'Ultimo bilancio approvato', isQuestionnaire: false },
    { id: 'atto_gara', label: 'Atto di Gara / Bando', description: 'Documentazione della gara o del contratto da garantire', isQuestionnaire: false },
  ],
  responsabilita_civile: [
    { id: 'visura_camerale', label: 'Visura Camerale', description: 'Documento ufficiale camerale', isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'questionario_rc', label: 'Questionario RC Compilato e Firmato', description: 'Questionario di valutazione rischio RC', isQuestionnaire: true },
  ],
  fotovoltaico: [
    { id: 'visura_camerale', label: "Visura Camerale o Documento d'Identita", description: 'Documento identificativo del richiedente', isQuestionnaire: false },
    { id: 'progetto_impianto', label: "Progetto dell'Impianto", description: 'Documentazione tecnica del progetto fotovoltaico', isQuestionnaire: false },
    { id: 'autorizzazione', label: 'Autorizzazione/Permesso', description: "Autorizzazione all'installazione", isQuestionnaire: false },
  ],
  catastrofali: [
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'visura_catastale', label: 'Visura Catastale', description: "Visura dell'immobile da assicurare", isQuestionnaire: false },
    { id: 'perizia_immobile', label: 'Perizia o Planimetria Immobile', description: "Documento attestante caratteristiche e valore dell'immobile", isQuestionnaire: false },
    { id: 'questionario_rischi_catastrofali', label: 'Questionario Rischi Catastrofali Compilato e Firmato', description: 'Questionario per terremoto, alluvione e frana', isQuestionnaire: true },
  ],
  azienda: [
    { id: 'visura_camerale', label: 'Visura Camerale', description: "Documento ufficiale camerale dell'impresa", isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita Legale Rappresentante", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'bilancio', label: 'Bilancio o Dichiarazione dei Redditi', description: 'Ultimo bilancio approvato', isQuestionnaire: false },
    { id: 'questionario_rischi_catastrofali_azienda', label: 'Questionario Rischi Catastrofali Azienda', description: 'Questionario rischi catastrofali per linea aziende', isQuestionnaire: true },
  ],
  postuma_decennale: [
    { id: 'visura_camerale', label: 'Visura Camerale', description: "Documento ufficiale camerale dell'impresa", isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita Legale Rappresentante", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'collaudo_statico', label: 'Collaudo Statico', description: "Certificato di collaudo statico dell'opera", isQuestionnaire: false },
    { id: 'progetto_esecutivo', label: 'Progetto Esecutivo', description: "Progetto esecutivo dell'opera", isQuestionnaire: false },
    { id: 'questionario_decennale_postuma', label: 'Questionario Decennale Postuma', description: "Questionario per l'assicurazione dell'immobile", isQuestionnaire: true },
  ],
  all_risk: [
    { id: 'visura_camerale', label: "Visura Camerale o Documento d'Identita", description: 'Documento identificativo del richiedente', isQuestionnaire: false },
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'lista_beni', label: 'Lista Beni/Macchinari', description: 'Elenco dettagliato dei beni da assicurare con valori', isQuestionnaire: false },
    { id: 'questionario_car_postuma_l210', label: 'Questionario Tutti i Rischi / CAR L210', description: 'Questionario tutti i rischi della costruzione', isQuestionnaire: true },
  ],
  risparmio: [
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'codice_fiscale', label: 'Tessera Sanitaria / Codice Fiscale', description: 'Documento con codice fiscale del contraente', isQuestionnaire: false },
    { id: 'questionario_salute_risparmio', label: 'Questionario Sanitario Compilato e Firmato', description: 'Questionario sullo stato di salute del contraente', isQuestionnaire: true },
  ],
  salute: [
    { id: 'documento_identita', label: "Documento d'Identita", description: "Carta d'identita o passaporto", isQuestionnaire: false },
    { id: 'codice_fiscale', label: 'Tessera Sanitaria / Codice Fiscale', description: 'Documento con codice fiscale del contraente', isQuestionnaire: false },
    { id: 'questionario_sanitario', label: 'Questionario Sanitario Compilato e Firmato', description: 'Questionario sullo stato di salute', isQuestionnaire: true },
  ],
};

// ---------------------------------------------------------------------------
// Parse specific fields from notes
// ---------------------------------------------------------------------------

function extractSpecificFields(notes: string | null): { cleanNotes: string | null; specificFields: Record<string, unknown> | null } {
  if (!notes) return { cleanNotes: null, specificFields: null };

  const separator = '--- Dati Specifici Polizza ---';
  const sepIndex = notes.indexOf(separator);

  if (sepIndex === -1) {
    let clean = notes;
    if (clean.startsWith('idempotency:')) {
      const newlineIdx = clean.indexOf('\n');
      clean = newlineIdx >= 0 ? clean.slice(newlineIdx + 1).trim() : '';
    }
    return { cleanNotes: clean || null, specificFields: null };
  }

  let userNotes = notes.slice(0, sepIndex).trim();
  const jsonPart = notes.slice(sepIndex + separator.length).trim();

  if (userNotes.startsWith('idempotency:')) {
    const newlineIdx = userNotes.indexOf('\n');
    userNotes = newlineIdx >= 0 ? userNotes.slice(newlineIdx + 1).trim() : '';
  }

  let specificFields: Record<string, unknown> | null = null;
  try {
    specificFields = JSON.parse(jsonPart);
  } catch {
    userNotes = userNotes ? `${userNotes}\n${jsonPart}` : jsonPart;
  }

  return { cleanNotes: userNotes || null, specificFields };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = '/api/get-practice-status';
  const method = req.method ?? 'UNKNOWN';
  const ip = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    'unknown'
  );

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare GET.' });
  }

  // Rate limit
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Troppe richieste.', retry_after: retryAfter });
  }

  // API Key
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) return res.status(401).json({ error: 'X-API-Key header mancante.' });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const apiKeyMasked = `${apiKey.slice(0, 4)}****`;
  let resolvedKeyId: string | undefined;
  let keyRecord: { id: string; is_active: boolean; expires_at: string | null } | null = null;

  // Validate API key against DB
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const { data: keyData, error: keyLookupError } = await supabaseAdmin
    .from('api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyLookupError) {
    console.error('api_keys lookup failed:', keyLookupError.message);
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!keyData) {
    // Legacy fallback
    const legacyKey = process.env.PORTAL_API_KEY;
    const legacyMatch = legacyKey
      ? (() => {
          const a = Buffer.from(legacyKey, 'utf8');
          const b = Buffer.from(apiKey, 'utf8');
          return a.length === b.length && crypto.timingSafeEqual(a, b);
        })()
      : false;
    if (!legacyMatch) return res.status(401).json({ error: 'API Key non valida.' });
  } else {
    keyRecord = keyData;
    if (!keyRecord.is_active) return res.status(401).json({ error: 'API Key disattivata.' });
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API Key scaduta.' });
    }
    resolvedKeyId = keyRecord.id;
    // Update last_used_at (fire-and-forget)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {})
      .catch((err: unknown) => console.error('Failed to update last_used_at:', err));
  }

  // Resolve practice
  const { practice_id, practice_number } = req.query as Record<string, string | undefined>;
  if (!practice_id && !practice_number) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number come query param.' });
  }

  const practiceSelect = `
    id, practice_number, practice_type, status, financial_status,
    client_name, client_email, client_phone, beneficiary,
    policy_number, policy_start_date, policy_end_date,
    premium_net, premium_taxable, premium_taxes, premium_gross,
    commission_percentage, commission_amount,
    notes, api_key_id, pet_microchip, owner_tax_code,
    created_at, updated_at
  `.replace(/\s+/g, ' ').trim();

  const practiceQuery = practice_id
    ? supabaseAdmin.from('practices').select(practiceSelect).eq('id', practice_id)
    : supabaseAdmin.from('practices').select(practiceSelect).eq('practice_number', practice_number as string);

  const { data: practice, error: practiceError } = await practiceQuery.maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
      endpoint, method, status_code: 503, error_message: practiceError.message,
      request_body_size: 0, api_key_id: resolvedKeyId,
    });
    return res.status(503).json({ error: 'Servizio temporaneamente non disponibile.' });
  }

  if (!practice) {
    await logRequest(supabaseAdmin, {
      api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
      endpoint, method, status_code: 404, error_message: 'Practice not found',
      request_body_size: 0, api_key_id: resolvedKeyId,
    });
    return res.status(404).json({ error: 'Pratica non trovata.' });
  }

  // Tenant isolation
  if (keyRecord) {
    if (practice.api_key_id !== keyRecord.id) {
      await logRequest(supabaseAdmin, {
        api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
        endpoint, method, status_code: 403, error_message: 'Tenant isolation: key mismatch',
        request_body_size: 0, api_key_id: resolvedKeyId,
      });
      return res.status(403).json({ error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' });
    }
  } else {
    if (practice.api_key_id !== null) {
      return res.status(403).json({ error: 'Accesso negato: questa pratica e gestita tramite chiave API dedicata.' });
    }
  }

  // Fetch practice events (timeline + notes/chat)
  const { data: events } = await supabaseAdmin
    .from('practice_events')
    .select('event_type, description, created_by, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: true })
    .limit(200);

  // Resolve author names for events
  const authorIds = [...new Set((events ?? []).map(e => e.created_by).filter(Boolean))];
  const authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);
    if (profiles) {
      for (const p of profiles) {
        authorMap[p.id] = p.full_name || p.email || p.id;
      }
    }
  }

  // Fetch documents metadata
  const { data: docs } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_size, mime_type, document_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Extract specific fields from notes
  const { cleanNotes, specificFields } = extractSpecificFields(practice.notes);

  // Build quote/financial data
  const quote = (practice.premium_gross || practice.premium_net) ? {
    premium_net: practice.premium_net,
    premium_taxable: practice.premium_taxable,
    premium_taxes: practice.premium_taxes,
    premium_gross: practice.premium_gross,
    commission_percentage: practice.commission_percentage,
    commission_amount: practice.commission_amount,
  } : null;

  // Build required documents status
  const practiceType = practice.practice_type as string;
  const requiredDocsDef = REQUIRED_DOCUMENTS_BY_TYPE[practiceType] || [];
  const uploadedDocTypes = new Set((docs ?? []).map(d => d.document_type).filter(Boolean));
  const requiredDocuments = requiredDocsDef.map(rd => ({
    id: rd.id,
    label: rd.label,
    description: rd.description,
    is_questionnaire: rd.isQuestionnaire,
    uploaded: uploadedDocTypes.has(rd.id),
  }));

  // Separate events into timeline and notes/chat
  const timeline = (events ?? [])
    .filter(e => e.event_type !== 'nota')
    .map(e => ({
      event_type: e.event_type,
      description: e.description,
      author: authorMap[e.created_by] || e.created_by,
      created_at: e.created_at,
    }));

  const notes_chat = (events ?? [])
    .filter(e => e.event_type === 'nota')
    .map(e => ({
      message: e.description,
      author: authorMap[e.created_by] || e.created_by,
      created_at: e.created_at,
    }));

  // Log success
  await logRequest(supabaseAdmin, {
    api_key_masked: apiKeyMasked, source: 'get-practice-status', ip_address: ip,
    endpoint, method, status_code: 200, practice_id: practice.id,
    request_body_size: 0, api_key_id: resolvedKeyId,
  });

  return res.status(200).json({
    practice_id: practice.id,
    practice_number: practice.practice_number,
    practice_type: practice.practice_type,
    status: practice.status,
    financial_status: practice.financial_status,
    client: {
      name: practice.client_name,
      email: practice.client_email,
      phone: practice.client_phone,
      beneficiary: practice.beneficiary,
    },
    policy: {
      number: practice.policy_number,
      start_date: practice.policy_start_date,
      end_date: practice.policy_end_date,
    },
    specific_fields: specificFields,
    pet_microchip: practice.pet_microchip,
    owner_tax_code: practice.owner_tax_code,
    quote,
    notes: cleanNotes,
    notes_chat,
    required_documents: requiredDocuments,
    documents_count: docs?.length ?? 0,
    documents: (docs ?? []).map(d => ({
      id: d.id,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      document_type: d.document_type,
      created_at: d.created_at,
    })),
    timeline,
    created_at: practice.created_at,
    updated_at: practice.updated_at,
  });
}
