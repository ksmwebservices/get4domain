import { canIssueClaimLink, canMoveOutreach, csvToRows, deriveLifecycle, findDuplicates, nameKey, parseCsv, seededSiteQuality, validateSeedRow } from '../src/seeded-sites/core/seeded';

/** Slice 5.13a, the pure rules. Every piece is tested on its own. */
const known = (id: string) => ['plumber', 'dentist', 'jewellery'].includes(id);
const good = { businessName: 'Sri Ganesh Plumbing', category: 'plumber', city: 'Chennai', area: 'T Nagar', phone: '98765 43210', email: 'ganesh@example.in', sourceKind: 'FIELD_VISIT', publicFactsOnly: 'yes' };

describe('parseCsv', () => {
  it('handles quotes, commas in quotes, doubled quotes, line breaks in quotes, CRLF, a BOM and trailing blank lines', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\r\n\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['two\nlines', 'z']]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]); expect(parseCsv('')).toEqual([]);
  });
});

describe('csvToRows', () => {
  const head = 'businessName,category,city,area,phone,email,sourceKind,publicFactsOnly\n';
  it('maps columns by name ignoring case and spaces, keeps the file line numbers, ignores unknown columns', () => {
    const r = csvToRows(`Business Name, CATEGORY ,city,area,phone,Source Kind,publicFactsOnly,extra\nAcme,plumber,Chennai,Adyar,9876543210,PUBLIC_LISTING,yes,zzz\n`, 10);
    expect(r.error).toBeNull(); expect(r.rows).toHaveLength(1); expect(r.rows[0]).toMatchObject({ line: 2, cells: { businessName: 'Acme', category: 'plumber', sourceKind: 'PUBLIC_LISTING', email: '' } });
  });
  it('refuses a file with a missing required column, an empty file, a file over the row limit and one over the size limit', () => {
    expect(csvToRows('businessName,city\nA,B\n', 10).error).toMatch(/Missing columns: category, area, phone, sourceKind, publicFactsOnly/);
    expect(csvToRows('', 10).error).toMatch(/empty/); expect(csvToRows('   \n\n', 10).error).toMatch(/empty/);
    expect(csvToRows(head + 'a,b,c,d,e,f,g,h\n'.repeat(5), 4).error).toMatch(/most allowed in one batch is 4/);
    expect(csvToRows('x'.repeat(1_000_001), 10).error).toMatch(/too large/);
  });
});

describe('validateSeedRow', () => {
  it('accepts a good row and normalises the phone', () => {
    const r = validateSeedRow(good, { categoryExists: known });
    expect(r).toMatchObject({ ok: true, input: { businessName: 'Sri Ganesh Plumbing', phone: '+919876543210', phoneKey: '9876543210', email: 'ganesh@example.in', sourceKind: 'FIELD_VISIT', publicFactsConfirmed: true } });
  });
  it('the public email is optional', () => { expect(validateSeedRow({ ...good, email: '' }, { categoryExists: known })).toMatchObject({ ok: true, input: { email: null } }); });
  it.each([
    ['businessName', { businessName: 'A' }], ['category', { category: '' }], ['city', { city: '' }], ['area', { area: ' ' }], ['phone', { phone: '12345' }],
    ['sourceKind', { sourceKind: 'GUESS' }], ['sourceKind', { sourceKind: '' }], ['publicFactsOnly', { publicFactsOnly: '' }], ['publicFactsOnly', { publicFactsOnly: 'no' }], ['email', { email: 'not-an-email' }],
  ])('a bad %s is refused and named', (field, over) => {
    const r = validateSeedRow({ ...good, ...over }, { categoryExists: known });
    expect(r.ok).toBe(false); expect((r as { errors: string[] }).errors.join('|')).toContain(field);
  });
  it('an unknown category is named; every problem is listed at once', () => {
    expect((validateSeedRow({ ...good, category: 'spaceship' }, { categoryExists: known }) as { errors: string[] }).errors).toEqual(['category: "spaceship" is not a known category']);
    expect((validateSeedRow({}, { categoryExists: known }) as { errors: string[] }).errors.length).toBeGreaterThanOrEqual(6);
  });
  it('the staff checkbox is required on EVERY create: true, "yes", "true", "1" pass; anything else does not', () => {
    for (const v of [true, 'yes', 'TRUE', '1', 'y']) expect(validateSeedRow({ ...good, publicFactsOnly: v }, { categoryExists: known }).ok).toBe(true);
    for (const v of [false, 'no', '0', undefined, 'maybe']) expect(validateSeedRow({ ...good, publicFactsOnly: v }, { categoryExists: known }).ok).toBe(false);
  });
});

