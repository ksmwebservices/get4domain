import { readTyped, shapeAvailability, validLabel } from '../src/v3-registrar/core/public-availability-core';
import { RegistrarError } from '../src/v3-registrar/registrar.port';
import { PublicDomainAvailabilityService } from '../src/v3-registrar/public-availability.service';
import { RegistrarStore } from '../src/v3-registrar/registrar.store';
import { FakeRegistrar } from './support/registrar-world';

/** B3.6: the public domain availability answer. "Available" is only said when the registrar said so. */
const NOW = new Date('2026-11-18T10:00:00Z');
const subOk = { available: true, name: 'kumar-plumbing', reason: 'AVAILABLE' as const, message: 'That address is free.' };
const subTaken = { available: false, name: null, reason: 'UNAVAILABLE' as const, message: 'That address is not available.' };

function make(o: { flag?: boolean; margins?: string[]; sub?: typeof subOk | typeof subTaken | null } = {}) {
  const marginRows: unknown[] = [];
  const store = { margins: async () => marginRows } as unknown as RegistrarStore;
  for (const tld of o.margins ?? ['com', 'in']) marginRows.push({ id: `m-${tld}`, tld, kind: 'FIXED_PAISE', value: 10_000, status: 'APPROVED', effectiveFrom: new Date('2026-01-01T00:00:00Z'), note: null, createdBy: null, approvedBy: null, approvedAt: null, createdAt: NOW } as never);
  const port = new FakeRegistrar();
  const sub = o.sub === undefined ? subOk : o.sub;
  const svc = new PublicDomainAvailabilityService(store, port, sub ? { check: jest.fn(async () => sub) } : undefined);
  svc.clock = () => NOW; svc.env = () => (o.flag ? { REGISTRAR_LIVE_SEARCH: 'true' } : {});
  return { svc, port };
}

describe('reading what was typed', () => {
  it('a label, a full name, a pasted address with scheme, www and path; nothing usable is null', () => {
    expect(readTyped('Kumar-Plumbing')).toEqual({ label: 'kumar-plumbing', full: null, tld: null });
    expect(readTyped('kumar.in')).toEqual({ label: 'kumar', full: 'kumar.in', tld: 'in' });
    expect(readTyped('https://www.Kumar.co.in/about?x=1')).toEqual({ label: 'kumar', full: 'kumar.co.in', tld: 'co.in' });
    expect(readTyped('  ')).toEqual({ label: null, full: null, tld: null }); expect(readTyped(undefined)).toEqual({ label: null, full: null, tld: null });
    expect(validLabel('ok-name')).toBe(true); expect(validLabel('-bad')).toBe(false); expect(validLabel('has space')).toBe(false); expect(validLabel(null)).toBe(false);
  });
});

describe('the registrar is off (the default)', () => {
  it('the custom domain says REGISTRAR_OFF, registrar OFF, no results, and the registrar is never asked; the subdomain still answers', async () => {
    const { svc, port } = make({ flag: false });
    const r = await svc.check('kumar-plumbing');
    expect(r.customDomain).toMatchObject({ state: 'REGISTRAR_OFF', registrar: 'OFF', results: [] });
    expect(r.customDomain.message).toMatch(/not switched on yet/);
    expect(r.subdomain).toMatchObject({ state: 'AVAILABLE', name: 'kumar-plumbing' });
    expect(port.calls).toEqual([]);
  });
  it('a taken subdomain is TAKEN (taken and blocked share one answer); a similar name is carried as a warning', async () => {
    expect((await make({ sub: subTaken }).svc.check('x-name')).subdomain).toMatchObject({ state: 'TAKEN', name: null });
    const warn = make({ sub: { ...subOk, similarTo: 'sriganesh' } as never });
    expect((await warn.svc.check('sr1ganesh')).subdomain).toMatchObject({ state: 'AVAILABLE', similarTo: 'sriganesh' });
  });
  it('nothing usable typed: INVALID for the custom domain, no subdomain answer, nothing asked', async () => {
    const { svc, port } = make({ flag: true, sub: null });
    expect(await svc.check('')).toMatchObject({ name: null, subdomain: null, customDomain: { state: 'INVALID' } });
    expect(await svc.check('-bad-')).toMatchObject({ customDomain: { state: 'INVALID' } });
    expect(port.calls).toEqual([]);
  });
});

