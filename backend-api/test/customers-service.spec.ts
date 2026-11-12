import { CustomersService } from '../src/v3-customers/customers.service';
import { MemoryCustomersStore } from './support/memory-customers-store';

const A = 'vendor-a'; const B = 'vendor-b';
const make = () => { const store = new MemoryCustomersStore(); const svc = new CustomersService(store); svc.clock = () => new Date('2026-11-12T10:00:00Z'); return { store, svc }; };
const code = async (p: Promise<unknown>): Promise<unknown> => p.then(() => 'no error', (e: { getResponse?: () => { code?: string } }) => e.getResponse?.().code ?? String(e));

describe('one customer per person (the same person from two places)', () => {
  it('a second capture of the same phone adds a source, never a customer', async () => {
    const { svc, store } = make();
    const a = await svc.capture(A, { name: 'Meena', phone: '+91 98765 43210', source: 'DIRECTORY', refType: 'visit', refId: 'v1' });
    const b = await svc.capture(A, { name: 'Meena R', phone: '09876543210', source: 'BOT', refType: 'chat', refId: 'c1' });
    expect([a.created, b.created]).toEqual([true, false]); expect(b.customer.id).toBe(a.customer.id); expect(store.rows).toHaveLength(1);
    const one = await svc.get(A, a.customer.id);
    expect(one.firstSource).toBe('DIRECTORY'); expect(one.sources.map((s) => s.source)).toEqual(['DIRECTORY', 'BOT']);
  });
  it('the same e-mail with a new phone fills the gap and keeps one row; it never overwrites what is there', async () => {
    const { svc, store } = make();
    const a = await svc.capture(A, { name: 'Ravi', email: 'Ravi@X.com', source: 'SEARCH' });
    const b = await svc.capture(A, { name: 'Ravi', email: 'ravi@x.com', phone: '9876500000', source: 'PAYMENT', refType: 'document', refId: 'd1' });
    expect(b.customer.id).toBe(a.customer.id); expect(store.rows).toHaveLength(1); expect(store.rows[0].phoneKey).toBe('919876500000');
    await svc.capture(A, { name: 'Ravi', email: 'ravi@x.com', phone: '9111111111', source: 'MANUAL' });
    expect(store.rows[0].phoneKey).toBe('919876500000');
  });
  it('the same reference twice stores one source row (a retry is safe)', async () => {
    const { svc, store } = make();
    const r1 = await svc.capture(A, { name: 'M', phone: '9876543210', source: 'PAYMENT', refType: 'document', refId: 'd9' });
    const r2 = await svc.capture(A, { name: 'M', phone: '9876543210', source: 'PAYMENT', refType: 'document', refId: 'd9' });
    expect([r1.sourceAdded, r2.sourceAdded]).toEqual([true, false]); expect(store.sources).toHaveLength(1);
  });
  it('twenty parallel captures of one person leave exactly one customer', async () => {
    const { svc, store } = make();
    await Promise.all(Array.from({ length: 20 }, (_, i) => svc.capture(A, { name: 'M', phone: '9876543210', source: 'SEARCH', refType: 'q', refId: String(i) })));
    expect(store.rows).toHaveLength(1); expect(store.sources).toHaveLength(20);
  });
  it('two businesses keep their own copy of the same person', async () => {
    const { svc, store } = make();
    await svc.capture(A, { name: 'M', phone: '9876543210', source: 'SEARCH' }); await svc.capture(B, { name: 'M', phone: '9876543210', source: 'SEARCH' });
    expect(store.rows.map((r) => r.vendorId).sort()).toEqual([A, B]);
  });
  it('refuses an unknown source and an unreadable person', async () => {
    const { svc } = make();
    expect(await code(svc.capture(A, { name: 'M', phone: '9876543210', source: 'TELECRM' as never }))).toBe('CUSTOMER_INVALID');
    expect(await code(svc.capture(A, { name: 'M', source: 'MANUAL' }))).toBe('CUSTOMER_INVALID');
  });
});

