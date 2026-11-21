/**
 * Pure rules of the customer list (slice 5.23a): where a customer came from, how one person is recognised, and what consent may change to. No clock, no database, no randomness.
 */
export const CUSTOMER_SOURCES = ['SEARCH', 'DIRECTORY', 'BOT', 'CAMPAIGN', 'PAYMENT', 'MANUAL'] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];
export const isCustomerSource = (s: unknown): s is CustomerSource => typeof s === 'string' && (CUSTOMER_SOURCES as readonly string[]).includes(s);

export const CONSENT_STATES = ['UNKNOWN', 'OPTED_IN', 'OPTED_OUT'] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];
export const isConsentState = (s: unknown): s is ConsentState => typeof s === 'string' && (CONSENT_STATES as readonly string[]).includes(s);

/**
 * The key that makes two captures the same person: digits only, with the Indian country code added to a ten digit number and a trunk zero dropped. Anything that cannot be a phone number gives null.
 * "98765 43210", "+91 98765-43210", "09876543210" and "919876543210" are all one person.
 */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let d = String(raw).replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 && !/^0/.test(d) ? d : null;
}

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export interface CustomerFields { name: string; phone: string | null; phoneKey: string | null; email: string | null; emailKey: string | null }
export type CheckResult = { ok: true; value: CustomerFields } | { ok: false; problems: string[] };

/** A person cannot be recognised without a phone or an e-mail, so one of them is required; a value that is given but cannot be read is a problem, never silently dropped. */
export function checkCustomerInput(i: { name?: unknown; phone?: unknown; email?: unknown }): CheckResult {
  const problems: string[] = [];
  const name = typeof i.name === 'string' ? i.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 120) problems.push('name: 1 to 120 characters');
  const hasPhone = i.phone !== undefined && i.phone !== null && String(i.phone).trim() !== '';
  const hasEmail = i.email !== undefined && i.email !== null && String(i.email).trim() !== '';
  const phoneKey = hasPhone ? normalisePhone(i.phone) : null;
  const emailKey = hasEmail ? normaliseEmail(i.email) : null;
  if (hasPhone && !phoneKey) problems.push('phone: not a phone number');
  if (hasEmail && !emailKey) problems.push('email: not an e-mail address');
  if (!hasPhone && !hasEmail) problems.push('phone or email: one of them is needed to recognise the customer');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { name, phone: hasPhone ? String(i.phone).trim().slice(0, 20) : null, phoneKey, email: emailKey, emailKey } };
}

/**
 * Consent only moves by an explicit act. A new customer is UNKNOWN; an opt-out is final until the customer themselves opt in again through a flow built for it (Release 2), so a vendor's request
 * can never turn OPTED_OUT back on.
 */
export function nextConsent(current: ConsentState, requested: ConsentState): ConsentState {
  if (current === 'OPTED_OUT') return 'OPTED_OUT';
  return requested;
}

/** Tags are short labels, unique ignoring case, at most 20. */
export function cleanTags(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const out: string[] = []; const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== 'string') return null;
    const v = t.trim().replace(/\s+/g, ' ');
    if (!v || v.length > 30) return null;
    if (!seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out;
}
