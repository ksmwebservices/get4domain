import * as path from 'path';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { ADMIN_ROLE_MATRIX, rolesFor, StaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { scanRoutes } from './support/route-scan';

/**
 * S7: AdminGuard used to check only "is this an admin?", so MARKETING and OPERATIONS staff could do everything a super admin could
 * (delete or suspend vendors, mark invoices paid, deduct wallets). It now checks the staff role against a central matrix, deny by default.
 *
 * ORACLE: the owner-approved matrix, typed out independently of the implementation. Three tiers:
 *   SUPER_ADMIN only   -> platform accounting, Demo Bookings (/leads), vendor DELETE (tightened to match the admin UI)
 *   MARKETING denied   -> money, plans, vendors (incl. suspend), support, domains, platform content, demo data (OPERATIONS and SUPER_ADMIN allowed)
 *   everyone allowed   -> CRM, quotes, AI templates, usage analytics, campaigns, managed services, push, themes GET
 */
const SUPER_ONLY_ROUTES = [
  'GET /v3/admin/alert-rules', 'PUT /v3/admin/alert-rules',   // Batch 4B slice 5.20: the alert rules are SUPER_ADMIN only
  'GET /v3/admin/prohibited-terms', 'POST /v3/admin/prohibited-terms', 'PUT /v3/admin/prohibited-terms/:id', 'DELETE /v3/admin/prohibited-terms/:id',   // Batch 4B slice 5.21: the prohibited phrases
  'POST /v3/admin/takedowns', 'POST /v3/admin/takedowns/:id/reverse',   // Batch 4B slice 5.21: a legal takedown is created and reversed by SUPER_ADMIN only
  'GET /analytics/platform-accounting',   // accounts: MARKETING refused on all accounts routes, and OPERATIONS matches the admin UI
  'GET /leads', 'PUT /leads/:id/status',  // Demo Bookings
  'DELETE /vendors/:id',                  // deleting a vendor; suspend and activate stay OPERATIONS + SUPER_ADMIN
  // S51.6: every WRITE of the plans slice is a money rule, SUPER_ADMIN only
  'POST /v3/admin/plans', 'PUT /v3/admin/plans/:id', 'DELETE /v3/admin/plans/:id',
  'POST /v3/admin/plans/:id/prices', 'PUT /v3/admin/prices/:priceId', 'DELETE /v3/admin/prices/:priceId',
  'POST /v3/admin/features', 'PUT /v3/admin/features/:key', 'DELETE /v3/admin/features/:key', 'PUT /v3/admin/plans/:id/features',
  'POST /v3/admin/tax-rates', 'PUT /v3/admin/tax-rates/:id', 'DELETE /v3/admin/tax-rates/:id',
  'POST /v3/admin/discount-rules', 'PUT /v3/admin/discount-rules/:id', 'DELETE /v3/admin/discount-rules/:id',
  'PUT /v3/admin/plan-settings/:key',
  'POST /v3/admin/vendors/:id/subscription', 'POST /v3/admin/vendors/:id/overrides', 'PUT /v3/admin/overrides/:overrideId', 'DELETE /v3/admin/overrides/:overrideId',
  'PUT /v3/admin/vendors/:id/flags/v3_plans',
  // B2 slice 5.11: only SUPER_ADMIN touches AI providers (secrets), prompts and credit grants
  'GET /v3/admin/ai/providers', 'POST /v3/admin/ai/providers', 'PUT /v3/admin/ai/providers/:id', 'POST /v3/admin/ai/providers/:id/test', 'GET /v3/admin/ai/prompts', 'POST /v3/admin/ai/prompts', 'POST /v3/admin/ai/prompts/:id/activate', 'POST /v3/admin/ai/credit-grants',
  // B3 slice 5.15: legal documents are written and published by SUPER_ADMIN only
  'GET /v3/admin/terms', 'GET /v3/admin/terms/:id', 'POST /v3/admin/terms/kinds/:kind/drafts', 'PUT /v3/admin/terms/:id', 'POST /v3/admin/terms/:id/publish',
  // B3 slice 5.13a: the seeded-site indexing mode
  'PUT /v3/admin/seeded-sites/indexing-mode',
  // B4 slice 5.16b: only SUPER_ADMIN approves or retires a price
  'POST /v3/admin/services/prices/:id/approve', 'POST /v3/admin/services/prices/:id/retire', 'POST /v3/admin/packs/prices/:id/approve', 'POST /v3/admin/packs/prices/:id/retire',
  // B4 slice 5.16a: only SUPER_ADMIN adds or removes wallet credit by hand, or freezes a wallet
  'POST /v3/admin/wallets/:vendorId/adjustments', 'PUT /v3/admin/wallets/:vendorId/frozen',
  // B2 slice 5.1b: only SUPER_ADMIN marks a plan order paid offline or records a refund
  'POST /v3/admin/billing/orders/:id/mark-paid', 'POST /v3/admin/billing/orders/:id/refund',
];
const MARKETING_DENIED = [
  'POST /addons/vendor/:key/enable', 'POST /addons/vendor/:key/disable', 'POST /modules/vendor/:key/enable', 'POST /modules/vendor/:key/disable',
  'PUT /cms/platform', 'POST /demo/seed', 'POST /demo/cleanup-sandboxes',
  'GET /admin/domain-campaign/leads', 'POST /admin/domain-campaign/clients', 'GET /admin/domain-campaign/clients', 'GET /admin/domain-campaign/records',
  'POST /admin/domain-campaign/records', 'GET /admin/domain-campaign/records/vendor/:vendorId', 'POST /admin/domain-campaign/records/:id/invoice',
  'GET /admin/domains', 'POST /admin/domains/register', 'POST /admin/domains/connect', 'POST /admin/domains/verify',
  'GET /industries/vendor/:vendorId/override', 'PUT /industries/vendor/:vendorId/override',
  'POST /invoices', 'GET /invoices', 'POST /invoices/:id/send-payment-link', 'POST /invoices/:id/mark-paid',
  'POST /subscriptions', 'GET /subscriptions', 'PUT /subscriptions/:id/activate', 'PUT /subscriptions/:id/cancel',
  'GET /admin/vendor-comms', 'PATCH /admin/vendor-comms',
  'GET /vendors', 'POST /vendors', 'GET /vendors/:id', 'PUT /vendors/:id', 'POST /vendors/:id/suspend', 'POST /vendors/:id/activate',
  'GET /support/tickets', 'PUT /support/tickets/:id/reply', 'PUT /support/tickets/:id/resolve',
  'POST /wallet/deduct',
  'POST /website-themes', 'PUT /website-themes/:id', 'DELETE /website-themes/:id',
  // S51.6: reads of the plans slice (OPERATIONS and SUPER_ADMIN; MARKETING refused)
  'GET /v3/admin/plans', 'GET /v3/admin/plans/:id', 'GET /v3/admin/plans/:id/prices', 'GET /v3/admin/plans/:id/features', 'GET /v3/admin/features',
  'GET /v3/admin/tax-rates', 'GET /v3/admin/discount-rules', 'GET /v3/admin/plan-settings', 'GET /v3/admin/audit-logs',
  'GET /v3/admin/vendors/:id/subscription', 'GET /v3/admin/vendors/:id/overrides', 'GET /v3/admin/vendors/:id/entitlements',
  // B2 slice 5.11: reading AI usage is OPERATIONS and SUPER_ADMIN
  'GET /v3/admin/ai/usage',
  // B4 slice 5.16d: switching a vendor's theme for them (it can charge their wallet), their switch history and the recovery of stuck switches: OPERATIONS and SUPER_ADMIN
  'POST /v3/admin/vendors/:vendorId/site/theme/switch', 'GET /v3/admin/vendors/:vendorId/site/theme/history', 'POST /v3/admin/theme-switches/recover',
  // Batch 4B slice 5.20: alerts, a vendor's activity and the attention board
  'GET /v3/admin/alerts', 'GET /v3/admin/alerts/:id', 'PATCH /v3/admin/alerts/:id', 'GET /v3/admin/vendors/:vendorId/activity', 'GET /v3/admin/attention',
  // Batch 4B slice 5.21: reports, proofs, the block list and the takedown list
  'GET /v3/admin/business-reports', 'PATCH /v3/admin/business-reports/:id', 'GET /v3/admin/trust-blocklist', 'POST /v3/admin/trust-blocklist', 'DELETE /v3/admin/trust-blocklist/:id', 'GET /v3/admin/business-proofs', 'PATCH /v3/admin/business-proofs/:id', 'GET /v3/admin/takedowns',
  // B4 slice 5.16c: the service request queue and its work: OPERATIONS and SUPER_ADMIN, MARKETING refused
  'GET /v3/admin/service-requests', 'POST /v3/admin/service-requests/sla-sweep', 'POST /v3/admin/service-requests/auto-approve-run', 'GET /v3/admin/service-requests/:id', 'POST /v3/admin/service-requests/:id/assign', 'POST /v3/admin/service-requests/:id/status',
  'POST /v3/admin/service-requests/:id/deliverables', 'POST /v3/admin/service-requests/:id/reject', 'POST /v3/admin/service-requests/:id/retry-grant', 'POST /v3/admin/vendors/:vendorId/service-requests',
  // B4 slice 5.16b: changing the catalogue and proposing or editing a price: OPERATIONS and SUPER_ADMIN
  'POST /v3/admin/services', 'PUT /v3/admin/services/:key', 'POST /v3/admin/services/:key/prices', 'PUT /v3/admin/services/prices/:id', 'POST /v3/admin/packs', 'PUT /v3/admin/packs/:key', 'POST /v3/admin/packs/:key/prices', 'PUT /v3/admin/packs/prices/:id',
  // B4 slice 5.16a: wallets are money: reads, the reconciliation report and the expiry run are OPERATIONS and SUPER_ADMIN
  'GET /v3/admin/wallets', 'GET /v3/admin/wallets/reconciliation', 'POST /v3/admin/wallets/expiry-run', 'GET /v3/admin/wallets/:vendorId', 'GET /v3/admin/wallets/:vendorId/ledger', 'GET /v3/admin/wallets/:vendorId/reconcile',
  // B2 slice 5.1b: reading orders and the payment inbox is OPERATIONS and SUPER_ADMIN
  'GET /v3/admin/billing/orders', 'GET /v3/admin/billing/payment-events',
  // B2 slice 5.7: directory writes, the claim phone override and removal requests (contact details): OPERATIONS and SUPER_ADMIN only
  'POST /v3/admin/directory/locations', 'PUT /v3/admin/directory/locations/:id', 'POST /v3/admin/directory/categories', 'PUT /v3/admin/directory/categories/:id', 'POST /v3/admin/directory/businesses', 'PUT /v3/admin/directory/businesses/:id',
  'POST /v3/admin/directory/businesses/:id/moderate', 'POST /v3/admin/directory/businesses/:id/placements', 'POST /v3/admin/directory/placements/:id/revoke', 'POST /v3/admin/directory/businesses/:id/claim-phone-override',
  'GET /v3/admin/directory/removal-requests', 'POST /v3/admin/directory/removal-requests/:id/approve', 'POST /v3/admin/directory/removal-requests/:id/reject', 'POST /v3/admin/directory/removal-requests/:id/execute',
  // B2 slice 5.6: vendors' addresses. Reads included, because a host name can identify a business: OPERATIONS and SUPER_ADMIN only.
  'GET /v3/admin/domains', 'GET /v3/admin/domains/:id', 'POST /v3/admin/domains/:id/verify', 'PUT /v3/admin/domains/:id/state', 'POST /v3/admin/domains/:id/primary',
  'POST /v3/admin/domains/:id/remove', 'PUT /v3/admin/vendors/:id/domains/subdomain',
  // B3 slice 5.14: requests, the outbox, reports and the blocklist
  'GET /v3/admin/requests', 'GET /v3/admin/requests/:id', 'GET /v3/admin/message-outbox', 'GET /v3/admin/reports', 'POST /v3/admin/reports/:id/handle', 'GET /v3/admin/blocklist', 'POST /v3/admin/blocklist', 'DELETE /v3/admin/blocklist/:id',
  // B3 slice 5.13a: seeded sites
  'POST /v3/admin/seeded-sites', 'POST /v3/admin/seeded-sites/batches/dry-run', 'POST /v3/admin/seeded-sites/batches/apply', 'GET /v3/admin/seeded-sites/register', 'POST /v3/admin/seeded-sites/register', 'GET /v3/admin/seeded-sites/indexing-mode', 'PUT /v3/admin/seeded-sites/:id/outreach', 'POST /v3/admin/seeded-sites/:id/calls', 'PUT /v3/admin/seeded-sites/:id/consent', 'POST /v3/admin/seeded-sites/:id/claim-link', 'POST /v3/admin/seeded-sites/:id/claim-link/revoke', 'POST /v3/admin/seeded-sites/:id/removal',
  // B3 slice 5.7b: the Visit-site report across vendors
  'GET /v3/admin/directory/visits',
  // B3 slice 5.6b: the canonical host and the custom-domain promotion add-on
  'GET /v3/admin/vendors/:id/canonical', 'POST /v3/admin/vendors/:id/custom-domain-addon', 'POST /v3/admin/vendors/:id/custom-domain-addon/end',
  // B3 slice 5.1d: lifecycle actions and the owner deletion queue (a deletion request identifies a business): OPERATIONS and SUPER_ADMIN
  'GET /v3/admin/vendors/:id/lifecycle', 'POST /v3/admin/vendors/:id/lifecycle/convert-to-free', 'POST /v3/admin/vendors/:id/lifecycle/restore-pro', 'POST /v3/admin/vendors/:id/lifecycle/extend-grace', 'POST /v3/admin/vendors/:id/lifecycle/suspend', 'POST /v3/admin/vendors/:id/lifecycle/reinstate', 'POST /v3/admin/vendors/:id/lifecycle/delete-empty-listing', 'GET /v3/admin/account-deletions', 'GET /v3/admin/account-deletions/:id', 'POST /v3/admin/account-deletions/:id/execute',
  // S53.7: provisioning is onboarding work: OPERATIONS and SUPER_ADMIN read and write, MARKETING refused everywhere (a job holds a phone number and an email)
  'POST /v3/admin/provisioning/jobs', 'GET /v3/admin/provisioning/jobs', 'GET /v3/admin/provisioning/jobs/:id',
  'POST /v3/admin/provisioning/jobs/:id/retry', 'POST /v3/admin/provisioning/jobs/:id/cancel', 'POST /v3/admin/provisioning/jobs/:id/run',
  'POST /v3/admin/vendors/:id/claim-link/reissue', 'POST /v3/admin/vendors/:id/claim-link/revoke', 'GET /v3/admin/invites',
  // S54.7: sites. Anything that carries html, and every write, is OPERATIONS and SUPER_ADMIN; MARKETING only reads summaries (the two ALL_STAFF routes below)
  'PUT /v3/admin/vendors/:id/site/theme', 'POST /v3/admin/vendors/:id/site/build', 'POST /v3/admin/vendors/:id/site/publish', 'POST /v3/admin/vendors/:id/site/rollback',
  'GET /v3/admin/vendors/:id/site/preview/:publicationId/:path', 'PUT /v3/admin/vendors/:id/site/noindex',
];
const ALL_STAFF_ROUTES = [
  'GET /admin/crm/leads', 'GET /admin/crm/leads/:id', 'PUT /admin/crm/leads/:id', 'POST /admin/crm/leads/:id/call',
  'GET /admin-team/me',
  'GET /ai-templates/all', 'POST /ai-templates', 'PUT /ai-templates/:id', 'DELETE /ai-templates/:id',
  'GET /analytics/usage/all',
  'GET /campaigns/admin/all', 'POST /growth-hub/ads/:id/launch',
  'GET /admin/managed-services/leads', 'GET /admin/managed-services/catalog', 'POST /admin/managed-services/catalog', 'PUT /admin/managed-services/catalog/:id',
  'POST /notifications/push',
  'POST /admin/quotes', 'GET /admin/quotes', 'GET /admin/quotes/:id', 'PUT /admin/quotes/:id/status', 'POST /admin/quotes/proposals', 'GET /admin/quotes/:id/pdf', 'POST /admin/quotes/:id/share',
  'GET /website-themes/all', 'GET /website-themes/:id/unlocks',
  'GET /v3/admin/sites', 'GET /v3/admin/vendors/:id/site',   // S54.7: summaries only, never html
  // B4 slice 5.16b: all staff read the catalogue; MARKETING gets no money field (tested in services-api.spec.ts)
  'GET /v3/admin/services', 'GET /v3/admin/services/:key', 'GET /v3/admin/packs', 'GET /v3/admin/packs/:key',
  // B3 slice 5.13a: MARKETING reads the seeded list and one site, non-personal fields only
  'GET /v3/admin/seeded-sites', 'GET /v3/admin/seeded-sites/:id',
  // B2 slice 5.7: business reads (MARKETING gets them without personal fields: tested in directory-api.spec.ts), tree reads, placements read
  'GET /v3/admin/directory/locations', 'GET /v3/admin/directory/categories', 'GET /v3/admin/directory/businesses', 'GET /v3/admin/directory/businesses/:id', 'GET /v3/admin/directory/businesses/:id/placements',
];

const scanned = scanRoutes(path.resolve(__dirname, '../src')).filter((r) => r.adminGuard === true).map((r) => r.route);

const principal = (role: StaffRole | 'VENDOR' | 'bootstrap'): AuthenticatedUser | undefined => {
  if (role === 'VENDOR') return { sub: 'v', email: 'v@x.invalid', role: 'VENDOR' };
  if (role === 'bootstrap') return { sub: 'b', email: 'b@x.invalid', role: 'ADMIN', adminRole: 'SUPER_ADMIN' };   // the seeded admin Vendor row, as JwtStrategy returns it
  return { sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role };
};
const ctx = (user: AuthenticatedUser | undefined, routeKey: string | null): ExecutionContext => {
  const [method, routePath] = routeKey ? [routeKey.split(' ')[0], routeKey.slice(routeKey.indexOf(' ') + 1)] : ['GET', undefined];
  return { switchToHttp: () => ({ getRequest: () => ({ user, method, route: routePath === undefined ? undefined : { path: routePath } }) }) } as unknown as ExecutionContext;
};
const allowed = (user: AuthenticatedUser | undefined, routeKey: string | null): boolean => {
  try { return new AdminGuard().canActivate(ctx(user, routeKey)); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
};

describe('the oracle itself', () => {
  it('lists every AdminGuard route exactly once, and the scanner agrees with it in both directions', () => {
    const oracle = [...SUPER_ONLY_ROUTES, ...MARKETING_DENIED, ...ALL_STAFF_ROUTES];
    expect(oracle).toHaveLength(263);
    expect(new Set(oracle).size).toBe(oracle.length);                              // no route listed twice
    expect([...scanned].sort()).toEqual([...oracle].sort());                       // nothing missing, nothing misspelled
  });
});

describe('admin-role-matrix (the implementation must reproduce the oracle)', () => {
  it('has an entry for every route that uses AdminGuard (deny-by-default means a gap is SUPER_ADMIN only)', () => {
    expect(scanned.filter((r) => !(r in ADMIN_ROLE_MATRIX))).toEqual([]);
  });
  it('has no entry that matches no real AdminGuard route (typos)', () => {
    expect(Object.keys(ADMIN_ROLE_MATRIX).filter((k) => !scanned.includes(k))).toEqual([]);
  });
  it.each(SUPER_ONLY_ROUTES.map((r) => [r]))('ONLY SUPER_ADMIN is allowed on %s', (route) => {
    expect([...rolesFor(route)]).toEqual(['SUPER_ADMIN']);
  });
  it.each(MARKETING_DENIED.map((r) => [r]))('MARKETING is NOT allowed on %s, OPERATIONS and SUPER_ADMIN are', (route) => {
    expect([...rolesFor(route)].sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']);
  });
  it.each(ALL_STAFF_ROUTES.map((r) => [r]))('all three staff roles are allowed on %s', (route) => {
    expect([...rolesFor(route)].sort()).toEqual(['MARKETING', 'OPERATIONS', 'SUPER_ADMIN']);
  });
  it('an unlisted route is SUPER_ADMIN only', () => {
    expect([...rolesFor('GET /not/in/the/matrix')]).toEqual(['SUPER_ADMIN']);
  });
});

describe('AdminGuard', () => {
  it('MARKETING is refused with 403 on every money / vendor / support / plan / domain / platform / accounts route', () => {
    const wrongly = [...MARKETING_DENIED, ...SUPER_ONLY_ROUTES].filter((r) => allowed(principal('MARKETING'), r));
    expect(wrongly).toEqual([]);
  });
  it('MARKETING keeps the routes its work needs', () => {
    expect(ALL_STAFF_ROUTES.filter((r) => !allowed(principal('MARKETING'), r))).toEqual([]);
  });
  it('OPERATIONS can use every route except the four SUPER_ADMIN-only ones', () => {
    expect([...MARKETING_DENIED, ...ALL_STAFF_ROUTES].filter((r) => !allowed(principal('OPERATIONS'), r))).toEqual([]);
    expect(SUPER_ONLY_ROUTES.filter((r) => allowed(principal('OPERATIONS'), r))).toEqual([]);
  });
  it('SUPER_ADMIN can use every AdminGuard route', () => {
    expect([...SUPER_ONLY_ROUTES, ...MARKETING_DENIED, ...ALL_STAFF_ROUTES].filter((r) => !allowed(principal('SUPER_ADMIN'), r))).toEqual([]);
  });
  it('vendors: OPERATIONS may suspend and activate but not delete', () => {
    expect(allowed(principal('OPERATIONS'), 'POST /vendors/:id/suspend')).toBe(true);
    expect(allowed(principal('OPERATIONS'), 'POST /vendors/:id/activate')).toBe(true);
    expect(allowed(principal('OPERATIONS'), 'DELETE /vendors/:id')).toBe(false);
    expect(allowed(principal('SUPER_ADMIN'), 'DELETE /vendors/:id')).toBe(true);
  });
  it('the seeded admin (an admin Vendor row, adminRole SUPER_ADMIN) can use everything, including an unlisted route', () => {
    expect(allowed(principal('bootstrap'), 'DELETE /vendors/:id')).toBe(true);
    expect(allowed(principal('bootstrap'), 'GET /not/in/the/matrix')).toBe(true);
  });
  it('DENY BY DEFAULT: an AdminGuard route with no matrix entry is refused to OPERATIONS and MARKETING, open to SUPER_ADMIN', () => {
    expect(allowed(principal('OPERATIONS'), 'GET /not/in/the/matrix')).toBe(false);
    expect(allowed(principal('MARKETING'), 'GET /not/in/the/matrix')).toBe(false);
    expect(allowed(principal('SUPER_ADMIN'), 'GET /not/in/the/matrix')).toBe(true);
  });
  it('a request that does not say which route it is (no req.route) is treated as unlisted', () => {
    expect(allowed(principal('OPERATIONS'), null)).toBe(false);
    expect(allowed(principal('SUPER_ADMIN'), null)).toBe(true);
  });
  it('a trailing slash does not change the answer', () => {
    expect(allowed(principal('MARKETING'), 'DELETE /vendors/:id/')).toBe(false);
    expect(allowed(principal('MARKETING'), 'GET /admin/quotes/')).toBe(true);
    expect(allowed(principal('OPERATIONS'), 'GET /leads/')).toBe(false);
  });
  it('vendors, team members and anonymous callers are still refused', () => {
    expect(allowed(principal('VENDOR'), 'GET /leads')).toBe(false);
    expect(allowed({ sub: 'v', email: 'v@x.invalid', role: 'VENDOR', kind: 'team_member' }, 'GET /leads')).toBe(false);
    expect(allowed(undefined, 'GET /leads')).toBe(false);
  });
  it('an admin principal with no staff role is refused except the SUPER_ADMIN role itself', () => {
    expect(allowed({ sub: 'x', email: 'x@x.invalid', role: 'ADMIN' }, 'GET /leads')).toBe(false);
    expect(allowed({ sub: 'x', email: 'x@x.invalid', role: 'SUPER_ADMIN' }, 'GET /leads')).toBe(true);
  });
  it('an unknown adminRole value is refused', () => {
    expect(allowed({ sub: 'x', email: 'x@x.invalid', role: 'ADMIN', adminRole: 'INTERN' }, 'GET /leads')).toBe(false);
  });
  it('the refusal says why in plain words and does not name the matrix', () => {
    let message = '';
    try { new AdminGuard().canActivate(ctx(principal('MARKETING'), 'DELETE /vendors/:id')); } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/staff role/i);
    expect(message).not.toMatch(/matrix|OPERATIONS|SUPER_ADMIN/);
  });
});
