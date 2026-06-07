import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve('supabase/migrations/20260607_apply_vies_full_orchestrator_safe.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

const enumPatchPattern = /ALTER\s+TYPE\s+public\.practice_type\s+ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'vies'/i;
const verificationPattern = /enum_range\s*\(\s*NULL::public\.practice_type\s*\)/i;

const failures = [];

if (!enumPatchPattern.test(migrationSql)) {
  failures.push('La migrazione consolidata VIES deve aggiungere idempotentemente il valore enum public.practice_type = vies.');
}

if (!verificationPattern.test(migrationSql)) {
  failures.push('La migrazione consolidata VIES deve verificare che public.practice_type contenga vies dopo la patch.');
}

if (failures.length > 0) {
  console.error('Controllo schema VIES non riuscito:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Schema VIES coerente: la migrazione consolidata include enum practice_type=vies e verifica finale.');
