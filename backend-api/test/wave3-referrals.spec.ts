import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthService } from '../src/auth/auth.service';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { PartnersService } from '../src/v3-partners/partners.service';
import { PartnerGuard } from '../src/v3-partners/partner.guard';
import { PartnerReferralsController, PublicReferralController } from '../src/v3-referrals/api/referrals.controllers';
import { closeMonth, codeFromBytes, CODE_ALPHABET, csvCell, isMonth, isSelfReferral, Line, monthEnd, monthOf, normaliseCode, payoutTotal, rupeesText, Slab, slabFor, slabProblems, toCsv } from '../src/v3-referrals/core/referral-core';
import { ReferralsService, StaffActor } from '../src/v3-referrals/referrals.service';
import { SUPER, VENDOR } from './support/billing-world';
import { MemoryPartnersStore, MemoryReferralsStore } from './support/memory-referrals-store';
import { flow } from './support/wave3-world';

/** Wave 3 Part I: attribution (first touch wins), self-referral, slab tiers, month close, payouts, reversal, and what a partner can see. */
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };
const d = (iso: string): Date => new Date(iso);
const slab = (id: string, min: number, max: number | null, amount: number, from = '2026-01-01T00:00:00Z'): Slab => ({ id, minVendors: min, maxVendors: max, amountPerVendorMinor: amount, effectiveFrom: d(from) });

