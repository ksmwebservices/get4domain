import { normaliseState, PlaceStep, stateOfBusiness, STATE_MAX } from '../src/v3-referrals/core/referral-core';
import { PrismaReferralsStore } from '../src/v3-referrals/prisma-referrals.store';
import { ReferralsService } from '../src/v3-referrals/referrals.service';
import { MemoryPartnersStore, MemoryReferralsStore } from './support/memory-referrals-store';

/** Wave 4 W5: the vendor state shown in the partner portal comes from the state of the business address, then the place tree above the business; empty when unknown. Cleaned and capped. */

const chain = (...steps: Array<[string, string | null]>): PlaceStep => { let p: PlaceStep | null = null; for (const [kind, name] of [...steps].reverse()) p = { kind, name, parent: p }; return p!; };

describe('normaliseState (pure)', () => {
  it('trims, collapses spaces, drops control characters and angle brackets, and caps the length', () => {
    expect(normaliseState('  Tamil   Nadu ')).toBe('Tamil Nadu');
    expect(normaliseState('Kerala\u0000\n<script>')).toBe('Kerala script');
    expect(normaliseState('x'.repeat(200))).toHaveLength(STATE_MAX);
    expect(normaliseState(`${'a'.repeat(59)} bbb`)!.endsWith(' ')).toBe(false);   // the cap never leaves a trailing space
  });
  it('is null for anything that is not a usable text', () => { for (const v of ['', '   ', '\u0000\u0001', '<>', null, undefined, 5, {}, ['Kerala']]) expect(normaliseState(v)).toBeNull(); });
});

describe('stateOfBusiness (pure)', () => {
  it('the state written in the business address comes first, even when the place tree says another', () => {
    expect(stateOfBusiness('Karnataka', chain(['CITY', 'Chennai'], ['DISTRICT', 'Chennai'], ['STATE', 'Tamil Nadu']))).toBe('Karnataka');
  });
  it('with no state in the address, the STATE above the place is used: from a state, a district, a city or a locality', () => {
    const t = chain(['LOCALITY', 'T Nagar'], ['CITY', 'Chennai'], ['DISTRICT', 'Chennai'], ['STATE', 'Tamil Nadu']);
    expect(stateOfBusiness(undefined, t)).toBe('Tamil Nadu');
    expect(stateOfBusiness('', chain(['CITY', 'Kochi'], ['DISTRICT', 'Ernakulam'], ['STATE', 'Kerala']))).toBe('Kerala');
    expect(stateOfBusiness('   ', chain(['DISTRICT', 'Ernakulam'], ['STATE', 'Kerala']))).toBe('Kerala');
    expect(stateOfBusiness(null, chain(['STATE', 'Goa']))).toBe('Goa');
  });
  it('is empty (null) when unknown: no address state and no place, a place with no state above it, or an unnamed state', () => {
    expect(stateOfBusiness(undefined, null)).toBeNull(); expect(stateOfBusiness(undefined, undefined)).toBeNull();
    expect(stateOfBusiness(undefined, chain(['CITY', 'Chennai'], ['DISTRICT', 'Chennai']))).toBeNull();
    expect(stateOfBusiness(undefined, chain(['CITY', 'Chennai'], ['STATE', null]))).toBeNull();
    expect(stateOfBusiness(42, chain(['CITY', 'Chennai']))).toBeNull();
  });
  it('never returns the district or the city, and never loops on a broken tree', () => {
    expect(stateOfBusiness(undefined, chain(['CITY', 'Chennai'], ['DISTRICT', 'Chennai']))).not.toBe('Chennai');
    const loop: PlaceStep = { kind: 'CITY', name: 'x' }; loop.parent = loop;
    expect(stateOfBusiness(undefined, loop)).toBeNull();
  });
  it('cleans what it returns', () => { expect(stateOfBusiness('  Tamil\u0000   Nadu<b> ', null)).toBe('Tamil Nadu b'); });
});

describe('PrismaReferralsStore.vendorFacts reads the address, then the place tree', () => {
  const store = (vendor: unknown, biz: unknown) => new PrismaReferralsStore({ vendor: { findUnique: async () => vendor }, v3DirectoryBusiness: { findUnique: async () => biz } } as never);
  const V = { id: 'v1', email: 'v@x.invalid', phone: null, businessName: 'Biz' };
  it('address state wins; otherwise the state above the location; otherwise null', async () => {
    expect((await store(V, { addressJson: { state: ' Kerala ' }, location: { kind: 'CITY', name: 'Chennai', parent: { kind: 'STATE', name: 'Tamil Nadu', parent: null } } }).vendorFacts('v1'))!.state).toBe('Kerala');
    expect((await store(V, { addressJson: {}, location: { kind: 'LOCALITY', name: 'T Nagar', parent: { kind: 'CITY', name: 'Chennai', parent: { kind: 'DISTRICT', name: 'Chennai', parent: { kind: 'STATE', name: 'Tamil Nadu', parent: null } } } } }).vendorFacts('v1'))!.state).toBe('Tamil Nadu');
    expect((await store(V, { addressJson: { state: 7 }, location: null }).vendorFacts('v1'))!.state).toBeNull();
    expect((await store(V, null).vendorFacts('v1'))!.state).toBeNull();
    expect(await store(null, null).vendorFacts('v1')).toBeNull();
  });
  it('asks the database for the place chain up to the state and nothing else of the place', async () => {
    let seen: { select?: { location?: unknown } } | undefined;
    const s = new PrismaReferralsStore({ vendor: { findUnique: async () => V }, v3DirectoryBusiness: { findUnique: async (q: never) => { seen = q; return null; } } } as never);
    await s.vendorFacts('v1');
    const loc = JSON.stringify(seen?.select?.location);
    expect(loc).toContain('kind'); expect(loc).toContain('name'); expect(loc).not.toMatch(/slug|id"/);
  });
});

describe('the partner portal shows the cleaned state, and nothing else about the business place', () => {
  it('myVendors carries the state from the store, empty when unknown', async () => {
    const partners = new MemoryPartnersStore(); const store = new MemoryReferralsStore();
    const svc = new ReferralsService(store, partners, undefined);
    const p = partners.add({ name: 'Asha', email: 'asha@partner.example' });
    store.addVendor({ id: 'v1', state: 'Tamil Nadu' }); store.addVendor({ id: 'v2', state: null });
    await store.createAttribution({ vendorId: 'v1', partnerId: p.id, linkId: null, source: 'ON_BEHALF', setById: null, reason: null });
    await store.createAttribution({ vendorId: 'v2', partnerId: p.id, linkId: null, source: 'ON_BEHALF', setById: null, reason: null });
    const r = await svc.myVendors(p.id, 0, 25);
    expect(r.items.map((i) => i.state)).toEqual(['Tamil Nadu', null]);
    expect(JSON.stringify(r)).not.toMatch(/email|phone|vendorId|district|city/i);
  });
});
