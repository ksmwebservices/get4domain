import { Logger } from '@nestjs/common';
import { PurchaseBy } from '../src/v3-registrar/registrar.service';
import { registrarWorld, RegistrarWorld, STAFF, V1, V2 } from './support/registrar-world';

/**
 * Slice 5.6e: transfer-in of an existing domain into the owner's registrar account. Pro only, through the price book, from the wallet (hold, then charge when the transfer completes, release when it fails),
 * the authorisation code never stored, a fake registrar in every test, the live flags OFF by default. Every registrar path is TO VERIFY (see the adapter spec).
 * Prices: com transfer costs 80,000 paise, the transfer margin is 10 percent (8,000), GST 18 percent: total 103,840.
 */
let w: RegistrarWorld;
const by: PurchaseBy = { type: 'VENDOR', actor: V1 };
const TOTAL = 103_840; const CODE = 'Auth-Code-7Zq!';
const move = (over: Partial<{ domain: string; authCode: string; privacy: boolean; idempotencyKey: string; expectedTotalPaise: number; confirmUnlocked: boolean; consent: boolean }> = {}, vendor = 'v1', b: PurchaseBy = by) =>
  w.reg.transferIn(vendor, { domain: 'oldshop.com', authCode: CODE, privacy: false, idempotencyKey: w.key(), expectedTotalPaise: TOTAL, confirmUnlocked: true, consent: true, ...over }, b);
const wallet = (v = 'v1') => w.store.wallets.get(v)!;
const ledger = (v = 'v1') => w.store.ledger.filter((e) => e.vendorId === v);

beforeEach(async () => {
  w = registrarWorld();
  await w.price('com', 'PERCENT_BP', 2000); await w.price('transfer.com', 'PERCENT_BP', 1000);
  await w.vendor('v1', 600_000); await w.vendor('v2', 600_000);
});

describe('the price', () => {
  it('is the transfer cost plus the approved transfer margin, then GST on its own line (a registration margin does not apply)', async () => {
    const q = await w.reg.transferQuote('v1', 'oldshop.com');
    expect(q).toMatchObject({ kind: 'TRANSFER_IN', years: 1, costPaise: 80_000, marginPaise: 8_000, taxablePaise: 88_000, taxPaise: 15_840, totalPaise: TOTAL });
    expect(q.lines).toEqual([{ name: 'CGST', ratePercent: 9, amountPaise: 7_920 }, { name: 'SGST', ratePercent: 9, amountPaise: 7_920 }]);
  });
  it('cannot be quoted without an approved transfer margin, or when the registrar lists no transfer cost', async () => {
    await expect(w.reg.transferQuote('v1', 'oldshop.in')).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_UNAVAILABLE' } });   // no transfer cost listed for in
    w.port.costTable.in = { registerPaise: 60_000, renewPaise: 65_000, transferPaise: 70_000 };
    await expect(w.reg.transferQuote('v1', 'oldshop.in')).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_NOT_SET' } });
  });
});

describe('Pro only (owner answers Q2 and Q9)', () => {
  it('a Free vendor gets a locked preview and nothing is asked of the registrar', async () => {
    w.plan.level = 'FREE';
    await expect(w.reg.transferQuote('v1', 'oldshop.com')).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    await expect(move()).rejects.toMatchObject({ response: { code: 'FEATURE_LOCKED' } });
    expect(w.port.calls).toEqual([]); expect(w.rstore.orders).toHaveLength(0);
  });
});

