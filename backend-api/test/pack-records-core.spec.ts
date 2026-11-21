import {
  checkFieldDefs, checkRecord, checkValue, cleanSearch, FieldDef, isOwnerOnlyTab, pageOf, schemaView, searchTextOf, titleOf,
} from '../src/v3-pack-records/core/record-core';
import { loadTabFields } from '../src/v3-pack-records/seed/tab-field-loader';
import { buildFieldSeed, COMMON_WITH_OWN_CONTRACT } from '../src/v3-pack-records/seed/tab-field-seed';
import { MemoryFieldStore } from './support/memory-pack-records-store';
import { tabAccess, tabAccessOf, NavTab } from '../src/v3-packs/core/nav-core';
import { realSeed } from './support/pack-fakes';

const f = (key: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label: key, type, required: false, options: [], sortOrder: 10, listColumn: false, searchable: false, ...extra });

describe('pack records: value checks', () => {
  it('refuses markup in text and longtext, and control characters, and caps the length', () => {
    expect(checkValue(f('t', 'text'), '<b>hi</b>').ok).toBe(false);
    expect(checkValue(f('t', 'text'), 'a &lt; b').ok).toBe(false);
    expect(checkValue(f('t', 'longtext'), 'javascript:alert(1)').ok).toBe(false);
    expect(checkValue(f('t', 'text'), 'bad\u0000byte').ok).toBe(false);
    expect(checkValue(f('t', 'text'), 'x'.repeat(201)).ok).toBe(false);
    expect(checkValue(f('t', 'longtext'), 'x'.repeat(4001)).ok).toBe(false);
    expect(checkValue(f('t', 'text'), '  two   words ')).toEqual({ ok: true, value: 'two words' });
    expect(checkValue(f('t', 'longtext'), 'line one\r\nline two')).toEqual({ ok: true, value: 'line one\nline two' });
  });
  it('wrong types are refused (a number as text, a string as a number)', () => {
    expect(checkValue(f('t', 'text'), 5).ok).toBe(false);
    expect(checkValue(f('n', 'number'), '5').ok).toBe(false);
    expect(checkValue(f('n', 'number'), Infinity).ok).toBe(false);
    expect(checkValue(f('b', 'bool'), 'true').ok).toBe(false);
    expect(checkValue(f('n', 'number'), 12.5)).toEqual({ ok: true, value: 12.5 });
  });
  it('money is a whole number of paise, never negative, never a string or a decimal', () => {
    expect(checkValue(f('m', 'money'), 150000)).toEqual({ ok: true, value: 150000 });
    expect(checkValue(f('m', 'money'), 0).ok).toBe(true);
    expect(checkValue(f('m', 'money'), 1500.5).ok).toBe(false);
    expect(checkValue(f('m', 'money'), -1).ok).toBe(false);
    expect(checkValue(f('m', 'money'), '1500').ok).toBe(false);
    expect(checkValue(f('m', 'money'), 1e15).ok).toBe(false);
  });
  it('dates must be real days, datetimes are stored as ISO', () => {
    expect(checkValue(f('d', 'date'), '2026-11-15').ok).toBe(true);
    expect(checkValue(f('d', 'date'), '2026-02-30').ok).toBe(false);
    expect(checkValue(f('d', 'date'), '15-11-2026').ok).toBe(false);
    expect(checkValue(f('d', 'datetime'), '2026-11-15T10:30:00+05:30')).toEqual({ ok: true, value: '2026-11-15T05:00:00.000Z' });
    expect(checkValue(f('d', 'datetime'), 'tomorrow').ok).toBe(false);
  });
  it('select and multiselect only take the listed choices', () => {
    const sel = f('s', 'select', { options: ['A', 'B'] }); const multi = f('m', 'multiselect', { options: ['A', 'B'] });
    expect(checkValue(sel, 'A').ok).toBe(true); expect(checkValue(sel, 'C').ok).toBe(false);
    expect(checkValue(multi, ['A', 'A', 'B'])).toEqual({ ok: true, value: ['A', 'B'] }); expect(checkValue(multi, ['A', 'C']).ok).toBe(false); expect(checkValue(multi, 'A').ok).toBe(false);
  });
  it('phone, email, url and image', () => {
    expect(checkValue(f('p', 'phone'), '+91 98765-43210')).toEqual({ ok: true, value: '+919876543210' });
    expect(checkValue(f('p', 'phone'), '12').ok).toBe(false);
    expect(checkValue(f('e', 'email'), ' A@Example.COM ')).toEqual({ ok: true, value: 'a@example.com' });
    expect(checkValue(f('e', 'email'), 'not-an-email').ok).toBe(false);
    expect(checkValue(f('u', 'url'), 'https://example.com/a').ok).toBe(true);
    expect(checkValue(f('u', 'url'), 'javascript:alert(1)').ok).toBe(false);
    expect(checkValue(f('u', 'url'), 'ftp://example.com').ok).toBe(false);
    expect(checkValue(f('i', 'image'), 'http://example.com/a.png').ok).toBe(false);
    expect(checkValue(f('i', 'image'), 'https://example.com/a.png').ok).toBe(true);
  });
});