describe('duplicates', () => {
  const k = (phoneHash: string, emailHash: string | null, name: string, city = 'Chennai') => ({ phoneHash, emailHash, nameKey: nameKey(name, city) });
  it('nameKey ignores case, spaces and punctuation but not the city', () => {
    expect(nameKey('Sri Ganesh Plumbing', 'Chennai')).toBe(nameKey('  SRI-ganesh  plumbing.', 'chennai')); expect(nameKey('A', 'Chennai')).not.toBe(nameKey('A', 'Madurai'));
  });
  it('finds a duplicate of an existing site by phone, email and name plus city; unrelated rows are clean', () => {
    const existing = [k('p1', 'e1', 'Acme')];
    const d = findDuplicates([{ ...k('p1', null, 'Other'), line: 2 }, { ...k('p9', 'e1', 'Other2'), line: 3 }, { ...k('p8', null, 'ACME'), line: 4 }, { ...k('p7', 'e7', 'Fresh'), line: 5 }], existing);
    expect(d.get(2)).toEqual([{ kind: 'PHONE', with: 'EXISTING' }]); expect(d.get(3)).toEqual([{ kind: 'EMAIL', with: 'EXISTING' }]); expect(d.get(4)).toEqual([{ kind: 'NAME_CITY', with: 'EXISTING' }]); expect(d.has(5)).toBe(false);
  });
  it('inside one batch the FIRST row is kept and later rows point at it', () => {
    const d = findDuplicates([{ ...k('p1', 'e1', 'Acme'), line: 2 }, { ...k('p1', null, 'Beta'), line: 3 }, { ...k('p2', 'e1', 'Gamma'), line: 4 }, { ...k('p3', null, 'acme'), line: 5 }], []);
    expect(d.has(2)).toBe(false); expect(d.get(3)).toEqual([{ kind: 'PHONE', with: 'BATCH_ROW', line: 2 }]); expect(d.get(4)).toEqual([{ kind: 'EMAIL', with: 'BATCH_ROW', line: 2 }]); expect(d.get(5)).toEqual([{ kind: 'NAME_CITY', with: 'BATCH_ROW', line: 2 }]);
  });
});

describe('seededSiteQuality', () => {
  const ok = { businessName: 'Acme', categoryKnown: true, city: 'Chennai', area: 'Adyar', phoneE164: '+919876543210', sourceKind: 'FIELD_VISIT', publicFactsConfirmed: true, onRegister: false, lifecycle: 'SEEDED' as const };
  it('passes when complete', () => { expect(seededSiteQuality(ok)).toEqual({ pass: true, missing: [] }); });
  it.each([
    ['BUSINESS_NAME', { businessName: ' ' }], ['CATEGORY', { categoryKnown: false }], ['CITY', { city: null }], ['AREA', { area: '' }], ['PHONE', { phoneE164: null }],
    ['SOURCE', { sourceKind: null }], ['SOURCE', { publicFactsConfirmed: false }], ['SOURCE', { sourceKind: 'MADE_UP' }], ['ON_REGISTER', { onRegister: true }], ['REMOVED', { lifecycle: 'REMOVED' as const }],
  ])('%s is reported', (code, over) => { const r = seededSiteQuality({ ...ok, ...over }); expect(r.pass).toBe(false); expect(r.missing).toContain(code); });
  it('lists everything missing at once', () => { expect(seededSiteQuality({ ...ok, city: '', area: '', onRegister: true }).missing).toEqual(['CITY', 'AREA', 'ON_REGISTER']); });
});

describe('claim links and outreach', () => {
  const base = { ownerAgreedToContact: true, phoneOnRegister: false, lifecycle: 'SEEDED' as const, outreachStatus: 'INTERESTED' as const };
  it('allowed only with consent, off the register, not removed, not already claimed, not do-not-contact', () => {
    expect(canIssueClaimLink(base)).toEqual({ ok: true, reason: null });
    expect(canIssueClaimLink({ ...base, ownerAgreedToContact: false })).toEqual({ ok: false, reason: 'CONSENT_REQUIRED' });
    expect(canIssueClaimLink({ ...base, phoneOnRegister: true })).toEqual({ ok: false, reason: 'ON_REGISTER' });
    expect(canIssueClaimLink({ ...base, lifecycle: 'REMOVED' })).toEqual({ ok: false, reason: 'REMOVED' });
    expect(canIssueClaimLink({ ...base, lifecycle: 'CLAIMED_FREE' })).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(canIssueClaimLink({ ...base, lifecycle: 'PRO' })).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(canIssueClaimLink({ ...base, outreachStatus: 'DO_NOT_CONTACT' })).toEqual({ ok: false, reason: 'DO_NOT_CONTACT' });
    expect(canIssueClaimLink({ ...base, lifecycle: 'INVITED' }).ok).toBe(true);   // re-issuing an invited link is fine
  });
  it('do-not-contact is final; everything else moves freely', () => {
    expect(canMoveOutreach('DO_NOT_CONTACT', 'CALLED')).toBe(false); expect(canMoveOutreach('DO_NOT_CONTACT', 'DO_NOT_CONTACT')).toBe(true);
    expect(canMoveOutreach('NOT_CONTACTED', 'DO_NOT_CONTACT')).toBe(true); expect(canMoveOutreach('DECLINED', 'INTERESTED')).toBe(true);
  });
  it('lifecycle is derived from the stored value and the facts; a removal always wins', () => {
    expect(deriveLifecycle({ stored: 'SEEDED', businessStatus: 'UNCLAIMED', proActive: false })).toBe('SEEDED');
    expect(deriveLifecycle({ stored: 'INVITED', businessStatus: 'UNCLAIMED', proActive: false })).toBe('INVITED');
    expect(deriveLifecycle({ stored: 'INVITED', businessStatus: 'CLAIMED', proActive: false })).toBe('CLAIMED_FREE');
    expect(deriveLifecycle({ stored: 'SEEDED', businessStatus: 'CLAIMED', proActive: true })).toBe('PRO');
    expect(deriveLifecycle({ stored: 'CLAIMED_FREE', businessStatus: 'CLAIMED', proActive: false })).toBe('CLAIMED_FREE');
    expect(deriveLifecycle({ stored: 'REMOVED', businessStatus: 'CLAIMED', proActive: true })).toBe('REMOVED');
    expect(deriveLifecycle({ stored: 'SEEDED', businessStatus: 'REMOVED', proActive: false })).toBe('REMOVED');
  });
});
