import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { validateSettingValue } from '../src/plans/admin/admin-validation';
import { checkPartnerInput, maskPan } from '../src/v3-partners/core/partner-core';
import { PartnersService } from '../src/v3-partners/partners.service';
import { checkTds, defaultTds } from '../src/v3-referrals/core/referral-core';
import { ReferralsService, StaffActor } from '../src/v3-referrals/referrals.service';
import { CommissionSettingsService, tdsBasisPoints, validateCommissionSetting } from '../src/v3-referrals/settings/commission-settings';
import { MemoryPartnersStore, MemoryReferralsStore } from './support/memory-referrals-store';

/**
 * Wave 4 W8: TDS on commission payouts. A payout records gross, TDS and net. The TDS percent is a SUPER_ADMIN setting that is EMPTY by default (no TDS until the CA gives the rate); the amount is pre-filled from it
 * and an ADMIN or SUPER_ADMIN may change it with a reason. The partner gets an optional PAN (staff write only). The app applies the percent it is given and computes no tax law.
 */
const d = (iso: string): Date => new Date(iso);
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const fieldsOf = (e: unknown): Record<string, string> => ((e as { getResponse: () => { details?: { fields?: Record<string, string> } } }).getResponse().details?.fields) ?? {};
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

// ───────────────────────────────────────────────────────────── pure
describe('defaultTds and checkTds (pure)', () => {
  it('the pre-filled amount is gross x percent, rounded to the nearest paisa; no percent means none', () => {
    expect(defaultTds(450_000, 1000)).toBe(45_000);    // 10 percent
    expect(defaultTds(100_001, 1000)).toBe(10_000);    // 10000.1 -> 10000
    expect(defaultTds(100_005, 1000)).toBe(10_001);    // 10000.5 -> 10001 (half up)
    expect(defaultTds(333_333, 200)).toBe(6_667);      // 2 percent
    expect(defaultTds(450_000, null)).toBe(0); expect(defaultTds(450_000, 0)).toBe(0); expect(defaultTds(0, 1000)).toBe(0);
    expect(defaultTds(1_000_000_000, 10_000)).toBe(1_000_000_000);   // large amounts stay exact
  });
  it('with nothing sent, the pre-filled amount is used and net = gross - tds', () => {
    expect(checkTds(450_000, 1000, {})).toEqual({ ok: true, tdsMinor: 45_000, netMinor: 405_000, edited: false, reason: null });
    expect(checkTds(450_000, null, {})).toEqual({ ok: true, tdsMinor: 0, netMinor: 450_000, edited: false, reason: null });
    expect(checkTds(450_000, 1000, { tdsMinor: null })).toMatchObject({ ok: true, tdsMinor: 45_000 });
  });
  it('sending the pre-filled amount again is not an edit and needs no reason', () => { expect(checkTds(450_000, 1000, { tdsMinor: 45_000 })).toMatchObject({ ok: true, edited: false, reason: null }); });
  it('changing the amount is an edit and needs a reason of 3 to 300 characters', () => {
    expect(checkTds(450_000, 1000, { tdsMinor: 30_000 })).toEqual({ ok: false, fields: { tdsReason: expect.any(String) } });
    for (const tdsReason of ['', 'ab', 'x'.repeat(301), 5, undefined]) expect(checkTds(450_000, 1000, { tdsMinor: 30_000, tdsReason })).toMatchObject({ ok: false, fields: { tdsReason: expect.any(String) } });
    expect(checkTds(450_000, 1000, { tdsMinor: 30_000, tdsReason: '  CA   lower   rate ' })).toEqual({ ok: true, tdsMinor: 30_000, netMinor: 420_000, edited: true, reason: 'CA lower rate' });
    expect(checkTds(450_000, null, { tdsMinor: 5_000, tdsReason: 'special case' })).toMatchObject({ ok: true, edited: true });   // no percent set, an admin still may deduct with a reason
    expect(checkTds(450_000, 1000, { tdsMinor: 0, tdsReason: 'exempt certificate' })).toMatchObject({ ok: true, tdsMinor: 0, netMinor: 450_000, edited: true });
  });
  it('TDS is whole paise, not negative, and leaves something to pay (below the gross)', () => {
    for (const tdsMinor of [-1, 1.5, '1000', NaN, 450_000, 450_001, Infinity]) expect(checkTds(450_000, 1000, { tdsMinor, tdsReason: 'a reason' })).toMatchObject({ ok: false, fields: { tdsMinor: expect.any(String) } });
    expect(checkTds(450_000, 1000, { tdsMinor: 449_999, tdsReason: 'a reason' })).toMatchObject({ ok: true, netMinor: 1 });
  });
});

