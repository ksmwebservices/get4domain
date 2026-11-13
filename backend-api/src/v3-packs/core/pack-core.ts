/**
 * The pack engine core (Amendment 13 Part A). PURE: no clock, no randomness, no file system, no database. It parses and checks the three data sheets and the settings file the loaders read,
 * and holds the small rules every pack record has to follow. Nothing in here names a price, a capability's tier or a pack: those are data (see prisma/seed/pack-engine).
 */

/** The three tiers, lowest first. They are the plan tracks (V3PlanTrack), so a vendor's tier is the track of the plan the entitlement engine resolved. */
export const TIERS = ['HANDYMAN', 'PROFESSIONAL', 'ECOMMERCE'] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (v: unknown): v is Tier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);
export const tierRank = (t: Tier): number => TIERS.indexOf(t);

export const TAB_SCOPES = ['COMMON', 'PACK', 'CAPABILITY', 'ADDON'] as const;
export type TabScope = (typeof TAB_SCOPES)[number];
export const MATRIX_BASES = ['AMENDMENT_13_V3', 'ASSUMED_FOR_OWNER_REVIEW', 'STAFF'] as const;
export const REVIEW_STATUSES = ['DRAFT', 'OWNER_REVIEWED', 'APPROVED'] as const;

const KEY = /^[A-Z][A-Z0-9_]{1,39}$/;
const LOWER_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export const isUpperKey = (v: unknown): v is string => typeof v === 'string' && KEY.test(v);
export const isLowerKey = (v: unknown): v is string => typeof v === 'string' && LOWER_KEY.test(v);

