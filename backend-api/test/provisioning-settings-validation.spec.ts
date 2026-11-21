import { validateSettingValue } from '../src/plans/admin/admin-validation';

/** S53.7: the provisioning keys are editable through the existing plan-settings API (PUT /v3/admin/plan-settings/:key), and nothing else about it changed. */
describe('plan settings validator after slice 5.3', () => {
  it('accepts the eight provisioning keys with valid values', () => {
    for (const [k, v] of [
      ['provisioningRunnerEnabled', true], ['provisioningMaxAttempts', 5], ['provisioningBackoffSeconds', [30, 120]], ['claimLinkExpiryDays', 14],
      ['inviteAdapterMode', 'sandbox'], ['publicAppUrl', 'https://app.example.test'], ['inviteSubjectTemplate', 'Hello {{businessName}}'], ['inviteBodyTemplate', 'Open {{claimUrl}}'],
    ] as const) expect(() => validateSettingValue(k, v)).not.toThrow();
  });
  it('refuses bad values for them with the key in the message', () => {
    expect(() => validateSettingValue('claimLinkExpiryDays', 0)).toThrow(/claimLinkExpiryDays/);
    expect(() => validateSettingValue('inviteAdapterMode', 'both')).toThrow(/inviteAdapterMode/);
    expect(() => validateSettingValue('inviteBodyTemplate', 'no link')).toThrow(/claimUrl/);
  });
  it('the slice 5.1 keys behave exactly as before, and an unknown key is still refused', () => {
    expect(() => validateSettingValue('graceDays', 7)).not.toThrow();
    expect(() => validateSettingValue('graceDays', -1)).toThrow(/graceDays/);
    expect(() => validateSettingValue('baseMonthlyPaise.handyman_pro', 49900)).not.toThrow();
    expect(() => validateSettingValue('somethingElse', 1)).toThrow(/not a known plan setting/);
  });
});
