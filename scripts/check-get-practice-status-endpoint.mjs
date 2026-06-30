/**
 * Test regressivo: GET /api/get-practice-status
 * Verifica strutturale del codice sorgente dell'endpoint.
 * Autore: Anton Carlo Santoro
 */
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

const expectIncludes = (source, snippet, description) => {
  if (!source.includes(snippet)) failures.push(description);
};
const expectRegex = (source, regex, description) => {
  if (!regex.test(source)) failures.push(description);
};

const endpoint = read('api/get-practice-status.ts');

// --- Autenticazione ---
expectIncludes(
  endpoint,
  'x-api-key',
  'Deve richiedere header X-API-Key per autenticazione',
);
expectIncludes(
  endpoint,
  'sha256',
  'Deve usare SHA256 per l\'hash della chiave API',
);
expectIncludes(
  endpoint,
  'api_keys',
  'Deve verificare la chiave API nella tabella api_keys',
);
expectIncludes(
  endpoint,
  'PORTAL_API_KEY',
  'Deve supportare fallback legacy con PORTAL_API_KEY',
);
expectIncludes(
  endpoint,
  'timingSafeEqual',
  'Deve usare timingSafeEqual per il confronto sicuro della chiave legacy',
);
expectIncludes(
  endpoint,
  'is_active',
  'Deve verificare che la chiave API sia attiva',
);
expectIncludes(
  endpoint,
  'expires_at',
  'Deve verificare la scadenza della chiave API',
);

// --- Metodo HTTP ---
expectRegex(
  endpoint,
  /method\s*!==\s*['"]GET['"]/,
  'Deve accettare solo il metodo GET',
);
expectIncludes(
  endpoint,
  '405',
  'Deve restituire 405 per metodi non consentiti',
);

// --- Rate limiting ---
expectIncludes(
  endpoint,
  'checkRateLimit',
  'Deve implementare rate limiting',
);
expectIncludes(
  endpoint,
  '429',
  'Deve restituire 429 quando il rate limit viene superato',
);
expectIncludes(
  endpoint,
  'Retry-After',
  'Deve impostare header Retry-After quando rate limited',
);

// --- Parametri di ricerca ---
expectIncludes(
  endpoint,
  'practice_id',
  'Deve accettare practice_id come parametro di ricerca',
);
expectIncludes(
  endpoint,
  'practice_number',
  'Deve accettare practice_number come parametro di ricerca',
);
expectIncludes(
  endpoint,
  '422',
  'Deve restituire 422 se nessun parametro di ricerca fornito',
);

// --- Tenant isolation ---
expectIncludes(
  endpoint,
  'api_key_id',
  'Deve verificare tenant isolation tramite api_key_id',
);
expectIncludes(
  endpoint,
  '403',
  'Deve restituire 403 per violazione tenant isolation',
);

// --- Risposta completa ---
expectIncludes(
  endpoint,
  'practice_events',
  'Deve recuperare gli eventi/timeline della pratica',
);
expectIncludes(
  endpoint,
  'practice_documents',
  'Deve recuperare i metadati dei documenti della pratica',
);
expectIncludes(
  endpoint,
  'premium_gross',
  'Deve includere dati finanziari (premium_gross) nella risposta',
);
expectIncludes(
  endpoint,
  'premium_net',
  'Deve includere dati finanziari (premium_net) nella risposta',
);
expectIncludes(
  endpoint,
  'financial_status',
  'Deve includere financial_status nella risposta',
);
expectIncludes(
  endpoint,
  'client_name',
  'Deve includere dati cliente nella risposta',
);
expectIncludes(
  endpoint,
  'policy_number',
  'Deve includere dati polizza nella risposta',
);
expectIncludes(
  endpoint,
  'commission_percentage',
  'Deve includere dati provvigioni nella risposta',
);

// --- Logging ---
expectIncludes(
  endpoint,
  'api_logs',
  'Deve loggare le richieste nella tabella api_logs',
);
expectRegex(
  endpoint,
  /logRequest/,
  'Deve chiamare la funzione logRequest per il logging',
);

// --- CORS ---
expectIncludes(
  endpoint,
  'Access-Control-Allow-Origin',
  'Deve impostare header CORS',
);

// --- Codici di stato ---
expectIncludes(
  endpoint,
  '404',
  'Deve restituire 404 quando la pratica non viene trovata',
);
expectIncludes(
  endpoint,
  '401',
  'Deve restituire 401 per autenticazione fallita',
);
expectIncludes(
  endpoint,
  '503',
  'Deve restituire 503 per errori di servizio',
);
expectIncludes(
  endpoint,
  '200',
  'Deve restituire 200 per richieste riuscite',
);

// --- Sicurezza ---
expectIncludes(
  endpoint,
  'idempotency:',
  'Deve gestire la pulizia delle note con prefisso idempotency',
);
expectIncludes(
  endpoint,
  'last_used_at',
  'Deve aggiornare last_used_at della chiave API',
);

// --- Risultato ---
if (failures.length > 0) {
  console.error('FALLITI:', failures.length, 'controlli');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('check-get-practice-status-endpoint: tutti i controlli superati.');
}
