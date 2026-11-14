import * as path from 'path';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRolesFor, rolesFor, SALES_ROLE, StaffRole, STAFF_ROLE_EXTENSIONS } from '../src/auth/guards/admin-role-matrix';
import { staffMayUse } from '../src/auth/guards/staff-access';
import { CommercialAdminGuard, MoneyAdminGuard } from '../src/commercial/foundation.services';
import { LeadspaceStaffGuard } from '../src/leadspace/staff.guard';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { scanRoutes } from './support/route-scan';

/**
 * Amendment 13 V9, Part B (B5 and B8): the roles SUPPORT and ADMIN exist next to the old three, MARKETING is the document's SALES, and the matrix stays data.
 * The oracle here is the rule in words (support and sales never reach billing or settings; ADMIN never reaches a SUPER_ADMIN-only route or the system settings),
 * checked against EVERY AdminGuard route the scanner finds, so a route added later cannot slip past.
 */
const routes = scanRoutes(path.resolve(__dirname, '../src')).filter((r) => r.adminGuard === true).map((r) => r.route);
const staff = (role: StaffRole): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role });
const ctx = (user: AuthenticatedUser, routeKey: string): ExecutionContext => {
  const [method, routePath] = [routeKey.split(' ')[0], routeKey.slice(routeKey.indexOf(' ') + 1)];
  return { switchToHttp: () => ({ getRequest: () => ({ user, method, route: { path: routePath } }) }) } as unknown as ExecutionContext;
};
const allowed = (role: StaffRole, routeKey: string): boolean => {
  try { return new AdminGuard().canActivate(ctx(staff(role), routeKey)); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
};
const passes = (g: { canActivate: (c: ExecutionContext) => boolean }, adminRole: string | undefined): boolean => {
  const user: AuthenticatedUser = { sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole };
  try { return g.canActivate({ switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
};

const MONEY_OR_SETTINGS = /billing|invoices|subscriptions|wallet|plan-settings|\/settings|domain-margins|\/prices|\/plans|tier-matrix|alert-rules|prohibited-terms|takedowns|mailbox-prices|terms|\/domains|domain-orders|identity|registrar|\/ai\/|indexing-mode|mail-rules/;

describe('the staff role values', () => {
  it('the database enum keeps the three old values and adds SUPPORT and ADMIN (nothing renamed or removed)', () => {
    expect(Object.keys(AdminRole).sort()).toEqual(['ADMIN', 'MARKETING', 'OPERATIONS', 'SUPER_ADMIN', 'SUPPORT']);
  });
  it('the document SALES role is the existing MARKETING value', () => {
    expect(SALES_ROLE).toBe('MARKETING');
    expect(Object.keys(AdminRole)).not.toContain('SALES');
  });
});

describe('SUPPORT', () => {
  it('is allowed on exactly the routes its extension lists, and refused on every other AdminGuard route', () => {
    const listed = new Set(STAFF_ROLE_EXTENSIONS.SUPPORT.allow);
    expect(routes.filter((r) => allowed('SUPPORT', r)).sort()).toEqual([...listed].filter((r) => routes.includes(r)).sort());
  });
  it('every route the SUPPORT extension lists really exists as an AdminGuard route, or as a vendor-data route (no typo can open nothing silently)', () => {
    const vendorData = ['GET /support/tickets/vendor/:vendorId'];
    expect(STAFF_ROLE_EXTENSIONS.SUPPORT.allow.filter((r) => !routes.includes(r) && !vendorData.includes(r))).toEqual([]);
  });
  it('works tickets alongside OPERATIONS, on the desk and on the older routes', () => {
    for (const r of ['GET /v3/admin/tickets', 'PUT /v3/admin/tickets/:id/status', 'POST /v3/admin/tickets/:id/messages', 'GET /support/tickets']) {
      expect(effectiveRolesFor(r)).toEqual(expect.arrayContaining(['OPERATIONS', 'SUPPORT', 'SUPER_ADMIN']));
    }
    expect(effectiveStaffRolesFor('GET /support/tickets/vendor/:vendorId')).toContain('SUPPORT');
    expect(staffMayUse(staff('SUPPORT'), 'GET /support/tickets/vendor/:vendorId')).toBe(true);
  });
  it('can never reach billing or settings: no money or settings route allows it', () => {
    expect(routes.filter((r) => MONEY_OR_SETTINGS.test(r) && allowed('SUPPORT', r))).toEqual([]);
  });
  it('is refused by the commerce, money and LeadSpace guards (they are whitelists now)', () => {
    expect(passes(new CommercialAdminGuard(), 'SUPPORT')).toBe(false);
    expect(passes(new MoneyAdminGuard(), 'SUPPORT')).toBe(false);
    expect(passes(new LeadspaceStaffGuard(), 'SUPPORT')).toBe(false);
  });
});

describe('SALES (the MARKETING value)', () => {
  it('can create on behalf and follow up on seeded listings, but not touch the register, removals, the indexing mode or any money or settings route', () => {
    for (const r of ['POST /v3/admin/seeded-sites', 'POST /v3/admin/seeded-sites/batches/dry-run', 'POST /v3/admin/seeded-sites/batches/apply', 'PUT /v3/admin/seeded-sites/:id/outreach', 'POST /v3/admin/seeded-sites/:id/claim-link']) expect(allowed('MARKETING', r)).toBe(true);
    for (const r of ['POST /v3/admin/seeded-sites/register', 'POST /v3/admin/seeded-sites/:id/removal', 'GET /v3/admin/seeded-sites/indexing-mode', 'PUT /v3/admin/seeded-sites/indexing-mode']) expect(allowed('MARKETING', r)).toBe(false);
    expect(routes.filter((r) => MONEY_OR_SETTINGS.test(r) && allowed('MARKETING', r))).toEqual([]);
  });
  it('stays closed on commerce', () => { expect(passes(new CommercialAdminGuard(), 'MARKETING')).toBe(false); expect(passes(new MoneyAdminGuard(), 'MARKETING')).toBe(false); });
});

describe('ADMIN', () => {
  it('may do what OPERATIONS may do, except the routes its extension denies (system settings and the price book)', () => {
    const denied = new Set(STAFF_ROLE_EXTENSIONS.ADMIN.deny);
    const expected = routes.filter((r) => effectiveRolesFor(r).includes('OPERATIONS') && !denied.has(r));
    for (const r of expected) expect(allowed('ADMIN', r)).toBe(true);
    for (const r of denied) if (routes.includes(r)) expect(allowed('ADMIN', r)).toBe(false);
  });
  it('is never allowed on a route that is SUPER_ADMIN only in the base table, except the three pack engine content routes', () => {
    const content = new Set(STAFF_ROLE_EXTENSIONS.ADMIN.allow);
    const wrongly = routes.filter((r) => rolesFor(r).length === 1 && rolesFor(r)[0] === 'SUPER_ADMIN' && !content.has(r) && allowed('ADMIN', r));
    expect(wrongly).toEqual([]);
  });
  it('edits packs, tabs and the category map, but not the tier matrix, the two switches or an add-on', () => {
    for (const r of ['PUT /v3/admin/pack-engine/packs/:key', 'PUT /v3/admin/pack-engine/tabs', 'PUT /v3/admin/pack-engine/categories/:categoryKey']) expect(allowed('ADMIN', r)).toBe(true);
    for (const r of ['PUT /v3/admin/pack-engine/tier-matrix/:tier/:capabilityKey', 'PUT /v3/admin/pack-engine/settings/:name', 'PUT /v3/admin/pack-engine/vendors/:vendorId/addons/:addonKey', 'GET /v3/admin/pack-engine/settings']) expect(allowed('ADMIN', r)).toBe(false);
  });
  it('cannot change a plan, a price, a tax rate, a platform setting, a terms document or an AI provider', () => {
    for (const r of ['PUT /v3/admin/plan-settings/:key', 'POST /v3/admin/plans', 'POST /v3/admin/tax-rates', 'POST /v3/admin/terms/:id/publish', 'POST /v3/admin/ai/providers', 'POST /v3/admin/wallets/:vendorId/adjustments', 'POST /v3/admin/billing/orders/:id/mark-paid']) expect(allowed('ADMIN', r)).toBe(false);
  });
  it('is closed on the commerce and money guards until the owner opens them', () => { expect(passes(new CommercialAdminGuard(), 'ADMIN')).toBe(false); expect(passes(new MoneyAdminGuard(), 'ADMIN')).toBe(false); });
});

describe('the old three roles are unchanged', () => {
  it('OPERATIONS, SUPER_ADMIN and the seeded admin row still pass commerce', () => {
    expect(passes(new CommercialAdminGuard(), 'OPERATIONS')).toBe(true);
    expect(passes(new CommercialAdminGuard(), 'SUPER_ADMIN')).toBe(true);
    expect(passes(new MoneyAdminGuard(), undefined)).toBe(true);
  });
  it('a route nobody lists is still SUPER_ADMIN only for every role', () => {
    expect([...effectiveRolesFor('GET /v3/admin/nothing-here')]).toEqual(['SUPER_ADMIN']);
  });
});
