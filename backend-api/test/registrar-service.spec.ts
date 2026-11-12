import { PurchaseBy } from '../src/v3-registrar/registrar.service';
import { registrarWorld, RegistrarWorld, STAFF, V1, V2 } from './support/registrar-world';

/**
 * Slice 5.6d through the service: quote, purchase, release on failure, unsure answers, renewal before expiry only, recovery, reconciliation, expiry alerts, the price book, Pro only, tenant separation.
 * The wallet is the real ledger code over its in-memory twin; the registrar is a fake. Prices: com costs 70,000 paise, the margin is 20 percent (14,000), GST 18 percent: total 99,120 exactly.
 */
let w: RegistrarWorld;
const by: PurchaseBy = { type: 'VENDOR', actor: V1 };
const TOTAL = 99_120;
const buy = (over: Partial<{ domain: string; years: number; privacy: boolean; idempotencyKey: string; expectedTotalPaise: number; consent: boolean }> = {}, vendor = 'v1', b = by) =>
  w.reg.purchase(vendor, { domain: 'sriganesh.com', years: 1, privacy: false, idempotencyKey: w.key(), expectedTotalPaise: TOTAL, consent: true, ...over }, b);
const wallet = (v = 'v1') => w.store.wallets.get(v)!;
const ledger = (v = 'v1') => w.store.ledger.filter((e) => e.vendorId === v);

beforeEach(async () => {
  w = registrarWorld();
  await w.price('com', 'PERCENT_BP', 2000); await w.price('in', 'FIXED_PAISE', 10_000);
  await w.vendor('v1', 600_000); await w.vendor('v2', 600_000);
});

