import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const viesPage = readFileSync(resolve(root, "src/pages/Vies.tsx"), "utf8");
const practicesTable = readFileSync(resolve(root, "src/components/practices/PracticesTable.tsx"), "utf8");
const practicesFilters = readFileSync(resolve(root, "src/components/practices/PracticesFilters.tsx"), "utf8");
const practiceDetail = readFileSync(resolve(root, "src/pages/PracticeDetail.tsx"), "utf8");
const supabaseTypes = readFileSync(resolve(root, "src/integrations/supabase/types.ts"), "utf8");
const viesPracticeTypeMigrationPath = resolve(root, "supabase/migrations/20260607_add_vies_practice_type.sql");
const migrations = existsSync(viesPracticeTypeMigrationPath) ? readFileSync(viesPracticeTypeMigrationPath, "utf8") : "";

const checks = [
  {
    name: "il batch VIES crea record nella tabella practices",
    pass: /\.from\("practices"\)[\s\S]*\.insert\(/.test(viesPage),
  },
  {
    name: "le pratiche generate dal batch sono di tipo vies e non fidejussioni",
    pass: /practice_type:\s*"vies"/.test(viesPage) && !/practice_type:\s*"fidejussioni"/.test(viesPage),
  },
  {
    name: "lo schema aggiunge VIES come valore distinto dell'enum practice_type",
    pass: /ADD VALUE IF NOT EXISTS 'vies'/.test(migrations) && /\| "vies"/.test(supabaseTypes),
  },
  {
    name: "i job VIES conservano il riferimento alla pratica generata",
    pass: /external_reference:\s*createdPracticesByIndex/.test(viesPage),
  },
  {
    name: "la pagina VIES mostra un link alla pratica generata",
    pass: /navigate\(`\/practices\/\$\{job\.external_reference\}`\)/.test(viesPage),
  },
  {
    name: "la lista pratiche mostra VIES e Fidejussioni come tipologie distinte",
    pass:
      /vies:\s*"VIES"/.test(practicesTable) &&
      /fidejussioni:\s*"Fidejussioni"/.test(practicesTable) &&
      !/VIES\s*\/\s*Fideiussioni/.test(practicesTable),
  },
  {
    name: "i filtri pratiche permettono di filtrare separatamente VIES e Fidejussioni",
    pass:
      /value="vies"/.test(practicesFilters) &&
      /value="fidejussioni"/.test(practicesFilters) &&
      !/VIES\s*\/\s*Fideiussioni/.test(practicesFilters),
  },
  {
    name: "il dettaglio pratica mostra il riepilogo solo per pratiche VIES",
    pass: /practice\.practice_type === "vies"/.test(practiceDetail) && /Riepilogo VIES/.test(practiceDetail),
  },
  {
    name: "il dettaglio pratica usa Contraente e Beneficiario senza chiamare il contraente cliente",
    pass:
      /Informazioni Contraente/.test(practiceDetail) &&
      /Contraente/.test(practiceDetail) &&
      /Beneficiario/.test(practiceDetail) &&
      !/Informazioni Cliente/.test(practiceDetail),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Controllo materializzazione pratiche VIES fallito:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log("Controllo materializzazione pratiche VIES superato.");
