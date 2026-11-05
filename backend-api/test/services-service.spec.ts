import { HttpException } from '@nestjs/common';
import { postEntry } from '../src/v3-wallet/wallet-engine';
import { advanceDays, SUPER, V1, V2 } from './support/wallet-world';
import { OPS, servicesWorld, ServicesWorld } from './support/services-world';

/**
 * Slice 5.16b on the in-memory twins: the catalogue, the price book (proposed then approved by a SUPER_ADMIN with a date), the vendor's view with the funding order, and packs bought from the
 * wallet. Every price in here is made up by the test; the code under test contains none.
 */
let w: ServicesWorld;
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as Record<string, unknown>; return { status: e.getStatus(), code: b.code as string | undefined, body: b }; } throw e; }
  throw new Error('expected a refusal');
};
const fundWallet = async (vendorId: string, amount: number) => { await w.open(vendorId); await w.store.unit(vendorId, (tx) => postEntry(tx, { kind: 'TOPUP', amountPaise: amount, idempotencyKey: `seed-${vendorId}-${amount}-${Math.random()}`, actor: { type: 'SYSTEM', id: null }, now: w.clock(), validityDays: 365 })); };
const state = (over: Partial<ServicesWorld['plan']> = {}) => Object.assign(w.plan, over);
beforeEach(async () => { w = servicesWorld(); await w.seed(); });

describe('the seeded catalogue is words only', () => {
  it('has the twenty-three services and no price at all (the owner prices come from the loader, not from this seed)', async () => {
    expect((await w.services.services()).map((s) => s.key)).toHaveLength(23);
    expect(await w.services.allServicePrices()).toEqual([]);
  });
});

