import { createHash } from 'crypto';
import { cleanValue, FIELD_DEFS, ListName, validateList } from '../../v3-website/core/managed-doc';

/**
 * The content pack importer, pure (E5). A content pack (`content.json`, schema `g4d-pack-content/1`, written by the theme factory) is the default wording and structure for one kind of business:
 * services with details, groups, FAQs, trust points, steps, areas, extra sections. This turns it into a PLAN of writes for one vendor:
 *  - the wording variant of every paragraph is chosen by the vendor id (the same vendor always gets the same one, two vendors usually get different ones, so sites of the same kind do not read alike);
 *  - `[[placeholders]]` are filled from the vendor's own facts, never left in the text;
 *  - NOTHING the vendor already has is overwritten: a field that has any text, a list that has any row, a service with the same name, an item page that already has details are all left as they are and
 *    reported as skipped. Because of that, running the import twice changes nothing the second time.
 * Every planned write is checked with the same rules the Website manager uses, so a pack can never put in something a vendor could not type.
 */
export const PACK_SCHEMA = 'g4d-pack-content/1';
export type Variants = string[];
export interface PackItem {
  slug: string; name: string; group?: string; summary: Variants; description: Variants; priceFrom: { amount: number; unit?: string; currency?: string; indicative?: boolean } | null;
  highlights: string[]; details: Array<{ label: string; value: string }>; faqs: Array<{ q: string; a: Variants }>; related: string[];
}
export interface ContentPack {
  schema: string; type: string; family: string; language: string; placeholders: Record<string, string>;
  seo: { title: Variants; description: Variants }; hero: { title: Variants; subtitle: Variants; bannerText: Variants };
  cta: { label: string }; about: { title: string; text: Variants };
  groups: Array<{ slug: string; name: string }>; items: PackItem[];
  blocks: Array<{ key: string; title: string; items: Array<{ title: string; detail?: string; price?: string }> }>;
  faqs: Array<{ q: string; a: Variants }>; trust: string[]; steps: Array<{ title: string; desc?: string }>;
  team: Array<{ name: string; role?: string; note?: string }>; credentials: Array<{ title: string; detail?: string }>; areas: string[];
}
export interface VendorFacts { vendorId: string; businessName: string; owner: string; town: string; phone: string; branches: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ITEMS = 60;

/** A string or a list of strings becomes a non-empty list of text variants (null when it is neither). */
function variants(v: unknown, max: number, errs: string[], where: string): Variants | null {
  const list = typeof v === 'string' ? [v] : Array.isArray(v) ? v : null;
  if (!list || list.length === 0 || list.length > 12) { errs.push(`${where}: one text or a list of up to 12 variants`); return null; }
  const out: string[] = [];
  for (const x of list) {
    if (typeof x !== 'string' || x.trim() === '' || x.length > max || x.includes('{{') || x.includes('}}')) { errs.push(`${where}: each text is 1 to ${max} characters and has no double curly braces`); return null; }
    out.push(x.trim());
  }
  return out;
}
const text = (v: unknown, max: number, errs: string[], where: string, required = true): string => {
  if (v === undefined || v === null || v === '') { if (required) errs.push(`${where}: required`); return ''; }
  if (typeof v !== 'string' || v.length > max || v.includes('{{') || v.includes('}}')) { errs.push(`${where}: text up to ${max} characters, no double curly braces`); return ''; }
  return v.trim();
};

/** Checks the shape of a pack. Returns the clean pack or every problem named by where it is. */
export function validatePack(raw: unknown): { ok: true; pack: ContentPack } | { ok: false; errors: string[] } {
  const errs: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['pack: an object is required'] };
  if (raw.schema !== PACK_SCHEMA) return { ok: false, errors: [`schema: must be ${PACK_SCHEMA}`] };
  const arr = (k: string, max: number): unknown[] => { const v = raw[k]; if (v === undefined) return []; if (!Array.isArray(v) || v.length > max) { errs.push(`${k}: a list of at most ${max}`); return []; } return v; };
  const sub = (k: string): Record<string, unknown> => (isObj(raw[k]) ? (raw[k] as Record<string, unknown>) : {});
  const pack: ContentPack = {
    schema: PACK_SCHEMA, type: text(raw.type, 80, errs, 'type'), family: text(raw.family, 80, errs, 'family', false), language: raw.language === 'ta' ? 'ta' : 'en',
    placeholders: {}, seo: { title: [], description: [] }, hero: { title: [], subtitle: [], bannerText: [] }, cta: { label: text(sub('cta').label, 40, errs, 'cta.label', false) },
    about: { title: text(sub('about').title, 120, errs, 'about.title', false), text: [] }, groups: [], items: [], blocks: [], faqs: [], trust: [], steps: [], team: [], credentials: [], areas: [],
  };
  if (isObj(raw.placeholders)) for (const [k, v] of Object.entries(raw.placeholders)) if (/^[a-z_]{1,32}$/.test(k) && typeof v === 'string') pack.placeholders[k] = v.slice(0, 200);
  const opt = (obj: Record<string, unknown>, k: string, max: number, where: string): Variants => (obj[k] === undefined ? [] : variants(obj[k], max, errs, where) ?? []);
  // the pack's search text is written with placeholders that are longer than their values; the real limits (60 and 160 after filling) are checked when it is saved
  pack.seo = { title: opt(sub('seo'), 'title', 200, 'seo.title'), description: opt(sub('seo'), 'description', 400, 'seo.description') };
  pack.hero = { title: opt(sub('hero'), 'title', 120, 'hero.title'), subtitle: opt(sub('hero'), 'subtitle', 240, 'hero.subtitle'), bannerText: opt(sub('hero'), 'bannerText', 300, 'hero.bannerText') };
  pack.about.text = opt(sub('about'), 'text', 4000, 'about.text');
  arr('groups', 30).forEach((g, i) => { if (isObj(g) && typeof g.name === 'string' && g.name.trim()) pack.groups.push({ slug: String(g.slug ?? ''), name: text(g.name, 60, errs, `groups[${i}].name`) }); else errs.push(`groups[${i}]: a name is required`); });
  arr('items', MAX_ITEMS).forEach((it, i) => {
    const w = `items[${i}]`;
    if (!isObj(it)) { errs.push(`${w}: an object is required`); return; }
    const slug = text(it.slug, 60, errs, `${w}.slug`); if (slug && !SLUG.test(slug)) errs.push(`${w}.slug: lower-case words with dashes`);
    const pf = it.priceFrom;
    if (pf !== null && pf !== undefined && !(isObj(pf) && typeof pf.amount === 'number' && Number.isFinite(pf.amount) && pf.amount >= 0 && pf.indicative === true)) errs.push(`${w}.priceFrom: null, or an amount marked indicative`);
    pack.items.push({
      slug, name: text(it.name, 120, errs, `${w}.name`), group: typeof it.group === 'string' ? it.group : undefined,
      summary: opt(it, 'summary', 300, `${w}.summary`), description: opt(it, 'description', 4000, `${w}.description`),
      priceFrom: isObj(pf) ? { amount: pf.amount as number, unit: typeof pf.unit === 'string' ? pf.unit.slice(0, 40) : undefined, currency: typeof pf.currency === 'string' ? pf.currency : 'INR', indicative: true } : null,
      highlights: (Array.isArray(it.highlights) ? it.highlights : []).filter((x): x is string => typeof x === 'string').slice(0, 12),
      details: (Array.isArray(it.details) ? it.details : []).filter((d): d is { label: string; value: string } => isObj(d) && typeof d.label === 'string' && typeof d.value === 'string').slice(0, 12),
      faqs: (Array.isArray(it.faqs) ? it.faqs : []).filter(isObj).slice(0, 10).map((f, j) => ({ q: text(f.q, 200, errs, `${w}.faqs[${j}].q`), a: variants(f.a, 1000, errs, `${w}.faqs[${j}].a`) ?? [] })),
      related: (Array.isArray(it.related) ? it.related : []).filter((x): x is string => typeof x === 'string').slice(0, 12),
    });
  });
  const slugs = pack.items.map((x) => x.slug); if (new Set(slugs).size !== slugs.length) errs.push('items: two items share a slug');
  arr('blocks', 12).forEach((b, i) => { if (isObj(b)) pack.blocks.push({ key: text(b.key, 40, errs, `blocks[${i}].key`), title: text(b.title, 80, errs, `blocks[${i}].title`), items: (Array.isArray(b.items) ? b.items : []).filter(isObj).slice(0, 40).map((e) => ({ title: text(e.title, 120, errs, `blocks[${i}] entry title`), detail: typeof e.detail === 'string' ? e.detail : undefined, price: typeof e.price === 'string' ? e.price : undefined })) }); });
  arr('faqs', 30).forEach((f, i) => { if (isObj(f)) pack.faqs.push({ q: text(f.q, 200, errs, `faqs[${i}].q`), a: variants(f.a, 1000, errs, `faqs[${i}].a`) ?? [] }); });
  pack.trust = arr('trust', 20).filter((x): x is string => typeof x === 'string');
  arr('steps', 12).forEach((s, i) => { if (isObj(s)) pack.steps.push({ title: text(s.title, 80, errs, `steps[${i}].title`), desc: typeof s.desc === 'string' ? s.desc : undefined }); });
  arr('team', 12).forEach((t, i) => { if (isObj(t)) pack.team.push({ name: text(t.name, 80, errs, `team[${i}].name`), role: typeof t.role === 'string' ? t.role : undefined, note: typeof t.note === 'string' ? t.note : undefined }); });
  arr('credentials', 20).forEach((c, i) => { if (isObj(c)) pack.credentials.push({ title: text(c.title, 80, errs, `credentials[${i}].title`), detail: typeof c.detail === 'string' ? c.detail : undefined }); });
  pack.areas = arr('areas', 40).filter((x): x is string => typeof x === 'string');
  if (!pack.type) errs.push('type: required');
  return errs.length ? { ok: false, errors: errs } : { ok: true, pack };
}