describe('the registrar is on', () => {
  it('a label is asked across the extensions on sale: each row is the registrar own answer, the overall state is AVAILABLE only when one is', async () => {
    const { svc, port } = make({ flag: true }); port.taken.add('kumar.com');
    const r = await svc.check('kumar');
    expect(r.customDomain).toMatchObject({ state: 'AVAILABLE', registrar: 'ON' });
    expect(r.customDomain.results).toEqual([{ domain: 'kumar.com', state: 'TAKEN' }, { domain: 'kumar.in', state: 'AVAILABLE' }]);
    port.taken.add('kumar.in');
    expect((await svc.check('kumar2')).customDomain.state).toBe('AVAILABLE');   // a different name is a different question
    const all = make({ flag: true }); all.port.taken.add('zed.com'); all.port.taken.add('zed.in');
    expect((await all.svc.check('zed')).customDomain).toMatchObject({ state: 'TAKEN' });
  });
  it('a typed extension asks about that name only; an extension that is not sold is NOT_FOR_SALE and is not asked', async () => {
    const { svc, port } = make({ flag: true });
    expect((await svc.check('kumar.in')).customDomain.results).toEqual([{ domain: 'kumar.in', state: 'AVAILABLE' }]);
    const before = port.calls.length;
    expect((await svc.check('kumar.xyz')).customDomain).toMatchObject({ state: 'NOT_FOR_SALE', results: [] }); expect(port.calls.length).toBe(before);
  });
  it('no extension has an approved price yet: NOT_FOR_SALE, and the registrar is not asked', async () => {
    const { svc, port } = make({ flag: true, margins: [] });
    expect((await svc.check('kumar')).customDomain).toMatchObject({ state: 'NOT_FOR_SALE', registrar: 'ON' }); expect(port.calls).toEqual([]);
  });
  it('a registrar that does not answer is UNKNOWN, never available, and the error text is not returned', async () => {
    const { svc, port } = make({ flag: true });
    port.search = async () => { throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true); };
    const r = await svc.check('kumar');
    expect(r.customDomain).toMatchObject({ state: 'UNKNOWN', results: [] }); expect(JSON.stringify(r)).not.toMatch(/UNREACHABLE/);
    port.search = async () => [{ domain: 'q.com', status: 'UNKNOWN' }, { domain: 'q.in', status: 'TAKEN' }];
    expect((await svc.check('q')).customDomain.state).toBe('UNKNOWN');   // unsure beats taken when nothing is available
  });
  it('the same name is asked of the registrar once a minute, then again', async () => {
    const { svc, port } = make({ flag: true });
    await svc.check('kumar'); await svc.check('KUMAR'); expect(port.calls.filter((c) => c === 'search')).toHaveLength(1);
    svc.clock = () => new Date(NOW.getTime() + 61_000); await svc.check('kumar'); expect(port.calls.filter((c) => c === 'search')).toHaveLength(2);
  });
});

describe('the pure shape never invents "available"', () => {
  it('without hits the custom domain can only be OFF, NOT_FOR_SALE, UNKNOWN or INVALID', () => {
    const typed = readTyped('kumar');
    for (const registrarOn of [true, false]) for (const tldsOnSale of [[], ['com']]) {
      const r = shapeAvailability({ typed, subdomain: null, registrarOn, tldsOnSale, hits: null, registrarFailed: false });
      expect(['REGISTRAR_OFF', 'NOT_FOR_SALE', 'UNKNOWN']).toContain(r.customDomain.state);
    }
  });
});
