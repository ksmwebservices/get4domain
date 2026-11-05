import * as path from 'path';
import { RouteInfo, scanRoutes, violatesStaffPath } from './support/route-scan';
import baseline from './baselines/route-classification.json';

/**
 * Drift alarm for the API's access surface. The baseline (test/baselines/route-classification.json) is a REVIEWED snapshot of
 * every HTTP route and how it is protected. Adding a route, or changing how one is protected, fails this test until
 * `npm run routes:baseline` is run and the resulting git diff is reviewed. It cannot prove a handler is safe; it makes sure
 * nobody changes the access surface silently.
 */
const srcDir = path.resolve(__dirname, '../src');
const current = scanRoutes(srcDir);
const key = (r: Pick<RouteInfo, 'route' | 'controller'>) => `${r.route}  ←  ${r.controller}`;
const saved = baseline.routes as RouteInfo[];
const savedByKey = new Map(saved.map((r) => [key(r), r]));
const currentByKey = new Map(current.map((r) => [key(r), r]));

/** /admin... paths that are intentionally NOT staff-guarded, each with the reason. Adding to this list needs a security decision. */
const STAFF_PATH_EXCEPTIONS: Record<string, string> = {
  'POST /admin-team/invite/accept': 'a newly invited staff member accepts with a one-time token before they have an account',
};

/**
 * S8-A: routes only the account OWNER may call (a vendor's team member is refused with 403, whatever areas they were granted).
 * Money, payment credentials and domains must never be reachable by an invited team member.
 */
