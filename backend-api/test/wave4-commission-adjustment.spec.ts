import { closeMonth, Line, rupeesText, Slab, csvCell, payoutTotal } from '../src/v3-referrals/core/referral-core';
import { ReferralsService, StaffActor } from '../src/v3-referrals/referrals.service';
import { MemoryPartnersStore, MemoryReferralsStore } from './support/memory-referrals-store';

/**
 * Wave 4 W4: a commission line reversed AFTER it was paid out stays PAID and becomes a separate negative ADJUSTMENT line, netted on the partner's next month close, carried forward when the net would not be above
 * nothing. Reversal before the payout is unchanged (REVERSED, drops out). Closing again is safe.
 */
const d = (iso: string): Date => new Date(iso);
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

// ───────────────────────────────────────────────────────────── pure core
const slab = (id: string, min: number, max: number | null, amount: number, from = '2026-01-01T00:00:00Z'): Slab => ({ id, minVendors: min, maxVendors: max, amountPerVendorMinor: amount, effectiveFrom: d(from) });
const SLABS = [slab('s1', 1, 2, 100_000), slab('s2', 3, null, 150_000)];
const C = (id: string, partnerId: string, month: string, status: Line['status'] = 'ACCRUED', amountMinor: number | null = null): Line => ({ id, partnerId, vendorId: `v-${id}`, month, status, amountMinor });
const A = (id: string, partnerId: string, amount: number, qualifiedAt: string, status: Line['status'] = 'ACCRUED', month = '2026-11'): Line => ({ id, partnerId, vendorId: `v-${id}`, month, status, amountMinor: amount, kind: 'ADJUSTMENT', qualifiedAt: d(qualifiedAt) });

describe('closeMonth with adjustments (pure)', () => {
  it('an adjustment from an earlier month is netted at this close and moves to the closing month; the slab count ignores it', () => {
    const lines = [C('a', 'p', '2026-12'), C('b', 'p', '2026-12'), A('adj', 'p', -100_000, '2026-11-20T10:00:00Z')];
    const r = closeMonth('2026-12', lines, SLABS);
    expect(r.approve).toEqual([{ id: 'a', amountMinor: 100_000 }, { id: 'b', amountMinor: 100_000 }, { id: 'adj', amountMinor: -100_000, month: '2026-12' }]);
    expect(r.partners[0]).toMatchObject({ count: 2, totalMinor: 200_000, adjustmentMinor: -100_000, carriedMinor: 0 });
  });
  it('carry forward: an adjustment bigger than the month\'s commission is not netted and waits for a later close', () => {
    const r = closeMonth('2026-12', [C('a', 'p', '2026-12'), A('adj', 'p', -100_000, '2026-11-20T10:00:00Z')], SLABS);   // 1 vendor = 100000, minus 100000 = nothing to pay
    expect(r.approve).toEqual([{ id: 'a', amountMinor: 100_000 }]);
    expect(r.partners[0]).toMatchObject({ adjustmentMinor: 0, carriedMinor: -100_000 });
    const r2 = closeMonth('2026-12', [C('a', 'p', '2026-12'), A('adj', 'p', -250_000, '2026-11-20T10:00:00Z')], SLABS);
    expect(r2.approve).toEqual([{ id: 'a', amountMinor: 100_000 }]); expect(r2.partners[0].carriedMinor).toBe(-250_000);
  });
  it('a partner with no commission this month only carries its adjustments (and is listed)', () => {
    const r = closeMonth('2026-12', [A('adj', 'p', -50_000, '2026-11-20T10:00:00Z')], SLABS);
    expect(r.approve).toEqual([]); expect(r.partners).toEqual([{ partnerId: 'p', count: 0, perVendorMinor: null, totalMinor: null, adjustmentMinor: 0, carriedMinor: -50_000 }]);
  });
  it('several adjustments: oldest first while the net stays above nothing; the first that does not fit and all later ones wait', () => {
    const lines = [C('a', 'p', '2026-12'), C('b', 'p', '2026-12'), A('x1', 'p', -120_000, '2026-11-02T10:00:00Z'), A('x2', 'p', -90_000, '2026-11-03T10:00:00Z'), A('x3', 'p', -10_000, '2026-11-04T10:00:00Z')];
    const r = closeMonth('2026-12', lines, SLABS);   // 200000 - 120000 = 80000; -90000 would go below nothing: it and x3 wait (x3 is NOT let through ahead of x2)
    expect(r.approve.filter((x) => x.month).map((x) => x.id)).toEqual(['x1']); expect(r.partners[0]).toMatchObject({ adjustmentMinor: -120_000, carriedMinor: -100_000 });
  });
  it('is repeat-safe: after the adjustment is APPROVED a second close approves nothing and counts it once', () => {
    const first = closeMonth('2026-12', [C('a', 'p', '2026-12'), C('b', 'p', '2026-12'), A('adj', 'p', -100_000, '2026-11-20T10:00:00Z')], SLABS);
    expect(first.approve).toHaveLength(3);
    const applied = [C('a', 'p', '2026-12', 'APPROVED', 100_000), C('b', 'p', '2026-12', 'APPROVED', 100_000), A('adj', 'p', -100_000, '2026-11-20T10:00:00Z', 'APPROVED', '2026-12')];
    const again = closeMonth('2026-12', applied, SLABS);
    expect(again.approve).toEqual([]); expect(again.partners[0]).toMatchObject({ adjustmentMinor: 0, carriedMinor: 0 });
    // a second waiting adjustment is judged against what is already netted in the month (200000 - 100000 = 100000; another -100000 would leave nothing)
    const more = closeMonth('2026-12', [...applied, A('adj2', 'p', -100_000, '2026-11-25T10:00:00Z')], SLABS);
    expect(more.approve).toEqual([]); expect(more.partners[0].carriedMinor).toBe(-100_000);
  });
  it('a partner that already has a payout for the month is not touched: its adjustments wait for the next close', () => {
    const r = closeMonth('2026-12', [C('a', 'p', '2026-12', 'PAID', 100_000), A('adj', 'p', -10_000, '2026-12-05T10:00:00Z')], SLABS, new Set(['p']));
    expect(r.approve).toEqual([]); expect(r.partners[0].carriedMinor).toBe(-10_000);
  });
  it('an adjustment made after the end of the month is not in that close; no slab rows in force carries everything', () => {
    expect(closeMonth('2026-11', [C('a', 'p', '2026-11'), A('late', 'p', -1_000, '2026-12-02T10:00:00Z')], SLABS).approve.map((x) => x.id)).toEqual(['a']);
    expect(closeMonth('2026-12', [A('adj', 'p', -1_000, '2026-11-20T10:00:00Z')], []).approve).toEqual([]);
  });
  it('lines without a kind are commission lines (every line before Wave 4)', () => {
    expect(closeMonth('2026-11', [C('a', 'p', '2026-11')], SLABS).approve).toEqual([{ id: 'a', amountMinor: 100_000 }]);
  });
  it('a payout holds the netted adjustment: its total is commission minus adjustment', () => {
    const t = payoutTotal([C('a', 'p', '2026-12', 'APPROVED', 100_000), C('b', 'p', '2026-12', 'APPROVED', 100_000), A('adj', 'p', -100_000, '2026-11-20T10:00:00Z', 'APPROVED', '2026-12')], 'p', '2026-12');
    expect(t).toEqual({ lineIds: ['a', 'b', 'adj'], totalMinor: 100_000 });
  });
});

