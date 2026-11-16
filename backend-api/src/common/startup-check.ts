import { createHash } from 'crypto';
import { resolveTrustProxy } from './trust-proxy';

/**
 * The V3 live startup check (job L). The API is started from the live image (Dockerfile.v3live) with NODE_ENV=production and V3_LIVE=true; before anything else it asks this file whether the environment is fit
 * to serve real vendors, and refuses to boot when it is not. It looks at NAMES and SHAPES only: no problem text ever contains a value, a host name or a secret.
 *
 * It does NOT apply to any other deployment (the Version 2 production containers, staging, tests, a developer machine): they do not set V3_LIVE=true, so they boot as before.
 */
export interface EnvProblem { name: string; problem: string }
export type Env = Readonly<Record<string, string | undefined>>;

/** Every variable the live API refuses to boot without. */
export const REQUIRED_LIVE_ENV = [
  'V3_DOMAIN', 'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'PLATFORM_SETTINGS_KEY', 'REVALIDATE_SECRET',
  'SITE_BASE_DOMAIN', 'TRUSTED_PROXIES', 'FRONTEND_URL', 'PUBLIC_APP_URL', 'PUBLIC_API_URL', 'SERVER_IP',
] as const;

/** Secrets must be long and random; shorter than this is refused. */
export const MIN_SECRET_LENGTH = 32;
const SECRETS = ['JWT_SECRET', 'PLATFORM_SETTINGS_KEY', 'REVALIDATE_SECRET'] as const;
/** The URLs that end up in redirects and e-mail links: https, on the live domain. */
const URLS = ['FRONTEND_URL', 'PUBLIC_APP_URL', 'PUBLIC_API_URL'] as const;

/**
 * SHA-256 of the project ref of the STAGING database (the same value as scripts/staging/staging-guard.config.json, kept equal by a test). The live API never starts against it. Only a hash is kept,
 * never the name.
 */
export const STAGING_PROJECT_REF_HASHES: readonly string[] = ['5d1c5890b888e0aaf03fcd6c3648202b2da8c3708713babfb519037e8b9ac2a6'];

const PLACEHOLDER = /^(change[-_ ]?me|changeme|replace[-_ ]?me|your[-_ ].*|<.*>|x{3,}|todo|tbd|placeholder|example|secret|password|test|none|null|undefined|\.{3}|\*+)$/i;
const PLACEHOLDER_PART = /(change[-_ ]?me|replace[-_ ]?me|your[-_ ](secret|key|password|domain|api|token)|<[^>]*>|placeholder|example\.(com|org|net)|\.invalid\b|\.test\b|\.example\b)/i;
/** A host that is a staging, test, development or local database whatever the provider. */
const NON_LIVE_HOST = /staging|testing|sandbox|localhost|development|(^|[.\-_])(stage|stg|test|dev|develop|qa|uat|demo|local|preview)([.\-_]|$)/i;

const present = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== '';
export const isPlaceholder = (v: string): boolean => PLACEHOLDER.test(v.trim()) || PLACEHOLDER_PART.test(v);
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const hostOf = (v: string): string | null => { try { return new URL(v.includes('://') ? v : `https://${v}`).hostname.toLowerCase(); } catch { return null; } };
const underDomain = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

/** The Supabase project ref of a connection string, as the staging guard reads it. */
export function projectRefOf(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.username.includes('.')) return u.username.split('.').slice(1).join('.');
  const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return m ? m[1] : null;
}

/** What is wrong with one database connection string, in words that never repeat it. */
export function databaseUrlProblem(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return 'is not a valid connection string'; }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return 'must be a postgres connection string';
  if (!u.hostname || !u.password) return 'needs a host and a password';
  if (isPlaceholder(u.password) || isPlaceholder(u.hostname)) return 'is still a placeholder';
  const names = [u.hostname, decodeURIComponent(u.username), u.pathname.replace(/^\//, '')];
  if (names.some((n) => NON_LIVE_HOST.test(n))) return 'points at a staging, test, development or local database, which the live API refuses';
  const ref = projectRefOf(url);
  if (ref && STAGING_PROJECT_REF_HASHES.includes(sha(ref))) return 'points at the staging database, which the live API refuses';
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(u.hostname)) return 'points at a local or private address, which the live API refuses';
  return null;
}