const OWNER_ONLY_ROUTES = [
  'PUT /vendor-payments',            // replaces the vendor's Razorpay keys (redirects customers' payments)
  'POST /vendor-payments/test',      // calls Razorpay with typed keys
  'POST /domains/register',          // spends the vendor wallet
  'POST /domains/connect',           // claims a domain
  'POST /domains/verify',
  'GET /team/members',
  'PUT /v3/me/site/theme', 'POST /v3/me/site/publish', 'POST /v3/me/site/rollback',   // S54.7: they change what the public sees
  'GET /team/activity',
  // B2 slice 5.1b: buying a plan starts a payment: owner only (a team member never starts one)
  'POST /v3/me/billing/orders', 'POST /v3/me/billing/orders/:id/confirm', 'GET /v3/me/billing/orders', 'GET /v3/me/billing/invoices',
  // B4 slice 5.16a: the wallet is money (balance, top-ups, the tax profile): owner only, a team member never sees or starts any of it
  // B4 slice 5.16b: the vendor's service and pack lists show prices and the wallet, and buying a pack spends money: owner only
  'GET /v3/me/services', 'GET /v3/me/packs', 'POST /v3/me/packs/:key/purchase',
  // B4 slice 5.16c: a request holds and then charges the vendor's money and carries the work product: owner only
  'POST /v3/me/service-requests', 'GET /v3/me/service-requests', 'GET /v3/me/service-requests/invoices', 'GET /v3/me/service-requests/:id', 'POST /v3/me/service-requests/:id/cancel', 'POST /v3/me/service-requests/:id/approve', 'POST /v3/me/service-requests/:id/revision',
  'POST /v3/me/plan/renew-with-wallet',   // B4 slice 5.16a-2: buying a plan with wallet credit spends money: owner only
  'GET /v3/me/wallet', 'GET /v3/me/wallet/ledger', 'GET /v3/me/wallet/topups', 'POST /v3/me/wallet/topups', 'POST /v3/me/wallet/topups/:id/confirm', 'PUT /v3/me/wallet/billing-profile',
  // B3 slice 5.14: payment methods (credentials), refunds and the vendor's own invoices are money: owner only
  'GET /v3/me/payment-methods', 'POST /v3/me/payment-methods', 'PUT /v3/me/payment-methods/:id', 'DELETE /v3/me/payment-methods/:id', 'POST /v3/me/payment-methods/:id/test', 'POST /v3/me/orders/:id/refund', 'POST /v3/me/orders/:id/invoice', 'GET /v3/me/invoices', 'POST /v3/me/invoices/:id/void',
  // B3 slice 5.15: accepting the terms binds the business: owner only (a team member never accepts for it)
  'GET /v3/me/terms', 'POST /v3/me/terms/accept',
  // B3 slice 5.1d: asking for the whole account to be removed for good is the owner's decision alone
  'POST /v3/me/account/deletion-request',
  // B2 slice 5.7: the owner's directory profile (a team member never edits the business's public face)
  'GET /v3/me/directory', 'PUT /v3/me/directory', 'GET /v3/me/directory/stats',
  // B2 slice 5.6: the vendor's addresses are the business's identity: every route is owner only
  'GET /v3/me/domains', 'PUT /v3/me/domains/subdomain', 'POST /v3/me/domains/custom', 'GET /v3/me/domains/:id', 'POST /v3/me/domains/:id/verify', 'POST /v3/me/domains/:id/primary', 'DELETE /v3/me/domains/:id',
  // already owner-only before S8-A (regression guard)
  'POST /team/invite', 'PUT /team/members/:id', 'DELETE /team/members/:id',
  // S8-B (owner decision 2026-11-03, production had 0 team members): anything that starts a payment, buys, or tops up the wallet.
  'POST /billing/invoices/:id/razorpay/order', 'POST /billing/invoices/:id/razorpay/verify', 'POST /billing/invoices/:id/proof',
  'POST /billing/invoices/:id/promo', 'DELETE /billing/invoices/:id/promo', 'POST /billing/plan-change-requests',
  'POST /payments/create-order', 'POST /payments/verify',
  'POST /website-themes/:id/unlock/order', 'POST /website-themes/:id/unlock/confirm',
  'POST /wallet/topup', 'POST /wallet/topup/verify',
  'POST /leadspace/wallet/refill', 'POST /leadspace/wallet/refill/verify',
  'POST /site-doc/me/themes/:key/order', 'POST /site-doc/me/themes/:key/confirm',
  // S51.7: what a vendor pays and when it ends is billing information: the owner sees it, a team member does not (the entitlements route stays open to members so the UI can lock features)
  'GET /v3/me/subscription', 'GET /v3/me/subscription/events',
];
/** Routes that need a named team area (not owner-only): a member WITHOUT the area is refused. */
const REQUIRED_MODULE: Record<string, string> = {
  'GET /vendor-payments': 'accounts',
  'GET /v3/me/requests': 'website', 'GET /v3/me/requests/:id': 'website', 'POST /v3/me/requests/:id/respond': 'website', 'POST /v3/me/requests/:id/link': 'website', 'GET /v3/me/orders': 'website', 'GET /v3/me/orders/:id': 'website', 'PUT /v3/me/orders/:id/status': 'website', 'PUT /v3/me/stock/:productRef': 'website', 'GET /v3/me/offers': 'website', 'POST /v3/me/offers': 'website', 'PUT /v3/me/offers/:id': 'website',   // B3 slice 5.14: the inbox, replies, orders, offers and stock need the website area
  'GET /v3/me/site': 'website', 'POST /v3/me/site/build': 'website', 'GET /v3/me/site/preview/:publicationId/:path': 'website',   // S54.7
  'POST /v3/me/ai/generate': 'website', 'GET /v3/me/ai/usage': 'website',   // B2 slice 5.11: the owner, or a team member with the website area
  'GET /website-themes/mine': 'website',       // S8-B: viewing the theme screen is gated by the website area
};
/**
 * Reads stay area-gated, not owner-only (owner decision): billing reads (`GET /billing/me|invoices/:id/pay|pdf|upi`) are gated by the
 * `wallet` area inside commercial.controllers.ts assertVendorPrincipal; wallet balance/transactions by the class-level @RequireModule('wallet').
 * Wallet-spending feature routes (AI Studio, reels, video, messaging, campaign approve) also stay area-gated.
 */