describe('the tdsPercent setting', () => {
  it('is a percent from 0 to 100 with at most 2 decimals; anything else is refused', () => {
    for (const v of [0, 0.5, 10, 7.25, 100]) expect(() => validateCommissionSetting('tdsPercent', v)).not.toThrow();
    for (const v of [-1, 100.01, 7.255, '10', null, NaN, Infinity, undefined, true]) expect(() => validateCommissionSetting('tdsPercent', v)).toThrow(/tdsPercent/);
    expect(() => validateCommissionSetting('somethingElse', 1)).toThrow(/not a known plan setting/);
  });
  it('is reachable through the one plan-settings editing API (SUPER_ADMIN)', () => {
    expect(() => validateSettingValue('tdsPercent', 10)).not.toThrow(); expect(() => validateSettingValue('tdsPercent', 101)).toThrow();
    expect([...effectiveRolesFor('PUT /v3/admin/plan-settings/:key')]).toEqual(['SUPER_ADMIN']);
  });
  it('basis points: 10 percent is 1000, 0 and unset mean none', () => { expect(tdsBasisPoints(10)).toBe(1000); expect(tdsBasisPoints(7.25)).toBe(725); expect(tdsBasisPoints(0)).toBeNull(); expect(tdsBasisPoints(null)).toBeNull(); expect(tdsBasisPoints(undefined)).toBeNull(); });
  it('the service reads it: EMPTY by default, the stored percent when set, ignored when invalid; a change is seen after the short cache', async () => {
    let row: { valueJson: unknown } | null = null; let finds = 0;
    const svc = new CommissionSettingsService({ v3PlanSetting: { findUnique: async () => { finds++; return row; } } } as never);
    let t = 1_000; svc.clock = () => t;
    expect(await svc.tdsPercentBp()).toBeNull();
    row = { valueJson: 10 }; expect(await svc.tdsPercentBp()).toBeNull(); expect(finds).toBe(1);   // cached
    t += 6_000; expect(await svc.tdsPercentBp()).toBe(1000);
    row = { valueJson: 'ten' }; t += 6_000; expect(await svc.tdsPercentBp()).toBeNull();
    row = { valueJson: 0 }; t += 6_000; expect(await svc.tdsPercentBp()).toBeNull();
  });
});

