#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Builds the theme kit's renderer for the backend (slice 5.4, docs/v3/V3_S4_RENDERER_PUBLISH.md section 2).
 *
 * ONE SOURCE OF TRUTH: the renderer, lint, schemas and the theme library live in ../themes (plain ESM, zero dependencies). The backend is CommonJS, so this
 * script turns the kit's modules into CommonJS files in an output folder (dist/renderer by default) at build time. Nothing is copied into backend-api's
 * source tree; the output is generated, git-ignored and thrown away on every build. test/site-single-copy.spec.ts fails if a second copy ever appears.
 *
 *   node scripts/build-renderer.js [outDir]            (default: dist/renderer, next to this folder)
 *
 * What it does: starts from the kit entry modules, follows their relative imports, rewrites each .mjs to .cjs with the TypeScript compiler (already a
 * devDependency), replaces import.meta.url by its CommonJS equivalent, copies themes/library and themes/data unchanged, and records a hash of every source.
 * It reads nothing from the network and writes only inside outDir.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND = path.resolve(__dirname, '..');
const THEMES = path.resolve(BACKEND, '..', 'themes');
const DEFAULT_OUT = path.join(BACKEND, 'dist', 'renderer');
const ENTRIES = ['lib/render.mjs', 'lib/theme.mjs', 'lib/lint.mjs', 'lib/pack.mjs', 'lib/categories.mjs', 'lib/schema.mjs', 'lib/preset.mjs', 'fixtures/index.mjs'];
const COPY_DIRS = ['library', 'data'];
const MARKER = '.g4d-renderer-build.json';

function requireThemes() {
  if (!fs.existsSync(path.join(THEMES, 'lib', 'render.mjs'))) {
    throw new Error(`The theme kit was not found at ${THEMES}. The renderer is built from the repository's themes/ folder: build from the repository root (a Docker build context of backend-api alone cannot see it; use backend-api/Dockerfile.with-themes).`);
  }
}

/** Every module reachable from the entries through relative imports, as paths relative to THEMES (posix). */
function closure() {
  const seen = new Set();
  const queue = [...ENTRIES];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const src = fs.readFileSync(path.join(THEMES, rel), 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.\.?\/[^'"]+\.mjs)['"]/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
  }
  return [...seen].sort();
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Hash of everything the build reads, so a cached build can be reused and a changed kit is noticed. */
function sourceHash() {
  requireThemes();
  const h = crypto.createHash('sha256');
  const files = [...closure(), ...COPY_DIRS.flatMap((d) => walk(path.join(THEMES, d)).map((f) => `${d}/${f}`))];
  for (const f of files) h.update(f).update('\0').update(fs.readFileSync(path.join(THEMES, f))).update('\0');
  return h.digest('hex');
}

// .mjs input is always kept as an ES module by the compiler, so the source is handed over under a .ts name (it is plain JavaScript; nothing is type checked).
function transform(rel, src) {
  const ts = require('typescript');
  const prepared = src.replace(/import\.meta\.url/g, "require('node:url').pathToFileURL(__filename).href");
  const out = ts.transpileModule(prepared, { fileName: rel.replace(/.mjs$/, '.ts'), reportDiagnostics: false, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true, sourceMap: false } });
  return out.outputText.replace(/require\((["'])(\.\.?\/[^"']+)\.mjs\1\)/g, 'require($1$2.cjs$1)');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name); const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.writeFileSync(b, fs.readFileSync(a));
  }
}

/** Builds into outDir (replacing a previous build of the same folder; only a folder this script made, or an empty/new one, is ever replaced). */
function build(outDir = DEFAULT_OUT) {
  requireThemes();
  const out = path.resolve(outDir);
  if (fs.existsSync(out)) {
    if (!fs.existsSync(path.join(out, MARKER)) && fs.readdirSync(out).length > 0) throw new Error(`Refusing to build into ${out}: it exists, is not empty and was not made by this script.`);
    fs.rmSync(out, { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  const modules = closure();
  for (const rel of modules) {
    const target = path.join(out, rel.replace(/\.mjs$/, '.cjs'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, transform(rel, fs.readFileSync(path.join(THEMES, rel), 'utf8')));
  }
  for (const d of COPY_DIRS) copyDir(path.join(THEMES, d), path.join(out, d));
  fs.writeFileSync(path.join(out, 'package.json'), '{ "type": "commonjs" }\n');
  const info = { sourceHash: sourceHash(), modules: modules.length, entries: ENTRIES };
  fs.writeFileSync(path.join(out, MARKER), `${JSON.stringify(info, null, 2)}\n`);
  return { outDir: out, ...info };
}

module.exports = { build, sourceHash, MARKER, DEFAULT_OUT };

if (require.main === module) {
  try {
    const r = build(process.argv[2]);
    console.log(`renderer built: ${r.modules} modules -> ${path.relative(process.cwd(), r.outDir) || '.'} (source ${r.sourceHash.slice(0, 12)})`);
  } catch (e) {
    console.error(`build-renderer failed: ${e.message}`);
    process.exit(1);
  }
}