describe('the price book', () => {
  it('a proposal is never in force: the service has no price, is not public and says "price not set" to a vendor', async () => {
    await w.catalogue.proposePrice('service', 'POSTER_DESIGN', { amountPaise: 50_000 }, OPS);
    expect((await w.catalogue.publicCatalogue()).items).toEqual([]);
    await fundWallet('v1', 500_000);
    const poster = (await w.catalogue.vendorServices('v1')).items.find((s) => s.key === 'POSTER_DESIGN')!;
    expect(poster).toMatchObject({ price: null, priceNote: 'Price not set', tax: null, funding: { kind: 'NONE', reason: 'PRICE_NOT_SET' } });
  });

  it('approval needs an effective date; once it has started the price is public and the vendor sees price and tax', async () => {
    const p = await w.catalogue.proposePrice('service', 'POSTER_DESIGN', { amountPaise: 50_000 }, OPS);
    expect((await codeOf(w.catalogue.approvePrice('service', p.id, { effectiveFrom: undefined as never }, SUPER))).code).toBe('SERVICE_PRICE_STATE');
    const later = new Date(w.clock().getTime() + 3600_000).toISOString();
    await w.catalogue.approvePrice('service', p.id, { effectiveFrom: later }, SUPER);
    expect((await w.catalogue.publicCatalogue()).items).toEqual([]);   // approved, but it starts in an hour
    w.now.t = new Date(w.now.t.getTime() + 3600_000);
    expect((await w.catalogue.publicCatalogue()).items).toEqual([expect.objectContaining({ key: 'POSTER_DESIGN', price: { amountPaise: 50_000, currency: 'INR', taxInclusive: false, effectiveFrom: new Date(later) } })]);
  });

  it('a later approved price takes over at its start; the old one stays in the history; retiring the newest brings the older back', async () => {
    const a = await w.price('POSTER_DESIGN', 40_000);
    const b = await w.catalogue.proposePrice('service', 'POSTER_DESIGN', { amountPaise: 60_000 }, OPS);
    const start = new Date(w.clock().getTime() + 86_400_000);
    await w.catalogue.approvePrice('service', b.id, { effectiveFrom: start.toISOString() }, SUPER);
    expect((await w.catalogue.publicCatalogue()).items[0].price.amountPaise).toBe(40_000);
    advanceDays(w, 1); expect((await w.catalogue.publicCatalogue()).items[0].price.amountPaise).toBe(60_000);
    await w.catalogue.retirePrice('service', b.id, SUPER); expect((await w.catalogue.publicCatalogue()).items[0].price.amountPaise).toBe(40_000);
    expect((await w.services.servicePrices((await w.services.serviceByKey('POSTER_DESIGN'))!.id)).map((p) => p.status).sort()).toEqual(['APPROVED', 'RETIRED']);
    void a;
  });

  it('refuses a past date, a date that is not later than the price in force, and the same instant twice', async () => {
    await w.price('POSTER_DESIGN', 40_000);
    const p = await w.catalogue.proposePrice('service', 'POSTER_DESIGN', { amountPaise: 60_000 }, OPS);
    advanceDays(w, 2);
    const past = await codeOf(w.catalogue.approvePrice('service', p.id, { effectiveFrom: new Date(w.clock().getTime() - 3600_000).toISOString() }, SUPER));
    expect([past.status, past.body.problem]).toEqual([409, 'EFFECTIVE_DATE_IN_PAST']);
    const q = await w.catalogue.proposePrice('service', 'POSTER_DESIGN', { amountPaise: 70_000 }, OPS);
    const when = new Date(w.clock().getTime() + 86_400_000).toISOString();
    await w.catalogue.approvePrice('service', p.id, { effectiveFrom: when }, SUPER);
    expect((await codeOf(w.catalogue.approvePrice('service', q.id, { effectiveFrom: when }, SUPER))).body.problem).toBe('EFFECTIVE_DATE_TAKEN');
  });

  it('only a proposed price can be edited or approved; an approved price never changes its amount; the amount must be a positive whole number of paise', async () => {
    const id = await w.price('POSTER_DESIGN', 40_000);
    expect((await codeOf(w.catalogue.editProposedPrice('service', id, { amountPaise: 1 }, OPS))).code).toBe('SERVICE_PRICE_STATE');
    expect((await codeOf(w.catalogue.approvePrice('service', id, { effectiveFrom: new Date(w.clock().getTime() + 86_400_000).toISOString() }, SUPER))).body.problem).toBe('PRICE_NOT_PROPOSED');
    for (const bad of [0, -5, 1.5, 100_000_001]) expect((await codeOf(w.catalogue.proposePrice('service', 'SEO_TASK', { amountPaise: bad }, OPS))).code).toBe('SERVICE_PRICE_INVALID');
    const p = await w.catalogue.proposePrice('service', 'SEO_TASK', { amountPaise: 10_000 }, OPS);
    expect((await w.catalogue.editProposedPrice('service', p.id, { amountPaise: 12_000, taxInclusive: true }, OPS))).toMatchObject({ amountPaise: 12_000, taxInclusive: true, status: 'PROPOSED' });
  });

  it('every change is audited with who and what', async () => {
    const id = await w.price('POSTER_DESIGN', 40_000);
    const acts = w.services.audits.map((a) => a.action);
    expect(acts).toEqual(expect.arrayContaining(['service.price.propose', 'service.price.approve']));
    const approve = w.services.audits.find((a) => a.action === 'service.price.approve')!;
    expect(approve).toMatchObject({ actor: { id: 'super-1' }, entityId: id, after: { status: 'APPROVED', amountPaise: 40_000 } });
  });

  it('the public catalogue shows only visible, active services with a price in force, and nothing internal', async () => {
    await w.price('POSTER_DESIGN', 40_000); await w.price('SEO_TASK', 10_000);
    await w.catalogue.updateService('SEO_TASK', { publicVisible: false }, OPS);
    await w.price('REEL_SLIDESHOW', 20_000); await w.catalogue.updateService('REEL_SLIDESHOW', { status: 'RETIRED' }, OPS);
    const items = (await w.catalogue.publicCatalogue()).items;
    expect(items.map((i) => i.key)).toEqual(['POSTER_DESIGN']);
    expect(JSON.stringify(items)).not.toMatch(/planStateRule|trackScope|status|createdBy|approvedBy|approvedAt|"id"|note|PROPOSED|sortOrder/);
  });

  it('MARKETING reads the catalogue without a single money field', async () => {
    await w.price('POSTER_DESIGN', 40_000); await w.catalogue.proposePrice('service', 'SEO_TASK', { amountPaise: 10_000 }, OPS);
    const m = await w.catalogue.adminServices(false); expect(JSON.stringify(m)).not.toMatch(/amountPaise|priceInForce|proposedPrices|40000|10000/);
    expect(JSON.stringify(await w.catalogue.adminService('POSTER_DESIGN', false))).not.toMatch(/amountPaise|prices/);
    const ops = await w.catalogue.adminServices(true); expect(ops.items.find((i) => i.key === 'POSTER_DESIGN')).toMatchObject({ priceInForce: { amountPaise: 40_000 } });
    expect(ops.items.find((i) => i.key === 'SEO_TASK')).toMatchObject({ priceInForce: null, proposedPrices: [{ amountPaise: 10_000 }] });
  });
});

