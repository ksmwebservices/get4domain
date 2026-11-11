import { SENSITIVE_KEYS } from '../../common/utils/redact-secrets';

/**
 * The pure core of slice 5.20 (activity log and alerts): no clock, no database, no randomness. It decides two things.
 *   1. What a summary may carry into the log: secrets are dropped, personal data is masked (`maskSummary`).
 *   2. Which alert rules an event raises (`evaluateAlerts`). An alert only tells staff; nothing here hides, deletes or freezes anything.
 * A rule that needs a number (a cap, a count) never fires until staff have set that number: no threshold is invented here.
 */
export type ActorType = 'VENDOR_USER' | 'STAFF' | 'SYSTEM';
export type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'NEW' | 'LOOKING' | 'RESOLVED' | 'NOT_AN_ISSUE';

export const ALERT_RULE_KEYS = [
  'PAYMENT_METHOD_CHANGED', 'BUSINESS_IDENTITY_CHANGED', 'CAMPAIGN_SPIKE', 'PAYMENT_FAILURES', 'PROHIBITED_TEXT',
  'DOMAIN_CHANGED', 'LARGE_IMPORT', 'PLAN_STATE_CHANGED', 'LISTING_DELETION_REQUESTED', 'THEME_SWITCHED',
  /** added by slice 5.21: the payee name on a UPI handle does not match the business or owner name (never blocks) */
  'PAYEE_NAME_MISMATCH',
] as const;
export type AlertRuleKey = (typeof ALERT_RULE_KEYS)[number];

/** The level each rule is seeded with (owner's alert table). Staff cannot make a rule raise a different kind of event, only enable it and set its numbers. */
export const DEFAULT_RULE_LEVEL: Readonly<Record<AlertRuleKey, AlertLevel>> = {
  PAYMENT_METHOD_CHANGED: 'HIGH', BUSINESS_IDENTITY_CHANGED: 'HIGH', CAMPAIGN_SPIKE: 'HIGH', PAYMENT_FAILURES: 'HIGH', PROHIBITED_TEXT: 'HIGH',
  DOMAIN_CHANGED: 'MEDIUM', LARGE_IMPORT: 'MEDIUM', PLAN_STATE_CHANGED: 'MEDIUM', LISTING_DELETION_REQUESTED: 'MEDIUM', THEME_SWITCHED: 'LOW', PAYEE_NAME_MISMATCH: 'HIGH',
};

export interface AlertRuleRow { key: string; level: AlertLevel; thresholdJson: Record<string, number> | null; notifyRoles: string[]; enabled: boolean }
export interface ActivityFact { activityId: string; vendorId: string | null; actionKey: string; summary: Record<string, unknown> }
export interface AlertDraft { ruleKey: string; level: AlertLevel; vendorId: string; activityIds: string[]; logOnly: boolean }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const thr = (r: AlertRuleRow, name: string): number | null => num(r.thresholdJson?.[name]);
const changedFields = (s: Record<string, unknown>): string[] => (Array.isArray(s.changed) ? s.changed.filter((x): x is string => typeof x === 'string') : []);

/** One predicate per rule. Each is given the fact and its own rule row (for the staff thresholds). */
const PREDICATES: Record<AlertRuleKey, (f: ActivityFact, r: AlertRuleRow) => boolean> = {
  PAYMENT_METHOD_CHANGED: (f) => /^payment_method\.(created|updated|deleted|upi_changed)$/.test(f.actionKey),
  BUSINESS_IDENTITY_CHANGED: (f) => f.actionKey === 'business.identity_changed' && changedFields(f.summary).some((c) => c === 'name' || c === 'gstNumber'),
  CAMPAIGN_SPIKE: (f, r) => {
    if (f.actionKey !== 'campaign.metrics') return false;
    return (['dailyCap', 'complaints', 'stops'] as const).some((k) => { const limit = thr(r, k); const value = num(f.summary[k]); return limit !== null && value !== null && value > limit; });
  },
  PAYMENT_FAILURES: (f, r) => { const limit = thr(r, 'count'); const value = num(f.summary.recentFailures); return f.actionKey === 'payment.failed' && limit !== null && value !== null && value >= limit; },
  PROHIBITED_TEXT: (f) => f.actionKey === 'prohibited_text.matched',
  DOMAIN_CHANGED: (f) => f.actionKey.startsWith('domain.'),
  LARGE_IMPORT: (f, r) => { const limit = thr(r, 'rows'); const value = num(f.summary.rows); return f.actionKey === 'import.completed' && limit !== null && value !== null && value >= limit; },
  PLAN_STATE_CHANGED: (f) => f.actionKey === 'plan.state_changed' || f.actionKey === 'subscription.assigned',
  LISTING_DELETION_REQUESTED: (f) => f.actionKey === 'listing.deletion_requested' || f.actionKey === 'account.deletion_requested',
  THEME_SWITCHED: (f) => f.actionKey === 'theme.switched',
  PAYEE_NAME_MISMATCH: (f) => f.actionKey === 'payee_name.mismatch',
};