describe('negative amounts in text and CSV (pure)', () => {
  it('rupees text keeps the sign and the paise', () => { expect(rupeesText(-123_450)).toBe('-1234.50'); expect(rupeesText(-5)).toBe('-0.05'); expect(rupeesText(100_000)).toBe('1000.00'); expect(rupeesText(null)).toBe(''); });
  it('a plain negative number is not defused, a formula still is', () => { expect(csvCell('-1000.00')).toBe('-1000.00'); expect(csvCell('-1+2')).toBe("'-1+2"); expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)"); expect(csvCell('-')).toBe("'-"); });
});

// ───────────────────────────────────────────────────────────── the service
function world() {
  const partners = new MemoryPartnersStore(); const store = new MemoryReferralsStore();
  const recorded: Array<{ actionKey: string }> = [];
  const svc = new ReferralsService(store, partners, { record: async (r: never) => { recorded.push(r); } } as never);
  let t = d('2026-11-10T10:00:00Z'); svc.clock = () => t;
  const asha = partners.add({ name: 'Asha Referrals', email: 'asha@partner.example' });
  const admin: StaffActor = { id: 'admin-1' };
  for (const id of ['v1', 'v2', 'v3', 'v4']) store.addVendor({ id, state: 'Tamil Nadu' });
  return { store, svc, recorded, asha, admin, setNow: (x: Date) => { t = x; } };
}
type W = ReturnType<typeof world>;
const slabs = async (w: W) => { await w.svc.addSlab({ minVendors: 1, maxVendors: 2, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin); await w.svc.addSlab({ minVendors: 3, maxVendors: null, amountPerVendorMinor: 150_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin); };
const paidIn = async (w: W, vendorId: string, at: string) => { await w.svc.setAttribution(vendorId, w.asha.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId, orderId: `o-${vendorId}`, paidAt: d(at), via: 'WEBHOOK' }); };
const reverse = (w: W, vendorId: string) => w.svc.onPaymentReversed({ vendorId, orderId: `o-${vendorId}`, reason: 'refund recorded' });
const pay = (w: W, month: string) => w.svc.recordPayout({ partnerId: w.asha.id, month, reference: `UTR-${month}-0001` }, w.admin);

describe('reversal BEFORE the payout (unchanged)', () => {
  it('an accrued or approved line is marked REVERSED, flagged, drops out of the payout, and no adjustment is made', async () => {
    const w = world(); await slabs(w); await paidIn(w, 'v1', '2026-11-10T10:00:00Z'); await paidIn(w, 'v2', '2026-11-11T10:00:00Z');
    await reverse(w, 'v1');
    expect(w.store.lines.find((l) => l.vendorId === 'v1')).toMatchObject({ status: 'REVERSED', flagged: true });
    await w.svc.closeMonth('2026-11', w.admin);
    await reverse(w, 'v2');   // approved, not paid
    expect(w.store.lines.every((l) => l.kind === 'COMMISSION')).toBe(true);
    expect(code(await err(pay(w, '2026-11')))).toBe('COMMISSION_NOTHING_TO_PAY');
  });
});

describe('reversal AFTER the payout', () => {
  async function paidOut(w: W, n = 3) {
    await slabs(w); for (let i = 1; i <= n; i++) await paidIn(w, `v${i}`, `2026-11-1${i}T10:00:00Z`);
    await w.svc.closeMonth('2026-11', w.admin); return pay(w, '2026-11');   // 3 vendors x 150000
  }

  it('the PAID line stays PAID and a separate negative ADJUSTMENT line is made, flagged, once', async () => {
    const w = world(); const p = await paidOut(w);
    expect(p.totalMinor).toBe(450_000);
    w.setNow(d('2026-12-03T10:00:00Z'));
    await reverse(w, 'v1');
    const paid = w.store.lines.find((l) => l.vendorId === 'v1' && l.kind === 'COMMISSION')!; const adj = w.store.lines.find((l) => l.kind === 'ADJUSTMENT')!;
    expect(paid).toMatchObject({ status: 'PAID', amountMinor: 150_000, flagged: true, payoutId: p.id });
    expect(adj).toMatchObject({ status: 'ACCRUED', amountMinor: -150_000, adjustsLineId: paid.id, partnerId: w.asha.id, vendorId: 'v1', month: '2026-12', flagged: true });
    await reverse(w, 'v1');   // a repeat changes nothing
    expect(w.store.lines.filter((l) => l.kind === 'ADJUSTMENT')).toHaveLength(1);
    expect(w.recorded.filter((r) => r.actionKey === 'commission.adjustment.created')).toHaveLength(1);
    expect(w.store.payouts).toHaveLength(1); expect(w.store.payouts[0].totalMinor).toBe(450_000);   // the payout record is history and is never rewritten
  });

  it('is netted on the partner\'s NEXT month close and shows in that month\'s payout', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await reverse(w, 'v1');
    for (const v of ['v4']) await paidIn(w, v, '2026-12-05T10:00:00Z');
    // December: one new vendor = 100000; the adjustment of -150000 would leave less than nothing, so it is carried
    const dec = await w.svc.closeMonth('2026-12', w.admin);
    expect(dec.approved).toBe(1); expect(w.store.lines.find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ status: 'ACCRUED', month: '2026-12' });
    expect(dec.partners[0]).toMatchObject({ adjustmentMinor: 0, carriedMinor: -150_000 });
  });

  it('is netted when the next month has enough commission: the payout of that month is commission minus the adjustment', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await reverse(w, 'v1');
    await paidIn(w, 'v4', '2026-12-05T10:00:00Z');
    await w.svc.addSlab({ minVendors: 1, maxVendors: null, amountPerVendorMinor: 400_000, effectiveFrom: '2026-12-01T00:00:00Z' }, w.admin);   // the later row replaces the earlier set from December
    const dec = await w.svc.closeMonth('2026-12', w.admin);
    expect(dec.approved).toBe(2); expect(dec.partners[0]).toMatchObject({ adjustmentMinor: -150_000, carriedMinor: 0 });
    expect(w.store.lines.find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ status: 'APPROVED', month: '2026-12', amountMinor: -150_000 });
    const p = await pay(w, '2026-12');
    expect(p.totalMinor).toBe(250_000);   // 400000 - 150000
    expect(w.store.lines.filter((l) => l.month === '2026-12').every((l) => l.status === 'PAID' && l.payoutId === p.id)).toBe(true);
  });

  it('carry forward across several closes: it waits through a thin month and is netted when a later month can bear it', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await reverse(w, 'v1');
    const dec = await w.svc.closeMonth('2026-12', w.admin);   // no commission at all in December
    expect(dec.approved).toBe(0); expect(dec.partners[0]).toMatchObject({ count: 0, adjustmentMinor: 0, carriedMinor: -150_000 });
    w.setNow(d('2027-01-05T10:00:00Z')); await paidIn(w, 'v4', '2027-01-05T10:00:00Z');
    await w.svc.addSlab({ minVendors: 1, maxVendors: null, amountPerVendorMinor: 400_000, effectiveFrom: '2027-01-01T00:00:00Z' }, w.admin);
    const jan = await w.svc.closeMonth('2027-01', w.admin);
    expect(jan.approved).toBe(2);
    expect(w.store.lines.find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ status: 'APPROVED', month: '2027-01' });
    expect((await pay(w, '2027-01')).totalMinor).toBe(250_000);
  });

  it('closing the month again is safe: nothing is approved twice and the audit shows one close', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await reverse(w, 'v1'); await paidIn(w, 'v4', '2026-12-05T10:00:00Z');
    await w.svc.addSlab({ minVendors: 1, maxVendors: null, amountPerVendorMinor: 400_000, effectiveFrom: '2026-12-01T00:00:00Z' }, w.admin);
    await w.svc.closeMonth('2026-12', w.admin);
    const snapshot = JSON.stringify(w.store.lines);
    const again = await w.svc.closeMonth('2026-12', w.admin);
    expect(again.approved).toBe(0); expect(JSON.stringify(w.store.lines)).toBe(snapshot);
    expect(w.recorded.filter((r) => r.actionKey === 'commission.month.closed').filter((_, i) => i >= 1)).toHaveLength(1);   // November's close and December's: the repeat added none
  });

  it('after the month\'s payout, a later reversal waits for the NEXT close instead of changing a paid month', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await paidIn(w, 'v4', '2026-12-02T10:00:00Z');
    await w.svc.addSlab({ minVendors: 1, maxVendors: null, amountPerVendorMinor: 400_000, effectiveFrom: '2026-12-01T00:00:00Z' }, w.admin);
    await w.svc.closeMonth('2026-12', w.admin); await pay(w, '2026-12');
    w.setNow(d('2026-12-20T10:00:00Z')); await reverse(w, 'v2');   // December is paid; this adjustment is made in December
    const again = await w.svc.closeMonth('2026-12', w.admin);
    expect(again.approved).toBe(0); expect(again.partners[0]).toMatchObject({ adjustmentMinor: 0, carriedMinor: -150_000 });
    expect(w.store.lines.find((l) => l.kind === 'ADJUSTMENT')!.status).toBe('ACCRUED');
  });

  it('shows in the admin ledger, the CSV and the partner view, with the kind and a negative amount', async () => {
    const w = world(); await paidOut(w);
    w.setNow(d('2026-12-03T10:00:00Z')); await reverse(w, 'v1');
    const ledger = await w.svc.ledger({ skip: 0, take: 50 });
    expect(ledger.items.find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ kind: 'ADJUSTMENT', amountMinor: -150_000, status: 'ACCRUED', adjustsLineId: expect.any(String), flagged: true });
    expect(ledger.items.filter((l) => l.kind === 'COMMISSION')).toHaveLength(3);
    const csv = await w.svc.exportCsv({});
    const rows = csv.trim().split('\r\n'); expect(rows[0].split(',')[1]).toBe('kind');
    const adjRow = rows.find((r) => r.includes('ADJUSTMENT'))!; expect(adjRow).toContain('-1500.00'); expect(adjRow).not.toContain("'-");
    const mine = await w.svc.myCommission(w.asha.id, 0, 50);
    expect(mine.items.find((i) => i.kind === 'ADJUSTMENT')).toMatchObject({ kind: 'ADJUSTMENT', amountMinor: -150_000, status: 'ACCRUED' });
    expect(JSON.stringify(mine)).not.toMatch(/refund recorded|owner decides|adjustsLineId|flagReason/);   // the partner sees no internal note
  });

  it('a line with no amount (never approved) cannot be adjusted; another order or an unknown vendor changes nothing', async () => {
    const w = world(); await slabs(w); await paidIn(w, 'v1', '2026-11-10T10:00:00Z');
    Object.assign(w.store.lines[0], { status: 'PAID', amountMinor: null });
    await reverse(w, 'v1'); expect(w.store.lines).toHaveLength(1);
    Object.assign(w.store.lines[0], { amountMinor: 100_000 });
    await w.svc.onPaymentReversed({ vendorId: 'v1', orderId: 'other', reason: 'x' }); await w.svc.onPaymentReversed({ vendorId: 'ghost', orderId: 'o', reason: 'x' });
    expect(w.store.lines).toHaveLength(1);
  });

  it('a store failure is never raised to the refund', async () => {
    const w = world(); await paidOut(w);
    w.store.createAdjustment = async () => { throw new Error('db down'); };
    await expect(reverse(w, 'v1')).resolves.toBeUndefined();
    expect(w.store.lines.find((l) => l.vendorId === 'v1')!.status).toBe('PAID');
  });
});
