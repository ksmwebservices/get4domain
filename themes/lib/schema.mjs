// Validates a theme manifest against themes/schema/theme.schema.json plus the cross-field rules the schema cannot express.
// A deliberately small JSON-Schema subset validator (type, enum, pattern, min/max, items, properties, required, additionalProperties,
// uniqueItems): enough for the manifest, readable in one screen, and importable by the backend later (no dependencies).
import { buildSchema } from './schema-build.mjs';
import { categoryById, FAMILIES } from './categories.mjs';

export const SCHEMA = buildSchema();

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);

/** @returns {{path:string,code:string,message:string}[]} */
export function validateAgainst(schema, value, path = '', out = []) {
  const err = (code, message) => out.push({ path, code, message });
  if (schema.type && !isType(value, schema.type)) { err('type', `${path || 'value'} must be ${schema.type}, got ${typeOf(value)}`); return out; }
  if (schema.enum && !schema.enum.includes(value)) err('enum', `${path} must be one of: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) err('pattern', `${path} has the wrong format`);
    if (schema.minLength !== undefined && value.length < schema.minLength) err('minLength', `${path} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) err('maxLength', `${path} is too long`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) err('minimum', `${path} must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) err('minItems', `${path} needs at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) err('maxItems', `${path} allows at most ${schema.maxItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((x) => JSON.stringify(x))).size !== value.length) err('uniqueItems', `${path} has duplicates`);
    if (schema.items) value.forEach((v, i) => validateAgainst(schema.items, v, `${path}[${i}]`, out));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) out.push({ path: path ? `${path}.${k}` : k, code: 'required', message: `${path ? `${path}.` : ''}${k} is required` });
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties?.[k];
      const p = path ? `${path}.${k}` : k;
      if (sub) validateAgainst(sub, v, p, out);
      else if (schema.additionalProperties === false) out.push({ path: p, code: 'additional', message: `${p} is not a known field` });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateAgainst(schema.additionalProperties, v, p, out);
    }
  }
  return out;
}

/**
 * @param {object} manifest
 * @param {{mode?:'source'|'package'}} [opts] package mode also requires `assets` and `contentHash`
 */
export function validateManifest(manifest, { mode = 'source' } = {}) {
  const schema = mode === 'package' ? { ...SCHEMA, required: [...SCHEMA.required, 'assets', 'contentHash'] } : SCHEMA;
  const errors = validateAgainst(schema, manifest);
  if (errors.length) return errors;

  const m = manifest;
  m.families.forEach((f, i) => { if (!m.tracks.includes(FAMILIES[f].track)) errors.push({ path: `families[${i}]`, code: 'family-track', message: `family ${f} belongs to the ${FAMILIES[f].track} track, which the theme does not declare` }); });
  m.categories.forEach((id, i) => {
    const c = categoryById(id);
    if (!m.families.includes(c.family)) errors.push({ path: `categories[${i}]`, code: 'category-family', message: `${id} belongs to family ${c.family}, which the theme does not declare` });
    if (!m.tracks.includes(c.track)) errors.push({ path: `categories[${i}]`, code: 'category-track', message: `${id} belongs to the ${c.track} track, which the theme does not declare` });
    if (!c.tiers.includes(m.tier)) errors.push({ path: `categories[${i}]`, code: 'category-tier', message: `${id} is not eligible for the ${m.tier} tier` });
  });
  for (const [family, variantId] of Object.entries(m.layoutVariantRules)) {
    if (!m.families.includes(family)) errors.push({ path: `layoutVariantRules.${family}`, code: 'variant-family', message: `${family} is not a declared family` });
    else if (FAMILIES[family].variant.id !== variantId) errors.push({ path: `layoutVariantRules.${family}`, code: 'variant-override', message: `the variant is set by the category's family (${FAMILIES[family].variant.id}); a theme cannot override it` });
  }
  const variantIds = new Set(Object.values(FAMILIES).map((f) => f.variant.id));
  for (const id of Object.keys(m.motion.variantDefaults ?? {})) if (!variantIds.has(id)) errors.push({ path: `motion.variantDefaults.${id}`, code: 'variant-unknown', message: `${id} is not a known layout variant` });
  return errors;
}