describe('pack records: whole-record checks', () => {
  const fields = [f('title', 'text', { required: true, searchable: true, sortOrder: 10 }), f('amount', 'money', { sortOrder: 20 }), f('state', 'status', { sortOrder: 30 }), f('phone', 'phone', { searchable: true, sortOrder: 40 })];
  it('refuses unknown fields and lists every problem at once', () => {
    const r = checkRecord(fields, { title: 'x', extra: 1, amount: 'free' });
    expect(r.ok).toBe(false); expect(Object.keys(r.errors).sort()).toEqual(['amount', 'extra']);
  });
  it('a required field must be present; an update merges with the existing data', () => {
    expect(checkRecord(fields, {}).errors.title).toBeDefined();
    const merged = checkRecord(fields, { amount: 500 }, { title: 'Pipe repair' });
    expect(merged.ok).toBe(true); expect(merged.data).toEqual({ title: 'Pipe repair', amount: 500 });
    expect(checkRecord(fields, { title: null }, { title: 'x' }).errors.title).toBeDefined();   // clearing a required field is refused
    expect(checkRecord(fields, { amount: null }, { title: 'x', amount: 5 }).data).toEqual({ title: 'x' });   // an optional field can be cleared
  });
  it('a status-typed field is lifted into the row status and left out of the data', () => {
    const r = checkRecord(fields, { title: 'x', state: 'DONE' });
    expect(r.ok).toBe(true); expect(r.status).toBe('DONE'); expect(r.data).toEqual({ title: 'x' });
    expect(checkRecord(fields, { title: 'x', state: 'ARCHIVED' }).errors.state).toBeDefined();
  });
  it('refuses a body that is not an object and an oversize record', () => {
    expect(checkRecord(fields, 'x').ok).toBe(false); expect(checkRecord(fields, [1]).ok).toBe(false);
    const big = [f('title', 'text', { required: true }), ...Array.from({ length: 6 }, (_, i) => f(`l${i}`, 'longtext'))];
    const body: Record<string, string> = { title: 'x' }; for (let i = 0; i < 6; i++) body[`l${i}`] = 'y'.repeat(3500);
    expect(checkRecord(big, body).errors._).toBeDefined();
  });
  it('searchText holds only the searchable fields, lower-cased; title is the first required text', () => {
    expect(searchTextOf(fields, { title: 'Pipe REPAIR', amount: 500, phone: '+919876543210' })).toBe('pipe repair +919876543210');
    expect(titleOf(fields, { title: 'Pipe repair' })).toBe('Pipe repair'); expect(titleOf(fields, {})).toBeNull();
  });
  it('the schema view marks money as paise before GST and lists the list columns', () => {
    const v = schemaView([f('a', 'money', { listColumn: true, sortOrder: 5 }), f('b', 'text', { sortOrder: 1 })]);
    expect(v.fields.map((x) => x.key)).toEqual(['b', 'a']); expect(v.fields[1]).toMatchObject({ unit: 'MINOR', taxNote: 'Before GST' }); expect(v.listColumns).toEqual(['a']);
  });
  it('paging and search are clamped', () => {
    expect(pageOf(0, 9999)).toEqual({ page: 1, pageSize: 100, skip: 0 }); expect(pageOf('3', '10')).toEqual({ page: 3, pageSize: 10, skip: 20 }); expect(cleanSearch('  A   B ')).toBe('a b'); expect(cleanSearch(5)).toBe('');
  });
  it('field definitions edited by staff are checked', () => {
    expect(checkFieldDefs([{ key: 'ok', label: 'Ok', type: 'text' }])).toEqual([]);
    expect(checkFieldDefs([{ key: 'Bad Key', label: 'x', type: 'text' }, { key: 'a', label: '<b>', type: 'nope' }, { key: 'sel', label: 'S', type: 'select' }]).length).toBeGreaterThanOrEqual(3);
  });
  it('money and contract tabs are owner only', () => {
    expect(isOwnerOnlyTab('CLINIC', 'billing')).toBe(true); expect(isOwnerOnlyTab('RETAIL', 'products')).toBe(false);
  });
});

