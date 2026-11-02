/**
 * Which Get4Domain STAFF role may call which AdminGuard route (S7).
 *
 * Before S7 AdminGuard only asked "is this an admin?", so MARKETING and OPERATIONS staff could do everything a super admin could:
 * delete or suspend vendors, mark invoices paid, deduct wallets, change subscriptions.
 *
 * Keys are "METHOD /full/route/pattern", exactly as Express reports it (`req.route.path`) and as test/support/route-scan.ts lists it.
 * DENY BY DEFAULT: an AdminGuard route with no entry here is SUPER_ADMIN only. `test/admin-role-matrix.spec.ts` fails if any
 * AdminGuard route has no entry here, or an entry here matches no route, so a gap cannot reach a commit.
 *
 * Owner-approved decisions (2026-11-03):
 *   MARKETING is refused on: vendors, subscriptions, invoices, wallet deduction, add-on / module switches, industry overrides, domains,
 *     domain campaign billing, vendor communication settings, platform CMS, demo data, and writes to the theme catalogue.
 *   Tightened to match the admin UI (owner-approved): SUPER_ADMIN ONLY on platform accounting, Demo Bookings (/leads) and vendor DELETE;
 *     support tickets are OPERATIONS + SUPER_ADMIN. Suspend / activate vendor stay OPERATIONS + SUPER_ADMIN.
 *   OPERATIONS and SUPER_ADMIN may use every other AdminGuard route.
 *   MARKETING keeps what its work needs: CRM, quotes, AI templates, usage analytics, campaigns, managed services, push, theme reads.
 * Not changed here (they have their own guards): the commerce / LeadSpace / money admin controllers (CommercialAdminGuard, MoneyAdminGuard,
 * LeadspaceStaffGuard) and SuperAdminGuard routes.
 */
export type StaffRole = 'SUPER_ADMIN' | 'OPERATIONS' | 'MARKETING';

export const ALL_STAFF: readonly StaffRole[] = ['SUPER_ADMIN', 'OPERATIONS', 'MARKETING'];
export const OPS_AND_SUPER: readonly StaffRole[] = ['SUPER_ADMIN', 'OPERATIONS'];
export const SUPER_ONLY: readonly StaffRole[] = ['SUPER_ADMIN'];

