import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../src/account-security/password.service';
import { AdminTeamService } from '../src/admin-team/admin-team.service';
import { PlanOrderService } from '../src/plan-billing/plan-order.service';
import { AdminVendorSiteService } from '../src/v3-admin-vendor-site/admin-vendor-site.service';
import { PartnersService } from '../src/v3-partners/partners.service';
import { ReferralsService } from '../src/v3-referrals/referrals.service';
import { capReached, checkEmployee, monitorView } from '../src/v3-telecaller/core/telecaller-core';
import { TelecallerService } from '../src/v3-telecaller/telecaller.service';

/** E6: telecaller accounts, creating a business on behalf, the collection record and the monitor. Fakes for every neighbour service. */
const NOW = new Date('2026-11-26T10:00:00+05:30');
const dto = (over: Record<string, unknown> = {}) => ({ category: 'plumber', businessName: 'Sri Plumbing', ownerName: 'Ravi', phone: '+919800000000', email: 'ravi@example.com', city: 'Aluva', subdomain: 'sriplumbing', ...over }) as never;

function make(o: { loginIsTelecaller?: boolean; attributions?: Array<{ vendorId: string; partnerId: string }>; ledger?: Array<{ partnerId: string; status: string; amountMinor: number | null; kind: string }>; orders?: Array<{ vendorId: string; createdAt: Date }>; failPartnerCreate?: boolean; todayCount?: number } = {}) {
  const calls: Record<string, unknown[]> = { invite: [], partnerCreate: [], issueLink: [], vendorCreate: [], attribute: [], reset: [], cashOrder: [], memberUpdate: [] };
  const team = { invite: async (d: unknown) => { calls.invite.push(d); return { id: 'login-1' }; } };
  const partners = {
    create: async (d: unknown) => { calls.partnerCreate.push(d); if (o.failPartnerCreate) throw new Error('email taken'); return { id: 'partner-1' }; },
    forLogin: async (sub: string) => (o.loginIsTelecaller === false ? null : { id: 'partner-1', name: 'Asha', sub }),
  };
  const referrals = { issueLink: async (...a: unknown[]) => { calls.issueLink.push(a); return { code: 'ASHA-1234' }; }, setAttribution: async (...a: unknown[]) => { calls.attribute.push(a); return {}; } };
  const sites = { create: async (d: unknown, actor: unknown) => { calls.vendorCreate.push([d, actor]); return { vendorId: 'v-new', subdomain: 'sriplumbing', siteUrl: 'https://sriplumbing.get4domain.com', site: {} }; } };
  const password = { requestReset: (...a: unknown[]) => { calls.reset.push(a); } };
  const orders = { createCashOrder: async (...a: unknown[]) => { calls.cashOrder.push(a); return { id: 'order-1', status: 'CREATED', gateway: 'cash' }; } };
  const registry = new Map<unknown, unknown>([[AdminTeamService, team], [PartnersService, partners], [ReferralsService, referrals], [AdminVendorSiteService, sites], [PasswordService, password], [PlanOrderService, orders]]);
  const attrs = o.attributions ?? [{ vendorId: 'v-own', partnerId: 'partner-1' }, { vendorId: 'v-other', partnerId: 'partner-2' }];
  const prisma = {
    adminTeamMember: { update: async (a: unknown) => { calls.memberUpdate.push(a); return {}; }, findMany: async () => [{ id: 'login-1' }] },
    referralAttribution: {
      findUnique: async ({ where }: { where: { vendorId: string } }) => attrs.find((a) => a.vendorId === where.vendorId) ?? null,
      findMany: async ({ where }: { where: { partnerId: string } }) => attrs.filter((a) => a.partnerId === where.partnerId),
    },
    commissionLedger: { findMany: async ({ where }: { where: { partnerId: string } }) => (o.ledger ?? []).filter((l) => l.partnerId === where.partnerId && l.kind === 'COMMISSION') },
    v3PlanOrder: { findMany: async ({ where }: { where: { vendorId: { in: string[] } } }) => (o.orders ?? []).filter((x) => where.vendorId.in.includes(x.vendorId)) },
    vendor: { count: async () => o.todayCount ?? 0 },
    referralPartner: { findMany: async () => [{ id: 'partner-1', name: 'Asha', email: 'asha@example.com', status: 'ACTIVE', staffUserId: 'login-1' }, { id: 'partner-9', name: 'Freelancer', email: 'f@example.com', status: 'ACTIVE', staffUserId: 'login-9' }] },
  };
  const svc = new TelecallerService({ get: (t: unknown) => registry.get(t) } as never, prisma as never);
  svc.clock = () => NOW;
  return { svc, calls };
}
const caller = { sub: 'login-1' };

