/**
 * The hostnames of the one-domain layout. Pure (no framework import) so it can be tested without Next.
 *   main        marketing site; `www.` of it is the same site but never canonical
 *   directory   the public directory
 *   vendor-site <label>.<main domain>, any label that is not reserved
 *   reserved    app, admin, api, media hosts and every reserved label: never handled by this app
 *   unknown     anything else, or any host while MAIN_HOST is not set
 * Host names come from the environment only. There is no default that looks like production: an unset name means that host class is not configured.
 */
type Env = Record<string, string | undefined>;

export interface HostConfig {
  main: string | null;
  directory: string | null;
  app: string | null;
  admin: string | null;
  api: string | null;
  media: string | null;
}

/** Labels a vendor can never take (owner decision, 17 Nov 2026), then every existing V2 client name. */
export const RESERVED_PLATFORM_NAMES: readonly string[] = ['www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'mail', 'send'];
export const RESERVED_V2_CLIENT_NAMES: readonly string[] = [
  'allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels',
];
export const RESERVED_NAMES: ReadonlySet<string> = new Set([...RESERVED_PLATFORM_NAMES, ...RESERVED_V2_CLIENT_NAMES]);

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lower case, no port, no trailing dot. Returns '' for a value that cannot be a host name. */
export function normalizeHost(value: string | null | undefined): string {
  const h = String(value ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!h || h.length > 253 || /[\s/\\@?#]/.test(h)) return '';
  return h.split('.').every((l) => LABEL.test(l)) ? h : '';
}

const fromEnv = (v: string | undefined): string | null => normalizeHost(v) || null;

/** The six host names from the environment, read at call time (so staging can change them without a rebuild). */
export function readHostConfig(env: Env = process.env): HostConfig {
  return {
    main: fromEnv(env.MAIN_HOST), directory: fromEnv(env.DIRECTORY_HOST), app: fromEnv(env.APP_HOST),
    admin: fromEnv(env.ADMIN_HOST), api: fromEnv(env.API_HOST), media: fromEnv(env.MEDIA_HOST),
  };
}

/** The main host without a leading `www.`: the base every vendor host hangs from. */
export function baseDomain(cfg: HostConfig): string | null {
  return cfg.main ? cfg.main.replace(/^www\./, '') : null;
}

export type ReservedRole = 'app' | 'admin' | 'api' | 'media' | 'name';

export type HostClass =
  | { kind: 'main'; canonical: boolean }
  | { kind: 'directory' }
  | { kind: 'vendor-site'; label: string }
  | { kind: 'reserved'; role: ReservedRole }
  | { kind: 'unknown' };

export function isReservedName(label: string): boolean {
  return RESERVED_NAMES.has(String(label ?? '').trim().toLowerCase());
}

/** A label a vendor could take: a valid single label that is not reserved. */
export function isVendorLabel(label: string): boolean {
  const l = String(label ?? '').trim().toLowerCase();
  return LABEL.test(l) && !RESERVED_NAMES.has(l);
}

/** Classify the Host header of a request. */
export function classifyHost(host: string | null | undefined, cfg: HostConfig = readHostConfig()): HostClass {
  const h = normalizeHost(host);
  const base = baseDomain(cfg);
  if (!h || !base) return { kind: 'unknown' };
  if (h === base) return { kind: 'main', canonical: true };
  if (h === `www.${base}`) return { kind: 'main', canonical: false };
  if (cfg.directory && h === cfg.directory) return { kind: 'directory' };
  if (cfg.app && h === cfg.app) return { kind: 'reserved', role: 'app' };
  if (cfg.admin && h === cfg.admin) return { kind: 'reserved', role: 'admin' };
  if (cfg.api && h === cfg.api) return { kind: 'reserved', role: 'api' };
  if (cfg.media && h === cfg.media) return { kind: 'reserved', role: 'media' };
  if (!h.endsWith(`.${base}`)) return { kind: 'unknown' };
  const label = h.slice(0, -(base.length + 1));
  if (label.includes('.')) return { kind: 'unknown' }; // single-level subdomains only
  if (RESERVED_NAMES.has(label)) return { kind: 'reserved', role: 'name' };
  return { kind: 'vendor-site', label };
}

/**
 * The origin to put in a redirect or a sitemap line for a configured host: always https, except for localhost (development).
 * The request's own scheme is not used: behind the proxy chain it can read http for a visitor who came over https.
 */
export function originFor(host: string): string {
  const h = normalizeHost(host);
  return `${h === 'localhost' || h.endsWith('.localhost') ? 'http' : 'https'}://${h}`;
}
