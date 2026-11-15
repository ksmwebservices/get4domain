import { checkValue, cleanText, FieldDef, FIELD_TYPES, isFieldKey, LIMITS } from '../../v3-pack-records/core/record-core';
import { checkWording } from '../../v3-website/core/wording-core';

/**
 * Industry profile fields (Wave 2 Part E). PURE: no clock, no database. A pack (one of 16) has a set of fields every one of its categories inherits; a category can override or add a field, but only where the catalog says
 * so (its field hints). The values a business gives are checked against the resolved set, then mapped into the vendor site content through DATA rows (the map), never through a branch on an industry.
 * Rules that never bend: unknown fields are refused, every text is plain (no markup), no text may promise a result or a ranking (the same filter as the SEO text), and no price is written here: prices live in the price list, before GST.
 */
export const PROFILE_TYPES = [...FIELD_TYPES, 'textlist', 'servicelist', 'imagelist'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];
export const isProfileType = (v: unknown): v is ProfileType => typeof v === 'string' && (PROFILE_TYPES as readonly string[]).includes(v);
export const SITE_SECTIONS = ['hero', 'about', 'services', 'hours', 'contact', 'social', 'gallery', 'details'] as const;

export interface ProfileField { packKey: string; categorySlug: string; fieldKey: string; label: string; type: ProfileType; required: boolean; options: string[]; sortOrder: number; siteSection: string; active: boolean }
export interface SiteMapRow { packKey: string; categorySlug: string; fieldKey: string; targetKind: 'FIELD' | 'LIST' | 'NONE'; targetKey: string; itemMap: Record<string, unknown>; active: boolean }

/** [key, label, type, flags (r required), siteSection, options] */
type Spec = readonly [string, string, ProfileType, string, string, string[]?];
const t = (k: string, l: string, ty: ProfileType, f = '', s = 'details', o?: string[]): Spec => [k, l, ty, f, s, o];

/** The common set every business has, in this order. Addresses carry the locality and the pincode; services carry a short description each. */
export const COMMON_FIELDS: readonly Spec[] = [
  t('business_name', 'Business name', 'text', 'r', 'hero'), t('tagline', 'Tagline', 'text', '', 'hero'), t('about', 'About the business', 'longtext', '', 'about'),
  t('services', 'Services', 'servicelist', '', 'services'), t('opening_hours', 'Opening hours', 'text', '', 'hours'),
  t('address_line', 'Address', 'text', '', 'contact'), t('locality', 'Locality', 'text', '', 'contact'), t('city', 'City', 'text', '', 'contact'), t('state', 'State', 'text', '', 'contact'), t('pincode', 'Pincode', 'text', '', 'contact'),
  t('phone', 'Phone', 'phone', '', 'contact'), t('email', 'Email', 'email', '', 'contact'), t('whatsapp', 'WhatsApp number', 'phone', '', 'contact'),
  t('social_instagram', 'Instagram link', 'url', '', 'social'), t('social_facebook', 'Facebook link', 'url', '', 'social'), t('social_youtube', 'YouTube link', 'url', '', 'social'), t('social_linkedin', 'LinkedIn link', 'url', '', 'social'), t('social_x', 'X link', 'url', '', 'social'),
  t('banner_image', 'Banner image', 'image', '', 'hero'), t('banner_image_alt', 'Banner image description', 'text', '', 'hero'), t('gallery_images', 'Gallery images', 'imagelist', '', 'gallery'),
];

