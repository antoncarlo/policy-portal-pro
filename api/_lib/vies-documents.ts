import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Documents that come back from a portal (deliberated draft, issued policy): checked, stored in the
 * practice's folder and linked to the practice. Nothing here trusts the sender: type, size and the
 * file's own header are verified, and a file that is fetched from an address can only come from the
 * portal's own host.
 */

export const PRACTICE_DOCUMENTS_BUCKET = 'practice-documents';
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

export type StoredDocumentType = 'bozza_deliberata' | 'polizza_emessa';

export interface IncomingDocument {
  file_name: string;
  mime_type?: string;
  /** Base64 content, for small files. */
  content_base64?: string;
  /** Address to download it from (https, only the portal's own hosts). */
  url?: string;
  /** A file already uploaded to the practice's folder (by an administrator's browser). */
  storage_path?: string;
}

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const ALLOWED_TYPES: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-',
  'application/zip': (bytes) => bytes.subarray(0, 2).toString('latin1') === 'PK',
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8,
  'image/png': (bytes) => bytes.subarray(1, 4).toString('latin1') === 'PNG',
};

export const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(-120) || 'documento';

const guessMime = (fileName: string) =>
  /\.pdf$/i.test(fileName) ? 'application/pdf' : /\.zip$/i.test(fileName) ? 'application/zip' : /\.png$/i.test(fileName) ? 'image/png' : /\.jpe?g$/i.test(fileName) ? 'image/jpeg' : 'application/pdf';

