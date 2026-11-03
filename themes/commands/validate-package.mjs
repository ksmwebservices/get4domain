import fs from 'node:fs';
import path from 'node:path';
import { validatePackage } from '../lib/pack.mjs';

/** node themes/cli.mjs validate-package <file.zip>   Reads the zip into memory only; nothing is extracted or executed. */
export async function run({ positional }) {
  const file = positional[0];
  if (!file) { console.error('Usage: node themes/cli.mjs validate-package <file.zip>'); return 2; }
  const r = validatePackage(fs.readFileSync(path.resolve(file)));
  if (r.ok) { console.log(`valid: ${r.manifest.id} v${r.manifest.version} (${r.manifest.tier}), contentHash ${r.manifest.contentHash}`); return 0; }
  console.error(`NOT valid (${r.errors.length} problem(s)):`);
  for (const e of r.errors) console.error(`  [${e.code}] ${e.path}: ${e.message}`);
  return 1;
}
