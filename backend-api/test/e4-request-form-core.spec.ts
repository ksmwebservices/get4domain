import { dataProblems, detailLines, formFor, MAX_REQUEST_FIELDS, validateDetails } from '../src/requests-orders/core/request-form-core';
import { REQUEST_FORM_DATA } from '../src/requests-orders/core/request-form-data';
import { packOfIndustry, requestFormFor } from '../src/requests-orders/request-form';
import { CATALOGUE_CATEGORIES } from '../src/directory/core/catalogue-categories';
import { PACK_KEYS } from '../src/v3-theme-market/core/theme-package-core';

/** S1 shell, platform side: the request form is data per industry pack and per category, checked on the server. */
const keys = (id: string | null | undefined) => requestFormFor(id).map((f) => f.key);

describe('the request form data', () => {
  it('every list is well formed: keys, types, labels, options, no reserved key, at most the limit', () => {
    expect(dataProblems(REQUEST_FORM_DATA)).toEqual([]);
    expect(MAX_REQUEST_FIELDS).toBeGreaterThanOrEqual(8);
  });
  it('every pack named in the data is a real industry pack, and every category named is in the catalogue', () => {
    for (const p of Object.keys(REQUEST_FORM_DATA.packs)) expect(PACK_KEYS).toContain(p);
    const ids = new Set(CATALOGUE_CATEGORIES.map((c) => c.id));
    for (const c of Object.keys(REQUEST_FORM_DATA.categories)) expect(ids.has(c)).toBe(true);
  });
  it('the three examples: a builder asks for site visit date, time and site; an ambulance for the pickup place; a plumber for address and time', () => {
    expect(keys('mason-contractor')).toEqual(['site', 'visit_date', 'visit_time']);
    expect(keys('civil-contractor-builder')).toEqual(['site', 'visit_date', 'visit_time']);
    expect(keys('ambulance-service')).toEqual(['pickup_location', 'destination', 'urgency']);
    expect(keys('plumber')).toEqual(['address', 'when', 'problem']);
    expect(requestFormFor('plumber').find((f) => f.key === 'address')).toMatchObject({ required: true, type: 'text' });
    expect(requestFormFor('ambulance-service').find((f) => f.key === 'pickup_location')?.required).toBe(true);
    expect(requestFormFor('mason-contractor').find((f) => f.key === 'site')?.required).toBe(true);
  });
  it('a category without its own list gets its pack list; an unknown or missing category gets the default', () => {
    expect(packOfIndustry('electrician')).toBe('FIELD_SERVICE');
    expect(keys('electrician')).toEqual(['address', 'when']);
    expect(keys('no-such-category')).toEqual(['preferred_time']);
    expect(keys(null)).toEqual(['preferred_time']);
    expect(keys(undefined)).toEqual(['preferred_time']);
  });
  it('a category list replaces the pack list (no merge), and formFor hands out copies', () => {
    const a = formFor(REQUEST_FORM_DATA, { pack: 'FIELD_SERVICE', category: 'plumber' });
    expect(a.map((f) => f.key)).toEqual(['address', 'when', 'problem']);
    a[0].label = 'changed';
    expect(REQUEST_FORM_DATA.categories.plumber[0].label).toBe('Address where the work is needed');
  });
  it('every one of the 196 catalogue categories gets a form (its own, its pack list or the default), and every form passes the data rules', () => {
    for (const c of CATALOGUE_CATEGORIES) {
      const f = requestFormFor(c.id);
      expect(f.length).toBeGreaterThan(0);
      expect(dataProblems({ defaults: f, packs: {}, categories: {} })).toEqual([]);
    }
  });
  it('the check finds a bad edit: duplicate key, reserved key, select without options, bad key', () => {
    const bad = { defaults: [], packs: { X: [{ key: 'a', label: 'A', type: 'text' as const, required: false }, { key: 'a', label: 'B', type: 'text' as const, required: false }, { key: 'phone', label: 'P', type: 'text' as const, required: false }, { key: 'Bad Key', label: 'K', type: 'text' as const, required: false }, { key: 's', label: 'S', type: 'select' as const, required: false }] }, categories: {} };
    const p = dataProblems(bad).join('|');
    expect(p).toContain('duplicate key'); expect(p).toContain('reserved key'); expect(p).toContain('bad key'); expect(p).toContain('bad options');
  });
});

