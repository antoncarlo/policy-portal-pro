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

if (!source.includes('"x-upsert": "true"')) {
  failures.push('L’upload TUS deve inviare x-upsert true per evitare conflitti su retry/resume dello stesso oggetto Storage.');
}

if (!/verifyViesStorageObjectExists/.test(source)) {
  failures.push('Dopo ogni upload TUS deve esserci una verifica esplicita dell’oggetto nello Storage prima di registrare il path.');
}

if (!/await verifyViesStorageObjectExists\(plan\.storagePath, plan\.file\.size\)/.test(source)) {
  failures.push('Ogni ZIP deve essere confermato nello Storage prima di essere aggiunto alla mappa dei path archiviati.');
}

if (/findPreviousUploads\(\)|resumeFromPreviousUpload\(/.test(source)) {
  failures.push('Il flusso VIES non deve riprendere upload locali precedenti: con ZIP nominativi diversi può collegare progressi vecchi a oggetti Storage sbagliati.');
}

if (!/buildStableZipStorageName/.test(source) || /zip-nominativi\/\$\{buildSafeStorageName\(zip\.name\)\}/.test(source)) {
  failures.push('I nomi Storage degli ZIP devono essere stabili e riconoscibili, non suffissati con Date.now come file generici.');
}

if (!/if \(zipStorageFailures\.length\)[\s\S]*Upload ZIP incompleto/.test(source)) {
  failures.push('La creazione batch deve fermarsi con errore esplicito se uno ZIP non è stato caricato nello Storage.');
}

if (/\.upload\(zipStoragePath, zip/.test(source)) {
  failures.push('Gli ZIP nominativi non devono più usare supabase.storage.upload standard: sopra 500MB/5GB è fragile e non resumable.');
}

if (!/VIES_ZIP_UPLOAD_CONCURRENCY\s*=\s*2/.test(source) || !/runWithConcurrency\([\s\S]*zipUploadPlans[\s\S]*VIES_ZIP_UPLOAD_CONCURRENCY/.test(source)) {
  failures.push('La preparazione batch deve caricare gli ZIP con concorrenza controllata per ridurre il tempo totale senza saturare il browser.');
}

if (!/Upload ZIP parallelo/.test(source) || !/totalZipUploadBytes/.test(source)) {
  failures.push('La preparazione batch deve mostrare progresso aggregato leggibile durante gli upload ZIP concorrenti.');
}

if (failures.length) {
  console.error('Regressione upload VIES grandi rilevata:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('OK: upload VIES usa TUS resumable con concorrenza ZIP controllata, verifica Storage post-upload, nomi ZIP stabili, upsert e blocco sicuro sugli ZIP mancanti.');
