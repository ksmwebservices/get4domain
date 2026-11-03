#!/usr/bin/env node
// Get4Domain theme kit CLI. Plain Node, no dependencies. Commands are loaded on demand so a missing optional piece never blocks the others.
//   node themes/cli.mjs contract-table [--check]      regenerate (or check) the generated tables inside themes/CONTRACT.md
//   node themes/cli.mjs category-map [--check]        write (or check) themes/data/category-map.json for the backend importer
//   node themes/cli.mjs build-themes [--check]        copy the shared sources into each Standard theme (themes/source -> themes/library)
//   node themes/cli.mjs pack <theme-id|dir>            build dist/<id>-<version>.zip and its manifest with a content hash
//   node themes/cli.mjs validate-package <file.zip>    check a zip without extracting or executing anything in it
//   node themes/cli.mjs lint [theme-id | --all] [--category id | --all-categories] [--json file] [--browser]
//   node themes/cli.mjs preview [--port 4173]          local review server on 127.0.0.1 only
//   node themes/cli.mjs shots --theme id --category id | --all      PNG screenshots at 360, 768 and 1280 px into themes/.shots/
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const THEMES_ROOT = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  'contract-table': './commands/contract-table.mjs',
  'category-map': './commands/category-map.mjs',
  'build-themes': './commands/build-themes.mjs',
  pack: './commands/pack.mjs',
  'validate-package': './commands/validate-package.mjs',
  lint: './commands/lint.mjs',
  preview: './commands/preview.mjs',
  shots: './commands/shots.mjs',
};

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !COMMANDS[cmd]) {
    console.error(`Usage: node themes/cli.mjs <${Object.keys(COMMANDS).join('|')}> [options]`);
    process.exit(cmd ? 2 : 0);
  }
  const mod = await import(COMMANDS[cmd]);
  const code = await mod.run(parseArgs(rest));
  process.exit(typeof code === 'number' ? code : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(2); });
}
