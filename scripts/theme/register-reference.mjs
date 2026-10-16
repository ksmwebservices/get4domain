#!/usr/bin/env node
// Registers the reference themes (themes/reference/*) through the SAME admin import route the Theme marketplace screen uses, then makes each a free default design for its
// category. DRY RUN BY DEFAULT: it only reports what it would do. Nothing is written until --apply.
//
//   node scripts/theme/register-reference.mjs --api https://gapi.get4domain.com --token <admin JWT> [--apply]
//   (or set G4D_API and G4D_TOKEN). Run it on your own computer; the token is never stored or printed.
//
// Which built-in design each reference theme replaces (the vendor still sees exactly four designs per category) is recorded here and nowhere else:
//   clinic-calm        replaces "warm"  (clinic, diagnostics)
//   restaurant-hearth  replaces "bold"  (restaurant)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { core } from './lib-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const refDir = resolve(here, '..', '..', 'themes', 'reference');
const REPLACES = { 'clinic-calm': 'warm', 'restaurant-hearth': 'bold' };

const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const api = (val('--api') || process.env.G4D_API || '').replace(/\/+$/, '');
const token = val('--token') || process.env.G4D_TOKEN || '';
const apply = args.includes('--apply');
if (!api || !token) { console.error('Give the API address and an admin token: --api https://gapi.get4domain.com --token <JWT> (or G4D_API and G4D_TOKEN).'); process.exit(2); }

function readDir(root, rel = '') {
  const out = [];
  for (const name of readdirSync(join(root, rel))) {
    const p = rel ? `${rel}/${name}` : name; const full = join(root, p);
    if (statSync(full).isDirectory()) out.push(...readDir(root, p)); else out.push({ path: p, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}
const headers = { Authorization: `Bearer ${token}` };
async function call(path, init = {}) {
  const res = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${j.message || res.status}`);
  return j.data ?? j;
}

let failed = false;
for (const name of readdirSync(refDir).filter((n) => existsSync(join(refDir, n, 'theme.json')))) {
  const files = readDir(join(refDir, name));
  const report = core.lintPackage(files);
  if (!report.ok) { console.log(`${name}: the lint found problems, skipped.\n${core.formatReport(report)}`); failed = true; continue; }
  const zip = Buffer.from(core.makeZip(files));
  const form = new FormData();
  form.append('file', new Blob([zip], { type: 'application/zip' }), `${name}.zip`);
  try {
    const dry = await call('/admin/themes/import?dryRun=1', { method: 'POST', body: form });
    if (!dry.ok) { console.log(`${name}: the import would be refused:\n${dry.lines.filter((l) => l.level === 'error').map((l) => `  ${l.text}`).join('\n')}`); failed = true; continue; }
    console.log(`${name}: dry run is clean (version ${dry.version}, ${dry.fileCount} files). ${apply ? '' : 'Add --apply to register it.'}`);
    if (!apply) continue;
    const form2 = new FormData(); form2.append('file', new Blob([zip], { type: 'application/zip' }), `${name}.zip`);
    const done = await call('/admin/themes/import', { method: 'POST', body: form2 });
    await call(`/admin/themes/${done.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'FREE_DEFAULT', replacesDesign: REPLACES[name] ?? null, status: 'LIVE' }) });
    console.log(`${name}: registered as a live free design (replaces "${REPLACES[name]}") with id ${done.id}.`);
  } catch (e) { console.log(`${name}: ${e.message}`); failed = true; }
}
process.exit(failed ? 1 : 0);