describe('checking what the visitor sent', () => {
  const plumber = requestFormFor('plumber'); const builder = requestFormFor('mason-contractor');
  it('a good answer set is returned clean; empty optional answers are left out', () => {
    const r = validateDetails(plumber, { address: '  12  Market Road, Aluva ', when: 'Today', problem: '' });
    expect(r).toEqual({ ok: true, values: { address: '12 Market Road, Aluva', when: 'Today' } });
  });
  it('a required field that is missing is named', () => {
    expect(validateDetails(plumber, { when: 'Today' })).toEqual({ ok: false, errors: ['address: required'] });
    expect(validateDetails(builder, {})).toEqual({ ok: false, errors: ['site: required'] });
  });
  it('only the fields of that business are read: anything else is ignored, never stored', () => {
    const r = validateDetails(plumber, { address: 'x road', evil: '<script>', constructor: 'x', __proto__: 'y' } as never);
    expect(r).toEqual({ ok: true, values: { address: 'x road' } });
  });
  it('a select must be one of the listed answers; markup and control characters are refused', () => {
    expect(validateDetails(plumber, { address: 'a', when: 'Whenever' })).toEqual({ ok: false, errors: ['when: choose one of the listed answers'] });
    expect(validateDetails(plumber, { address: '<b>x</b>' })).toMatchObject({ ok: false });
    expect(validateDetails(plumber, { address: 'a\u0000b' })).toMatchObject({ ok: false });
  });
  it('dates must be real days, times real clock times, numbers whole numbers', () => {
    expect(validateDetails(builder, { site: 's', visit_date: '2026-12-31', visit_time: 'Morning' })).toMatchObject({ ok: true });
    for (const d of ['2026-02-30', '31-12-2026', '2026-13-01', 'tomorrow', '1999-01-01']) expect(validateDetails(builder, { site: 's', visit_date: d })).toMatchObject({ ok: false });
    const t = [{ key: 'at', label: 'At', type: 'time' as const, required: false }, { key: 'n', label: 'N', type: 'number' as const, required: false }, { key: 'p', label: 'P', type: 'phone' as const, required: false }];
    expect(validateDetails(t, { at: '14:30', n: '4', p: '+91 98765 43210' })).toEqual({ ok: true, values: { at: '14:30', n: '4', p: '+91 98765 43210' } });
    for (const bad of [{ at: '25:00' }, { at: '9:5' }, { n: '0' }, { n: '1.5' }, { n: '-3' }, { p: 'call me' }]) expect(validateDetails(t, bad)).toMatchObject({ ok: false });
  });
  it('long text is cut off by refusal, not silently', () => {
    expect(validateDetails(plumber, { address: 'x'.repeat(201) })).toMatchObject({ ok: false });
    const lt = [{ key: 'l', label: 'L', type: 'longtext' as const, required: false }];
    expect(validateDetails(lt, { l: 'x'.repeat(1000) })).toMatchObject({ ok: true });
    expect(validateDetails(lt, { l: 'x'.repeat(1001) })).toMatchObject({ ok: false });
  });
  it('the answers read as lines for the inbox, in form order', () => {
    const v = validateDetails(plumber, { when: 'Today', address: 'Road 1' });
    if (!v.ok) throw new Error('invalid');
    expect(detailLines(plumber, v.values)).toEqual(['Address where the work is needed: Road 1', 'When do you need us?: Today']);
  });
});
