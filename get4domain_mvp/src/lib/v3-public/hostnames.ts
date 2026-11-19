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
  /** The domain every vendor address hangs from (<name>.<vendorBase>), from NEXT_PUBLIC_SITE_BASE_DOMAIN. It is NOT the portal main host: the portal hosts (v3site, v3app, ...) are just names under it. When absent, vendor hosts hang from the main host as before. */
  vendorBase?: string | null;
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
/** The backend's own lists (read only, site-domains/settings): MANDATORY_RESERVED_SUBDOMAINS adds `partner`; DEFAULT_DOMAIN_SETTINGS.reservedSubdomains is the editable default. The union of all of them is reserved here. */
export const RESERVED_BACKEND_NAMES: readonly string[] = [
  'partner',
  'administrator', 'apps', 'email', 'smtp', 'imap', 'pop', 'ftp', 'sftp', 'ns', 'ns1', 'ns2', 'dns', 'cdn', 'static', 'assets', 'img', 'images',
  'login', 'signin', 'signup', 'register', 'auth', 'account', 'accounts', 'dashboard', 'console', 'portal', 'billing', 'pay', 'payment', 'payments', 'checkout', 'secure', 'security',
  'support', 'help', 'status', 'docs', 'blog', 'news', 'staging', 'stage', 'dev', 'test', 'demo', 'preview', 'beta', 'root', 'localhost', 'webmail', 'cpanel', 'whm', 'autodiscover',
  'get4domain', 'g4d', 'search', 'sitemap', 'robots',
];
export const RESERVED_NAMES: ReadonlySet<string> = new Set([...RESERVED_PLATFORM_NAMES, ...RESERVED_BACKEND_NAMES, ...RESERVED_V2_CLIENT_NAMES]);