describe('the partner PAN (pure and service)', () => {
  it('accepts a PAN in any case, trims it, stores it upper case; empty clears it; anything else is refused', () => {
    expect(checkPartnerInput({ pan: ' abcde1234f ' }, 'edit')).toEqual({ ok: true, value: { pan: 'ABCDE1234F' } });
    expect(checkPartnerInput({ pan: '' }, 'edit')).toEqual({ ok: true, value: { pan: null } }); expect(checkPartnerInput({ pan: null }, 'edit')).toEqual({ ok: true, value: { pan: null } });
    for (const pan of ['ABCDE1234', 'ABCD1234EF', '12345ABCDE', 'ABCDE1234FG', 5, {}, 'ABCDE-1234F']) expect(checkPartnerInput({ pan }, 'edit')).toMatchObject({ ok: false, problems: { pan: expect.any(String) } });
  });
  it('is optional: a partner can be created without one', () => { expect(checkPartnerInput({ type: 'FREELANCER', name: 'Asha', email: 'asha@partner.example' }, 'create')).toMatchObject({ ok: true }); });
  it('the partner sees only a masked form of their own: the first five characters hidden', () => { expect(maskPan('ABCDE1234F')).toBe('•••••1234F'); expect(maskPan(null)).toBeNull(); expect(maskPan('nope')).toBeNull(); });
  it('staff set and clear it through the admin partner routes, audited by field name only; the admin view shows it', async () => {
    const store = new MemoryPartnersStore(); const recorded: Array<Record<string, unknown>> = [];
    const svc = new PartnersService(store as never, { record: async (r: Record<string, unknown>) => { recorded.push(r); } } as never);
    const p = await svc.create({ type: 'FREELANCER', name: 'Asha', email: 'asha@partner.example', pan: 'abcde1234f' }, { id: 'admin-1' });
    expect(p.pan).toBe('ABCDE1234F');
    const e = await svc.update(p.id, { pan: 'PQRST6789U' }, { id: 'admin-1' });
    expect(e.pan).toBe('PQRST6789U'); expect((await svc.update(p.id, { pan: null }, { id: 'admin-1' })).pan).toBeNull();
    expect(JSON.stringify(recorded)).not.toMatch(/PQRST6789U|ABCDE1234F/);   // the audit names the field, never the number
    expect(recorded.filter((r) => r.actionKey === 'partner.updated').every((r) => (r.summary as { fields: string[] }).fields.includes('pan'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────── the service
function world(bp: number | null = null) {
  const partners = new MemoryPartnersStore(); const store = new MemoryReferralsStore();
  const recorded: Array<{ actionKey: string; summary?: Record<string, unknown> }> = [];
  const cfg = { bp };
  const svc = new ReferralsService(store, partners, { record: async (r: never) => { recorded.push(r); } } as never, { tdsPercentBp: async () => cfg.bp } as never);
  svc.clock = () => d('2026-12-05T10:00:00Z');
  const asha = partners.add({ name: 'Asha Referrals', email: 'asha@partner.example', pan: 'ABCDE1234F' });
  const ben = partners.add({ name: 'Ben Team', email: 'ben@partner.example' });
  const admin: StaffActor = { id: 'admin-1' };
  for (const id of ['v1', 'v2', 'v3']) store.addVendor({ id, state: 'Tamil Nadu' });
  return { store, partners, svc, recorded, cfg, asha, ben, admin };
}
type W = ReturnType<typeof world>;
async function closed(w: W, partner = w.asha, n = 3) {
  await w.svc.addSlab({ minVendors: 1, maxVendors: 2, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin);
  await w.svc.addSlab({ minVendors: 3, maxVendors: null, amountPerVendorMinor: 150_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin);
  for (let i = 1; i <= n; i++) { await w.svc.setAttribution(`v${i}`, partner.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId: `v${i}`, orderId: `o${i}`, paidAt: d(`2026-11-1${i}T10:00:00Z`), via: 'WEBHOOK' }); }
  await w.svc.closeMonth('2026-11', w.admin);
}
const pay = (w: W, extra: Record<string, unknown> = {}, partnerId = w.asha.id) => w.svc.recordPayout({ partnerId, month: '2026-11', reference: 'UTR-1234-5678', ...extra }, w.admin);

describe('recording a payout with TDS', () => {
  it('with no percent set there is NO TDS: gross = total, tds 0, net = gross', async () => {
    const w = world(null); await closed(w);
    expect(await pay(w)).toMatchObject({ totalMinor: 450_000, grossMinor: 450_000, tdsMinor: 0, netMinor: 450_000, tdsPercentBp: null, tdsEdited: false, tdsReason: null });
  });
  it('with a percent set the TDS is pre-filled from it and net = gross - tds; the percent in force is kept on the record', async () => {
    const w = world(1000); await closed(w);
    const p = await pay(w);
    expect(p).toMatchObject({ grossMinor: 450_000, tdsMinor: 45_000, netMinor: 405_000, tdsPercentBp: 1000, tdsEdited: false });
    expect(p.totalMinor).toBe(p.grossMinor);
    w.cfg.bp = 500;   // a later change of the percent never rewrites a recorded payout
    expect(w.store.payouts[0]).toMatchObject({ tdsMinor: 45_000, tdsPercentBp: 1000 });
  });
  it('an ADMIN may change the amount with a reason: it is stored, flagged as changed, and audited', async () => {
    const w = world(1000); await closed(w);
    const p = await pay(w, { tdsMinor: 30_000, tdsReason: 'CA certificate for a lower rate' });
    expect(p).toMatchObject({ tdsMinor: 30_000, netMinor: 420_000, tdsEdited: true, tdsReason: 'CA certificate for a lower rate', tdsPercentBp: 1000 });
    expect(w.recorded.find((r) => r.actionKey === 'commission.payout.recorded')!.summary).toMatchObject({ grossMinor: 450_000, tdsMinor: 30_000, netMinor: 420_000, tdsEdited: true, tdsReason: 'CA certificate for a lower rate' });
  });
  it('a changed amount without a reason, a negative one, a fractional one, or one that is the whole gross is refused with the fields, and nothing is recorded', async () => {
    const w = world(1000); await closed(w);
    expect(code(await err(pay(w, { tdsMinor: 30_000 })))).toBe('COMMISSION_PAYOUT_INVALID');
    expect(fieldsOf(await err(pay(w, { tdsMinor: 30_000 })))).toEqual({ tdsReason: expect.any(String) });
    expect(fieldsOf(await err(pay(w, { tdsMinor: -1, tdsReason: 'a reason' })))).toEqual({ tdsMinor: expect.any(String) });
    expect(fieldsOf(await err(pay(w, { tdsMinor: 12.5, tdsReason: 'a reason' })))).toEqual({ tdsMinor: expect.any(String) });
    expect(fieldsOf(await err(pay(w, { tdsMinor: 450_000, tdsReason: 'a reason' })))).toEqual({ tdsMinor: expect.any(String) });
    expect(w.store.payouts).toHaveLength(0); expect(w.store.lines.every((l) => l.status === 'APPROVED')).toBe(true);
  });
  it('the app does not need a PAN to record, and adds no rule of its own: a partner without a PAN is paid the same way', async () => {
    const w = world(1000); await closed(w, w.ben);
    expect(await pay(w, {}, w.ben.id)).toMatchObject({ tdsMinor: 45_000, netMinor: 405_000 });
  });
  it('a payout is still once per partner and month, and an adjustment netted in the month is inside the gross', async () => {
    const w = world(1000); await closed(w); await pay(w);
    expect(code(await err(pay(w)))).toBe('COMMISSION_PAYOUT_EXISTS');
    const w2 = world(1000); await closed(w2);
    Object.assign(w2.store.lines[0], { status: 'PAID' });   // an earlier payout of one line, then reversed after: the adjustment nets against the month
    expect((await w2.svc.previewPayout({ partnerId: w2.asha.id, month: '2026-11' }))).toMatchObject({ grossMinor: 300_000, tdsMinor: 30_000, netMinor: 270_000 });
  });
});

describe('the payout preview (pre-fill)', () => {
  it('shows gross, the percent in force, the pre-filled TDS, the net, and whether a PAN is on record, never the PAN', async () => {
    const w = world(1000); await closed(w);
    const v = await w.svc.previewPayout({ partnerId: w.asha.id, month: '2026-11' });
    expect(v).toEqual({ alreadyRecorded: false, grossMinor: 450_000, tdsPercentBp: 1000, tdsMinor: 45_000, netMinor: 405_000, lines: 3, panOnRecord: true });
    expect(JSON.stringify(v)).not.toContain('ABCDE1234F');
    const w2 = world(null); await closed(w2, w2.ben);
    expect(await w2.svc.previewPayout({ partnerId: w2.ben.id, month: '2026-11' })).toMatchObject({ tdsPercentBp: null, tdsMinor: 0, netMinor: 450_000, panOnRecord: false });
  });
  it('changes nothing, and refuses like a payout: bad month, unknown partner, month not closed, nothing to pay; shows a recorded payout', async () => {
    const w = world(1000);
    expect(code(await err(w.svc.previewPayout({ partnerId: w.asha.id, month: '2026-13' })))).toBe('COMMISSION_MONTH_INVALID');
    expect(code(await err(w.svc.previewPayout({ partnerId: 'nope', month: '2026-11' })))).toBe('REFERRAL_LINK_NOT_FOUND');
    expect(code(await err(w.svc.previewPayout({ partnerId: w.asha.id, month: '2026-11' })))).toBe('COMMISSION_NOTHING_TO_PAY');
    await closed(w);
    await w.svc.previewPayout({ partnerId: w.asha.id, month: '2026-11' }); expect(w.store.payouts).toHaveLength(0);
    const p = await pay(w);
    expect(await w.svc.previewPayout({ partnerId: w.asha.id, month: '2026-11' })).toMatchObject({ alreadyRecorded: true, payout: { id: p.id } });
  });
});

describe('what the partner and the owner see', () => {
  it('the partner sees gross, TDS and net of their own payouts; not the reason, not the percent, not the PAN', async () => {
    const w = world(1000); await closed(w); await pay(w, { tdsMinor: 30_000, tdsReason: 'CA certificate for a lower rate' });
    const mine = await w.svc.myPayouts(w.asha.id, 0, 25);
    expect(mine.items).toEqual([{ month: '2026-11', grossMinor: 450_000, tdsMinor: 30_000, netMinor: 420_000, totalMinor: 450_000, status: 'PAID', reference: 'UTR-1234-5678', paidAt: expect.any(Date) }]);
    expect(JSON.stringify(mine)).not.toMatch(/CA certificate|tdsReason|tdsPercent|ABCDE1234F|tdsEdited/);
    expect((await w.svc.myPayouts(w.ben.id, 0, 25)).total).toBe(0);   // another partner sees none of it
  });
  it('the payouts CSV has gross, percent, TDS, net, whether changed and why, and the PAN; a typed formula is defused', async () => {
    const w = world(1000); await closed(w); w.asha.name = '=HYPERLINK("x")'; await pay(w, { tdsMinor: 30_000, tdsReason: 'CA certificate for a lower rate' });
    const rows = (await w.svc.payoutsCsv({})).trim().split('\r\n');
    expect(rows[0]).toBe('month,partner,partnerId,pan,reference,grossRupees,tdsPercent,tdsRupees,netRupees,tdsChanged,tdsReason,paidAt');
    expect(rows).toHaveLength(2);
    const cells = rows[1];
    expect(cells).toContain('ABCDE1234F'); expect(cells).toContain('4500.00'); expect(cells).toContain('10.00'); expect(cells).toContain('300.00'); expect(cells).toContain('4200.00'); expect(cells).toContain(',yes,');
    expect(cells).toContain('CA certificate for a lower rate'); expect(cells).toContain("\"'=HYPERLINK"); expect(cells).not.toMatch(/,=HYPERLINK/);
    const none = world(null); await closed(none); await pay(none);
    const r2 = (await none.svc.payoutsCsv({})).trim().split('\r\n')[1];
    expect(r2).toContain('4500.00'); expect(r2).toContain(',0.00,4500.00,no,');
    expect((await w.svc.payoutsCsv({ month: '2027-01' })).trim().split('\r\n')).toHaveLength(1);   // header only
  });
  it('the admin list carries gross, TDS and net', async () => {
    const w = world(1000); await closed(w); await pay(w);
    expect((await w.svc.payouts({ skip: 0, take: 10 })).items[0]).toMatchObject({ grossMinor: 450_000, tdsMinor: 45_000, netMinor: 405_000 });
  });
});

describe('who may see the preview and the payouts CSV', () => {
  const PREVIEW = 'GET /v3/admin/commission/payouts/preview'; const CSV = 'GET /v3/admin/commission/payouts/export.csv'; const RECORD = 'POST /v3/admin/commission/payouts';
  const principal = (adminRole?: string): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(adminRole) });
  const may = (u: AuthenticatedUser | undefined, key: string): boolean => {
    const [method, ...r] = key.split(' ');
    try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };
  it('the CSV (it carries the PAN) is ADMIN and SUPER_ADMIN only; OPERATIONS, sales, support and the labels are refused', () => {
    expect([...effectiveRolesFor(CSV)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
    for (const role of ['ADMIN', 'SUPER_ADMIN']) expect(may(principal(role), CSV)).toBe(true);
    for (const role of ['OPERATIONS', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) expect([role, may(principal(role), CSV)]).toEqual([role, false]);
    expect(may({ sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, CSV)).toBe(false);
  });
  it('the preview is read by OPERATIONS, ADMIN and SUPER_ADMIN (it holds no PAN); sales, support and the labels are refused', () => {
    expect([...effectiveRolesFor(PREVIEW)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    for (const role of ['MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) expect([role, may(principal(role), PREVIEW)]).toEqual([role, false]);
  });
  it('recording a payout (and so changing the TDS amount) stays ADMIN and SUPER_ADMIN only', () => { expect([...effectiveRolesFor(RECORD)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']); });
});
