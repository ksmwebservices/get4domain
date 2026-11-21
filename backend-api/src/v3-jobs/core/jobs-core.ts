import { normalisePhone } from '../../v3-customers/core/customer-core';

/**
 * Pure rules of jobs and quotes (slice 5.24a, Handyman): quote lines and totals, the quote and job state machines, job input, and the calendar grouping. No clock, no database, no randomness.
 * Money is integer paise. A tax rate on a line must be one the caller read from the rate table; no rate is invented here, and a line with no rate carries no tax.
 * A job reaches PAID only through the payment path (a payment the business confirmed, Stage 9); no manual transition leads there.
 */
export const QUOTE_STATES = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];
export const JOB_STATES = ['REQUESTED', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'DONE', 'PAID', 'CANCELLED'] as const;
export type JobState = (typeof JOB_STATES)[number];

const QUOTE_NEXT: Readonly<Record<QuoteState, readonly QuoteState[]>> = { DRAFT: ['SENT'], SENT: ['ACCEPTED', 'DECLINED', 'EXPIRED'], ACCEPTED: [], DECLINED: [], EXPIRED: [] };
export const canQuoteMove = (from: QuoteState, to: QuoteState): boolean => QUOTE_NEXT[from].includes(to);

export const isJobState = (v: unknown): v is JobState => typeof v === 'string' && (JOB_STATES as readonly string[]).includes(v);
const JOB_NEXT: Readonly<Record<JobState, readonly JobState[]>> = {
  REQUESTED: ['QUOTED', 'BOOKED', 'CANCELLED'], QUOTED: ['BOOKED', 'CANCELLED'], BOOKED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['DONE', 'CANCELLED'], DONE: ['PAID'], PAID: [], CANCELLED: [],
};
export const canJobMove = (from: JobState, to: JobState): boolean => JOB_NEXT[from].includes(to);

/** What a quote event does to the job it belongs to: a sent quote moves a requested job to quoted, an accepted one books a job that is not yet booked; a job that is further along is left alone. */
export function jobStateAfterQuote(job: JobState, event: 'SENT' | 'ACCEPTED'): JobState {
  if (event === 'SENT') return job === 'REQUESTED' ? 'QUOTED' : job;
  return job === 'REQUESTED' || job === 'QUOTED' ? 'BOOKED' : job;
}

export interface QuoteLine { name: string; qty: number; unitPaise: number; taxPercent: number; taxablePaise: number; taxPaise: number; amountPaise: number }
export interface QuoteBuilt { lines: QuoteLine[]; taxablePaise: number; taxPaise: number; totalPaise: number }
export type Built<T> = { ok: true; value: T } | { ok: false; problems: string[] };

/** Tax of a line, nearest paisa, half up, from a percent with up to three decimals; integer arithmetic only. */
const taxOf = (taxable: number, percent: number): number => Math.floor((taxable * Math.round(percent * 1000) + 50_000) / 100_000);

export function buildQuote(raw: unknown, allowedRates: readonly number[]): Built<QuoteBuilt> {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) return { ok: false, problems: ['lines: 1 to 50 lines'] };
  const problems: string[] = []; const lines: QuoteLine[] = [];
  raw.forEach((l: Record<string, unknown>, i) => {
    const at = `line ${i + 1}`;
    const name = typeof l?.name === 'string' ? l.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 1 || name.length > 120) problems.push(`${at}: name 1 to 120 characters`);
    if (!Number.isSafeInteger(l?.qty) || (l.qty as number) < 1 || (l.qty as number) > 100_000) problems.push(`${at}: qty a whole number from 1`);
    if (!Number.isSafeInteger(l?.unitPaise) || (l.unitPaise as number) < 0 || (l.unitPaise as number) > 1_000_000_000) problems.push(`${at}: unitPaise a whole number of paise, zero or more`);
    let pct = 0;
    if (l?.taxPercent !== undefined && l?.taxPercent !== null) { if (typeof l.taxPercent === 'number' && allowedRates.includes(l.taxPercent)) pct = l.taxPercent; else problems.push(`${at}: taxPercent is not a rate in the rate table`); }
    if (problems.length) return;
    const taxable = (l.qty as number) * (l.unitPaise as number); const tax = taxOf(taxable, pct);
    lines.push({ name, qty: l.qty as number, unitPaise: l.unitPaise as number, taxPercent: pct, taxablePaise: taxable, taxPaise: tax, amountPaise: taxable + tax });
  });
  if (problems.length) return { ok: false, problems };
  const sum = (f: (l: QuoteLine) => number): number => lines.reduce((a, l) => a + f(l), 0);
  return { ok: true, value: { lines, taxablePaise: sum((l) => l.taxablePaise), taxPaise: sum((l) => l.taxPaise), totalPaise: sum((l) => l.amountPaise) } };
}

export interface JobFields { title: string; customerName: string; customerPhone: string | null; address: string | null; notes: string | null }
export function checkJobInput(i: { title?: unknown; customerName?: unknown; customerPhone?: unknown; address?: unknown; notes?: unknown }): Built<JobFields> {
  const problems: string[] = [];
  const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
  const title = text(i.title, 120); const customerName = text(i.customerName, 120);
  if (!title) problems.push('title: 1 to 120 characters');
  if (!customerName) problems.push('customerName: 1 to 120 characters');
  let customerPhone: string | null = null;
  if (i.customerPhone !== undefined && i.customerPhone !== null && String(i.customerPhone).trim() !== '') { if (normalisePhone(i.customerPhone)) customerPhone = String(i.customerPhone).trim().slice(0, 20); else problems.push('customerPhone: not a phone number'); }
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { title, customerName, customerPhone, address: text(i.address, 300) || null, notes: text(i.notes, 2000) || null } };
}

const IST_MS = 330 * 60_000;
/** Jobs (as epoch milliseconds) grouped by India day, days and ids in time order. */
export function calendarDays(items: ReadonlyArray<{ id: string; at: number }>): Array<{ day: string; ids: string[] }> {
  const out = new Map<string, string[]>();
  for (const it of [...items].sort((a, b) => a.at - b.at)) {
    const ist = it.at + IST_MS; const days = Math.floor(ist / 86_400_000);
    const z = days + 719_468; const era = Math.floor(z / 146_097); const doe = z - era * 146_097; const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); const mp = Math.floor((5 * doy + 2) / 153); const d = doy - Math.floor((153 * mp + 2) / 5) + 1; const m = mp < 10 ? mp + 3 : mp - 9; const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    (out.get(key) ?? out.set(key, []).get(key)!).push(it.id);
  }
  return [...out.entries()].map(([day, ids]) => ({ day, ids }));
}
