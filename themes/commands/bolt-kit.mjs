import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { buildBoltKit, BOLT_KIT_NAME } from '../lib/bolt-kit.mjs';

/** node themes/cli.mjs bolt-kit [--out dir]  ->  themes/dist/get4domain-bolt-kit.zip (gitignored) */
export async function run({ flags }) {
  const { zip, files } = buildBoltKit();
  const outDir = flags.out && flags.out !== true ? path.resolve(flags.out) : path.join(THEMES_ROOT, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, BOLT_KIT_NAME);
  fs.writeFileSync(file, zip);
  const top = [...new Set(Object.keys(files).map((p) => p.split('/')[0]))].sort();
  console.log(`wrote ${file} (${zip.length} bytes, ${Object.keys(files).length} files)`);
  console.log(`  top level: ${top.join(', ')}`);
  return 0;
}