/** Names that start like the platform's own test and portal hosts (v3site, v3app, v3directory, t3-...) are never vendors. */
const RESERVED_PREFIX = /^(v3|t3-)/;
export function isReservedLabel(label: string): boolean {
  const l = String(label ?? '').trim().toLowerCase();
  return RESERVED_NAMES.has(l) || RESERVED_PREFIX.test(l);
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lower case, no port, no trailing dot. Returns '' for a value that cannot be a host name. */
export function normalizeHost(value: string | null | undefined): string {
  const h = String(value ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!h || h.length > 253 || /[\s/\\@?#]/.test(h)) return '';
  return h.split('.').every((l) => LABEL.test(l)) ? h : '';
}

const fromEnv = (v: string | undefined): string | null => normalizeHost(v) || null;

/** The six host names from the environment, read at call time (so staging can change them without a rebuild). */
export function readHostConfig(envIn?: Env): HostConfig {
  const env: Env = envIn ?? process.env;
  const vendorBase = explicitSiteBase(envIn);
  return {
    ...(vendorBase ? { vendorBase } : {}),
    main: fromEnv(env.MAIN_HOST), directory: fromEnv(env.DIRECTORY_HOST), app: fromEnv(env.APP_HOST),
    admin: fromEnv(env.ADMIN_HOST), api: fromEnv(env.API_HOST), media: fromEnv(env.MEDIA_HOST),
  };
}

/** The main host without a leading `www.`: the base every vendor host hangs from. */
export function baseDomain(cfg: HostConfig): string | null {
  return cfg.main ? cfg.main.replace(/^www\./, '') : null;
}

/** The domain every vendor address hangs from (NEXT_PUBLIC_SITE_BASE_DOMAIN, the same setting the vendor sites and the middleware use): `<name>.<this>`. Never the main host and never an internal label. */
export const DEFAULT_SITE_BASE_DOMAIN = 'get4domain.com';
/** The vendor base domain as set (NEXT_PUBLIC_SITE_BASE_DOMAIN), or null when it is not set or not a domain. With no argument it reads the static `process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN`, which the build inlines (also in the edge middleware bundle), then the runtime value. */
export function explicitSiteBase(env?: Env): string | null {
  const value = env ? env.NEXT_PUBLIC_SITE_BASE_DOMAIN : (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN ?? (process.env as Env)['NEXT_PUBLIC_SITE_BASE_DOMAIN']);
  const raw = String(value ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\.+/, '');
  return (/^[a-z0-9.-]+$/.test(raw) && raw.includes('.')) || raw === 'localhost' ? raw : null;
}
export function siteBaseDomain(env?: Env): string {
  return explicitSiteBase(env) ?? DEFAULT_SITE_BASE_DOMAIN;
}

/** The address a vendor site will have for a typed name: `<name>.<base>`; the name alone is never shown as an address. */
export function vendorHost(name: string, base: string = siteBaseDomain()): string {
  return `${String(name ?? '').trim().toLowerCase()}.${base}`;
}

export type ReservedRole = 'app' | 'admin' | 'api' | 'media' | 'name';

export type HostClass =
  | { kind: 'main'; canonical: boolean }
  | { kind: 'directory' }
  | { kind: 'vendor-site'; label: string }
  | { kind: 'reserved'; role: ReservedRole }
  | { kind: 'unknown' };

export function isReservedName(label: string): boolean {
  return isReservedLabel(label);
}

/** A label a vendor could take: a valid single label that is not reserved. */
export function isVendorLabel(label: string): boolean {
  const l = String(label ?? '').trim().toLowerCase();
  return LABEL.test(l) && !isReservedLabel(l);
}

/**
 * Classify the Host header of a request.
 * Portal hosts are matched exactly (main, www of main, directory, app, admin, api, media). A vendor host is `<name>.<base>` for a single-level name that is not reserved, where `<base>` is
 * the vendor base domain (NEXT_PUBLIC_SITE_BASE_DOMAIN: get4domain.com) and, as before, the main host (names under the portal main host stay vendors).
 */
export function classifyHost(host: string | null | undefined, cfg: HostConfig = readHostConfig()): HostClass {
  const h = normalizeHost(host);
  const mainBase = baseDomain(cfg);
  const vendorBase = cfg.vendorBase ?? null;
  if (!h || (!mainBase && !vendorBase)) return { kind: 'unknown' };
  if (mainBase && h === mainBase) return { kind: 'main', canonical: true };
  if (mainBase && h === `www.${mainBase}`) return { kind: 'main', canonical: false };
  if (cfg.directory && h === cfg.directory) return { kind: 'directory' };
  if (cfg.app && h === cfg.app) return { kind: 'reserved', role: 'app' };
  if (cfg.admin && h === cfg.admin) return { kind: 'reserved', role: 'admin' };
  if (cfg.api && h === cfg.api) return { kind: 'reserved', role: 'api' };
  if (cfg.media && h === cfg.media) return { kind: 'reserved', role: 'media' };
  for (const base of [mainBase, vendorBase]) {
    if (!base || !h.endsWith(`.${base}`)) continue;
    const label = h.slice(0, -(base.length + 1));
    if (label.includes('.')) continue; // single-level subdomains only
    return isReservedLabel(label) ? { kind: 'reserved', role: 'name' } : { kind: 'vendor-site', label };
  }
  return { kind: 'unknown' };
}

export type HostNotRewrittenReason = 'PORTAL_HOST' | 'RESERVED_NAME' | 'NOT_UNDER_BASE' | 'EMPTY_SUBDOMAIN';

/**
 * Why a host is NOT sent to a vendor site, as a short code (null when it is a vendor host and will be rewritten). PORTAL_HOST: one of the platform's own hosts (main, directory, app, admin, api, media).
 * RESERVED_NAME: a reserved or v3/t3- name under the base. EMPTY_SUBDOMAIN: the bare base domain, or a name that is not a single valid label. NOT_UNDER_BASE: any other host.
 */
export function hostNotRewritten(host: string | null | undefined, cfg: HostConfig = readHostConfig()): { hostClass: string; reason: HostNotRewrittenReason } | null {
  const h = normalizeHost(host);
  const cls = classifyHost(host, cfg);
  if (cls.kind === 'vendor-site') return null;
  if (cls.kind === 'main' || cls.kind === 'directory') return { hostClass: cls.kind, reason: 'PORTAL_HOST' };
  if (cls.kind === 'reserved') return { hostClass: 'reserved', reason: cls.role === 'name' ? 'RESERVED_NAME' : 'PORTAL_HOST' };
  const bases = [baseDomain(cfg), cfg.vendorBase ?? null].filter((b): b is string => !!b);
  if (h && bases.some((b) => h === b || (h.endsWith(`.${b}`) && h.slice(0, -(b.length + 1)).includes('.')))) return { hostClass: 'unknown', reason: 'EMPTY_SUBDOMAIN' };
  return { hostClass: 'unknown', reason: 'NOT_UNDER_BASE' };
}

/**
 * The origin to put in a redirect or a sitemap line for a configured host: always https, except for localhost (development).
 * The request's own scheme is not used: behind the proxy chain it can read http for a visitor who came over https.
 */
export function originFor(host: string): string {
  const h = normalizeHost(host);
  return `${h === 'localhost' || h.endsWith('.localhost') ? 'http' : 'https'}://${h}`;
}