describe('the vendor\'s own screens', () => {
  it('adds a customer by hand with source MANUAL and consent UNKNOWN; adding the same person again is refused with the existing id', async () => {
    const { svc } = make();
    const c = await svc.create(A, { name: 'Meena', phone: '9876543210', notes: 'prefers mornings', tags: ['vip'] });
    expect(c).toMatchObject({ firstSource: 'MANUAL', consent: 'UNKNOWN', notes: 'prefers mornings', tags: ['vip'] });
    const e = await svc.create(A, { name: 'Again', phone: '98765 43210' }).catch((x: { getResponse: () => { code: string; details: { customerId: string } } }) => x.getResponse());
    expect(e).toMatchObject({ code: 'CUSTOMER_EXISTS', details: { customerId: c.id } });
  });
  it('consent changes only by an explicit act, is stamped, and an opt-out cannot be reversed by the business', async () => {
    const { svc } = make();
    const c = await svc.create(A, { name: 'M', phone: '9876543210' });
    const on = await svc.update(A, c.id, { consent: 'OPTED_IN' }); expect(on).toMatchObject({ consent: 'OPTED_IN' }); expect(on.consentAt).toEqual(new Date('2026-11-12T10:00:00Z'));
    await svc.update(A, c.id, { consent: 'OPTED_OUT' });
    expect(await code(svc.update(A, c.id, { consent: 'OPTED_IN' }))).toBe('CUSTOMER_CONSENT_LOCKED');
    expect((await svc.get(A, c.id)).consent).toBe('OPTED_OUT');
  });
  it('changing a phone onto another customer\'s number is refused, not merged', async () => {
    const { svc } = make();
    const a = await svc.create(A, { name: 'A', phone: '9876543210' }); const b = await svc.create(A, { name: 'B', phone: '9876500000' });
    const e = await svc.update(A, b.id, { phone: '9876543210' }).catch((x: { getResponse: () => { code: string; details: { customerId: string } } }) => x.getResponse());
    expect(e).toMatchObject({ code: 'CUSTOMER_EXISTS', details: { customerId: a.id } });
  });
  it('archives and restores, never deletes; an archived person is not duplicated by a new capture', async () => {
    const { svc, store } = make();
    const c = await svc.create(A, { name: 'M', phone: '9876543210' });
    await svc.archive(A, c.id, true);
    expect((await svc.list(A, { skip: 0, take: 10 })).total).toBe(0); expect((await svc.list(A, { skip: 0, take: 10, includeArchived: true })).total).toBe(1);
    const again = await svc.capture(A, { name: 'M', phone: '9876543210', source: 'SEARCH' }); expect(again.created).toBe(false); expect(store.rows).toHaveLength(1);
    expect(await svc.archive(A, c.id, false)).toMatchObject({ archived: false });
  });
  it('lists, filters by source, searches by name, phone digits and e-mail, and summarises per source', async () => {
    const { svc } = make();
    await svc.create(A, { name: 'Meena Ravi', phone: '9876543210', email: 'meena@x.com' });
    await svc.capture(A, { name: 'Kumar', phone: '9000000001', source: 'BOT', refType: 'chat', refId: '1' });
    expect((await svc.list(A, { skip: 0, take: 10, source: 'BOT' })).items.map((x) => x.name)).toEqual(['Kumar']);
    expect((await svc.list(A, { skip: 0, take: 10, q: 'meena' })).total).toBe(1); expect((await svc.list(A, { skip: 0, take: 10, q: '98765' })).total).toBe(1); expect((await svc.list(A, { skip: 0, take: 10, q: 'MEENA@X' })).total).toBe(1);
    expect(await svc.summary(A)).toEqual({ total: 2, bySource: { SEARCH: 0, DIRECTORY: 0, BOT: 1, CAMPAIGN: 0, PAYMENT: 0, MANUAL: 1 } });
    expect(await code(svc.list(A, { skip: 0, take: 10, source: 'TELECRM' }))).toBe('CUSTOMER_INVALID');
  });
});

describe('cross-tenant', () => {
  it('another business cannot read, change, archive or list a customer, and the answer is the same as for a missing one', async () => {
    const { svc } = make();
    const c = await svc.create(A, { name: 'Private', phone: '9876543210' });
    expect(await code(svc.get(B, c.id))).toBe('CUSTOMER_NOT_FOUND'); expect(await code(svc.update(B, c.id, { name: 'x' }))).toBe('CUSTOMER_NOT_FOUND'); expect(await code(svc.archive(B, c.id, true))).toBe('CUSTOMER_NOT_FOUND');
    expect((await svc.list(B, { skip: 0, take: 10 })).total).toBe(0); expect((await svc.summary(B)).total).toBe(0);
    expect((await svc.get(A, c.id)).archived).toBe(false);
  });
});
