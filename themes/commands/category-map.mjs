import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { categoryMapJson } from '../lib/category-map.mjs';

/** node themes/cli.mjs category-map [--check]   Writes (or checks) themes/data/category-map.json. */
export async function run({ flags }) {
  const file = path.join(THEMES_ROOT, 'data', 'category-map.json');
  const next = categoryMapJson();
  if (flags.check) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== next) { console.error('themes/data/category-map.json is out of date: run `node themes/cli.mjs category-map`'); return 1; }
    console.log('themes/data/category-map.json is current');
    return 0;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  console.log(`written ${file}`);
  return 0;
}
