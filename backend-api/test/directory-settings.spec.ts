import { BadRequestException } from '@nestjs/common';
import { validateSettingValue } from '../src/plans/admin/admin-validation';
import { DEFAULT_DIRECTORY_SETTINGS, DIRECTORY_SETTING_KEYS, directorySettingProblem, resolveDirectorySettings } from '../src/directory/settings/directory-settings';
import { DEFAULT_PROVISIONING_SETTINGS, PROVISIONING_SETTING_KEYS, provisioningSettingProblem } from '../src/provisioning/settings/provisioning-settings';

/** Slice 5.7 settings: editable through the existing plan-settings API, with documented defaults. */
describe('directory settings', () => {
  it('defaults match the dispatch: sandbox SMS, 10 minute expiry, 5 attempts, unclaimed pages noindex, a hard page-size cap', () => {
    expect(DEFAULT_DIRECTORY_SETTINGS).toMatchObject({ smsAdapterMode: 'sandbox', otpExpiryMinutes: 10, otpMaxAttempts: 5, directoryIndexUnclaimed: false, directoryPageSizeMax: 50 });
    expect(DEFAULT_DIRECTORY_SETTINGS.directoryPageSizeDefault).toBeLessThanOrEqual(DEFAULT_DIRECTORY_SETTINGS.directoryPageSizeMax);
    expect(DIRECTORY_SETTING_KEYS).toHaveLength(15);
  });
  it.each([
    ['directoryPageSizeMax', 50, true], ['directoryPageSizeMax', 101, false], ['directoryPageSizeMax', 0, false], ['directorySponsoredEvery', 5, true], ['directorySponsoredEvery', 0, false],
    ['directoryIndexUnclaimed', true, true], ['directoryIndexUnclaimed', 'yes', false], ['otpMaxAttempts', 5, true], ['otpMaxAttempts', 11, false], ['otpExpiryMinutes', 0, false],
    ['smsAdapterMode', 'live', true], ['smsAdapterMode', 'sandbox', true], ['smsAdapterMode', 'both', false], ['accountSetupGrantMinutes', 30, true], ['removalLinkExpiryDays', 14, true], ['removalLinkExpiryDays', 400, false],
    ['directoryCacheSeconds', 0, true], ['directoryCacheSeconds', -1, false], ['otpResendCooldownSeconds', 60, true], ['directoryThinPageMinBusinesses', 3, true], ['directoryMinDescriptionChars', 2.5, false],
  ] as Array<[Parameters<typeof directorySettingProblem>[0], unknown, boolean]>)('%s = %j -> %s', (key, value, ok) => { expect(directorySettingProblem(key, value) === null).toBe(ok); });
  it('a default page size above the cap falls back to the cap', () => {
    const r = resolveDirectorySettings(new Map<string, unknown>([['directoryPageSizeDefault', 80], ['directoryPageSizeMax', 30]]));
    expect(r.directoryPageSizeDefault).toBe(30); expect(r.directoryPageSizeMax).toBe(30);
  });
  it('invalid stored values are ignored', () => { expect(resolveDirectorySettings(new Map<string, unknown>([['otpMaxAttempts', 'many']])).otpMaxAttempts).toBe(5); });
  it('the existing plan-settings validator accepts these keys and still refuses unknown ones; earlier slices keep working', () => {
    expect(() => validateSettingValue('otpMaxAttempts', 5)).not.toThrow();
    expect(() => validateSettingValue('smsAdapterMode', 'nope')).toThrow(BadRequestException);
    expect(() => validateSettingValue('notAKey', 1)).toThrow(/is not a known plan setting/);
    expect(() => validateSettingValue('wwwPolicy', 'apex')).not.toThrow(); expect(() => validateSettingValue('siteDraftBuilderMode', 'legacy')).not.toThrow();
  });
});

describe('provisioningDirectoryProfileEnabled (the optional step switch, a provisioning setting)', () => {
  it('exists, defaults to false, and accepts only true or false', () => {
    expect(PROVISIONING_SETTING_KEYS).toContain('provisioningDirectoryProfileEnabled'); expect(DEFAULT_PROVISIONING_SETTINGS.provisioningDirectoryProfileEnabled).toBe(false);
    expect(provisioningSettingProblem('provisioningDirectoryProfileEnabled', true)).toBeNull(); expect(provisioningSettingProblem('provisioningDirectoryProfileEnabled', 'on')).not.toBeNull();
    expect(() => validateSettingValue('provisioningDirectoryProfileEnabled', true)).not.toThrow();
  });
});
