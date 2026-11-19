import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingSettingsService } from '../plan-billing/settings/billing-settings.service';
import { ageMinutes, CACHE_SECONDS, fillSeries, istMonthEdges, num, OverviewSection, sectionsFor, SERIES_SECTION, seriesStart } from './overview-core';

const DAY = 86_400_000;
const REAL_VENDOR = { role: 'VENDOR', isSandbox: false } as const;   // staff rows and demo sandboxes are not customers
const OPEN_TICKET = ['OPEN', 'IN_PROGRESS', 'WAITING_VENDOR'];
const DOMAIN_PENDING = ['CREATED', 'HELD', 'SUBMITTED', 'UNKNOWN'];
const SERVICE_WAITING = ['REQUESTED'];
const SERVICE_WORKING = ['ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'];
const COMMISSION_PENDING = ['ACCRUED', 'APPROVED'];

type Dict = Record<string, unknown>;
interface Cached { at: number; promise: Promise<Dict | null> }

/**
 * K1: the admin overview. Every number is counted from a real table; nothing is estimated. Only the sections the caller's role may see are computed (and only those are returned).
 * Each section is kept for 60 seconds and shared between callers (one database round trip per section per minute however many staff open the page); a failed read is never kept.
 */
@Injectable()
export class AdminOverviewService {
  clock: () => Date = () => new Date();
  private readonly cache = new Map<OverviewSection | 'series.vendors' | 'series.enquiries' | 'series.paidOrders', Cached>();
  constructor(private readonly prisma: PrismaService, private readonly settings: BillingSettingsService) {}

  /** Test hook. */
  clearCache(): void { this.cache.clear(); }

  async overview(role: string | undefined): Promise<Dict> {
    const allowed = sectionsFor(role);
    const out: Dict = {};
    const stamps: number[] = [];
    const pick = async (key: OverviewSection | 'series.vendors' | 'series.enquiries' | 'series.paidOrders', build: () => Promise<Dict | null>): Promise<Dict | null> => {
      const hit = this.cache.get(key);
      const now = this.clock().getTime();
      if (hit && now - hit.at < CACHE_SECONDS * 1000) { stamps.push(hit.at); return hit.promise; }
      const promise = build();
      const entry: Cached = { at: now, promise };
      this.cache.set(key, entry);
      promise.catch(() => { if (this.cache.get(key) === entry) this.cache.delete(key); });
      stamps.push(now);
      return promise;
    };
    // payments mode is read once; revenue figures (and the paid-orders series) are null when payments are off
    const paymentsOn = allowed.includes('revenue') ? (await this.settings.get()).paymentsMode !== 'off' : false;

    const jobs: Array<Promise<void>> = [];
    const section = (s: OverviewSection, build: () => Promise<Dict | null>) => { if (allowed.includes(s)) jobs.push(pick(s, build).then((v) => { out[s] = v; })); };
    section('vendors', () => this.vendors());
    // payments off is answered straight away and never kept, so switching payments on shows real figures at once
    if (allowed.includes('revenue')) { if (paymentsOn) section('revenue', () => this.revenue()); else out.revenue = null; }
    section('enquiries', () => this.enquiries());
    section('support', () => this.support());
    section('domainsServices', () => this.domainsServices());
    section('referrals', () => this.referrals());

    const series: Dict = {};
    const addSeries = (k: 'vendors' | 'enquiries' | 'paidOrders', build: () => Promise<Dict | null>) => {
      if (allowed.includes(SERIES_SECTION[k])) jobs.push(pick(`series.${k}`, build).then((v) => { series[k] = v === null ? null : v.days; }));
    };
    addSeries('vendors', () => this.vendorSeries());
    addSeries('enquiries', () => this.enquirySeries());
    if (allowed.includes('revenue')) { if (paymentsOn) addSeries('paidOrders', () => this.paidOrderSeries()); else series.paidOrders = null; }
    await Promise.all(jobs);

    const sections = [...allowed];
    const body: Dict = { generatedAt: new Date(stamps.length ? Math.min(...stamps) : this.clock().getTime()).toISOString(), cacheSeconds: CACHE_SECONDS, sections };
    for (const s of sections) if (s in out) body[s] = out[s];
    if (Object.keys(series).length) body.dailySeries = series;
    return body;
  }

  // ── sections ─────────────────────────────────────────────────────────────────────────────────────────────

