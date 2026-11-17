import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { RulesAdminService } from '../src/plans/admin/rules-admin.service';
import { checkGstChange, istDay, istDayStart } from '../src/plans/pricing/gst-rate-core';
import { selectTaxRate } from '../src/plans/pricing/price-quote';
import { PLAN_ERROR_CODES } from '../src/plans/plans.errors';
import { advance, SUPER } from './support/billing-world';
import { deliver, flow } from './support/wave3-world';

/** Wave 4 W7: the GST rate is set by the SUPER_ADMIN from an effective day, as a new row (history kept), audited; an order keeps the rate it was quoted with. */
const d = (iso: string): Date => new Date(iso);
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };
const NOW = d('2026-11-17T10:00:00Z');   // 15:30 on 17 Nov in India

describe('checkGstChange (pure)', () => {
  it('accepts a rate with up to 3 decimals, today or a later day, and a reason; today means "from now"', () => {
    expect(checkGstChange({ ratePercent: 18, reason: '  CA   confirmed ' }, NOW)).toEqual({ ok: true, value: { ratePercent: 18, validFrom: null, reason: 'CA confirmed' } });
    expect(checkGstChange({ ratePercent: 12.5, effectiveFrom: '2026-11-17', reason: 'same day' }, NOW)).toMatchObject({ ok: true, value: { validFrom: null } });
    const later = checkGstChange({ ratePercent: 0.125, effectiveFrom: '2026-12-01', reason: 'new year slab' }, NOW);
    expect(later).toMatchObject({ ok: true, value: { ratePercent: 0.125 } });
    if (later.ok) expect(later.value.validFrom!.toISOString()).toBe('2026-11-30T18:30:00.000Z');   // midnight India time
  });
  it('names the bad field: a rate outside 0 to 100, too many decimals, not a number; a past or unreal day; a missing reason', () => {
    for (const ratePercent of [-1, 100.5, 18.1234, '18', NaN, Infinity, null, undefined]) expect(checkGstChange({ ratePercent, reason: 'okay' }, NOW)).toMatchObject({ ok: false, fields: { ratePercent: expect.any(String) } });
    for (const effectiveFrom of ['2026-11-16', '2025-01-01', '2026-02-30', '17-11-2026', 20261120, {}]) expect(checkGstChange({ ratePercent: 18, effectiveFrom, reason: 'okay' }, NOW)).toMatchObject({ ok: false, fields: { effectiveFrom: expect.any(String) } });
    for (const reason of ['', 'ab', 'x'.repeat(301), undefined, 5]) expect(checkGstChange({ ratePercent: 18, reason }, NOW)).toMatchObject({ ok: false, fields: { reason: expect.any(String) } });
    expect(checkGstChange({}, NOW)).toMatchObject({ ok: false, fields: { ratePercent: expect.any(String), reason: expect.any(String) } });
  });
  it('zero is a rate (a nil-rated period), and today in India time is judged by the India day, not the UTC day', () => {
    expect(checkGstChange({ ratePercent: 0, reason: 'nil rated' }, NOW).ok).toBe(true);
    const lateUtc = d('2026-11-17T20:00:00Z');   // already 18 Nov 01:30 in India
    expect(istDay(lateUtc)).toBe('2026-11-18');
    expect(checkGstChange({ ratePercent: 18, effectiveFrom: '2026-11-17', reason: 'okay' }, lateUtc)).toMatchObject({ ok: false, fields: { effectiveFrom: 'cannot be in the past' } });
    expect(istDayStart('2026-02-29')).toBeNull(); expect(istDayStart('nope')).toBeNull();
  });
  it('the registered error codes exist', () => { for (const c of ['GST_RATE_INVALID', 'GST_RATE_EXISTS']) expect(PLAN_ERROR_CODES).toContain(c); });
});

// ───────────────────────────────────────────────────────────── the service, over a small in-memory tax table
interface TaxRow { id: string; name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: Date }
function world(seed: TaxRow[] = []) {
  const rows: TaxRow[] = seed.map((r) => ({ ...r })); const audits: Array<Record<string, unknown>> = []; let n = 0; let invalidated = 0;
  const tx = {
    v3TaxRate: {
      findMany: async (q?: { orderBy?: unknown }) => [...rows].sort((a, b) => (q?.orderBy ? b.validFrom.getTime() - a.validFrom.getTime() : 0)).map((r) => ({ ...r })),
      create: async (a: { data: Omit<TaxRow, 'id'> }) => { const r = { ...a.data, id: `t${++n}` }; rows.push(r); return { ...r }; },
      update: () => { throw new Error('a rate row must never be edited by this setting'); },
      updateMany: () => { throw new Error('a rate row must never be edited by this setting'); },
      delete: () => { throw new Error('a rate row must never be removed by this setting'); },
    },
  };
  const prisma = { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => { const snap = rows.map((r) => ({ ...r })); const a = audits.length; try { return await fn(tx); } catch (e) { rows.splice(0, rows.length, ...snap); audits.length = a; throw e; } } };
  const audit = { record: async (_t: unknown, actor: unknown, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) => { audits.push({ actor, action, entityType, entityId, before, after }); } };
  const svc = new RulesAdminService(prisma as never, audit as never, { invalidateAll: () => { invalidated++; } } as never);
  let t = NOW; svc.clock = () => t;
  return { svc, rows, audits, invalidated: () => invalidated, setNow: (x: Date) => { t = x; } };
}
const STAFF = { type: 'STAFF' as const, id: 'super-1', ip: '10.0.0.1' };
const seed18: TaxRow = { id: 'seed', name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: d('2026-01-01T00:00:00Z') };

