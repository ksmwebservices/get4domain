import { BadRequestException } from '@nestjs/common';

/**
 * The provisioning settings and their documented defaults (docs/v3/V3_S3_PROVISIONING.md section 7). They live in the slice 5.1 table g4d_plan_settings,
 * so the owner edits them through the existing plan-settings API (with its audit trail and stale-write protection). A missing or invalid row means the default.
 * The wording is a PLACEHOLDER written by engineering, marked proposed: the owner edits it, and the Tamil wording needs a Tamil speaker.
 */
export interface ProvisioningSettings {
  provisioningRunnerEnabled: boolean;
  provisioningMaxAttempts: number;
  provisioningBackoffSeconds: number[];
  claimLinkExpiryDays: number;
  inviteAdapterMode: 'sandbox' | 'live';
  publicAppUrl: string;
  /** slice 5.4: legacy = the slice 5.3 draft only; renderer = also the site settings and a DRAFT_PREVIEW publication (never published) */
  siteDraftBuilderMode: 'legacy' | 'renderer';
  inviteSubjectTemplate: string;
  inviteBodyTemplate: string;
}

export const DEFAULT_PROVISIONING_SETTINGS: Readonly<ProvisioningSettings> = {
  provisioningRunnerEnabled: false,
  provisioningMaxAttempts: 5,
  provisioningBackoffSeconds: [30, 120, 600, 1800],
  claimLinkExpiryDays: 14,
  inviteAdapterMode: 'sandbox',
  publicAppUrl: 'https://staging.get4domain.invalid',
  siteDraftBuilderMode: 'legacy',
  inviteSubjectTemplate: 'Your free Get4Domain page for {{businessName}} is ready to claim',
  inviteBodyTemplate: [
    'Hello,',
    '',
    'We have prepared a free business page for {{businessName}} on Get4Domain.',
    '',
    'Claim it here: {{claimUrl}}',
    '',
    'This link expires in {{expiryDays}} days. If you did not expect this message, you can ignore it.',
    '',
    'Team Get4Domain',
  ].join('\n'),
};

export const PROVISIONING_SETTING_KEYS = Object.keys(DEFAULT_PROVISIONING_SETTINGS) as Array<keyof ProvisioningSettings>;
export const isProvisioningSettingKey = (key: string): key is keyof ProvisioningSettings => (PROVISIONING_SETTING_KEYS as string[]).includes(key);

const ALLOWED_VARS = ['businessName', 'claimUrl', 'expiryDays'];
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function templateProblem(v: unknown, mustHave: string | null): string | null {
  if (typeof v !== 'string' || v.trim().length === 0 || v.length > 4000) return 'must be plain text of 1 to 4000 characters';
  for (const m of v.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) if (!ALLOWED_VARS.includes(m[1])) return `uses an unknown variable {{${m[1]}}}; allowed: ${ALLOWED_VARS.map((x) => `{{${x}}}`).join(', ')}`;
  if (mustHave && !new RegExp(`\\{\\{\\s*${mustHave}\\s*\\}\\}`).test(v)) return `must contain {{${mustHave}}}`;
  return null;
}

/** Returns the problem with a value, or null when it is acceptable. */
export function provisioningSettingProblem(key: keyof ProvisioningSettings, value: unknown): string | null {
  switch (key) {
    case 'provisioningRunnerEnabled': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'provisioningMaxAttempts': return intIn(value, 1, 20) ? null : 'must be a whole number from 1 to 20';
    case 'provisioningBackoffSeconds': return Array.isArray(value) && value.length >= 1 && value.length <= 10 && value.every((n) => intIn(n, 1, 86_400)) ? null : 'must be a list of 1 to 10 whole numbers of seconds (1 to 86400)';
    case 'claimLinkExpiryDays': return intIn(value, 1, 365) ? null : 'must be a whole number of days from 1 to 365';
    case 'inviteAdapterMode': return value === 'sandbox' || value === 'live' ? null : 'must be "sandbox" or "live"';
    case 'siteDraftBuilderMode': return value === 'legacy' || value === 'renderer' ? null : 'must be "legacy" or "renderer"';
    case 'publicAppUrl': {
      if (typeof value !== 'string' || value.length > 200) return 'must be a web address';
      try { const u = new URL(value); return (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) && !u.search && !u.hash ? null : 'must be an https address with no query or fragment'; } catch { return 'must be a web address'; }
    }
    case 'inviteSubjectTemplate': return templateProblem(value, null);
    case 'inviteBodyTemplate': return templateProblem(value, 'claimUrl');
  }
}

/** Used by the plan-settings validator so the owner can edit these keys through the existing API. */
export function validateProvisioningSetting(key: string, value: unknown): void {
  if (!isProvisioningSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = provisioningSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Defaults overlaid with the stored values that pass validation. */
export function resolveProvisioningSettings(stored: ReadonlyMap<string, unknown>): ProvisioningSettings {
  const out: Record<string, unknown> = { ...DEFAULT_PROVISIONING_SETTINGS };
  for (const key of PROVISIONING_SETTING_KEYS) {
    if (stored.has(key) && provisioningSettingProblem(key, stored.get(key)) === null) out[key] = key === 'publicAppUrl' ? String(stored.get(key)).replace(/\/+$/, '') : stored.get(key);
  }
  return out as unknown as ProvisioningSettings;
}

/** {{variable}} substitution; nothing else is interpreted. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_m, name: string) => vars[name] ?? '');
}