describe('pack records: the field seed', () => {
  const tabs = realSeed().tabs;
  it('covers every record tab with a valid set and no problems; COMMON tabs with their own contract are left out', () => {
    const s = buildFieldSeed(tabs);
    expect(s.problems).toEqual([]);
    const owners = new Set(s.fields.map((x) => `${x.ownerKey}|${x.tabKey}`));
    const expected = new Set(tabs.filter((t) => !(t.scope === 'COMMON' && COMMON_WITH_OWN_CONTRACT.has(t.key))).map((t) => `${t.ownerKey}|${t.key}`));
    expect(owners).toEqual(expected);
    for (const t of tabs.filter((x) => x.scope === 'COMMON' && COMMON_WITH_OWN_CONTRACT.has(x.key))) expect(owners.has(`COMMON|${t.key}`)).toBe(false);
  });
  it('every tab has a title-like required text field or a required field, and money labels say before GST', () => {
    const s = buildFieldSeed(tabs);
    const byTab = new Map<string, typeof s.fields>(); for (const x of s.fields) byTab.set(`${x.ownerKey}|${x.tabKey}`, [...(byTab.get(`${x.ownerKey}|${x.tabKey}`) ?? []), x]);
    for (const [k, list] of byTab) { expect(list.some((x) => x.required)).toBe(true); expect(list.length).toBeLessThanOrEqual(8); expect(k).toBeTruthy(); }
    for (const x of s.fields.filter((y) => y.type === 'money')) expect(x.label.toLowerCase()).toContain('before gst');
  });
  it('no label uses an internal product word or promises a timeframe', () => {
    for (const x of buildFieldSeed(tabs).fields) { expect(x.label).not.toMatch(/workspace|\bbos\b|leadspace|\bleads?\b/i); expect(x.label).not.toMatch(/within \d|in \d+ (hours|days|minutes)|turnaround/i); }
  });
  it('the loader is a dry run by default, idempotent, and never touches an edited row', async () => {
    const store = new MemoryFieldStore();
    const dry = await loadTabFields(store, tabs, { apply: false });
    expect(dry.toCreate).toBeGreaterThan(300); expect(store.rows.size).toBe(0);
    const first = await loadTabFields(store, tabs, { apply: true }); expect(first.applied).toBe(true); expect(store.rows.size).toBe(dry.toCreate);
    const k = [...store.rows.keys()][0]; store.rows.set(k, { ...store.rows.get(k)!, label: 'Edited by staff' });
    const second = await loadTabFields(store, tabs, { apply: true });
    expect(second.toCreate).toBe(0); expect(store.rows.get(k)!.label).toBe('Edited by staff');
  });
});

describe('tab access by owner (tab keys repeat across scopes)', () => {
  const t = (scope: NavTab['scope'], ownerKey: string, key: string, state: NavTab['state']): NavTab => ({ key, label: key, route: '/' + key, scope, group: 'business', ownerKey, state, reason: state === 'ACTIVE' ? null : 'FREE_TRIAL', needsTier: null, upsellText: null, capabilityKey: null });
  const nav = [t('COMMON', 'COMMON', 'billing', 'LOCKED_PREVIEW'), t('PACK', 'CLINIC', 'billing', 'ACTIVE')];
  it('answers for the tab of that owner, not whichever comes first', () => {
    expect(tabAccess('V3', nav, 'billing').allowed).toBe(false);   // the old lookup finds the COMMON tab first
    expect(tabAccessOf('V3', nav, 'CLINIC', 'billing')).toEqual({ allowed: true });
    expect(tabAccessOf('V3', nav, 'COMMON', 'billing')).toMatchObject({ allowed: false, state: 'LOCKED_PREVIEW' });
  });
  it('a tab the vendor does not have is UNKNOWN (refused), and a LEGACY vendor is never restricted', () => {
    expect(tabAccessOf('V3', nav, 'PHARMACY', 'billing')).toMatchObject({ allowed: false, state: 'UNKNOWN' });
    expect(tabAccessOf('LEGACY', nav, 'PHARMACY', 'billing')).toEqual({ allowed: true });
  });
});
