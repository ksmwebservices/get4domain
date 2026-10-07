/**
 * Secret-field redaction (security patch 2026-10-02).
 *
 * Prisma rows carry credential fields (bcrypt `password`, `inviteToken`, a vendor's encrypted
 * Razorpay secret…). Several endpoints returned whole rows — directly (team members, vendors) or
 * nested via `include: { vendor: true }` (invoices, subscriptions, support tickets) — leaking
 * password hashes and invite tokens to the browser. This util strips those keys; it is applied
 * (a) explicitly where a row is returned and (b) globally by TransformInterceptor, so a future
 * endpoint that forgets cannot leak them either.
 *
 * Deliberately NOT stripped: `token` (login/session responses legitimately return a JWT).
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwordHash',
  'inviteToken',
  'resetToken',
  'refreshToken',
  'razorpayKeySecret',
  'keySecret',
  // Commercial Engine v1: the pay-link token hash and the private proof-file reference never leave the API.
  'payTokenHash',
  'payToken',
  'screenshotUrl',
  'submittedByIpHash',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Deep copy of `value` with every sensitive key removed. Dates, Buffers and other class instances pass through untouched. */
export function redactSecrets<T>(value: T): T {
  return redact(value, new WeakSet()) as T;
}

function redact(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return value.map((v) => redact(v, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = redact(v, seen);
    }
    return out;
  }
  return value;
}