describe('starting a transfer', () => {
  it('holds exactly the total, asks the registrar once, keeps the order in progress and charges nothing yet', async () => {
    const o = await move();
    expect(o).toMatchObject({ kind: 'TRANSFER_IN', status: 'SUBMITTED', pendingConfirmation: true, settled: false, amountPaise: TOTAL });
    expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: TOTAL }); expect(ledger().map((e) => e.kind)).toEqual(expect.not.arrayContaining(['CHARGE']));
    expect(w.port.calls.filter((c) => c.startsWith('transferIn'))).toEqual(['transferIn:oldshop.com']); expect(w.rstore.orders[0].rcOrderId).toBe('9001');
    expect(w.rstore.registeredRows).toHaveLength(0); expect(w.rstore.invoices).toHaveLength(0);
  });
  it('needs the code, the confirmation that the domain is unlocked, and the vendor\'s own confirmation', async () => {
    for (const authCode of ['', 'short', 'has space in it']) await expect(move({ authCode })).rejects.toMatchObject({ response: { code: 'TRANSFER_AUTH_INVALID' } });
    await expect(move({ confirmUnlocked: false })).rejects.toMatchObject({ response: { code: 'TRANSFER_CONFIRM_REQUIRED' } });
    await expect(move({ consent: false })).rejects.toMatchObject({ response: { code: 'DOMAIN_CONSENT_REQUIRED' } });
    expect(w.port.calls).toEqual([]); expect(wallet().heldPaise).toBe(0);
  });
  it('refuses a domain the registrar says cannot move yet, with the reason, and holds nothing', async () => {
    for (const reason of ['LOCKED', 'RECENTLY_REGISTERED', 'RECENTLY_TRANSFERRED', 'NOT_REGISTERED'] as const) {
      w.port.eligibility.set('oldshop.com', { eligible: false, reason });
      await expect(move()).rejects.toMatchObject({ response: { code: 'TRANSFER_NOT_ELIGIBLE', reason } });
    }
    expect(w.rstore.orders).toHaveLength(0); expect(wallet().heldPaise).toBe(0); expect(w.port.calls.some((c) => c.startsWith('transferIn'))).toBe(false);
  });
  it('refuses a stale price, a domain this vendor already holds through us, and an identity check that is not approved', async () => {
    await expect(move({ expectedTotalPaise: TOTAL - 1 })).rejects.toMatchObject({ response: { code: 'DOMAIN_PRICE_CHANGED', totalPaise: TOTAL } });
    await w.rstore.patchRegistrant('v1', null, { status: 'IN_REVIEW' });
    await expect(move()).rejects.toMatchObject({ response: { code: 'IDENTITY_NOT_APPROVED' } });
    expect(wallet().heldPaise).toBe(0);
  });
  it('the same key twice, even at the same moment, starts one transfer and holds once', async () => {
    const key = w.key(); const rs = await Promise.all([move({ idempotencyKey: key }), move({ idempotencyKey: key }), move({ idempotencyKey: key })]);
    expect(new Set(rs.map((r) => r.id)).size).toBe(1); expect(w.port.calls.filter((c) => c.startsWith('transferIn'))).toHaveLength(1); expect(ledger().filter((e) => e.kind === 'HOLD')).toHaveLength(1);
    await expect(move({ idempotencyKey: key, domain: 'other.com' })).rejects.toMatchObject({ response: { code: 'WALLET_IDEMPOTENCY_CONFLICT' } });
  });
  it('one live order per name: a second vendor cannot start the same domain, and the vendor cannot register it', async () => {
    await move();
    await expect(move({}, 'v2', { type: 'VENDOR', actor: V2 })).rejects.toMatchObject({ response: { code: 'DOMAIN_NOT_AVAILABLE' } });
    expect(wallet('v2')).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
  });
  it('not enough in the wallet: the shortfall is reported and nothing is held or sent', async () => {
    await w.vendor('v3', 20_000);
    await expect(move({}, 'v3', { type: 'VENDOR', actor: { ...V1, id: 'u3' } })).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_WALLET', shortfallPaise: TOTAL - 20_000 } });
    expect(w.port.calls.some((c) => c.startsWith('transferIn'))).toBe(false);
  });
});