export const ADMIN_ROLE_MATRIX: Readonly<Record<string, readonly StaffRole[]>> = {
  // ── Operations + super admin only (MARKETING refused) ────────────────────────────────────────────────
  // vendors: create, read, edit, delete, suspend, activate
  'GET /vendors': OPS_AND_SUPER, 'POST /vendors': OPS_AND_SUPER, 'GET /vendors/:id': OPS_AND_SUPER, 'PUT /vendors/:id': OPS_AND_SUPER,
  'DELETE /vendors/:id': SUPER_ONLY, 'POST /vendors/:id/suspend': OPS_AND_SUPER, 'POST /vendors/:id/activate': OPS_AND_SUPER,
  // subscriptions and invoices (money)
  'POST /subscriptions': OPS_AND_SUPER, 'GET /subscriptions': OPS_AND_SUPER, 'PUT /subscriptions/:id/activate': OPS_AND_SUPER, 'PUT /subscriptions/:id/cancel': OPS_AND_SUPER,
  'POST /invoices': OPS_AND_SUPER, 'GET /invoices': OPS_AND_SUPER, 'POST /invoices/:id/send-payment-link': OPS_AND_SUPER, 'POST /invoices/:id/mark-paid': OPS_AND_SUPER,
  // wallet deduction
  'POST /wallet/deduct': OPS_AND_SUPER,
  // switches that decide what a vendor can open
  'POST /addons/vendor/:key/enable': OPS_AND_SUPER, 'POST /addons/vendor/:key/disable': OPS_AND_SUPER,
  'POST /modules/vendor/:key/enable': OPS_AND_SUPER, 'POST /modules/vendor/:key/disable': OPS_AND_SUPER,
  'GET /industries/vendor/:vendorId/override': OPS_AND_SUPER, 'PUT /industries/vendor/:vendorId/override': OPS_AND_SUPER,
  // domains and domain-campaign billing
  'GET /admin/domains': OPS_AND_SUPER, 'POST /admin/domains/register': OPS_AND_SUPER, 'POST /admin/domains/connect': OPS_AND_SUPER, 'POST /admin/domains/verify': OPS_AND_SUPER,
  'GET /admin/domain-campaign/leads': OPS_AND_SUPER, 'POST /admin/domain-campaign/clients': OPS_AND_SUPER, 'GET /admin/domain-campaign/clients': OPS_AND_SUPER,
  'GET /admin/domain-campaign/records': OPS_AND_SUPER, 'POST /admin/domain-campaign/records': OPS_AND_SUPER,
  'GET /admin/domain-campaign/records/vendor/:vendorId': OPS_AND_SUPER, 'POST /admin/domain-campaign/records/:id/invoice': OPS_AND_SUPER,
  // per-vendor communication settings, platform CMS, demo data, theme catalogue writes
  'GET /admin/vendor-comms': OPS_AND_SUPER, 'PATCH /admin/vendor-comms': OPS_AND_SUPER,
  'PUT /cms/platform': OPS_AND_SUPER,
  'POST /demo/seed': OPS_AND_SUPER, 'POST /demo/cleanup-sandboxes': OPS_AND_SUPER,
  'POST /website-themes': OPS_AND_SUPER, 'PUT /website-themes/:id': OPS_AND_SUPER, 'DELETE /website-themes/:id': OPS_AND_SUPER,

  // ── All staff (what marketing and support work needs) ───────────────────────────────────────────────
  'GET /admin/crm/leads': ALL_STAFF, 'GET /admin/crm/leads/:id': ALL_STAFF, 'PUT /admin/crm/leads/:id': ALL_STAFF, 'POST /admin/crm/leads/:id/call': ALL_STAFF,
  'GET /admin-team/me': ALL_STAFF,
  'GET /ai-templates/all': ALL_STAFF, 'POST /ai-templates': ALL_STAFF, 'PUT /ai-templates/:id': ALL_STAFF, 'DELETE /ai-templates/:id': ALL_STAFF,
  'GET /analytics/usage/all': ALL_STAFF, 'GET /analytics/platform-accounting': SUPER_ONLY,   // owner-approved: matches the admin UI (accounts are SUPER_ADMIN only)
  'GET /campaigns/admin/all': ALL_STAFF, 'POST /growth-hub/ads/:id/launch': ALL_STAFF,
  'GET /leads': SUPER_ONLY, 'PUT /leads/:id/status': SUPER_ONLY,   // Demo Bookings: SUPER_ADMIN only (owner-approved)
  'GET /admin/managed-services/leads': ALL_STAFF, 'GET /admin/managed-services/catalog': ALL_STAFF, 'POST /admin/managed-services/catalog': ALL_STAFF, 'PUT /admin/managed-services/catalog/:id': ALL_STAFF,
  'POST /notifications/push': ALL_STAFF,
  'POST /admin/quotes': ALL_STAFF, 'GET /admin/quotes': ALL_STAFF, 'GET /admin/quotes/:id': ALL_STAFF, 'PUT /admin/quotes/:id/status': ALL_STAFF,
  'POST /admin/quotes/proposals': ALL_STAFF, 'GET /admin/quotes/:id/pdf': ALL_STAFF, 'POST /admin/quotes/:id/share': ALL_STAFF,
  'GET /support/tickets': OPS_AND_SUPER, 'PUT /support/tickets/:id/reply': OPS_AND_SUPER, 'PUT /support/tickets/:id/resolve': OPS_AND_SUPER,   // MARKETING out (owner-approved)
  'GET /website-themes/all': ALL_STAFF, 'GET /website-themes/:id/unlocks': ALL_STAFF,
};

/** Roles allowed on a route; a route with no entry is SUPER_ADMIN only (deny by default). */
export function rolesFor(routeKey: string): readonly StaffRole[] {
  return ADMIN_ROLE_MATRIX[routeKey] ?? SUPER_ONLY;
}
