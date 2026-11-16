import { cleanText } from '../../v3-pack-records/core/record-core';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor, StaffRole, STAFF_ROLE_EXTENSIONS } from '../../auth/guards/admin-role-matrix';
import { SEEDED_OWNER_PLACEHOLDER } from '../../provisioning/steps/business-input';

/** Pure rules of the Wave 2 Part C admin routes. No clock, randomness or database. */

// ── C1: the permission matrix served to the admin app ────────────────────────────────────────────────────────────────────────────────────────────
export const STAFF_ROLE_ORDER: readonly StaffRole[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING'];

/**
 * Every route the matrix knows and the staff roles that may call it, EFFECTIVE (the base table plus the ADMIN and SUPPORT extensions, exactly what AdminGuard asks). A route that is not listed is SUPER_ADMIN only
 * (deny by default), which is what `fallback` says, so the admin app never has to guess. The data is read from the live matrix: nothing here is a second copy.
 */
export function permissionMatrix(): { roles: readonly StaffRole[]; fallback: readonly StaffRole[]; routes: Record<string, StaffRole[]> } {
  const keys = new Set<string>([...Object.keys(ADMIN_ROLE_MATRIX), ...STAFF_ROLE_EXTENSIONS.ADMIN.allow, ...STAFF_ROLE_EXTENSIONS.SUPPORT.allow]);
  const routes: Record<string, StaffRole[]> = {};
  for (const k of [...keys].sort()) routes[k] = [...effectiveRolesFor(k)].sort((a, b) => STAFF_ROLE_ORDER.indexOf(a) - STAFF_ROLE_ORDER.indexOf(b));
  return { roles: STAFF_ROLE_ORDER, fallback: ['SUPER_ADMIN'], routes };
}

// ── C3: the vendors list filters ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const VENDOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING'] as const;
export const LISTING_STATES = ['UNCLAIMED_LISTING', 'DRAFT_SITE', 'CLAIMED', 'LIVE', 'REMOVED'] as const;
export type ListingStateWord = (typeof LISTING_STATES)[number];
export const isListingState = (v: unknown): v is ListingStateWord => typeof v === 'string' && (LISTING_STATES as readonly string[]).includes(v);

export interface VendorListQuery { q?: unknown; plan?: unknown; status?: unknown; industry?: unknown; listingState?: unknown; page?: unknown; pageSize?: unknown }
export interface VendorFilter { q: string; planLevel: 'FREE' | 'PRO' | null; planKey: string | null; status: string | null; industry: string | null; listingState: ListingStateWord | null; skip: number; take: number; page: number; pageSize: number }

/** What the seeded lifecycle and the "site is published" fact mean for the listing-state filter, as the stored values (the staff views write the derived value through, so the stored lifecycle follows the facts). */
export function listingStateWhere(state: ListingStateWord): { lifecycle: string[]; published: boolean | null } {
  switch (state) {
    case 'REMOVED': return { lifecycle: ['REMOVED'], published: null };
    case 'LIVE': return { lifecycle: ['PRO'], published: null };
    case 'CLAIMED': return { lifecycle: ['CLAIMED_FREE'], published: false };
    case 'UNCLAIMED_LISTING': return { lifecycle: ['SEEDED', 'INVITED'], published: true };
    case 'DRAFT_SITE': return { lifecycle: ['SEEDED', 'INVITED'], published: false };
  }
}

export function checkVendorFilter(q: VendorListQuery, allowedStatuses: readonly string[] = VENDOR_STATUSES): { ok: true; value: VendorFilter } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const word = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const plan = word(q.plan, 60); const status = word(q.status, 20).toUpperCase(); const industry = word(q.industry, 60); const listing = word(q.listingState, 30).toUpperCase();
  if (status && !allowedStatuses.includes(status)) errors.status = 'Pick a status from the list.';
  if (listing && !isListingState(listing)) errors.listingState = 'Pick a listing state from the list.';
  if (plan && !/^[A-Za-z0-9_]{1,60}$/.test(plan)) errors.plan = 'Pick a plan from the list.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const page = Math.max(1, Math.floor(Number(q.page)) || 1); const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize)) || 25));
  const level = plan.toUpperCase() === 'FREE' ? 'FREE' : plan.toUpperCase() === 'PRO' ? 'PRO' : null;
  return { ok: true, value: { q: word(q.q, 80), planLevel: level, planKey: plan && !level ? plan.toLowerCase() : null, status: status || null, industry: industry || null, listingState: (listing as ListingStateWord) || null, skip: (page - 1) * pageSize, take: pageSize, page, pageSize } };
}

