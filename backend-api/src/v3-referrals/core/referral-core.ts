import { phoneDigits } from '../../v3-partners/core/partner-core';

/**
 * Referrals and commission (Wave 3 Part I). PURE: no database, no clock (the caller passes dates), no randomness (the caller passes bytes), no environment. Money is integer paise.
 *
 * The rules (owner, 17 November 2026):
 *  - a vendor who comes through a link or code is attributed to its source; the FIRST touch wins; only SUPER_ADMIN changes it, with an audit row;
 *  - a partner cannot refer his own business: a matching email or phone is refused;
 *  - the commission is a SLAB BY THE NUMBER OF NEW PAID VENDORS CONVERTED IN THE MONTH: the more a partner converts in a month, the higher the amount per vendor; the admin enters the rows, the system ships with none;
 *  - a vendor counts ONCE, on the first successful paid plan payment (gateway or admin-confirmed cash);
 *  - payout is monthly: an ADMIN closes the month (a route, not a cron), reviews the ledger, and records each payout with a bank or UPI reference; no automatic payout and no tax computed;
 *  - a reversed payment marks the line REVERSED and flags it for the owner.
 */
export type LedgerStatus = 'ACCRUED' | 'APPROVED' | 'PAID' | 'REVERSED';

// ─────────────────────────────────────────────────────────────────────────────── codes
/** No 0, 1, I, L, O or U (they are confused when read aloud or copied by hand). 30 symbols. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const CODE_LENGTH = 8;
const CODE_RE = /^[A-Z2-9]{6,12}$/;

/** A code from random bytes the caller drew (so the function stays pure). Uniform: a byte that would bias the choice is skipped; returns null when the bytes ran out (the caller draws more). */
export function codeFromBytes(bytes: Uint8Array, length = CODE_LENGTH): string | null {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  for (const b of bytes) { if (b >= limit) continue; out += CODE_ALPHABET[b % CODE_ALPHABET.length]; if (out.length === length) return out; }
  return null;
}
/** Upper-cased and trimmed, or null when it is not shaped like a code (so nothing odd reaches a lookup). */
export function normaliseCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const c = input.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

// ─────────────────────────────────────────────────────────────────────────────── self referral
export interface Contact { email?: string | null; phone?: string | null }
/** True when the partner and the business share an email (any case) or a phone number (any common way of writing it). Empty values never match. */
export function isSelfReferral(partner: Contact, vendor: Contact): boolean {
  const pe = (partner.email ?? '').trim().toLowerCase(); const ve = (vendor.email ?? '').trim().toLowerCase();
  if (pe !== '' && pe === ve) return true;
  const pp = phoneDigits(partner.phone); const vp = phoneDigits(vendor.phone);
  return pp.length >= 7 && pp === vp;
}

// ─────────────────────────────────────────────────────────────────────────────── months (India time)
const IST_MS = 330 * 60_000;
/** The YYYY-MM of a moment in India time (the owner counts months there). */
export function monthOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const isMonth = (m: unknown): m is string => typeof m === 'string' && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(m);
/** The first instant AFTER the month, as a UTC moment (midnight India time of the next month's first day). */
export function monthEnd(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1) - IST_MS);
}

// ─────────────────────────────────────────────────────────────────────────────── slabs
export interface Slab { id: string; minVendors: number; maxVendors: number | null; amountPerVendorMinor: number; effectiveFrom: Date }
export type SlabProblem = 'MIN_INVALID' | 'MAX_INVALID' | 'AMOUNT_INVALID' | 'DATE_INVALID' | 'OVERLAP';

/** Checks one slab row against the rows already in force on the same date. Rows with the same effective date must not overlap; a later date replaces the earlier set for the months after it. */
export function slabProblems(row: { minVendors: unknown; maxVendors: unknown; amountPerVendorMinor: unknown; effectiveFrom: unknown }, others: readonly Slab[], selfId?: string): SlabProblem[] {
  const out: SlabProblem[] = [];
  const min = row.minVendors; const max = row.maxVendors; const amt = row.amountPerVendorMinor;
  if (typeof min !== 'number' || !Number.isInteger(min) || min < 1 || min > 100_000) out.push('MIN_INVALID');
  if (max !== null && max !== undefined && (typeof max !== 'number' || !Number.isInteger(max) || (typeof min === 'number' && max < min) || max > 1_000_000)) out.push('MAX_INVALID');
  if (typeof amt !== 'number' || !Number.isInteger(amt) || amt < 1 || amt > 100_000_000) out.push('AMOUNT_INVALID');
  const when = row.effectiveFrom instanceof Date ? row.effectiveFrom : typeof row.effectiveFrom === 'string' ? new Date(row.effectiveFrom) : null;
  if (!when || Number.isNaN(when.getTime())) out.push('DATE_INVALID');
  if (out.length === 0) {
    const lo = min as number; const hi = (max ?? Infinity) as number;
    const clash = others.some((o) => o.id !== selfId && o.effectiveFrom.getTime() === (when as Date).getTime() && lo <= (o.maxVendors ?? Infinity) && o.minVendors <= hi);
    if (clash) out.push('OVERLAP');
  }
  return out;
}

