// Fails when a production dependency has a high or critical advisory that is not on the allowlist.
// Allowed: advisories that only touch the build (they never run in the portal or in the API).
import { execFileSync } from 'node:child_process';

const ALLOWED = new Map([
  ['GHSA-vfj7-8cjw-p6xm', 'braces via tailwindcss 3 (build-time glob expansion; fixed only by Tailwind 4)'],
]);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (error) {
  // npm exits non-zero when it finds anything: the report is still on stdout.
  raw = error.stdout?.toString() ?? '';
}

const report = JSON.parse(raw || '{}');
const vulnerabilities = report.vulnerabilities ?? {};

// The advisories behind a package, following "via another package" chains down to the source.
const rootAdvisories = (name, seen = new Set()) => {
  if (seen.has(name)) return [];
  seen.add(name);
  const advisories = [];
  for (const via of vulnerabilities[name]?.via ?? []) {
    if (typeof via === 'object') advisories.push(via);
    else advisories.push(...rootAdvisories(via, seen));
  }
  return advisories;
};

const found = [];
for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;
  const open = rootAdvisories(name).filter((advisory) => !ALLOWED.has(advisory.url?.split('/').pop()));
  if (open.some((advisory) => ['high', 'critical'].includes(advisory.severity))) found.push(`${name} (${vulnerability.severity}): ${[...new Set(open.map((advisory) => advisory.title))].join('; ')}`);
}

if (found.length > 0) {
  console.error('Vulnerabilità high/critical nelle dipendenze di produzione:\n- ' + found.join('\n- '));
  process.exit(1);
}
console.log('Audit dipendenze: nessuna vulnerabilità high/critical fuori dalla lista ammessa.');