describe('the pure rules', () => {
  it('the employee form: name, e-mail and an optional phone, each problem named', () => {
    expect(checkEmployee({ name: ' Asha  K ', email: 'ASHA@Example.com', phone: '+91 98765 43210' })).toEqual({ ok: true, value: { name: 'Asha K', email: 'asha@example.com', phone: '+91 98765 43210' } });
    expect(checkEmployee({ name: 'A', email: 'nope', phone: 'call me' })).toEqual({ ok: false, problems: expect.objectContaining({ name: expect.any(String), email: expect.any(String), phone: expect.any(String) }) });
    expect(checkEmployee({ name: '<b>x</b>', email: 'a@b.co' })).toMatchObject({ ok: false });
  });
  it('the cap: none set means no limit', () => {
    expect(capReached(100, null)).toBe(false); expect(capReached(19, 20)).toBe(false); expect(capReached(20, 20)).toBe(true);
  });
  it('the monitor adds commission by state and counts lines with no slab price', () => {
    const v = monitorView({ created: 5, paid: 2, waiting: [{ ageDays: 1 }, { ageDays: 6 }], commission: [{ status: 'ACCRUED', amountMinor: null }, { status: 'APPROVED', amountMinor: 50_000 }, { status: 'PAID', amountMinor: 30_000 }, { status: 'PAID', amountMinor: 20_000 }] });
    expect(v).toEqual({ vendorsCreated: 5, vendorsPaid: 2, vendorsNotPaidYet: 3, cashWaitingForOffice: 2, oldestWaitingDays: 6, commission: { accruedMinor: 0, approvedMinor: 50_000, paidMinor: 50_000, reversedMinor: 0, unpricedLines: 1 } });
  });
});

