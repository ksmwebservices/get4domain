// The Bolt kit: a self-contained copy of the theme kit that a designer can drop into a Bolt project (Node in the browser, no repository).
// Contents: the kit as it is (cli, lib, commands, schema, fixtures, data, shared), a package.json with four scripts and no dependencies,
// the _starter theme and all Standard themes as reference examples, the motion kit, the contract, and BOLT_BRIEF.md (generated from the code).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './zip.mjs';
import { LIBRARY_DIR, loadTheme, listThemeIds } from './theme.mjs';
import { boltBrief } from './bolt-brief.mjs';

const THEMES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BOLT_KIT_NAME = 'get4domain-bolt-kit.zip';
const KIT_DIRS = ['lib', 'commands', 'schema', 'fixtures', 'data', 'shared'];
const KIT_FILES = ['cli.mjs', 'CONTRACT.md', 'MOTION_KIT.md'];

export const boltPackageJson = () => ({
  name: 'get4domain-theme-kit',
  private: true,
  type: 'module',
  description: 'Get4Domain theme kit for Bolt: build a theme in library/<id>/, then lint it and preview it. No dependencies.',
  engines: { node: '>=18' },
  scripts: {
    lint: 'node cli.mjs lint',
    'lint:all': 'node cli.mjs lint --all',
    preview: 'node cli.mjs preview',
    pack: 'node cli.mjs pack',
  },
});

const walk = (absDir, rel, out) => {
  for (const ent of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = `${rel}/${ent.name}`;
    if (ent.isDirectory()) walk(path.join(absDir, ent.name), r, out);
    else if (ent.isFile()) out[r] = fs.readFileSync(path.join(absDir, ent.name));
  }
};

/** @returns {Record<string, Buffer>} every file of the kit, keyed by its forward-slash path inside the zip */
export function boltKitFiles() {
  const files = {};
  for (const d of KIT_DIRS) walk(path.join(THEMES_ROOT, d), d, files);
  for (const f of KIT_FILES) files[f] = fs.readFileSync(path.join(THEMES_ROOT, f));
  // reference themes: the internal starter plus every Standard theme (never a Premium theme in progress)
  for (const id of listThemeIds()) {
    const t = loadTheme(id);
    if (id === '_starter' || t.manifest.tier === 'Standard') walk(path.join(LIBRARY_DIR, id), `library/${id}`, files);
  }
  files['package.json'] = Buffer.from(`${JSON.stringify(boltPackageJson(), null, 2)}\n`, 'utf8');
  files['BOLT_BRIEF.md'] = Buffer.from(boltBrief(), 'utf8');
  return files;
}

export function buildBoltKit() {
  const files = boltKitFiles();
  return { zip: writeZip(Object.entries(files).map(([p, data]) => ({ path: p, data }))), files };
}
