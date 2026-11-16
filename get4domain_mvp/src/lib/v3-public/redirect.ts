/**
 * The only addresses the public site follows after a claim approval (same rules as the vendor app):
 * a relative path that starts with one "/", or an absolute https address. Never a script, a data address, plain http, or "//host" (which a browser reads as another site).
 * Anything else is dropped and the screen shows its normal link instead.
 */
const CONTROL_OR_SPACE = /[\u0000- \u007f-\u009f\\]/;

export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  if (CONTROL_OR_SPACE.test(value)) return null;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  let u: URL;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
  return u.toString();
}
