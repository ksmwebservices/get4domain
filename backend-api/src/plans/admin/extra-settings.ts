import { isDirectorySettingKey, validateDirectorySetting } from '../../directory/settings/directory-settings';
import { isDomainSettingKey, validateDomainSetting } from '../../site-domains/settings/domain-settings';
import { validateProvisioningSetting } from '../../provisioning/settings/provisioning-settings';

/**
 * The plan-settings vocabulary that lives outside the plans slice. Each slice registers its keys here, so the one editing API (PUT /v3/admin/plan-settings/:key)
 * validates all of them and still refuses any key nobody registered. Add a slice = add one line.
 */
const EXTRA: Array<{ owns: (key: string) => boolean; validate: (key: string, value: unknown) => void }> = [
  { owns: isDomainSettingKey, validate: validateDomainSetting },   // slice 5.6
  { owns: isDirectorySettingKey, validate: validateDirectorySetting },   // slice 5.7
];

export function validateExtraSetting(key: string, value: unknown): void {
  const hit = EXTRA.find((e) => e.owns(key));
  if (hit) { hit.validate(key, value); return; }
  validateProvisioningSetting(key, value);   // slices 5.3 and 5.4; an unknown key is refused there: "<key>: is not a known plan setting"
}
