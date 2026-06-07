import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const practicesTable = readFileSync(resolve(root, "src/components/practices/PracticesTable.tsx"), "utf8");
const practicesPage = readFileSync(resolve(root, "src/pages/Practices.tsx"), "utf8");
const practicesExport = readFileSync(resolve(root, "src/components/practices/PracticesExport.tsx"), "utf8");

const checks = [
  {
    name: "la tabella mantiene lo stato delle pratiche selezionate",
    pass: /selectedPracticeIds/.test(practicesTable) && /setSelectedPracticeIds/.test(practicesTable),
  },
  {
    name: "esiste una checkbox per selezionare tutte le pratiche filtrate",
    pass: /Seleziona tutte le pratiche filtrate/.test(practicesTable) && /toggleAllFilteredPractices/.test(practicesTable),
  },
  {
    name: "ogni riga pratica ha una checkbox di selezione individuale",
    pass: /Seleziona pratica/.test(practicesTable) && /togglePracticeSelection/.test(practicesTable),
  },
  {
    name: "la barra azioni massive mostra il numero di pratiche selezionate",
    pass: /pratiche selezionate/.test(practicesTable) && /selectedPractices\.length/.test(practicesTable),
  },
  {
    name: "il cambio stato massivo aggiorna solo gli ID selezionati",
    pass: /handleBulkStatusUpdate/.test(practicesTable) && /\.update\(\{ status: bulkStatus/.test(practicesTable) && /\.in\("id", Array\.from\(selectedPracticeIds\)\)/.test(practicesTable),
  },
  {
    name: "le colonne usano Contraente e Beneficiario invece di Cliente",
    pass:
      /<TableHead>Contraente<\/TableHead>/.test(practicesTable) &&
      /<TableHead>Beneficiario<\/TableHead>/.test(practicesTable) &&
      !/<TableHead>Cliente<\/TableHead>/.test(practicesTable),
  },
  {
    name: "la query pratiche include il beneficiario della polizza",
    pass: /beneficiary/.test(practicesTable) && /client_name/.test(practicesTable),
  },
  {
    name: "ricerca e placeholder usano Contraente invece di Cliente",
    pass: /contraente/.test(practicesPage.toLowerCase()) && !/cliente/.test(practicesPage.toLowerCase()),
  },
  {
    name: "export pratiche usa Contraente, Beneficiario e supporta VIES",
    pass:
      /Contraente/.test(practicesExport) &&
      /Beneficiario/.test(practicesExport) &&
      /vies/.test(practicesExport) &&
      !/Cliente/.test(practicesExport),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Controllo azioni massive Pratiche fallito:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log("Controllo azioni massive Pratiche superato.");
