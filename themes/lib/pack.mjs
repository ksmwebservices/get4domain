// Packing and validating theme packages. validatePackage() inspects a zip IN MEMORY: nothing is extracted to disk and nothing inside is
// executed, parsed as code or fetched. It looks at names, sizes, the first bytes of each file, the manifest and the placement tags only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeZip, readZip, isSafePath } from './zip.mjs';
import { validateManifest } from './schema.mjs';
import { LIMITS, PAGE_TEMPLATES, CSS_FILES, SLOT_TAGS } from './vocabulary.mjs';
import { validatePreset } from './preset.mjs';
import { hasCategory } from './categories.mjs';

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** sha256 over every file except theme.json (path + file hash), plus theme.json with its own contentHash removed, in canonical form. */
export function computeContentHash(files) {
  const lines = [];
  for (const p of Object.keys(files).sort()) {
    if (p === 'theme.json') continue;
    lines.push(`${p}\0${sha256(files[p])}\n`);
  }
  const m = JSON.parse(files['theme.json'].toString('utf8'));
  delete m.contentHash;
  lines.push(`theme.json\0${sha256(canonicalJson(m))}\n`);
  return sha256(lines.join(''));
}

const ASSET_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'woff2'];
const EXECUTABLE_EXT = ['exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'vbs', 'vbe', 'wsf', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'php', 'phtml', 'py', 'rb', 'pl', 'jar', 'class', 'wasm', 'so', 'dylib', 'apk', 'app', 'dmg', 'bin', 'lnk', 'hta', 'htaccess', 'cgi', 'asp', 'aspx', 'jsp'];
const extOf = (p) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');
const startsWith = (b, bytes) => bytes.every((x, i) => b[i] === x);

/** Executable content by its first bytes, whatever the file is called. */
export function looksExecutable(b) {
  if (b.length < 2) return false;
  return startsWith(b, [0x4d, 0x5a]) // MZ (Windows PE)
    || startsWith(b, [0x7f, 0x45, 0x4c, 0x46]) // ELF
    || startsWith(b, [0x23, 0x21]) // #! script
    || startsWith(b, [0x00, 0x61, 0x73, 0x6d]) // wasm
    || startsWith(b, [0xca, 0xfe, 0xba, 0xbe]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xcf]) || startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) // Mach-O / Java class
    || startsWith(b, [0x50, 0x4b, 0x03, 0x04]); // a zip inside a zip
}

function assetTypeOk(ext, b) {
  const head = b.subarray(0, 16);
  switch (ext) {
    case 'png': return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg': case 'jpeg': return startsWith(head, [0xff, 0xd8, 0xff]);
    case 'webp': return head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP';
    case 'woff2': return head.toString('latin1', 0, 4) === 'wOF2';
    case 'svg': { const t = b.toString('utf8', 0, Math.min(b.length, 2048)).replace(/^﻿/, '').trimStart(); return t.startsWith('<') && /<svg[\s>]/i.test(t); }
    default: return true;
  }
}

export function svgProblem(text) {
  if (/<script[\s>]/i.test(text)) return 'contains a script';
  if (/\son[a-z]+\s*=/i.test(text)) return 'contains an event handler';
  if (/<foreignObject/i.test(text)) return 'contains foreignObject';
  if (/<(animate|set|animateTransform|animateMotion)[\s>/]/i.test(text)) return 'contains an animation element';
  if (/javascript:/i.test(text)) return 'contains a javascript: address';
  if (/(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i.test(text)) return 'refers to an outside address';
  if (/<(iframe|object|embed)[\s>]/i.test(text)) return 'contains an embedded object';
  return null;
}

const isTemplatePath = (p) => /^templates\/[a-z0-9-]+\.html$/.test(p) && PAGE_TEMPLATES.includes(p.slice('templates/'.length, -'.html'.length));
const isPresetPath = (p) => /^presets\/[a-z0-9-]+\.json$/.test(p);
const isCssPath = (p) => /^css\/[a-z]+\.css$/.test(p) && CSS_FILES.includes(p.slice(4, -4));

function listAssets(files) {
  return Object.keys(files).filter((p) => p.startsWith('assets/')).sort().map((p) => ({ path: p, bytes: files[p].length, sha256: sha256(files[p]) }));
}

/** Builds a package from an in-memory file map. Fills `assets` and `contentHash` in the manifest; the source files are not modified. */
export function packFiles(files) {
  const manifest = JSON.parse(files['theme.json'].toString('utf8'));
  manifest.assets = listAssets(files);
  delete manifest.contentHash;
  const withAssets = { ...files, 'theme.json': Buffer.from(JSON.stringify(manifest, null, 2) + '\n') };
  manifest.contentHash = computeContentHash(withAssets);
  const finalFiles = { ...withAssets, 'theme.json': Buffer.from(JSON.stringify(manifest, null, 2) + '\n') };
  const zip = writeZip(Object.entries(finalFiles).map(([p, data]) => ({ path: p, data })));
  return { zip, manifest, files: finalFiles };
}

export function readThemeDir(dir) {
  const files = {};
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(r);
      else if (ent.isFile()) files[r] = fs.readFileSync(path.join(dir, r));
    }
  };
  walk('');
  return files;
}

export function packThemeDir(dir) {
  const out = packFiles(readThemeDir(dir));
  return { ...out, validation: validatePackage(out.zip) };
}

