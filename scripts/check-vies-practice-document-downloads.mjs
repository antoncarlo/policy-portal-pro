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
    name: "la lista pratiche scarica esclusivamente da practice_documents e dal bucket practice-documents",
    pass:
      /from\("practice_documents"\)/.test(practiceDocumentsComponent) &&
      /from\("practice-documents"\)/.test(practiceDocumentsComponent),
  },
  {
    name: "il dettaglio pratica scarica esclusivamente da practice_documents e dal bucket practice-documents",
    pass:
      /from\("practice_documents"\)/.test(practiceDetailDocumentsComponent) &&
      /from\("practice-documents"\)/.test(practiceDetailDocumentsComponent),
  },
  {
    name: "la creazione batch VIES materializza almeno lo ZIP nominativo nella tabella practice_documents della pratica",
    pass:
      /practiceDocumentRows/.test(viesPage) &&
      /from\("practice_documents"\)\.insert\(practiceDocumentRows\)/.test(viesPage) &&
      /practice_id:\s*createdPracticesByIndex\.get\(reconciliation\.record\.rowNumber\)/.test(viesPage),
  },
  {
    name: "lo ZIP nominativo viene caricato nel bucket practice-documents usato dai pulsanti di download pratica",
    pass:
      /PRACTICE_DOCUMENTS_STORAGE_BUCKET\s*=\s*"practice-documents"/.test(viesPage) &&
      /storage\.from\(PRACTICE_DOCUMENTS_STORAGE_BUCKET\)\.upload/.test(viesPage) &&
      /practiceDocumentStoragePath/.test(viesPage),
  },
  {
    name: "se la creazione fallisce dopo aver creato pratiche o allegati, la UI esegue rollback per evitare pratiche orfane",
    pass:
      /createdPracticeIdsForRollback/.test(viesPage) &&
      /uploadedPracticeDocumentPathsForRollback/.test(viesPage) &&
      /from\("practices"\)\s*\.delete\(\)\s*\.in\("id",\s*createdPracticeIdsForRollback\)/s.test(viesPage) &&
      /storage\.from\(PRACTICE_DOCUMENTS_STORAGE_BUCKET\)\.remove\(uploadedPracticeDocumentPathsForRollback\)/.test(viesPage),
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