/** Rules whose events are written to the log but never become an alert row. */
const LOG_ONLY: ReadonlySet<string> = new Set(['THEME_SWITCHED']);

export function evaluateAlerts(fact: ActivityFact, rules: readonly AlertRuleRow[]): AlertDraft[] {
  if (!fact.vendorId) return [];
  const out: AlertDraft[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    const pred = (PREDICATES as Record<string, ((f: ActivityFact, r: AlertRuleRow) => boolean) | undefined>)[r.key];
    if (pred && pred(fact, r)) out.push({ ruleKey: r.key, level: r.level, vendorId: fact.vendorId, activityIds: [fact.activityId], logOnly: LOG_ONLY.has(r.key) });
  }
  return out;
}

// ── masking ───────────────────────────────────────────────────────────────────────────────────────────

const SECRET_KEY = /(secret|password|passwd|token|cipher|apikey|api_key|accountnumber|account_number|ifsc|cvv)/i;
const SECRET_EXACT: ReadonlySet<string> = new Set(['otp', 'pin', 'upiPin']);
const PHONE_KEY = /(phone|mobile|whatsapp|msisdn)/i;
const EMAIL_KEY = /(email|e_mail)/i;
const NAME_KEY = /^(customerName|contactName|buyerName|ownerName|fullName|payeeName|requesterName)$/i;
const ADDRESS_KEY = /address/i;
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_IN_TEXT = /\+?\d[\d\s-]{8,}\d/g;
const MAX_TEXT = 500;
const MAX_DEPTH = 6;

const maskPhone = (v: string): string => { const d = v.replace(/\D/g, ''); return d.length <= 2 ? '*'.repeat(d.length) : '*'.repeat(d.length - 2) + d.slice(-2); };
const maskEmail = (v: string): string => { const at = v.indexOf('@'); return at <= 0 ? '[masked]' : `${v[0]}***${v.slice(at)}`; };
const maskText = (v: string): string => v.replace(EMAIL_IN_TEXT, '[email]').replace(PHONE_IN_TEXT, '[phone]').slice(0, MAX_TEXT);

function isPlain(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

function maskValue(key: string, v: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof v === 'string') {
    if (PHONE_KEY.test(key)) return maskPhone(v);
    if (EMAIL_KEY.test(key)) return maskEmail(v);
    if (NAME_KEY.test(key)) return v ? `${v[0]}***` : '';
    if (ADDRESS_KEY.test(key)) return '[masked]';
    return maskText(v);
  }
  if (Array.isArray(v)) {
    if (depth >= MAX_DEPTH || seen.has(v)) return '[too deep]';
    seen.add(v);
    return v.map((x) => maskValue(key, x, depth + 1, seen));
  }
  if (isPlain(v)) {
    if (depth >= MAX_DEPTH || seen.has(v)) return '[too deep]';
    seen.add(v);
    return maskObject(v, depth + 1, seen);
  }
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'number' || typeof v === 'boolean' || v === null ? v : undefined;
}

function maskObject(o: Record<string, unknown>, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (SENSITIVE_KEYS.has(k) || SECRET_EXACT.has(k) || SECRET_KEY.test(k)) continue;
    const m = maskValue(k, v, depth, seen);
    if (m !== undefined) out[k] = m;
  }
  return out;
}

/** A copy of `summary` that is safe to store and show: secret fields removed at every depth, phone numbers, e-mail addresses, customer names and addresses masked, long text cut. The input is never changed. */
export function maskSummary(summary: unknown): Record<string, unknown> {
  return isPlain(summary) ? maskObject(summary, 0, new WeakSet<object>([summary])) : {};
}
