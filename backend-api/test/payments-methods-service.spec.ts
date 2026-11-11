import { OWNER, requestsWorld, RW, STAFF } from './support/requests-world';

/** Slice 5.17a (owner amendment 06, UPI only): vendor payment methods through the service with memory twins. */
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW;
beforeEach(async () => { w = await requestsWorld(); });
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const upi = (over: Record<string, unknown> = {}) => ({ kind: 'UPI' as const, label: 'My UPI', upiId: 'Priya.Shop@OKSBI', payeeName: 'Priya  Stores', ...over });

describe('gateway kinds are not offered to vendors', () => {
  it.each(['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM'])('%s is rejected on create and nothing is stored', async (kind) => {
    expect(await code(w.vendor.createMethod('va', { kind: kind as never, label: 'Gate', details: 'key_abcd', webhookSecret: 'whsec-12345678' } as never, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(w.store.methods.size).toBe(0);
  });
  it('a legacy gateway row is hidden from the owner list and the staff view, and cannot be changed or tested', async () => {
    const row = await w.legacyGateway('va');
    expect(await w.vendor.listMethods('va')).toEqual([]);
    expect(await w.staff.vendorMethods('va')).toEqual([]);
    expect(await code(w.vendor.updateMethod('va', row.id, { status: 'ACTIVE' }, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(await code(w.vendor.setDefaultMethod('va', row.id, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(await code(w.vendor.testMethod('va', row.id, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(w.store.methods.has(row.id)).toBe(true);   // nothing is deleted
  });
  it('a gateway row does not make the shop ready for online checkout', async () => {
    await w.legacyGateway('va', 'ACTIVE');
    expect(await code(w.pub.order('shop-a.get4domain.com', w.orderBody(), '1.1.1.1'))).toBe('ORDER_INVALID');
  });
});

describe('UPI id and payee name', () => {
  it('both are required and validated; the id is stored trimmed in lower case and the name with spacing folded', async () => {
    for (const bad of [{ upiId: undefined }, { upiId: 'nobank' }, { upiId: 'a@b' }, { payeeName: undefined }, { payeeName: '<script>' }, { payeeName: 'x' }]) expect(await code(w.vendor.createMethod('va', upi(bad) as never, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    const m = await w.vendor.createMethod('va', upi() as never, OWNER);
    expect(m).toMatchObject({ kind: 'UPI', upiId: 'priya.shop@oksbi', payeeName: 'Priya Stores', status: 'UNVERIFIED', isDefault: false });
  });
  it('a payee name that does not match raises the mismatch and NEVER blocks', async () => {
    const m = await w.vendor.createMethod('va', upi() as never, OWNER);
    expect(m.payeeCheck).toBe('MISMATCH');
    expect(w.payeeCalls).toEqual([{ vendorId: 'va', payeeName: 'Priya Stores' }]);
    expect(w.store.methods.size).toBe(1);
  });
  it('changing the UPI id needs a confirm: without it nothing changes; with it the id changes, the method drops to UNVERIFIED and PAYMENT_METHOD_CHANGED is recorded with field names only', async () => {
    const m = await w.vendor.createMethod('va', upi() as never, OWNER);
    await w.vendor.testMethod('va', m.id, OWNER); await w.vendor.updateMethod('va', m.id, { status: 'ACTIVE' }, OWNER);
    expect(await code(w.vendor.updateMethod('va', m.id, { upiId: 'new.shop@okaxis' }, OWNER))).toBe('PAYMENT_METHOD_CONFIRM_REQUIRED');
    expect((await w.vendor.listMethods('va'))[0]).toMatchObject({ upiId: 'priya.shop@oksbi', status: 'ACTIVE' });
    expect(w.activity.rows).toEqual([]);
    const u = await w.vendor.updateMethod('va', m.id, { upiId: 'new.shop@okaxis', confirmUpiChange: true }, OWNER);
    expect(u).toMatchObject({ upiId: 'new.shop@okaxis', status: 'UNVERIFIED' });
    expect(w.activity.rows.map((r) => r.actionKey)).toEqual(['payment_method.upi_changed']);
    expect(JSON.stringify(w.activity.rows)).not.toMatch(/okaxis|oksbi/);
    expect(w.activity.rows[0].summary).toMatchObject({ changed: ['upiId'] });
  });
  it('re-saving the same id (any case) needs no confirm and records nothing', async () => {
    const m = await w.vendor.createMethod('va', upi() as never, OWNER);
    expect(await code(w.vendor.updateMethod('va', m.id, { upiId: ' PRIYA.SHOP@oksbi ', label: 'Renamed' }, OWNER))).toBe('OK');
    expect(w.activity.rows).toEqual([]);
  });
});

describe('default method', () => {
  it('only an ACTIVE method can be the default; there is one default per vendor; setting another moves it', async () => {
    const a = await w.vendor.createMethod('va', upi() as never, OWNER);
    expect(await code(w.vendor.setDefaultMethod('va', a.id, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    await w.vendor.testMethod('va', a.id, OWNER); await w.vendor.updateMethod('va', a.id, { status: 'ACTIVE' }, OWNER);
    const b = await w.vendor.createMethod('va', upi({ label: 'Second', upiId: 'second@okhdfc' }) as never, OWNER);
    await w.vendor.testMethod('va', b.id, OWNER); await w.vendor.updateMethod('va', b.id, { status: 'ACTIVE' }, OWNER);
    await w.vendor.setDefaultMethod('va', a.id, OWNER); await w.vendor.setDefaultMethod('va', b.id, OWNER);
    expect((await w.vendor.listMethods('va')).filter((m) => m.isDefault).map((m) => m.id)).toEqual([b.id]);
  });
  it('disabling the default clears it', async () => {
    const a = await w.vendor.createMethod('va', upi() as never, OWNER);
    await w.vendor.testMethod('va', a.id, OWNER); await w.vendor.updateMethod('va', a.id, { status: 'ACTIVE' }, OWNER); await w.vendor.setDefaultMethod('va', a.id, OWNER);
    await w.vendor.updateMethod('va', a.id, { status: 'DISABLED' }, OWNER);
    expect((await w.vendor.listMethods('va'))[0].isDefault).toBe(false);
  });
});

describe('cross-tenant and staff view', () => {
  it('vendor B cannot read, update, test or default vendor A\'s UPI method; the answer is the same as for a method that does not exist', async () => {
    const a = await w.vendor.createMethod('va', upi() as never, OWNER);
    for (const p of [w.vendor.updateMethod('vb', a.id, { label: 'Mine now' }, OWNER), w.vendor.testMethod('vb', a.id, OWNER), w.vendor.setDefaultMethod('vb', a.id, OWNER)]) expect(await code(p)).toBe('PAYMENT_METHOD_INVALID');
    expect(await w.vendor.listMethods('vb')).toEqual([]);
    expect((await w.vendor.listMethods('va'))[0]).toMatchObject({ label: 'My UPI' });
  });
  it('staff see the method masked: no full UPI id, no secrets, read only', async () => {
    const a = await w.vendor.createMethod('va', upi() as never, OWNER);
    const v = await w.staff.vendorMethods('va');
    expect(v).toEqual([expect.objectContaining({ id: a.id, kind: 'UPI', upiMasked: 'pr•••@oksbi', payeeName: 'Priya Stores' })]);
    expect(JSON.stringify(v)).not.toContain('priya.shop');
    expect(STAFF.type).toBe('STAFF');
  });
  it('bank details are stored sealed, are write-only and never shown to customers unless showToCustomers is set', async () => {
    const b = await w.vendor.createMethod('va', { kind: 'BANK_TRANSFER', label: 'Bank', details: 'HDFC 5010 0000 1234 IFSC HDFC0000001' } as never, OWNER);
    expect(b).toMatchObject({ kind: 'BANK_TRANSFER', showToCustomers: false, hasGatewayDetails: true });
    expect(JSON.stringify([...w.store.methods.values()])).not.toContain('HDFC 5010');
    expect(JSON.stringify(b)).not.toContain('HDFC 5010');
    const u = await w.vendor.updateMethod('va', b.id, { showToCustomers: true }, OWNER);
    expect(u.showToCustomers).toBe(true);
  });
});
