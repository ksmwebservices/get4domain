import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { CreateCashOrderDto, CreateOrderDto } from '../src/plan-billing/api/dto/billing.dto';
import { priceQuote } from '../src/plans/pricing/price-quote';
import { VENDOR } from './support/billing-world';
import { flow } from './support/wave3-world';
import { scanRoutes } from './support/route-scan';

/**
 * Wave 3 Part F: there is NO discount, coupon or offer in version 3. No role below SUPER_ADMIN changes a price or edits an invoice amount, and a checkout total is always the price book plus GST.
 * The oracles in this file are typed out independently of the code they check.
 */
const src = path.resolve(__dirname, '../src');
const routes = scanRoutes(src);

// ─────────────────────────────────────────────────────────────────────────────────── who may change a price
/** every route that writes a price, a rate, a margin, a fee, a plan or a price rule: typed by hand, so a route added later has to be added here on purpose */
const PRICE_WRITES = [
  'POST /v3/admin/plans', 'PUT /v3/admin/plans/:id', 'DELETE /v3/admin/plans/:id', 'POST /v3/admin/plans/:id/prices', 'PUT /v3/admin/prices/:priceId', 'DELETE /v3/admin/prices/:priceId',
  'POST /v3/admin/tax-rates', 'PUT /v3/admin/tax-rates/:id', 'DELETE /v3/admin/tax-rates/:id',
  'PUT /v3/admin/plan-settings/:key', 'POST /v3/admin/vendors/:id/subscription',
  'POST /v3/admin/services/:key/prices', 'PUT /v3/admin/services/prices/:id', 'POST /v3/admin/services/prices/:id/approve', 'POST /v3/admin/services/prices/:id/retire',
  'POST /v3/admin/packs/:key/prices', 'PUT /v3/admin/packs/prices/:id', 'POST /v3/admin/packs/prices/:id/approve', 'POST /v3/admin/packs/prices/:id/retire',
  'POST /v3/admin/domain-margins', 'POST /v3/admin/domain-margins/:id/approve', 'POST /v3/admin/domain-margins/:id/reject',
  'POST /v3/admin/mailbox-prices/:id/confirm', 'POST /v3/admin/wallets/:vendorId/adjustments',
];

