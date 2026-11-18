// Starter themes (TM1 M6): real theme packages built from DATA. A recipe (themes/starter/recipes.json) names a base Standard theme and what to change: colour palette, font pair, corner radius, a few layout
// flavours (themes/starter/flavours.mjs) and the order of the home page sections. The base theme's own build (build-themes.mjs) supplies the templates, the shared core CSS and the category presets, so a starter is as
// well-formed as a library theme; this file only re-derives the tokens, re-colours the presets, appends the flavour CSS, re-composes the home page, narrows the theme to the recipe's categories and fills the
// marketplace block. The result goes through the same pack step as every theme (packFiles), so it is a zip with theme.json and a content hash. Pure: no network, no clock, no randomness; the same recipe always gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_ROOT, buildThemeFiles, expand, tokensCss } from './build-themes.mjs';
import { CATEGORIES, FAMILIES } from './categories.mjs';
import { packFiles } from './pack.mjs';
import { paletteFindings } from './preset.mjs';
import { THEME_TEXT, makePalette } from './preset-build.mjs';
import { FLAVOURS } from '../starter/flavours.mjs';

export const STARTER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'starter');
export const STARTER_LICENCE = 'Starter theme built by the Get4Domain team. Free to use by any business on a plan that includes the theme library.';
/** Plain names of the 16 packs, for the description of a starter. */
export const PACK_LABELS = {
  PROPERTY: 'property and real estate', CLINIC: 'clinics', LAB: 'diagnostic labs', PHARMACY: 'pharmacies', RETAIL: 'shops and retail', FOOD_SERVICE: 'food businesses', FIELD_SERVICE: 'home and field services',
  VEHICLE_SERVICE: 'vehicle services', LOGISTICS: 'logistics and movers', MEMBERSHIP_WELLNESS: 'wellness, fitness and beauty', EDUCATION: 'education and coaching', PRACTICE_LEGAL_FINANCE: 'legal and finance practices',
  AGENCY_CONSULTING: 'agencies and consultants', HOSPITALITY_EVENTS: 'hospitality and events', RENTAL_FLEET: 'rentals and travel', B2B_DEALER: 'B2B suppliers and dealers',
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const starterRecipes = () => readJson(path.join(STARTER_DIR, 'recipes.json')).recipes;
export const catalogueByPack = () => readJson(path.join(STARTER_DIR, 'catalogue-by-pack.json'));

const PARTIAL = /\{\{>\s*([a-z0-9-]+)\s*\}\}/g;

/** The home page of a base theme as an ordered list of section partials, with head and foot taken off. */
export function homeSections(baseId, root = SOURCE_ROOT) {
  const own = path.join(root, baseId, 'templates', 'home.html');
  const text = fs.readFileSync(fs.existsSync(own) ? own : path.join(root, 'shared', 'templates', 'home.html'), 'utf8');
  return [...text.matchAll(PARTIAL)].map((m) => m[1]).filter((n) => n !== 'head' && n !== 'foot');
}

/** Applies a recipe's home edits (drop, move, insert) to a list of sections. A partial named by a move or insert that is not in the list is placed at the end. Pure. */
export function composeSections(sections, ops = {}) {
  let out = sections.filter((s) => !(ops.drop ?? []).includes(s));
  const place = (name, after) => { out = out.filter((s) => s !== name); const i = out.indexOf(after); if (i < 0) out.push(name); else out.splice(i + 1, 0, name); };
  for (const m of ops.move ?? []) if (out.includes(m.partial)) place(m.partial, m.after);
  for (const m of ops.insert ?? []) if (!out.includes(m.partial)) place(m.partial, m.after);
  return out;
}
export const homeTemplate = (sections) => `{{> head}}\n<main id="main">\n${sections.map((s) => `{{> ${s}}}`).join('\n')}\n</main>\n{{> foot}}`;

const uniq = (xs) => [...new Set(xs)];

/** The description a starter carries: honest about who built it and what it is for. */
export function starterDescription(recipe) {
  const who = recipe.packs.map((p) => PACK_LABELS[p] ?? p.toLowerCase()).join(', ');
  return `Starter theme built by the Get4Domain team. ${recipe.tagline} Designed for ${who}.`.slice(0, 400);
}

/** The marketplace block of a recipe: names only (the backend checks that every name is real). The catalogue ids come from the packs; a kit-only id is never listed, its catalogue equivalents are already in its pack. */
export function starterMarketplace(recipe, catalogue = catalogueByPack()) {
  const ids = uniq(recipe.packs.flatMap((p) => catalogue.packs[p] ?? []));
  return {
    packs: [...recipe.packs],
    ...(recipe.addons.length ? { addons: [...recipe.addons] } : {}), ...(recipe.capabilities.length ? { capabilities: [...recipe.capabilities] } : {}), ...(recipe.tags.length ? { tags: [...recipe.tags] } : {}),
    catalogueCategories: ids, licence: STARTER_LICENCE, starter: true,
  };
}

/** What makes two recipes the same look: colour, fonts, corners, flavours and home layout. A test asks that no two recipes share it. */
export const lookSignature = (r) => JSON.stringify([r.base, r.palette.h, r.palette.s, r.fonts.heading, r.fonts.body, r.radius, [...r.flavours].sort(), r.home ?? {}]);

/** @returns {Promise<{ files: Record<string, Buffer>, zip: Buffer, manifest: object }>} one real package, packed with its content hash */
export async function buildStarter(recipe, { root = SOURCE_ROOT, catalogue = catalogueByPack() } = {}) {
  const base = await buildThemeFiles(recipe.base, { root });
  const files = { ...base.files };
  const palette = makePalette(recipe.palette);
  const problems = paletteFindings(palette, THEME_TEXT);
  if (problems.length) throw new Error(`starter ${recipe.id}: its palette fails contrast: ${problems.join('; ')}`);
  for (const f of recipe.flavours) if (!FLAVOURS[f]) throw new Error(`starter ${recipe.id}: unknown flavour "${f}"`);

  // the home page sections in the recipe's order; a section the recipe dropped is also taken out of every preset's hidden and order lists (a preset may not name a section the home page does not have)
  const sections = composeSections(homeSections(recipe.base, root), recipe.home);

  // tokens and the presets (the preset palette beats the theme default, so it is re-coloured too)
  files['css/tokens.css'] = Buffer.from(tokensCss({ id: recipe.id, palette, radius: recipe.radius, fonts: recipe.fonts }), 'utf8');
  const baseManifest = JSON.parse(files['theme.json'].toString('utf8'));
  for (const c of recipe.categories) if (!baseManifest.categories.includes(c)) throw new Error(`starter ${recipe.id}: ${c} is not a category of ${recipe.base}`);
  for (const p of Object.keys(files)) {
    const m = p.match(/^presets\/([a-z0-9-]+)\.json$/);
    if (!m) continue;
    if (!recipe.categories.includes(m[1])) { delete files[p]; continue; }
    const preset = JSON.parse(files[p].toString('utf8'));
    preset.palette = palette; preset.fonts = { heading: recipe.fonts.heading, body: recipe.fonts.body };
    if (preset.sections) {
      const kept = {};
      for (const k of ['order', 'hidden']) { const v = (preset.sections[k] ?? []).filter((s) => sections.includes(s)); if (v.length) kept[k] = v; }
      if (Object.keys(kept).length) preset.sections = kept; else delete preset.sections;
    }
    files[p] = Buffer.from(`${JSON.stringify(preset, null, 2)}\n`, 'utf8');
  }

  // layout: the flavour CSS after the shared core, and the home page sections in the recipe's order
  const flavourCss = `\n/* starter flavours: ${recipe.flavours.join(', ')} */\n${recipe.flavours.map((f) => FLAVOURS[f].css).join('')}`;
  files['css/base.css'] = Buffer.from(files['css/base.css'].toString('utf8') + flavourCss, 'utf8');
  files['templates/home.html'] = Buffer.from(`${expand(homeTemplate(sections), recipe.base, root)}\n`, 'utf8');

  // the manifest: narrowed to the recipe's categories (and the families they belong to), with the marketplace block
  const families = uniq(recipe.categories.map((c) => CATEGORIES.find((x) => x.id === c).family));
  const manifest = {
    id: recipe.id, version: 1, name: recipe.name, description: starterDescription(recipe), author: 'Get4Domain', tier: 'Standard', tracks: baseManifest.tracks, families, categories: [...recipe.categories],
    layoutVariantRules: Object.fromEntries(families.map((f) => [f, FAMILIES[f].variant.id])), motion: baseManifest.motion, settingsSchema: baseManifest.settingsSchema,
    fonts: uniq([recipe.fonts.heading, recipe.fonts.body, 'Noto Sans Tamil']), marketplace: starterMarketplace(recipe, catalogue),
  };
  files['theme.json'] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const packed = packFiles(files);
  return { files: packed.files, zip: packed.zip, manifest: packed.manifest };
}

export async function buildAllStarters(opts = {}) {
  const out = [];
  for (const recipe of starterRecipes()) out.push({ recipe, ...(await buildStarter(recipe, opts)) });
  return out;
}
