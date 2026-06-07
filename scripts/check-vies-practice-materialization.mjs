import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const viesPage = readFileSync(resolve(root, "src/pages/Vies.tsx"), "utf8");
const practicesTable = readFileSync(resolve(root, "src/components/practices/PracticesTable.tsx"), "utf8");
const practicesFilters = readFileSync(resolve(root, "src/components/practices/PracticesFilters.tsx"), "utf8");
const practiceDetail = readFileSync(resolve(root, "src/pages/PracticeDetail.tsx"), "utf8");

const checks = [
  {
    name: "il batch VIES crea record nella tabella practices",
    pass: /\.from\("practices"\)[\s\S]*\.insert\(/.test(viesPage),
  },
  {
    name: "le pratiche generate sono di tipo fidejussioni",
    pass: /practice_type:\s*"fidejussioni"/.test(viesPage),
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
    name: "la lista pratiche riconosce fidejussioni",
    pass: /fidejussioni/.test(practicesTable),
  },
  {
    name: "i filtri pratiche includono VIES\/fideiussioni",
    pass: /value="fidejussioni"/.test(practicesFilters),
  },
  {
    name: "il dettaglio pratica mostra il riepilogo VIES\/rischio",
    pass: /Riepilogo VIES \/ rischio fideiussorio/.test(practiceDetail),
  },
  {
    name: "il dettaglio pratica mostra importo garantito e compagnia in bianco",
    pass: /Importo garantito/.test(practiceDetail) && /Da lasciare in bianco/.test(practiceDetail),
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