/** The industry fields of each of the 16 packs. Health, legal and finance packs are behind the existing counsel switch (gatedPacksOpen): their fields exist but are not served or accepted while it is off. */
export const PACK_FIELDS: Readonly<Record<string, readonly Spec[]>> = {
  FIELD_SERVICE: [t('service_areas', 'Service areas', 'textlist', '', 'details'), t('callout_note', 'Call-out charge note', 'text', '', 'details')],
  RETAIL: [t('product_categories', 'Product categories', 'textlist', '', 'details'), t('delivery_note', 'Delivery note', 'text', '', 'details')],
  FOOD_SERVICE: [t('cuisines', 'Cuisines', 'textlist', '', 'details'), t('food_licence_number', 'Food licence number', 'text', '', 'details'), t('delivery_note', 'Delivery note', 'text', '', 'details')],
  CLINIC: [t('specialisations', 'Specialisations', 'textlist', '', 'details'), t('doctors', 'Doctors', 'servicelist', '', 'details')],
  LAB: [t('tests_offered', 'Tests offered', 'textlist', '', 'details'), t('home_collection_note', 'Home collection note', 'text', '', 'details')],
  PHARMACY: [t('drug_licence_number', 'Drug licence number', 'text', 'r', 'details'), t('delivery_note', 'Delivery note', 'text', '', 'details')],
  PRACTICE_LEGAL_FINANCE: [t('practice_areas', 'Practice areas', 'textlist', '', 'details'), t('registration_number', 'Registration number', 'text', '', 'details')],
  PROPERTY: [t('property_types', 'Property types', 'textlist', '', 'details'), t('areas_served', 'Areas served', 'textlist', '', 'details'), t('rera_number', 'RERA number', 'text', '', 'details')],
  VEHICLE_SERVICE: [t('vehicle_types', 'Vehicle types', 'textlist', '', 'details'), t('brands_serviced', 'Brands serviced', 'textlist', '', 'details')],
  LOGISTICS: [t('service_routes', 'Routes served', 'textlist', '', 'details'), t('fleet_note', 'Fleet note', 'text', '', 'details')],
  MEMBERSHIP_WELLNESS: [t('programmes', 'Programmes', 'textlist', '', 'details'), t('facilities', 'Facilities', 'textlist', '', 'details')],
  EDUCATION: [t('courses_offered', 'Courses offered', 'textlist', '', 'details'), t('age_groups', 'Age groups', 'text', '', 'details')],
  AGENCY_CONSULTING: [t('expertise', 'Areas of expertise', 'textlist', '', 'details'), t('industries_served', 'Industries served', 'textlist', '', 'details')],
  HOSPITALITY_EVENTS: [t('event_types', 'Event types', 'textlist', '', 'details'), t('capacity_note', 'Capacity note', 'text', '', 'details')],
  RENTAL_FLEET: [t('fleet_types', 'Fleet types', 'textlist', '', 'details'), t('deposit_note', 'Deposit note', 'text', '', 'details')],
  B2B_DEALER: [t('product_lines', 'Product lines', 'textlist', '', 'details'), t('brands_dealt', 'Brands we deal in', 'textlist', '', 'details'), t('minimum_order_note', 'Minimum order note', 'text', '', 'details')],
};
export const PROFILE_PACKS: readonly string[] = Object.keys(PACK_FIELDS);

/** Where the common fields go in the site content. A row with the pack and the category EMPTY applies to every business. */
const F = (fieldKey: string, targetKey: string): Omit<SiteMapRow, 'packKey' | 'categorySlug'> => ({ fieldKey, targetKind: 'FIELD', targetKey, itemMap: {}, active: true });
const NONE = (fieldKey: string): Omit<SiteMapRow, 'packKey' | 'categorySlug'> => ({ fieldKey, targetKind: 'NONE', targetKey: '', itemMap: {}, active: true });
export const COMMON_MAP: ReadonlyArray<Omit<SiteMapRow, 'packKey' | 'categorySlug'>> = [
  NONE('business_name'), F('tagline', 'site.tagline'), F('about', 'about.text'), NONE('services'), NONE('opening_hours'),
  { ...F('address_line', 'contact.address'), itemMap: { compose: ['address_line', 'locality', 'city', 'state', 'pincode'] } }, NONE('locality'), NONE('city'), NONE('state'), NONE('pincode'),
  F('phone', 'contact.phone'), F('email', 'contact.email'), F('whatsapp', 'contact.whatsapp'),
  F('social_instagram', 'social.instagram'), F('social_facebook', 'social.facebook'), F('social_youtube', 'social.youtube'), F('social_linkedin', 'social.linkedin'), F('social_x', 'social.x'),
  F('banner_image', 'hero.image'), F('banner_image_alt', 'hero.imageAlt'),
  { fieldKey: 'gallery_images', targetKind: 'LIST', targetKey: 'gallery', itemMap: { src: 'src', alt: 'alt' }, active: true },
];
/** The industry and category fields all go to the "credentials" list: the label is the title, the value the detail. */
export const DETAILS_MAP_ITEM: Record<string, unknown> = { title: '@label', detail: '@value' };

