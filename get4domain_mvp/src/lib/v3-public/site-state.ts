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

/**
 * The API address the site renderer asks, chosen when the request runs (not when the app was built): INTERNAL_API_URL (the address that works from inside the container),
 * then API_BASE_URL, then NEXT_PUBLIC_API_URL (which is fixed at build time), then the public default. The same order the /go and /ls pages use.
 */
export const DEFAULT_PUBLIC_API = 'https://gapi.get4domain.com';
export function siteApiBase(env?: Record<string, string | undefined>): string {
  // static `process.env.NAME` reads (not process.env passed around), so a bundle that also runs in the browser still gets NEXT_PUBLIC_API_URL inlined; the other two are empty there
  const list = env ? [env.INTERNAL_API_URL, env.API_BASE_URL, env.NEXT_PUBLIC_API_URL] : [process.env.INTERNAL_API_URL, process.env.API_BASE_URL, process.env.NEXT_PUBLIC_API_URL];
  for (const v of list) {
    const t = String(v ?? '').trim().replace(/\/+$/, '');
    if (/^https?:\/\/[^\s]+$/i.test(t)) return t;
  }
  return DEFAULT_PUBLIC_API;
}

/** Why a vendor address ended in a not-found page. Short codes only, so a log line never carries a person's data. */
export type VendorNotFoundReason =
  | 'HOST_NOT_PARSED' | 'HOST_BASE_MISMATCH' | 'API_NOT_FOUND' | 'API_UNREACHABLE' | 'FREE_RENDER_FAILED' | 'NO_DESIGN' | 'INNER_PAGE_NOT_FOUND';

/** One structured log line for a vendor host that ends in a not-found page: the subdomain (a public address) and the reason code, nothing else. */
export function vendorNotFoundLine(subdomain: string, reason: VendorNotFoundReason): string {
  const sub = /^[a-z0-9-]{1,63}$/.test(subdomain) ? subdomain : 'invalid';
  return JSON.stringify({ evt: 'vendor_not_found', subdomain: sub, reason });
}
export function logVendorNotFound(subdomain: string, reason: VendorNotFoundReason): void {
  console.warn(vendorNotFoundLine(subdomain, reason));
}

/**
 * Why the vendor-host rewrite left a host alone (the middleware then answers a plain 404): the host is not under the site base domain (HOST_BASE_MISMATCH: MAIN_HOST and
 * NEXT_PUBLIC_SITE_BASE_DOMAIN disagree), or the label before it is not a usable subdomain, or the path is one the rewrite never takes (HOST_NOT_PARSED). null when it would be rewritten.
 */
export function vendorHostReason(host: string, siteBase: string, reserved: ReadonlySet<string>, pathname: string): { subdomain: string; reason: VendorNotFoundReason } | null {
  const h = String(host ?? '').toLowerCase().split(':')[0];
  if (!h.endsWith(`.${siteBase}`)) return { subdomain: h.split('.')[0] ?? '', reason: 'HOST_BASE_MISMATCH' };
  const sub = h.slice(0, -(siteBase.length + 1));
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) || reserved.has(sub) || /^\/(site\/|_next|api|uploads)/.test(pathname)) return { subdomain: sub, reason: 'HOST_NOT_PARSED' };
  return null;
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
  // only http(s) pictures and the platform's own root-relative pictures (/starter/...) are kept; never a protocol-relative or script address
  const img = (v: string | null | undefined): string | null => (typeof v === 'string' && (/^https?:\/\//i.test(v) || /^\/(?!\/)[A-Za-z0-9._\-/]+$/.test(v)) ? v : null);
  const list = Array.isArray(site.products) ? site.products : [];
  return {
    name: t(c?.businessName) ?? t(site.vendor?.businessName) ?? 'This business',
    tagline: t(c?.tagline), about: t(c?.about), address: t(c?.address), phone: t(c?.phone), logo: img(c?.logo), banner: img(c?.banner),
    items: list.filter((p) => p && typeof p.name === 'string' && p.name.trim()).slice(0, 24).map((p) => ({ name: p.name.trim(), price: t(p.price), description: t(p.description), image: img(p.image) })),
  };
}
