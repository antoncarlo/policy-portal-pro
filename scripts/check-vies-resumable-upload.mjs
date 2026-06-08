import fs from 'node:fs';

const sourcePath = new URL('../src/pages/Vies.tsx', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');

const failures = [];

if (!/from ['"]tus-js-client['"]/.test(source)) {
  failures.push('Vies.tsx deve importare tus-js-client per upload resumable TUS dei file VIES grandi.');
}

if (!/const uploadViesFileResumable = async/.test(source)) {
  failures.push('Deve esistere un helper uploadViesFileResumable dedicato agli upload Storage VIES.');
}

if (!/\.storage\.supabase\.co\/storage\/v1\/upload\/resumable/.test(source)) {
  failures.push('L’upload VIES deve usare il direct storage hostname Supabase e l’endpoint resumable.');
}

if (!/const VIES_RESUMABLE_CHUNK_SIZE = 6 \* 1024 \* 1024/.test(source) || !/chunkSize:\s*VIES_RESUMABLE_CHUNK_SIZE/.test(source)) {
  failures.push('L’upload resumable Supabase deve usare chunkSize 6MB come richiesto dal protocollo TUS Supabase.');
}

if (!/onProgress:\s*\(bytesUploaded, bytesTotal\)/.test(source)) {
  failures.push('L’upload resumable deve esporre avanzamento byte caricati/totali per evitare bottoni apparentemente bloccati.');
}

if (/\.upload\(zipStoragePath, zip/.test(source)) {
  failures.push('Gli ZIP nominativi non devono più usare supabase.storage.upload standard: sopra 500MB/5GB è fragile e non resumable.');
}

if (!source.includes('Upload ZIP ${index + 1}/${zipFiles.length}:')) {
  failures.push('La preparazione batch deve mostrare progresso per ogni ZIP caricato.');
}

if (failures.length) {
  console.error('Regressione upload VIES grandi rilevata:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('OK: upload VIES usa TUS resumable con progressi e senza upload standard sugli ZIP.');