/** "Site visits" -> "site_visits". Used to turn a label of the draft sheet into a stable key. */
export function slug(label: string): string {
  return label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────────

/** A small RFC 4180 reader (quotes, doubled quotes, CRLF, a leading byte-order mark). The first row is the header. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ── copy rules ──────────────────────────────────────────────────────────────────────────────────────

const FRAME = /\b(?:within|in|every|after|for)\s+(?:\d+|a|one|two|three|seven|thirty)\s*(?:hours?|days?|weeks?|months?|minutes?|years?)\b/i;
/** The product names no text may use, built from parts so this file never spells them out. */
const RETIRED = new RegExp(`\\b(?:${[['work', 'space'].join(''), ['B', 'OS'].join(''), ['Lead', 'Space'].join('')].join('|')})\\b`, 'i');
const PRICE = /₹\s*\d|\bR[s]\.?\s*\d/i;
/** Text a pack may carry that breaks a product copy rule and cannot be fixed by a plain word swap. */
export function copyIssues(text: string): string[] {
  const out: string[] = [];
  if (RETIRED.test(text)) out.push('uses a retired product name');
  if (FRAME.test(text)) out.push('names a timeframe');
  if (PRICE.test(text)) out.push('carries a price');
  return out;
}
/** The one plain swap the rules allow: "leads" is written "enquiries". Everything else is reported, never rewritten. */
export function normaliseCopy(text: string): { text: string; rewrites: number } {
  let rewrites = 0;
  const out = text.replace(/\bleads?\b/gi, (m) => { rewrites += 1; const w = m.toLowerCase() === 'lead' ? 'enquiry' : 'enquiries'; return m[0] === m[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w; });
  return { text: out, rewrites };
}

/** "Ecommerce (1,499)" -> ECOMMERCE. Only the tier word is kept: a price in a sheet is never stored. */
export function tierFromText(text: string): Tier | null {
  const w = text.trim().split(/[\s(]/)[0].toUpperCase();
  return isTier(w) ? w : null;
}

// ── shapes ──────────────────────────────────────────────────────────────────────────────────────────

export interface Labelled { key: string; label: string }
export interface NamedStages { name: string; stages: string[] }
export interface PackConfig {
  /** the main work objects and their custom fields; empty until the pack's wave defines them (nothing is invented) */
  entities: unknown[];
  workflows: NamedStages[];
  crmPipelines: NamedStages[];
  /** the draft sheet's TeleCRM lines: call-script keys and dispositions */
  telecrm: Labelled[];
  taskTemplates: Labelled[];
  reportSet: unknown[];
  siteSections: Labelled[];
  fieldHints: unknown[];
  flags: { hasStock: boolean; hasBatchExpiry: boolean; hasCases: boolean; counselGated: boolean; /** null = not applicable; false = online checkout is OFF (the Pharmacy pack ships that way) */ onlineCheckout: boolean | null; drugLicenceRequired: boolean };
  /** the sheet's own words, kept so the owner can compare the draft with what was loaded */
  source: { crmPipeline: string; telecrm: string; taskTemplates: string; siteSections: string; vendorTabs: string };
}
export interface PackRecord { key: string; name: string; disclaimerKey: string | null; reviewStatus: 'DRAFT'; config: PackConfig }
export interface TabRecord { scope: TabScope; ownerKey: string; key: string; label: string; route: string; minTier: Tier | null; capabilityKey: string | null; freeTrial: boolean; sortOrder: number }
export interface CapabilityRecord { key: string; name: string; description: string | null; sortOrder: number }
export interface MatrixRecord { tier: Tier; capabilityKey: string; allowed: boolean; basis: string }
export interface CategoryRecord {
  categoryKey: string; name: string; family: string; packKey: string; minTier: Tier; optionalCapabilities: string[]; starterServices: string[]; fieldHints: string[];
  onlineShopNote: string | null; needsBlueprint: boolean; ownerNotes: string | null; statusNote: string | null; addonPacks: Array<{ key: string; bundleDiscount: boolean }>;
}
/** An add-on pack (Amendment 13 V3A). It holds no price: the price is PENDING until the owner sets it in the price book. */
export interface AddonRecord { key: string; name: string; description: string | null; grantsCapabilities: string[]; config: Record<string, unknown>; priceStatus: 'PENDING'; bundleDiscountStatus: 'PENDING' }

export interface PackMeta { disclaimerKey?: string; counselGated?: boolean; flags?: { hasStock?: boolean; hasBatchExpiry?: boolean; hasCases?: boolean; onlineCheckout?: boolean; drugLicenceRequired?: boolean } }
export interface PackEngineSettings {
  version: number;
  capabilities: Array<{ key: string; name: string; description?: string }>;
  tierMatrix: Record<string, Record<string, string>>;
  commonTabs: Array<{ key: string; label: string; route: string; freeTrial?: boolean; minTier?: string }>;
  capabilityTabs: Array<{ capability: string; key: string; label: string; route: string; minTier?: string }>;
  packMeta: Record<string, PackMeta>;
  addonPacks: Array<{ key: string; name: string; description?: string; grantsCapabilities?: string[]; config?: Record<string, unknown>; tabs?: Array<{ key: string; label: string; route: string }> }>;
}
export interface Parsed<T> { records: T[]; problems: string[] }

const split = (s: string, sep: string): string[] => s.split(sep).map((x) => x.trim()).filter(Boolean);

// ── settings file ───────────────────────────────────────────────────────────────────────────────────

/** Checks the settings file: capability keys, a matrix that names only known tiers and capabilities, tab keys that cannot collide. Returns the problems found (empty = fine). */
export function validateSettings(s: PackEngineSettings): string[] {
  const p: string[] = [];
  if (s.version !== 1) p.push('settings version must be 1');
  const caps = new Set<string>();
  for (const c of s.capabilities ?? []) {
    if (!isUpperKey(c.key)) p.push(`capability key "${c.key}" is not an UPPER_SNAKE key`);
    else if (caps.has(c.key)) p.push(`capability ${c.key} is listed twice`);
    caps.add(c.key);
    if (!c.name?.trim()) p.push(`capability ${c.key} has no name`);
  }
  for (const [tier, row] of Object.entries(s.tierMatrix ?? {})) {
    if (!isTier(tier)) { p.push(`matrix names an unknown tier "${tier}"`); continue; }
    for (const [cap, basis] of Object.entries(row)) {
      if (!caps.has(cap)) p.push(`matrix: ${tier} names an unknown capability "${cap}"`);
      if (!(MATRIX_BASES as readonly string[]).includes(basis)) p.push(`matrix: ${tier}/${cap} has an unknown basis "${basis}"`);
    }
  }
  for (const t of TIERS) if (!s.tierMatrix?.[t]) p.push(`matrix has no row for ${t}`);
  const seen = new Set<string>();
  for (const t of s.commonTabs ?? []) {
    if (!isLowerKey(t.key)) p.push(`common tab key "${t.key}" is not a lower_snake key`);
    if (seen.has(t.key)) p.push(`common tab ${t.key} is listed twice`);
    seen.add(t.key);
    if (t.minTier && !isTier(t.minTier)) p.push(`common tab ${t.key} has an unknown minimum tier`);
  }
  for (const k of ['website', 'industry', 'plan', 'support']) if (!(s.commonTabs ?? []).some((t) => t.key === k && t.freeTrial)) p.push(`common tab ${k} must be open on a Free trial`);
  const capTabs = new Set<string>();
  for (const t of s.capabilityTabs ?? []) {
    if (!caps.has(t.capability)) p.push(`capability tab ${t.key} names an unknown capability "${t.capability}"`);
    if (capTabs.has(t.key)) p.push(`capability tab ${t.key} is listed twice`);
    capTabs.add(t.key);
  }
  for (const [pk, m] of Object.entries(s.packMeta ?? {})) if (!isUpperKey(pk) || (m.disclaimerKey !== undefined && !isLowerKey(m.disclaimerKey))) p.push(`pack meta for "${pk}" is not valid`);
  const addons = new Set<string>();
  for (const a of s.addonPacks ?? []) {
    if (!isUpperKey(a.key)) p.push(`add-on pack key "${a.key}" is not an UPPER_SNAKE key`);
    if (addons.has(a.key)) p.push(`add-on pack ${a.key} is listed twice`);
    addons.add(a.key);
    for (const c of a.grantsCapabilities ?? []) if (!caps.has(c)) p.push(`add-on pack ${a.key} grants an unknown capability "${c}"`);
    for (const issue of copyIssues(`${a.name} ${a.description ?? ''}`)) p.push(`add-on pack ${a.key} ${issue}`);
    if (JSON.stringify(a).match(/"(price|pricePaise|amount|amountPaise)"/i)) p.push(`add-on pack ${a.key} carries a price (prices live in the price book, PENDING)`);
  }
  for (const t of [...(s.commonTabs ?? []), ...(s.capabilityTabs ?? []), ...(s.addonPacks ?? []).flatMap((a) => a.tabs ?? [])]) for (const issue of copyIssues(t.label)) p.push(`tab ${t.key} label ${issue}`);
  return p;
}

export function capabilityRecords(s: PackEngineSettings): CapabilityRecord[] {
  return s.capabilities.map((c, i) => ({ key: c.key, name: c.name, description: c.description ?? null, sortOrder: i }));
}
/** One row for every tier and capability (allowed or not), so staff see the whole grid and a cell edit never needs a missing row. */
export function matrixRecords(s: PackEngineSettings): MatrixRecord[] {
  const out: MatrixRecord[] = [];
  for (const tier of TIERS) for (const c of s.capabilities) {
    const basis = s.tierMatrix[tier]?.[c.key];
    out.push({ tier, capabilityKey: c.key, allowed: basis !== undefined, basis: basis ?? 'AMENDMENT_13_V3' });
  }
  return out;
}
export function commonTabRecords(s: PackEngineSettings): TabRecord[] {
  return s.commonTabs.map((t, i) => ({ scope: 'COMMON', ownerKey: 'COMMON', key: t.key, label: t.label, route: t.route, minTier: t.minTier ? (t.minTier as Tier) : null, capabilityKey: null, freeTrial: t.freeTrial === true, sortOrder: i }));
}
export function addonRecords(s: PackEngineSettings): AddonRecord[] {
  return (s.addonPacks ?? []).map((a) => ({ key: a.key, name: a.name, description: a.description ?? null, grantsCapabilities: a.grantsCapabilities ?? [], config: a.config ?? {}, priceStatus: 'PENDING', bundleDiscountStatus: 'PENDING' }));
}
export function addonTabRecords(s: PackEngineSettings): TabRecord[] {
  return (s.addonPacks ?? []).flatMap((a) => (a.tabs ?? []).map((t, i) => ({ scope: 'ADDON' as const, ownerKey: a.key, key: t.key, label: t.label, route: t.route, minTier: null, capabilityKey: null, freeTrial: false, sortOrder: i })));
}
export function capabilityTabRecords(s: PackEngineSettings): TabRecord[] {
  return s.capabilityTabs.map((t, i) => ({ scope: 'CAPABILITY', ownerKey: t.capability, key: t.key, label: t.label, route: t.route, minTier: t.minTier ? (t.minTier as Tier) : null, capabilityKey: t.capability, freeTrial: false, sortOrder: i }));
}

// ── PACK_SUMMARY_V1.csv ─────────────────────────────────────────────────────────────────────────────

/** "Pipeline: New enquiry, Site visit; rentals: Enquiry, Visit" -> two named stage lists. A part with no colon ("refill reminders") is a note, kept in `notes`, never made a stage. */
export function parseStages(text: string): { lists: NamedStages[]; notes: string[] } {
  const lists: NamedStages[] = []; const notes: string[] = [];
  for (const part of split(text, ';')) {
    const at = part.indexOf(':');
    if (at < 0) { notes.push(part); continue; }
    const name = part.slice(0, at).trim();
    const stages = split(part.slice(at + 1), ',');
    if (name && stages.length) lists.push({ name, stages });
    else notes.push(part);
  }
  return { lists, notes };
}

const labelled = (parts: string[]): Labelled[] => {
  const used = new Set<string>();
  return parts.map((label) => { let k = slug(label) || 'item'; let n = 2; while (used.has(k)) { k = `${slug(label)}_${n}`; n += 1; } used.add(k); return { key: k, label }; });
};

/** Turns PACK_SUMMARY_V1.csv into pack records and the pack tabs. A copy-rule problem, a missing column, a duplicate or a bad key is a problem (the loader refuses to apply while any exist). */
export function parsePackSummary(rows: Array<Record<string, string>>, settings: PackEngineSettings): { packs: PackRecord[]; tabs: TabRecord[]; problems: string[]; rewrites: number } {
  const problems: string[] = []; const packs: PackRecord[] = []; const tabs: TabRecord[] = []; let rewrites = 0;
  const seen = new Set<string>();
  const fix = (s: string): string => { const r = normaliseCopy(s); rewrites += r.rewrites; return r.text; };
  rows.forEach((r, i) => {
    const key = r.pack ?? '';
    const where = `PACK_SUMMARY row ${i + 2} (${key || 'no key'})`;
    if (!isUpperKey(key)) { problems.push(`${where}: pack key is not an UPPER_SNAKE key`); return; }
    if (seen.has(key)) { problems.push(`${where}: pack listed twice`); return; }
    seen.add(key);
    for (const col of ['name', 'vendor_tabs', 'crm_pipeline', 'telecrm', 'task_templates', 'public_site_sections']) if (!r[col]?.trim()) problems.push(`${where}: column ${col} is empty`);
    const name = fix(r.name ?? '');
    const crm = fix(r.crm_pipeline ?? ''); const tele = fix(r.telecrm ?? ''); const task = fix(r.task_templates ?? ''); const site = fix(r.public_site_sections ?? ''); const tabText = fix(r.vendor_tabs ?? '');
    for (const [col, v] of [['name', name], ['vendor_tabs', tabText], ['crm_pipeline', crm], ['telecrm', tele], ['task_templates', task], ['public_site_sections', site]] as const) for (const issue of copyIssues(v)) problems.push(`${where}: ${col} ${issue}`);
    const meta = settings.packMeta[key] ?? {};
    const stages = parseStages(crm);
    if (!stages.lists.length) problems.push(`${where}: crm_pipeline has no stage list`);
    packs.push({
      key, name, disclaimerKey: meta.disclaimerKey ?? null, reviewStatus: 'DRAFT',
      config: {
        entities: [], workflows: stages.lists.map((l) => ({ ...l })), crmPipelines: stages.lists, telecrm: labelled(split(tele, ';')), taskTemplates: labelled(split(task, ';')),
        reportSet: [], siteSections: labelled(split(site, ',')), fieldHints: [],
        flags: { hasStock: meta.flags?.hasStock === true, hasBatchExpiry: meta.flags?.hasBatchExpiry === true, hasCases: meta.flags?.hasCases === true, counselGated: meta.counselGated === true, onlineCheckout: meta.flags?.onlineCheckout ?? null, drugLicenceRequired: meta.flags?.drugLicenceRequired === true },
        source: { crmPipeline: r.crm_pipeline ?? '', telecrm: r.telecrm ?? '', taskTemplates: r.task_templates ?? '', siteSections: r.public_site_sections ?? '', vendorTabs: r.vendor_tabs ?? '' },
      },
    });
    const used = new Set<string>();
    split(tabText, ';').forEach((label, n) => {
      let k = slug(label) || `tab_${n + 1}`; let m = 2; while (used.has(k)) { k = `${slug(label)}_${m}`; m += 1; } used.add(k);
      tabs.push({ scope: 'PACK', ownerKey: key, key: k, label, route: `/pack/${k}`, minTier: null, capabilityKey: null, freeTrial: false, sortOrder: n });
    });
  });
  for (const k of Object.keys(settings.packMeta)) if (!seen.has(k)) problems.push(`settings name a pack "${k}" that PACK_SUMMARY does not have`);
  return { packs, tabs, problems, rewrites };
}

// ── CATEGORY_MASTER_V2_ADMIN_REGISTRATION.csv ───────────────────────────────────────────────────────

/** Turns the 196-category master into category records. The tier word is kept and the price in it dropped. A category with no starter services is marked needsBlueprint (the 53 are left empty on purpose). */
export function parseCategoryMaster(rows: Array<Record<string, string>>, packKeys: ReadonlySet<string>, capabilityKeys: ReadonlySet<string>, addonKeys: ReadonlySet<string> = new Set()): { categories: CategoryRecord[]; problems: string[]; rewrites: number } {
  const problems: string[] = []; const categories: CategoryRecord[] = []; let rewrites = 0; const seen = new Set<string>();
  const fix = (s: string): string => { const r = normaliseCopy(s); rewrites += r.rewrites; return r.text; };
  rows.forEach((r, i) => {
    const id = r.id ?? '';
    const where = `CATEGORY_MASTER row ${i + 2} (${id || 'no id'})`;
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) { problems.push(`${where}: id is not a lower-case slug`); return; }
    if (seen.has(id)) { problems.push(`${where}: category listed twice`); return; }
    seen.add(id);
    if (!packKeys.has(r.primary_pack)) problems.push(`${where}: unknown pack "${r.primary_pack}"`);
    const tier = tierFromText(r.minimum_tier ?? '');
    if (!tier) { problems.push(`${where}: minimum tier "${r.minimum_tier}" is not one of ${TIERS.join(', ')}`); return; }
    const caps = split(r.optional_capabilities ?? '', ';');
    for (const c of caps) if (!capabilityKeys.has(c)) problems.push(`${where}: unknown capability "${c}"`);
    const addons = split(r.addon_packs_available ?? '', ';').map((a) => { const key = a.replace(/\([^)]*\)/g, '').trim(); return { key, bundleDiscount: /bundle discount/i.test(a) }; });
    for (const a of addons) if (!addonKeys.has(a.key)) problems.push(`${where}: unknown add-on pack "${a.key}"`);
    const name = fix(r.name ?? ''); const family = fix(r.family ?? '');
    if (!name) problems.push(`${where}: no name`);
    const starter = split(fix(r.services_seed_from_specialisations ?? ''), ';').map((s) => s.trim());
    const hints = split(fix(r.field_hints ?? ''), ';');
    for (const [col, v] of [['name', name], ['family', family], ['starter services', starter.join(' ')], ['field hints', hints.join(' ')]] as const) for (const issue of copyIssues(v)) problems.push(`${where}: ${col} ${issue}`);
    categories.push({
      categoryKey: id, name, family, packKey: r.primary_pack, minTier: tier, optionalCapabilities: caps, starterServices: starter, fieldHints: hints,
      onlineShopNote: r.online_shop?.trim() || null, needsBlueprint: starter.length === 0, ownerNotes: r.owner_notes?.trim() || null, statusNote: r.status_note?.trim() || null, addonPacks: addons,
    });
  });
  return { categories, problems, rewrites };
}

/** The category-to-pack map sheet and the master must agree on every pack (the master adds capabilities the owner corrected). Returns the categories where the pack differs or one sheet lacks the category. */
export function crossCheckMap(map: Array<Record<string, string>>, master: CategoryRecord[]): string[] {
  const m = new Map(map.map((r) => [r.id, r.primary_pack]));
  const out: string[] = [];
  for (const c of master) { const p = m.get(c.categoryKey); if (p === undefined) out.push(`${c.categoryKey}: not in CATEGORY_TO_PACK_MAP`); else if (p !== c.packKey) out.push(`${c.categoryKey}: map says ${p}, master says ${c.packKey}`); }
  const have = new Set(master.map((c) => c.categoryKey));
  for (const id of m.keys()) if (!have.has(id)) out.push(`${id}: not in the master`);
  return out;
}

/** Stable text of a value, so "has this row changed?" does not depend on key order. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
