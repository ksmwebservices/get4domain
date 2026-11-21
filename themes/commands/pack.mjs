import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { packThemeDir } from '../lib/pack.mjs';

/** node themes/cli.mjs pack <theme-id | folder> [--out dir]  ->  dist/<id>-<version>.zip and dist/<id>-<version>.manifest.json */
export async function run({ flags, positional }) {
  const target = positional[0];
  if (!target) { console.error('Usage: node themes/cli.mjs pack <theme-id | folder> [--out dir]'); return 2; }
  const dir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.resolve(target) : path.join(THEMES_ROOT, 'library', target);
  if (!fs.existsSync(path.join(dir, 'theme.json'))) { console.error(`No theme.json in ${dir}`); return 2; }
  const { zip, manifest, validation } = packThemeDir(dir);
  if (!validation.ok) {
    console.error(`Package is NOT valid (${validation.errors.length} problem(s)):`);
    for (const e of validation.errors) console.error(`  [${e.code}] ${e.path}: ${e.message}`);
    return 1;
  }
  const outDir = flags.out && flags.out !== true ? path.resolve(flags.out) : path.join(THEMES_ROOT, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${manifest.id}-${manifest.version}`;
  fs.writeFileSync(path.join(outDir, `${base}.zip`), zip);
  fs.writeFileSync(path.join(outDir, `${base}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`packed ${base}.zip (${zip.length} bytes), contentHash ${manifest.contentHash}`);
  console.log(`  ${path.join(outDir, `${base}.zip`)}`);
  return 0;
}
