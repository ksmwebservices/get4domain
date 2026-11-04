import { BadRequestException } from '@nestjs/common';

/**
 * Editable settings of Batch 3 (stored in g4d_plan_settings, edited through the existing plan-settings API; registered in plans/admin/extra-settings.ts).
 * Every default is documented here. No rupee price, no tax, no limit is invented in code: limits and timers are the documented defaults below, and every text is editable.
 *
 * TEXTS: the customer-facing lines below are DRAFT wording derived from the owner's rules (bridge model, seeded notice). They are not legal text and carry no promise of leads
 * or rankings. The owner or counsel replaces them through the settings API; no code change is needed.
 */
export interface B3Settings {
  // ── 5.4b renderer ──
  /** Footer line on every listing-only site (owner rule 5/7). */
  siteFooterBridgeText: string;
  /** The "Listed on Get4Domain" line on listing-only sites. */
  listedOnLineText: string;
  /** Visible line on SEEDED and INVITED sites (owner rule 8, verbatim wording). */
  seededNoticeText: string;
  /** Shown beside every customer-facing form and checkout (bridge statement). */
  customerDisclosureText: string;
  /** OFF (default): seeded sites are noindex. QUALITY: indexable only when the quality check passes. Only SUPER_ADMIN may change it (audited, reason required). */
  seededSiteIndexingMode: 'OFF' | 'QUALITY';
  // ── 5.6b canonical ──
  /** Cron tick that switches the canonical host back when the custom-domain promotion add-on ends. Off by default. */
  canonicalSwitchTickEnabled: boolean;
  // ── 5.1d lifecycle ──
  /** The clear warning shown before a vendor confirms a permanent deletion request. */
  accountDeletionWarningText: string;
  /** The most days staff may add to a grace period in one action. */
  graceExtendMaxDays: number;
  // ── 5.7b directory visits ──
  /** How long the visit reference value (?ref=) can be used to attribute a later request to the Directory. */
  directoryVisitRefExpiryMinutes: number;
  /** A repeat Visit click from the same network on the same business within this many seconds is not counted twice (the visitor still gets a link). 0 = count every click. */
  directoryVisitDedupeSeconds: number;
  // ── 5.13a seeded sites ──
  seededBatchMaxRows: number;
  // ── 5.14 requests and orders ──
  nudgeAfterMinutes: number;
  requestNudgeEnabled: boolean;
  requestExpiryDays: number;
  trackingTokenExpiryDays: number;
  stockReservationMinutes: number;
  /** Shown on the tracking page: what Get4Domain does and does not do. */
  trackingBridgeText: string;
  /** Spam score at or above which a one-time phone code is asked before the request is accepted. */
  spamScoreOtpThreshold: number;
  /** Spam score at or above which a request is stored as SPAM and not delivered. */
  spamScoreBlockThreshold: number;
  /** Message templates by key; variables in {{double braces}} are validated against an allow-list. */
  messageTemplates: Record<string, string>;
  /** Live sending is guarded off in this batch whatever this says; the sandbox outbox is always used. */
  messagingMode: 'sandbox';
}

export const DEFAULT_B3_SETTINGS: Readonly<B3Settings> = {
  siteFooterBridgeText: 'This is an informational listing on Get4Domain. Get4Domain passes enquiries to the business and does not take payments.',
  listedOnLineText: 'Listed on Get4Domain',
  seededNoticeText: 'This page was created from public information. Is this your business? Claim it or ask us to remove it.',
  customerDisclosureText: 'Your details go to the business you are contacting. Get4Domain passes your request on and does not receive or hold your payment.',
  seededSiteIndexingMode: 'OFF',
  canonicalSwitchTickEnabled: false,
  accountDeletionWarningText: 'Deleting your account permanently removes your site and your directory listing, and your business will not be listed again. This cannot be undone. Invoices and records the law requires us to keep are retained.',
  graceExtendMaxDays: 30,
  directoryVisitRefExpiryMinutes: 120,
  directoryVisitDedupeSeconds: 30,
  seededBatchMaxRows: 200,
  nudgeAfterMinutes: 30,
  requestNudgeEnabled: false,
  requestExpiryDays: 30,
  trackingTokenExpiryDays: 60,
  stockReservationMinutes: 15,
  trackingBridgeText: 'Get4Domain passes your request to the business. The business answers you and issues any invoice. Get4Domain does not receive or hold your payment.',
  spamScoreOtpThreshold: 50,
  spamScoreBlockThreshold: 90,
  messageTemplates: {
    request_received_customer: 'Hello {{customerName}}, {{businessName}} has received your request {{reference}}. Track it: {{trackingUrl}}',
    request_received_vendor: 'New request {{reference}} from {{customerName}} for {{businessName}}. Open your dashboard to respond.',
    request_responded_customer: '{{businessName}} replied to your request {{reference}}. Track it: {{trackingUrl}}',
    request_nudge_vendor: 'Request {{reference}} for {{businessName}} is waiting for your reply.',
    order_confirmed_customer: 'Your order {{orderNo}} with {{businessName}} is confirmed.',
  },
  messagingMode: 'sandbox',
};

