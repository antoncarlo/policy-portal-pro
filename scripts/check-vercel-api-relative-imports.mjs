import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, '..', 'api');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const validRuntimeExtensions = new Set(['.js', '.mjs', '.cjs', '.json']);
const importRegex = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;

function listSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    if (!entry.isFile()) return [];
    return sourceExtensions.has(extname(entry.name)) ? [fullPath] : [];
  });
}

const failures = [];

for (const filePath of listSourceFiles(apiDir)) {
  const content = readFileSync(filePath, 'utf8');
  for (const match of content.matchAll(importRegex)) {
    const specifier = match[1];
    const extension = extname(specifier);
    if (!validRuntimeExtensions.has(extension)) {
      failures.push(`${filePath}: relative API import "${specifier}" must include a runtime extension such as .js`);
      continue;
    }

    const resolvedSourcePath = join(filePath, '..', specifier.replace(/\.js$/, '.ts'));
    try {
      if (!statSync(resolvedSourcePath).isFile()) {
        failures.push(`${filePath}: relative API import "${specifier}" does not resolve to ${resolvedSourcePath}`);
      }
    } catch {
      failures.push(`${filePath}: relative API import "${specifier}" does not resolve to ${resolvedSourcePath}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Vercel API relative import check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Vercel API relative import check passed.');
