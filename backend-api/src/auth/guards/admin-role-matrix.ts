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

  // ── V3 slice 5.1: plans, prices, features, taxes, discounts, settings, assignments, overrides ───────────────────────────
  // Reads: OPERATIONS and SUPER_ADMIN (MARKETING refused). Every WRITE is a money rule: SUPER_ADMIN only.
  'GET /v3/admin/plans': OPS_AND_SUPER, 'GET /v3/admin/plans/:id': OPS_AND_SUPER, 'GET /v3/admin/plans/:id/prices': OPS_AND_SUPER, 'GET /v3/admin/plans/:id/features': OPS_AND_SUPER,
  'GET /v3/admin/features': OPS_AND_SUPER, 'GET /v3/admin/tax-rates': OPS_AND_SUPER, 'GET /v3/admin/discount-rules': OPS_AND_SUPER, 'GET /v3/admin/plan-settings': OPS_AND_SUPER,
  'GET /v3/admin/audit-logs': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/subscription': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/overrides': OPS_AND_SUPER,
  'GET /v3/admin/vendors/:id/entitlements': OPS_AND_SUPER,
  'POST /v3/admin/plans': SUPER_ONLY, 'PUT /v3/admin/plans/:id': SUPER_ONLY, 'DELETE /v3/admin/plans/:id': SUPER_ONLY,
  'POST /v3/admin/plans/:id/prices': SUPER_ONLY, 'PUT /v3/admin/prices/:priceId': SUPER_ONLY, 'DELETE /v3/admin/prices/:priceId': SUPER_ONLY,
  'POST /v3/admin/features': SUPER_ONLY, 'PUT /v3/admin/features/:key': SUPER_ONLY, 'DELETE /v3/admin/features/:key': SUPER_ONLY, 'PUT /v3/admin/plans/:id/features': SUPER_ONLY,
  'POST /v3/admin/tax-rates': SUPER_ONLY, 'PUT /v3/admin/tax-rates/:id': SUPER_ONLY, 'DELETE /v3/admin/tax-rates/:id': SUPER_ONLY,
  'POST /v3/admin/discount-rules': SUPER_ONLY, 'PUT /v3/admin/discount-rules/:id': SUPER_ONLY, 'DELETE /v3/admin/discount-rules/:id': SUPER_ONLY,
  'PUT /v3/admin/plan-settings/:key': SUPER_ONLY,
  'POST /v3/admin/vendors/:id/subscription': SUPER_ONLY, 'POST /v3/admin/vendors/:id/overrides': SUPER_ONLY,
  'PUT /v3/admin/overrides/:overrideId': SUPER_ONLY, 'DELETE /v3/admin/overrides/:overrideId': SUPER_ONLY, 'PUT /v3/admin/vendors/:id/flags/v3_plans': SUPER_ONLY,

  // ── V3 slice 5.3: provisioning jobs, claim links, invites ───────────────────────────────────────────────────────────────
  // Onboarding work: OPERATIONS and SUPER_ADMIN read and write; MARKETING is refused on every route (a job holds a phone number and an email address).
  'POST /v3/admin/provisioning/jobs': OPS_AND_SUPER, 'GET /v3/admin/provisioning/jobs': OPS_AND_SUPER, 'GET /v3/admin/provisioning/jobs/:id': OPS_AND_SUPER,
  'POST /v3/admin/provisioning/jobs/:id/retry': OPS_AND_SUPER, 'POST /v3/admin/provisioning/jobs/:id/cancel': OPS_AND_SUPER, 'POST /v3/admin/provisioning/jobs/:id/run': OPS_AND_SUPER,
  'POST /v3/admin/vendors/:id/claim-link/reissue': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/claim-link/revoke': OPS_AND_SUPER, 'GET /v3/admin/invites': OPS_AND_SUPER,

  // ── V3 slice 5.11: AI Studio. Providers (they hold a secret), prompts (they decide what the model is told) and credit grants: SUPER_ADMIN only. Usage reports: OPERATIONS and SUPER_ADMIN. MARKETING is refused everywhere.
  'GET /v3/admin/ai/providers': SUPER_ONLY, 'POST /v3/admin/ai/providers': SUPER_ONLY, 'PUT /v3/admin/ai/providers/:id': SUPER_ONLY, 'POST /v3/admin/ai/providers/:id/test': SUPER_ONLY,
  'GET /v3/admin/ai/prompts': SUPER_ONLY, 'POST /v3/admin/ai/prompts': SUPER_ONLY, 'POST /v3/admin/ai/prompts/:id/activate': SUPER_ONLY, 'POST /v3/admin/ai/credit-grants': SUPER_ONLY,
  'GET /v3/admin/ai/usage': OPS_AND_SUPER,

  // ── V3 slice 5.1b: plan purchases. Orders and the payment inbox are money: OPERATIONS and SUPER_ADMIN read; only SUPER_ADMIN marks an order paid offline or records a refund. MARKETING is refused everywhere.
  // Batch 4 slice 5.16a: wallets. Reads, the reconciliation report and the expiry run are OPERATIONS and SUPER_ADMIN (MARKETING refused: a wallet is money). Adjusting credit and freezing are SUPER_ADMIN only.
  'GET /v3/admin/wallets': OPS_AND_SUPER, 'GET /v3/admin/wallets/reconciliation': OPS_AND_SUPER, 'POST /v3/admin/wallets/expiry-run': OPS_AND_SUPER, 'GET /v3/admin/wallets/:vendorId': OPS_AND_SUPER, 'GET /v3/admin/wallets/:vendorId/ledger': OPS_AND_SUPER, 'GET /v3/admin/wallets/:vendorId/reconcile': OPS_AND_SUPER,
  'POST /v3/admin/wallets/:vendorId/adjustments': SUPER_ONLY, 'PUT /v3/admin/wallets/:vendorId/frozen': SUPER_ONLY,
  // Batch 4 slice 5.16b: the service catalogue and the price book. Everyone on staff may READ the catalogue (MARKETING sees no money field); changing it and proposing or editing a price is OPERATIONS and SUPER_ADMIN;
  // APPROVING or RETIRING a price is SUPER_ADMIN only.
  'GET /v3/admin/services': ALL_STAFF, 'GET /v3/admin/services/:key': ALL_STAFF, 'GET /v3/admin/packs': ALL_STAFF, 'GET /v3/admin/packs/:key': ALL_STAFF,
  'POST /v3/admin/services': OPS_AND_SUPER, 'PUT /v3/admin/services/:key': OPS_AND_SUPER, 'POST /v3/admin/services/:key/prices': OPS_AND_SUPER, 'PUT /v3/admin/services/prices/:id': OPS_AND_SUPER,
  'POST /v3/admin/packs': OPS_AND_SUPER, 'PUT /v3/admin/packs/:key': OPS_AND_SUPER, 'POST /v3/admin/packs/:key/prices': OPS_AND_SUPER, 'PUT /v3/admin/packs/prices/:id': OPS_AND_SUPER,
  'POST /v3/admin/services/prices/:id/approve': SUPER_ONLY, 'POST /v3/admin/services/prices/:id/retire': SUPER_ONLY, 'POST /v3/admin/packs/prices/:id/approve': SUPER_ONLY, 'POST /v3/admin/packs/prices/:id/retire': SUPER_ONLY,
  // Batch 4 slice 5.16c: the service request queue and its work (a request holds a brief, a business and money): OPERATIONS and SUPER_ADMIN, MARKETING refused
  'GET /v3/admin/service-requests': OPS_AND_SUPER, 'POST /v3/admin/service-requests/sla-sweep': OPS_AND_SUPER, 'POST /v3/admin/service-requests/auto-approve-run': OPS_AND_SUPER, 'GET /v3/admin/service-requests/:id': OPS_AND_SUPER,
  'POST /v3/admin/service-requests/:id/assign': OPS_AND_SUPER, 'POST /v3/admin/service-requests/:id/status': OPS_AND_SUPER, 'POST /v3/admin/service-requests/:id/deliverables': OPS_AND_SUPER, 'POST /v3/admin/service-requests/:id/reject': OPS_AND_SUPER,
  'POST /v3/admin/service-requests/:id/retry-grant': OPS_AND_SUPER, 'POST /v3/admin/vendors/:vendorId/service-requests': OPS_AND_SUPER,
  // Batch 4 slice 5.16d: switching a vendor's theme for them, reviewing their switches and settling stuck ones: OPERATIONS and SUPER_ADMIN, MARKETING refused
  'POST /v3/admin/vendors/:vendorId/site/theme/switch': OPS_AND_SUPER, 'GET /v3/admin/vendors/:vendorId/site/theme/history': OPS_AND_SUPER, 'POST /v3/admin/theme-switches/recover': OPS_AND_SUPER,
  'GET /v3/admin/billing/orders': OPS_AND_SUPER, 'GET /v3/admin/billing/payment-events': OPS_AND_SUPER, 'POST /v3/admin/billing/orders/:id/mark-paid': SUPER_ONLY, 'POST /v3/admin/billing/orders/:id/refund': SUPER_ONLY,

  // ── V3 slice 5.7: the public directory. The business reads are open to all staff but MARKETING gets them WITHOUT the personal fields (phone, address, hours, map position, masked email);
  // every write, the claim phone override and the removal requests (they carry a masked contact) are OPERATIONS and SUPER_ADMIN.
  'GET /v3/admin/directory/locations': ALL_STAFF, 'GET /v3/admin/directory/categories': ALL_STAFF, 'GET /v3/admin/directory/businesses': ALL_STAFF, 'GET /v3/admin/directory/businesses/:id': ALL_STAFF, 'GET /v3/admin/directory/businesses/:id/placements': ALL_STAFF,
  'POST /v3/admin/directory/locations': OPS_AND_SUPER, 'PUT /v3/admin/directory/locations/:id': OPS_AND_SUPER, 'POST /v3/admin/directory/categories': OPS_AND_SUPER, 'PUT /v3/admin/directory/categories/:id': OPS_AND_SUPER,
  'POST /v3/admin/directory/businesses': OPS_AND_SUPER, 'PUT /v3/admin/directory/businesses/:id': OPS_AND_SUPER, 'POST /v3/admin/directory/businesses/:id/moderate': OPS_AND_SUPER, 'POST /v3/admin/directory/businesses/:id/placements': OPS_AND_SUPER,
  'POST /v3/admin/directory/placements/:id/revoke': OPS_AND_SUPER, 'POST /v3/admin/directory/businesses/:id/claim-phone-override': OPS_AND_SUPER,
  'GET /v3/admin/directory/removal-requests': OPS_AND_SUPER, 'POST /v3/admin/directory/removal-requests/:id/approve': OPS_AND_SUPER, 'POST /v3/admin/directory/removal-requests/:id/reject': OPS_AND_SUPER, 'POST /v3/admin/directory/removal-requests/:id/execute': OPS_AND_SUPER,

  // ── V3 slice 5.6: vendors' addresses. Reads too are OPERATIONS and SUPER_ADMIN only (a host name can identify a business); MARKETING is refused everywhere.
  'GET /v3/admin/domains': OPS_AND_SUPER, 'GET /v3/admin/domains/:id': OPS_AND_SUPER, 'POST /v3/admin/domains/:id/verify': OPS_AND_SUPER, 'PUT /v3/admin/domains/:id/state': OPS_AND_SUPER,
  'POST /v3/admin/domains/:id/primary': OPS_AND_SUPER, 'POST /v3/admin/domains/:id/remove': OPS_AND_SUPER, 'PUT /v3/admin/vendors/:id/domains/subdomain': OPS_AND_SUPER,

  // ── V3 slice 5.4: vendors' sites ────────────────────────────────────────────────────────────────────────────────────────
  // Summaries (the list and one site) are open to all staff; MARKETING never sees html. Every write, and the preview that carries html, is OPERATIONS and SUPER_ADMIN.
  // B3 slice 5.14: requests, the outbox, reports and the blocklist identify customers and businesses: OPERATIONS and SUPER_ADMIN, MARKETING refused
  'GET /v3/admin/requests': OPS_AND_SUPER, 'GET /v3/admin/requests/:id': OPS_AND_SUPER, 'GET /v3/admin/message-outbox': OPS_AND_SUPER, 'GET /v3/admin/reports': OPS_AND_SUPER, 'POST /v3/admin/reports/:id/handle': OPS_AND_SUPER, 'GET /v3/admin/blocklist': OPS_AND_SUPER, 'POST /v3/admin/blocklist': OPS_AND_SUPER, 'DELETE /v3/admin/blocklist/:id': OPS_AND_SUPER,
  // B3 slice 5.15: legal documents are written and published by SUPER_ADMIN only
  'GET /v3/admin/terms': SUPER_ONLY, 'GET /v3/admin/terms/:id': SUPER_ONLY, 'POST /v3/admin/terms/kinds/:kind/drafts': SUPER_ONLY, 'PUT /v3/admin/terms/:id': SUPER_ONLY, 'POST /v3/admin/terms/:id/publish': SUPER_ONLY,
  // B3 slice 5.13a: seeded sites. MARKETING may only READ the list and one site (non-personal fields; the service redacts). Everything else is OPERATIONS and SUPER_ADMIN; the indexing mode is SUPER_ADMIN only.
  'GET /v3/admin/seeded-sites': ALL_STAFF, 'GET /v3/admin/seeded-sites/:id': ALL_STAFF,
  'POST /v3/admin/seeded-sites': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/batches/dry-run': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/batches/apply': OPS_AND_SUPER, 'GET /v3/admin/seeded-sites/register': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/register': OPS_AND_SUPER, 'GET /v3/admin/seeded-sites/indexing-mode': OPS_AND_SUPER, 'PUT /v3/admin/seeded-sites/:id/outreach': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/:id/calls': OPS_AND_SUPER, 'PUT /v3/admin/seeded-sites/:id/consent': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/:id/claim-link': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/:id/claim-link/revoke': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/:id/removal': OPS_AND_SUPER,
  'PUT /v3/admin/seeded-sites/indexing-mode': SUPER_ONLY,
  // B3 slice 5.7b: the Visit-site report across vendors: OPERATIONS and SUPER_ADMIN (MARKETING refused)
  'GET /v3/admin/directory/visits': OPS_AND_SUPER,
  // B3 slice 5.6b: the canonical host and the custom-domain promotion add-on: OPERATIONS and SUPER_ADMIN, MARKETING refused
  'GET /v3/admin/vendors/:id/canonical': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/custom-domain-addon': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/custom-domain-addon/end': OPS_AND_SUPER,
  // B3 slice 5.1d: lifecycle actions and the owner deletion queue: OPERATIONS and SUPER_ADMIN, MARKETING refused everywhere (a deletion request identifies a business)
  'GET /v3/admin/vendors/:id/lifecycle': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/convert-to-free': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/restore-pro': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/extend-grace': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/suspend': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/reinstate': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/delete-empty-listing': OPS_AND_SUPER, 'GET /v3/admin/account-deletions': OPS_AND_SUPER, 'GET /v3/admin/account-deletions/:id': OPS_AND_SUPER, 'POST /v3/admin/account-deletions/:id/execute': OPS_AND_SUPER,
  'GET /v3/admin/sites': ALL_STAFF, 'GET /v3/admin/vendors/:id/site': ALL_STAFF,
  'PUT /v3/admin/vendors/:id/site/theme': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/build': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/publish': OPS_AND_SUPER,
  'POST /v3/admin/vendors/:id/site/rollback': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/site/preview/:publicationId/:path': OPS_AND_SUPER, 'PUT /v3/admin/vendors/:id/site/noindex': OPS_AND_SUPER,
};

