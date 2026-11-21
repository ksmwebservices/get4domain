import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { boltBrief } from '../lib/bolt-brief.mjs';

/** node themes/cli.mjs bolt-brief [--check]  ->  writes (or checks) themes/BOLT_BRIEF.md, generated from the code */
export async function run({ flags }) {
  const file = path.join(THEMES_ROOT, 'BOLT_BRIEF.md');
  const text = boltBrief();
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (flags.check) {
    if (current === text) { console.log('themes/BOLT_BRIEF.md is current'); return 0; }
    console.error('themes/BOLT_BRIEF.md is out of date: run node themes/cli.mjs bolt-brief');
    return 1;
  }
  fs.writeFileSync(file, text);
  console.log(`wrote ${file} (${Buffer.byteLength(text)} bytes)`);
  return 0;
}
