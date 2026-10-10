import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdSpendEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { clean } from './goals';
import { EVENT_TYPES } from './leadspace.types';
import { LeadspaceSettingsService } from './settings.service';

export interface CostRow {
  category: string; city: string;
  /** events that were real and valid (delivered or held; credited ones are not counted) */
  verifiedEvents: number; held: number; credited: number;
  /** what vendors were charged, before GST */
  revenueNetPaise: number; spendPaise: number;
  costPerVerifiedLeadPaise: number | null; marginPercent: number | null; alert: string | null;
}

export interface WalletReportLine {
  at: string; reason: string; direction: 'IN' | 'OUT'; amountPaise: number; balanceAfterPaise: number;
  leadType: string | null; customer: string | null; leadStatus: string | null; note: string | null;
}
export interface WalletReport {
  from: string; to: string; openingPaise: number; closingPaise: number;
  totals: { inPaise: number; outPaise: number; chargedPaise: number; creditedBackPaise: number; refilledPaise: number; charges: number; averageChargePaise: number | null; verifiedLeads: number };
  byReason: Record<string, { count: number; paise: number }>;
  byType: Record<string, { count: number; paise: number }>;
  perDay: { day: string; inPaise: number; outPaise: number; charges: number; closingPaise: number }[];
  lines: WalletReportLine[]; truncated: boolean;
}

