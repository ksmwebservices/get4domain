// The category -> flow family -> as-built pack mapping, exported as plain JSON (themes/data/category-map.json) so the backend importer can read it later.
// Generated from lib/categories.mjs; a test fails if the committed file drifts. The mapping is an INFERENCE (the backend states none of it).
import { CATEGORIES, FAMILIES, FLOWS } from './categories.mjs';

const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));

export function buildCategoryMap() {
  const categories = {};
  const packs = {};
  for (const c of CATEGORIES) {
    categories[c.id] = { track: c.track, family: c.family, flow: c.flow, packKey: c.packKey, schemaType: c.schemaType, ctaPrimary: c.ctaPrimary };
    (packs[c.packKey] ??= []).push(c.id);
  }
  const families = Object.fromEntries(Object.entries(FAMILIES).map(([id, f]) => [id, { label: f.label, track: f.track, variant: f.variant.id }]));
  return {
    schemaVersion: 1,
    status: 'inference',
    note: 'Inference made by the theme kit (THEMES-CC-0): the backend states none of this. "flow" is the nearest as-built flow family (8) and "packKey" the nearest as-built category pack (24) for each of the 41 V3 categories. Accepted by the owner as an inference for now; review before the importer relies on it.',
    generatedFrom: 'themes/lib/categories.mjs (node themes/cli.mjs category-map)',
    flows: [...FLOWS],
    families: sorted(families),
    categories: sorted(categories),
    packs: sorted(Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, [...v].sort()]))),
  };
}

export const categoryMapJson = () => `${JSON.stringify(buildCategoryMap(), null, 2)}\n`;