const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const toField = (packKey: string, categorySlug: string, [fieldKey, label, type, flags, siteSection, options]: Spec, i: number): ProfileField => ({ packKey, categorySlug, fieldKey, label, type, required: flags.includes('r'), options: options ?? [], sortOrder: (i + 1) * 10, siteSection, active: true });

/** Everything the loader creates: the pack fields (common first, then the pack's own) for each of the 16 packs, the category fields wherever the catalog gave field hints, and the map. */
export function buildProfileSeed(categories: ReadonlyArray<{ categoryKey: string; packKey: string; fieldHints: readonly string[] }>): { fields: ProfileField[]; maps: SiteMapRow[]; problems: string[] } {
  const fields: ProfileField[] = []; const maps: SiteMapRow[] = []; const problems: string[] = [];
  for (const pack of PROFILE_PACKS) {
    [...COMMON_FIELDS, ...PACK_FIELDS[pack]].forEach((s, i) => fields.push(toField(pack, '', s, i)));
    for (const s of PACK_FIELDS[pack]) maps.push({ packKey: pack, categorySlug: '', fieldKey: s[0], targetKind: 'LIST', targetKey: 'credentials', itemMap: DETAILS_MAP_ITEM, active: true });
  }
  for (const m of COMMON_MAP) maps.push({ packKey: '', categorySlug: '', ...m });
  const base = COMMON_FIELDS.length + 3;
  for (const c of categories) {
    if (!PROFILE_PACKS.includes(c.packKey)) { problems.push(`${c.categoryKey}: unknown pack ${c.packKey}`); continue; }
    const taken = new Set([...COMMON_FIELDS, ...PACK_FIELDS[c.packKey]].map((s) => s[0]));
    let n = 0;
    for (const hint of c.fieldHints) {
      const key = `hint_${slug(hint)}`.slice(0, 40);
      if (!isFieldKey(key) || taken.has(key) || hint.trim().length === 0 || hint.length > 80) { if (!taken.has(key)) problems.push(`${c.categoryKey}: bad field hint "${hint}"`); continue; }
      taken.add(key);
      fields.push(toField(c.packKey, c.categoryKey, t(key, sentence(hint.trim()), 'text', '', 'details'), base + n++));
      maps.push({ packKey: c.packKey, categorySlug: c.categoryKey, fieldKey: key, targetKind: 'LIST', targetKey: 'credentials', itemMap: DETAILS_MAP_ITEM, active: true });
    }
  }
  return { fields, maps, problems };
}

