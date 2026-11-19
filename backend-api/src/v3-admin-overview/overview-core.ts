/** K1: pure parts of the admin overview (no database): which role sees which section, India-time month and day edges, and series filling. */

export const OVERVIEW_SECTIONS = ['vendors', 'revenue', 'enquiries', 'support', 'domainsServices', 'referrals'] as const;
export type OverviewSection = (typeof OVERVIEW_SECTIONS)[number];

/**
 * Which sections each role receives. A role that is not here receives nothing (the route refuses it first). A section a role may not see is ABSENT from the answer, never zero.
 * Follows what each role already reads elsewhere: OPERATIONS reads orders, tickets, domain and service queues and partners; SALES (MARKETING) sees growth only (no money, no tickets);
 * ADMIN and SUPER_ADMIN see all. FINANCE is not a staff role in this build (AdminRole has no such value): the entry is ready so adding the role later is one route-matrix line.
 */
export const SECTIONS_BY_ROLE: Readonly<Record<string, readonly OverviewSection[]>> = {
  SUPER_ADMIN: OVERVIEW_SECTIONS,
  ADMIN: OVERVIEW_SECTIONS,
  OPERATIONS: OVERVIEW_SECTIONS,
  MARKETING: ['vendors', 'enquiries', 'referrals'],
  FINANCE: ['revenue'],
};

export function sectionsFor(role: string | undefined | null): readonly OverviewSection[] {
  return (role !== undefined && role !== null && SECTIONS_BY_ROLE[role]) || [];
}

/** The daily series each section feeds (a series is shown only with its section). */
export const SERIES_SECTION: Readonly<Record<'vendors' | 'enquiries' | 'paidOrders', OverviewSection>> = { vendors: 'vendors', enquiries: 'enquiries', paidOrders: 'revenue' };

export const SERIES_DAYS = 30;
export const CACHE_SECONDS = 60;
const IST_MS = 330 * 60_000;   // India has no daylight saving: a fixed +05:30

/** The calendar date (YYYY-MM-DD) of an instant in India time. */
export function istDay(d: Date): string { return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10); }

/** The instants that start this month, last month and next month in India time. */
export function istMonthEdges(now: Date): { thisStart: Date; lastStart: Date; nextStart: Date } {
  const s = new Date(now.getTime() + IST_MS); const y = s.getUTCFullYear(); const m = s.getUTCMonth();
  const at = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1) - IST_MS);
  return { thisStart: at(y, m), lastStart: at(y, m - 1), nextStart: at(y, m + 1) };
}

/** The first instant of the oldest day of a window of `days` days that ends today (India time). */
export function seriesStart(now: Date, days = SERIES_DAYS): Date {
  const s = new Date(now.getTime() + IST_MS); s.setUTCHours(0, 0, 0, 0);
  return new Date(s.getTime() - (days - 1) * 86_400_000 - IST_MS);
}

/** Every day of the window, oldest first, with 0 where the database returned no row. */
export function fillSeries(rows: ReadonlyArray<{ day: string; n: number }>, now: Date, days = SERIES_DAYS): Array<{ date: string; count: number }> {
  const by = new Map(rows.map((r) => [r.day, r.n]));
  const first = new Date(now.getTime() + IST_MS); first.setUTCHours(0, 0, 0, 0);
  const out: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) { const date = new Date(first.getTime() - i * 86_400_000).toISOString().slice(0, 10); out.push({ date, count: by.get(date) ?? 0 }); }
  return out;
}

/** Whole minutes since `from`, or null when there is no such date. */
export function ageMinutes(from: Date | null | undefined, now: Date): number | null { return from ? Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000)) : null; }

export const num = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : v === null || v === undefined ? 0 : Number(v));