describe('RulesAdminService.setGstRate / gstRate', () => {
  it('starts empty: no rate in force until the owner and the CA confirm one', async () => {
    const w = world();
    expect(await w.svc.gstRate()).toEqual({ inForce: null, upcoming: [], history: [] });
  });
  it('the first rate is a new row from now, audited with the reason, and the view shows it', async () => {
    const w = world();
    const r = await w.svc.setGstRate({ ratePercent: 18, reason: 'CA confirmed 18 percent' }, STAFF);
    expect(r).toMatchObject({ changed: true, inForce: { name: 'GST', ratePercent: 18 } });
    expect(w.rows).toHaveLength(1); expect(w.rows[0]).toMatchObject({ name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: NOW });
    expect(w.audits).toEqual([{ actor: STAFF, action: 'gst.rate.set', entityType: 'tax_rate', entityId: 't1', before: null, after: { ratePercent: 18, effectiveFrom: NOW, reason: 'CA confirmed 18 percent' } }]);
    expect(w.invalidated()).toBe(1);
  });
  it('a change is a NEW row: the old row is untouched, the history shows both, and the rate in force is the newest started one', async () => {
    const w = world([seed18]);
    const r = await w.svc.setGstRate({ ratePercent: 5, reason: 'rate cut notified' }, STAFF);
    expect(w.rows).toHaveLength(2); expect(w.rows[0]).toEqual(seed18);   // never edited
    expect(r.history.map((h) => h.ratePercent)).toEqual([5, 18]); expect(r.inForce).toMatchObject({ ratePercent: 5 });
    expect(w.audits[0]).toMatchObject({ before: { ratePercent: 18 }, after: { ratePercent: 5 } });
  });
  it('a future day is scheduled: it is listed as upcoming, and the rate in force does not change until then', async () => {
    const w = world([seed18]);
    const r = await w.svc.setGstRate({ ratePercent: 12, effectiveFrom: '2026-12-01', reason: 'new rate from December' }, STAFF);
    expect(r.inForce).toMatchObject({ ratePercent: 18 }); expect(r.upcoming).toHaveLength(1); expect(r.upcoming[0]).toMatchObject({ ratePercent: 12, effectiveFrom: d('2026-11-30T18:30:00Z') });
    w.setNow(d('2026-12-01T02:00:00Z'));   // 07:30 on 1 Dec India time
    expect((await w.svc.gstRate()).inForce).toMatchObject({ ratePercent: 12 });
    expect((await w.svc.gstRate()).upcoming).toEqual([]);
  });
  it('is idempotent: the same change again, or the rate already in force from that moment, adds nothing and audits nothing', async () => {
    const w = world([seed18]);
    expect(await w.svc.setGstRate({ ratePercent: 18, reason: 'confirming the rate' }, STAFF)).toMatchObject({ changed: false });
    await w.svc.setGstRate({ ratePercent: 12, effectiveFrom: '2026-12-01', reason: 'new rate from December' }, STAFF);
    const again = await w.svc.setGstRate({ ratePercent: 12, effectiveFrom: '2026-12-01', reason: 'retry of the same call' }, STAFF);
    expect(again.changed).toBe(false); expect(w.rows).toHaveLength(2); expect(w.audits).toHaveLength(1); expect(w.invalidated()).toBe(1);
  });
  it('a different rate on a day that already has a row is refused GST_RATE_EXISTS and changes nothing', async () => {
    const w = world([seed18]);
    await w.svc.setGstRate({ ratePercent: 12, effectiveFrom: '2026-12-01', reason: 'new rate from December' }, STAFF);
    expect(code(await err(w.svc.setGstRate({ ratePercent: 9, effectiveFrom: '2026-12-01', reason: 'a conflicting rate' }, STAFF)))).toBe('GST_RATE_EXISTS');
    expect(w.rows).toHaveLength(2); expect(w.audits).toHaveLength(1);
  });
  it('a bad request is GST_RATE_INVALID with the fields, and nothing is written', async () => {
    const w = world([seed18]);
    const e = await err(w.svc.setGstRate({ ratePercent: 140, effectiveFrom: '2020-01-01' }, STAFF));
    expect(code(e)).toBe('GST_RATE_INVALID'); expect((e as { getResponse: () => { details: { fields: object } } }).getResponse().details.fields).toMatchObject({ ratePercent: expect.any(String), effectiveFrom: expect.any(String), reason: expect.any(String) });
    expect(w.rows).toHaveLength(1); expect(w.audits).toHaveLength(0);
  });
  it('never edits or removes a row, however many changes are made', async () => {
    const w = world([seed18]);   // the fake throws if update, updateMany or delete is called
    for (const [rate, day] of [[12, '2026-12-01'], [5, '2027-01-01'], [18, '2027-02-01']] as const) await w.svc.setGstRate({ ratePercent: rate, effectiveFrom: day, reason: 'a scheduled change' }, STAFF);
    expect(w.rows.map((r) => r.ratePercent).sort((a, b) => a - b)).toEqual([5, 12, 18, 18]);
  });
});