/**
 * S7-B: routes a VENDOR uses on their own data and that also let STAFF act on any vendor's data (previously "any staff role", decided inline in
 * each controller). The handler asks `staffMayUse(user, routeKey)` (auth/guards/staff-access.ts) through the `@RouteKey()` parameter.
 * Same rules: deny by default (an unlisted route is SUPER_ADMIN only); SUPER_ADMIN behaviour is unchanged; MARKETING is refused wherever the
 * same data is refused under AdminGuard in S7 (invoices, subscriptions, vendors, support, add-ons, modules, CMS, stock, the shared admin inbox).
 * `test/staff-vendor-access.spec.ts` fails if a route that asks has no entry here, or an entry matches no route.
 */
export const STAFF_VENDOR_ACCESS_MATRIX: Readonly<Record<string, readonly StaffRole[]>> = {
  // CMS / website content of any vendor
  'PUT /cms/vendor/:vendorId': OPS_AND_SUPER, 'GET /cms/vendor/:vendorId/products/manage': OPS_AND_SUPER, 'GET /cms/vendor/:vendorId/categories/manage': OPS_AND_SUPER,
  'POST /cms/vendor/:vendorId/categories': OPS_AND_SUPER, 'PUT /cms/vendor/:vendorId/categories/order': OPS_AND_SUPER, 'PUT /cms/vendor/:vendorId/categories/:id': OPS_AND_SUPER,
  'DELETE /cms/vendor/:vendorId/categories/:id': OPS_AND_SUPER, 'POST /cms/vendor/:vendorId/products': OPS_AND_SUPER, 'PUT /cms/products/:id': OPS_AND_SUPER, 'DELETE /cms/products/:id': OPS_AND_SUPER,
  // invoices, subscriptions, support tickets, add-ons and modules of any vendor
  'GET /invoices/vendor/:vendorId': OPS_AND_SUPER, 'GET /invoices/:id': OPS_AND_SUPER, 'GET /invoices/:id/pdf': OPS_AND_SUPER, 'POST /invoices/:id/email': OPS_AND_SUPER,
  'GET /subscriptions/vendor/:vendorId': OPS_AND_SUPER,
  'GET /support/tickets/vendor/:vendorId': OPS_AND_SUPER,
  'GET /addons/vendor': OPS_AND_SUPER, 'GET /modules/vendor': OPS_AND_SUPER,
  // the shared admin notification inbox (a staff role not listed reads its own, empty, inbox instead)
  'GET /notifications': OPS_AND_SUPER, 'PUT /notifications/:id/read': OPS_AND_SUPER, 'PUT /notifications/read-all': OPS_AND_SUPER, 'POST /notifications/subscribe': OPS_AND_SUPER,
  // stock of any vendor's product
  'POST /stock/products/:productId/adjust': OPS_AND_SUPER, 'GET /stock/products/:productId/history': OPS_AND_SUPER,
  // free internal AI / video / reel generation (kept for every staff role: the team tests and produces content without topping up a wallet)
  'POST /ai/generate-content': ALL_STAFF, 'POST /ai/call-summary': ALL_STAFF, 'POST /ai/generate-image': ALL_STAFF, 'POST /video/generate': ALL_STAFF, 'POST /reels/render': ALL_STAFF,
};

export function staffRolesFor(routeKey: string): readonly StaffRole[] {
  return STAFF_VENDOR_ACCESS_MATRIX[routeKey] ?? SUPER_ONLY;
}

/** Roles allowed on a route; a route with no entry is SUPER_ADMIN only (deny by default). */
export function rolesFor(routeKey: string): readonly StaffRole[] {
  return ADMIN_ROLE_MATRIX[routeKey] ?? SUPER_ONLY;
}
