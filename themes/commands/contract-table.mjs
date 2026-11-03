import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { renderDoc } from '../lib/contract-doc.mjs';

export async function run({ flags }) {
  const file = path.join(THEMES_ROOT, 'CONTRACT.md');
  const current = fs.readFileSync(file, 'utf8');
  const next = renderDoc(current);
  if (flags.check) {
    if (next !== current) { console.error('themes/CONTRACT.md is out of date: run `node themes/cli.mjs contract-table`'); return 1; }
    console.log('themes/CONTRACT.md generated tables are current');
    return 0;
  }
  fs.writeFileSync(file, next);
  console.log('themes/CONTRACT.md updated');
  return 0;
}
