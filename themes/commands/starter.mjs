// node themes/cli.mjs starter [--out dir] [--only id] [--list] [--lint]
//   builds the starter theme packages from themes/starter/recipes.json into <out> (default themes/dist/starter): one <id>-<version>.zip each and an index.json. --list only prints them. --lint also runs the kit lint.
import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { themeFromFiles } from '../lib/theme.mjs';
import { validatePackage } from '../lib/pack.mjs';
import { buildStarter, starterRecipes } from '../lib/starter-build.mjs';

export async function run({ flags }) {
  const recipes = starterRecipes().filter((r) => !flags.only || r.id === flags.only);
  if (!recipes.length) { console.error(`no starter recipe${flags.only ? ` named ${flags.only}` : ''}`); return 1; }
  if (flags.list) { for (const r of recipes) console.log(`${r.id.padEnd(28)} ${r.base.padEnd(18)} ${r.packs.join(',')}${r.tags.length ? `  [${r.tags.join(', ')}]` : ''}`); return 0; }
  const out = path.resolve(typeof flags.out === 'string' ? flags.out : path.join(THEMES_ROOT, 'dist', 'starter'));
  fs.mkdirSync(out, { recursive: true });
  const index = []; let failed = 0;
  for (const r of recipes) {
    const built = await buildStarter(r);
    const v = validatePackage(built.zip);
    let lint = 'skipped';
    if (flags.lint) { const l = lintTheme(themeFromFiles(built.files), {}); lint = l.ok ? 'ok' : `${l.findings.length} finding(s): ${l.findings[0].rule}`; }
    const ok = v.ok && (lint === 'skipped' || lint === 'ok');
    if (!ok) failed += 1;
    fs.writeFileSync(path.join(out, `${r.id}-${built.manifest.version}.zip`), built.zip);
    index.push({ id: r.id, version: built.manifest.version, packs: r.packs, tags: r.tags, bytes: built.zip.length, contentHash: built.manifest.contentHash, validator: v.ok ? 'ok' : v.errors.map((e) => `${e.path} [${e.code}]`), lint });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.id} (${built.zip.length} bytes) validator ${v.ok ? 'ok' : 'FAILED'}, lint ${lint}`);
  }
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify({ count: index.length, themes: index }, null, 2)}\n`);
  console.log(`${index.length} starter package(s) in ${out}${failed ? `; ${failed} FAILED` : ''}`);
  return failed ? 1 : 0;
}
