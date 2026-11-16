/**
 * Referral partners (Wave 3 Part A). PURE: no database, no clock, no environment.
 * A partner is a source of referred businesses. Its login is an admin-team member whose role is REFERRAL_PARTNER; that principal is not staff and may only use /v3/partner/*.
 */
export const PARTNER_TYPES = ['FREELANCER', 'SALES_TEAM', 'ADMIN_TEAM'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];
export const PARTNER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface PartnerInput { type?: unknown; name?: unknown; email?: unknown; phone?: unknown; status?: unknown; staffUserId?: unknown }
export interface PartnerFields { type: PartnerType; name: string; email: string; phone: string | null; status: PartnerStatus; staffUserId: string | null }
export type PartnerCheck = { ok: true; value: Partial<PartnerFields> } | { ok: false; problems: Record<string, string> };

const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}\.[^\s@<>"]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;

/** One email form for storage and for matching: trimmed and lower case. */
export const normaliseEmail = (e: string): string => e.trim().toLowerCase();
/** The digits of a phone number, with an Indian country prefix removed, for matching (a self-referral check compares these). Empty when there are no digits. */
export function phoneDigits(p: string | null | undefined): string {
  const d = String(p ?? '').replace(/\D+/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d;
}

/** Checks a create (every required field present) or an edit (only the fields sent). Returns only the fields that were sent, cleaned. */
export function checkPartnerInput(input: PartnerInput, mode: 'create' | 'edit'): PartnerCheck {
  const problems: Record<string, string> = {};
  const value: Partial<PartnerFields> = {};
  const has = (k: keyof PartnerInput): boolean => input[k] !== undefined;

  if (has('type')) { if (typeof input.type === 'string' && (PARTNER_TYPES as readonly string[]).includes(input.type)) value.type = input.type as PartnerType; else problems.type = `must be one of ${PARTNER_TYPES.join(', ')}`; }
  else if (mode === 'create') problems.type = 'is required';

  if (has('name')) { const n = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim() : ''; if (n.length >= 1 && n.length <= 120) value.name = n; else problems.name = 'must be 1 to 120 characters'; }
  else if (mode === 'create') problems.name = 'is required';

  if (has('email')) { const e = typeof input.email === 'string' ? normaliseEmail(input.email) : ''; if (EMAIL_RE.test(e)) value.email = e; else problems.email = 'must be an email address'; }
  else if (mode === 'create') problems.email = 'is required';

  if (has('phone')) {
    if (input.phone === null || input.phone === '') value.phone = null;
    else if (typeof input.phone === 'string' && PHONE_RE.test(input.phone.trim())) value.phone = input.phone.trim();
    else problems.phone = 'must be a phone number or empty';
  }

  if (has('status')) { if (typeof input.status === 'string' && (PARTNER_STATUSES as readonly string[]).includes(input.status)) value.status = input.status as PartnerStatus; else problems.status = `must be one of ${PARTNER_STATUSES.join(', ')}`; }

  if (has('staffUserId')) {
    if (input.staffUserId === null || input.staffUserId === '') value.staffUserId = null;
    else if (typeof input.staffUserId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(input.staffUserId)) value.staffUserId = input.staffUserId;
    else problems.staffUserId = 'must be the id of an admin-team member or empty';
  }

  return Object.keys(problems).length ? { ok: false, problems } : { ok: true, value };
}

/** The routes a partner principal may call besides its own: who am I, and renew my token. Nothing else outside /v3/partner/. */
export const PARTNER_EXTRA_PATHS: readonly string[] = ['/auth/me', '/auth/refresh'];

export function isPartnerPath(path: string): boolean {
  const p = path.split('?')[0].replace(/\/+$/, '');
  return p === '/v3/partner' || p.startsWith('/v3/partner/');
}

/** Is a request path one a referral-partner principal may reach? Partner routes and the two token routes; everything else is refused. */
export function partnerMayReach(path: string): boolean {
  const p = path.split('?')[0].replace(/\/+$/, '');
  return isPartnerPath(p) || PARTNER_EXTRA_PATHS.includes(p);
}