describe('route classification (static scan of all controllers)', () => {
  it('makes the money / credentials / domains routes owner-only (S8-A)', () => {
    const byRoute = new Map(current.map((r) => [r.route, r]));
    const missing = OWNER_ONLY_ROUTES.filter((r) => byRoute.get(r)?.ownerOnly !== true);
    expect(missing).toEqual([]);
  });

  it('requires the named team area where one is specified (S8-A)', () => {
    const byRoute = new Map(current.map((r) => [r.route, r]));
    const wrong = Object.entries(REQUIRED_MODULE).filter(([route, area]) => byRoute.get(route)?.module !== area).map(([route]) => route);
    expect(wrong).toEqual([]);
  });

  it('finds a plausible number of routes (the scanner itself is working)', () => {
    expect(current.length).toBeGreaterThan(600);
    expect(new Set(current.map((r) => r.cls))).toEqual(new Set(['public', 'admin', 'authenticated']));
  });

  it('has no route that is missing from the reviewed baseline', () => {
    const added = [...currentByKey.keys()].filter((k) => !savedByKey.has(k));
    expect(added).toEqual([]);   // fix: npm run routes:baseline, then review the diff of the baseline file
  });

  it('has no route that disappeared from the code but is still in the baseline', () => {
    const removed = [...savedByKey.keys()].filter((k) => !currentByKey.has(k));
    expect(removed).toEqual([]); // fix: npm run routes:baseline
  });

  it('has not changed how any existing route is protected', () => {
    const changed: string[] = [];
    for (const [k, now] of currentByKey) {
      const was = savedByKey.get(k);
      if (!was) continue;
      if (was.cls !== now.cls) changed.push(`${k}: ${was.cls} -> ${now.cls}`);
      if (was.readsPrincipal !== now.readsPrincipal) changed.push(`${k}: readsPrincipal ${was.readsPrincipal} -> ${now.readsPrincipal}`);
      if ((was.module ?? null) !== (now.module ?? null)) changed.push(`${k}: module ${was.module ?? '-'} -> ${now.module ?? '-'}`);
      if ((was.roles ?? null) !== (now.roles ?? null)) changed.push(`${k}: roles ${was.roles ?? '-'} -> ${now.roles ?? '-'}`);
      if ((was.ownerOnly ?? false) !== (now.ownerOnly ?? false)) changed.push(`${k}: ownerOnly ${was.ownerOnly ?? false} -> ${now.ownerOnly ?? false}`);
      if ((was.adminGuard ?? false) !== (now.adminGuard ?? false)) changed.push(`${k}: adminGuard ${was.adminGuard ?? false} -> ${now.adminGuard ?? false}`);
      if ((was.staffMatrix ?? false) !== (now.staffMatrix ?? false)) changed.push(`${k}: staffMatrix ${was.staffMatrix ?? false} -> ${now.staffMatrix ?? false}`);
    }
    expect(changed).toEqual([]);
  });

  it('keeps every /admin... route behind a staff guard, except the documented exceptions', () => {
    const open = current.filter(violatesStaffPath).map((r) => r.route).filter((r) => !(r in STAFF_PATH_EXCEPTIONS));
    expect(open).toEqual([]);
  });

  it('documents each staff-path exception with a reason that still matches a real route', () => {
    for (const route of Object.keys(STAFF_PATH_EXCEPTIONS)) {
      expect(current.some((r) => r.route === route && violatesStaffPath(r))).toBe(true);
    }
  });

  it('never marks a route both @Public and staff-guarded without a decision (public wins and skips JWT)', () => {
    // The scanner reports "public" when both are present; list those so a human looks. None today.
    const both = current.filter((r) => r.cls === 'public' && /^(GET|POST|PUT|PATCH|DELETE) \/admin(\/|$)/.test(r.route)).map((r) => r.route);
    expect(both).toEqual([]);
  });
});
