import { ALERT_RULE_KEYS, AlertLevel, DEFAULT_RULE_LEVEL } from '../core/activity-core';

/**
 * The alert rule loader (slice 5.20). It creates the ten rule rows of the owner's alert table: key, level and who is told. Every row is created DISABLED and with NO numbers. It never switches a rule on and never
 * invents a threshold: staff set the numbers and enable each rule (a rule that needs numbers refuses to switch on without them). A rule that already exists is never touched. A dry run unless told to apply.
 */
export const ALERT_RULES_SOURCE = 'OWNER_ALERT_TABLE_2026_11_04';
const rolesFor = (level: AlertLevel): string[] => (level === 'LOW' ? [] : ['SUPER_ADMIN', 'OPERATIONS']);
export const ALERT_RULE_SEED: ReadonlyArray<{ key: string; level: AlertLevel; notifyRoles: string[] }> = ALERT_RULE_KEYS.map((key) => ({ key, level: DEFAULT_RULE_LEVEL[key], notifyRoles: rolesFor(DEFAULT_RULE_LEVEL[key]) }));

export interface AlertRulesSeedPort {
  /** the keys of the rules that already exist (any state) */
  existing(): Promise<string[]>;
  /** creates only the rows that are missing, disabled and with no numbers; returns the keys it created */
  create(rows: ReadonlyArray<{ key: string; level: AlertLevel; notifyRoles: string[] }>): Promise<string[]>;
}
export interface AlertRulesSeedReport { applied: boolean; toCreate: string[]; alreadyThere: string[]; created: string[] }

export async function loadAlertRules(port: AlertRulesSeedPort, o: { apply: boolean }): Promise<AlertRulesSeedReport> {
  const have = new Set(await port.existing());
  const missing = ALERT_RULE_SEED.filter((r) => !have.has(r.key));
  const report: AlertRulesSeedReport = { applied: o.apply, toCreate: missing.map((r) => r.key), alreadyThere: ALERT_RULE_SEED.filter((r) => have.has(r.key)).map((r) => r.key), created: [] };
  if (!o.apply || !missing.length) return report;
  report.created = await port.create(missing); report.toCreate = [];
  return report;
}