/**
 * The slab rows in force for a month: those whose effective date is on or before the END of the month, and of those only the rows of the LATEST effective date (a later set replaces an earlier one, so an
 * old row can never mix with a new bracket). Then the row whose range holds `count`. null when nothing is in force or no row holds that count.
 */
export function slabFor(slabs: readonly Slab[], count: number, atMonthEnd: Date): Slab | null {
  const live = slabs.filter((s) => s.effectiveFrom.getTime() <= atMonthEnd.getTime());
  if (live.length === 0) return null;
  const latest = Math.max(...live.map((s) => s.effectiveFrom.getTime()));
  return live.filter((s) => s.effectiveFrom.getTime() === latest).find((s) => count >= s.minVendors && count <= (s.maxVendors ?? Infinity)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────── month close
export interface Line { id: string; partnerId: string; vendorId: string; month: string; status: LedgerStatus; amountMinor: number | null }
export interface CloseResult {
  month: string;
  /** true when there were no slab rows in force: nothing accrues and the lines stay ACCRUED with no amount */
  noSlabs: boolean;
  /** lines that move ACCRUED -> APPROVED with their amount; empty on a repeat */
  approve: Array<{ id: string; amountMinor: number }>;
  /** per partner: how many qualifying vendors, the per-vendor amount, the total (a partner whose count fits no slab row is listed with amount null) */
  partners: Array<{ partnerId: string; count: number; perVendorMinor: number | null; totalMinor: number | null }>;
}

/**
 * Closing a month. For each partner the count of its qualifying vendors in the month (lines that are not REVERSED) picks the slab row; every ACCRUED line of that partner gets the row's amount per vendor and
 * becomes APPROVED. A line already APPROVED or PAID is NEVER touched, so closing again changes nothing (idempotent). No slab rows in force: nothing changes and the answer says so.
 */
export function closeMonth(month: string, lines: readonly Line[], slabs: readonly Slab[]): CloseResult {
  const end = monthEnd(month);
  const inMonth = lines.filter((l) => l.month === month && l.status !== 'REVERSED');
  const live = slabs.some((s) => s.effectiveFrom.getTime() <= end.getTime());
  const byPartner = new Map<string, Line[]>();
  for (const l of inMonth) byPartner.set(l.partnerId, [...(byPartner.get(l.partnerId) ?? []), l]);
  const approve: CloseResult['approve'] = [];
  const partners: CloseResult['partners'] = [];
  for (const [partnerId, ls] of [...byPartner.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const count = ls.length;
    const row = live ? slabFor(slabs, count, end) : null;
    for (const l of ls.slice().sort((a, b) => a.id.localeCompare(b.id))) if (row && l.status === 'ACCRUED') approve.push({ id: l.id, amountMinor: row.amountPerVendorMinor });
    partners.push({ partnerId, count, perVendorMinor: row?.amountPerVendorMinor ?? null, totalMinor: row ? row.amountPerVendorMinor * count : null });
  }
  return { month, noSlabs: !live, approve, partners };
}

/** What a payout for one partner and month would be: the sum of its APPROVED lines (PAID and REVERSED lines are not in it). */
export function payoutTotal(lines: readonly Line[], partnerId: string, month: string): { lineIds: string[]; totalMinor: number } {
  const ls = lines.filter((l) => l.partnerId === partnerId && l.month === month && l.status === 'APPROVED' && typeof l.amountMinor === 'number');
  return { lineIds: ls.map((l) => l.id), totalMinor: ls.reduce((n, l) => n + (l.amountMinor as number), 0) };
}

// ─────────────────────────────────────────────────────────────────────────────── the payout record
export function checkPayoutReference(ref: unknown): { ok: true; value: string } | { ok: false } {
  const v = typeof ref === 'string' ? ref.replace(/\s+/g, ' ').trim() : '';
  return v.length >= 3 && v.length <= 120 && !/[\u0000-\u001f\u007f]/.test(v) ? { ok: true, value: v } : { ok: false };
}

// ─────────────────────────────────────────────────────────────────────────────── CSV
/** One CSV cell: quoted when needed, and a leading = + - @ tab or return is defused with a quote, so a spreadsheet never runs a typed formula. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string { return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
/** paise as "1234.50" without a float */
export const rupeesText = (paise: number | null): string => (paise === null ? '' : `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`);