describe('no role below SUPER_ADMIN changes a price', () => {
  it.each(PRICE_WRITES.map((r) => [r]))('%s is SUPER_ADMIN only (ADMIN, OPERATIONS, SALES, SUPPORT and the labels are refused)', (route) => {
    expect([...effectiveRolesFor(route)]).toEqual(['SUPER_ADMIN']);
  });

  it('the list above names real routes only (no typo hides a gap)', () => {
    const real = new Set(routes.filter((r) => r.adminGuard === true).map((r) => r.route));
    expect(PRICE_WRITES.filter((r) => !real.has(r))).toEqual([]);
  });

  it('a sweep: ANY admin write whose route names a price, a rate, a margin, a discount or a fee is SUPER_ADMIN only, so a route added later cannot slip through', () => {
    const looksLikePrice = /\/(prices?|price-books?|tax-rates?|discount\w*|coupon\w*|promo\w*|offers?|domain-margins|mailbox-prices|plan-settings|fees?)(\/|$)/i;
    const writes = routes.filter((r) => r.adminGuard === true && !r.route.startsWith('GET ') && looksLikePrice.test(r.route.split(' ')[1]));
    expect(writes.length).toBeGreaterThanOrEqual(15);   // the sweep itself is finding the price routes
    for (const r of PRICE_WRITES.filter((k) => looksLikePrice.test(k.split(' ')[1]))) expect(writes.map((w) => w.route)).toContain(r);
    expect(writes.filter((r) => effectiveRolesFor(r.route).some((role) => role !== 'SUPER_ADMIN')).map((r) => r.route)).toEqual([]);
  });

  it('the matrix has no write route for a price that a staff role below SUPER_ADMIN can reach, in any entry', () => {
    const bad = Object.keys(ADMIN_ROLE_MATRIX).filter((k) => /prices?\b|tax-rates|discount|domain-margins/i.test(k) && !k.startsWith('GET ') && effectiveRolesFor(k).some((r) => r !== 'SUPER_ADMIN'));
    expect(bad).toEqual([]);
  });

  it('the vendor-facing and public routes take no price from the caller: checkout bodies carry a plan, a term and a key only', async () => {
    for (const [name, Dto] of [['order', CreateOrderDto], ['cash order', CreateCashOrderDto]] as const) {
      const fields = Object.getOwnPropertyNames(new (Dto as new () => object)());
      expect(fields.filter((f) => /amount|price|total|rate|tax|gst|discount|coupon|offer|promo/i.test(f))).toEqual([]);
      for (const extra of ['amountPaise', 'totalPaise', 'price', 'discount', 'coupon', 'offer', 'promoCode', 'discountPaise', 'gst']) {
        const errors = await validate(plainToInstance(Dto as never, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'abcdefgh-1234', [extra]: 1 }), { whitelist: true, forbidNonWhitelisted: true });
        expect([name, extra, errors.length > 0]).toEqual([name, extra, true]);   // the validation pipe refuses an unknown field outright
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────── no discount field or route in version 3
function listFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) listFiles(p, out); else if (p.endsWith('.ts')) out.push(p); }
  return out;
}
const rel = (f: string): string => path.relative(path.resolve(__dirname, '..'), f).replace(/\\/g, '/');
const WORDS = /coupon|discount|offer|promo/i;

/**
 * The slice 5.1 DISCOUNT RULE tables and their SUPER_ADMIN routes still exist (Wave 3 is additive: nothing is removed). They are LEGACY price-book configuration: no checkout reads them any more (tested below),
 * so a rule in them can never change an amount. The owner is asked whether to retire the routes. Every other version 3 route and DTO must be free of the words.
 */
/** Wave 4 W3: the four routes are RETIRED (owner, 17 Nov 2026): no discounts in version 3. The tables and migrations stay untouched. */
const RETIRED_DISCOUNT_RULE_ROUTES = ['GET /v3/admin/discount-rules', 'POST /v3/admin/discount-rules', 'PUT /v3/admin/discount-rules/:id', 'DELETE /v3/admin/discount-rules/:id'];
const LEGACY_DISCOUNT_RULE_ROUTES: string[] = [];
const LEGACY_DISCOUNT_RULE_FILES = ['src/plans/admin/rules-admin.controller.ts', 'src/plans/admin/rules-admin.service.ts', 'src/plans/admin/dto/plans-admin.dto.ts', 'src/plans/admin/admin-validation.ts', 'src/plans/pricing/price-quote.ts', 'src/plans/pricing/price-generator.ts', 'src/plans/seed/seed-file.ts', 'src/plans/seed/seed-applier.ts', 'src/plans/seed/prisma-seed-store.ts'];

/**
 * The platform pricing and billing surface of version 3: what Get4Domain charges a business. A vendor's OWN shop offers and promotion drafts (/v3/me/offers, /v3/me/promotion/...) are tools the vendor uses for
 * the vendor's customers, not Get4Domain pricing, and are outside this rule. Directories whose controllers and DTOs belong to the surface are listed so a new Wave 3 module is covered by adding it here.
 */
const PLATFORM_SURFACE = /^\/v3\/(me\/billing|me\/plan|me\/wallet|me\/site\/theme|public\/pricing|public\/referral|public\/firm|plans|partner|admin\/(billing|invoices|payment-gateway|partners|commission|referral|plans|prices|tax-rates|discount-rules|plan-settings|services|packs|domain-margins|wallets)|payments)(\/|$)/;
const SURFACE_DIRS = ['plan-billing', 'v3-wallet', 'plans', 'v3-partners', 'v3-referrals', 'v3-commission', 'v3-services', 'v3-theme-switch'];

describe('no coupon, discount or offer in version 3', () => {
  const v3 = routes.filter((r) => PLATFORM_SURFACE.test(r.route.split(' ')[1]));

  it('the surface is found (the scan itself works)', () => { expect(v3.length).toBeGreaterThanOrEqual(60); });

  it('the four discount rule routes are retired: no route and no repository read (an unlisted route is SUPER_ADMIN only by default) (Wave 4 W3)', () => {
    const all = new Set(routes.map((r) => r.route));
    for (const k of RETIRED_DISCOUNT_RULE_ROUTES) { expect([k, all.has(k)]).toEqual([k, false]); }
    expect(fs.readFileSync(path.join(src, 'plan-billing/plan-billing.repository.ts'), 'utf8')).not.toMatch(/discountRules/);
  });

  it('no platform pricing or billing route is named coupon, discount, offer or promo, except the four legacy rule routes, which are SUPER_ADMIN only', () => {
    const named = v3.filter((r) => WORDS.test(r.route.split(' ')[1])).map((r) => r.route).sort();
    expect(named).toEqual([...LEGACY_DISCOUNT_RULE_ROUTES].sort());
    for (const k of LEGACY_DISCOUNT_RULE_ROUTES.filter((k) => !k.startsWith('GET '))) expect([...effectiveRolesFor(k)]).toEqual(['SUPER_ADMIN']);
  });

  it('no platform pricing or billing controller, DTO or service declares a property named coupon, discount, offer or promo (property names; the legacy rule files are listed by name)', () => {
    const files: string[] = [];
    for (const d of SURFACE_DIRS) if (fs.existsSync(path.join(src, d))) files.push(...listFiles(path.join(src, d)));
    expect(files.length).toBeGreaterThan(50);
    const decl = /^\s*(?:readonly\s+|private\s+|public\s+)?(\w*(?:coupon|discount|offer|promo)\w*)\??!?\s*:/gim;
    const hits: string[] = [];
    for (const f of files) {
      if (LEGACY_DISCOUNT_RULE_FILES.includes(rel(f))) continue;
      const text = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');   // comments and doc text are not fields
      for (const m of text.matchAll(decl)) hits.push(`${rel(f)}: ${m[1]}`);
    }
    // the only allowed mention: the settlement reads the OLD `discounts` key of a stored quote made before Wave 3 (an order that has one keeps its own snapshot)
    expect(hits.filter((h) => !/plan-billing\/settlement\.service\.ts: discounts$/.test(h))).toEqual([]);
  });

  it('the checkout, the cash order, the wallet renewal and the pricing page never read a discount rule or a code', () => {
    for (const f of [...listFiles(path.join(src, 'plan-billing')), ...listFiles(path.join(src, 'v3-wallet')), path.join(src, 'plans/public/public-pricing.shape.ts'), path.join(src, 'plans/public/public-pricing.service.ts')]) {
      const text = fs.readFileSync(f, 'utf8');
      expect([rel(f), /\.discountRules\(\)|resolveApplicableDiscounts|promoCode/.test(text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'))]).toEqual([rel(f), false]);
    }
    const pq = fs.readFileSync(path.join(src, 'plan-billing/plan-order.service.ts'), 'utf8');
    expect(pq).toMatch(/discounts: \[\]/);
  });

  it('the public pricing and the public plans answers carry no discount word anywhere', () => {
    const shape = fs.readFileSync(path.join(src, 'plans/public/public-pricing.shape.ts'), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(WORDS.test(shape.replace(/discounts: \[\]/, ''))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────── the amount of a checkout
/** half-up integer GST, written out here independently of priceQuote */
const gst = (base: number, ratePercent: number): number => Math.floor((2 * base * Math.round(ratePercent * 1000) + 100000) / 200000);

describe('a checkout total is always the price book plus GST', () => {
  const BOOK = [[3, 300_000], [6, 540_000], [12, 960_000]] as const;

  it.each([0, 5, 12, 18, 28])('at %s percent GST, every term, every gateway, and the cash order', async (rate) => {
    for (const name of ['razorpay', 'cashfree'] as const) {
      const f = flow(name);
      f.w.repo.taxes[0].ratePercent = rate;
      // rules and a code that would have reduced the price before Wave 3 are all present, and all ignored
      f.w.repo.discounts.push({ type: 'PROMO', name: 'Everyone', percentOff: 100, amountOffPaise: null, conditions: {}, stackable: true, active: true, status: 'APPROVED', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null } as never,
        { type: 'MIGRATION', name: 'Half', percentOff: 50, conditions: {}, stackable: true, active: true, status: 'APPROVED', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null, amountOffPaise: null } as never);
      for (const [term, book] of BOOK) {
        const expected = book + gst(book, rate);
        if (rate === 0) { /* a zero rate leaves the book price */ }
        const o = await f.buy({ termMonths: term });
        expect([name, rate, term, o.amountPaise]).toEqual([name, rate, term, expected]);
        expect(o.quote).toMatchObject({ base: book, taxMinor: gst(book, rate), totalMinor: expected, discounts: [] });
        expect(f.gw.orders.get(o.providerOrderId!)!.amountMinor).toBe(expected);   // and that is exactly what the gateway was asked to charge
        const c = await f.orders.createCashOrder('v2', { planKey: 'handyman_pro', termMonths: term, idempotencyKey: `cash-${name}-${rate}-${term}-abcd` }, { type: 'STAFF', id: 's', ip: null });
        expect(c.amountPaise).toBe(expected);
      }
      const withCode = await f.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `key-${name}-${rate}-code-1`, promoCode: 'ANYTHING' } as never, VENDOR);
      expect(withCode.amountPaise).toBe(300_000 + gst(300_000, rate));
    }
  });

  it('is the same split priceQuote and the public pricing page show', () => {
    for (const [, book] of BOOK) for (const rate of [5, 18]) expect(priceQuote({ basePaise: book, taxInclusive: false, discounts: [], taxRatePercent: rate }).totalMinor).toBe(book + gst(book, rate));
  });

  it('the wallet plan renewal prices the same book (GST was added at the refill), also with a discount rule in the tables', async () => {
    const f = flow('razorpay');
    f.w.repo.discounts.push({ type: 'PROMO', name: 'Everyone', percentOff: 100, amountOffPaise: null, conditions: {}, stackable: true, active: true, status: 'APPROVED', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null } as never);
    const settings = await f.settings.get();
    const q = await f.orders.buildQuote('v1', { planKey: 'handyman_pro', termMonths: 6 }, f.w.now.t, settings, { withTax: false });
    expect(q.quote.totalMinor).toBe(540_000); expect(q.quote.discounts).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────── an invoice amount cannot be edited
describe('no one can edit an invoice amount', () => {
  it('there is no route that changes a platform plan invoice: the plan invoice routes are reads', () => {
    const invoiceRoutes = routes.filter((r) => /^\S+ \/v3\/(me\/billing\/invoices|admin\/invoices)/.test(r.route));
    expect(invoiceRoutes.length).toBeGreaterThanOrEqual(3);
    expect(invoiceRoutes.filter((r) => !r.route.startsWith('GET '))).toEqual([]);
  });
  it('the code has no update, delete or upsert of a plan invoice anywhere (an invoice is inserted once and read after that)', () => {
    const offenders: string[] = [];
    for (const f of listFiles(src)) { const t = fs.readFileSync(f, 'utf8'); if (/v3PlanInvoice\.(update|updateMany|upsert|delete|deleteMany)\b/.test(t)) offenders.push(rel(f)); }
    expect(offenders).toEqual([]);
    const repo = fs.readFileSync(path.join(src, 'plan-billing/plan-billing.repository.ts'), 'utf8');
    expect(repo).not.toMatch(/(update|edit|set|change|replace)Invoice(?!Delivery)\w*\(/i);   // setInvoiceDeliveryStatus records the MAIL, never an amount
  });
  it('the refund route only RECORDS a refund on the order and never writes the invoice (SUPER_ADMIN only)', () => {
    expect([...effectiveRolesFor('POST /v3/admin/billing/orders/:id/refund')]).toEqual(['SUPER_ADMIN']);
    const s = fs.readFileSync(path.join(src, 'plan-billing/settlement.service.ts'), 'utf8');
    const refund = s.slice(s.indexOf('async recordRefund'), s.indexOf('async expireStale'));
    expect(refund).not.toMatch(/invoice/i);
  });
});
