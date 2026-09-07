// Generazione e salvataggio del "Ricapitolo Richiesta" (ZIP con preventivo PDF
// e documentazione contrattuale Helpet) per una pratica Pet. Usato dal webhook
// di creazione pratica e dall'azione "attach" di /api/pet-quote (portale).

import type { AdminClient } from './partner-api.js';
import { buildPetSummary, extractNotesSections } from '../../src/lib/practiceSummary.js';
import { PET_QUOTE_DOCUMENT_TYPE, canGeneratePetQuote, generatePetQuotePdf, petQuotePdfToBytes } from '../../src/lib/petQuotePdf.js';
import {
  PET_QUOTE_ZIP_MIME_TYPE,
  buildPetQuoteZip,
  buildPetQuoteZipFileName,
  loadPetQuoteAttachments,
} from '../../src/lib/petQuoteBundle.js';

export interface PetQuotePracticeRow {
  id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  owner_tax_code: string | null;
  pet_microchip: string | null;
  premium_gross: number | null;
  notes: string | null;
}

export interface PetQuoteDocumentResult {
  document_id: string | null;
  file_name: string;
  document_type: string;
  file_size: number;
  attachments: string[];
}

/** URL pubblico del portale, da cui la function scarica la documentazione contrattuale (public/helpet). */
export function getPortalPublicUrl(): string {
  if (process.env.PORTAL_PUBLIC_URL) return process.env.PORTAL_PUBLIC_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://policy-portal-pro.vercel.app';
}

/**
 * Genera lo ZIP del Ricapitolo Richiesta e lo allega alla pratica.
 * Restituisce null se i dati del preventivo non consentono la generazione
 * (nessuna copertura ne' premio) o se la pratica non e' di tipo Pet.
 */
export async function attachPetQuoteDocument(
  supabaseAdmin: AdminClient,
  practice: PetQuotePracticeRow,
  uploadedBy: string
): Promise<PetQuoteDocumentResult | null> {
  if (practice.practice_type !== 'pet') return null;

  const { specificFields } = extractNotesSections(practice.notes);
  const pet = buildPetSummary({
    practice_type: 'pet',
    owner_tax_code: practice.owner_tax_code,
    pet_microchip: practice.pet_microchip,
    premium_gross: practice.premium_gross,
    specific_fields: specificFields,
  });
  if (!canGeneratePetQuote(pet)) return null;

  const pdf = generatePetQuotePdf({
    practiceNumber: practice.practice_number,
    clientName: practice.client_name,
    pet,
  });
  const attachments = await loadPetQuoteAttachments(getPortalPublicUrl());
  const bytes = Buffer.from(buildPetQuoteZip({
    petName: pet.name,
    quotePdf: petQuotePdfToBytes(pdf),
    attachments,
  }));
  const fileName = buildPetQuoteZipFileName(pet.name);
  const storagePath = `${practice.id}/${Date.now()}-ricapitolo-richiesta-pet.zip`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('practice-documents')
    .upload(storagePath, bytes, { contentType: PET_QUOTE_ZIP_MIME_TYPE, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('practice_documents')
    .insert({
      practice_id: practice.id,
      file_name: fileName,
      file_path: storagePath,
      file_size: bytes.length,
      mime_type: PET_QUOTE_ZIP_MIME_TYPE,
      uploaded_by: uploadedBy,
      document_type: PET_QUOTE_DOCUMENT_TYPE,
    })
    .select('id')
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);

  return {
    document_id: (inserted as { id?: string } | null)?.id ?? null,
    file_name: fileName,
    document_type: PET_QUOTE_DOCUMENT_TYPE,
    file_size: bytes.length,
    attachments: attachments.map(a => a.fileName),
  };
}