/** The database rules only (used by the bootstrap and backup scripts too). */
export function checkDatabaseUrls(env: Env): EnvProblem[] {
  const out: EnvProblem[] = [];
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const v = env[name];
    if (!present(v)) { out.push({ name, problem: 'is missing' }); continue; }
    const why = databaseUrlProblem(v.trim());
    if (why) out.push({ name, problem: why });
  }
  return out;
}

/** True when this process is the V3 live API. */
export const isLiveProcess = (env: Env): boolean => env.NODE_ENV === 'production' && env.V3_LIVE === 'true';

/** Every problem with the live environment, or an empty list. */
export function checkLiveEnv(env: Env): EnvProblem[] {
  const out: EnvProblem[] = [];
  for (const name of REQUIRED_LIVE_ENV) {
    const v = env[name];
    if (!present(v)) out.push({ name, problem: 'is missing' });
    else if (!/^(DATABASE_URL|DIRECT_URL)$/.test(name) && isPlaceholder(v.trim())) out.push({ name, problem: 'is still a placeholder' });
  }
  const bad = (name: string): boolean => out.some((p) => p.name === name);
  for (const name of SECRETS) { const v = env[name]; if (present(v) && !bad(name) && v.trim().length < MIN_SECRET_LENGTH) out.push({ name, problem: `is shorter than ${MIN_SECRET_LENGTH} characters` }); }
  if (present(env.JWT_SECRET) && env.JWT_SECRET === env.PLATFORM_SETTINGS_KEY) out.push({ name: 'PLATFORM_SETTINGS_KEY', problem: 'must differ from JWT_SECRET' });
  if (present(env.JWT_SECRET) && env.JWT_SECRET === env.REVALIDATE_SECRET) out.push({ name: 'REVALIDATE_SECRET', problem: 'must differ from JWT_SECRET' });

  const domain = present(env.V3_DOMAIN) && !bad('V3_DOMAIN') ? env.V3_DOMAIN.trim().toLowerCase() : null;
  if (domain && (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) || NON_LIVE_HOST.test(domain))) out.push({ name: 'V3_DOMAIN', problem: 'must be a real registered domain name such as the one the vendors will use (no scheme, no path)' });
  if (domain) {
    for (const name of URLS) {
      const v = env[name];
      if (!present(v) || bad(name)) continue;
      const h = hostOf(v.trim());
      if (!v.trim().startsWith('https://')) out.push({ name, problem: 'must start with https://' });
      else if (!h || !underDomain(h, domain)) out.push({ name, problem: 'must be on V3_DOMAIN (the domain itself or a subdomain)' });
    }
    const site = env.SITE_BASE_DOMAIN;
    if (present(site) && !bad('SITE_BASE_DOMAIN')) { const h = hostOf(site.trim()); if (!h || site.includes('/') || !underDomain(h, domain)) out.push({ name: 'SITE_BASE_DOMAIN', problem: 'must be V3_DOMAIN or a subdomain of it, as a bare host name' }); }
  }
  if (present(env.SERVER_IP) && !bad('SERVER_IP') && !/^\d{1,3}(\.\d{1,3}){3}$/.test(env.SERVER_IP.trim())) out.push({ name: 'SERVER_IP', problem: 'must be the server IPv4 address' });
  if (present(env.TRUSTED_PROXIES) && !bad('TRUSTED_PROXIES')) {
    const t = resolveTrustProxy({ TRUSTED_PROXIES: env.TRUSTED_PROXIES });
    if (t.source !== 'TRUSTED_PROXIES' || t.rejected.length) out.push({ name: 'TRUSTED_PROXIES', problem: 'must list only valid addresses or subnets, and at least one' });
  }
  out.push(...checkDatabaseUrls(env));
  // switches that must never be on in production
  for (const [name, on] of [['OTP_DEV_ECHO', 'true'], ['THROTTLE_DISABLED', 'true'], ['EMAIL_MODE', 'test']] as const) if (env[name] === on) out.push({ name, problem: 'must not be set in production' });
  return out;
}

/** Refuses to boot: prints the NAME and the problem of each fault (never a value) and exits. A no-op outside the live process. */
export function assertLiveEnv(env: Env = process.env, exit: (code: number) => never = (c) => process.exit(c), write: (s: string) => void = (s) => process.stderr.write(s)): void {
  if (!isLiveProcess(env)) return;
  const problems = checkLiveEnv(env);
  if (problems.length === 0) return;
  write(`The live API will not start. ${problems.length} fault(s) in the environment:\n${problems.map((p) => `  - ${p.name} ${p.problem}`).join('\n')}\nFix .env.live (see .env.live.example) and start again.\n`);
  exit(1);
}
