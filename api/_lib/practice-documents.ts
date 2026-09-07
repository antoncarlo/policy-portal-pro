import type { VercelRequest, VercelResponse } from '@vercel/node';
import { practiceBelongsToTenant, prepareGetEndpoint, queryString } from './partner-api.js';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
const PRACTICE_DOCUMENTS_BUCKET = 'practice-documents';
const VIES_BATCH_FILES_BUCKET = 'vies-batch-files';
const VIES_BATCH_FILES_PREFIX = `${VIES_BATCH_FILES_BUCKET}://`;

function getDocumentStorageReference(filePath: string) {
  if (filePath.startsWith(VIES_BATCH_FILES_PREFIX)) {
    return {
      bucket: VIES_BATCH_FILES_BUCKET,
      path: filePath.slice(VIES_BATCH_FILES_PREFIX.length),
    };
  }

  return {
    bucket: PRACTICE_DOCUMENTS_BUCKET,
    path: filePath,
  };
}

/**
 * GET /api/get-practice-documents
 * Servito dalla function get-practice-status (rewrite in vercel.json, per
 * restare entro il limite di 12 Serverless Functions del piano Vercel Hobby).
 */
export async function handlePracticeDocuments(req: VercelRequest, res: VercelResponse) {
  const api = await prepareGetEndpoint(req, res, '/api/get-practice-documents');
  if (!api) return;
  const { supabaseAdmin, ctx, respond } = api;

  const practiceId = queryString(req, 'practice_id');
  const practiceNumber = queryString(req, 'practice_number');
  if (!practiceId && !practiceNumber) {
    return res.status(422).json({ error: 'Fornire practice_id o practice_number come query param.' });
  }

  const { data: practice, error: practiceError } = await (
    practiceId
      ? supabaseAdmin.from('practices').select('id, practice_number, practice_type, client_name, status, created_at, api_key_id, user_id').eq('id', practiceId)
      : supabaseAdmin.from('practices').select('id, practice_number, practice_type, client_name, status, created_at, api_key_id, user_id').eq('practice_number', practiceNumber as string)
  ).maybeSingle();

  if (practiceError) {
    console.error('practice lookup failed:', practiceError.message);
    return respond(503, { error: 'Servizio temporaneamente non disponibile.' }, { error_message: practiceError.message });
  }

  if (!practice) return respond(404, { error: 'Pratica non trovata.' }, { error_message: 'Practice not found' });

  if (!practiceBelongsToTenant(practice, ctx)) {
    return respond(403, { error: 'Accesso negato: questa pratica non appartiene alla tua chiave API.' },
      { error_message: 'Tenant isolation: key mismatch' });
  }

  // Get documents
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('practice_documents')
    .select('id, file_name, file_path, file_size, mime_type, document_type, created_at')
    .eq('practice_id', practice.id)
    .order('created_at', { ascending: false });

  if (docsError) {
    console.error('practice_documents lookup failed:', docsError.message);
    return respond(503, { error: 'Errore caricamento documenti.' }, { practice_id: practice.id, error_message: docsError.message });
  }

  // Generate signed URLs
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

  const documentsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const storageReference = getDocumentStorageReference(doc.file_path);
      const { data: signed, error: signedError } = await supabaseAdmin.storage
        .from(storageReference.bucket)
        .createSignedUrl(storageReference.path, SIGNED_URL_EXPIRY_SECONDS);

      if (signedError) {
        console.error(`Failed to generate signed URL for ${doc.file_name}:`, signedError.message);
      }

      return {
        id: doc.id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        document_type: doc.document_type,
        created_at: doc.created_at,
        download_url: signed?.signedUrl ?? null,
        expires_at: expiresAt,
      };
    })
  );

  return respond(200, {
    success: true,
    practice_id: practice.id,
    practice_number: practice.practice_number,
    practice: {
      id: practice.id,
      practice_number: practice.practice_number,
      practice_type: practice.practice_type,
      client_name: practice.client_name,
      status: practice.status,
      created_at: practice.created_at,
    },
    documents: documentsWithUrls,
    count: documentsWithUrls.length,
  }, { practice_id: practice.id });
}
