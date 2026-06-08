import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = readFileSync(resolve(root, 'src/pages/Vies.tsx'), 'utf8');
const handlePrepareBatchMatch = source.match(/const handlePrepareBatch = async \(\) => \{[\s\S]*?\n  \};\n\n  if \(accessStatus/);

if (!handlePrepareBatchMatch) {
  console.error('Impossibile trovare handlePrepareBatch in src/pages/Vies.tsx');
  process.exit(1);
}

const handlePrepareBatch = handlePrepareBatchMatch[0];
const failures = [];

if (/status:\s*validationErrors\.length\s*\|\|\s*reconciliationValidationErrors\.length\s*\?\s*"pending_validation"/.test(handlePrepareBatch)) {
  failures.push('I job creati dal batch non devono restare in pending_validation: il worker claim_vies_jobs elabora solo queued/ready/failed, quindi le righe non valide devono essere blocked e le righe valide queued.');
}

if (/status:\s*missingRequirements\.length\s*\|\|\s*reconciliationErrors\.length\s*\?\s*"draft"\s*:\s*"queued"/.test(handlePrepareBatch)) {
  failures.push('Lo stato iniziale del batch non può dipendere solo dai requisiti globali: deve considerare il numero effettivo di job validi/blocked per evitare batch queued con zero job processabili.');
}

if (!/const\s+validJobCount\s*=/.test(handlePrepareBatch) || !/const\s+blockedJobCount\s*=/.test(handlePrepareBatch)) {
  failures.push('handlePrepareBatch deve calcolare esplicitamente validJobCount e blockedJobCount prima di finalizzare i contatori del batch.');
}

if (!/finalBatchStatus/.test(handlePrepareBatch)) {
  failures.push('handlePrepareBatch deve usare uno stato finale derivato dai job realmente creati, non un valore queued statico pre-inserimento.');
}

if (failures.length > 0) {
  console.error('Regressione consistenza creazione batch VIES rilevata:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('OK: creazione batch VIES coerente con job effettivamente processabili.');
