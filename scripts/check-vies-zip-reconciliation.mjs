import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const viesPage = readFileSync(resolve(root, "src/pages/Vies.tsx"), "utf8");
const migrations = [
  "supabase/migrations/20260607_create_vies_batch_queue.sql",
  "supabase/migrations/20260607_vies_orchestrator_functions.sql",
  "supabase/migrations/20260607_add_vies_practice_type.sql",
]
  .map((path) => readFileSync(resolve(root, path), "utf8"))
  .join("\n");

const checks = [
  {
    name: "il tracciato Excel legge il campo NOME ZIP come chiave di riconciliazione",
    pass: /nomeZip:\s*getCellByAliases\(raw,\s*\[[^\]]*"nome zip"/.test(viesPage),
  },
  {
    name: "la pagina VIES consente il caricamento di più ZIP nominativi",
    pass: /const \[zipFiles, setZipFiles\]/.test(viesPage) && /multiple/.test(viesPage) && /Array\.from\(event\.target\.files/.test(viesPage),
  },
  {
    name: "ogni ZIP viene normalizzato usando il nome base senza estensione",
    pass: /getZipReconciliationKey/.test(viesPage) && /replace\(\/\\\.zip\$\/i/.test(viesPage),
  },
  {
    name: "il controllore blocca righe con NOME ZIP mancante, ZIP mancante o ZIP duplicato",
    pass: /Nome ZIP mancante/.test(viesPage) && /ZIP mancante/.test(viesPage) && /ZIP duplicato/.test(viesPage),
  },
  {
    name: "i job VIES conservano nome_zip, zip_file_name e gli errori di riconciliazione",
    pass: /nome_zip:\s*record\.nomeZip/.test(viesPage) && /zip_file_name:\s*reconciliation\.zipFile\?\.name/.test(viesPage) && /reconciliation_errors/.test(viesPage),
  },
  {
    name: "i documenti indicizzati sono collegati a riga Excel, nome ZIP e pratica generata",
    pass: /row_number:\s*reconciliation\.record\.rowNumber/.test(viesPage) && /nome_zip:\s*reconciliation\.record\.nomeZip/.test(viesPage) && /practice_id:\s*createdPracticesByIndex/.test(viesPage),
  },
  {
    name: "la UI mostra una tabella di riconciliazione per singolo nominativo",
    pass: /Controllore riconciliazione ZIP/.test(viesPage) && /ZIP collegato/.test(viesPage) && /Errori/.test(viesPage),
  },
  {
    name: "lo schema supporta la chiave ZIP sui job e il collegamento documenti-pratica",
    pass:
      /nome_zip TEXT/.test(migrations) &&
      /zip_file_name TEXT/.test(migrations) &&
      /reconciliation_errors JSONB/.test(migrations) &&
      /practice_id UUID/.test(migrations) &&
      /row_number INTEGER/.test(migrations),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Controllo riconciliazione VIES Excel-ZIP fallito:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log("Controllo riconciliazione VIES Excel-ZIP superato.");
