import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  daysBetween,
  normalizeDocumentType,
  practiceBelongsToTenant,
  prepareGetEndpoint,
  queryString,
  todayIsoDate,
} from './_lib/partner-api.js';
import { buildPracticeSummary, extractNotesSections } from '../src/lib/practiceSummary.js';

// ---------------------------------------------------------------------------
// Documenti obbligatori per tipologia (allineati a src/config/requiredDocuments.ts)
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
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-practice-status');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const practiceId = queryString(req, 'practice_id');
  const practiceNumber = queryString(req, 'practice_number');
  if (!practiceId && !practiceNumber) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number come query param.' });
  }

  const practiceSelect = 'id, practice_number, practice_type, status, financial_status, client_name, client_email, client_phone, beneficiary, policy_number, policy_start_date, policy_end_date, premium_net, premium_taxable, premium_taxes, premium_gross, commission_percentage, commission_amount, payment_date, commission_received_date, notes, api_key_id, user_id, pet_microchip, owner_tax_code, created_at, updated_at';

  const practiceQuery = practiceId
    ? supabaseAdmin.from('practices').select(practiceSelect).eq('id', practiceId)
    : supabaseAdmin.from('practices').select(practiceSelect).eq('practice_number', practiceNumber as string);

  const { data: practice, error: practiceError } = await practiceQuery.maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: practiceError.message });
  }

  if (!practice) {
    return respond(404, { error: 'Pratica non trovata.' }, { error_message: 'Practice not found' });
  }

  if (!practiceBelongsToTenant(practice, ctx)) {
    return respond(403, { error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' },
      { error_message: 'Tenant isolation: key mismatch' });
  }

  // Eventi (timeline + note/chat)
  const { data: events } = await supabaseAdmin
    .from('practice_events')
    .select('event_type, description, created_by, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const authorIds = [...new Set((events ?? []).map(e => e.created_by).filter(Boolean))];
  const authorMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);
    for (const p of profiles ?? []) {
      authorMap[p.id] = p.full_name || p.email || p.id;
    }
  }

  // Documenti (metadati)
  const { data: docs } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_size, mime_type, document_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Note: appunti testuali separati dai dati specifici
  const { textualNotes, specificFields } = extractNotesSections(practice.notes);

  const quote = (practice.premium_gross || practice.premium_net) ? {
    premium_net: practice.premium_net,
    premium_taxable: practice.premium_taxable,
    premium_taxes: practice.premium_taxes,
    premium_gross: practice.premium_gross,
    commission_percentage: practice.commission_percentage,
    commission_amount: practice.commission_amount,
  } : null;

  // Riepilogo completo (contraente, polizza, dati specifici, coperture, premio)
  const summary = buildPracticeSummary({
    practice_type: practice.practice_type,
    client_name: practice.client_name,
    client_email: practice.client_email,
    client_phone: practice.client_phone,
    beneficiary: practice.beneficiary,
    owner_tax_code: practice.owner_tax_code,
    pet_microchip: practice.pet_microchip,
    policy_number: practice.policy_number,
    policy_start_date: practice.policy_start_date,
    policy_end_date: practice.policy_end_date,
    premium_net: practice.premium_net,
    premium_taxable: practice.premium_taxable,
    premium_taxes: practice.premium_taxes,
    premium_gross: practice.premium_gross,
    commission_percentage: practice.commission_percentage,
    commission_amount: practice.commission_amount,
    specific_fields: specificFields,
  });

  // Documenti obbligatori: stato caricato/mancante
  const practiceType = practice.practice_type as string;
  const requiredDocsDef = REQUIRED_DOCUMENTS_BY_TYPE[practiceType] || [];
  // document_type normalizzato: accetta anche le keyword storiche del webhook
  // (es. libretto_sanitario_o_microchip -> libretto_sanitario)
  const uploadedDocTypes = new Set(
    (docs ?? []).map(d => normalizeDocumentType(d.document_type)).filter((t): t is string => Boolean(t))
  );
  const requiredDocuments = requiredDocsDef.map(rd => ({
    id: rd.id,
    label: rd.label,
    description: rd.description,
    is_questionnaire: rd.isQuestionnaire,
    uploaded: uploadedDocTypes.has(rd.id),
  }));
  const missingDocuments = requiredDocuments.filter(d => !d.uploaded).map(d => d.id);

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

  const daysUntilExpiry = practice.policy_end_date ? daysBetween(todayIsoDate(), practice.policy_end_date) : null;

  return respond(200, {
    practice_id: practice.id,
    practice_number: practice.practice_number,
    practice_type: practice.practice_type,
    practice_type_label: summary.practice_type_label,
    status: practice.status,
    financial_status: practice.financial_status,
    client: {
      name: practice.client_name,
      email: practice.client_email,
      phone: practice.client_phone,
      beneficiary: practice.beneficiary,
      tax_code: practice.owner_tax_code,
    },
    policy: {
      number: practice.policy_number,
      start_date: practice.policy_start_date,
      end_date: practice.policy_end_date,
      days_until_expiry: daysUntilExpiry,
    },
    summary,
    pet: summary.pet,
    specific_fields: specificFields,
    pet_microchip: practice.pet_microchip,
    owner_tax_code: practice.owner_tax_code,
    quote,
    payment: {
      financial_status: practice.financial_status,
      payment_date: practice.payment_date,
      commission_received_date: practice.commission_received_date,
    },
    notes: textualNotes || null,
    notes_chat,
    required_documents: requiredDocuments,
    missing_documents: missingDocuments,
    documents_complete: missingDocuments.length === 0,
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
  }, { practice_id: practice.id });
}
