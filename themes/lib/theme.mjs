// Loading a theme from a folder or from a file map into the shape the renderer and the lint use:
//   { manifest, templates: { home: '<html>', ... }, css: { base, tokens, motion, print }, assets: { 'assets/x.svg': Buffer }, dir? }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readThemeDir } from './pack.mjs';
import { CSS_FILES } from './vocabulary.mjs';

export const LIBRARY_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'library');

export function themeFromFiles(files, dir = null) {
  const text = (p) => (files[p] ? files[p].toString('utf8') : undefined);
  let manifest = {};
  try { manifest = JSON.parse(text('theme.json') ?? '{}'); } catch { manifest = {}; }
  const templates = {};
  const css = {};
  const assets = {};
  const presets = {};
  const presetErrors = [];
  for (const p of Object.keys(files)) {
    let m;
    if ((m = p.match(/^templates\/([a-z0-9-]+)\.html$/))) templates[m[1]] = text(p);
    else if ((m = p.match(/^css\/([a-z]+)\.css$/)) && CSS_FILES.includes(m[1])) css[m[1]] = text(p);
    else if ((m = p.match(/^presets\/([a-z0-9-]+)\.json$/))) { try { presets[m[1]] = JSON.parse(text(p)); } catch { presetErrors.push({ file: p, message: 'the preset is not valid JSON' }); } }
    else if (p.startsWith('assets/')) assets[p] = files[p];
  }
  return { manifest, templates, css, assets, presets, presetErrors, dir };
}

export function loadTheme(idOrDir) {
  const dir = fs.existsSync(path.join(String(idOrDir), 'theme.json')) ? path.resolve(idOrDir) : path.join(LIBRARY_DIR, idOrDir);
  if (!fs.existsSync(path.join(dir, 'theme.json'))) throw new Error(`No theme found at ${dir}`);
  return themeFromFiles(readThemeDir(dir), dir);
}

export function listThemeIds() {
  if (!fs.existsSync(LIBRARY_DIR)) return [];
  return fs.readdirSync(LIBRARY_DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(LIBRARY_DIR, d.name, 'theme.json'))).map((d) => d.name).sort();
}

/** The layout CSS (base + tokens + print) and the motion CSS, as the importer would concatenate them. */
export const layoutCss = (t) => [t.css.tokens, t.css.base, t.css.print].filter(Boolean).join('\n');
export const allCss = (t) => [t.css.tokens, t.css.base, t.css.motion, t.css.print].filter(Boolean).join('\n');

/** Themes a vendor may ever be offered: everything in the library except internal kit themes such as _starter. */
export function listVendorThemeIds() {
  return listThemeIds().filter((id) => {
    try { return JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, id, 'theme.json'), 'utf8')).internal !== true; } catch { return false; }
  });
}