  private async vendors(): Promise<Dict> {
    const now = this.clock();
    const d7 = new Date(now.getTime() - 7 * DAY); const d30 = new Date(now.getTime() - 30 * DAY);
    const [total, new7, new30, byPlan, plans, live, failed, provisioning] = await Promise.all([
      this.prisma.vendor.count({ where: REAL_VENDOR }),
      this.prisma.vendor.count({ where: { ...REAL_VENDOR, createdAt: { gte: d7 } } }),
      this.prisma.vendor.count({ where: { ...REAL_VENDOR, createdAt: { gte: d30 } } }),
      this.prisma.v3PlanSubscription.groupBy({ by: ['planId'], where: { currentVendorId: { not: null }, vendor: REAL_VENDOR }, _count: { _all: true } }),
      this.prisma.v3Plan.findMany({ select: { id: true, key: true, name: true, level: true, track: true }, orderBy: [{ track: 'asc' }, { level: 'asc' }] }),
      this.prisma.v3SitePublication.count({ where: { currentVendorId: { not: null }, vendor: REAL_VENDOR } }),
      this.prisma.vendor.count({ where: { ...REAL_VENDOR, siteProvisionStatus: 'FAILED' } }),
      this.prisma.v3ProvisioningJob.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'WAITING'] } } }),
    ]);
    const counts = new Map(byPlan.map((r) => [r.planId, r._count._all]));
    const byPlanList = plans.map((p) => ({ planKey: p.key, name: p.name, track: String(p.track), level: String(p.level), vendors: counts.get(p.id) ?? 0 }));
    const withPlan = byPlan.reduce((n, r) => n + r._count._all, 0);
    const free = byPlanList.filter((p) => p.level === 'FREE').reduce((n, p) => n + p.vendors, 0);
    return {
      total, new7Days: new7, new30Days: new30,
      byPlan: { free, pro: byPlanList.filter((p) => p.level === 'PRO'), freeByTrack: byPlanList.filter((p) => p.level === 'FREE'), noPlan: Math.max(0, total - withPlan) },
      sites: { live, failed, provisioning },
    };
  }

  /** Paid plan orders and their invoices, this month and last month (India time), the wallet top-ups and recorded refunds. All amounts are paise. */
  private async revenue(): Promise<Dict> {
    const { thisStart, lastStart, nextStart } = istMonthEdges(this.clock());
    const rows = await this.prisma.$queryRaw<Array<{ m: string; orders: bigint; invoices: bigint; gross: bigint | null; tax: bigint | null }>>`
      SELECT CASE WHEN o."paidAt" >= ${thisStart} THEN 'this' ELSE 'last' END AS m,
             count(*) AS orders, count(i.id) AS invoices, sum(o."paidAmountPaise") AS gross,
             sum(CASE WHEN jsonb_typeof(i."taxBreakdownJson"->'taxMinor') = 'number' THEN (i."taxBreakdownJson"->>'taxMinor')::bigint ELSE 0 END) AS tax
        FROM g4d_plan_orders o LEFT JOIN g4d_plan_invoices i ON i."orderId" = o.id
       WHERE o.status = 'PAID' AND o."paidAt" >= ${lastStart} AND o."paidAt" < ${nextStart}
       GROUP BY 1`;
    const month = (k: string) => {
      const r = rows.find((x) => x.m === k);
      const gross = num(r?.gross); const tax = num(r?.tax);
      return { paidOrders: num(r?.orders), invoices: num(r?.invoices), grossPaise: gross, gstPaise: tax, netOfGstPaise: gross - tax };
    };
    const [topThis, topLast, refThis, refLast] = await Promise.all([
      this.prisma.v3WalletTopup.aggregate({ where: { status: 'PAID', paidAt: { gte: thisStart, lt: nextStart } }, _count: { _all: true }, _sum: { paidAmountPaise: true } }),
      this.prisma.v3WalletTopup.aggregate({ where: { status: 'PAID', paidAt: { gte: lastStart, lt: thisStart } }, _count: { _all: true }, _sum: { paidAmountPaise: true } }),
      this.prisma.v3PlanOrder.aggregate({ where: { refundRecordedAt: { gte: thisStart, lt: nextStart } }, _count: { _all: true }, _sum: { refundRecordedPaise: true } }),
      this.prisma.v3PlanOrder.aggregate({ where: { refundRecordedAt: { gte: lastStart, lt: thisStart } }, _count: { _all: true }, _sum: { refundRecordedPaise: true } }),
    ]);
    const top = (a: typeof topThis) => ({ count: a._count._all, paise: num(a._sum.paidAmountPaise) });
    const ref = (a: typeof refThis) => ({ count: a._count._all, paise: num(a._sum.refundRecordedPaise) });
    return { currency: 'INR', timezone: 'Asia/Kolkata', thisMonth: { ...month('this'), walletTopups: top(topThis), refunds: ref(refThis) }, lastMonth: { ...month('last'), walletTopups: top(topLast), refunds: ref(refLast) } };
  }

  private async enquiries(): Promise<Dict> {
    const now = this.clock();
    const d7 = new Date(now.getTime() - 7 * DAY); const d30 = new Date(now.getTime() - 30 * DAY);
    const real = { status: { not: 'SPAM' as const } };
    const [c7, c30, held, dupes] = await Promise.all([
      this.prisma.v3Request.count({ where: { ...real, createdAt: { gte: d7 } } }),
      this.prisma.v3Request.count({ where: { ...real, createdAt: { gte: d30 } } }),
      this.prisma.v3InboxMessage.count({ where: { state: 'HELD' } }),
      this.prisma.v3DuplicateReview.count({ where: { status: 'PENDING' } }),
    ]);
    return { captured7Days: c7, captured30Days: c30, held, heldDuplicatesWaitingReview: dupes };
  }

  private async support(): Promise<Dict> {
    const now = this.clock();
    const [open, oldest] = await Promise.all([
      this.prisma.v3Ticket.count({ where: { status: { in: OPEN_TICKET } } }),
      this.prisma.v3Ticket.aggregate({ where: { status: { in: OPEN_TICKET } }, _min: { createdAt: true } }),
    ]);
    return { openTickets: open, oldestOpenAgeMinutes: ageMinutes(oldest._min.createdAt, now) };
  }

  private async domainsServices(): Promise<Dict> {
    const now = this.clock();
    const [pending, failed, waiting, working, ready, breached, oldest] = await Promise.all([
      this.prisma.v3DomainOrder.count({ where: { status: { in: DOMAIN_PENDING } } }),
      this.prisma.v3DomainOrder.count({ where: { status: 'FAILED' } }),
      this.prisma.v3ServiceRequest.count({ where: { status: { in: SERVICE_WAITING as never[] } } }),
      this.prisma.v3ServiceRequest.count({ where: { status: { in: SERVICE_WORKING as never[] } } }),
      this.prisma.v3ServiceRequest.count({ where: { status: 'READY_FOR_REVIEW' } }),
      this.prisma.v3ServiceRequest.count({ where: { slaBreachedAt: { not: null }, status: { in: [...SERVICE_WAITING, ...SERVICE_WORKING] as never[] } } }),
      this.prisma.v3ServiceRequest.aggregate({ where: { status: { in: SERVICE_WAITING as never[] } }, _min: { createdAt: true } }),
    ]);
    return {
      domainOrders: { pending, failed },
      serviceQueue: { waiting, inProgress: working, readyForReview: ready, slaBreached: breached, oldestWaitingAgeMinutes: ageMinutes(oldest._min.createdAt, now) },
    };
  }

  private async referrals(): Promise<Dict> {
    const now = this.clock();
    const d7 = new Date(now.getTime() - 7 * DAY); const d30 = new Date(now.getTime() - 30 * DAY);
    const [active, n7, n30, pending] = await Promise.all([
      this.prisma.referralPartner.count({ where: { status: 'ACTIVE' } }),
      this.prisma.referralPartner.count({ where: { createdAt: { gte: d7 } } }),
      this.prisma.referralPartner.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.commissionLedger.aggregate({ where: { status: { in: COMMISSION_PENDING } }, _count: { _all: true }, _sum: { amountMinor: true } }),
    ]);
    return { partners: { active, new7Days: n7, new30Days: n30 }, commissionsPending: { count: pending._count._all, amountPaise: num(pending._sum.amountMinor) } };
  }

  // ── daily series (one grouped query each, India-time days, zeros filled in) ───────────────────────────────

  private async vendorSeries(): Promise<Dict> {
    const now = this.clock(); const from = seriesStart(now);
    const rows = await this.prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
      SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, count(*) AS n FROM "Vendor"
       WHERE "createdAt" >= ${from} AND role = 'VENDOR' AND "isSandbox" = false GROUP BY 1`;
    return { days: fillSeries(rows.map((r) => ({ day: r.day, n: num(r.n) })), now) };
  }

  private async enquirySeries(): Promise<Dict> {
    const now = this.clock(); const from = seriesStart(now);
    const rows = await this.prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
      SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, count(*) AS n FROM g4d_requests
       WHERE "createdAt" >= ${from} AND status <> 'SPAM' GROUP BY 1`;
    return { days: fillSeries(rows.map((r) => ({ day: r.day, n: num(r.n) })), now) };
  }

  private async paidOrderSeries(): Promise<Dict> {
    const now = this.clock(); const from = seriesStart(now);
    const rows = await this.prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
      SELECT to_char(("paidAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, count(*) AS n FROM g4d_plan_orders
       WHERE status = 'PAID' AND "paidAt" >= ${from} GROUP BY 1`;
    return { days: fillSeries(rows.map((r) => ({ day: r.day, n: num(r.n) })), now) };
  }
}
