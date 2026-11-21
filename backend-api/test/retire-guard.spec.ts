import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ResolvedEntitlements } from '../src/plans/entitlements/entitlement-engine';
import { RetiredModuleGuard } from '../src/v3-retire/retired-module.guard';

/**
 * The retired industry modules answer 404 for a V3 vendor and are untouched for everyone else. The entitlement state decides: `industry.<module>` HIDDEN (the plan seed gives that to every plan) hides it,
 * so staff can later switch a single vendor back on with an override. A legacy vendor (the V3 plans flag is off) never reaches the entitlement check at all.
 */
type Mode = 'LEGACY' | 'V3' | 'UNASSIGNED';
const resolved = (mode: Mode, state: 'HIDDEN' | 'ACTIVE' | 'LOCKED_PREVIEW', key = 'industry.restaurant'): ResolvedEntitlements => ({ mode, plan: null, subscribedPlan: null, track: null, level: null, subscriptionStatus: null, graceWarning: false, suspended: false, features: { [key]: { state, limit: null, upsellText: null } } as never });
const ctx = (path: string, user: Record<string, unknown> | undefined): ExecutionContext => ({ switchToHttp: () => ({ getRequest: () => ({ path, url: path, user }) }) }) as unknown as ExecutionContext;
const vendor = { sub: 'vendor-1', role: 'VENDOR', email: 'a@b.c' };
const make = (r: ResolvedEntitlements) => { const calls: string[] = []; const g = new RetiredModuleGuard({ resolveForRequest: async (_req: unknown, id: string) => { calls.push(id); return r; } } as never); return { g, calls }; };

describe('retired industry modules for V3 vendors', () => {
  it('a V3 vendor gets a plain 404 on a retired module route', async () => {
    const { g } = make(resolved('V3', 'HIDDEN')); await expect(g.canActivate(ctx('/restaurant/orders', vendor))).rejects.toBeInstanceOf(NotFoundException);
  });
  it('the 404 says nothing about why (the same answer as a route that does not exist)', async () => {
    const { g } = make(resolved('V3', 'HIDDEN')); let e: NotFoundException | undefined; try { await g.canActivate(ctx('/restaurant/orders', vendor)); } catch (x) { e = x as NotFoundException; } if (!e) throw new Error('expected a 404'); expect(e.getResponse()).toMatchObject({ statusCode: 404 }); expect(JSON.stringify(e.getResponse())).not.toMatch(/plan|entitle|retired|v3/i);
  });
  it('a vendor flagged for V3 but with no plan yet is treated as V3', async () => { const { g } = make(resolved('UNASSIGNED', 'HIDDEN')); await expect(g.canActivate(ctx('/restaurant', vendor))).rejects.toBeInstanceOf(NotFoundException); });
  it('a legacy vendor is untouched even when the module feature reads HIDDEN (the mode is what decides)', async () => {
    const { g, calls } = make(resolved('LEGACY', 'HIDDEN')); expect(await g.canActivate(ctx('/restaurant/orders', vendor))).toBe(true); expect(calls).toEqual(['vendor-1']);
  });
  it('a vendor whose entitlement is switched on for that module (a staff override) keeps it', async () => { const { g } = make(resolved('V3', 'ACTIVE')); expect(await g.canActivate(ctx('/restaurant/orders', vendor))).toBe(true); });
  it('a module with no entitlement row at all is hidden for V3 (the engine answers hidden for an unknown key)', async () => { const { g } = make({ ...resolved('V3', 'HIDDEN'), features: {} }); await expect(g.canActivate(ctx('/restaurant', vendor))).rejects.toBeInstanceOf(NotFoundException); });
  it('routes that are not industry routes are never checked', async () => { const { g, calls } = make(resolved('V3', 'HIDDEN')); for (const p of ['/v3/me/store/products', '/health', '/auth/login', '/']) expect(await g.canActivate(ctx(p, vendor))).toBe(true); expect(calls).toEqual([]); });
  it('staff and a signed-out caller are not the guard\'s business (they are judged by the route\'s own guards)', async () => {
    const { g, calls } = make(resolved('V3', 'HIDDEN'));
    for (const u of [{ sub: 'a1', role: 'ADMIN', adminRole: 'SUPER_ADMIN', email: 'x' }, { sub: 'a2', role: 'ADMIN', kind: 'admin_member', email: 'x' }, undefined]) expect(await g.canActivate(ctx('/restaurant/orders', u))).toBe(true);
    expect(calls).toEqual([]);
  });
  it('a vendor team member is judged by the vendor they work for', async () => { const { g, calls } = make(resolved('V3', 'HIDDEN')); await expect(g.canActivate(ctx('/restaurant', { sub: 'vendor-9', role: 'VENDOR', kind: 'team_member', memberId: 'm1', email: 'x' }))).rejects.toBeInstanceOf(NotFoundException); expect(calls).toEqual(['vendor-9']); });
  it('every industry module is covered, not only restaurant', async () => {
    const { INDUSTRY_MODULES } = await import('../src/v3-retire/core/retire-core');
    for (const m of INDUSTRY_MODULES) { const { g } = make(resolved('V3', 'HIDDEN', `industry.${m}`)); await expect([m, await g.canActivate(ctx(`/${m}/x`, vendor)).catch(() => 'blocked')]).toEqual([m, 'blocked']); }
  });
});
