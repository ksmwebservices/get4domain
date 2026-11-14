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
export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATIONS' | 'SUPPORT' | 'MARKETING';

/**
 * Amendment 13 V9 (Part B). The document's SALES role is the existing MARKETING value: every rule written for MARKETING is the rule for SALES, and no role value is renamed or removed.
 * ADMIN and SUPPORT are added without touching an owner-approved entry: the tables below stay the base (OPERATIONS, MARKETING and SUPER_ADMIN), and the two new roles are expressed as DATA
 * on top of it (STAFF_ROLE_EXTENSIONS), read by effectiveRolesFor / effectiveStaffRolesFor, which is what AdminGuard asks:
 *   ADMIN   = everything OPERATIONS may do, except the routes in `deny` (system settings and the price book), plus the routes in `allow` (pack, tab and category content). Never a SUPER_ADMIN-only route.
 *   SUPPORT = only the routes in `allow` (tickets, calls, the vendor's tab list for the desk). Billing, settings, domains and every money route are refused by default.
 */
export const SALES_ROLE: StaffRole = 'MARKETING';

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
  // Batch 4B slice 5.20: alerts and the activity log describe money, payment methods and personal data: OPERATIONS and SUPER_ADMIN work them, MARKETING is refused everywhere. The rules themselves are SUPER_ADMIN only.
  'GET /v3/admin/alerts': OPS_AND_SUPER, 'GET /v3/admin/alerts/:id': OPS_AND_SUPER, 'PATCH /v3/admin/alerts/:id': OPS_AND_SUPER, 'GET /v3/admin/vendors/:vendorId/activity': OPS_AND_SUPER, 'GET /v3/admin/attention': OPS_AND_SUPER,
  // Block 4b slice 11: the recorded mail lanes and promotion rules (read: OPERATIONS + SUPER_ADMIN) and confirming a mailbox price (SUPER_ADMIN only)
  'GET /v3/admin/mail-rules': OPS_AND_SUPER, 'POST /v3/admin/mailbox-prices/:id/confirm': SUPER_ONLY,
  // Block 4b slice 9: staff actions on a business (A1 plan change with a date, A2 business name, the visit report) are OPERATIONS + SUPER_ADMIN; merging listings (A4) is SUPER_ADMIN only
  'PUT /v3/admin/vendors/:id/business-name': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/business-name-history': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/plan-change': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/plan-changes': OPS_AND_SUPER, 'POST /v3/admin/plan-changes/:id/cancel': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/visits': OPS_AND_SUPER,
  'POST /v3/admin/listing-merges/plan': SUPER_ONLY, 'POST /v3/admin/listing-merges': SUPER_ONLY, 'GET /v3/admin/listing-merges': SUPER_ONLY, 'POST /v3/admin/listing-merges/:id/reverse': SUPER_ONLY,
  // Block 4b slice 4: the support desk (OPERATIONS + SUPER_ADMIN; MARKETING refused, tickets carry account details)
  'GET /v3/admin/tickets': OPS_AND_SUPER, 'GET /v3/admin/tickets/:id': OPS_AND_SUPER, 'PUT /v3/admin/tickets/:id/assignee': OPS_AND_SUPER, 'PUT /v3/admin/tickets/:id/status': OPS_AND_SUPER, 'POST /v3/admin/tickets/:id/messages': OPS_AND_SUPER,
  'GET /v3/admin/alert-rules': SUPER_ONLY, 'PUT /v3/admin/alert-rules': SUPER_ONLY,
  // Batch 4B slice 5.21: reports, proofs and the block list carry personal data: OPERATIONS and SUPER_ADMIN, MARKETING refused. The prohibited phrases and the creating and reversing of a legal takedown are SUPER_ADMIN only.
  'GET /v3/admin/business-reports': OPS_AND_SUPER, 'PATCH /v3/admin/business-reports/:id': OPS_AND_SUPER, 'GET /v3/admin/trust-blocklist': OPS_AND_SUPER, 'POST /v3/admin/trust-blocklist': OPS_AND_SUPER, 'DELETE /v3/admin/trust-blocklist/:id': OPS_AND_SUPER,
  'GET /v3/admin/business-proofs': OPS_AND_SUPER, 'PATCH /v3/admin/business-proofs/:id': OPS_AND_SUPER, 'GET /v3/admin/takedowns': OPS_AND_SUPER,
  'GET /v3/admin/prohibited-terms': SUPER_ONLY, 'POST /v3/admin/prohibited-terms': SUPER_ONLY, 'PUT /v3/admin/prohibited-terms/:id': SUPER_ONLY, 'DELETE /v3/admin/prohibited-terms/:id': SUPER_ONLY,
  'POST /v3/admin/takedowns': SUPER_ONLY, 'POST /v3/admin/takedowns/:id/reverse': SUPER_ONLY,
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
  'GET /v3/admin/requests': OPS_AND_SUPER, 'GET /v3/admin/requests/:id': OPS_AND_SUPER, 'GET /v3/admin/vendors/:vendorId/payment-methods': OPS_AND_SUPER, 'GET /v3/admin/message-outbox': OPS_AND_SUPER, 'GET /v3/admin/reports': OPS_AND_SUPER, 'POST /v3/admin/reports/:id/handle': OPS_AND_SUPER, 'GET /v3/admin/blocklist': OPS_AND_SUPER, 'POST /v3/admin/blocklist': OPS_AND_SUPER, 'DELETE /v3/admin/blocklist/:id': OPS_AND_SUPER,
  // B3 slice 5.15: legal documents are written and published by SUPER_ADMIN only
  'GET /v3/admin/terms': SUPER_ONLY, 'GET /v3/admin/terms/:id': SUPER_ONLY, 'POST /v3/admin/terms/kinds/:kind/drafts': SUPER_ONLY, 'PUT /v3/admin/terms/:id': SUPER_ONLY, 'POST /v3/admin/terms/:id/publish': SUPER_ONLY,
  // B3 slice 5.13a: seeded sites. MARKETING may only READ the list and one site (non-personal fields; the service redacts). Everything else is OPERATIONS and SUPER_ADMIN; the indexing mode is SUPER_ADMIN only.
  'GET /v3/admin/seeded-sites': ALL_STAFF, 'GET /v3/admin/seeded-sites/:id': ALL_STAFF,
  // Part B (B2, Amendment 13 V9): SALES (the MARKETING value) creates listings and draft sites on behalf, imports a CSV (dry run first), follows up and issues the claim link. The register, the indexing mode and removals stay OPERATIONS and SUPER_ADMIN.
  'POST /v3/admin/seeded-sites': ALL_STAFF, 'POST /v3/admin/seeded-sites/batches/dry-run': ALL_STAFF, 'POST /v3/admin/seeded-sites/batches/apply': ALL_STAFF, 'GET /v3/admin/seeded-sites/register': OPS_AND_SUPER, 'POST /v3/admin/seeded-sites/register': OPS_AND_SUPER, 'GET /v3/admin/seeded-sites/indexing-mode': OPS_AND_SUPER, 'PUT /v3/admin/seeded-sites/:id/outreach': ALL_STAFF, 'POST /v3/admin/seeded-sites/:id/calls': ALL_STAFF, 'PUT /v3/admin/seeded-sites/:id/consent': ALL_STAFF, 'POST /v3/admin/seeded-sites/:id/claim-link': ALL_STAFF, 'POST /v3/admin/seeded-sites/:id/claim-link/revoke': ALL_STAFF, 'POST /v3/admin/seeded-sites/:id/removal': OPS_AND_SUPER,
  'PUT /v3/admin/seeded-sites/indexing-mode': SUPER_ONLY,
  // B3 slice 5.7b: the Visit-site report across vendors: OPERATIONS and SUPER_ADMIN (MARKETING refused)
  'GET /v3/admin/directory/visits': OPS_AND_SUPER,
  // B3 slice 5.6b: the canonical host and the custom-domain promotion add-on: OPERATIONS and SUPER_ADMIN, MARKETING refused
  'GET /v3/admin/vendors/:id/canonical': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/custom-domain-addon': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/custom-domain-addon/end': OPS_AND_SUPER,
  // B3 slice 5.1d: lifecycle actions and the owner deletion queue: OPERATIONS and SUPER_ADMIN, MARKETING refused everywhere (a deletion request identifies a business)
  'GET /v3/admin/vendors/:id/lifecycle': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/convert-to-free': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/restore-pro': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/extend-grace': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/suspend': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/reinstate': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/lifecycle/delete-empty-listing': OPS_AND_SUPER, 'GET /v3/admin/account-deletions': OPS_AND_SUPER, 'GET /v3/admin/account-deletions/:id': OPS_AND_SUPER, 'POST /v3/admin/account-deletions/:id/execute': OPS_AND_SUPER,
  'GET /v3/admin/sites': ALL_STAFF, 'GET /v3/admin/vendors/:id/site': ALL_STAFF,
  'PUT /v3/admin/vendors/:id/site/theme': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/build': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/publish': OPS_AND_SUPER,
  // 5.13b: act on behalf and the onboarding queue (the stage file's Website Developer and Customer Support roles do not exist: OPERATIONS and SUPER_ADMIN; MARKETING never)
  'POST /v3/admin/vendors/:id/act-on-behalf': OPS_AND_SUPER, 'POST /v3/admin/act-on-behalf/:sessionId/end': OPS_AND_SUPER, 'GET /v3/admin/act-on-behalf': OPS_AND_SUPER, 'GET /v3/admin/onboarding-queue': OPS_AND_SUPER,
  // 5.6c: own-domain automation and the per-vendor domain log (owner answer Q12 names Support; that role does not exist here: OPERATIONS and SUPER_ADMIN, MARKETING denied)
  'GET /v3/admin/domain-connections': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/domains/:domainId/connection/retry': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/domain-log': OPS_AND_SUPER,
  // 5.6d: domain sales and identity checks (MARKETING denied on all: personal data and money; approving or rejecting a price is SUPER_ADMIN only)
  'GET /v3/admin/domain-orders': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/domains/register': OPS_AND_SUPER, 'GET /v3/admin/domain-margins': OPS_AND_SUPER, 'POST /v3/admin/domain-margins': OPS_AND_SUPER,
  'POST /v3/admin/domain-margins/:id/approve': SUPER_ONLY, 'POST /v3/admin/domain-margins/:id/reject': SUPER_ONLY, 'POST /v3/admin/registrar/recover': OPS_AND_SUPER, 'POST /v3/admin/registrar/reconcile': OPS_AND_SUPER, 'GET /v3/admin/registrar/runs': OPS_AND_SUPER,
  'GET /v3/admin/identity-checks': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/identity': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/identity/document': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/identity/approve': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/identity/reject': OPS_AND_SUPER,
  // B4: customers' words on a vendor's live site
  'GET /v3/admin/vendors/:id/site/testimonials': OPS_AND_SUPER,
  // B3: the review link of a vendor's live site
  'GET /v3/admin/vendors/:id/site/review-link': OPS_AND_SUPER,
  // B2: a business address can be a home address: OPERATIONS and SUPER_ADMIN
  'GET /v3/admin/vendors/:id/site/location': OPS_AND_SUPER,
  // B1: SEO reports are read only and carry no personal data: all staff roles
  'GET /v3/admin/seo/pages': ALL_STAFF, 'GET /v3/admin/vendors/:id/site/seo': ALL_STAFF,
  // 5.5c: review of Free edits (the stage file's SUPPORT role does not exist: OPERATIONS and SUPER_ADMIN; MARKETING never sees a vendor's submission)
  'GET /v3/admin/content-reviews': OPS_AND_SUPER, 'GET /v3/admin/content-reviews/:id': OPS_AND_SUPER, 'POST /v3/admin/content-reviews/:id/approve': OPS_AND_SUPER, 'POST /v3/admin/content-reviews/:id/reject': OPS_AND_SUPER,
  // 5.5b: the Banner Library (readable by all staff; every write and every vendor picture is OPERATIONS and SUPER_ADMIN)
  'GET /v3/admin/banner-library': ALL_STAFF, 'PUT /v3/admin/banner-library/:id/active': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/site/banners': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/banner': OPS_AND_SUPER,
  'GET /v3/admin/vendors/:id/site/media': OPS_AND_SUPER, 'POST /v3/admin/vendors/:id/site/media': OPS_AND_SUPER,
  'POST /v3/admin/vendors/:id/site/rollback': OPS_AND_SUPER, 'GET /v3/admin/vendors/:id/site/preview/:publicationId/:path': OPS_AND_SUPER, 'PUT /v3/admin/vendors/:id/site/noindex': OPS_AND_SUPER,
  // Amendment 13 Part A, the pack engine: reads OPERATIONS and SUPER_ADMIN; every change is SUPER_ADMIN only (the staff ADMIN role arrives with Part B); the tier matrix and the two switches stay SUPER_ADMIN only
  'GET /v3/admin/pack-engine/packs': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/packs/:key': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/tabs': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/categories': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/tier-matrix': OPS_AND_SUPER,
  'GET /v3/admin/pack-engine/addons': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/vendors/:vendorId/navigation': OPS_AND_SUPER, 'GET /v3/admin/pack-engine/settings': OPS_AND_SUPER,
  'PUT /v3/admin/pack-engine/packs/:key': SUPER_ONLY, 'PUT /v3/admin/pack-engine/tabs': SUPER_ONLY, 'PUT /v3/admin/pack-engine/categories/:categoryKey': SUPER_ONLY, 'PUT /v3/admin/pack-engine/tier-matrix/:tier/:capabilityKey': SUPER_ONLY,
  'PUT /v3/admin/pack-engine/vendors/:vendorId/addons/:addonKey': SUPER_ONLY, 'PUT /v3/admin/pack-engine/settings/:name': SUPER_ONLY,
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

