import type { AuthUser } from './auth';

/**
 * The ONE way any dashboard "View / Visit / Preview my website" control resolves where
 * to go. Two cases, handled differently so neither ever hits the OTP redirect loop:
 *
 *  • REAL vendor (registered subdomain, not a demo session) → straight to their OWN live
 *    public site (https://<subdomain>.get4domain.com). NEVER /demo, NEVER the OTP gate.
 *  • DEMO / sandbox session (already OTP-verified when the tour started) → mint the demo
 *    pass silently via /api/demo/tour-pass and open the gated demo — no second OTP.
 *
 * The cold/anonymous demo gate is untouched: tour-pass only mints for a token the backend
 * confirms is a sandbox vendor. A demo session is detected by the tour context / plan, and
 * even a misdetection is safe — tour-pass 403s a real vendor, and we fall back to their site.
 */
type VendorLike = Pick<AuthUser, 'subdomain' | 'industry' | 'plan'>;

export function isDemoSession(user: VendorLike | null): boolean {
  if (typeof window !== 'undefined' && localStorage.getItem('g4d_tour')) return true;
  return user?.plan === 'Demo Sandbox' || !user?.subdomain;
}

/** Absolute public URL for a real vendor's own site. */
export function liveSiteUrl(subdomain: string): string {
  return `https://${subdomain}.get4domain.com`;
}

export async function openMyWebsite(user: VendorLike | null): Promise<void> {
  if (typeof window === 'undefined' || !user) return;
  const sub = user.subdomain;

  // Real registered vendor → their own live site, directly.
  if (sub && !isDemoSession(user)) {
    window.open(liveSiteUrl(sub), '_blank', 'noopener');
    return;
  }

  // Demo / sandbox session → silent pass mint, then the gated demo.
  const token = localStorage.getItem('g4d_token');
  if (token) {
    try {
      const res = await fetch('/api/demo/tour-pass', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string };
      if (res.ok && j?.redirect) { window.location.href = j.redirect; return; }
    } catch { /* fall through */ }
  }

  // Fallbacks: a real subdomain if we have one, else the normal OTP gate (never worse).
  if (sub) { window.open(liveSiteUrl(sub), '_blank', 'noopener'); return; }
  window.location.href = `/visit-demo?to=${encodeURIComponent(`/demo/${user.industry ?? 'general'}`)}`;
}