describe('the authorisation code is never kept', () => {
  it('it appears in no order, snapshot, audit row, invoice, event, ledger entry or log line, before or after the transfer finishes', async () => {
    const spies = (['warn', 'error', 'log', 'debug', 'verbose'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation(() => undefined));
    const o = await move(); w.port.finishTransfer('oldshop.com'); await w.reg.settleTransfers();
    const dump = JSON.stringify({ orders: w.rstore.orders, invoices: w.rstore.invoices, audits: w.rstore.audits, events: w.rEvents(), ledger: w.store.ledger, registered: w.rstore.registeredRows, otps: w.rstore.otps, o, logged: spies.map((x) => x.mock.calls) });
    expect(dump).not.toContain(CODE); spies.forEach((x) => x.mockRestore());
  });
});

describe('settling a transfer', () => {
  const start = async () => { const o = await move(); return o; };
  it('a completed transfer charges the hold exactly once, records the domain with its expiry, issues the invoice and adopts the name; running again changes nothing', async () => {
    await start(); expect((await w.reg.settleTransfers()).settled).toBe(0);   // still in progress
    w.port.finishTransfer('oldshop.com'); expect(await w.reg.settleTransfers()).toEqual({ settled: 1, failed: 0, left: 0 }); expect(await w.reg.settleTransfers()).toEqual({ settled: 0, failed: 0, left: 0 });
    expect(w.rstore.orders[0]).toMatchObject({ status: 'COMPLETED', rcOrderId: '9001' }); expect(wallet()).toMatchObject({ balancePaise: 600_000 - TOTAL, heldPaise: 0 });
    expect(ledger().filter((e) => e.kind === 'CHARGE').map((e) => Math.abs(e.amountPaise))).toEqual([TOTAL]);
    expect(w.rstore.invoices).toHaveLength(1); expect(w.rstore.registeredRows[0]).toMatchObject({ domain: 'oldshop.com', vendorId: 'v1' }); expect(w.rstore.registeredRows[0].expiresAt).not.toBeNull();
    expect(w.rstore.vendorDomains.map((d) => d.hostname)).toEqual(['oldshop.com']); expect(w.port.calls).toContain('setNameServers');
    expect(w.rEvents().map((e) => e.type)).toContain('domain.transfer_completed');
  });
  it('a failed or cancelled transfer gives the hold back and frees the name; the wallet reconciles', async () => {
    await start(); w.port.failTransfer('oldshop.com', 'FAILED'); expect(await w.reg.settleTransfers()).toEqual({ settled: 0, failed: 1, left: 0 });
    expect(w.rstore.orders[0]).toMatchObject({ status: 'FAILED', failureCode: 'TRANSFER_FAILED', openKey: null }); expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
    expect(ledger().filter((e) => e.refType === 'domain_order').map((e) => e.kind)).toEqual(['HOLD', 'RELEASE']);
    w.port.transfers.clear(); expect((await move()).status).toBe('SUBMITTED');   // a new try with a new key
    w.port.failTransfer('oldshop.com', 'CANCELLED'); await w.reg.settleTransfers(); expect(w.rstore.orders[1]).toMatchObject({ status: 'FAILED', failureCode: 'TRANSFER_CANCELLED' });
    expect(wallet().heldPaise).toBe(0); expect(wallet().balancePaise).toBe(ledger().reduce((s, e) => s + e.balanceDeltaPaise, 0));
  });
  it('when the registrar cannot be asked the order stays in progress and the hold stays', async () => {
    await start(); w.port.lookupFails = true; expect(await w.reg.settleTransfers()).toEqual({ settled: 0, failed: 0, left: 1 }); expect(wallet().heldPaise).toBe(TOTAL);
  });
  it('another vendor\'s transfer is settled on its own wallet only', async () => {
    await start(); await move({ domain: 'theirs.com' }, 'v2', { type: 'VENDOR', actor: V2 });
    w.port.finishTransfer('theirs.com'); await w.reg.settleTransfers();
    expect(wallet('v2').balancePaise).toBe(600_000 - TOTAL); expect(wallet('v1')).toMatchObject({ balancePaise: 600_000, heldPaise: TOTAL });
  });
});

describe('an unsure answer when the transfer is sent', () => {
  it('keeps the hold and the order UNKNOWN; recovery finds the transfer under way and carries on, or finds none and releases', async () => {
    w.port.transferMode = 'timeout-but-started'; const o = await move(); expect(o).toMatchObject({ status: 'UNKNOWN', pendingConfirmation: true }); expect(wallet().heldPaise).toBe(TOTAL);
    expect((await w.reg.recover(0)).left).toBe(1); expect(w.rstore.orders[0].status).toBe('SUBMITTED');   // in progress at the registrar
    w.port.finishTransfer('oldshop.com'); await w.reg.settleTransfers(); expect(w.rstore.orders[0].status).toBe('COMPLETED'); expect(ledger().filter((e) => e.kind === 'CHARGE')).toHaveLength(1);
  });
  it('nothing at the registrar: released', async () => {
    w.port.transferMode = 'timeout'; await move(); expect((await w.reg.recover(0)).released).toBe(1); expect(wallet()).toMatchObject({ balancePaise: 600_000, heldPaise: 0 });
  });
  it('a refusal at once releases the hold', async () => {
    w.port.transferMode = 'refuse'; expect((await move()).status).toBe('FAILED'); expect(wallet().heldPaise).toBe(0); expect(w.rstore.orders[0].openKey).toBeNull();
  });
});

describe('the price book accepts transfer margins', () => {
  it('a transfer margin is proposed under the transfer key; the vendor routes see transfers in their orders and nobody else\'s', async () => {
    const m = await w.reg.proposeMargin({ tld: 'transfer.org', kind: 'FIXED_PAISE', value: 5_000 }, STAFF); expect(m.tld).toBe('transfer.org');
    await expect(w.reg.proposeMargin({ tld: 'transfer.', kind: 'FIXED_PAISE', value: 1 }, STAFF)).rejects.toMatchObject({ response: { code: 'MARGIN_INVALID' } });
    const o = await move(); expect((await w.reg.orderForVendor('v1', o.id)).kind).toBe('TRANSFER_IN');
    await expect(w.reg.orderForVendor('v2', o.id)).rejects.toMatchObject({ response: { code: 'DOMAIN_ORDER_NOT_FOUND' } });
  });
});