describe('staff edit the catalogue', () => {
  it('a new service is a DRAFT (vendors do not see it) until it is made ACTIVE; its key is unique and never changes', async () => {
    await w.catalogue.createService({ key: 'FLYER_DESIGN', name: 'Flyer design', shortDescription: 'A flyer for your business.', includesText: 'One flyer made by our team.', approvalText: 'You approve it or ask for changes.' }, OPS);
    await fundWallet('v1', 100_000);
    expect((await w.catalogue.vendorServices('v1')).items.some((s) => s.key === 'FLYER_DESIGN')).toBe(false);
    await w.catalogue.updateService('FLYER_DESIGN', { status: 'ACTIVE' }, OPS);
    expect((await w.catalogue.vendorServices('v1')).items.some((s) => s.key === 'FLYER_DESIGN')).toBe(true);
    expect((await codeOf(w.catalogue.createService({ key: 'FLYER_DESIGN', name: 'Again', shortDescription: 'Another flyer.', includesText: 'Another flyer.', approvalText: 'Approve it.' }, OPS))).code).toBe('SERVICE_KEY_TAKEN');
    expect((await codeOf(w.catalogue.updateService('FLYER_DESIGN', { key: 'OTHER' } as never, OPS))).code).toBe('SERVICE_INVALID');
    expect((await codeOf(w.catalogue.updateService('NOPE', { name: 'A valid name' }, OPS))).code).toBe('SERVICE_NOT_FOUND');
  });
  it('the plan-state rule is editable per service', async () => {
    await w.catalogue.updateService('SETUP_HELP', { planStateRule: 'ANY' }, OPS);
    expect((await w.services.serviceByKey('SETUP_HELP'))!.planStateRule).toBe('ANY');
    expect((await codeOf(w.catalogue.updateService('SETUP_HELP', { planStateRule: 'WHENEVER' }, OPS))).code).toBe('SERVICE_INVALID');
  });
});