/** Roles allowed on a route by the BASE table; a route with no entry is SUPER_ADMIN only (deny by default). */
export function rolesFor(routeKey: string): readonly StaffRole[] {
  return ADMIN_ROLE_MATRIX[routeKey] ?? SUPER_ONLY;
}

// ── Part B: ADMIN and SUPPORT, as data on top of the base tables ─────────────────────────────────────────────────────────────────────────────────────

export interface RoleExtension { inherits?: StaffRole; deny: readonly string[]; allow: readonly string[] }

export const STAFF_ROLE_EXTENSIONS: Readonly<Record<'ADMIN' | 'SUPPORT', RoleExtension>> = {
  ADMIN: {
    inherits: 'OPERATIONS',
    // no system settings and no price book (Amendment 13 V9): reading the settings, proposing a price or a margin, and the platform content and demo switches
    deny: [
      'GET /v3/admin/plan-settings', 'GET /v3/admin/pack-engine/settings', 'GET /v3/admin/seeded-sites/indexing-mode', 'GET /v3/admin/mail-rules',
      'GET /v3/admin/domain-margins', 'POST /v3/admin/domain-margins',
      'POST /v3/admin/services/:key/prices', 'PUT /v3/admin/services/prices/:id', 'POST /v3/admin/packs/:key/prices', 'PUT /v3/admin/packs/prices/:id',
      'PUT /cms/platform', 'POST /demo/seed', 'POST /demo/cleanup-sandboxes',
    ],
    // the pack engine's content (A6): packs, tabs and the category map. The tier matrix, the two switches and the add-on switch stay SUPER_ADMIN only.
    allow: ['PUT /v3/admin/pack-engine/packs/:key', 'PUT /v3/admin/pack-engine/tabs', 'PUT /v3/admin/pack-engine/categories/:categoryKey'],
  },
  SUPPORT: {
    deny: [],
    // tickets (alongside OPERATIONS), calls and escalations, and the tab list a vendor sees. Nothing that holds money, a price, a setting or a domain.
    allow: [
      'GET /v3/admin/tickets', 'GET /v3/admin/tickets/:id', 'PUT /v3/admin/tickets/:id/assignee', 'PUT /v3/admin/tickets/:id/status', 'POST /v3/admin/tickets/:id/messages',
      'GET /support/tickets', 'PUT /support/tickets/:id/reply', 'PUT /support/tickets/:id/resolve', 'GET /support/tickets/vendor/:vendorId',
      'GET /admin/crm/leads', 'GET /admin/crm/leads/:id', 'PUT /admin/crm/leads/:id', 'POST /admin/crm/leads/:id/call',
      'GET /admin-team/me', 'GET /v3/admin/pack-engine/vendors/:vendorId/navigation',
    ],
  },
};

function extend(base: readonly StaffRole[], routeKey: string): readonly StaffRole[] {
  const out = new Set<StaffRole>(base);
  const a = STAFF_ROLE_EXTENSIONS.ADMIN;
  const superOnly = base.length === 1 && base[0] === 'SUPER_ADMIN';
  if (a.allow.includes(routeKey) || (!superOnly && a.inherits !== undefined && base.includes(a.inherits) && !a.deny.includes(routeKey))) out.add('ADMIN');
  if (STAFF_ROLE_EXTENSIONS.SUPPORT.allow.includes(routeKey)) out.add('SUPPORT');
  return [...out];
}

/** What AdminGuard asks: the base table plus the ADMIN and SUPPORT extensions. A route nobody listed is still SUPER_ADMIN only. */
export function effectiveRolesFor(routeKey: string): readonly StaffRole[] { return extend(rolesFor(routeKey), routeKey); }
/** The same for the vendor-data routes staff may also use (S7-B). */
export function effectiveStaffRolesFor(routeKey: string): readonly StaffRole[] { return extend(staffRolesFor(routeKey), routeKey); }
