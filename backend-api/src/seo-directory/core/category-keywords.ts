/**
 * SEO block slice 1b: the keyword set of a category, derived from the catalog sheet and nothing else. Pure.
 * singular and plural come from the category NAME (a plural form is a spelling rule, not an invented synonym); the sheet's specialisations are kept as they are; SYNONYMS ARE LEFT
 * EMPTY for staff (the sheet implies none). A row staff have edited (source STAFF) is never overwritten by the loader.
 */
export interface SheetCategory { id: string; name: string; specialisations: string[] }
export interface KeywordSet { categorySlug: string; name: string; singular: string; plural: string; synonyms: string[]; specialisations: string[] }
export interface StoredKeywordSet extends KeywordSet { source: 'DERIVED' | 'STAFF' }

/** Mass nouns and words that are already plural: the plural of the name is the name. */
const SAME_FORM = new Set(['equipment', 'machinery', 'stationery', 'furniture', 'jewellery', 'jewelry', 'clothing', 'footwear', 'electronics', 'sanitaryware', 'hardware', 'software', 'luggage', 'merchandise', 'cosmetics', 'groceries', 'supplies', 'goods', 'services', 'tools', 'products', 'materials', 'accessories', 'fabrics', 'textiles', 'chemicals', 'pharmaceuticals', 'medicals', 'sweets', 'snacks']);
const IRREGULAR: Record<string, string> = { man: 'men', woman: 'women', child: 'children', person: 'people' };

export function pluralWord(w: string): string {
  const lower = w.toLowerCase();
  if (!lower || SAME_FORM.has(lower)) return lower;
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  if (/[^s]s$/.test(lower)) return lower;   // a single trailing s: already plural ("tyres")
  if (/(ss|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

/** The plural of a name: its LAST word is pluralised ("plumber" -> "plumbers", "driving school" -> "driving schools", "audio equipment" -> "audio equipment"). */
export function pluraliseName(name: string): string {
  const words = name.trim().toLowerCase().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!words.length) return '';
  words[words.length - 1] = pluralWord(words[words.length - 1]);
  return words.join(' ');
}

export function deriveKeywordSet(c: SheetCategory): KeywordSet {
  const singular = c.name.trim().toLowerCase().replace(/\s+/g, ' ');
  return { categorySlug: c.id.trim().toLowerCase(), name: c.name.trim(), singular, plural: pluraliseName(singular), synonyms: [], specialisations: [...new Set(c.specialisations.map((s) => s.trim()).filter(Boolean))] };
}

/** RFC 4180 parsing: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** The catalog sheet as categories. Needs the columns id and name (and reads services_seed_from_specialisations); rows without a usable id or name are reported, not guessed. */
export function sheetCategories(csv: string): { categories: SheetCategory[]; problems: string[] } {
  const rows = parseCsv(csv); const problems: string[] = [];
  if (!rows.length) return { categories: [], problems: ['The sheet is empty.'] };
  const head = rows[0].map((h) => h.trim()); const ix = (n: string): number => head.indexOf(n);
  const [iId, iName, iSpec] = [ix('id'), ix('name'), ix('services_seed_from_specialisations')];
  if (iId < 0 || iName < 0) return { categories: [], problems: ['The sheet needs the columns id and name.'] };
  const seen = new Set<string>(); const categories: SheetCategory[] = [];
  rows.slice(1).forEach((r, n) => {
    const id = (r[iId] ?? '').trim().toLowerCase(); const name = (r[iName] ?? '').trim();
    if (!id || !name) { problems.push(`Row ${n + 2}: id and name are both required.`); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) { problems.push(`Row ${n + 2}: "${id}" is not a slug.`); return; }
    if (seen.has(id)) { problems.push(`Row ${n + 2}: "${id}" appears twice.`); return; }
    seen.add(id);
    categories.push({ id, name, specialisations: iSpec >= 0 ? (r[iSpec] ?? '').split(';').map((s) => s.trim()).filter(Boolean) : [] });
  });
  return { categories, problems };
}

export interface KeywordLoadPlan { create: KeywordSet[]; update: KeywordSet[]; unchanged: number; keptStaff: number; problems: string[]; total: number }
const same = (a: KeywordSet, b: KeywordSet): boolean => a.name === b.name && a.singular === b.singular && a.plural === b.plural && JSON.stringify(a.specialisations) === JSON.stringify(b.specialisations);

/** What the loader would do. A STAFF row is kept untouched; a DERIVED row is refreshed only when the sheet changed; synonyms are never touched. Idempotent. */
export function planKeywordLoad(csv: string, existing: ReadonlyMap<string, StoredKeywordSet>): KeywordLoadPlan {
  const { categories, problems } = sheetCategories(csv);
  const plan: KeywordLoadPlan = { create: [], update: [], unchanged: 0, keptStaff: 0, problems, total: categories.length };
  for (const c of categories) {
    const want = deriveKeywordSet(c); const have = existing.get(want.categorySlug);
    if (!have) plan.create.push(want);
    else if (have.source === 'STAFF') plan.keptStaff++;
    else if (same(have, want)) plan.unchanged++;
    else plan.update.push(want);
  }
  return plan;
}
