/** The real vendor/site payload — the SAME shape/endpoint every other live get4domain
 *  vendor site already reads (GET /cms/site/:subdomain). No new backend logic. */
export interface LiveSiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null;
  } | null;
  products: {
    id: string; name: string; description: string | null; price: string | null;
    image: string | null; category: string | null; customFields: Record<string, unknown> | null;
  }[];
  paymentsEnabled?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
export const DEEBIPHOTOGRAPHY_SUBDOMAIN = 'deebiphotography';
export const DEEBIPHOTOGRAPHY_VENDOR_ID = 'cmuoz6uef0028nt0130k974bx';

/** Fetches the real Deebi Wedding Stories vendor/site record. Works from both a
 *  server component (revalidated periodically) and the browser (no-store). Never
 *  throws — a network hiccup returns null so callers fall back gracefully instead
 *  of breaking the page. */
export async function fetchSiteData(): Promise<LiveSiteData | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/site/${DEEBIPHOTOGRAPHY_SUBDOMAIN}`, {
      next: typeof window === 'undefined' ? { revalidate: 60 } : undefined,
      cache: typeof window === 'undefined' ? undefined : 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as LiveSiteData;
  } catch {
    return null;
  }
}

/** Submits a real enquiry into the vendor's CRM call list via the universal
 *  engine.enquiry action (POST /engine/public/:subdomain/actions/engine.enquiry).
 *  Public, no auth. Never throws — the caller's own WhatsApp-deeplink flow is the
 *  primary UX and must keep working even if this call fails. */
export async function submitEnquiry(input: { name: string; phone: string; message?: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/engine/public/${DEEBIPHOTOGRAPHY_SUBDOMAIN}/actions/engine.enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, industry: 'photography' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
