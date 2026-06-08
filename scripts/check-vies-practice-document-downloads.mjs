import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const viesPage = readFileSync(resolve(root, "src/pages/Vies.tsx"), "utf8");
const safeMigration = readFileSync(resolve(root, "supabase/migrations/20260607_apply_vies_full_orchestrator_safe.sql"), "utf8");
const practiceDocumentsComponent = readFileSync(resolve(root, "src/components/practices/PracticesTable.tsx"), "utf8");
const practiceDetailDocumentsComponent = readFileSync(resolve(root, "src/components/practice/PracticeDocuments.tsx"), "utf8");

const checks = [
  {
    name: "la migrazione consolidata applicata in produzione aggiunge le colonne di riconciliazione mancanti su vies_jobs",
    pass:
      /ALTER TABLE public\.vies_jobs[\s\S]*ADD COLUMN IF NOT EXISTS nome_zip TEXT/.test(safeMigration) &&
      /ALTER TABLE public\.vies_jobs[\s\S]*ADD COLUMN IF NOT EXISTS zip_file_name TEXT/.test(safeMigration) &&
      /ALTER TABLE public\.vies_jobs[\s\S]*ADD COLUMN IF NOT EXISTS reconciliation_errors JSONB NOT NULL DEFAULT '\[\]'::jsonb/.test(safeMigration),
  },
  {
    name: "la migrazione consolidata applicata in produzione collega i documenti VIES alla pratica generata",
    pass:
      /ALTER TABLE public\.vies_batch_documents[\s\S]*ADD COLUMN IF NOT EXISTS practice_id UUID REFERENCES public\.practices\(id\) ON DELETE SET NULL/.test(safeMigration) &&
      /ALTER TABLE public\.vies_batch_documents[\s\S]*ADD COLUMN IF NOT EXISTS row_number INTEGER/.test(safeMigration) &&
      /ALTER TABLE public\.vies_batch_documents[\s\S]*ADD COLUMN IF NOT EXISTS nome_zip TEXT/.test(safeMigration) &&
      /ALTER TABLE public\.vies_batch_documents[\s\S]*ADD COLUMN IF NOT EXISTS zip_file_name TEXT/.test(safeMigration),
  },
  {
    name: "la lista pratiche scarica da practice_documents risolvendo sia practice-documents sia riferimenti staged VIES",
    pass:
      /from\("practice_documents"\)/.test(practiceDocumentsComponent) &&
      /VIES_BATCH_FILES_BUCKET\s*=\s*"vies-batch-files"/.test(practiceDocumentsComponent) &&
      /getDocumentStorageReference/.test(practiceDocumentsComponent) &&
      /from\(storageReference\.bucket\)/.test(practiceDocumentsComponent) &&
      /download\(storageReference\.path\)/.test(practiceDocumentsComponent),
  },
  {
    name: "il dettaglio pratica scarica da practice_documents risolvendo sia practice-documents sia riferimenti staged VIES",
    pass:
      /from\("practice_documents"\)/.test(practiceDetailDocumentsComponent) &&
      /VIES_BATCH_FILES_BUCKET\s*=\s*"vies-batch-files"/.test(practiceDetailDocumentsComponent) &&
      /getDocumentStorageReference/.test(practiceDetailDocumentsComponent) &&
      /from\(storageReference\.bucket\)/.test(practiceDetailDocumentsComponent) &&
      /download\(storageReference\.path\)/.test(practiceDetailDocumentsComponent),
  },
  {
    name: "la creazione batch VIES materializza almeno lo ZIP nominativo nella tabella practice_documents della pratica",
    pass:
      /practiceDocumentRows/.test(viesPage) &&
      /from\("practice_documents"\)\.insert\(chunk\)/.test(viesPage) &&
      /practiceDocumentRows\.slice\(start, start \+ VIES_DB_INSERT_CHUNK_SIZE\)/.test(viesPage) &&
      /practice_id:\s*practiceId/.test(viesPage),
  },
  {
    name: "lo ZIP nominativo resta archiviato nel bucket VIES e viene collegato alla pratica con path qualificato",
    pass:
      /VIES_STORAGE_BUCKET\s*=\s*"vies-batch-files"/.test(viesPage) &&
      /VIES_PRACTICE_DOCUMENT_PATH_PREFIX/.test(viesPage) &&
      /zipStoragePathsByKey\.get\(zipKey\)/.test(viesPage) &&
      /file_path:\s*`\$\{VIES_PRACTICE_DOCUMENT_PATH_PREFIX\}\$\{stagedZipPath\}`/.test(viesPage) &&
      !/storage\.from\(PRACTICE_DOCUMENTS_STORAGE_BUCKET\)\.upload/.test(viesPage),
  },
  {
    name: "se la creazione fallisce dopo aver creato pratiche o allegati, la UI esegue rollback per evitare pratiche orfane senza duplicare ZIP staged",
    pass:
      /createdPracticeIdsForRollback/.test(viesPage) &&
      /from\("practices"\)\s*\.delete\(\)\s*\.in\("id",\s*createdPracticeIdsForRollback\)/s.test(viesPage) &&
      /zipStoragePathsByKey/.test(viesPage) &&
      !/practiceDocumentStoragePath/.test(viesPage),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Controllo collegamento documenti VIES alle pratiche fallito:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log("Controllo collegamento documenti VIES alle pratiche superato.");
