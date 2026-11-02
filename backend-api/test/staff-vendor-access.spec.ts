import * as fs from 'fs';
import * as path from 'path';
import { STAFF_VENDOR_ACCESS_MATRIX, staffRolesFor, StaffRole } from '../src/auth/guards/admin-role-matrix';
import { assertOwnerOrStaff, isStaffPrincipal, staffMayUse } from '../src/auth/guards/staff-access';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { scanRoutes } from './support/route-scan';

/**
 * S7-B: eleven controllers decided "is this an admin?" inline (`role === 'ADMIN' || role === 'SUPER_ADMIN'`), so MARKETING and OPERATIONS
 * staff could read or change ANY vendor's invoices, subscriptions, support tickets, CMS, add-ons, modules, stock and notifications.
 * They now ask the staff-role matrix (auth/guards/admin-role-matrix.ts), keyed by the route, deny by default. SUPER_ADMIN is unchanged.
 *
 * ORACLE typed independently of the implementation:
 *   OPERATIONS + SUPER_ADMIN   cross-vendor data and management (MARKETING refused, as for the same data under AdminGuard in S7)
 *   all staff                  free internal AI / video / reel generation (existing behaviour, kept)
 */
const OPS_AND_SUPER_ROUTES = [
  'PUT /cms/vendor/:vendorId', 'GET /cms/vendor/:vendorId/products/manage', 'GET /cms/vendor/:vendorId/categories/manage',
  'POST /cms/vendor/:vendorId/categories', 'PUT /cms/vendor/:vendorId/categories/order', 'PUT /cms/vendor/:vendorId/categories/:id',
  'DELETE /cms/vendor/:vendorId/categories/:id', 'POST /cms/vendor/:vendorId/products', 'PUT /cms/products/:id', 'DELETE /cms/products/:id',
  'GET /invoices/vendor/:vendorId', 'GET /invoices/:id', 'GET /invoices/:id/pdf', 'POST /invoices/:id/email',
  'GET /subscriptions/vendor/:vendorId',
  'GET /support/tickets/vendor/:vendorId',
  'GET /addons/vendor', 'GET /modules/vendor',
  'GET /notifications', 'PUT /notifications/:id/read', 'PUT /notifications/read-all', 'POST /notifications/subscribe',
  'POST /stock/products/:productId/adjust', 'GET /stock/products/:productId/history',
];
const ALL_STAFF_ROUTES = ['POST /ai/generate-content', 'POST /ai/call-summary', 'POST /ai/generate-image', 'POST /video/generate', 'POST /reels/render'];

const SRC = path.resolve(__dirname, '../src');
const scanned = scanRoutes(SRC).filter((r) => r.staffMatrix === true).map((r) => r.route);