describe('codes (pure)', () => {
  it('make 8 symbols from the alphabet with no look-alike characters, and nothing else', () => {
    const c = codeFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))!;
    expect(c).toHaveLength(8); expect(c).toMatch(/^[A-Z2-9]{8}$/); expect(c).not.toMatch(/[01ILOU]/);
    expect(CODE_ALPHABET).toHaveLength(30); for (const bad of '01ILOU') expect(CODE_ALPHABET).not.toContain(bad);
  });
  it('skip a byte that would bias the choice and return null when the bytes run out', () => {
    expect(codeFromBytes(Uint8Array.from([255, 254, 253, 252, 251, 250, 249, 248, 247, 246]))).toBeNull();   // all above the unbiased limit
    expect(codeFromBytes(Uint8Array.from([0, 1, 2]))).toBeNull();
    expect(codeFromBytes(Uint8Array.from([255, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('AAAAAAAA');
  });
  it('normalise: trimmed and upper case, or null for anything not shaped like a code', () => {
    expect(normaliseCode('  k7m2p9qx ')).toBe('K7M2P9QX');
    for (const bad of ['', 'ab', 'K7M2P9Q0', 'has space1', 'x'.repeat(13), null, 5, undefined, "K7M2'--;P9"]) expect(normaliseCode(bad)).toBeNull();
  });
});

describe('self referral (pure)', () => {
  it('matches the same email in any case and the same phone however it is written', () => {
    expect(isSelfReferral({ email: 'Asha@Example.com' }, { email: ' asha@example.com ' })).toBe(true);
    expect(isSelfReferral({ phone: '+91 98765 43210' }, { phone: '09876543210' })).toBe(true);
    expect(isSelfReferral({ phone: '98765-43210' }, { phone: '+919876543210' })).toBe(true);
  });
  it('never matches on empty or short values, or different people', () => {
    expect(isSelfReferral({ email: '', phone: '' }, { email: '', phone: '' })).toBe(false);
    expect(isSelfReferral({ email: null, phone: null }, { email: null, phone: null })).toBe(false);
    expect(isSelfReferral({ phone: '12345' }, { phone: '12345' })).toBe(false);
    expect(isSelfReferral({ email: 'a@x.com', phone: '9876543210' }, { email: 'b@x.com', phone: '9123456789' })).toBe(false);
  });
});

describe('months in India time (pure)', () => {
  it('a payment at 23:59:59 IST on the last day belongs to that month; one second later to the next', () => {
    expect(monthOf(d('2026-11-30T18:29:59Z'))).toBe('2026-11'); expect(monthOf(d('2026-11-30T18:30:00Z'))).toBe('2026-12');
    expect(monthOf(d('2026-12-31T18:30:00Z'))).toBe('2027-01'); expect(monthOf(d('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
  it('the end of a month is midnight India time of the next', () => {
    expect(monthEnd('2026-11').toISOString()).toBe('2026-11-30T18:30:00.000Z'); expect(monthEnd('2026-12').toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });
  it('isMonth accepts YYYY-MM only', () => { for (const m of ['2026-11', '2026-01', '1999-12']) expect(isMonth(m)).toBe(true); for (const m of ['2026-13', '2026-00', '2026-1', '26-11', '2026-11-01', '', null, 202611]) expect(isMonth(m)).toBe(false); });
});

describe('slabs (pure)', () => {
  it('check a row: whole numbers, a real range, a positive amount, a date, and no overlap on one date', () => {
    const ok = { minVendors: 1, maxVendors: 4, amountPerVendorMinor: 50000, effectiveFrom: '2026-01-01T00:00:00Z' };
    expect(slabProblems(ok, [])).toEqual([]);
    expect(slabProblems({ ...ok, minVendors: 0 }, [])).toContain('MIN_INVALID'); expect(slabProblems({ ...ok, minVendors: 1.5 }, [])).toContain('MIN_INVALID');
    expect(slabProblems({ ...ok, maxVendors: 0 }, [])).toContain('MAX_INVALID'); expect(slabProblems({ ...ok, maxVendors: null }, [])).toEqual([]);
    for (const a of [0, -1, 1.5, '500', null]) expect(slabProblems({ ...ok, amountPerVendorMinor: a }, [])).toContain('AMOUNT_INVALID');
    for (const f of ['', 'soon', null, undefined]) expect(slabProblems({ ...ok, effectiveFrom: f }, [])).toContain('DATE_INVALID');
    expect(slabProblems(ok, [slab('a', 3, 6, 1)], undefined)).toContain('OVERLAP');
    expect(slabProblems({ ...ok, minVendors: 5, maxVendors: null }, [slab('a', 1, 4, 1)])).toEqual([]);
    expect(slabProblems(ok, [slab('a', 3, 6, 1, '2026-06-01T00:00:00Z')])).toEqual([]);   // a later date replaces a set; it does not overlap it
    expect(slabProblems(ok, [slab('a', 1, 4, 1)], 'a')).toEqual([]);   // a row never overlaps itself when edited
  });
  it('pick the row that holds the count, from the LATEST effective date on or before the month end only', () => {
    const rows = [slab('a1', 1, 4, 100, '2026-01-01T00:00:00Z'), slab('a2', 5, null, 200, '2026-01-01T00:00:00Z'), slab('b1', 1, 2, 300, '2026-07-01T00:00:00Z'), slab('b2', 3, null, 400, '2026-07-01T00:00:00Z')];
    const jun = monthEnd('2026-06'); const aug = monthEnd('2026-08');
    expect([slabFor(rows, 1, jun)!.id, slabFor(rows, 4, jun)!.id, slabFor(rows, 5, jun)!.id, slabFor(rows, 99, jun)!.id]).toEqual(['a1', 'a1', 'a2', 'a2']);
    expect([slabFor(rows, 1, aug)!.id, slabFor(rows, 3, aug)!.id]).toEqual(['b1', 'b2']);   // the newer set replaces the older one whole
    expect(slabFor(rows, 1, d('2025-12-01T00:00:00Z'))).toBeNull();   // nothing in force yet
    expect(slabFor([slab('x', 2, 3, 1)], 1, aug)).toBeNull();   // a count no row holds
    expect(slabFor([], 1, aug)).toBeNull();
  });
});

const L = (id: string, partnerId: string, month: string, status: Line['status'] = 'ACCRUED', amountMinor: number | null = null): Line => ({ id, partnerId, vendorId: `v-${id}`, month, status, amountMinor });
describe('closing a month (pure)', () => {
  const slabs = [slab('s1', 1, 2, 100_000), slab('s2', 3, 5, 150_000), slab('s3', 6, null, 200_000)];
  it('the count of the month picks the amount per vendor, and every vendor of that partner gets it', () => {
    const lines = [L('a', 'p1', '2026-11'), L('b', 'p1', '2026-11'), L('c', 'p1', '2026-11'), L('d', 'p2', '2026-11')];
    const r = closeMonth('2026-11', lines, slabs);
    expect(r.noSlabs).toBe(false);
    expect(r.partners).toEqual([{ partnerId: 'p1', count: 3, perVendorMinor: 150_000, totalMinor: 450_000, adjustmentMinor: 0, carriedMinor: 0 }, { partnerId: 'p2', count: 1, perVendorMinor: 100_000, totalMinor: 100_000, adjustmentMinor: 0, carriedMinor: 0 }]);
    expect(r.approve).toEqual([{ id: 'a', amountMinor: 150_000 }, { id: 'b', amountMinor: 150_000 }, { id: 'c', amountMinor: 150_000 }, { id: 'd', amountMinor: 100_000 }]);
  });
  it('the more a partner converts, the higher the amount per vendor', () => {
    const per = (n: number) => closeMonth('2026-11', Array.from({ length: n }, (_, i) => L(`x${i}`, 'p', '2026-11')), slabs).partners[0].perVendorMinor;
    expect([per(1), per(2), per(3), per(5), per(6), per(40)]).toEqual([100_000, 100_000, 150_000, 150_000, 200_000, 200_000]);
  });
  it('a reversed line does not count toward the tier and gets nothing; other months are untouched', () => {
    const lines = [L('a', 'p', '2026-11'), L('b', 'p', '2026-11'), L('c', 'p', '2026-11', 'REVERSED'), L('z', 'p', '2026-10')];
    const r = closeMonth('2026-11', lines, slabs);
    expect(r.partners[0]).toMatchObject({ count: 2, perVendorMinor: 100_000 }); expect(r.approve.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('is idempotent: lines already APPROVED or PAID are never touched, so a repeat approves nothing', () => {
    const lines = [L('a', 'p', '2026-11', 'APPROVED', 100_000), L('b', 'p', '2026-11', 'PAID', 100_000)];
    const r = closeMonth('2026-11', lines, slabs);
    expect(r.approve).toEqual([]); expect(r.partners[0]).toMatchObject({ count: 2, perVendorMinor: 100_000, totalMinor: 200_000 });
  });
  it('with no slab rows in force nothing accrues, the lines stay with no amount, and the answer says so', () => {
    const r = closeMonth('2026-11', [L('a', 'p', '2026-11')], []);
    expect(r).toMatchObject({ noSlabs: true, approve: [], partners: [{ partnerId: 'p', count: 1, perVendorMinor: null, totalMinor: null }] });
    expect(closeMonth('2026-11', [L('a', 'p', '2026-11')], [slab('late', 1, null, 1, '2027-01-01T00:00:00Z')]).noSlabs).toBe(true);   // a row that is not in force yet
  });
  it('a month with no lines gives an empty answer', () => { expect(closeMonth('2026-11', [], slabs)).toEqual({ month: '2026-11', noSlabs: false, approve: [], partners: [] }); });
  it('a payout is the sum of the APPROVED lines of one partner and month only', () => {
    const lines = [L('a', 'p', '2026-11', 'APPROVED', 100), L('b', 'p', '2026-11', 'APPROVED', 250), L('c', 'p', '2026-11', 'PAID', 999), L('d', 'p', '2026-11', 'REVERSED', 999), L('e', 'q', '2026-11', 'APPROVED', 7), L('f', 'p', '2026-10', 'APPROVED', 7)];
    expect(payoutTotal(lines, 'p', '2026-11')).toEqual({ lineIds: ['a', 'b'], totalMinor: 350 });
  });
});

describe('CSV (pure)', () => {
  it('quotes what needs it and defuses a typed formula', () => {
    expect(csvCell('plain')).toBe('plain'); expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('say "hi"')).toBe('"say ""hi"""'); expect(csvCell(null)).toBe(''); expect(csvCell(42)).toBe('42');
    expect(csvCell('-2')).toBe('-2');   // Wave 4: a plain negative number (an adjustment amount) is not a formula
    for (const f of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx']) expect(csvCell(f).startsWith("'") || csvCell(f).startsWith('"\'')).toBe(true);
    expect(toCsv(['a', 'b'], [[1, '=x'], ['y,z', null]])).toBe("a,b\r\n1,'=x\r\n\"y,z\",\r\n");
  });
  it('writes paise as rupees without a float', () => { expect(rupeesText(150000)).toBe('1500.00'); expect(rupeesText(5)).toBe('0.05'); expect(rupeesText(null)).toBe(''); });
});

// ─────────────────────────────────────────────────────────────────────────────────── the service
function world() {
  const partners = new MemoryPartnersStore(); const store = new MemoryReferralsStore();
  const recorded: Array<{ actionKey: string; actor: { type: string; id: string | null } }> = [];
  const svc = new ReferralsService(store, partners, { record: async (r: never) => { recorded.push(r); } } as never);
  let t = d('2026-11-10T10:00:00Z'); svc.clock = () => t;
  let seed = 0; svc.draw = (n) => Uint8Array.from({ length: n }, (_, i) => (seed + i * 7 + 3) % 250);
  const asha = partners.add({ name: 'Asha Referrals', email: 'asha@partner.example', phone: '+91 98765 43210' });
  const ben = partners.add({ name: 'Ben Team', email: 'ben@partner.example', type: 'SALES_TEAM' });
  const admin: StaffActor = { id: 'admin-1' }; const sup: StaffActor = { id: 'sup-1' };
  for (const id of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) store.addVendor({ id, state: 'Tamil Nadu' });
  return { partners, store, svc, recorded, asha, ben, admin, sup, setNow: (x: Date) => { t = x; }, bump: () => { seed += 13; } };
}
type W = ReturnType<typeof world>;
const link = async (w: W, partnerId = w.asha.id) => w.svc.issueLink(partnerId, w.admin);

describe('links and codes', () => {
  it('issues a unique code for an active partner, audited; a disabled partner cannot be given one', async () => {
    const w = world(); const a = await link(w); w.bump(); const b = await link(w);
    expect(a.code).toMatch(/^[A-Z2-9]{8}$/); expect(b.code).not.toBe(a.code);
    expect(w.recorded.filter((r) => r.actionKey === 'referral.link.issued')).toHaveLength(2);
    w.asha.status = 'DISABLED';
    expect(code(await err(w.svc.issueLink(w.asha.id, w.admin)))).toBe('REFERRAL_PARTNER_INACTIVE');
    expect(code(await err(w.svc.issueLink('nope', w.admin)))).toBe('REFERRAL_LINK_NOT_FOUND');
  });
  it('draws again when a code is already taken, and gives up plainly when it cannot', async () => {
    const w = world(); await link(w);
    w.svc.draw = (() => { let n = 0; return (len: number) => (n++ === 0 ? Uint8Array.from({ length: len }, (_, i) => (0 + i * 7 + 3) % 250) : Uint8Array.from({ length: len }, (_, i) => (100 + i * 11) % 250)); })();
    expect((await link(w, w.ben.id)).partnerId).toBe(w.ben.id);
    w.svc.draw = (len) => Uint8Array.from({ length: len }, () => 255);   // never a usable byte
    expect(code(await err(link(w)))).toBe('REFERRAL_CODE_FAILED');
  });
  it('resolves a code to validity and the source NAME only; a disabled code, a disabled partner and rubbish are all just invalid', async () => {
    const w = world(); const l = await link(w);
    expect(await w.svc.resolveCode(l.code)).toEqual({ valid: true, source: 'Asha Referrals' });
    expect(await w.svc.resolveCode(l.code.toLowerCase())).toEqual({ valid: true, source: 'Asha Referrals' });
    expect(Object.keys(await w.svc.resolveCode(l.code)).sort()).toEqual(['source', 'valid']);
    for (const bad of ['NOPE2222', '', 'x', null, undefined, "'; DROP"]) expect(await w.svc.resolveCode(bad)).toEqual({ valid: false });
    w.asha.status = 'DISABLED'; expect(await w.svc.resolveCode(l.code)).toEqual({ valid: false }); w.asha.status = 'ACTIVE';
    await w.svc.disableLink(l.id, w.admin); expect(await w.svc.resolveCode(l.code)).toEqual({ valid: false });
    expect(code(await err(w.svc.disableLink('nope', w.admin)))).toBe('REFERRAL_LINK_NOT_FOUND');
    expect(await w.svc.myLinks(w.asha.id)).toEqual([]);   // a disabled code is not shown to the partner
  });
});

describe('attribution: first touch wins', () => {
  it('a vendor who registers with a code is attributed; a second code later changes nothing', async () => {
    const w = world(); const a = await link(w); w.bump(); const b = await link(w, w.ben.id);
    await w.svc.attributeAtRegistration({ vendorId: 'v1', code: a.code });
    await w.svc.attributeAtRegistration({ vendorId: 'v1', code: b.code });
    expect(w.store.attributions).toHaveLength(1); expect(w.store.attributions[0]).toMatchObject({ vendorId: 'v1', partnerId: w.asha.id, source: 'REGISTER', linkId: a.id });
    expect((await w.svc.sourceOf('v1'))).toMatchObject({ partner: { id: w.asha.id, name: 'Asha Referrals', type: 'FREELANCER' }, source: 'REGISTER', code: a.code });
    expect(await w.svc.sourceOf('v2')).toBeNull();
  });
  it('a partner cannot refer his own business: a matching email or phone records nothing', async () => {
    const w = world(); const a = await link(w);
    w.store.addVendor({ id: 'own1', email: 'ASHA@partner.example' }); w.store.addVendor({ id: 'own2', phone: '09876543210' });
    await w.svc.attributeAtRegistration({ vendorId: 'own1', code: a.code }); await w.svc.attributeAtRegistration({ vendorId: 'own2', code: a.code });
    expect(w.store.attributions).toEqual([]);
  });
  it('a bad code, a disabled code, a disabled partner or an unknown vendor records nothing and never raises', async () => {
    const w = world(); const a = await link(w);
    await w.svc.attributeAtRegistration({ vendorId: 'v1', code: 'ZZZZZZZZ' }); await w.svc.attributeAtRegistration({ vendorId: 'v1', code: 'bad' }); await w.svc.attributeAtRegistration({ vendorId: 'ghost', code: a.code });
    await w.svc.disableLink(a.id, w.admin); await w.svc.attributeAtRegistration({ vendorId: 'v1', code: a.code });
    const b = await (async () => { w.bump(); return link(w, w.ben.id); })(); w.ben.status = 'DISABLED'; await w.svc.attributeAtRegistration({ vendorId: 'v2', code: b.code });
    expect(w.store.attributions).toEqual([]);
    w.store.failNext = true; await expect(w.svc.attributeAtRegistration({ vendorId: 'v3', code: b.code })).resolves.toBeUndefined();
  });
  it('staff set the referrer of a business with none (ON_BEHALF); setting again is refused for everyone, because changing is its own SUPER_ADMIN action with a reason, audited', async () => {
    const w = world();
    const first = await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin);
    expect(first).toMatchObject({ source: 'ON_BEHALF', partnerId: w.asha.id, setById: 'admin-1' });
    expect(code(await err(w.svc.setAttribution('v1', w.ben.id, 'moving it', w.admin)))).toBe('REFERRAL_ATTRIBUTION_EXISTS');
    expect(code(await err(w.svc.setAttribution('v1', w.ben.id, 'moving it', w.sup)))).toBe('REFERRAL_ATTRIBUTION_EXISTS');
    expect(w.store.attributions[0].partnerId).toBe(w.asha.id);
    expect(code(await err(w.svc.changeAttribution('v1', w.ben.id, undefined, w.sup)))).toBe('REFERRAL_ATTRIBUTION_INVALID');
    expect(code(await err(w.svc.changeAttribution('v1', w.ben.id, 'x', w.sup)))).toBe('REFERRAL_ATTRIBUTION_INVALID');
    expect(code(await err(w.svc.changeAttribution('v2', w.ben.id, 'no referrer yet here', w.sup)))).toBe('REFERRAL_ATTRIBUTION_INVALID');
    const changed = await w.svc.changeAttribution('v1', w.ben.id, 'the first source was wrong', w.sup);
    expect(changed).toMatchObject({ partnerId: w.ben.id, source: 'ADMIN_CHANGE', reason: 'the first source was wrong' });
    expect(w.recorded.find((r) => r.actionKey === 'referral.attribution.changed')).toMatchObject({ actor: { type: 'STAFF', id: 'sup-1' } });
    expect(await w.svc.changeAttribution('v1', w.ben.id, 'again please', w.sup)).toMatchObject({ partnerId: w.ben.id });   // the same source again changes nothing
    expect(w.recorded.filter((r) => r.actionKey === 'referral.attribution.changed')).toHaveLength(1);
  });
  it('staff cannot set a partner on his own business, a disabled partner, an unknown vendor or an unknown partner', async () => {
    const w = world(); w.store.addVendor({ id: 'own', email: 'asha@partner.example' });
    expect(code(await err(w.svc.setAttribution('own', w.asha.id, undefined, w.sup)))).toBe('REFERRAL_SELF_REFERRAL');
    w.ben.status = 'DISABLED'; expect(code(await err(w.svc.setAttribution('v1', w.ben.id, undefined, w.sup)))).toBe('REFERRAL_PARTNER_INACTIVE');
    expect(code(await err(w.svc.setAttribution('ghost', w.asha.id, undefined, w.sup)))).toBe('REFERRAL_VENDOR_NOT_FOUND');
    expect(code(await err(w.svc.setAttribution('v1', 'nope', undefined, w.sup)))).toBe('REFERRAL_LINK_NOT_FOUND');
    expect(w.store.attributions).toEqual([]);
  });
});

describe('the ledger: a vendor counts once, on the first paid plan payment', () => {
  const paid = (w: W, vendorId: string, orderId: string, at = '2026-11-10T10:00:00Z') => w.svc.onPlanPaid({ vendorId, orderId, paidAt: d(at), via: 'WEBHOOK' });
  it('makes ONE line in the month of the payment (India time) and none for a vendor with no referrer', async () => {
    const w = world(); await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin);
    await paid(w, 'v1', 'o1', '2026-11-30T18:29:00Z'); await paid(w, 'v2', 'o2');
    expect(w.store.lines).toHaveLength(1); expect(w.store.lines[0]).toMatchObject({ partnerId: w.asha.id, vendorId: 'v1', month: '2026-11', orderId: 'o1', status: 'ACCRUED', amountMinor: null, flagged: false });
    expect(w.recorded.some((r) => r.actionKey === 'commission.line.accrued' && r.actor.type === 'SYSTEM')).toBe(true);
  });
  it('the second payment, a renewal, a repeat and a duplicate event never make a second line', async () => {
    const w = world(); await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin);
    await paid(w, 'v1', 'o1'); await paid(w, 'v1', 'o1'); await paid(w, 'v1', 'o2', '2026-12-20T10:00:00Z'); await paid(w, 'v1', 'o3', '2027-11-20T10:00:00Z');
    expect(w.store.lines).toHaveLength(1); expect(w.store.lines[0].orderId).toBe('o1'); expect(w.store.lines[0].month).toBe('2026-11');
  });
  it('a failure never reaches the payment', async () => {
    const w = world(); await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin);
    w.store.failNext = true; await expect(paid(w, 'v1', 'o1')).resolves.toBeUndefined();
  });
  it('a reversed payment marks the line REVERSED and flags it for the owner; a paid-out line stays PAID and gets an adjustment; another order or an unknown vendor changes nothing', async () => {
    const w = world(); await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin); await w.svc.setAttribution('v2', w.asha.id, undefined, w.admin);
    await paid(w, 'v1', 'o1'); await paid(w, 'v2', 'o2');
    await w.svc.onPaymentReversed({ vendorId: 'v1', orderId: 'other', reason: 'refund recorded' }); await w.svc.onPaymentReversed({ vendorId: 'ghost', orderId: 'o1', reason: 'x' });
    expect(w.store.lines.map((l) => l.status)).toEqual(['ACCRUED', 'ACCRUED']);
    await w.svc.onPaymentReversed({ vendorId: 'v1', orderId: 'o1', reason: 'refund recorded' });
    expect(w.store.lines[0]).toMatchObject({ status: 'REVERSED', flagged: true }); expect(w.store.lines[0].flagReason).toContain('refund recorded');
    // Wave 4 W4: a line reversed AFTER the payout stays PAID and a separate negative ADJUSTMENT line is made (see wave4-commission-adjustment.spec.ts for the netting)
    Object.assign(w.store.lines[1], { status: 'PAID', amountMinor: 100_000 });
    await w.svc.onPaymentReversed({ vendorId: 'v2', orderId: 'o2', reason: 'refund recorded' });
    expect(w.store.lines[1]).toMatchObject({ status: 'PAID', flagged: true }); expect(w.store.lines[1].flagReason).toMatch(/after the payout.*adjustment/);
    expect(w.store.lines[2]).toMatchObject({ kind: 'ADJUSTMENT', vendorId: 'v2', status: 'ACCRUED', amountMinor: -100_000, adjustsLineId: w.store.lines[1].id });
    await w.svc.onPaymentReversed({ vendorId: 'v2', orderId: 'o2', reason: 'again' });   // a repeat is quiet
    expect(w.store.lines).toHaveLength(3);
    expect(w.recorded.filter((r) => r.actionKey === 'commission.line.reversed')).toHaveLength(1);
    expect(w.recorded.filter((r) => r.actionKey === 'commission.adjustment.created')).toHaveLength(1);
  });
});

describe('slab rows (service)', () => {
  const row = (over: Record<string, unknown> = {}) => ({ minVendors: 1, maxVendors: 4, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z', ...over });
  it('ships with none, accepts good rows, names every problem, and audits', async () => {
    const w = world(); expect(await w.svc.slabs()).toEqual([]);
    const s = await w.svc.addSlab(row(), w.admin); expect(s).toMatchObject({ minVendors: 1, maxVendors: 4, amountPerVendorMinor: 100_000 });
    await w.svc.addSlab(row({ minVendors: 5, maxVendors: null, amountPerVendorMinor: 150_000 }), w.admin);
    expect((await w.svc.slabs()).map((x) => x.amountPerVendorMinor)).toEqual([100_000, 150_000]);
    const e = await err(w.svc.addSlab(row({ minVendors: 0, amountPerVendorMinor: -5, effectiveFrom: 'x' }), w.admin));
    expect([code(e), (e as { response: { details: { problems: string[] } } }).response.details.problems.sort()]).toEqual(['COMMISSION_SLAB_INVALID', ['AMOUNT_INVALID', 'DATE_INVALID', 'MIN_INVALID']]);
    expect(code(await err(w.svc.addSlab(row({ minVendors: 3, maxVendors: 6 }), w.admin)))).toBe('COMMISSION_SLAB_INVALID');   // overlap
    expect(w.recorded.filter((r) => r.actionKey === 'commission.slab.added')).toHaveLength(2);
  });
  it('edits a row until a closed month may have used it; then a row with a later date is the way', async () => {
    const w = world(); const s = await w.svc.addSlab(row(), w.admin);
    const e = await w.svc.editSlab(s.id, { amountPerVendorMinor: 120_000 }, w.admin); expect(e.amountPerVendorMinor).toBe(120_000);
    expect(code(await err(w.svc.editSlab('nope', { amountPerVendorMinor: 1 }, w.admin)))).toBe('COMMISSION_SLAB_NOT_FOUND');
    expect(code(await err(w.svc.editSlab(s.id, { minVendors: 0 }, w.admin)))).toBe('COMMISSION_SLAB_INVALID');
    await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId: 'v1', orderId: 'o1', paidAt: d('2026-11-10T10:00:00Z'), via: 'WEBHOOK' });
    await w.svc.closeMonth('2026-11', w.admin);
    const later = await err(w.svc.editSlab(s.id, { amountPerVendorMinor: 999_000 }, w.admin));
    expect([code(later), (later as { response: { details: { problems: string[] } } }).response.details.problems]).toEqual(['COMMISSION_SLAB_INVALID', ['IN_USE']]);
    expect((await w.svc.addSlab(row({ effectiveFrom: '2026-12-01T00:00:00Z', amountPerVendorMinor: 999_000 }), w.admin)).amountPerVendorMinor).toBe(999_000);
  });
});

describe('closing a month and paying out (service)', () => {
  async function setup(w: W, n: number, partner = w.asha) { for (let i = 1; i <= n; i++) { await w.svc.setAttribution(`v${i}`, partner.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId: `v${i}`, orderId: `o${i}`, paidAt: d('2026-11-10T10:00:00Z'), via: 'CONFIRM' }); } }
  const slabs = async (w: W) => { await w.svc.addSlab({ minVendors: 1, maxVendors: 2, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin); await w.svc.addSlab({ minVendors: 3, maxVendors: null, amountPerVendorMinor: 150_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin); };

  it('with no slab rows nothing accrues and the close says so; lines keep no amount and no payout is possible', async () => {
    const w = world(); await setup(w, 3);
    const r = await w.svc.closeMonth('2026-11', w.admin);
    expect(r).toMatchObject({ noSlabs: true, approved: 0 }); expect(w.store.lines.every((l) => l.status === 'ACCRUED' && l.amountMinor === null)).toBe(true);
    expect(code(await err(w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference: 'UTR123456' }, w.admin)))).toBe('COMMISSION_MONTH_NOT_CLOSED');
  });
  it('closes by the partner\'s count, approves every line, and a repeat approves nothing', async () => {
    const w = world(); await slabs(w); await setup(w, 3);
    const r = await w.svc.closeMonth('2026-11', w.admin);
    expect(r).toMatchObject({ noSlabs: false, approved: 3, partners: [{ partnerId: w.asha.id, count: 3, perVendorMinor: 150_000, totalMinor: 450_000 }] });
    expect(w.store.lines.map((l) => [l.status, l.amountMinor])).toEqual([['APPROVED', 150_000], ['APPROVED', 150_000], ['APPROVED', 150_000]]);
    const again = await w.svc.closeMonth('2026-11', w.admin);
    expect(again.approved).toBe(0); expect(w.store.lines.map((l) => l.amountMinor)).toEqual([150_000, 150_000, 150_000]);
    expect(w.recorded.filter((x) => x.actionKey === 'commission.month.closed')).toHaveLength(1);   // the repeat is not audited as a second close
  });
  it('a late payment accrues after a close and is picked up by the next close, with the count of the whole month', async () => {
    const w = world(); await slabs(w); await setup(w, 2); await w.svc.closeMonth('2026-11', w.admin);
    await w.svc.setAttribution('v3', w.asha.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId: 'v3', orderId: 'o3', paidAt: d('2026-11-29T10:00:00Z'), via: 'WEBHOOK' });
    const r = await w.svc.closeMonth('2026-11', w.admin);
    expect(r.approved).toBe(1); expect(w.store.lines.find((l) => l.vendorId === 'v3')!.amountMinor).toBe(150_000);   // 3 in the month now: the higher row
    expect(w.store.lines.find((l) => l.vendorId === 'v1')!.amountMinor).toBe(100_000);   // an approved line is never rewritten
  });
  it('refuses a month that is not a month', async () => { const w = world(); for (const m of ['2026-13', 'Nov', '', '2026-1']) expect(code(await err(w.svc.closeMonth(m, w.admin)))).toBe('COMMISSION_MONTH_INVALID'); });

  it('records a payout with a bank or UPI reference: the lines become PAID, once per partner and month', async () => {
    const w = world(); await slabs(w); await setup(w, 3); await w.svc.closeMonth('2026-11', w.admin);
    for (const reference of ['', 'ab', undefined, 'x'.repeat(121), 'a\u0000b']) expect(code(await err(w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference }, w.admin)))).toBe('COMMISSION_PAYOUT_INVALID');
    const p = await w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference: '  UPI 4821  7766 ' }, w.admin);
    expect(p).toMatchObject({ partnerId: w.asha.id, month: '2026-11', totalMinor: 450_000, status: 'PAID', reference: 'UPI 4821 7766', paidById: 'admin-1' });
    expect(w.store.lines.every((l) => l.status === 'PAID' && l.payoutId === p.id)).toBe(true);
    expect(code(await err(w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference: 'UTR999999' }, w.admin)))).toBe('COMMISSION_PAYOUT_EXISTS');
    expect(w.store.payouts).toHaveLength(1);
    expect(w.recorded.some((r) => r.actionKey === 'commission.payout.recorded')).toBe(true);
  });
  it('refuses a payout with nothing approved, for an unknown partner, or for another month; a reversed line is not paid', async () => {
    const w = world(); await slabs(w); await setup(w, 3);
    await w.svc.onPaymentReversed({ vendorId: 'v3', orderId: 'o3', reason: 'refund recorded' });
    await w.svc.closeMonth('2026-11', w.admin);
    expect(w.store.lines.map((l) => l.status)).toEqual(['APPROVED', 'APPROVED', 'REVERSED']);
    expect(w.store.lines[0].amountMinor).toBe(100_000);   // only two count, so the lower row
    const p = await w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference: 'UTR000111' }, w.admin);
    expect(p.totalMinor).toBe(200_000);
    expect(code(await err(w.svc.recordPayout({ partnerId: w.ben.id, month: '2026-11', reference: 'UTR000222' }, w.admin)))).toBe('COMMISSION_NOTHING_TO_PAY');
    expect(code(await err(w.svc.recordPayout({ partnerId: 'nope', month: '2026-11', reference: 'UTR000333' }, w.admin)))).toBe('REFERRAL_LINK_NOT_FOUND');
    expect(code(await err(w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-12', reference: 'UTR000444' }, w.admin)))).toBe('COMMISSION_NOTHING_TO_PAY');
  });
  it('the ledger lists newest month first with filters, and the CSV carries the same rows with a defused partner name', async () => {
    const w = world(); await slabs(w); await setup(w, 2); await w.svc.closeMonth('2026-11', w.admin);
    w.asha.name = '=HYPERLINK("http://evil")';
    const all = await w.svc.ledger({ skip: 0, take: 50 }); expect(all.total).toBe(2);
    expect((await w.svc.ledger({ month: '2026-10', skip: 0, take: 50 })).total).toBe(0); expect((await w.svc.ledger({ status: 'APPROVED', skip: 0, take: 1 })).items).toHaveLength(1);
    const csv = await w.svc.exportCsv({ month: '2026-11' });
    const lines = csv.trim().split('\r\n'); expect(lines).toHaveLength(3); expect(lines[0]).toBe('month,kind,partner,partnerId,vendorId,orderId,status,amountRupees,flagged,flagReason,qualifiedAt,payoutId');
    expect(lines[1]).toContain('2026-11'); expect(lines[1]).toContain('1000.00'); expect(csv).not.toMatch(/,=HYPERLINK|^=HYPERLINK/m); expect(csv).toContain("\"'=HYPERLINK");
  });
});