describe('the price: cost plus approved margin, then GST on its own line', () => {
  it('works out the exact total and shows GST as separate CGST and SGST lines for a buyer in the seller\'s state', async () => {
    const q = await w.reg.quote('v1', { domain: 'sriganesh.com', years: 1 });
    expect(q).toMatchObject({ costPaise: 70_000, marginPaise: 14_000, privacyPaise: 0, taxablePaise: 84_000, taxPaise: 15_120, totalPaise: TOTAL });
    expect(q.lines).toEqual([{ name: 'CGST', ratePercent: 9, amountPaise: 7_560 }, { name: 'SGST', ratePercent: 9, amountPaise: 7_560 }]);
  });
  it('a buyer in another state pays one IGST line; a fixed margin is added per year; several years multiply the cost', async () => {
    await w.store.unit('v1', (tx) => tx.setBillingProfile({ stateCode: '27', gstin: null }));
    const q = await w.reg.quote('v1', { domain: 'shop.in', years: 3 });
    expect(q).toMatchObject({ costPaise: 180_000, marginPaise: 30_000, taxablePaise: 210_000, taxPaise: 37_800, totalPaise: 247_800 });
    expect(q.lines).toEqual([{ name: 'IGST', ratePercent: 18, amountPaise: 37_800 }]);
  });
  it('privacy protection has its own approved price; without one the quote is refused, with one it is added before GST', async () => {
    await expect(w.reg.quote('v1', { domain: 'sriganesh.com', years: 1, privacy: true })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_NOT_SET' } });
    await w.price('privacy', 'FIXED_PAISE', 20_000);
    expect(await w.reg.quote('v1', { domain: 'sriganesh.com', years: 1, privacy: true })).toMatchObject({ privacyPaise: 20_000, taxablePaise: 104_000, totalPaise: 122_720 });
  });
  it('an extension with no approved margin, a proposal, or a margin that starts later cannot be priced', async () => {
    await expect(w.reg.quote('v1', { domain: 'shop.org', years: 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_UNAVAILABLE' } });   // the registrar does not list it
    w.port.costTable.org = { registerPaise: 50_000, renewPaise: 50_000 };
    await expect(w.reg.quote('v1', { domain: 'shop.org', years: 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_NOT_SET' } });
    await w.reg.proposeMargin({ tld: 'org', kind: 'FIXED_PAISE', value: 1 }, STAFF);   // only a proposal
    await expect(w.reg.quote('v1', { domain: 'shop.org', years: 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_NOT_SET' } });
    const m = await w.reg.proposeMargin({ tld: 'org', kind: 'FIXED_PAISE', value: 5_000 }, STAFF);
    await w.reg.approveMargin(m.id, new Date(w.now.t.getTime() + 86_400_000).toISOString(), STAFF);   // starts tomorrow
    await expect(w.reg.quote('v1', { domain: 'shop.org', years: 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_NOT_SET' } });
  });
  it('tax that cannot be worked out refuses the quote instead of guessing', async () => {
    await w.store.unit('v1', (tx) => tx.setBillingProfile({ stateCode: null, gstin: null }));
    await expect(w.reg.quote('v1', { domain: 'sriganesh.com', years: 1 })).rejects.toMatchObject({ response: { code: 'TAX_NOT_CONFIGURED' } });
  });
  it('refuses a name that cannot be registered and a number of years that makes no sense', async () => {
    await expect(w.reg.quote('v1', { domain: 'www.shop.com', years: 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_INVALID' } });
    for (const years of [0, 11, 1.5, -1]) await expect(w.reg.quote('v1', { domain: 'sriganesh.com', years })).rejects.toMatchObject({ response: { code: 'DOMAIN_INVALID' } });
  });
});

describe('Pro only (owner answer Q2)', () => {
  it('a Free vendor sees a locked preview and nothing is asked of the registrar', async () => {
    w.plan.level = 'FREE';
    expect(await w.reg.overview('v1')).toMatchObject({ state: 'LOCKED_PREVIEW', upsellText: 'Pro only', extensions: [] });
    for (const f of [() => w.reg.search('v1', 'sriganesh'), () => w.reg.quote('v1', { domain: 'sriganesh.com', years: 1 }), () => buy()]) await expect(f()).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    expect(w.port.calls).toEqual([]); expect(w.rstore.orders).toHaveLength(0);
  });
  it('a vendor in the grace period or a suspended vendor cannot buy either; an active Pro vendor can', async () => {
    w.plan.status = 'GRACE'; await expect(buy()).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    w.plan.status = 'ACTIVE'; w.plan.suspended = true; await expect(buy()).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    w.plan.suspended = false; expect((await buy()).status).toBe('COMPLETED');
  });
  it('the overview of a Pro vendor lists the extensions that have an approved price', async () => {
    expect(await w.reg.overview('v1')).toMatchObject({ state: 'ACTIVE', identity: 'APPROVED', purchasesReady: true, extensions: expect.arrayContaining(['com', 'in']) });
  });
});

describe('a purchase: hold, registrar, charge', () => {
  it('holds and charges exactly the total, records the domain, issues the invoice and brings the name into the vendor\'s domains', async () => {
    const o = await buy();
    expect(o).toMatchObject({ status: 'COMPLETED', amountPaise: TOTAL, replay: false });
    expect(wallet()).toMatchObject({ balancePaise: 600_000 - TOTAL, heldPaise: 0 });
    expect(ledger().filter((e) => e.refType === 'domain_order').map((e) => [e.kind, Math.abs(e.amountPaise)])).toEqual([['HOLD', TOTAL], ['CHARGE', TOTAL]]);   // exact, no rounding
    expect(w.port.calls.filter((c) => c.startsWith('register'))).toEqual(['register:sriganesh.com']);
    const inv = await w.reg.orderForVendor('v1', o.id);
    expect(inv.invoice).toMatchObject({ number: expect.stringMatching(/^DINV\/\d{4}-\d{2}\/000001$/), totalPaise: TOTAL, taxPaise: 15_120, taxablePaise: 84_000 });
    expect(inv.invoice!.lines).toHaveLength(2);
    expect(w.rstore.registeredRows[0]).toMatchObject({ domain: 'sriganesh.com', vendorId: 'v1', rcOrderId: '9001', privacy: false, nameServers: ['ns1.example.com', 'ns2.example.com'] });
    expect(w.rstore.vendorDomains).toEqual([expect.objectContaining({ vendorId: 'v1', hostname: 'sriganesh.com' })]);
    expect(w.rEvents().map((e) => e.type)).toEqual(expect.arrayContaining(['domain.registered']));
  });
  it('the vendor becomes a registrar customer once: a second purchase reuses the customer and contact', async () => {
    await buy(); await buy({ domain: 'second.com' });
    expect(w.port.customers).toBe(1); expect(w.port.contacts).toBe(1);
  });
  it('the invoice numbers run without gaps, one per completed order', async () => {
    const a = await buy(); const b = await buy({ domain: 'second.com' });
    const n = async (id: string) => Number(((await w.reg.orderForVendor('v1', id)).invoice!.number).split('/')[2]);
    expect([await n(a.id), await n(b.id)]).toEqual([1, 2]);
  });
  it('a vendor must confirm the details are theirs; staff acting for a vendor must give a reason', async () => {
    await expect(buy({ consent: false })).rejects.toMatchObject({ response: { code: 'DOMAIN_CONSENT_REQUIRED' } });
    await expect(buy({}, 'v1', { type: 'STAFF', actor: STAFF })).rejects.toMatchObject({ response: { code: 'DOMAIN_INVALID' } });
    const o = await buy({ consent: undefined }, 'v1', { type: 'STAFF', actor: STAFF, reason: 'vendor asked by phone' });
    expect(o.status).toBe('COMPLETED'); expect(w.rstore.orders[0]).toMatchObject({ requestedByType: 'STAFF', requestedById: 'staff-1', reason: 'vendor asked by phone' }); expect(wallet().balancePaise).toBe(600_000 - TOTAL);   // still the vendor's own wallet
  });
  it('refuses until the identity check is approved, and until staff have set the name servers and the reserve', async () => {
    await w.rstore.patchRegistrant('v1', null, { status: 'IN_REVIEW' });
    await expect(buy()).rejects.toMatchObject({ response: { code: 'IDENTITY_NOT_APPROVED' } });
    await w.rstore.patchRegistrant('v1', null, { status: 'APPROVED' });
    w.rsettings.v = { ...w.rsettings.v, registrarNameServers: undefined } as never; w.rsettings.v.registrarNameServers = null;
    await expect(buy()).rejects.toMatchObject({ response: { code: 'REGISTRAR_NOT_CONFIGURED' } });
    expect(w.rstore.orders).toHaveLength(0); expect(wallet().heldPaise).toBe(0);
  });
  it('a stale price is refused with the new total and nothing is held', async () => {
    await expect(buy({ expectedTotalPaise: TOTAL - 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_CHANGED', totalPaise: TOTAL } });
    expect(wallet().heldPaise).toBe(0); expect(w.rstore.orders).toHaveLength(0);
  });
  it('a name the registrar says is taken is refused before anything is held', async () => {
    w.port.taken.add('sriganesh.com');
    await expect(buy()).rejects.toMatchObject({ response: { code: 'DOMAIN_NOT_AVAILABLE' } });
    expect(w.rstore.orders).toHaveLength(0); expect(wallet().heldPaise).toBe(0);
  });
  it('not enough in the wallet: the shortfall is reported and nothing is held, bought or recorded', async () => {
    await w.vendor('v3', 20_000);
    await expect(buy({}, 'v3', { type: 'VENDOR', actor: { ...V1, id: 'u3' } })).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_WALLET', shortfallPaise: TOTAL - 20_000 } });
    expect(w.rstore.orders.filter((o) => o.vendorId === 'v3')).toHaveLength(0); expect(w.port.calls.some((c) => c.startsWith('register'))).toBe(false); expect(wallet('v3').heldPaise).toBe(0);
  });
  it('a wallet that is not open yet says so', async () => {
    w.store.wallets.delete('v2'); w.store.evidence.delete('v2');
    await expect(buy({}, 'v2', { type: 'VENDOR', actor: V2 })).rejects.toMatchObject({ response: { code: 'WALLET_NOT_ACTIVE' } });
  });
  it('a reseller balance below the minimum blocks the purchase, tells staff, and holds nothing', async () => {
    w.port.balanceValue = 150_000;   // after the cost of 70,000 only 80,000 is left, below the minimum of 100,000
    await expect(buy()).rejects.toMatchObject({ response: { code: 'REGISTRAR_BALANCE_LOW' } });
    expect(w.rstore.orders).toHaveLength(0); expect(wallet().heldPaise).toBe(0);
    expect(w.rEvents().some((e) => e.type === 'domain.registrar_balance_low')).toBe(true);
  });
});

describe('double purchase buys once', () => {
  it('the same key twice, one after the other, buys and charges once and the second answer says it is a replay', async () => {
    const key = w.key(); const a = await buy({ idempotencyKey: key }); const b = await buy({ idempotencyKey: key });
    expect(b).toMatchObject({ id: a.id, replay: true, status: 'COMPLETED' });
    expect(w.port.calls.filter((c) => c.startsWith('register'))).toHaveLength(1); expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(1); expect(wallet().balancePaise).toBe(600_000 - TOTAL);
  });
  it('the same key submitted at the same moment still buys once', async () => {
    const key = w.key(); const rs = await Promise.all([buy({ idempotencyKey: key }), buy({ idempotencyKey: key }), buy({ idempotencyKey: key })]);
    expect(new Set(rs.map((r) => r.id)).size).toBe(1);
    expect(w.port.calls.filter((c) => c.startsWith('register'))).toHaveLength(1); expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(1); expect(ledger().filter((e) => e.kind === 'HOLD')).toHaveLength(1);
  });
  it('the same key for a different domain is a conflict, not a second purchase', async () => {
    const key = w.key(); await buy({ idempotencyKey: key });
    await expect(buy({ idempotencyKey: key, domain: 'other.com' })).rejects.toMatchObject({ response: { code: 'WALLET_IDEMPOTENCY_CONFLICT' } });
    expect(w.port.calls.filter((c) => c.startsWith('register'))).toHaveLength(1);
  });
  it('two vendors racing for the same name: one wins, the other is told it is not available and is never charged', async () => {
    const rs = await Promise.allSettled([buy({}, 'v1'), buy({}, 'v2', { type: 'VENDOR', actor: V2 })]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1); expect((rs.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.response.code).toBe('DOMAIN_NOT_AVAILABLE');
    const loser = rs[0].status === 'rejected' ? 'v1' : 'v2'; expect(wallet(loser)).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
  });
  it('a name already bought cannot be bought again with a new key', async () => {
    await buy(); await expect(buy()).rejects.toMatchObject({ response: { code: 'DOMAIN_NOT_AVAILABLE' } });
    expect(w.port.calls.filter((c) => c.startsWith('register'))).toHaveLength(1);
  });
});

describe('registrar failure releases the hold automatically', () => {
  it('a refusal gives the hold back (a release, not a refund), fails the order and frees the name for a new try', async () => {
    w.port.registerMode = 'refuse';
    const o = await buy();
    expect(o).toMatchObject({ status: 'FAILED', failureCode: 'DOMAIN_NOT_AVAILABLE' });
    expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
    expect(ledger().filter((e) => e.refType === 'domain_order').map((e) => e.kind)).toEqual(['HOLD', 'RELEASE']); expect(ledger().some((e) => e.kind === 'CHARGE')).toBe(false);
    expect(w.rstore.orders[0].openKey).toBeNull(); expect(w.rstore.invoices).toHaveLength(0); expect(w.rstore.registeredRows).toHaveLength(0);
    w.port.registerMode = 'ok'; w.port.taken.clear();
    expect((await buy()).status).toBe('COMPLETED');
  });
  it('a failure creating the registrar customer also gives the hold back and buys nothing', async () => {
    w.port.customerFails = true;
    expect((await buy()).status).toBe('FAILED'); expect(wallet().heldPaise).toBe(0); expect(w.port.calls.some((c) => c.startsWith('register'))).toBe(false);
  });
  it('the wallet reconciles after any mix of outcomes: balance equals the sum of the ledger and nothing stays held', async () => {
    await buy({ domain: 'one.com' }); w.port.registerMode = 'refuse'; await buy({ domain: 'two.com' }); w.port.registerMode = 'ok'; await buy({ domain: 'three.in', expectedTotalPaise: 82_600 });
    const sum = ledger().reduce((s, e) => s + e.balanceDeltaPaise, 0);
    expect(wallet().balancePaise).toBe(sum); expect(wallet().heldPaise).toBe(ledger().reduce((s, e) => s + e.heldDeltaPaise, 0)); expect(wallet().heldPaise).toBe(0);
    expect(ledger().filter((e) => e.kind === 'CHARGE').reduce((s, e) => s + Math.abs(e.amountPaise), 0)).toBe(w.rstore.invoices.reduce((s, i) => s + i.totalPaise, 0));   // every charge has exactly one invoice of the same amount
  });
  it('a failure inside the settling unit rolls the charge, the invoice and the domain back together and leaves the order for recovery', async () => {
    w.store.failCommitOnce = false;
    const orig = w.rstore.unit.bind(w.rstore); let calls = 0;
    w.rstore.unit = (async (v: string, fn: Parameters<typeof orig>[1]) => orig(v, async (t, wt) => { calls++; const r = await fn(t, wt); if (calls === 3) throw new Error('boom'); return r; })) as never;   // the third unit is the settling one
    await expect(buy()).rejects.toThrow('boom');
    w.rstore.unit = orig;
    expect(ledger().some((e) => e.kind === 'CHARGE')).toBe(false); expect(w.rstore.invoices).toHaveLength(0); expect(w.rstore.registeredRows).toHaveLength(0); expect(w.rstore.orders[0].status).toBe('SUBMITTED'); expect(wallet().heldPaise).toBe(TOTAL);
    const r = await w.reg.recover(0); expect(r.settled).toBe(1);   // the registrar has the domain: recovery charges the hold exactly once
    expect(w.rstore.orders[0].status).toBe('COMPLETED'); expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(1); expect(wallet()).toMatchObject({ balancePaise: 600_000 - TOTAL, heldPaise: 0 });
  });
});

describe('an unsure answer from the registrar', () => {
  it('a timeout keeps the hold, charges nothing and leaves the order UNKNOWN; the vendor sees it is waiting for confirmation', async () => {
    w.port.registerMode = 'timeout';
    const o = await buy();
    expect(o).toMatchObject({ status: 'UNKNOWN', pendingConfirmation: true, settled: false });
    expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: TOTAL }); expect(ledger().some((e) => e.kind === 'CHARGE' || e.kind === 'RELEASE')).toBe(false);
  });
  it('recovery finds the domain at the registrar and charges once; running it again changes nothing', async () => {
    w.port.registerMode = 'timeout-but-done'; await buy();
    expect((await w.reg.recover(0)).settled).toBe(1); expect((await w.reg.recover(0)).settled).toBe(0);
    expect(w.rstore.orders[0].status).toBe('COMPLETED'); expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(1); expect(wallet().heldPaise).toBe(0); expect(w.rstore.registeredRows).toHaveLength(1);
  });
  it('recovery finds nothing at the registrar and gives the hold back', async () => {
    w.port.registerMode = 'timeout'; await buy();
    expect((await w.reg.recover(0)).released).toBe(1);
    expect(w.rstore.orders[0]).toMatchObject({ status: 'FAILED', failureCode: 'NOT_FOUND_AT_REGISTRAR' }); expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
  });
  it('when the registrar cannot be asked, the order is left alone and the hold stays', async () => {
    w.port.registerMode = 'timeout'; await buy(); w.port.lookupFails = true;
    expect(await w.reg.recover(0)).toEqual({ settled: 0, released: 0, left: 1 }); expect(w.rstore.orders[0].status).toBe('UNKNOWN'); expect(wallet().heldPaise).toBe(TOTAL);
  });
  it('an error nobody expected is treated as unsure, never as a refusal: the hold stays', async () => {
    w.port.register = async () => { throw new Error('something unexpected'); };
    const o = await buy();
    expect(o).toMatchObject({ status: 'UNKNOWN', failureCode: 'REGISTRAR_ERROR' }); expect(wallet().heldPaise).toBe(TOTAL); expect(ledger().some((e) => e.kind === 'RELEASE')).toBe(false);
  });
  it('recovery leaves a recent order alone and releases a held order that never reached the registrar', async () => {
    w.port.registerMode = 'timeout'; await buy();
    w.rstore.orders[0].status = 'HELD';   // a crash before the registrar was ever called
    expect(await w.reg.recover(60)).toEqual({ settled: 0, released: 0, left: 0 });   // too recent: not even looked at
    w.advance(61 * 60_000); expect((await w.reg.recover(60)).released).toBe(1);
    expect(w.port.calls.filter((c) => c.startsWith('orderInfo'))).toHaveLength(0);   // nothing was sent, so there is nothing to ask
    expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
  });
});

describe('renewal is before expiry only', () => {
  const RENEW_TOTAL = 106_200;   // 75,000 renewal cost + 20 percent margin = 90,000, plus 18 percent GST
  const regId = async (): Promise<string> => { await buy(); return w.rstore.registeredRows[0].id; };
  const renew = (id: string, over: Partial<{ years: number; idempotencyKey: string; expectedTotalPaise: number }> = {}, vendor = 'v1') => w.reg.renew(vendor, id, { years: 1, idempotencyKey: w.key(), expectedTotalPaise: RENEW_TOTAL, ...over }, by);
  it('renews at the renewal cost (not the registration cost), extends the expiry, resets the alerts and issues its own invoice', async () => {
    const id = await regId(); w.rstore.registeredRows[0].alertsSent = [60]; const before = w.rstore.registeredRows[0].expiresAt!;
    const o = await renew(id);
    expect(o).toMatchObject({ status: 'COMPLETED', amountPaise: RENEW_TOTAL, kind: 'RENEW' });
    const r = w.rstore.registeredRows[0]; expect(r.expiresAt!.getTime()).toBe(before.getTime() + 365 * 86_400_000); expect(r.alertsSent).toEqual([]); expect(r.lastRenewedAt).not.toBeNull();
    expect(wallet().balancePaise).toBe(600_000 - TOTAL - RENEW_TOTAL); expect(w.rstore.invoices).toHaveLength(2);
    expect(ledger().filter((e) => e.kind === 'CHARGE').map((e) => Math.abs(e.amountPaise))).toEqual([TOTAL, RENEW_TOTAL]);
  });
  it('a wrong price confirmation is refused; the same key renews once', async () => {
    const id = await regId(); await expect(renew(id, { expectedTotalPaise: TOTAL })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_CHANGED', totalPaise: RENEW_TOTAL } });
    const key = w.key(); const a = await renew(id, { idempotencyKey: key }); const b = await renew(id, { idempotencyKey: key });
    expect(b).toMatchObject({ id: a.id, replay: true }); expect(w.port.calls.filter((c) => c.startsWith('renew'))).toHaveLength(1);
  });
  it('is refused for an expired domain, at the moment of expiry and after it, and nothing is held or called', async () => {
    const id = await regId(); const exp = w.rstore.registeredRows[0].expiresAt!;
    w.now.t = new Date(exp.getTime()); await expect(renew(id)).rejects.toMatchObject({ response: { code: 'DOMAIN_EXPIRED' } });
    w.now.t = new Date(exp.getTime() + 86_400_000); await expect(renew(id)).rejects.toMatchObject({ response: { code: 'DOMAIN_EXPIRED' } });
    expect(w.rstore.orders.filter((o) => o.kind === 'RENEW')).toHaveLength(0); expect(w.port.calls.some((c) => c.startsWith('renew'))).toBe(false); expect(wallet().heldPaise).toBe(0);
  });
  it('a domain already marked EXPIRED is not renewable even if its date was wrongly moved', async () => {
    const id = await regId(); w.rstore.registeredRows[0].status = 'EXPIRED';
    await expect(renew(id)).rejects.toMatchObject({ response: { code: 'DOMAIN_EXPIRED' } });
  });
  it('a registrar refusal gives the hold back and leaves the expiry as it was', async () => {
    const id = await regId(); const before = w.rstore.registeredRows[0].expiresAt!.getTime(); w.port.renewMode = 'refuse';
    expect((await renew(id)).status).toBe('FAILED'); expect(wallet().heldPaise).toBe(0); expect(w.rstore.registeredRows[0].expiresAt!.getTime()).toBe(before);
  });
  it('an unsure answer is settled by comparing the expiry at the registrar: renewed means charge, not renewed means release', async () => {
    const id = await regId(); w.port.renewMode = 'timeout-but-done'; const o = await renew(id);
    expect(o.status).toBe('UNKNOWN'); expect((await w.reg.recover(0)).settled).toBe(1); expect(w.rstore.orders.find((x) => x.kind === 'RENEW')!.status).toBe('COMPLETED');
    expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(2);
    w.port.renewMode = 'timeout'; const o2 = await renew(id); expect(o2.status).toBe('UNKNOWN');
    expect((await w.reg.recover(0)).released).toBe(1); expect(wallet().heldPaise).toBe(0);
  });
  it('another vendor cannot renew it, and the answer is the same as for a domain that does not exist', async () => {
    const id = await regId();
    await expect(renew(id, {}, 'v2')).rejects.toMatchObject({ response: { code: 'DOMAIN_NOT_FOUND' } });
    await expect(renew('no-such-id')).rejects.toMatchObject({ response: { code: 'DOMAIN_NOT_FOUND' } });
  });
});

describe('another vendor never reaches this one (cross-tenant)', () => {
  it('orders, invoices and registered domains are private; the same key used by another vendor is a different order', async () => {
    const key = w.key(); const mine = await buy({ idempotencyKey: key });
    await expect(w.reg.orderForVendor('v2', mine.id)).rejects.toMatchObject({ response: { code: 'DOMAIN_ORDER_NOT_FOUND' } });
    await expect(w.reg.orderForVendor('v2', 'no-such-order')).rejects.toMatchObject({ response: { code: 'DOMAIN_ORDER_NOT_FOUND' } });
    expect(await w.reg.registeredForVendor('v2')).toEqual([]); expect((await w.reg.ordersForVendor('v2', 1, 25)).total).toBe(0);
    const theirs = await buy({ idempotencyKey: key, domain: 'theirs.com' }, 'v2', { type: 'VENDOR', actor: V2 });
    expect(theirs.id).not.toBe(mine.id); expect(theirs.replay).toBe(false);
    expect(wallet('v1').balancePaise).toBe(600_000 - TOTAL); expect(wallet('v2').balancePaise).toBe(600_000 - TOTAL);
  });
  it('a vendor with no approved identity of their own cannot use another vendor\'s approval', async () => {
    await w.vendor('v3', 600_000); await w.rstore.patchRegistrant('v3', null, { status: 'INCOMPLETE' });
    await expect(buy({}, 'v3', { type: 'VENDOR', actor: { ...V1, id: 'u3' } })).rejects.toMatchObject({ response: { code: 'IDENTITY_NOT_APPROVED' } });
  });
});

describe('several purchases at once, with a small simulated connection pool', () => {
  it('five vendors-worth of purchases for different names all finish, never deadlock, and the wallet adds up', async () => {
    w.store.poolSize = 2;
    const names = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
    await w.store.unit('v1', async () => undefined);
    await w.fund('v1', 900_000);
    const rs = await Promise.all(names.map((n) => buy({ domain: n })));
    expect(rs.every((r) => r.status === 'COMPLETED')).toBe(true);
    expect(wallet().balancePaise).toBe(1_500_000 - 5 * TOTAL - 0); expect(wallet().heldPaise).toBe(0); expect(w.store.maxConnectionsInUse).toBeLessThanOrEqual(2);
    expect(new Set(w.rstore.invoices.map((i) => i.number)).size).toBe(5);
  });
});

describe('expiry alerts', () => {
  const setup = async () => { await buy(); w.rsettings.v = { ...w.rsettings.v, domainExpiryAlertDays: [60, 30, 7] }; return w.rstore.registeredRows[0]; };
  it('tells the vendor at each threshold once, the nearest first, and never twice', async () => {
    const r = await setup();
    w.now.t = new Date(r.expiresAt!.getTime() - 40 * 86_400_000); expect(await w.reg.expiryTick()).toEqual({ alerted: 1, expired: 0 }); expect(r.alertsSent).toEqual([60]);
    expect(await w.reg.expiryTick()).toEqual({ alerted: 0, expired: 0 });
    w.now.t = new Date(r.expiresAt!.getTime() - 5 * 86_400_000); expect((await w.reg.expiryTick()).alerted).toBe(1); expect(r.alertsSent.sort((a, b) => a - b)).toEqual([7, 30, 60]);
    expect(w.rEvents().filter((e) => e.type === 'domain.expiry_alert').map((e) => e.data!.thresholdDays)).toEqual([60, 7]);
  });
  it('does nothing while the setting is off, and a vendor of another tenant gets only their own', async () => {
    await buy(); await buy({ domain: 'theirs.com' }, 'v2', { type: 'VENDOR', actor: V2 });
    w.now.t = new Date(w.rstore.registeredRows[0].expiresAt!.getTime() - 5 * 86_400_000);
    expect((await w.reg.expiryTick()).alerted).toBe(0);
    w.rsettings.v = { ...w.rsettings.v, domainExpiryAlertDays: [7] }; await w.reg.expiryTick();
    expect(w.rEvents().filter((e) => e.type === 'domain.expiry_alert').map((e) => e.vendorId).sort()).toEqual(['v1', 'v2']);
  });
  it('a domain past its end is marked EXPIRED with an event; the vendor\'s own site address is not touched', async () => {
    const r = await setup(); w.now.t = new Date(r.expiresAt!.getTime() + 1000);
    expect(await w.reg.expiryTick()).toEqual({ alerted: 0, expired: 1 }); expect(r.status).toBe('EXPIRED'); expect(w.rEvents().some((e) => e.type === 'domain.expired')).toBe(true);
  });
});

describe('reconciliation against the registrar', () => {
  it('records a run, corrects an expiry that differs, and reports a domain the registrar does not have', async () => {
    await buy(); await buy({ domain: 'gone.com' });
    w.port.registered.get('sriganesh.com')!.expiresAt = new Date('2031-01-01T00:00:00Z'); w.port.registered.delete('gone.com');
    const r = await w.reg.reconcile();
    expect(r).toMatchObject({ checked: 2, mismatches: 2, settled: 1 });
    expect(w.rstore.registeredRows.find((x) => x.domain === 'sriganesh.com')!.expiresAt).toEqual(new Date('2031-01-01T00:00:00Z'));
    const run = (await w.reg.runs())[0]; expect(run.status).toBe('DONE'); expect((run.mismatches as Array<{ kind: string }>).map((m) => m.kind).sort()).toEqual(['EXPIRY_DIFFERS', 'MISSING_AT_REGISTRAR']);
    expect(w.rEvents().filter((e) => e.type === 'domain.reconcile_mismatch')).toHaveLength(2);
  });
  it('settles unfinished orders on the way and flags a reserve below the minimum', async () => {
    w.port.registerMode = 'timeout-but-done'; await buy(); w.port.balanceValue = 50_000;
    const r = await w.reg.reconcile(); expect(r.settled).toBeGreaterThanOrEqual(1);
    expect(w.rstore.orders[0].status).toBe('COMPLETED'); expect((await w.reg.runs())[0].mismatches).toEqual(expect.arrayContaining([{ kind: 'RESERVE_BELOW_MINIMUM' }])); expect((await w.reg.runs())[0].balancePaise).toBe(50_000);
  });
  it('a run that fails is recorded as FAILED, never lost', async () => {
    await buy(); const orig = w.port.balance.bind(w.port); void orig;
    w.rstore.activeRegistered = async () => { throw new Error('db down'); };
    await expect(w.reg.reconcile()).rejects.toThrow('db down'); expect((await w.reg.runs())[0]).toMatchObject({ status: 'FAILED', note: 'Error' });
  });
});

describe('the price book (staff)', () => {
  it('a proposal needs a valid extension, kind and value; privacy is a fixed price', async () => {
    for (const bad of [{ tld: 'bad tld', kind: 'FIXED_PAISE', value: 1 }, { tld: 'com', kind: 'MAGIC', value: 1 }, { tld: 'com', kind: 'FIXED_PAISE', value: -1 }, { tld: 'com', kind: 'FIXED_PAISE', value: 1.5 }, { tld: 'com', kind: 'PERCENT_BP', value: 100_001 }, { tld: 'privacy', kind: 'PERCENT_BP', value: 10 }])
      await expect(w.reg.proposeMargin(bad as never, STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_INVALID' } });
  });
  it('approving needs a date, works once, and the same extension cannot start twice on one date', async () => {
    const a = await w.reg.proposeMargin({ tld: 'net', kind: 'FIXED_PAISE', value: 1 }, STAFF); const b = await w.reg.proposeMargin({ tld: 'net', kind: 'FIXED_PAISE', value: 2 }, STAFF);
    await expect(w.reg.approveMargin(a.id, 'not a date', STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_INVALID' } });
    const at = '2026-12-01T00:00:00.000Z'; await w.reg.approveMargin(a.id, at, STAFF);
    await expect(w.reg.approveMargin(a.id, at, STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_STATE_INVALID' } });
    await expect(w.reg.approveMargin(b.id, at, STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_STATE_INVALID' } });
    await expect(w.reg.approveMargin('nope', at, STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_NOT_FOUND' } });
    expect((await w.reg.rejectMargin(b.id)).status).toBe('REJECTED'); await expect(w.reg.rejectMargin(b.id)).rejects.toMatchObject({ response: { code: 'MARGIN_STATE_INVALID' } });
  });
});

describe('search', () => {
  it('lists only extensions with an approved price, marks taken names, and prices the free ones', async () => {
    w.port.taken.add('sriganesh.in');
    const r = await w.reg.search('v1', 'sriganesh');
    expect(r.results.map((x) => [x.domain, x.status, x.price?.totalPaise ?? null]).sort()).toEqual([['sriganesh.com', 'AVAILABLE', TOTAL], ['sriganesh.in', 'TAKEN', null]]);
    expect((await w.reg.search('v1', 'sriganesh.com')).name).toBe('sriganesh');
    await expect(w.reg.search('v1', 'bad name!')).rejects.toMatchObject({ response: { code: 'DOMAIN_INVALID' } });
  });
});
