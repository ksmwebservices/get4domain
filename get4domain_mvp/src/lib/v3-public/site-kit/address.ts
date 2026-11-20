import { originFor, vendorHost } from '../hostnames';

/**
 * The address rule: a vendor's public address is only <name>.<base domain> (or its active custom domain), never a /site/<name> path. The page renderer still lives at /site/<name>
 * inside the app, but a visitor's request for such a path on ANY host (the main host, another vendor's host, the vendor's own host) is answered with a 301 to the same page on the
 * vendor's host, or a 404 when there is no such vendor. Pure: the middleware does the one existence check.
 */
const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const SITE_PATH = /^\/site\/([^/]+)(\/.*)?$/i;

export type SiteAddress =
  | { kind: 'none' }
  /** the name is not a possible vendor name: answer 404 without asking anyone */
  | { kind: 'invalid' }
  /** ask whether the vendor exists: 404 if not, else 301 to `to` */
  | { kind: 'redirect'; name: string; to: string };

const isLoopback = (h: string): boolean => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) || h.endsWith('.localhost');

/** The path a /site/<name>/<rest> request has on the vendor's own host: the same page, '/' for the home page. */
export function ownPath(rest: string | undefined): string {
  const r = (rest ?? '').replace(/\/+$/, '');
  return r === '' || r === '/home' ? '/' : r;
}

export function siteAddress(o: { host: string | null | undefined; pathname: string; search?: string; vendorBase: string }): SiteAddress {
  const m = SITE_PATH.exec(o.pathname);
  if (!m) return { kind: 'none' };
  const h = String(o.host ?? '').toLowerCase().split(':')[0].replace(/\.$/, '');
  // a developer machine has no vendor hosts to go to: the path is served there as before
  if (isLoopback(h)) return { kind: 'none' };
  const name = m[1].toLowerCase();
  if (!NAME_RE.test(name)) return { kind: 'invalid' };
  return { kind: 'redirect', name, to: `${originFor(vendorHost(name, o.vendorBase))}${ownPath(m[2])}${o.search ?? ''}` };
}
