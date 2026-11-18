import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { shapePublicPricing, PricingRows } from '../src/plans/public/public-pricing.shape';

/** B3.0: why an approved price can show PRICE_PENDING, what a second approval does, and the audited withdraw route. */
const NOW = new Date('2026-11-18T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const code = (e: unknown): string | undefined => ((e as { getResponse?: () => { code?: string } }).getResponse?.() as { code?: string } | undefined)?.code;
const ACTOR = { type: 'STAFF', id: 'super-1', ip: null } as never;

interface Row { id: string; planId: string; termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date; createdAt: Date }
const row = (id: string, over: Partial<Row> = {}): Row => ({ id, planId: 'P', termMonths: 3, amountPaise: 100_000, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: day(-10), createdAt: day(-20), ...over });

function make(initial: Row[]) {
  const rows = initial.map((r) => ({ ...r }));
  const audit = { record: jest.fn(async () => undefined) };
  const tx = {
    v3PlanPrice: {
      findUnique: async ({ where }: { where: { id: string } }) => { const r = rows.find((x) => x.id === where.id); return r ? { ...r } : null; },
      findMany: async ({ where }: { where: { planId: string; termMonths: number; status: string; currency: string } }) => rows.filter((r) => r.planId === where.planId && r.termMonths === where.termMonths && r.status === where.status && r.currency === where.currency).map((r) => ({ ...r })),
      findFirst: async ({ where }: { where: { planId: string; termMonths: number; effectiveFrom: Date; NOT: { id: string } } }) => rows.find((r) => r.planId === where.planId && r.termMonths === where.termMonths && r.effectiveFrom.getTime() === where.effectiveFrom.getTime() && r.id !== where.NOT.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return { ...r }; },
    },
  };
  const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
  const invalidate = jest.fn();
  return { svc: new PlansAdminService(prisma as never, audit as never, { invalidateAll: invalidate } as never), rows, audit, invalidate };
}

const pricing = (rows: Row[], over: Partial<PricingRows> = {}): ReturnType<typeof shapePublicPricing> => shapePublicPricing({
  now: NOW, plans: [{ id: 'P', key: 'handyman_pro', track: 'handyman', level: 'PRO', name: 'Handyman Pro', description: null, status: 'ACTIVE', isPublic: true, sortOrder: 1 }],
  // the public service loads only APPROVED rows that have started: the same filter is applied here
  prices: rows.filter((r) => r.status === 'APPROVED' && r.effectiveFrom.getTime() <= NOW.getTime()),
  tax: { name: 'GST', ratePercent: 18 }, capabilities: [], tierCells: [], addonPacks: [], addonPrices: [], ...over,
} as PricingRows);
const term3 = (rows: Row[], over: Partial<PricingRows> = {}) => pricing(rows, over).plans[0].terms.find((t) => t.termMonths === 3)!;

describe('(1) why an APPROVED price shows PRICE_PENDING', () => {
  it('approved but not started yet (a future start date): pending until the moment it starts', () => {
    expect(term3([row('a', { effectiveFrom: day(3) })])).toMatchObject({ state: 'PRICE_PENDING', price: null });
    expect(term3([row('a', { effectiveFrom: new Date(NOW.getTime() + 1000) })]).state).toBe('PRICE_PENDING');
    expect(term3([row('a', { effectiveFrom: new Date(NOW.getTime() - 1000) })]).state).toBe('AVAILABLE');
  });
  it('approved and started, but a price that holds GST while no tax rate exists is pending too; another currency never counts', () => {
    expect(term3([row('a', { taxInclusive: true })], { tax: null }).state).toBe('PRICE_PENDING');
    expect(term3([row('a', { taxInclusive: true })]).state).toBe('AVAILABLE');
    expect(term3([row('a', { currency: 'USD' })]).state).toBe('PRICE_PENDING');
  });
  it('a proposed or a withdrawn row never counts', () => {
    expect(term3([row('a', { status: 'PROPOSED' })]).state).toBe('PRICE_PENDING');
    expect(term3([row('a', { status: 'WITHDRAWN' })]).state).toBe('PRICE_PENDING');
  });
  it('a plan that is not ACTIVE and public is not listed at all', () => {
    expect(pricing([row('a')], { plans: [{ id: 'P', key: 'handyman_pro', track: 'handyman', level: 'PRO', name: 'x', description: null, status: 'DRAFT', isPublic: true, sortOrder: 1 }] } as never).plans).toEqual([]);
  });
});

describe('(2) a second approved price for the same plan and term', () => {
  it('the same start moment is refused (PRICE_START_CLASH); a later start becomes the price in force at that moment and the earlier row stays as history', async () => {
    const { svc, rows } = make([row('old', { effectiveFrom: day(-10) }), row('new1', { status: 'PROPOSED', amountPaise: 224_700, effectiveFrom: day(-1) })]);
    const approved = await svc.approvePrice('new1', { effectiveFrom: day(0).toISOString() } as never, ACTOR, NOW);
    expect(approved.status).toBe('APPROVED');
    expect(term3(rows)).toMatchObject({ state: 'AVAILABLE', price: { priceMinor: 224_700 } });   // the newest started price wins
    expect(rows.find((r) => r.id === 'old')).toMatchObject({ status: 'APPROVED', amountPaise: 100_000 });   // nothing ended, nothing edited
    const { svc: s2, rows: r2 } = make([row('old', { effectiveFrom: NOW }), row('new2', { status: 'PROPOSED', effectiveFrom: day(-1) })]);
    expect(code(await s2.approvePrice('new2', { effectiveFrom: NOW.toISOString() } as never, ACTOR, NOW).then(() => null, (e) => e))).toBe('PRICE_START_CLASH');
    void r2;
  });
  it('THE TRAP: an earlier approved row that starts later still takes over at its start, whatever was approved after it', async () => {
    const { rows, svc } = make([row('wrong', { amountPaise: 99_900, effectiveFrom: day(5) }), row('right', { status: 'PROPOSED', amountPaise: 224_700, effectiveFrom: day(-1) })]);
    await svc.approvePrice('right', { effectiveFrom: NOW.toISOString() } as never, ACTOR, NOW);
    expect(term3(rows).price?.priceMinor).toBe(224_700);                                  // today: the right price
    const later = (n: number) => shapePublicPricing({ now: day(n), plans: [{ id: 'P', key: 'handyman_pro', track: 'handyman', level: 'PRO', name: 'x', description: null, status: 'ACTIVE', isPublic: true, sortOrder: 1 }], prices: rows.filter((r) => r.status === 'APPROVED' && r.effectiveFrom.getTime() <= day(n).getTime()), tax: { name: 'GST', ratePercent: 18 }, capabilities: [], tierCells: [], addonPacks: [], addonPrices: [] } as never).plans[0].terms[0];
    expect(later(6).price?.priceMinor).toBe(99_900);                                      // in five days the wrong, future-dated row wins: it must be withdrawn
  });
});

describe('(3) the audited withdraw route', () => {
  it('withdraws a wrongly approved price that has not started: it never starts, the row and its history are untouched, one audit row with who, why and what is in force after', async () => {
    const { svc, rows, audit, invalidate } = make([row('ok', { amountPaise: 100_000, effectiveFrom: day(-10) }), row('wrong', { amountPaise: 99_900, effectiveFrom: day(5) })]);
    const r = await svc.withdrawPrice('wrong', '  entered the wrong date  ', ACTOR, NOW);
    expect(r).toMatchObject({ id: 'wrong', status: 'WITHDRAWN', wasInForce: false, amountPaise: 99_900, inForceAfter: { id: 'ok', amountPaise: 100_000 } });
    expect(rows.find((x) => x.id === 'wrong')).toMatchObject({ status: 'WITHDRAWN', amountPaise: 99_900, effectiveFrom: day(5), createdAt: day(-20) });
    expect(audit.record).toHaveBeenCalledTimes(1);
    const args = (audit.record as jest.Mock).mock.calls[0];
    expect(args[2]).toBe('price.withdraw'); expect(args[5]).toMatchObject({ status: 'APPROVED' }); expect(args[6]).toMatchObject({ status: 'WITHDRAWN', reason: 'entered the wrong date', wasInForce: false });
    expect(invalidate).toHaveBeenCalled();
  });
  it('withdraws one that IS in force: the earlier started price is in force again, or PRICE_PENDING when there is none', async () => {
    const { svc, rows } = make([row('older', { amountPaise: 100_000, effectiveFrom: day(-30) }), row('cur', { amountPaise: 150_000, effectiveFrom: day(-2) })]);
    expect(term3(rows).price?.priceMinor).toBe(150_000);
    expect(await svc.withdrawPrice('cur', 'wrong amount', ACTOR, NOW)).toMatchObject({ wasInForce: true, inForceAfter: { id: 'older' } });
    expect(term3(rows).price?.priceMinor).toBe(100_000);
    expect(await svc.withdrawPrice('older', 'withdraw this too', ACTOR, NOW)).toMatchObject({ wasInForce: true, inForceAfter: null });
    expect(term3(rows)).toMatchObject({ state: 'PRICE_PENDING', price: null });
  });
  it('a reason is required (5 to 300 characters); only an approved price can be withdrawn; an unknown price is 404; withdrawing twice changes nothing and logs nothing', async () => {
    const { svc, audit } = make([row('a'), row('p', { status: 'PROPOSED' })]);
    for (const bad of ['', '  ', 'no', 'x'.repeat(301)]) expect(code(await svc.withdrawPrice('a', bad, ACTOR, NOW).then(() => null, (e) => e))).toBe('PRICE_REASON_REQUIRED');
    expect(code(await svc.withdrawPrice('p', 'it is only proposed', ACTOR, NOW).then(() => null, (e) => e))).toBe('PRICE_NOT_APPROVED');
    expect((await svc.withdrawPrice('nope', 'does not exist', ACTOR, NOW).then(() => null, (e) => e) as { status?: number }).status).toBe(404);
    await svc.withdrawPrice('a', 'first withdrawal', ACTOR, NOW); await svc.withdrawPrice('a', 'second withdrawal', ACTOR, NOW);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
  it('only SUPER_ADMIN may withdraw', () => { expect(effectiveRolesFor('POST /v3/admin/prices/:priceId/withdraw')).toEqual(['SUPER_ADMIN']); });
});

describe('(4) the nine new prices become the prices in force', () => {
  it('proposed rows do not count; approving each (start now) puts them in force over the old rows, which stay as history', async () => {
    const old = row('old', { amountPaise: 100_000, effectiveFrom: day(-30) });
    const proposed = row('n', { status: 'PROPOSED', amountPaise: 224_700, effectiveFrom: NOW, createdAt: NOW });
    const { svc, rows } = make([old, proposed]);
    expect(term3(rows).price?.priceMinor).toBe(100_000);                       // proposing changes nothing
    await svc.approvePrice('n', { effectiveFrom: '2026-11-18' } as never, ACTOR, NOW);   // the admin screen sends today as a bare date
    expect(term3(rows).price?.priceMinor).toBe(224_700);
    expect(rows.filter((r) => r.status === 'APPROVED')).toHaveLength(2);
  });
});
