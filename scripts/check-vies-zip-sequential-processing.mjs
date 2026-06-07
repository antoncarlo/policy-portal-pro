import fs from 'node:fs';

const sourcePath = new URL('../src/pages/Vies.tsx', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');

const handleZipUploadMatch = source.match(/const handleZipUpload = async[\s\S]*?\n  const missingRequirements =/);
if (!handleZipUploadMatch) {
  console.error('Impossibile trovare handleZipUpload in src/pages/Vies.tsx');
  process.exit(1);
}

const handleZipUpload = handleZipUploadMatch[0];

const failures = [];

if (/Promise\.all\s*\(\s*selectedFiles\.map\s*\(/.test(handleZipUpload)) {
  failures.push('handleZipUpload usa ancora Promise.all sui file selezionati: il parsing parallelo può sommare in memoria molti ZIP grandi.');
}

if (!/for \(const \[index, file\] of selectedFiles\.entries\(\)\)/.test(handleZipUpload)) {
  failures.push('handleZipUpload deve processare gli ZIP in modo sequenziale con selectedFiles.entries().');
}

if (!/setZipProcessingStatus\(/.test(handleZipUpload)) {
  failures.push('handleZipUpload deve aggiornare uno stato di avanzamento leggibile durante l’indicizzazione dei grandi batch.');
}

if (!/throw new Error\(`Errore lettura ZIP \$\{file\.name\}:/.test(handleZipUpload)) {
  failures.push('Gli errori di lettura devono includere il nome dello ZIP che ha fallito.');
}

if (!/const selectedZipTotalSize =/.test(source) || !/formatBytes\(selectedZipTotalSize\)/.test(source)) {
  failures.push('La UI deve mostrare la dimensione totale selezionata per evitare ambiguità sui batch voluminosi.');
}

if (failures.length) {
  console.error('Regressione VIES ZIP rilevata:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('OK: parsing ZIP VIES sequenziale, progressivo e informativo.');
