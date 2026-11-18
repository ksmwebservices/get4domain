import { DuplicateCheckService, EnforceContext } from '../src/v3-duplicates/duplicate-check.service';
import { DuplicateInput } from '../src/v3-duplicates/core/duplicate-core';
import { MeDomainSalesController } from '../src/v3-registrar/api/registrar.controllers';
import { Quote, vendorQuoteView } from '../src/v3-registrar/registrar.service';
import { MemoryDuplicateStore } from './support/memory-duplicate-store';

/** B5.1: what the vendor and a refused visitor are told must never include the registrar cost, the margin or a full listing row. */
const quote = (): Quote => ({
  domain: 'a.com', tld: 'com', years: 1, kind: 'REGISTER', costPaise: 70000, marginPaise: 30000, privacyPaise: 0, taxablePaise: 100000, taxPaise: 18000, totalPaise: 118000,
  lines: [{ name: 'GST', ratePercent: 18, amountPaise: 18000 }],
  taxSnapshot: { taxInclusive: false, totalMinor: 118000, years: 1, costPaise: 70000, marginPaise: 30000, privacyPaise: 0 },
});
const noLeak = (v: unknown): void => { const t = JSON.stringify(v); expect(t).not.toContain('costPaise'); expect(t).not.toContain('marginPaise'); expect(t).not.toContain('70000'); expect(t).not.toContain('30000'); };

describe('vendor quote view', () => {
  it('drops cost and margin at the top and inside the snapshot, keeps what the vendor pays', () => {
    const v = vendorQuoteView(quote());
    noLeak(v);
    expect(v.totalPaise).toBe(118000); expect(v.taxPaise).toBe(18000); expect(v.lines).toHaveLength(1); expect(v.taxSnapshot.totalMinor).toBe(118000);
  });
  it('does not change the quote the order is created from', () => { const q = quote(); vendorQuoteView(q); expect(q.costPaise).toBe(70000); expect((q.taxSnapshot as { marginPaise: number }).marginPaise).toBe(30000); });
  it('all three vendor quote routes (quote, transfer-quote, renew-quote) answer through the view', async () => {
    const svc = { quote: async () => quote(), transferQuote: async () => quote(), renewQuote: async () => quote() };
    const c = new MeDomainSalesController(svc as never); const t = { vendorId: 'v1' } as never;
    noLeak(await c.quote(t, { domain: 'a.com', years: 1 })); noLeak(await c.transferQuote(t, { domain: 'a.com' })); noLeak(await c.renewQuote(t, 'r1', { years: 1 } as never));
  });
});

describe('duplicate refusal candidates', () => {
  const ADMIN = { id: 'staff-admin', role: 'ADMIN' };
  const input = (o: Partial<DuplicateInput> = {}): DuplicateInput => ({ email: 'fresh@example.com', phone: '9000000001', businessName: 'Sri Ganesh Plumbers', area: 'T Nagar', pincode: '600017', category: 'plumber', ...o });
  const run = async (ctx: EnforceContext): Promise<Record<string, unknown>> => {
    const store = new MemoryDuplicateStore();
    store.vendors.push({ id: 'v-old', email: 'old@example.com', phone: '+91 98765 43210', phoneKey: '9876543210', name: 'Ganesh Kumar', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', address: 'T Nagar 600017', subdomain: 'sriganesh', customDomain: null });
    store.listings.push({ id: 'b-old', slug: 'sri-ganesh-plumbing-chennai', name: 'Sri Ganesh Plumbing', vendorId: 'v-old', status: 'UNCLAIMED', phoneE164: '+919876543210', pincode: '600017', line2: 'T Nagar', city: 'Chennai', category: 'plumber' });
    // A store that returns the full row (extra private fields) must still not reach the caller.
    const orig = store.publicListings.bind(store);
    store.publicListings = (async (...a: Parameters<typeof orig>) => (await orig(...a)).map((l) => ({ ...l, phoneE164: '+919876543210', email: 'old@example.com', vendorId: 'v-old', costPaise: 1 }))) as never;
    try { await new DuplicateCheckService(store).enforce(input(), ctx); } catch (e) { return (e as { getResponse: () => Record<string, unknown> }).getResponse(); }
    throw new Error('expected a refusal');
  };
  const FACT_KEYS = ['area', 'category', 'city', 'claimable', 'name', 'slug'];
  it('a staff path sends only the six public facts per candidate', async () => {
    const body = await run({ path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false, listingsAreAttachable: false });
    expect(body.code).toBe('DUPLICATE_POSSIBLE');
    const cands = body.candidates as Array<Record<string, unknown>>; expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) expect(Object.keys(c).sort()).toEqual(FACT_KEYS);
    const text = JSON.stringify(cands); for (const s of ['b-old', 'v-old', 'old@example.com', '9876543210', 'costPaise']) expect(text).not.toContain(s);
  });
  it('a visitor path sends the same six facts', async () => {
    const body = await run({ path: 'REGISTER', selfService: true });
    for (const c of body.candidates as Array<Record<string, unknown>>) expect(Object.keys(c).sort()).toEqual(FACT_KEYS);
  });
});
