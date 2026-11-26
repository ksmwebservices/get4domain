/**
 * Telecaller rules, pure (E6): checking the employee form, the daily cap, and the counts of the monitor. No clock, no database.
 */
export interface EmployeeInput { name?: unknown; email?: unknown; phone?: unknown }

/** How a telecaller is paid (owner decision, 26 Nov 2026): an employee has a salary plus commission, a freelancer the commission slabs only. Amounts and tiers are entered by the owner. */
export const PAY_TYPES = ['SALARY_PLUS_COMMISSION', 'FREELANCE_SLAB'] as const;
export type PayType = (typeof PAY_TYPES)[number];
export const isPayType = (v: unknown): v is PayType => (PAY_TYPES as readonly unknown[]).includes(v);
/** The largest value the database column holds (paise). */
const SALARY_COLUMN_MAX = 2_147_483_647;
export interface PayClean { payType: PayType; monthlySalaryMinor: number | null }

export function checkPay(i: { payType?: unknown; monthlySalaryMinor?: unknown }): { ok: true; value: PayClean } | { ok: false; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const salary = i?.monthlySalaryMinor ?? null;
  if (!isPayType(i?.payType)) problems.payType = 'Choose salary plus commission, or commission slabs only (freelancer).';
  if (salary !== null && !(typeof salary === 'number' && Number.isInteger(salary) && salary >= 1 && salary <= SALARY_COLUMN_MAX)) problems.monthlySalaryMinor = 'Enter the monthly salary in paise as a whole number above zero, or leave it empty.';
  else if (salary !== null && i?.payType === 'FREELANCE_SLAB') problems.monthlySalaryMinor = 'A freelancer has no salary: leave it empty.';
  return Object.keys(problems).length ? { ok: false, problems } : { ok: true, value: { payType: i.payType as PayType, monthlySalaryMinor: salary as number | null } };
}

const DAY_MS = 86_400_000;
const IST_MS = 330 * 60_000;
/** The moment today began in India (the server clock runs in UTC, where the day changes at 05:30 in India). */
export function startOfIndiaDay(now: Date): Date { return new Date(Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS); }
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

export const capReached = (createdToday: number, cap: number): boolean => createdToday >= cap;

export interface MonitorInput {
  created: number;
  /** businesses of this telecaller that have a commission line (their first plan payment was made) */
  paid: number;
  /** CASH orders made for their businesses that no admin has confirmed yet, each with how long ago it was made */
  waiting: Array<{ ageMs: number }>;
  /** unconfirmed cash older than this many days is overdue (a setting) */
  overdueAfterDays: number;
  /** commission lines by state (amounts in paise; null while a slab is not set) */
  commission: Array<{ status: string; amountMinor: number | null }>;
}
export interface MonitorView {
  vendorsCreated: number; vendorsPaid: number; vendorsNotPaidYet: number; cashWaitingForOffice: number; oldestWaitingDays: number | null; cashOverdue: number; cashOverdueAfterDays: number;
  commission: { accruedMinor: number; approvedMinor: number; paidMinor: number; reversedMinor: number; unpricedLines: number };
}

export function monitorView(i: MonitorInput): MonitorView {
  const sum = (s: string): number => i.commission.filter((c) => c.status === s).reduce((n, c) => n + (c.amountMinor ?? 0), 0);
  return {
    vendorsCreated: i.created, vendorsPaid: i.paid, vendorsNotPaidYet: Math.max(0, i.created - i.paid), cashWaitingForOffice: i.waiting.length,
    oldestWaitingDays: i.waiting.length ? Math.floor(Math.max(...i.waiting.map((w) => w.ageMs)) / DAY_MS) : null,
    cashOverdue: i.waiting.filter((w) => w.ageMs > i.overdueAfterDays * DAY_MS).length, cashOverdueAfterDays: i.overdueAfterDays,
    commission: { accruedMinor: sum('ACCRUED'), approvedMinor: sum('APPROVED'), paidMinor: sum('PAID'), reversedMinor: sum('REVERSED'), unpricedLines: i.commission.filter((c) => c.amountMinor === null).length },
  };
}
