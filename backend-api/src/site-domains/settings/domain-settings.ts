import { BadRequestException } from '@nestjs/common';

/** Editable settings of slice 5.6 (stored in g4d_plan_settings, edited through the existing plan-settings API). Every default is documented here. */
export interface DomainSettings {
  /** names no vendor may take as a free subdomain (technical and impersonation-prone names); matched after look-alike folding */
  reservedSubdomains: string[];
  /** words (3+ letters) that may not appear inside a free subdomain; the owner supplies the profanity and confusable list, none is invented here */
  blockedSubdomainWords: string[];
  subdomainMinLength: number;
  subdomainMaxLength: number;
  /** how many times a vendor may change their free subdomain within the period; staff are not limited */
  subdomainChangeLimitPerPeriod: number;
  subdomainChangePeriodDays: number;
  /** the platform's own domain under which free subdomains live (a staging placeholder until the owner sets the real one) */
  baseDomain: string;
  /** which of www / apex is canonical when a vendor owns both */
  wwwPolicy: 'apex' | 'www';
  /** the DNS name prefix of the ownership challenge: <prefix>.<hostname> */
  verificationTxtPrefix: string;
  /** false (default): no DNS query is ever made; verification stays PENDING until staff set the state */
  domainDnsLiveChecks: boolean;
  /** the least time between two "verify now" calls on one domain */
  domainVerifyMinIntervalSeconds: number;
  /** after this many checks without a match the domain becomes FAILED (the owner can retry) */
  domainVerifyMaxAttempts: number;
  /** custom domains (not removed) one vendor may hold at once: an abuse limit, not a plan feature */
  domainMaxPerVendor: number;
}

export const DEFAULT_DOMAIN_SETTINGS: Readonly<DomainSettings> = {
  reservedSubdomains: [
    'www', 'admin', 'administrator', 'api', 'app', 'apps', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'sftp', 'ns', 'ns1', 'ns2', 'dns', 'cdn', 'static', 'assets', 'media', 'img', 'images',
    'login', 'signin', 'signup', 'register', 'auth', 'account', 'accounts', 'dashboard', 'console', 'portal', 'billing', 'pay', 'payment', 'payments', 'checkout', 'secure', 'security',
    'support', 'help', 'status', 'docs', 'blog', 'news', 'staging', 'stage', 'dev', 'test', 'demo', 'preview', 'beta', 'root', 'localhost', 'webmail', 'cpanel', 'whm', 'autodiscover',
    'get4domain', 'g4d', 'directory', 'search', 'sitemap', 'robots',
  ],
  blockedSubdomainWords: [],
  subdomainMinLength: 3,
  subdomainMaxLength: 40,
  subdomainChangeLimitPerPeriod: 2,
  subdomainChangePeriodDays: 365,
  baseDomain: 'get4domain.com',
  wwwPolicy: 'apex',
  verificationTxtPrefix: '_g4d-verify',
  domainDnsLiveChecks: false,
  domainVerifyMinIntervalSeconds: 30,
  domainVerifyMaxAttempts: 50,
  domainMaxPerVendor: 5,
};

export const DOMAIN_SETTING_KEYS = Object.keys(DEFAULT_DOMAIN_SETTINGS) as Array<keyof DomainSettings>;
export const isDomainSettingKey = (key: string): key is keyof DomainSettings => (DOMAIN_SETTING_KEYS as string[]).includes(key);

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const nameList = (v: unknown, max: number, minLen: number): boolean => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.length >= minLen && x.length <= 63 && /^[a-z0-9-]+$/.test(x));

export function domainSettingProblem(key: keyof DomainSettings, value: unknown): string | null {
  switch (key) {
    case 'reservedSubdomains': return nameList(value, 500, 1) ? null : 'must be a list of up to 500 lowercase names (letters, digits, hyphen)';
    case 'blockedSubdomainWords': return nameList(value, 500, 3) ? null : 'must be a list of up to 500 lowercase words of 3 or more letters';
    case 'subdomainMinLength': return intIn(value, 1, 30) ? null : 'must be a whole number from 1 to 30';
    case 'subdomainMaxLength': return intIn(value, 3, 63) ? null : 'must be a whole number from 3 to 63';
    case 'subdomainChangeLimitPerPeriod': return intIn(value, 0, 50) ? null : 'must be a whole number from 0 to 50';
    case 'subdomainChangePeriodDays': return intIn(value, 1, 3650) ? null : 'must be a whole number of days from 1 to 3650';
    case 'baseDomain': return typeof value === 'string' && value.length <= 120 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value) ? null : 'must be a lowercase domain name such as example.com';
    case 'wwwPolicy': return value === 'apex' || value === 'www' ? null : 'must be "apex" or "www"';
    case 'verificationTxtPrefix': return typeof value === 'string' && /^[a-z_][a-z0-9_-]{0,30}$/.test(value) ? null : 'must be 1 to 31 lowercase letters, digits, underscore or hyphen, starting with a letter or underscore';
    case 'domainDnsLiveChecks': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'domainVerifyMinIntervalSeconds': return intIn(value, 0, 86_400) ? null : 'must be a whole number of seconds from 0 to 86400';
    case 'domainVerifyMaxAttempts': return intIn(value, 1, 1000) ? null : 'must be a whole number from 1 to 1000';
    case 'domainMaxPerVendor': return intIn(value, 1, 50) ? null : 'must be a whole number from 1 to 50';
  }
}

export function validateDomainSetting(key: string, value: unknown): void {
  if (!isDomainSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = domainSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Defaults overlaid with the stored values that pass validation; an inconsistent min/max pair falls back to the defaults. */
export function resolveDomainSettings(stored: ReadonlyMap<string, unknown>): DomainSettings {
  const out: Record<string, unknown> = { ...DEFAULT_DOMAIN_SETTINGS };
  for (const key of DOMAIN_SETTING_KEYS) if (stored.has(key) && domainSettingProblem(key, stored.get(key)) === null) out[key] = stored.get(key);
  const r = out as unknown as DomainSettings;
  if (r.subdomainMinLength > r.subdomainMaxLength) { r.subdomainMinLength = DEFAULT_DOMAIN_SETTINGS.subdomainMinLength; r.subdomainMaxLength = DEFAULT_DOMAIN_SETTINGS.subdomainMaxLength; }
  return r;
}
