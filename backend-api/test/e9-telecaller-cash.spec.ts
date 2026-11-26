import { TelecallerService } from '../src/v3-telecaller/telecaller.service';
import { PlanOrderService } from '../src/plan-billing/plan-order.service';
import { PartnersService } from '../src/v3-partners/partners.service';
import { validateExtraSetting } from '../src/plans/admin/extra-settings';
import { DEFAULT_TELECALLER_SETTINGS } from '../src/v3-telecaller/settings/telecaller-settings';
import { advance, SUPER } from './support/billing-world';
import { flow, Flow } from './support/wave3-world';

/**
 * A telecaller's cash, through the REAL order and settlement services: it must show as waiting, become overdue after the setting, and still be confirmable then.
 * (The first version counted a status a cash order never keeps, and the order expired after 14 days: DECISIONS_NEEDED.md UD9.)
 */
const DAYS = 86_400;

function telecallerOver(f: Flow) {
  const registry = new Map<unknown, unknown>([[PlanOrderService, f.orders], [PartnersService, { forLogin: async () => ({ id: 'partner-1', name: 'Asha' }) }]]);
  type Where = { vendorId: { in: string[] }; gateway: string; status: string | { in: string[] } };
  const prisma = {
    referralAttribution: { findUnique: async () => ({ partnerId: 'partner-1' }), findMany: async () => [{ vendorId: 'v1' }] },
    commissionLedger: { findMany: async () => [] },
    telecallerProfile: { findUnique: async () => null },
    // answers the monitor's query from the orders the real service made, honouring every condition of the query
    v3PlanOrder: {
      findMany: async ({ where }: { where: Where }) => [...f.w.repo.orders.values()].filter((o) => where.vendorId.in.includes(o.vendorId) && o.gateway === where.gateway && (typeof where.status === 'string' ? o.status === where.status : where.status.in.includes(o.status))),
    },
  };
  const svc = new TelecallerService({ get: (t: unknown) => registry.get(t) } as never, prisma as never, { get: async () => DEFAULT_TELECALLER_SETTINGS } as never);
  svc.clock = () => new Date(f.w.now.t);
  return svc;
}
const collect = (svc: TelecallerService, key = 'collect-abc-0001') => svc.recordCollection({ sub: 'login-1' }, 'v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key }, null);

describe("a telecaller's cash", () => {
  it('shows as waiting at once, is overdue only after 60 days, and the admin can still confirm it then', async () => {
    const f = flow(); const svc = telecallerOver(f);
    const { order } = await collect(svc);
    const takenOn = f.w.now.t.toISOString().slice(0, 10);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(await svc.monitorOf('partner-1')).toMatchObject({ cashWaitingForOffice: 1, cashOverdue: 0, oldestWaitingDays: 0 });
    advance(f.w, 15 * DAYS); expect(await f.settlement.expireStale()).toBe(0);
    advance(f.w, 46 * DAYS); expect(await f.settlement.expireStale()).toBe(0);
    expect(await svc.monitorOf('partner-1')).toMatchObject({ cashWaitingForOffice: 1, cashOverdue: 1, oldestWaitingDays: 61, cashOverdueAfterDays: 60 });
    const done = await f.settlement.confirmCash(order.id, { method: 'CASH', reference: 'RCPT-9', receivedOn: takenOn, amountPaise: order.amountPaise, specialCase: true, reason: 'collected by the telecaller, banked today' }, SUPER, 'Admin A');
    expect(done.status).toBe('PAID');
    expect(await svc.monitorOf('partner-1')).toMatchObject({ cashWaitingForOffice: 0, cashOverdue: 0, oldestWaitingDays: null });
  });

  it('closes only after 366 days, the oldest receipt day a confirmation accepts', async () => {
    const f = flow(); const svc = telecallerOver(f); await collect(svc);
    advance(f.w, 366 * DAYS - 60); expect(await f.settlement.expireStale()).toBe(0);
    advance(f.w, 120); expect(await f.settlement.expireStale()).toBe(1);
  });

  it("an admin's own cash order still closes after 14 days, as before", async () => {
    const f = flow();
    await f.orders.createCashOrder('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'admin-cash-0001-abcd' }, SUPER);
    advance(f.w, 13 * DAYS); expect(await f.settlement.expireStale()).toBe(0);
    advance(f.w, 2 * DAYS); expect(await f.settlement.expireStale()).toBe(1);
  });

  it('the overdue setting cannot be set so high that nothing could ever be overdue', () => {
    expect(() => validateExtraSetting('telecallerCashOverdueDays', 365)).not.toThrow();
    expect(() => validateExtraSetting('telecallerCashOverdueDays', 366)).toThrow();
    expect(() => validateExtraSetting('telecallerDailyCap', 1000)).not.toThrow();
  });
});