const staff = (role: StaffRole | 'LEGACY_SUPER'): AuthenticatedUser =>
  role === 'LEGACY_SUPER'
    ? { sub: 'v1', email: 'a@x.invalid', role: 'ADMIN', adminRole: 'SUPER_ADMIN' }                                   // the seeded admin Vendor row
    : { sub: 's1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role };
const vendor: AuthenticatedUser = { sub: 'v-own', email: 'v@x.invalid', role: 'VENDOR' };

describe('the oracle itself', () => {
  it('lists every route that asks the matrix, exactly once, and the scanner agrees in both directions', () => {
    const oracle = [...OPS_AND_SUPER_ROUTES, ...ALL_STAFF_ROUTES];
    expect(new Set(oracle).size).toBe(oracle.length);
    expect([...scanned].sort()).toEqual([...oracle].sort());
  });
});

describe('staff-vendor-access matrix (the implementation must reproduce the oracle)', () => {
  it('has an entry for every route that asks it (a gap would be SUPER_ADMIN only, but a gap must not reach a commit)', () => {
    expect(scanned.filter((r) => !(r in STAFF_VENDOR_ACCESS_MATRIX))).toEqual([]);
  });
  it('has no entry that matches no real route (typos)', () => {
    expect(Object.keys(STAFF_VENDOR_ACCESS_MATRIX).filter((k) => !scanned.includes(k))).toEqual([]);
  });
  it.each(OPS_AND_SUPER_ROUTES.map((r) => [r]))('MARKETING is NOT allowed on %s; OPERATIONS and SUPER_ADMIN are', (route) => {
    expect([...staffRolesFor(route)].sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']);
  });
  it.each(ALL_STAFF_ROUTES.map((r) => [r]))('all three staff roles keep %s', (route) => {
    expect([...staffRolesFor(route)].sort()).toEqual(['MARKETING', 'OPERATIONS', 'SUPER_ADMIN']);
  });
  it('an unlisted route is SUPER_ADMIN only (deny by default)', () => {
    expect([...staffRolesFor('GET /not/in/the/matrix')]).toEqual(['SUPER_ADMIN']);
  });
});

describe('staffMayUse / assertOwnerOrStaff', () => {
  it('SUPER_ADMIN (an admin member, or the seeded admin vendor row) is unchanged: allowed everywhere, even on an unlisted route', () => {
    for (const who of [staff('SUPER_ADMIN'), staff('LEGACY_SUPER')]) {
      for (const r of [...OPS_AND_SUPER_ROUTES, ...ALL_STAFF_ROUTES, 'GET /not/in/the/matrix']) expect(staffMayUse(who, r)).toBe(true);
    }
  });
  it('OPERATIONS may use every listed route but not an unlisted one', () => {
    for (const r of [...OPS_AND_SUPER_ROUTES, ...ALL_STAFF_ROUTES]) expect(staffMayUse(staff('OPERATIONS'), r)).toBe(true);
    expect(staffMayUse(staff('OPERATIONS'), 'GET /not/in/the/matrix')).toBe(false);
  });
  it('MARKETING is refused on every cross-vendor route and keeps the free-generation routes', () => {
    expect(OPS_AND_SUPER_ROUTES.filter((r) => staffMayUse(staff('MARKETING'), r))).toEqual([]);
    expect(ALL_STAFF_ROUTES.filter((r) => !staffMayUse(staff('MARKETING'), r))).toEqual([]);
  });
  it('a vendor owner is never "staff", and staff with no or an unknown staff role are refused', () => {
    expect(staffMayUse(vendor, 'GET /invoices/:id')).toBe(false);
    expect(staffMayUse({ sub: 'x', email: 'x@x.invalid', role: 'ADMIN' }, 'GET /invoices/:id')).toBe(false);
    expect(staffMayUse({ sub: 'x', email: 'x@x.invalid', role: 'ADMIN', adminRole: 'INTERN' }, 'GET /invoices/:id')).toBe(false);
    expect(staffMayUse({ sub: 'm', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member' }, 'GET /invoices/:id')).toBe(false);
  });
  it('isStaffPrincipal is the one definition of "is Get4Domain staff"', () => {
    expect(isStaffPrincipal(staff('MARKETING'))).toBe(true);
    expect(isStaffPrincipal(staff('LEGACY_SUPER'))).toBe(true);
    expect(isStaffPrincipal({ sub: 'x', email: 'x@x.invalid', role: 'SUPER_ADMIN' })).toBe(true);
    expect(isStaffPrincipal(vendor)).toBe(false);
  });
  it('assertOwnerOrStaff: the owner of that vendor passes; another vendor is refused; staff follow the matrix', () => {
    const route = 'GET /invoices/vendor/:vendorId';
    expect(() => assertOwnerOrStaff(vendor, 'v-own', route, 'no')).not.toThrow();
    expect(() => assertOwnerOrStaff(vendor, 'v-other', route, 'no')).toThrow('no');
    expect(() => assertOwnerOrStaff(staff('OPERATIONS'), 'v-other', route, 'no')).not.toThrow();
    expect(() => assertOwnerOrStaff(staff('SUPER_ADMIN'), 'v-other', route, 'no')).not.toThrow();
    expect(() => assertOwnerOrStaff(staff('MARKETING'), 'v-other', route, 'no')).toThrow('no');
  });
});

describe('no controller decides "is this an admin?" on its own any more', () => {
  /** Files that legitimately read the admin role, each for a reason other than granting a staff member access to a vendor's data. */
  const ALLOWED: Record<string, string> = {
    'auth/guards/admin.guard.ts': 'AdminGuard itself',
    'auth/guards/staff-access.ts': 'the shared helper',
    'auth/guards/super-admin.guard.ts': 'SUPER_ADMIN-only guard',
    'auth/jwt.strategy.ts': 'builds the principal',
    'auth/auth.service.ts': 'builds the login token',
    'account-security/account-directory.service.ts': 'builds the session token',
    'common/tenant/resolve-tenant.ts': 'tenant guard: staff resolve a tenant explicitly (V3 tenant model, reviewed separately)',
    'leadspace/staff.guard.ts': 'its own staff guard (LeadSpace admin controllers)',
    'bos/entitlements.service.ts': 'staff bypass of vendor plan gating (not access to vendor data)',
    'commercial/foundation.services.ts': 'its own CommercialAdminGuard / MoneyAdminGuard role rules',
    'registry/dashboard-context.service.ts': 'refuses staff the vendor dashboard',
    'admin-team/admin-team.controller.ts': 'echoes the caller own role',
  };
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
  const INLINE = /role\s*[!=]==?\s*'(ADMIN|SUPER_ADMIN)'|Boolean\(\s*user\.adminRole\s*\)|u\.role\s*===\s*'ADMIN'/;

  it('only the allow-listed files contain an inline admin-role check', () => {
    const offenders = walk(SRC)
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
      .filter((rel) => !(rel in ALLOWED))
      .filter((rel) => INLINE.test(fs.readFileSync(path.join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('every allow-listed file still exists (the list cannot rot into a blanket exemption)', () => {
    expect(Object.keys(ALLOWED).filter((rel) => !fs.existsSync(path.join(SRC, rel)))).toEqual([]);
  });
});