/** The fields of one category: the pack's fields, with the category's own overriding by key and adding the rest. Inactive fields are dropped. */
export function resolveSchema(rows: readonly ProfileField[], packKey: string, categorySlug: string): ProfileField[] {
  const by = new Map<string, ProfileField>();
  for (const r of rows.filter((x) => x.packKey === packKey && x.categorySlug === '' && x.active)) by.set(r.fieldKey, r);
  for (const r of rows.filter((x) => x.packKey === packKey && x.categorySlug === categorySlug && categorySlug !== '')) { if (r.active) by.set(r.fieldKey, r); else by.delete(r.fieldKey); }
  return [...by.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey));
}
/** The most specific map row for a field: the category, then the pack, then every business. No row means the value stays on the profile only. */
export function resolveMap(maps: readonly SiteMapRow[], packKey: string, categorySlug: string, fieldKey: string): SiteMapRow | null {
  const own = maps.filter((m) => m.fieldKey === fieldKey && m.active);
  return own.find((m) => m.categorySlug === categorySlug && categorySlug !== '' && m.packKey === packKey) ?? own.find((m) => m.packKey === packKey && m.categorySlug === '') ?? own.find((m) => m.packKey === '' && m.categorySlug === '') ?? null;
}

// ── checking values ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PRICE = /(?:₹|\brs\.?\s*\d|\binr\s*\d|\brupees?\s*\d)/i;
export const LIST_MAX = 30;
type Result = { ok: true; value: unknown } | { ok: false; error: string };

function text(v: unknown, max: number, multiline = false): Result {
  const c = cleanText(v, max, multiline);
  if (!c.ok) return { ok: false, error: c.error };
  if (c.value.length === 0) return { ok: false, error: 'This is required.' };
  if (PRICE.test(c.value)) return { ok: false, error: 'Leave prices out here: prices are set in the price list, before GST.' };
  if (!checkWording(c.value, { strict: false }).ok) return { ok: false, error: 'That wording promises a result or a ranking. Describe what you do instead.' };
  return { ok: true, value: c.value };
}
const asField = (f: ProfileField): FieldDef => ({ key: f.fieldKey, label: f.label, type: (f.type === 'textlist' || f.type === 'servicelist' || f.type === 'imagelist' ? 'text' : f.type) as FieldDef['type'], required: f.required, options: f.options, sortOrder: f.sortOrder, listColumn: false, searchable: false });

export function checkProfileValue(f: ProfileField, v: unknown): Result {
  if (f.type === 'text' || f.type === 'longtext') return text(v, f.type === 'text' ? LIMITS.text : LIMITS.longtext, f.type === 'longtext');
  if (f.type === 'textlist') {
    if (!Array.isArray(v) || v.length === 0 || v.length > LIST_MAX) return { ok: false, error: `Give between 1 and ${LIST_MAX} items.` };
    const out: string[] = [];
    for (const x of v) { const r = text(x, 80); if (!r.ok) return r; out.push(r.value as string); }
    return { ok: true, value: [...new Set(out)] };
  }
  if (f.type === 'servicelist') {
    if (!Array.isArray(v) || v.length === 0 || v.length > LIST_MAX) return { ok: false, error: `Give between 1 and ${LIST_MAX} items.` };
    const out: Array<{ name: string; description?: string }> = [];
    for (const x of v) {
      if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).some((k) => k !== 'name' && k !== 'description')) return { ok: false, error: 'Each item has a name and an optional short description.' };
      const o = x as { name?: unknown; description?: unknown }; const n = text(o.name, 80); if (!n.ok) return n;
      if (o.description === undefined || o.description === null || o.description === '') out.push({ name: n.value as string });
      else { const d = text(o.description, 200); if (!d.ok) return d; out.push({ name: n.value as string, description: d.value as string }); }
    }
    return { ok: true, value: out };
  }
  if (f.type === 'imagelist') {
    if (!Array.isArray(v) || v.length === 0 || v.length > LIST_MAX) return { ok: false, error: `Give between 1 and ${LIST_MAX} pictures.` };
    const out: Array<{ src: string; alt: string }> = [];
    for (const x of v) {
      if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).some((k) => k !== 'src' && k !== 'alt')) return { ok: false, error: 'Each picture has an address and a description.' };
      const o = x as { src?: unknown; alt?: unknown };
      const s = checkValue({ ...asField(f), type: 'image' }, o.src); if (!s.ok) return { ok: false, error: s.error };
      const a = text(o.alt, 160); if (!a.ok) return { ok: false, error: 'Describe each picture for people who cannot see it.' };
      out.push({ src: s.value as string, alt: a.value as string });
    }
    return { ok: true, value: out };
  }
  return checkValue(asField(f), v);
}

