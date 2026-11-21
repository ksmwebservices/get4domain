import { isWalletSettingKey, walletSettingProblem, WalletSettings } from './wallet-settings';

/**
 * The owner's wallet settings loader (OWNER WALLET AND INVOICE ADDENDUM, 5 November 2026). It sets ONE value: the refill minimum, Rs 999 = 99900 paise.
 * Everything the owner has not decided stays unset on purpose (the refill maximum, Get4Domain's GST state code, the revision limit, auto-approval days, the plan allowances, pack validity, the
 * term discount percentages): the wallet refuses refills and the services refuse requests until staff set them, so this loader enables nothing by itself.
 * A dry run unless told to apply; safe to run twice; a value staff already set is NEVER overwritten.
 */
export const OWNER_WALLET_SETTINGS_SOURCE = 'OWNER_DECISION_2026_11_05';
export const OWNER_WALLET_SETTINGS: Readonly<Partial<WalletSettings>> = { walletTopupMinPaise: 99_900 };

export interface WalletSettingsSeedPort {
  /** which of these keys already have a row (any value) */
  existing(keys: readonly string[]): Promise<string[]>;
  /** create the rows and one audit row each, together; never touches an existing row */
  create(rows: ReadonlyArray<{ key: string; value: unknown; description: string }>): Promise<void>;
}

export interface WalletSettingsSeedReport { applied: boolean; toSet: string[]; alreadySet: string[]; created: string[] }

export async function loadWalletSettings(port: WalletSettingsSeedPort, o: { apply: boolean }): Promise<WalletSettingsSeedReport> {
  const entries = Object.entries(OWNER_WALLET_SETTINGS);
  for (const [k, v] of entries) {   // the loader holds itself to the same validation staff input gets
    if (!isWalletSettingKey(k)) throw new Error(`${k}: is not a wallet setting`);
    const problem = walletSettingProblem(k, v); if (problem) throw new Error(`${k}: ${problem}`);
  }
  const have = new Set(await port.existing(entries.map(([k]) => k)));
  const toSet = entries.filter(([k]) => !have.has(k)).map(([k]) => k);
  const report: WalletSettingsSeedReport = { applied: o.apply, toSet, alreadySet: entries.filter(([k]) => have.has(k)).map(([k]) => k), created: [] };
  if (!o.apply || toSet.length === 0) return report;
  await port.create(entries.filter(([k]) => toSet.includes(k)).map(([k, v]) => ({ key: k, value: v, description: `Set by the owner decision of 5 November 2026 (${OWNER_WALLET_SETTINGS_SOURCE}). Staff can change it.` })));
  report.created = [...toSet]; report.toSet = [];
  return report;
}
