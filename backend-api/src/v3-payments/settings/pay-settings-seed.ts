import { b3SettingProblem, isB3SettingKey, B3Settings } from '../../b3-settings/b3-settings';

/**
 * The owner's pay-link setting (Amendment 09 W4, 11 November 2026): payLinkExpiryHours defaults to 48. It sets ONE value and nothing else, enables nothing by itself, and staff can change it in admin
 * settings afterwards (the plan-settings API). A dry run unless told to apply; safe to run twice; a value staff already set is NEVER overwritten.
 */
export const OWNER_PAY_SETTINGS_SOURCE = 'OWNER_DECISION_2026_11_11';
export const OWNER_PAY_SETTINGS: Readonly<Partial<B3Settings>> = { payLinkExpiryHours: 48 };

export interface PaySettingsSeedPort {
  /** which of these keys already have a row (any value) */
  existing(keys: readonly string[]): Promise<string[]>;
  /** create the rows and one audit row each, together; never touches an existing row */
  create(rows: ReadonlyArray<{ key: string; value: unknown; description: string }>): Promise<void>;
}

export interface PaySettingsSeedReport { applied: boolean; toSet: string[]; alreadySet: string[]; created: string[] }

export async function loadPaySettings(port: PaySettingsSeedPort, o: { apply: boolean }): Promise<PaySettingsSeedReport> {
  const entries = Object.entries(OWNER_PAY_SETTINGS);
  for (const [k, v] of entries) {   // the loader holds itself to the same validation staff input gets
    if (!isB3SettingKey(k)) throw new Error(`${k}: is not a known setting`);
    const problem = b3SettingProblem(k, v); if (problem) throw new Error(`${k}: ${problem}`);
  }
  const have = new Set(await port.existing(entries.map(([k]) => k)));
  const toSet = entries.filter(([k]) => !have.has(k)).map(([k]) => k);
  const report: PaySettingsSeedReport = { applied: o.apply, toSet, alreadySet: entries.filter(([k]) => have.has(k)).map(([k]) => k), created: [] };
  if (!o.apply || toSet.length === 0) return report;
  await port.create(entries.filter(([k]) => toSet.includes(k)).map(([k, v]) => ({ key: k, value: v, description: `Set by the owner decision of 11 November 2026 (${OWNER_PAY_SETTINGS_SOURCE}). Staff can change it in admin settings.` })));
  report.created = [...toSet]; report.toSet = [];
  return report;
}