const day = (s: string, end = false): Date => new Date(`${s}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);

/** Money maths for the admin: what Get4Domain spent on boosts against what verified leads earned, and the funnel a vendor sees. */
@Injectable()
export class LeadspaceReportsService {
  constructor(private readonly prisma: PrismaService, private readonly settings: LeadspaceSettingsService) {}

  // — ad spend entered by hand (our team boosts posts in Ads Manager) —

  async addSpend(i: { date: string; channel: string; category?: string; city?: string; amountPaise: number; note?: string }, by: string): Promise<AdSpendEntry> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) throw new BadRequestException('Enter the date as year-month-day.');
    if (!Number.isInteger(i.amountPaise) || i.amountPaise <= 0 || i.amountPaise > 1_000_000_000) throw new BadRequestException('Enter the amount spent in whole paise.');
    return this.prisma.adSpendEntry.create({ data: { date: day(i.date), channel: clean(i.channel, 40) || 'OTHER', category: clean(i.category, 60) || null, city: clean(i.city, 60) || null, amountPaise: i.amountPaise, note: clean(i.note, 200) || null, createdBy: by } });
  }

  listSpend(from?: string, to?: string): Promise<AdSpendEntry[]> {
    return this.prisma.adSpendEntry.findMany({ where: { ...(from || to ? { date: { ...(from ? { gte: day(from) } : {}), ...(to ? { lte: day(to, true) } : {}) } } : {}) }, orderBy: { date: 'desc' }, take: 500 });
  }

  async removeSpend(id: string): Promise<{ removed: true }> {
    const r = await this.prisma.adSpendEntry.deleteMany({ where: { id } });
    if (r.count !== 1) throw new NotFoundException('We could not find that entry.');
    return { removed: true };
  }

  // — cost per verified lead, by trade and city —

  async costReport(from: string, to: string): Promise<{ from: string; to: string; floorPercent: number; rows: CostRow[]; unallocatedSpendPaise: number; total: Omit<CostRow, 'category' | 'city'>; alerts: string[] }> {
    const s = await this.settings.get();
    const events = await this.prisma.leadEvent.findMany({ where: { createdAt: { gte: day(from), lte: day(to, true) } }, select: { profileId: true, status: true, priceChargedPaise: true } });
    const profiles = await this.prisma.leadspaceProfile.findMany({ select: { id: true, category: true, city: true } });
    const pmap = new Map(profiles.map((p) => [p.id, p]));
    const groups = new Map<string, CostRow>();
    const key = (c: string, ct: string): string => `${c}|${ct}`;
    for (const e of events) {
      const p = e.profileId ? pmap.get(e.profileId) : undefined;
      if (!p) continue;
      const k = key(p.category, p.city);
      const g = groups.get(k) ?? { category: p.category, city: p.city, verifiedEvents: 0, held: 0, credited: 0, revenueNetPaise: 0, spendPaise: 0, costPerVerifiedLeadPaise: null, marginPercent: null, alert: null };
      if (e.status === 'CREDITED') g.credited++; else g.verifiedEvents++;
      if (e.status === 'HELD') g.held++;
      g.revenueNetPaise += e.priceChargedPaise / (1 + s.gstPercent / 100);
      groups.set(k, g);
    }
    // spend is shared out over the rows it matches, by number of verified events; an entry that matches nothing is "unallocated"
    const spend = await this.prisma.adSpendEntry.findMany({ where: { date: { gte: day(from), lte: day(to, true) } } });
    let unallocated = 0;
    for (const sp of spend) {
      const match = [...groups.values()].filter((g) => (!sp.category || g.category === sp.category) && (!sp.city || g.city.toLowerCase() === sp.city.toLowerCase()));
      const weight = match.reduce((a, g) => a + g.verifiedEvents, 0);
      if (!match.length || weight === 0) { unallocated += sp.amountPaise; continue; }
      for (const g of match) g.spendPaise += (sp.amountPaise * g.verifiedEvents) / weight;
    }
    const finish = (g: Omit<CostRow, 'category' | 'city'>): void => {
      g.revenueNetPaise = Math.round(g.revenueNetPaise); g.spendPaise = Math.round(g.spendPaise);
      g.costPerVerifiedLeadPaise = g.verifiedEvents ? Math.round(g.spendPaise / g.verifiedEvents) : null;
      g.marginPercent = g.revenueNetPaise > 0 ? Math.round(((g.revenueNetPaise - g.spendPaise) / g.revenueNetPaise) * 1000) / 10 : null;
      g.alert = g.spendPaise > 0 && g.revenueNetPaise === 0 ? 'Money was spent and nothing was earned yet.' : g.marginPercent !== null && g.marginPercent < s.marginFloorPercent ? `Margin ${g.marginPercent}% is below the ${s.marginFloorPercent}% floor.` : null;
    };
    const rows = [...groups.values()];
    rows.forEach(finish);
    rows.sort((a, b) => (a.marginPercent ?? 999) - (b.marginPercent ?? 999));
    const total: Omit<CostRow, 'category' | 'city'> = { verifiedEvents: 0, held: 0, credited: 0, revenueNetPaise: 0, spendPaise: Math.round(unallocated), costPerVerifiedLeadPaise: null, marginPercent: null, alert: null };
    for (const g of rows) { total.verifiedEvents += g.verifiedEvents; total.held += g.held; total.credited += g.credited; total.revenueNetPaise += g.revenueNetPaise; total.spendPaise += g.spendPaise; }
    finish(total);
    return { from, to, floorPercent: s.marginFloorPercent, rows, unallocatedSpendPaise: Math.round(unallocated), total, alerts: rows.filter((r) => r.alert).map((r) => `${r.category} in ${r.city}: ${r.alert}`) };
  }

  // — the test-campaign sheet: per UTM campaign, spend against verified leads —

  /**
   * KSM's manual test ads: one row per `utm_campaign` (convention: <trade>-<city>-<yyyymm>) with the verified leads it brought and the spend recorded for it.
   * Spend is matched by writing the campaign name in the note of the AdSpendEntry, so one entry per boost is enough.
   */
  async utmSheet(from: string, to: string): Promise<{ from: string; to: string; rows: { campaign: string; sources: string[]; verifiedEvents: number; held: number; credited: number; spendPaise: number; costPerVerifiedLeadPaise: number | null; chargedPaise: number }[] }> {
    const events = await this.prisma.leadEvent.findMany({ where: { createdAt: { gte: day(from), lte: day(to, true) } }, select: { utm: true, status: true, priceChargedPaise: true } });
    const spend = await this.prisma.adSpendEntry.findMany({ where: { date: { gte: day(from), lte: day(to, true) } } });
    const by = new Map<string, { sources: Set<string>; verified: number; held: number; credited: number; charged: number }>();
    for (const e of events) {
      const u = (e.utm && typeof e.utm === 'object' ? e.utm : {}) as Record<string, string>;
      const c = (u.utm_campaign ?? '').trim().toLowerCase() || '(no campaign)';
      const g = by.get(c) ?? { sources: new Set<string>(), verified: 0, held: 0, credited: 0, charged: 0 };
      if (u.utm_source) g.sources.add(u.utm_source);
      if (e.status === 'CREDITED') g.credited++; else g.verified++;
      if (e.status === 'HELD') g.held++;
      g.charged += e.priceChargedPaise;
      by.set(c, g);
    }
    const rows = [...by.entries()].map(([campaign, g]) => {
      const spendPaise = campaign === '(no campaign)' ? 0 : spend.filter((sp) => (sp.note ?? '').toLowerCase().includes(campaign)).reduce((a, sp) => a + sp.amountPaise, 0);
      return { campaign, sources: [...g.sources], verifiedEvents: g.verified, held: g.held, credited: g.credited, spendPaise, costPerVerifiedLeadPaise: g.verified ? Math.round(spendPaise / g.verified) : null, chargedPaise: g.charged };
    }).sort((a, b) => a.campaign.localeCompare(b.campaign));
    // a campaign with spend and no events yet still gets a row
    for (const sp of spend) {
      const m = /([a-z0-9-]+-[a-z0-9-]+-\d{6})/i.exec(sp.note ?? '');
      if (m && !rows.some((r) => r.campaign === m[1].toLowerCase())) rows.push({ campaign: m[1].toLowerCase(), sources: [], verifiedEvents: 0, held: 0, credited: 0, spendPaise: spend.filter((x) => (x.note ?? '').toLowerCase().includes(m[1].toLowerCase())).reduce((a, x) => a + x.amountPaise, 0), costPerVerifiedLeadPaise: null, chargedPaise: 0 });
    }
    return { from, to, rows };
  }

  csvSheet(rows: { campaign: string; sources: string[]; verifiedEvents: number; held: number; credited: number; spendPaise: number; costPerVerifiedLeadPaise: number | null; chargedPaise: number }[]): string {
    const NL = String.fromCharCode(10);
    const rs = (p: number | null): string => (p === null ? '' : (p / 100).toFixed(2));
    return [['Campaign', 'Sources', 'Verified leads', 'Held', 'Credited', 'Spend (Rs)', 'Cost per verified lead (Rs)', 'Charged to vendors (Rs)'].join(','),
      ...rows.map((r) => [r.campaign, r.sources.join('/'), r.verifiedEvents, r.held, r.credited, rs(r.spendPaise), rs(r.costPerVerifiedLeadPaise), rs(r.chargedPaise)].join(','))].join(NL);
  }

  // — one vendor's wallet report: every rupee in and out, from the append-only ledger —

  /**
   * "Where did my wallet money go?" Read straight from the ledger, so it always agrees with the balance: opening and closing balance, money in by reason,
   * money out by event type, a per-day series, and the individual charges (customer shown masked). Nothing here can change a balance.
   */
  async walletReport(vendorId: string, from: string, to: string): Promise<WalletReport> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new BadRequestException('Choose the dates as year-month-day, start before end.');
    const range = { gte: day(from), lte: day(to, true) };
    const [entries, before] = await Promise.all([
      this.prisma.leadPurseEntry.findMany({ where: { vendorId, createdAt: range }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 5000 }),
      this.prisma.leadPurseEntry.findFirst({ where: { vendorId, createdAt: { lt: day(from) } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { balanceAfter: true } }),
    ]);
    const eventIds = entries.filter((e) => e.refType === 'LeadEvent' && e.refId).map((e) => e.refId as string);
    const events = eventIds.length ? await this.prisma.leadEvent.findMany({ where: { vendorId, id: { in: eventIds } }, select: { id: true, type: true, customerName: true, customerPhone: true, status: true, createdAt: true } }) : [];
    const ev = new Map(events.map((e) => [e.id, e]));
    const mask = (p: string): string => (p.length > 4 ? `${'X'.repeat(p.length - 4)}${p.slice(-4)}` : p);
    const byReason: Record<string, { count: number; paise: number }> = {};
    const byType: Record<string, { count: number; paise: number }> = {};
    const days = new Map<string, { day: string; inPaise: number; outPaise: number; charges: number; closingPaise: number }>();
    const lines: WalletReportLine[] = [];
    let inPaise = 0; let outPaise = 0; let charges = 0;
    for (const e of entries) {
      const signed = e.type === 'CREDIT' ? e.amountPaise : -e.amountPaise;
      const r = (byReason[e.reason] ??= { count: 0, paise: 0 });
      r.count++; r.paise += signed;
      const d = e.createdAt.toISOString().slice(0, 10);
      const dd = days.get(d) ?? { day: d, inPaise: 0, outPaise: 0, charges: 0, closingPaise: 0 };
      if (signed > 0) { inPaise += signed; dd.inPaise += signed; } else { outPaise += -signed; dd.outPaise += -signed; }
      dd.closingPaise = e.balanceAfter;
      const lead = e.refType === 'LeadEvent' && e.refId ? ev.get(e.refId) : undefined;
      if (e.reason === 'LEAD_CHARGE') {
        charges++; dd.charges++;
        const t = (byType[lead?.type ?? 'OTHER'] ??= { count: 0, paise: 0 });
        t.count++; t.paise += e.amountPaise;
      }
      days.set(d, dd);
      lines.push({ at: e.createdAt.toISOString(), reason: e.reason, direction: e.type === 'CREDIT' ? 'IN' : 'OUT', amountPaise: e.amountPaise, balanceAfterPaise: e.balanceAfter, leadType: lead?.type ?? null, customer: lead ? `${lead.customerName.split(' ')[0]} ${mask(lead.customerPhone)}` : null, leadStatus: lead?.status ?? null, note: e.note });
    }
    const closing = entries.length ? entries[entries.length - 1].balanceAfter : (before?.balanceAfter ?? 0);
    const verified = await this.prisma.leadEvent.count({ where: { vendorId, createdAt: range, status: { not: 'CREDITED' } } });
    return {
      from, to, openingPaise: before?.balanceAfter ?? 0, closingPaise: closing,
      totals: { inPaise, outPaise, chargedPaise: -(byReason.LEAD_CHARGE?.paise ?? 0), creditedBackPaise: byReason.CREDIT_INVALID?.paise ?? 0, refilledPaise: byReason.REFILL?.paise ?? 0, charges, averageChargePaise: charges ? Math.round((-(byReason.LEAD_CHARGE?.paise ?? 0)) / charges) : null, verifiedLeads: verified },
      byReason, byType, perDay: [...days.values()], lines: lines.reverse().slice(0, 500), truncated: entries.length >= 5000,
    };
  }

  /** The same report as a spreadsheet (one row per ledger line). */
  walletCsv(r: WalletReport): string {
    const NL = String.fromCharCode(10);
    const q = (s: string | null): string => `"${(s ?? '').replace(/"/g, '""')}"`;
    return [['When', 'What', 'Direction', 'Amount (Rs)', 'Balance after (Rs)', 'Lead type', 'Customer', 'Lead status', 'Note'].join(','),
      ...r.lines.map((l) => [l.at, l.reason, l.direction, (l.amountPaise / 100).toFixed(2), (l.balanceAfterPaise / 100).toFixed(2), l.leadType ?? '', q(l.customer), l.leadStatus ?? '', q(l.note)].join(','))].join(NL);
  }

  // — one vendor's funnel —

  async funnel(vendorId: string, from: string, to: string): Promise<Record<string, unknown>> {
    const range = { gte: day(from), lte: day(to, true) };
    const [stats, otps, events] = await Promise.all([
      this.prisma.leadspaceDailyStat.aggregate({ where: { vendorId, day: { gte: day(from), lte: day(to) } }, _sum: { views: true, ctaClicks: true, formStarts: true, outboundClicks: true } }),
      this.prisma.leadOtp.count({ where: { vendorId, createdAt: range, OR: [{ deviceHash: null }, { deviceHash: { not: 'vendor-verify' } }] } }),
      this.prisma.leadEvent.findMany({ where: { vendorId, createdAt: range }, select: { type: true, status: true, priceChargedPaise: true } }),
    ]);
    const profile = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { category: true, city: true } });
    // a code that was sent, never used and has now expired: the customer started and did not finish. Never charged.
    const unfinished = await this.prisma.leadOtp.count({ where: { vendorId, createdAt: range, usedAt: null, expiresAt: { lt: new Date() }, OR: [{ deviceHash: null }, { deviceHash: { not: 'vendor-verify' } }] } });
    const byType = Object.fromEntries(EVENT_TYPES.map((t) => [t, events.filter((e) => e.type === t).length]));
    const n = (st: string): number => events.filter((e) => e.status === st).length;
    const spent = events.reduce((a, e) => a + e.priceChargedPaise, 0);
    const valid = events.filter((e) => e.status !== 'CREDITED').length;
    let attributedSpendPaise = 0; let costPerVerifiedEventPaise: number | null = null;
    if (profile) {
      const cr = await this.costReport(from, to);
      const row = cr.rows.find((r) => r.category === profile.category && r.city === profile.city);
      if (row && row.verifiedEvents > 0) { costPerVerifiedEventPaise = row.costPerVerifiedLeadPaise; attributedSpendPaise = Math.round((row.spendPaise * valid) / row.verifiedEvents); }
    }
    return {
      from, to, views: stats._sum.views ?? 0, buttonTaps: stats._sum.ctaClicks ?? 0, formsStarted: stats._sum.formStarts ?? 0, buyLinkTaps: stats._sum.outboundClicks ?? 0, codesRequested: otps,
      verifiedEvents: events.length, byType, held: n('HELD'), delivered: n('DELIVERED') + n('CONTACTED') + n('WON') + n('LOST') + n('DISPUTED'), contacted: n('CONTACTED') + n('WON') + n('LOST'), won: n('WON'), credited: n('CREDITED'),
      unfinished, cartOrders: byType.CART_ORDER ?? 0, ordersConfirmed: events.filter((e) => e.type === 'CART_ORDER' && e.status === 'WON').length, ordersDeclined: events.filter((e) => e.type === 'CART_ORDER' && e.status === 'LOST').length,
      chargedPaise: spent, attributedSpendPaise, costPerVerifiedEventPaise,
      conversion: { viewToTap: ratio(stats._sum.ctaClicks, stats._sum.views), tapToForm: ratio(stats._sum.formStarts, stats._sum.ctaClicks), formToCode: ratio(otps, stats._sum.formStarts), codeToEvent: ratio(events.length, otps) },
    };
  }
}

function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  return b ? Math.round(((a ?? 0) / b) * 1000) / 10 : null;
}
