/**
 * Telecaller rules, pure (E6): checking the employee form, the daily cap, and the counts of the monitor. No clock, no database.
 */
export interface EmployeeInput { name?: unknown; email?: unknown; phone?: unknown }
export interface EmployeeClean { name: string; email: string; phone?: string }

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const plain = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export function checkEmployee(i: EmployeeInput): { ok: true; value: EmployeeClean } | { ok: false; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const name = plain(i?.name); const email = plain(i?.email).toLowerCase(); const phone = plain(i?.phone);
  if (name.length < 2 || name.length > 80 || /[<>]/.test(name)) problems.name = 'Enter the employee name (2 to 80 characters).';
  if (!EMAIL.test(email) || email.length > 254) problems.email = 'Enter a valid e-mail address.';
  if (phone && !/^\+?[0-9][0-9 ()-]{6,18}$/.test(phone)) problems.phone = 'Enter a phone number with digits only.';
  return Object.keys(problems).length ? { ok: false, problems } : { ok: true, value: { name, email, ...(phone ? { phone } : {}) } };
}

/** A cap of null means no cap is set (the owner has not chosen one). */
export const capReached = (createdToday: number, cap: number | null): boolean => cap !== null && cap >= 0 && createdToday >= cap;

export interface MonitorInput {
  created: number;
  /** businesses of this telecaller that have a commission line (their first plan payment was made) */
  paid: number;
  /** CASH orders made for their businesses that no admin has confirmed yet, with the age in days of the oldest */
  waiting: Array<{ ageDays: number }>;
  /** commission lines by state (amounts in paise; null while a slab is not set) */
  commission: Array<{ status: string; amountMinor: number | null }>;
}
export interface MonitorView {
  vendorsCreated: number; vendorsPaid: number; vendorsNotPaidYet: number; cashWaitingForOffice: number; oldestWaitingDays: number | null;
  commission: { accruedMinor: number; approvedMinor: number; paidMinor: number; reversedMinor: number; unpricedLines: number };
}

export function monitorView(i: MonitorInput): MonitorView {
  const sum = (s: string): number => i.commission.filter((c) => c.status === s).reduce((n, c) => n + (c.amountMinor ?? 0), 0);
  return {
    vendorsCreated: i.created, vendorsPaid: i.paid, vendorsNotPaidYet: Math.max(0, i.created - i.paid), cashWaitingForOffice: i.waiting.length,
    oldestWaitingDays: i.waiting.length ? Math.max(...i.waiting.map((w) => w.ageDays)) : null,
    commission: { accruedMinor: sum('ACCRUED'), approvedMinor: sum('APPROVED'), paidMinor: sum('PAID'), reversedMinor: sum('REVERSED'), unpricedLines: i.commission.filter((c) => c.amountMinor === null).length },
  };
}
