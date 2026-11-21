import { isV3PublicEnabled } from './flag';

/**
 * Viewing a vendor's public site on a developer machine: http://localhost:<port>/_vendor/{subdomain}[/path].
 *
 * In production a vendor site is reached by its own host name (<vendor>.<main domain>), which the middleware sends through the relay (`/vendor-site`). A developer has no wildcard
 * DNS, so this switch lets the same relay answer for a host built from the address instead. It is a viewing aid and nothing else:
 *   - it needs V3_PUBLIC_ENABLED=true AND its own name V3_PUBLIC_DEV_VENDOR_VIEW=true;
 *   - it is never on in a production build (the check reads NODE_ENV, which the bundler fixes at build time), whatever the environment says;
 *   - the relay is the same code path as production (by-host fetch, mock layer in mock mode, the smoke API in real mode); only the host name comes from the address.
 * With the flag off or in a production build the address is an ordinary unknown path (404) and nothing here runs.
 */
export const DEV_VENDOR_PREFIX = '/_vendor';
/** Set by the middleware on the rewritten request; the relay reads it only while the switch is on. */
export const DEV_VENDOR_HEADER = 'x-v3-dev-vendor-host';

type Env = Record<string, string | undefined>;

/** True in a production build. Written as a literal `process.env.NODE_ENV` so the bundler replaces it at build time. */
export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** On only when the flag is on, this build is not a production build, and V3_PUBLIC_DEV_VENDOR_VIEW is exactly "true". */
export function devVendorViewEnabled(env: Env = process.env, productionBuild: boolean = isProductionBuild()): boolean {
  return !productionBuild && isV3PublicEnabled(env) && (env.V3_PUBLIC_DEV_VENDOR_VIEW ?? '').trim().toLowerCase() === 'true';
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** `/_vendor/sample-pro/about` gives `{ label: 'sample-pro', rest: '/about' }`; `/_vendor/sample-pro` gives rest `/`. Null for anything else, including a bad label. */
export function parseDevVendorPath(pathname: string): { label: string; rest: string } | null {
  if (pathname !== DEV_VENDOR_PREFIX && !pathname.startsWith(`${DEV_VENDOR_PREFIX}/`)) return null;
  const parts = pathname.slice(DEV_VENDOR_PREFIX.length).split('/').filter((x, i) => i > 0 || x !== '');
  const label = (parts[0] ?? '').toLowerCase();
  if (!LABEL.test(label)) return null;
  const rest = parts.slice(1).join('/');
  return { label, rest: rest ? `/${rest}` : '/' };
}

/** The host the relay is asked about: the vendor label under the main domain when one is set, otherwise under `localhost`. */
export function devVendorHost(label: string, mainDomain: string | null): string {
  return `${label}.${mainDomain || 'localhost'}`;
}

/**
 * Makes the root-relative links of a stored page work under the dev address: href="/about" becomes href="/_vendor/sample-pro/about". Applied to the dev view only, never to what
 * production serves. Protocol-relative (`//`) and absolute addresses are left alone.
 */
export function prefixRootLinks(html: string, label: string): string {
  const prefix = `${DEV_VENDOR_PREFIX}/${label}`;
  return html.replace(/(\s(?:href|src|action)=)(["'])\/(?!\/)/g, (_m, attr: string, q: string) => `${attr}${q}${prefix}/`);
}

/**
 * A redirect the backend gives to another vendor host under the same main domain becomes an address under the dev prefix, so that following it stays on this machine.
 * Any other Location is returned unchanged.
 */
export function devRedirectLocation(location: string, devHost: string): string {
  try {
    const u = new URL(location);
    const base = devHost.split('.').slice(1).join('.');
    const label = u.hostname.split('.')[0];
    if (base && u.hostname.endsWith(`.${base}`) && u.hostname === `${label}.${base}` && LABEL.test(label)) return `${DEV_VENDOR_PREFIX}/${label}${u.pathname === '/' ? '/' : u.pathname}${u.search}`;
  } catch {
    // not an absolute address: leave it
  }
  return location;
}
