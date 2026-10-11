import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const viesPage = readFileSync(resolve(root, "src/pages/Vies.tsx"), "utf8");
const practicesTable = readFileSync(resolve(root, "src/components/practices/PracticesTable.tsx"), "utf8");
const practicesFilters = readFileSync(resolve(root, "src/components/practices/PracticesFilters.tsx"), "utf8");
const practiceDetail = readFileSync(resolve(root, "src/pages/PracticeDetail.tsx"), "utf8");
const domainMessages = readFileSync(resolve(root, "src/i18n/messages/domain.ts"), "utf8");
const practiceDetailMessages = readFileSync(resolve(root, "src/i18n/messages/practiceDetail.ts"), "utf8");
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
    pass: /navigate\(`\/practices\/\$\{[^}]+\}`\)/.test(viesPage),
  },
  {
    name: "la lista pratiche mostra VIES e Fidejussioni come tipologie distinte",
    pass:
      /vies:\s*"VIES"/.test(domainMessages) &&
      /fidejussioni:\s*"Fidejussioni"/.test(domainMessages) &&
      /practiceTypeLabel/.test(practicesTable) &&
      !/VIES\s*\/\s*Fideiussioni/.test(domainMessages + practicesTable),
  },
  {
    name: "i filtri pratiche permettono di filtrare separatamente VIES e Fidejussioni",
    pass:
      /PRACTICE_TYPES\.map/.test(practicesFilters) &&
      /export const PRACTICE_TYPES = \[[^\]]*"fidejussioni"[^\]]*"vies"/.test(domainMessages) &&
      !/VIES\s*\/\s*Fideiussioni/.test(practicesFilters),
  },
  {
    name: "il dettaglio pratica mostra il riepilogo solo per pratiche VIES",
    pass: /practice\.practice_type === "vies"/.test(practiceDetail) && /viesText:\s*"Dati della richiesta VIES/.test(practiceDetailMessages),
  },
  {
    name: "il dettaglio pratica usa Contraente e Beneficiario senza chiamare il contraente cliente",
    pass:
      /clientInfo:\s*"Informazioni Contraente"/.test(practiceDetailMessages) &&
      /beneficiary:\s*\(name: string\) => `Beneficiario/.test(practiceDetailMessages) &&
      !/Informazioni Cliente/.test(practiceDetail + practiceDetailMessages),
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