export const B3_SETTING_KEYS = Object.keys(DEFAULT_B3_SETTINGS) as Array<keyof B3Settings>;
export const isB3SettingKey = (key: string): key is keyof B3Settings => (B3_SETTING_KEYS as string[]).includes(key);

/** Template variables a message may use. Anything else is refused at save time. */
export const TEMPLATE_VARIABLES = ['customerName', 'businessName', 'reference', 'trackingUrl', 'orderNo', 'amount', 'status'] as const;
export const TEMPLATE_KEYS = ['request_received_customer', 'request_received_vendor', 'request_responded_customer', 'request_nudge_vendor', 'order_confirmed_customer'] as const;

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const NO_MARKUP = /[<>]/;

export function templateVariablesOf(body: string): string[] { return [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]); }

export function b3SettingProblem(key: keyof B3Settings, value: unknown): string | null {
  switch (key) {
    case 'siteFooterBridgeText': case 'listedOnLineText': case 'seededNoticeText': case 'customerDisclosureText': case 'accountDeletionWarningText': case 'trackingBridgeText':
      return text(value, 3, 600) && !NO_MARKUP.test(value as string) ? null : 'must be plain text of 3 to 600 characters (no < or >)';
    case 'seededSiteIndexingMode': return value === 'OFF' || value === 'QUALITY' ? null : 'must be OFF or QUALITY';
    case 'canonicalSwitchTickEnabled': case 'requestNudgeEnabled': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'graceExtendMaxDays': return intIn(value, 1, 365) ? null : 'must be a whole number from 1 to 365';
    case 'directoryVisitRefExpiryMinutes': return intIn(value, 1, 10_080) ? null : 'must be a whole number of minutes from 1 to 10080';
    case 'directoryVisitDedupeSeconds': return intIn(value, 0, 3600) ? null : 'must be a whole number of seconds from 0 to 3600';
    case 'seededBatchMaxRows': return intIn(value, 1, 2000) ? null : 'must be a whole number from 1 to 2000';
    case 'nudgeAfterMinutes': return intIn(value, 1, 10_080) ? null : 'must be a whole number of minutes from 1 to 10080';
    case 'requestExpiryDays': case 'trackingTokenExpiryDays': return intIn(value, 1, 365) ? null : 'must be a whole number of days from 1 to 365';
    case 'stockReservationMinutes': return intIn(value, 1, 1440) ? null : 'must be a whole number of minutes from 1 to 1440';
    case 'spamScoreOtpThreshold': case 'spamScoreBlockThreshold': return intIn(value, 1, 100) ? null : 'must be a whole number from 1 to 100';
    case 'messagingMode': return value === 'sandbox' ? null : 'live messaging is not available in this build; only "sandbox" is accepted';
    case 'messageTemplates': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'must be an object of template key to text';
      for (const [k, body] of Object.entries(value as Record<string, unknown>)) {
        if (!(TEMPLATE_KEYS as readonly string[]).includes(k)) return `unknown template "${k}"`;
        if (!text(body, 3, 480) || NO_MARKUP.test(body as string)) return `template "${k}" must be plain text of 3 to 480 characters`;
        const bad = templateVariablesOf(body as string).filter((x) => !(TEMPLATE_VARIABLES as readonly string[]).includes(x));
        if (bad.length) return `template "${k}" uses unknown variables: ${bad.join(', ')}`;
      }
      return null;
    }
    default: return 'is not a known setting';
  }
}

export function validateB3Setting(key: string, value: unknown): void {
  if (!isB3SettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = b3SettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Stored values merged over the defaults; an invalid stored value falls back to its default (the settings API refuses invalid values, so this is belt and braces). */
export function resolveB3Settings(stored: Map<string, unknown>): B3Settings {
  const out: Record<string, unknown> = {};
  for (const key of B3_SETTING_KEYS) {
    const v = stored.get(key);
    out[key] = v !== undefined && b3SettingProblem(key, v) === null ? v : DEFAULT_B3_SETTINGS[key];
  }
  // a template left out of a stored object keeps its default
  out.messageTemplates = { ...DEFAULT_B3_SETTINGS.messageTemplates, ...((out.messageTemplates as Record<string, string>) ?? {}) };
  return out as unknown as B3Settings;
}