describe('what a partner sees (and never sees)', () => {
  async function two(w: W) {
    await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin); await w.svc.setAttribution('v2', w.ben.id, undefined, w.admin);
    w.store.vendors.get('v1')!.state = 'Kerala'; w.store.vendors.get('v1')!.email = 'private@owner.example'; w.store.vendors.get('v1')!.phone = '+919000000001';
    for (const [v, o] of [['v1', 'o1'], ['v2', 'o2']]) await w.svc.onPlanPaid({ vendorId: v, orderId: o, paidAt: d('2026-11-10T10:00:00Z'), via: 'WEBHOOK' });
    await w.svc.addSlab({ minVendors: 1, maxVendors: null, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' }, w.admin); await w.svc.closeMonth('2026-11', w.admin);
    await w.svc.recordPayout({ partnerId: w.asha.id, month: '2026-11', reference: 'UTR777888' }, w.admin);
  }
  it('lists only its own referred businesses: business name, state and day, with no contact detail and no id', async () => {
    const w = world(); await two(w);
    const mine = await w.svc.myVendors(w.asha.id, 0, 25);
    expect(mine.total).toBe(1); expect(mine.items).toEqual([{ businessName: 'Business v1', state: 'Kerala', referredAt: expect.any(Date) }]);
    expect(JSON.stringify(mine)).not.toMatch(/private@owner|9000000001|v1@|"id"|vendorId|email|phone/);
    expect((await w.svc.myVendors(w.ben.id, 0, 25)).items[0].businessName).toBe('Business v2');
    expect((await w.svc.myVendors('nobody', 0, 25)).total).toBe(0);
  });
  it('shows only its own commission lines and payouts', async () => {
    const w = world(); await two(w);
    const c = await w.svc.myCommission(w.asha.id, 0, 25); expect(c.items).toEqual([{ month: '2026-11', kind: 'COMMISSION', businessName: 'Business v1', status: 'PAID', amountMinor: 100_000, flagged: false }]);
    expect(JSON.stringify(c)).not.toMatch(/vendorId|orderId|private@|9000000001|partnerId/);
    const p = await w.svc.myPayouts(w.asha.id, 0, 25); expect(p.items).toEqual([{ month: '2026-11', totalMinor: 100_000, status: 'PAID', reference: 'UTR777888', paidAt: expect.any(Date) }]);
    expect((await w.svc.myPayouts(w.ben.id, 0, 25)).total).toBe(0); expect((await w.svc.myCommission(w.ben.id, 0, 25)).items[0].status).toBe('APPROVED');
  });
  it('a reversed or flagged line is shown to the partner as it is, without the owner\'s note', async () => {
    const w = world(); await w.svc.setAttribution('v1', w.asha.id, undefined, w.admin); await w.svc.onPlanPaid({ vendorId: 'v1', orderId: 'o1', paidAt: d('2026-11-10T10:00:00Z'), via: 'WEBHOOK' });
    await w.svc.onPaymentReversed({ vendorId: 'v1', orderId: 'o1', reason: 'refund recorded' });
    const c = await w.svc.myCommission(w.asha.id, 0, 25); expect(c.items[0]).toMatchObject({ status: 'REVERSED', flagged: true }); expect(JSON.stringify(c)).not.toMatch(/owner decides|refund recorded/);
  });
});

describe('the routes', () => {
  const ctx = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
  it('the partner routes read ONLY the signed-in partner, whatever the request says', async () => {
    const asked: string[] = [];
    const referrals = { myLinks: async (id: string) => { asked.push(id); return []; }, myVendors: async (id: string) => { asked.push(id); return { items: [], total: 0 }; }, myCommission: async (id: string) => { asked.push(id); return { items: [], total: 0 }; }, myPayouts: async (id: string) => { asked.push(id); return { items: [], total: 0 }; } };
    const partners = { forLogin: async (sub: string) => (sub === 'login-a' ? { id: 'partner-a' } : null) };
    const c = new PartnerReferralsController(referrals as never, partners as never);
    const u = { sub: 'login-a', email: 'a@x.invalid', role: 'PARTNER', kind: 'referral_partner' } as AuthenticatedUser;
    await c.link(u); await c.vendors(u, {}); await c.commission(u, {}); await c.payouts(u, {});
    expect(asked).toEqual(['partner-a', 'partner-a', 'partner-a', 'partner-a']);
    expect(code(await err(c.link({ ...u, sub: 'login-unlinked' })))).toBe('PARTNER_NOT_FOUND');
  });
  it('only a referral partner passes the partner guard; a vendor, a team member and staff do not', () => {
    const g = new PartnerGuard();
    expect(g.canActivate(ctx({ sub: 'x', email: 'a@x.invalid', role: 'PARTNER', kind: 'referral_partner' }))).toBe(true);
    for (const u of [undefined, { sub: 'v', role: 'VENDOR' }, { sub: 'v', role: 'VENDOR', kind: 'team_member' }, { sub: 's', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPER_ADMIN' }]) expect(() => g.canActivate(ctx(u))).toThrow();
  });
  it('the public code route answers validity and name only, never cached', async () => {
    const w = world(); const l = await link(w); const headers: Record<string, string> = {};
    const out = await new PublicReferralController(w.svc).resolve(l.code, { set: (k: string, v: string) => { headers[k] = v; } } as never);
    expect(out).toEqual({ valid: true, source: 'Asha Referrals' }); expect(headers['Cache-Control']).toBe('no-store');
  });
  const WRITES = ['POST /v3/admin/partners/:id/links', 'POST /v3/admin/referral-links/:id/disable', 'POST /v3/admin/commission/slabs', 'PUT /v3/admin/commission/slabs/:id', 'POST /v3/admin/commission/months/:month/close', 'POST /v3/admin/commission/payouts', 'PUT /v3/admin/vendors/:id/referral'];
  const SUPER_ONLY_ROUTE = 'POST /v3/admin/vendors/:id/referral/change';
  const READS = ['GET /v3/admin/partners/:id/links', 'GET /v3/admin/commission/slabs', 'GET /v3/admin/commission/ledger', 'GET /v3/admin/commission/ledger/export.csv', 'GET /v3/admin/commission/payouts', 'GET /v3/admin/vendors/:id/referral'];
  const principal = (role?: string) => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(role) });
  const may = (u: unknown, key: string): boolean => { const [method, ...r] = key.split(' '); try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; } };
  it('writes: ADMIN and SUPER_ADMIN only; reads: OPERATIONS, ADMIN and SUPER_ADMIN; SALES, its labels, SUPPORT, a partner and a vendor are refused on all', () => {
    for (const k of WRITES) expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
    for (const k of READS) expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    for (const role of ['MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) for (const k of [...WRITES, ...READS]) expect([role, k, may(principal(role), k)]).toEqual([role, k, false]);
    for (const u of [{ sub: 'p', role: 'PARTNER', kind: 'referral_partner' }, { sub: 'v', role: 'VENDOR' }, undefined]) for (const k of [...WRITES, ...READS]) expect(may(u, k)).toBe(false);
    expect([...effectiveRolesFor(SUPER_ONLY_ROUTE)]).toEqual(['SUPER_ADMIN']); expect(may(principal('ADMIN'), SUPER_ONLY_ROUTE)).toBe(false); expect(may(principal('SUPER_ADMIN'), SUPER_ONLY_ROUTE)).toBe(true);   // changing a referrer is SUPER_ADMIN only
    for (const k of WRITES) { expect(may(principal('ADMIN'), k)).toBe(true); expect(may(principal('SUPER_ADMIN'), k)).toBe(true); expect(may(principal('OPERATIONS'), k)).toBe(false); }
    for (const k of READS) expect(may(principal('OPERATIONS'), k)).toBe(true);
  });
  it('the partner service is the one that links a login to a partner (a staff login or a vendor can never act as one)', async () => {
    const store = new MemoryPartnersStore(); const p = store.add({ name: 'A', email: 'a@x.invalid', staffUserId: 'login-1' });
    expect((await new PartnersService(store).forLogin('login-1'))?.id).toBe(p.id); expect(await new PartnersService(store).forLogin('someone-else')).toBeNull();
  });
});

describe('the settlement tells the referral module (billing world with a recording hook)', () => {
  const hook = () => { const calls: Array<{ k: string; i: Record<string, unknown> }> = []; return { calls, h: { onPlanPaid: async (i: Record<string, unknown>) => { calls.push({ k: 'paid', i }); }, onPaymentReversed: async (i: Record<string, unknown> ) => { calls.push({ k: 'reversed', i }); } } }; };
  it('a gateway payment tells it after the commit, once per payment, with the vendor and the order', async () => {
    const x = hook(); const f = flow('cashfree', { paidHook: x.h as never });
    const o = await f.buy(); f.gw.addPayment({ paymentId: '700001', providerOrderId: o.providerOrderId!, amountMinor: o.amountPaise, currency: 'INR', status: 'SUCCESS' });
    await f.orders.confirm('v1', o.id, {}, VENDOR); await f.orders.confirm('v1', o.id, {}, VENDOR);
    await new Promise((r) => setImmediate(r));
    expect(x.calls.map((c) => c.k)).toEqual(['paid']); expect(x.calls[0].i).toMatchObject({ vendorId: 'v1', orderId: o.id, via: 'CONFIRM' });
  });
  it('a held payment tells nobody', async () => {
    const x = hook(); const f = flow('razorpay', { paidHook: x.h as never });
    const o = await f.buy(); f.gw.addPayment({ paymentId: 'pay_held9', providerOrderId: o.providerOrderId!, amountMinor: 1, currency: 'INR', status: 'SUCCESS' });
    await f.orders.confirm('v1', o.id, { paymentId: 'pay_held9', signature: f.gw.returnSignature(o.providerOrderId!, 'pay_held9') }, VENDOR);
    await new Promise((r) => setImmediate(r)); expect(x.calls).toEqual([]);
  });
  it('an admin-confirmed cash payment tells it, and a FULL refund tells it of the reversal while a part refund does not', async () => {
    const x = hook(); const f = flow('razorpay', { paidHook: x.h as never });
    const o = await f.orders.createCashOrder('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'cash-referral-001' }, SUPER);
    await f.settlement.confirmCash(o.id, { method: 'CASH', reference: 'RCPT-9001', receivedOn: '2026-11-04', amountPaise: 354000, specialCase: true, reason: 'paid cash at the office' }, SUPER, 'Admin');
    await new Promise((r) => setImmediate(r));
    expect(x.calls.map((c) => c.k)).toEqual(['paid']); expect(x.calls[0].i).toMatchObject({ via: 'STAFF', vendorId: 'v1' });
    await f.settlement.recordRefund(o.id, { amountPaise: 1000, note: 'goodwill refund' }, SUPER);
    await new Promise((r) => setImmediate(r)); expect(x.calls.map((c) => c.k)).toEqual(['paid']);
    await f.settlement.recordRefund(o.id, { amountPaise: 354000 - 1000, note: 'the rest refunded' }, SUPER);
    await new Promise((r) => setImmediate(r)); expect(x.calls.map((c) => c.k)).toEqual(['paid', 'reversed']);
    expect(x.calls[1].i).toMatchObject({ vendorId: 'v1', orderId: o.id, reason: 'refund recorded' });
  });
  it('a hook that fails never fails the payment', async () => {
    const f = flow('razorpay', { paidHook: { onPlanPaid: async () => { throw new Error('boom'); }, onPaymentReversed: async () => undefined } as never });
    const o = await f.buy(); f.gw.addPayment({ paymentId: 'pay_ok9', providerOrderId: o.providerOrderId!, amountMinor: o.amountPaise, currency: 'INR', status: 'SUCCESS' });
    expect((await f.orders.confirm('v1', o.id, { paymentId: 'pay_ok9', signature: f.gw.returnSignature(o.providerOrderId!, 'pay_ok9') }, VENDOR)).status).toBe('PAID');
  });
});

describe('registering with a referral code', () => {
  const make = (referrals?: { attributeAtRegistration: (i: { vendorId: string; code: string }) => Promise<void> }) => {
    const vendors: Array<Record<string, unknown>> = [];
    const prisma = { vendor: { findUnique: async ({ where }: { where: { email?: string; subdomain?: string } }) => vendors.find((v) => (where.email && v.email === where.email) || (where.subdomain && v.subdomain === where.subdomain)) ?? null }, v3Domain: { findUnique: async () => null }, v3PlanSetting: { findMany: async () => [] }, adminTeamMember: { findUnique: async () => null }, teamMember: { findFirst: async () => null }, vendorAddon: { upsert: async () => ({}) } };
    const vendorsService = { create: async (dto: Record<string, unknown>) => { const v = { id: `v${vendors.length + 1}`, role: 'VENDOR', status: 'ACTIVE', isSandbox: false, ...dto, password: await bcrypt.hash(String(dto.password), 4) }; vendors.push(v); return v; } };
    return new AuthService(prisma as never, { sign: () => 't', decode: () => ({ sub: 'x' }) } as never, vendorsService as never, undefined, undefined, undefined, referrals);
  };
  const dto = (over: Partial<RegisterDto> = {}) => ({ name: 'N', email: 'n@example.com', password: 'StrongPass1', businessName: 'Biz One', industry: 'clinic', ...over }) as RegisterDto;
  it('passes the new vendor and the code to the attribution port', async () => {
    const seen: Array<{ vendorId: string; code: string }> = [];
    await make({ attributeAtRegistration: async (i) => { seen.push(i); } }).register(dto({ referralCode: 'K7M2P9QX' }));
    expect(seen).toEqual([{ vendorId: 'v1', code: 'K7M2P9QX' }]);
  });
  it('does nothing without a code, and a failing port never blocks the signup', async () => {
    const seen: unknown[] = [];
    await make({ attributeAtRegistration: async (i) => { seen.push(i); } }).register(dto());
    expect(seen).toEqual([]);
    const r = await make({ attributeAtRegistration: async () => { throw new Error('db down'); } }).register(dto({ referralCode: 'K7M2P9QX' }));
    expect(r.accessToken).toBe('t');
    expect((await make().register(dto({ referralCode: 'K7M2P9QX' }))).accessToken).toBe('t');   // no port at all
  });
});