async function downloadFromPortal(url: string, allowedHosts: string[]): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DocumentError('Indirizzo del documento non valido');
  }
  if (parsed.protocol !== 'https:') throw new DocumentError('Il documento va scaricato da un indirizzo https');
  if (!allowedHosts.some((host) => host && parsed.hostname.toLowerCase() === host.toLowerCase())) {
    throw new DocumentError('Il documento può essere scaricato solo dal portale che lo invia');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new DocumentError(`Download del documento non riuscito (HTTP ${response.status})`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_DOCUMENT_BYTES) throw new DocumentError('Documento troppo grande');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentError('Documento troppo grande');
    return bytes;
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    throw new DocumentError('Download del documento non riuscito');
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the content of an incoming document and checks it. */
export async function readIncomingDocument(
  document: IncomingDocument,
  options: { documentHosts?: string[] } = {},
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const fileName = safeFileName(document.file_name || 'documento.pdf');
  let bytes: Buffer;
  if (document.content_base64) {
    if (!/^[A-Za-z0-9+/=\s]+$/.test(document.content_base64)) throw new DocumentError('Contenuto del documento non valido (base64)');
    bytes = Buffer.from(document.content_base64, 'base64');
  } else if (document.url) {
    bytes = await downloadFromPortal(document.url, options.documentHosts ?? []);
  } else {
    throw new DocumentError('Il documento non ha contenuto né indirizzo');
  }
  return checkDocumentBytes(bytes, document.mime_type, fileName);
}

/** Size, declared type and the file's own header must agree. */
function checkDocumentBytes(bytes: Buffer, declaredType: string | undefined, fileName: string) {
  if (!bytes.length) throw new DocumentError('Il documento è vuoto');
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentError('Documento troppo grande (massimo 12 MB)');

  const mimeType = (declaredType ?? '').toLowerCase().split(';')[0].trim() || guessMime(fileName);
  const check = ALLOWED_TYPES[mimeType];
  if (!check) throw new DocumentError(`Tipo di documento non consentito: ${mimeType}`);
  if (!check(bytes)) throw new DocumentError('Il contenuto del documento non corrisponde al tipo dichiarato');
  return { bytes, mimeType, fileName };
}

/** Stores a document in the practice's folder and links it to the practice. Returns the linked row. */
export async function attachPracticeDocument(
  supabase: SupabaseClient,
  practice: { id: string; user_id: string },
  document: IncomingDocument,
  documentType: StoredDocumentType,
  options: { documentHosts?: string[]; uploadedBy?: string | null } = {},
): Promise<{ id: string; file_name: string; file_path: string }> {
  let bytes: Buffer;
  let mimeType: string;
  let fileName: string;
  let path: string;

  if (document.storage_path) {
    // Uploaded straight to the practice's folder by an administrator: the file is checked where it is.
    path = document.storage_path;
    if (!path.startsWith(`${practice.id}/`) || path.split('/').some((part) => part === '..' || part === '')) {
      throw new DocumentError('Percorso del documento non valido');
    }
    const { data, error } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).download(path);
    if (error || !data) throw new DocumentError('Il documento caricato non è stato trovato');
    try {
      ({ bytes, mimeType, fileName } = checkDocumentBytes(Buffer.from(await data.arrayBuffer()), document.mime_type, safeFileName(document.file_name || path.split('/').pop() || 'documento.pdf')));
    } catch (checkError) {
      // A file that fails the checks is not kept in the practice's folder.
      await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
      throw checkError;
    }
  } else {
    ({ bytes, mimeType, fileName } = await readIncomingDocument(document, options));
    path = `${practice.id}/${documentType}-${Date.now()}-${fileName}`;
    const { error: uploadError } = await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) throw new DocumentError(`Salvataggio del documento non riuscito: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from('practice_documents')
    .insert({
      practice_id: practice.id,
      file_name: fileName,
      file_path: path,
      file_size: bytes.length,
      mime_type: mimeType,
      document_type: documentType,
      uploaded_by: options.uploadedBy ?? practice.user_id,
    })
    .select('id, file_name, file_path')
    .single();
  if (error || !data) {
    await supabase.storage.from(PRACTICE_DOCUMENTS_BUCKET).remove([path]);
    throw new DocumentError(`Registrazione del documento non riuscita: ${error?.message ?? 'nessun dato'}`);
  }
  return data as { id: string; file_name: string; file_path: string };
}

// ---------------------------------------------------------------------------
// Documents going out: the practice's files as time-limited download links
// ---------------------------------------------------------------------------

const VIES_BATCH_FILES_BUCKET = 'vies-batch-files';
const VIES_BATCH_FILES_PREFIX = `${VIES_BATCH_FILES_BUCKET}://`;

/** Where a practice document lives: documents of VIES lots are kept in the lots' bucket. */
export function getDocumentStorageReference(filePath: string) {
  if (filePath.startsWith(VIES_BATCH_FILES_PREFIX)) {
    return { bucket: VIES_BATCH_FILES_BUCKET, path: filePath.slice(VIES_BATCH_FILES_PREFIX.length) };
  }
  return { bucket: PRACTICE_DOCUMENTS_BUCKET, path: filePath };
}

export interface OutgoingDocument {
  file_name: string;
  mime_type: string;
  size: number;
  document_type: string | null;
  download_url: string;
  expires_at: string;
}

/** Documents the company needs to evaluate the practice. What came back from a portal is not sent back. */
export async function listSignedPracticeDocuments(
  supabase: SupabaseClient,
  practiceId: string,
  ttlSeconds = 3 * 24 * 3600,
): Promise<OutgoingDocument[]> {
  const { data, error } = await supabase
    .from('practice_documents')
    .select('file_name, file_path, file_size, mime_type, document_type')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Lettura dei documenti della pratica non riuscita: ${error.message}`);

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const documents: OutgoingDocument[] = [];
  for (const row of data ?? []) {
    if (row.document_type === 'bozza_deliberata' || row.document_type === 'polizza_emessa') continue;
    const reference = getDocumentStorageReference(row.file_path as string);
    const { data: signed, error: signError } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, ttlSeconds);
    if (signError || !signed?.signedUrl) throw new Error(`Link del documento "${row.file_name}" non generato: ${signError?.message ?? 'nessun link'}`);
    documents.push({
      file_name: row.file_name as string,
      mime_type: (row.mime_type as string) || 'application/octet-stream',
      size: Number(row.file_size) || 0,
      document_type: (row.document_type as string | null) ?? null,
      download_url: signed.signedUrl,
      expires_at: expiresAt,
    });
  }
  return documents;
}