describe('A: one-step employee account', () => {
  it('invites a TELECALLER login, creates a SALES_TEAM partner linked to it and issues the referral code', async () => {
    const { svc, calls } = make();
    const r = await svc.createEmployee({ name: 'Asha K', email: 'asha@example.com', phone: '+919800000001' }, { id: 'admin-1' });
    expect(calls.invite[0]).toMatchObject({ name: 'Asha K', email: 'asha@example.com', role: 'TELECALLER' });
    expect(calls.partnerCreate[0]).toMatchObject({ type: 'SALES_TEAM', staffUserId: 'login-1', email: 'asha@example.com' });
    expect(r).toMatchObject({ partnerId: 'partner-1', loginId: 'login-1', referralCode: 'ASHA-1234', inviteSent: true });
    expect(JSON.stringify(r)).not.toMatch(/token|password/i);
  });
  it('a failure after the invite removes the login again and shows the failure', async () => {
    const { svc, calls } = make({ failPartnerCreate: true });
    await expect(svc.createEmployee({ name: 'Asha K', email: 'asha@example.com' }, { id: 'admin-1' })).rejects.toThrow('email taken');
    expect(calls.memberUpdate[0]).toMatchObject({ where: { id: 'login-1' }, data: { status: 'removed' } });
  });
  it('bad details are a 400 naming the fields, and nothing is invited', async () => {
    const { svc, calls } = make();
    await expect(svc.createEmployee({ name: '', email: 'x' }, { id: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    expect(calls.invite).toEqual([]);
  });
});

describe('B: create a business as a telecaller', () => {
  it('creates it, credits the telecaller, and e-mails the owner a link to set their own password (no password anywhere)', async () => {
    const { svc, calls } = make();
    const r = await svc.createBusiness(caller, dto({ duplicateOverrideReason: 'I want to override this' }), '1.2.3.4');
    expect(r).toEqual({ vendorId: 'v-new', subdomain: 'sriplumbing', siteUrl: 'https://sriplumbing.get4domain.com', passwordLinkSentTo: 'EMAIL' });
    const [made, actor] = calls.vendorCreate[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(made.duplicateOverrideReason).toBeUndefined();   // only an admin may override the duplicate check
    expect(actor).toEqual({ id: 'login-1', role: 'TELECALLER' });
    expect(calls.attribute[0]).toEqual(['v-new', 'partner-1', 'created by a telecaller', { id: 'login-1', ip: '1.2.3.4' }]);
    expect(calls.reset[0]).toEqual(['ravi@example.com', '1.2.3.4']);
    expect(JSON.stringify(r)).not.toMatch(/token|password"/i);
  });
  it('a login that is not a telecaller is refused and nothing is created', async () => {
    const { svc, calls } = make({ loginIsTelecaller: false });
    await expect(svc.createBusiness(caller, dto(), null)).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls.vendorCreate).toEqual([]);
  });
  it('the daily cap stops creation when the owner has set one', async () => {
    const { svc, calls } = make({ todayCount: 20 }); svc.dailyCap = 20;
    await expect(svc.createBusiness(caller, dto(), null)).rejects.toBeInstanceOf(ConflictException);
    expect(calls.vendorCreate).toEqual([]);
    const free = make({ todayCount: 500 });
    await expect(free.svc.createBusiness(caller, dto(), null)).resolves.toMatchObject({ vendorId: 'v-new' });   // no cap set
  });
});

describe('C: the payment collection record', () => {
  const input = { planKey: 'pro', termMonths: 12, idempotencyKey: 'collect-abc-0001' };
  it("makes the CASH order for the telecaller's own business, creator = the telecaller, and says it waits for the office", async () => {
    const { svc, calls } = make();
    const r = await svc.recordCollection(caller, 'v-own', input, '1.2.3.4');
    expect(calls.cashOrder[0]).toEqual(['v-own', { planKey: 'pro', termMonths: 12, idempotencyKey: 'collect-abc-0001' }, { type: 'STAFF', id: 'login-1', ip: '1.2.3.4' }]);
    expect(r).toMatchObject({ order: { status: 'CREATED' }, state: 'WAITING_FOR_THE_OFFICE' });
  });
  it("another telecaller's business or an unknown one is the same plain 404, and no order is made", async () => {
    const { svc, calls } = make();
    await expect(svc.recordCollection(caller, 'v-other', input, null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.recordCollection(caller, 'v-ghost', input, null)).rejects.toBeInstanceOf(NotFoundException);
    expect(calls.cashOrder).toEqual([]);
  });
  it('a login that is not a telecaller is refused', async () => {
    const { svc } = make({ loginIsTelecaller: false });
    await expect(svc.recordCollection(caller, 'v-own', input, null)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('E: monitoring', () => {
  const data = {
    attributions: [{ vendorId: 'v1', partnerId: 'partner-1' }, { vendorId: 'v2', partnerId: 'partner-1' }, { vendorId: 'v3', partnerId: 'partner-1' }, { vendorId: 'vx', partnerId: 'partner-2' }],
    ledger: [{ partnerId: 'partner-1', status: 'APPROVED', amountMinor: 40_000, kind: 'COMMISSION' }, { partnerId: 'partner-2', status: 'PAID', amountMinor: 99_000, kind: 'COMMISSION' }],
    orders: [{ vendorId: 'v2', createdAt: new Date(NOW.getTime() - 3 * 86_400_000) }, { vendorId: 'vx', createdAt: new Date(NOW.getTime() - 9 * 86_400_000) }],
  };
  it('my numbers count only my businesses, my cash orders and my commission', async () => {
    const { svc } = make(data);
    expect(await svc.myMonitor(caller)).toEqual({ partnerId: 'partner-1', vendorsCreated: 3, vendorsPaid: 1, vendorsNotPaidYet: 2, cashWaitingForOffice: 1, oldestWaitingDays: 3, commission: { accruedMinor: 0, approvedMinor: 40_000, paidMinor: 0, reversedMinor: 0, unpricedLines: 0 } });
  });
  it('the admin list has telecallers only (a partner whose login is not a TELECALLER is not listed)', async () => {
    const { svc } = make(data);
    const all = await svc.allMonitor();
    expect(all.map((a) => a.partnerId)).toEqual(['partner-1']);
    expect(all[0]).toMatchObject({ name: 'Asha', vendorsCreated: 3 });
  });
  it('a login that is not a telecaller has no numbers', async () => {
    const { svc } = make({ ...data, loginIsTelecaller: false });
    await expect(svc.myMonitor(caller)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
