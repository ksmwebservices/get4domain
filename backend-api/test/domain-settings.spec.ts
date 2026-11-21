import { BadRequestException } from '@nestjs/common';
import { validateSettingValue } from '../src/plans/admin/admin-validation';
import { DEFAULT_DOMAIN_SETTINGS, DOMAIN_SETTING_KEYS, domainSettingProblem, resolveDomainSettings } from '../src/site-domains/settings/domain-settings';

/** Slice 5.6 settings: editable through the existing plan-settings API, with documented defaults. */
describe('domain settings', () => {
  it('the vocabulary is fixed', () => {
    expect([...DOMAIN_SETTING_KEYS].sort()).toEqual([
      'baseDomain', 'blockedSubdomainWords', 'domainDnsLiveChecks', 'domainMaxPerVendor', 'domainVerifyMaxAttempts', 'domainVerifyMinIntervalSeconds', 'reservedSubdomains',
      'subdomainChangeLimitPerPeriod', 'subdomainChangePeriodDays', 'subdomainMaxLength', 'subdomainMinLength', 'verificationTxtPrefix', 'wwwPolicy',
    ]);
  });
  it('defaults: live DNS checks are OFF, apex is primary, a sensible length window, the technical names are reserved, no profanity list is invented', () => {
    expect(DEFAULT_DOMAIN_SETTINGS.domainDnsLiveChecks).toBe(false);
    expect(DEFAULT_DOMAIN_SETTINGS.wwwPolicy).toBe('apex');
    expect(DEFAULT_DOMAIN_SETTINGS.subdomainMinLength).toBeLessThan(DEFAULT_DOMAIN_SETTINGS.subdomainMaxLength);
    for (const r of ['www', 'admin', 'api', 'mail', 'login']) expect(DEFAULT_DOMAIN_SETTINGS.reservedSubdomains).toContain(r);
    expect(DEFAULT_DOMAIN_SETTINGS.blockedSubdomainWords).toEqual([]);
    expect(DEFAULT_DOMAIN_SETTINGS.verificationTxtPrefix).toBe('_g4d-verify');
  });
  it.each([
    ['subdomainMinLength', 3, true], ['subdomainMinLength', 0, false], ['subdomainMinLength', 2.5, false], ['subdomainMaxLength', 63, true], ['subdomainMaxLength', 64, false],
    ['subdomainChangeLimitPerPeriod', 0, true], ['subdomainChangeLimitPerPeriod', 51, false], ['subdomainChangePeriodDays', 365, true], ['subdomainChangePeriodDays', 0, false],
    ['wwwPolicy', 'apex', true], ['wwwPolicy', 'www', true], ['wwwPolicy', 'both', false], ['domainDnsLiveChecks', true, true], ['domainDnsLiveChecks', 'yes', false],
    ['baseDomain', 'get4domain.com', true], ['baseDomain', 'Get4Domain.com', false], ['baseDomain', 'localhost', false], ['baseDomain', 'a/b.com', false],
    ['verificationTxtPrefix', '_g4d-verify', true], ['verificationTxtPrefix', 'bad prefix', false], ['verificationTxtPrefix', '', false],
    ['reservedSubdomains', ['www', 'api'], true], ['reservedSubdomains', ['WWW'], false], ['reservedSubdomains', ['has space'], false], ['reservedSubdomains', 'www', false], ['reservedSubdomains', Array.from({ length: 501 }, (_, i) => `n${i}`), false],
    ['blockedSubdomainWords', ['abc'], true], ['blockedSubdomainWords', [], true], ['blockedSubdomainWords', [1], false],
    ['domainVerifyMinIntervalSeconds', 30, true], ['domainVerifyMinIntervalSeconds', -1, false], ['domainVerifyMaxAttempts', 50, true], ['domainVerifyMaxAttempts', 0, false],
  ] as Array<[Parameters<typeof domainSettingProblem>[0], unknown, boolean]>)('%s = %j -> %s', (key, value, ok) => { expect(domainSettingProblem(key, value) === null).toBe(ok); });

  it('min length may not exceed max length once resolved (a bad pair falls back to the defaults)', () => {
    const r = resolveDomainSettings(new Map<string, unknown>([['subdomainMinLength', 20], ['subdomainMaxLength', 10]]));
    expect(r.subdomainMinLength).toBe(DEFAULT_DOMAIN_SETTINGS.subdomainMinLength);
    expect(r.subdomainMaxLength).toBe(DEFAULT_DOMAIN_SETTINGS.subdomainMaxLength);
  });
  it('resolve overlays valid stored values on the defaults and ignores invalid ones', () => {
    const r = resolveDomainSettings(new Map<string, unknown>([['wwwPolicy', 'www'], ['subdomainMaxLength', 'huge'], ['domainDnsLiveChecks', true]]));
    expect(r.wwwPolicy).toBe('www'); expect(r.subdomainMaxLength).toBe(DEFAULT_DOMAIN_SETTINGS.subdomainMaxLength); expect(r.domainDnsLiveChecks).toBe(true);
  });
  it('the existing plan-settings validator accepts these keys, refuses bad values, and still refuses unknown keys', () => {
    expect(() => validateSettingValue('wwwPolicy', 'www')).not.toThrow();
    expect(() => validateSettingValue('wwwPolicy', 'x')).toThrow(BadRequestException);
    expect(() => validateSettingValue('subdomainMinLength', 3)).not.toThrow();
    expect(() => validateSettingValue('definitelyNotAKey', 1)).toThrow(/is not a known plan setting/);
    expect(() => validateSettingValue('siteDraftBuilderMode', 'renderer')).not.toThrow();   // slice 5.3 and 5.4 keys keep working
  });
});