export interface ProfileChecked { ok: boolean; value: Record<string, unknown>; errors: Record<string, string> }
/** Checks a whole set of values. `existing` is what the business already has: a partial update only checks what it sends, but the merged set must still carry every required field. A null clears an optional field. */
export function checkProfile(schema: readonly ProfileField[], input: unknown, existing: Record<string, unknown> = {}): ProfileChecked {
  const errors: Record<string, string> = {}; const value: Record<string, unknown> = { ...existing };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, value, errors: { _: 'Send the profile as an object of fields.' } };
  const by = new Map(schema.map((f) => [f.fieldKey, f] as const));
  for (const [k, raw] of Object.entries(input as Record<string, unknown>)) {
    const f = by.get(k);
    if (!f) { errors[k] = 'This field is not part of this business profile.'; continue; }
    if (raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) { if (f.required) errors[k] = 'This is required.'; else delete value[k]; continue; }
    const r = checkProfileValue(f, raw);
    if (r.ok) value[k] = r.value; else errors[k] = r.error;
  }
  for (const f of schema) if (f.required && value[f.fieldKey] === undefined) errors[f.fieldKey] ??= 'This is required.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

// ── mapping into the site content ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type SiteOp = { kind: 'field'; key: string; value: string } | { kind: 'list'; name: string; items: Array<Record<string, string>> };
const asText = (v: unknown): string => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean).join(', ') : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/**
 * The writes the values make on the site content. FIELD rows set one field (a compose row joins several profile fields, in order, into it); LIST rows add items and every item that goes to the same list is written in ONE
 * write, because a list write replaces the list; NONE rows write nothing. Order: fields in schema order, then lists. A value that maps to nothing here is still kept on the profile.
 */
export function toSiteOps(schema: readonly ProfileField[], maps: readonly SiteMapRow[], values: Record<string, unknown>, packKey: string, categorySlug: string): SiteOp[] {
  const fields: SiteOp[] = []; const lists = new Map<string, Array<Record<string, string>>>(); const done = new Set<string>();
  for (const f of schema) {
    const v = values[f.fieldKey]; if (v === undefined) continue;
    const m = resolveMap(maps, packKey, categorySlug, f.fieldKey); if (!m || m.targetKind === 'NONE') continue;
    if (m.targetKind === 'FIELD') {
      if (done.has(m.targetKey)) continue; done.add(m.targetKey);
      const compose = Array.isArray(m.itemMap.compose) ? (m.itemMap.compose as string[]) : null;
      const out = compose ? compose.map((k) => asText(values[k])).filter(Boolean).join(', ') : asText(v);
      if (out) fields.push({ kind: 'field', key: m.targetKey, value: out });
    } else {
      const items = lists.get(m.targetKey) ?? [];
      const list = Array.isArray(v) && f.type !== 'textlist';
      for (const el of list ? (v as Array<Record<string, string>>) : [v]) {
        const item: Record<string, string> = {};
        for (const [itemField, source] of Object.entries(m.itemMap)) {
          const s = String(source); const val = s === '@label' ? f.label : s === '@value' ? asText(el) : typeof el === 'object' && el !== null ? asText((el as Record<string, unknown>)[s === 'description' ? 'description' : s]) : '';
          if (val) item[itemField] = val;
        }
        if (Object.keys(item).length) items.push(item);
      }
      lists.set(m.targetKey, items);
    }
  }
  return [...fields, ...[...lists.entries()].filter(([, items]) => items.length > 0).map(([name, items]): SiteOp => ({ kind: 'list', name, items }))];
}
