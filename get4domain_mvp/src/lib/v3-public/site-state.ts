/**
 * The state of a vendor site address, for the public renderer (GET /cms/site-state/:subdomain -> { exists, status } with status LIVE, DRAFT or NOT_FOUND),
 * and the Free-plan rule of the renderer. Pure apart from the one fetch; no framework import.
 */
export type SiteStatus = 'LIVE' | 'DRAFT' | 'NOT_FOUND';
export interface SiteState { exists: boolean; status: SiteStatus }

const STATUSES: readonly string[] = ['LIVE', 'DRAFT', 'NOT_FOUND'];

/** The answer of the route (plain or wrapped in { data }) to a state, or null when it is not that shape. NOT_FOUND never exists, whatever `exists` says. */
export function siteStateOf(json: unknown): SiteState | null {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  if (!root) return null;
  const o = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const status = typeof o.status === 'string' ? o.status.toUpperCase() : '';
  if (typeof o.exists !== 'boolean' || !STATUSES.includes(status)) return null;
  return { exists: o.exists && status !== 'NOT_FOUND', status: status as SiteStatus };
}

/** Asks the API whether this address belongs to a site. null when the API cannot answer (the caller then keeps its plain not-found). */
export async function fetchSiteState(apiBase: string, subdomain: string): Promise<SiteState | null> {
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain)) return null;
  try {
    const res = await fetch(`${apiBase}/cms/site-state/${encodeURIComponent(subdomain)}`, { cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return siteStateOf(await res.json());
  } catch {
    return null;
  }
}

/**
 * Is this a Free-plan site? The renderer's data says so with `plan` ('FREE', or an object whose kind, tier or key is FREE) or `isFree: true`.
 * Anything that does not say Free is treated as not Free: the backend has to send the plan (see the P8 report).
 */
export function isFreeSite(site: unknown): boolean {
  const s = site && typeof site === 'object' ? (site as Record<string, unknown>) : {};
  if (s.isFree === true) return true;
  const p = s.plan;
  const o = p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  const word = typeof p === 'string' ? p : o ? String(o.kind ?? o.tier ?? o.key ?? '') : '';
  return word.trim().toUpperCase() === 'FREE';
}

/** What a Free site shows: text and pictures only. No e-mail, no WhatsApp, no link, no form; the phone number is plain text. */
export interface FreeItem { name: string; price: string | null; description: string | null; image: string | null }
export interface FreeView { name: string; tagline: string | null; about: string | null; address: string | null; phone: string | null; logo: string | null; banner: string | null; items: FreeItem[] }

interface FreeSource {
  vendor: { businessName: string };
  cms: { businessName: string | null; tagline: string | null; about: string | null; address: string | null; phone: string | null; logo: string | null; banner: string | null } | null;
  products: Array<{ name: string; price: string | null; description: string | null; image: string | null }>;
}

export function freeViewOf(site: FreeSource): FreeView {
  const c = site.cms;
  const t = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  // only http(s) pictures are kept
  const img = (v: string | null | undefined): string | null => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
  return {
    name: t(c?.businessName) ?? site.vendor.businessName,
    tagline: t(c?.tagline), about: t(c?.about), address: t(c?.address), phone: t(c?.phone), logo: img(c?.logo), banner: img(c?.banner),
    items: site.products.slice(0, 24).map((p) => ({ name: p.name, price: t(p.price), description: t(p.description), image: img(p.image) })),
  };
}