// ───────────────────────────────────────────────────────────── what checkout does with it
describe('an order uses the rate in force when the order was made, and keeps it', () => {
  const rowFor = (r: TaxRow) => ({ name: r.name, ratePercent: r.ratePercent, appliesTo: r.appliesTo, active: r.active, validFrom: r.validFrom });
  it('the SAME selection checkout uses picks the new rate only from its effective moment', () => {
    const rows = [rowFor(seed18), rowFor({ ...seed18, id: 'n', ratePercent: 12, validFrom: d('2026-11-30T18:30:00Z') })];
    expect(selectTaxRate(rows, d('2026-11-30T18:29:59Z'))!.ratePercent).toBe(18);
    expect(selectTaxRate(rows, d('2026-11-30T18:30:00Z'))!.ratePercent).toBe(12);
  });

  it('end to end: orders before the change cost the old GST, orders after cost the new GST, and an order made before is settled at its OWN amount after the change', async () => {
    const f = flow('razorpay');
    f.w.repo.taxes.length = 0;
    const w = world([seed18]);
    const sync = async () => { f.w.repo.taxes.length = 0; for (const r of w.rows) f.w.repo.taxes.push({ name: r.name, ratePercent: r.ratePercent, appliesTo: r.appliesTo, active: r.active, validFrom: r.validFrom } as never); };
    w.setNow(new Date(f.w.now.t)); await sync();
    const before = await f.buy();                                   // 3 months, price book 300000, GST 18 percent
    expect(before.amountPaise).toBe(354_000);
    // the owner schedules 12 percent from the next day; the order above was already made
    await w.svc.setGstRate({ ratePercent: 12, effectiveFrom: '2026-11-06', reason: 'rate cut notified' }, SUPER); await sync();
    const sameDay = await f.buy({}, 'v2'); expect(sameDay.amountPaise).toBe(354_000);   // not yet in force
    advance(f.w, 24 * 3600); w.setNow(new Date(f.w.now.t));
    const after = await f.buy({}, 'v2'); expect(after.amountPaise).toBe(336_000);   // from the effective day: 300000 plus 12 percent
    expect(f.w.repo.orders.get(before.id)!.quote).toMatchObject({ taxRatePercent: 18, taxMinor: 54_000, totalMinor: 354_000 });
    // the first order is paid AFTER the change and is settled at the amount it was quoted with; its invoice carries the rate it was made at
    const hook = deliver(f, 'razorpay', before, { amountMinor: 354_000, paymentId: 'pay_gst_0001', eventId: 'evt_gst_00001' });
    expect(await f.settlement.handleGatewayWebhook('razorpay', hook.raw, hook.headers)).toMatchObject({ result: 'PAID' });
    expect(f.w.repo.orders.get(before.id)).toMatchObject({ status: 'PAID', amountPaise: 354_000, paidAmountPaise: 354_000 });
    expect(f.w.repo.invoices[0].taxBreakdown).toMatchObject({ ratePercent: 18, taxMinor: 54_000 });
  });
});

describe('who may set the GST rate: SUPER_ADMIN only; reading is OPERATIONS and SUPER_ADMIN', () => {
  const GET = 'GET /v3/admin/gst-rate'; const PUT = 'PUT /v3/admin/gst-rate';
  const principal = (adminRole?: string, over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(adminRole), ...over });
  const may = (u: AuthenticatedUser | undefined, key: string): boolean => {
    const [method, ...r] = key.split(' ');
    try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };
  it('the write is SUPER_ADMIN only: ADMIN and every other role is refused', () => {
    expect([...effectiveRolesFor(PUT)]).toEqual(['SUPER_ADMIN']); expect(may(principal('SUPER_ADMIN'), PUT)).toBe(true);
    for (const role of ['ADMIN', 'OPERATIONS', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) expect([role, may(principal(role), PUT)]).toEqual([role, false]);
    for (const u of [{ sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, { sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, undefined] as Array<AuthenticatedUser | undefined>) expect(may(u, PUT)).toBe(false);
  });
  it('the read is for OPERATIONS and SUPER_ADMIN (ADMIN inherits it); sales, support and the labels are refused', () => {
    expect([...effectiveRolesFor(GET)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']) expect([role, may(principal(role), GET)]).toEqual([role, true]);
    for (const role of ['MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) expect([role, may(principal(role), GET)]).toEqual([role, false]);
  });
});