describe('what a vendor sees before confirming', () => {
  beforeEach(async () => { await w.price('POSTER_DESIGN', 50_000); });
  const poster = async (vendor = 'v1') => (await w.catalogue.vendorServices(vendor)).items.find((s) => s.key === 'POSTER_DESIGN')!;

  it('what it includes, who does it, how approval works, the price (no tax: GST was added at the refill), and how it would be paid (the wallet)', async () => {
    await fundWallet('v1', 200_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1);
    expect(await poster()).toMatchObject({
      key: 'POSTER_DESIGN', name: 'Poster design', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', includesText: expect.stringMatching(/poster/i), approvalText: expect.stringMatching(/approve/i),
      price: { amountPaise: 50_000, taxInclusive: false }, tax: { ok: true, intraState: null, taxMinor: 0, lines: [], totalMinor: 50_000 }, funding: { kind: 'WALLET', amountPaise: 50_000 }, available: true,
    });
  });
  it('using credit carries no tax whatever the state: no state, another state, or no seller state all cost exactly the price (the GST was added at the refill)', async () => {
    await fundWallet('v1', 200_000);
    expect(await poster()).toMatchObject({ tax: { ok: true, taxMinor: 0, totalMinor: 50_000, lines: [] }, funding: { kind: 'WALLET', amountPaise: 50_000 } });   // no billing state at all
    await w.svc.setBillingProfile('v1', { stateCode: '29' }, V1);
    expect(await poster()).toMatchObject({ tax: { ok: true, taxMinor: 0, totalMinor: 50_000 }, funding: { kind: 'WALLET', amountPaise: 50_000 } });
    w.wsettings.over = { ...w.wsettings.over, walletSellerStateCode: '' };
    expect(await poster()).toMatchObject({ tax: { ok: true, taxMinor: 0, totalMinor: 50_000 }, funding: { kind: 'WALLET', amountPaise: 50_000 } });
  });
  it('a short wallet shows the exact shortfall; a wallet that is not open says so; a frozen one says so', async () => {
    await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1).catch(() => undefined);
    await fundWallet('v1', 20_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1);
    expect((await poster()).funding).toEqual({ kind: 'NONE', reason: 'INSUFFICIENT_WALLET', shortfallPaise: 30_000 });
    expect((await poster('v2')).funding).toMatchObject({ kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' });   // no wallet at all: that is what the vendor is told, not a tax problem
    await w.svc.setFrozen('v1', { frozen: true, reason: 'chargeback review' }, SUPER);
    expect((await poster()).funding).toMatchObject({ kind: 'NONE' });
  });
  it('the plan allowance comes first, then a pack, then the wallet', async () => {
    await fundWallet('v1', 500_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1);
    w.plan.features['services.included.POSTER_DESIGN'] = { state: 'LIMITED', limit: 1 };
    expect(await poster()).toMatchObject({ allowance: { limit: 1, used: 0, remaining: 1 }, funding: { kind: 'INCLUDED_ALLOWANCE', remaining: 1 } });
    w.usage.used.POSTER_DESIGN = 1;
    await w.pack('POSTERS3', [{ serviceKey: 'POSTER_DESIGN', count: 3 }], 120_000);
    await w.catalogue.purchasePack('v1', 'POSTERS3', 'buy-posters-0001', V1);
    expect(await poster()).toMatchObject({ allowance: { remaining: 0 }, pack: { remaining: 3 }, funding: { kind: 'PACK', remaining: 3 } });
    await w.services.unit(async (tx) => { const [p] = await tx.purchasesFor('v1'); await tx.updatePurchaseRemaining(p.id, p.remaining, { POSTER_DESIGN: 0 }); });
    expect((await poster()).funding).toMatchObject({ kind: 'WALLET' });
  });
  it('a feature that is not a numeric limit (nothing set) is not an allowance', async () => {
    await fundWallet('v1', 500_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1);
    w.plan.features['services.included.POSTER_DESIGN'] = { state: 'HIDDEN', limit: null };
    expect((await poster()).allowance).toBeNull();
  });
  it('the default plan-state rule: only while Pro is active or in grace; ANY always; a track scope limits who sees it as available', async () => {
    await fundWallet('v1', 500_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1);
    state({ subscriptionStatus: 'GRACE' }); expect((await poster()).available).toBe(true);
    state({ level: 'FREE', subscriptionStatus: 'EXPIRED' });
    expect(await poster()).toMatchObject({ available: false, unavailableReason: 'PLAN_STATE', funding: { kind: 'NONE', reason: 'PLAN_STATE' } });
    await w.catalogue.updateService('POSTER_DESIGN', { planStateRule: 'ANY' }, OPS); expect((await poster()).available).toBe(true);
    state({ level: 'PRO', subscriptionStatus: 'ACTIVE', suspended: true }); await w.catalogue.updateService('POSTER_DESIGN', { planStateRule: 'PRO_ACTIVE_OR_GRACE' }, OPS);
    expect((await poster()).available).toBe(false);
    state({ suspended: false }); await w.catalogue.updateService('POSTER_DESIGN', { trackScope: ['professional'] }, OPS);
    expect(await poster()).toMatchObject({ available: false, unavailableReason: 'TRACK' });
  });
  it('hides what is internal: no status, visibility flag, sort order, track scope or other vendors\' data', async () => {
    await fundWallet('v1', 200_000);
    const s = JSON.stringify((await w.catalogue.vendorServices('v1')).items[0]); expect(s).not.toMatch(/publicVisible|"status"|sortOrder|trackScope|createdBy|approvedBy|vendorId/);
  });
});

describe('packs', () => {
  const buy = (key = 'pack-buy-key-0001', packKey = 'POSTERS3', vendor = 'v1', actor = V1) => w.catalogue.purchasePack(vendor, packKey, key, actor);
  beforeEach(async () => { await w.price('POSTER_DESIGN', 50_000); await w.pack('POSTERS3', [{ serviceKey: 'POSTER_DESIGN', count: 3 }], 120_000, { validityDays: 90 }); await fundWallet('v1', 500_000); await w.svc.setBillingProfile('v1', { stateCode: '33' }, V1); });

  it('a pack lists whole services with whole counts; an unknown service, a repeat or a bad count is refused; a DRAFT pack is not offered', async () => {
    for (const items of [[], [{ serviceKey: 'NOPE', count: 1 }], [{ serviceKey: 'POSTER_DESIGN', count: 0 }], [{ serviceKey: 'POSTER_DESIGN', count: 1 }, { serviceKey: 'POSTER_DESIGN', count: 1 }]]) {
      expect((await codeOf(w.catalogue.createPack({ key: 'BAD_PACK', name: 'Bad pack', description: 'A pack that is wrong.', items }, OPS))).code).toBe('PACK_INVALID');
    }
    await w.pack('DRAFT_PACK', [{ serviceKey: 'SEO_TASK', count: 1 }], 10_000, { status: 'DRAFT' });
    expect((await w.catalogue.vendorPacks('v1')).items.map((p) => p.key)).toEqual(['POSTERS3']);
    expect((await codeOf(buy('pack-buy-key-0002', 'DRAFT_PACK'))).code).toBe('PACK_NOT_PURCHASABLE');
    expect((await codeOf(w.catalogue.createPack({ key: 'POSTERS3', name: 'Again', description: 'The same key again.', items: [{ serviceKey: 'SEO_TASK', count: 1 }] }, OPS))).code).toBe('PACK_KEY_TAKEN');
  });

  it('buying charges the exact price (no tax, no invoice) from the wallet, records the purchase and the ledger entry together, and the pack counts down from the full amount', async () => {
    const r = await buy();
    expect(r).toMatchObject({ packKey: 'POSTERS3', paidPaise: 120_000, remaining: { POSTER_DESIGN: 3 }, replay: false });
    expect(r.expiresAt!.getTime() - w.clock().getTime()).toBe(90 * 86_400_000);
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 380_000 });
    const entry = w.store.ledger.find((e) => e.kind === 'PACK_PURCHASE')!; expect(entry).toMatchObject({ amountPaise: -120_000, refType: 'pack' });
    const [row] = await w.services.purchasesFor('v1'); expect(row).toMatchObject({ ledgerEntryId: entry.id, priceSnapshotPaise: 120_000, taxSnapshot: { taxMinor: 0, basePaise: 120_000 } });
    expect(w.store.receipts).toEqual([]);   // buying a pack creates no invoice of any kind
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('the same key returns the same purchase and charges once, even sent thirty times at once; a key used for another pack is refused', async () => {
    await w.pack('SEO2', [{ serviceKey: 'SEO_TASK', count: 2 }], 30_000);
    const rs = await Promise.all(Array.from({ length: 30 }, () => buy('pack-buy-key-0003')));
    expect(new Set(rs.map((r) => r.id)).size).toBe(1); expect(rs.filter((r) => !r.replay)).toHaveLength(1);
    expect(w.store.ledger.filter((e) => e.kind === 'PACK_PURCHASE')).toHaveLength(1);
    expect((await codeOf(buy('pack-buy-key-0003', 'SEO2'))).code).toBe('WALLET_IDEMPOTENCY_CONFLICT');
  });
  it('a short wallet is INSUFFICIENT_WALLET with the shortfall and the top-up that covers it, and nothing is written', async () => {
    await fundWallet('v2', 100_000); await w.svc.setBillingProfile('v2', { stateCode: '33' }, V2);
    const r = await codeOf(buy('pack-buy-key-0004', 'POSTERS3', 'v2', V2));
    expect([r.status, r.code]).toEqual([409, 'INSUFFICIENT_WALLET']); expect(r.body).toMatchObject({ shortfallPaise: 20_000, suggestedTopupPaise: 20_000, minTopupPaise: 10_000 });
    expect(await w.services.purchasesFor('v2')).toEqual([]); expect(w.store.ledger.filter((e) => e.vendorId === 'v2' && e.kind === 'PACK_PURCHASE')).toHaveLength(0);
  });
  it('is refused with its own code when the wallet is not open, the pack has no approved price, or an item cannot be bought now (tax is not needed: the GST was added at the refill)', async () => {
    expect((await codeOf(buy('pack-buy-key-0005', 'POSTERS3', 'v3', { type: 'VENDOR', id: 'v3', ip: null }))).code).toBe('WALLET_NOT_ACTIVE');
    await w.pack('NO_PRICE', [{ serviceKey: 'SEO_TASK', count: 1 }], null);
    expect((await codeOf(buy('pack-buy-key-0006', 'NO_PRICE'))).code).toBe('SERVICE_PRICE_NOT_SET');
    state({ level: 'FREE', subscriptionStatus: 'EXPIRED' });
    expect((await codeOf(buy('pack-buy-key-0008'))).code).toBe('SERVICE_PLAN_STATE');
    state({ level: 'PRO', subscriptionStatus: 'ACTIVE' }); await w.catalogue.updateService('POSTER_DESIGN', { trackScope: ['professional'] }, OPS);
    expect((await codeOf(buy('pack-buy-key-0009'))).code).toBe('SERVICE_TRACK');
    expect(w.store.ledger.filter((e) => e.kind === 'PACK_PURCHASE')).toHaveLength(0);
  });
  it('a pack is sold even with no seller state and no billing state: tax is not part of using credit', async () => {
    w.wsettings.over = { ...w.wsettings.over, walletSellerStateCode: '' };
    expect((await buy('pack-buy-key-0007')).paidPaise).toBe(120_000); expect(w.store.receipts).toEqual([]);
  });
  it('a price changed after the purchase never changes what was paid (it was copied)', async () => {
    await buy(); const p = await w.catalogue.proposePrice('pack', 'POSTERS3', { amountPaise: 999_999 }, OPS);
    advanceDays(w, 1); await w.catalogue.approvePrice('pack', p.id, { effectiveFrom: new Date(w.clock().getTime() + 60_000).toISOString() }, SUPER);
    expect((await w.services.purchasesFor('v1'))[0].priceSnapshotPaise).toBe(120_000);
  });
  it('forty parallel purchases with different keys by a wallet that can afford three: exactly three succeed and the books balance', async () => {
    await fundWallet('v2', 370_000); await w.svc.setBillingProfile('v2', { stateCode: '33' }, V2);
    const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => buy(`pack-par-key-${String(i).padStart(4, '0')}`, 'POSTERS3', 'v2', V2).then(() => 'ok', (e) => (e as HttpException).getResponse() && ((e as HttpException).getResponse() as { code: string }).code)));
    expect(rs.filter((r) => r === 'ok')).toHaveLength(3); expect(rs.filter((r) => r === 'INSUFFICIENT_WALLET')).toHaveLength(37);
    expect(await w.store.wallet('v2')).toMatchObject({ balancePaise: 370_000 - 3 * 120_000 });
    expect((await w.services.purchasesFor('v2'))).toHaveLength(3); expect(await w.svc.reconcileVendor('v2')).toMatchObject({ ok: true });
  });
  it('a crash in the middle leaves neither a charge nor a purchase', async () => {
    const before = JSON.stringify([await w.store.wallet('v1'), w.store.ledger]);
    w.store.failCommitOnce = true;
    await expect(buy('pack-buy-key-0010')).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await w.store.wallet('v1'), w.store.ledger])).toBe(before); expect(await w.services.purchasesFor('v1')).toEqual([]);
  });
  it('a purchase row that fails to save gives the charge back (the whole unit rolls back)', async () => {
    const real = w.services.withWallet.bind(w.services);
    w.services.withWallet = (v, fn) => real(v, async (tx, wtx) => fn({ ...tx, insertPurchase: async () => { throw new Error('disk full'); } }, wtx));
    await expect(buy('pack-buy-key-0011')).rejects.toThrow(/disk full/);
    expect(w.store.ledger.filter((e) => e.kind === 'PACK_PURCHASE')).toHaveLength(0); expect((await w.store.wallet('v1'))!.balancePaise).toBe(500_000);
  });
  it('another vendor never sees or uses a pack that vendor 1 bought', async () => {
    await buy(); await fundWallet('v2', 10_000);
    expect((await w.catalogue.vendorPacks('v2')).purchases).toEqual([]);
    expect((await w.catalogue.vendorPacks('v1')).purchases).toHaveLength(1);
    expect((await w.catalogue.vendorServices('v2')).items.find((s) => s.key === 'POSTER_DESIGN')!.pack.remaining).toBe(0);
  });
  it('an expired pack no longer counts', async () => {
    await buy(); expect((await w.catalogue.vendorServices('v1')).items.find((s) => s.key === 'POSTER_DESIGN')!.pack.remaining).toBe(3);
    advanceDays(w, 91); expect((await w.catalogue.vendorServices('v1')).items.find((s) => s.key === 'POSTER_DESIGN')!.pack.remaining).toBe(0);
  });
});
