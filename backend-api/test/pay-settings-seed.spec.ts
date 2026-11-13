import { b3SettingProblem, DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { loadPaySettings, OWNER_PAY_SETTINGS, OWNER_PAY_SETTINGS_SOURCE, PaySettingsSeedPort } from '../src/v3-payments/settings/pay-settings-seed';

/** Amendment 09 W4: payLinkExpiryHours defaults to 48, loaded by an idempotent seed (dry run by default, --apply). */
class FakeSettings implements PaySettingsSeedPort {
  rows = new Map<string, { value: unknown; description: string }>(); writes = 0;
  async existing(keys: readonly string[]) { return keys.filter((k) => this.rows.has(k)); }
  async create(rows: ReadonlyArray<{ key: string; value: unknown; description: string }>) { this.writes++; for (const r of rows) this.rows.set(r.key, { value: r.value, description: r.description }); }
}
let store: FakeSettings; beforeEach(() => { store = new FakeSettings(); });

describe('the pay-link seed', () => {
  it('is 48 hours and nothing else, and passes the same validation staff input gets', () => {
    expect(OWNER_PAY_SETTINGS).toEqual({ payLinkExpiryHours: 48 }); expect(OWNER_PAY_SETTINGS_SOURCE).toBe('OWNER_DECISION_2026_11_11'); expect(b3SettingProblem('payLinkExpiryHours', 48)).toBeNull();
  });
  it('the code default stays unset (no invented default in code): only the seed supplies 48', () => { expect(DEFAULT_B3_SETTINGS.payLinkExpiryHours).toBeNull(); });
  it('a dry run writes nothing; apply sets it once with the owner source; a second run changes nothing', async () => {
    expect(await loadPaySettings(store, { apply: false })).toMatchObject({ applied: false, toSet: ['payLinkExpiryHours'], created: [] }); expect(store.writes).toBe(0);
    expect((await loadPaySettings(store, { apply: true })).created).toEqual(['payLinkExpiryHours']); expect(store.rows.get('payLinkExpiryHours')).toMatchObject({ value: 48, description: expect.stringContaining('OWNER_DECISION_2026_11_11') });
    expect(await loadPaySettings(store, { apply: true })).toMatchObject({ created: [], alreadySet: ['payLinkExpiryHours'] }); expect(store.writes).toBe(1);
  });
  it('never overwrites a value staff already set', async () => {
    store.rows.set('payLinkExpiryHours', { value: 72, description: 'staff' }); const r = await loadPaySettings(store, { apply: true });
    expect(r).toMatchObject({ created: [], alreadySet: ['payLinkExpiryHours'] }); expect(store.rows.get('payLinkExpiryHours')!.value).toBe(72); expect(store.writes).toBe(0);
  });
});