/** @returns {{ok:boolean, errors:{code:string,path:string,message:string}[], warnings:string[], manifest:object|null, files:Record<string,Buffer>}} */
export function validatePackage(zipBuf) {
  const errors = [];
  const add = (code, p, message) => errors.push({ code, path: p, message });
  const out = (manifest = null, files = {}) => ({ ok: errors.length === 0, errors, warnings: [], manifest, files });

  if (zipBuf.length > LIMITS.packageBytes) add('package-too-large', '', `the package is ${zipBuf.length} bytes; the limit is ${LIMITS.packageBytes}`);
  const z = readZip(zipBuf);
  for (const p of z.problems) add('zip-corrupt', '', p);
  if (z.problems.length && !z.entries.length) return out();
  if (z.entries.length > LIMITS.maxFiles) add('too-many-files', '', `${z.entries.length} files; the limit is ${LIMITS.maxFiles}`);

  const seen = new Set();
  let declared = 0;
  const files = {};
  for (const e of z.entries) {
    const p = e.path;
    if (!isSafePath(p)) { add('path-traversal', p, `unsafe path ${JSON.stringify(p)}`); continue; }
    if (seen.has(p)) { add('duplicate-path', p, 'the same path appears twice'); continue; }
    seen.add(p);
    if (e.symlink) { add('symlink', p, 'symbolic links are not allowed'); continue; }
    declared += e.size;
    const ext = extOf(p);
    if (EXECUTABLE_EXT.includes(ext)) { add('executable-file', p, `.${ext} files are not allowed in a theme`); continue; }
    if (e.size > LIMITS.fileBytes) { add('file-too-large', p, `${e.size} bytes; the limit is ${LIMITS.fileBytes}`); continue; }
    if (e.size > 10 * 1024 && e.size / Math.max(e.csize, 1) > LIMITS.maxExpansionRatio) { add('expansion-ratio', p, 'expands far more than a normal file (possible zip bomb)'); continue; }
    if (declared > LIMITS.packageBytes * 3) { add('expanded-too-large', '', 'the package would expand to more than three times the size limit'); break; }

    const placed = p === 'theme.json' || isTemplatePath(p) || isCssPath(p) || isPresetPath(p) || (p.startsWith('assets/') && ASSET_EXT.includes(ext));
    if (!placed) { add('unknown-file', p, 'this file is not part of the package layout (theme.json, templates/, css/, assets/)'); continue; }

    let data;
    try { data = e.read(e.size); } catch (err) { add('zip-corrupt', p, String(err.message ?? err)); continue; }
    if (data.length !== e.size) { add('zip-corrupt', p, 'declared size does not match the content'); continue; }
    files[p] = data;
    if (looksExecutable(data)) { add('executable-file', p, 'the file content is executable code'); continue; }
    if (p.startsWith('assets/')) {
      if (!assetTypeOk(ext, data)) { add('asset-type-mismatch', p, `the content is not a real .${ext} file`); continue; }
      if (ext === 'svg') { const prob = svgProblem(data.toString('utf8')); if (prob) add('unsafe-asset', p, `the SVG ${prob}`); }
    }
  }

  for (const required of ['theme.json', 'templates/home.html', ...CSS_FILES.map((c) => `css/${c}.css`)]) {
    if (!seen.has(required)) add('missing-file', required, `${required} is required`);
  }

  for (const [p, data] of Object.entries(files)) {
    if (!isTemplatePath(p)) continue;
    const html = data.toString('utf8');
    for (const m of html.matchAll(/<(g4d-[a-z0-9-]*)/gi)) {
      if (!SLOT_TAGS.includes(m[1].toLowerCase())) add('unknown-slot', p, `<${m[1]}> is not a platform slot`);
    }
  }

  let manifest = null;
  if (files['theme.json']) {
    try { manifest = JSON.parse(files['theme.json'].toString('utf8')); } catch { add('manifest-invalid', 'theme.json', 'theme.json is not valid JSON'); }
  }
  if (manifest) {
    for (const e of validateManifest(manifest, { mode: 'package' })) add('manifest-invalid', `theme.json:${e.path}`, `${e.message} (${e.code})`);
    const listed = JSON.stringify((manifest.assets ?? []).map((a) => [a.path, a.bytes, a.sha256]));
    const actual = JSON.stringify(listAssets(files).map((a) => [a.path, a.bytes, a.sha256]));
    if (Array.isArray(manifest.assets) && listed !== actual) add('asset-list-mismatch', 'theme.json:assets', 'the asset list in theme.json does not match the files');
    if (typeof manifest.contentHash === 'string' && !errors.some((e) => ['zip-corrupt', 'unknown-file'].includes(e.code))) {
      if (computeContentHash(files) !== manifest.contentHash) add('hash-mismatch', 'theme.json:contentHash', 'the content hash does not match the package content');
    }
    for (const [path, data] of Object.entries(files)) {
      if (!isPresetPath(path)) continue;
      const category = path.slice('presets/'.length, -'.json'.length);
      let preset;
      try { preset = JSON.parse(data.toString('utf8')); } catch { add('preset-invalid', path, 'the preset is not valid JSON'); continue; }
      if (!hasCategory(category)) { add('preset-invalid', path, `"${category}" is not one of the 41 category ids`); continue; }
      if (Array.isArray(manifest.categories) && !manifest.categories.includes(category)) add('preset-category', path, `the theme does not list the category ${category}`);
      for (const e of validatePreset(preset, { manifest, file: path })) add('preset-invalid', path, `${e.path}: ${e.message} (${e.code})`);
    }
  }
  return out(manifest, files);
}