/** The wording variant for this vendor and this place in the pack: stable for the same vendor and path, spread over the variants across vendors. */
export function variantIndex(vendorId: string, path: string, n: number): number {
  if (n <= 1) return 0;
  return createHash('sha256').update(`${vendorId}|${path}`).digest().readUInt32BE(0) % n;
}
export const pickVariant = (vendorId: string, path: string, list: Variants): string => list[variantIndex(vendorId, path, list.length)] ?? '';

/** Fills `[[name]]` tokens from the vendor's facts and the pack's own placeholder defaults. A token with no value becomes a plain fallback; no token is ever left in the text. */
export function fillPlaceholders(textIn: string, pack: Pick<ContentPack, 'placeholders'>, f: VendorFacts): string {
  const values: Record<string, string> = {
    vendor_name: f.businessName, owner: f.owner || 'our team', town: f.town || 'your town', area: f.town || 'your area', branches: f.branches || 'our branches', phone: f.phone || '',
  };
  return textIn.replace(/\[\[([a-z_]{1,32})\]\]/g, (_m, k: string) => (values[k] ?? '') || (pack.placeholders[k] ?? '')).replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

export interface CurrentContent { fields: Record<string, string>; lists: Partial<Record<ListName, unknown[]>>; seoHome: boolean; existingNames: string[]; existingDetailIds: string[] }
export interface PlannedItem { slug: string; name: string; group: string; description: string; priceFrom: ContentPack['items'][number]['priceFrom']; detail: { summary: string; details: string; faqs: string } }
export interface ImportPlan {
  fields: Array<{ key: string; value: string }>;
  lists: Array<{ name: ListName; items: Array<Record<string, string>> }>;
  seoHome: { seoTitle?: string; seoDescription?: string } | null;
  items: PlannedItem[];
  skipped: Array<{ what: string; reason: string }>;
}

const lines = (rows: string[][]): string => rows.map((r) => r.filter((x, i) => i === 0 || x !== '').join(' | ')).join('\n');

/** Plans every write. `current` says what the vendor already has (their draft over their live content). Pure. */
export function planImport(pack: ContentPack, f: VendorFacts, current: CurrentContent): ImportPlan {
  const plan: ImportPlan = { fields: [], lists: [], seoHome: null, items: [], skipped: [] };
  const fill = (s: string): string => fillPlaceholders(s, pack, f);
  const v = (path: string, list: Variants): string => fill(pickVariant(f.vendorId, path, list));

  const field = (key: string, value: string): void => {
    if (!value) return;
    if (String(current.fields[key] ?? '').trim() !== '') { plan.skipped.push({ what: key, reason: 'the vendor already has text here' }); return; }
    const def = FIELD_DEFS[key];
    const c = def ? cleanValue(def.type, def.max, value, key) : null;
    if (!c || !c.ok) { plan.skipped.push({ what: key, reason: c && !c.ok ? c.message : 'not an editable field' }); return; }
    plan.fields.push({ key, value: c.value });
  };
  const list = (name: ListName, rows: Array<Record<string, string>>): void => {
    if (rows.length === 0) return;
    if ((current.lists[name] ?? []).length > 0) { plan.skipped.push({ what: `list ${name}`, reason: 'the vendor already has rows here' }); return; }
    const r = validateList(name, rows);
    if (!r.ok) { plan.skipped.push({ what: `list ${name}`, reason: r.message }); return; }
    plan.lists.push({ name, items: r.items as Array<Record<string, string>> });
  };

  field('hero.title', v('hero.title', pack.hero.title));
  field('hero.subtitle', v('hero.subtitle', pack.hero.subtitle));
  field('about.text', v('about.text', pack.about.text));
  field('cta.label', pack.cta.label ? fill(pack.cta.label) : '');
  if (pack.seo.title.length || pack.seo.description.length) {
    if (current.seoHome) plan.skipped.push({ what: 'home page search text', reason: 'the vendor already wrote it' });
    else plan.seoHome = { ...(pack.seo.title.length ? { seoTitle: v('seo.title', pack.seo.title) } : {}), ...(pack.seo.description.length ? { seoDescription: v('seo.description', pack.seo.description) } : {}) };
  }

  list('groups', pack.groups.map((g) => ({ name: fill(g.name) })));
  list('areas', pack.areas.map((a) => ({ name: fill(a) })).filter((a) => a.name));
  list('faqs', pack.faqs.map((q, i) => ({ q: fill(q.q), a: v(`faqs.${i}`, q.a) })));
  list('trust', pack.trust.map((t) => ({ text: fill(t) })));
  list('steps', pack.steps.map((s) => ({ title: fill(s.title), desc: fill(s.desc ?? '') })));
  list('team', pack.team.map((t) => ({ name: fill(t.name), role: fill(t.role ?? ''), note: fill(t.note ?? '') })));
  list('credentials', pack.credentials.map((c) => ({ title: fill(c.title), detail: fill(c.detail ?? '') })));
  list('blocks', pack.blocks.map((b) => ({ key: b.key, title: fill(b.title), entries: lines(b.items.map((e) => [fill(e.title), e.price ? fill(e.price) : '', e.detail ? fill(e.detail) : ''])) })));

  const have = new Set(current.existingNames.map((n) => n.trim().toLowerCase()));
  const groupName = new Map(pack.groups.map((g) => [g.slug, fill(g.name)]));
  for (const it of pack.items) {
    const name = fill(it.name);
    if (have.has(name.toLowerCase())) { plan.skipped.push({ what: `service ${name}`, reason: 'the vendor already has a service with this name' }); continue; }
    const description = v(`items.${it.slug}.description`, it.description.length ? it.description : it.summary);
    const highlights = it.highlights.map((h) => fill(h));
    const detailLines = [...it.details.map((d) => `${fill(d.label)}: ${fill(d.value)}`), ...highlights.map((h) => `- ${h}`)].join('\n');
    plan.items.push({
      slug: it.slug, name, group: groupName.get(it.group ?? '') ?? '', description,
      priceFrom: it.priceFrom,
      detail: { summary: it.summary.length ? v(`items.${it.slug}.summary`, it.summary) : '', details: [description, detailLines].filter(Boolean).join('\n\n').slice(0, 4000), faqs: lines(it.faqs.map((q, j) => [fill(q.q), v(`items.${it.slug}.faqs.${j}`, q.a)])) },
    });
  }
  return plan;
}