// ── C5: staff notes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The vendor's OWN name for a row of the vendors list (Wave 2 job K4): the person on the account, kept apart from the business name. Null when no person's name is on record: it is empty, it is the
 * placeholder a seeded listing's login carries until its owner is known, or it is only a copy of the business name (nothing then tells the person from the business). The business name is always
 * sent as its own field, so a screen shows both and never has to guess which one `name` is.
 */
export function ownNameOf(name: unknown, businessName: unknown): string | null {
  const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (!n) return null;
  const key = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
  if (key(n) === key(SEEDED_OWNER_PLACEHOLDER)) return null;
  if (typeof businessName === 'string' && key(businessName) === key(n)) return null;
  return n;
}

export const NOTE_MAX = 2000;
export function checkNote(body: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const c = cleanText(body, NOTE_MAX, true);
  if (!c.ok) return { ok: false, error: c.error };
  if (c.value.length === 0) return { ok: false, error: 'Write the note.' };
  return { ok: true, value: c.value };
}

// ── C6: offline settle details ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface OfflineInput { reference?: unknown; receivedOn?: unknown; amountPaise?: unknown }
export interface OfflineDetails { reference: string | null; receivedOn: string | null; amountPaise: number | null }
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The reference, the day the money came and the amount that came, as staff typed them. All optional (a reason alone still works); a day must be a real day that is not in the future; an amount a whole number of paise. */
export function checkOffline(i: OfflineInput, today: string): { ok: true; value: OfflineDetails } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}; let reference: string | null = null; let receivedOn: string | null = null; let amountPaise: number | null = null;
  if (i.reference !== undefined && i.reference !== null && i.reference !== '') { const c = cleanText(i.reference, 80, false); if (!c.ok || c.value.length < 2) errors.reference = c.ok ? 'Enter the reference.' : c.error; else reference = c.value; }
  if (i.receivedOn !== undefined && i.receivedOn !== null && i.receivedOn !== '') {
    const d = typeof i.receivedOn === 'string' && DAY.test(i.receivedOn) ? new Date(`${i.receivedOn}T00:00:00.000Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== i.receivedOn) errors.receivedOn = 'Enter the day as YYYY-MM-DD.'; else if (i.receivedOn > today) errors.receivedOn = 'The day cannot be in the future.'; else receivedOn = i.receivedOn;
  }
  if (i.amountPaise !== undefined && i.amountPaise !== null && i.amountPaise !== '') {
    if (typeof i.amountPaise !== 'number' || !Number.isInteger(i.amountPaise) || i.amountPaise < 0 || i.amountPaise > 1_000_000_000_000) errors.amountPaise = 'Enter the amount as a whole number of paise.'; else amountPaise = i.amountPaise;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { reference, receivedOn, amountPaise } };
}

// ── C7: invoice list status ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const INVOICE_STATUSES = ['PAID', 'REFUND_RECORDED'] as const;
export type InvoiceStatusWord = (typeof INVOICE_STATUSES)[number];
/** A plan invoice exists only for a paid order, so its status is what has since been recorded as given back: nothing is PAID, anything at all is REFUND_RECORDED (the amount rides on the row). */
export function invoiceStatusOf(refundedPaise: number | null): InvoiceStatusWord { return refundedPaise !== null && refundedPaise > 0 ? 'REFUND_RECORDED' : 'PAID'; }
