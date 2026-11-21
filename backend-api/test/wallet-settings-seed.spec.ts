import * as fs from 'fs';
import * as path from 'path';
import { topupAmountProblem } from '../src/v3-wallet/core/wallet-core';
import { isWalletSettingKey, resolveWalletSettings, walletSettingProblem } from '../src/v3-wallet/settings/wallet-settings';
import { loadWalletSettings, OWNER_WALLET_SETTINGS, OWNER_WALLET_SETTINGS_SOURCE, WalletSettingsSeedPort } from '../src/v3-wallet/settings/wallet-settings-seed';

/**
 * The owner's wallet settings loader (5 November 2026): ONE value, the refill minimum of Rs 999 (99900 paise). Everything else the owner has not decided stays unset, so the wallet refuses to
 * take a refill and the services refuse to take a request until staff set it. Idempotent, a dry run unless told to apply, and it never overwrites a value staff already set.
 */
class FakeSettings implements WalletSettingsSeedPort {
  rows = new Map<string, { value: unknown; description: string }>(); audits: Array<{ key: string; value: unknown }> = []; writes = 0;
  async existing(keys: readonly string[]) { return keys.filter((k) => this.rows.has(k)); }
  async create(rows: ReadonlyArray<{ key: string; value: unknown; description: string }>) { this.writes++; for (const r of rows) { this.rows.set(r.key, { value: r.value, description: r.description }); this.audits.push({ key: r.key, value: r.value }); } }
}
let store: FakeSettings;
beforeEach(() => { store = new FakeSettings(); });
const stored = (): Map<string, unknown> => new Map([...store.rows].map(([k, v]) => [k, v.value]));

describe('what the owner decided', () => {
  it('is the refill minimum and nothing else', () => {
    expect(OWNER_WALLET_SETTINGS).toEqual({ walletTopupMinPaise: 99_900 }); expect(OWNER_WALLET_SETTINGS_SOURCE).toBe('OWNER_DECISION_2026_11_05');
    for (const [k, v] of Object.entries(OWNER_WALLET_SETTINGS)) { expect(isWalletSettingKey(k)).toBe(true); expect(walletSettingProblem(k as never, v)).toBeNull(); }
  });
  it('leaves every setting the owner did not decide unset: the maximum, the seller state, the revision limit, auto-approval, the credit validity', () => {
    for (const k of ['walletTopupMaxPaise', 'walletSellerStateCode', 'serviceMaxRevisions', 'serviceAutoApproveEnabled', 'serviceAutoApproveAfterDays', 'walletCreditValidityDays', 'walletReceiptPrefix', 'walletExpiryTickEnabled']) expect(Object.keys(OWNER_WALLET_SETTINGS)).not.toContain(k);
  });
});

describe('the loader', () => {
  it('a dry run writes nothing and says what it would set', async () => {
    const r = await loadWalletSettings(store, { apply: false });
    expect(r).toMatchObject({ applied: false, toSet: ['walletTopupMinPaise'], alreadySet: [], created: [] }); expect(store.writes).toBe(0); expect(store.rows.size).toBe(0);
  });
  it('apply sets the minimum to 99900 and audits it with the owner source', async () => {
    const r = await loadWalletSettings(store, { apply: true });
    expect(r.created).toEqual(['walletTopupMinPaise']); expect(store.rows.get('walletTopupMinPaise')!.value).toBe(99_900);
    expect(store.rows.get('walletTopupMinPaise')!.description).toContain('OWNER_DECISION_2026_11_05'); expect(store.audits).toEqual([{ key: 'walletTopupMinPaise', value: 99_900 }]);
  });
  it('runs twice without changing anything', async () => {
    await loadWalletSettings(store, { apply: true }); const again = await loadWalletSettings(store, { apply: true });
    expect(again).toMatchObject({ created: [], alreadySet: ['walletTopupMinPaise'], toSet: [] }); expect(store.writes).toBe(1);
  });
  it('never overwrites a value staff already set, even a different one', async () => {
    store.rows.set('walletTopupMinPaise', { value: 150_000, description: 'staff' });
    const r = await loadWalletSettings(store, { apply: true });
    expect(r.created).toEqual([]); expect(r.alreadySet).toEqual(['walletTopupMinPaise']); expect(store.rows.get('walletTopupMinPaise')!.value).toBe(150_000);
  });
  it('after the loader a refill is STILL refused (the maximum is not set) and requests are still off: the loader enables nothing', async () => {
    await loadWalletSettings(store, { apply: true });
    const s = resolveWalletSettings(stored());
    expect(s.walletTopupMinPaise).toBe(99_900); expect(s.walletTopupMaxPaise).toBeNull(); expect(s.walletSellerStateCode).toBe(''); expect(s.serviceMaxRevisions).toBeNull(); expect(s.serviceAutoApproveEnabled).toBe(false);
    expect(topupAmountProblem(150_000, s.walletTopupMinPaise, s.walletTopupMaxPaise)).toBe('NOT_CONFIGURED');
  });
  it('once staff add a maximum, 99900 is accepted and 99899 is below the minimum', async () => {
    await loadWalletSettings(store, { apply: true });
    const s = resolveWalletSettings(new Map([...stored(), ['walletTopupMaxPaise', 5_000_000]]));
    expect(topupAmountProblem(99_900, s.walletTopupMinPaise, s.walletTopupMaxPaise)).toBeNull(); expect(topupAmountProblem(99_899, s.walletTopupMinPaise, s.walletTopupMaxPaise)).toBe('BELOW_MINIMUM');
  });
});

describe('the script', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../scripts/seed-v3-wallet-settings.js'), 'utf8');
  it('is a dry run unless --apply is given, runs the staging guard and prints no connection string', () => {
    expect(script).toMatch(/const APPLY = process\.argv\.slice\(2\)\.includes\('--apply'\)/); expect(script).toMatch(/loadStagingEnv\(\)/); expect(script).toMatch(/env\.mask\(/); expect(script).toMatch(/OWNER_WALLET_SETTINGS_SOURCE/);
  });
});
