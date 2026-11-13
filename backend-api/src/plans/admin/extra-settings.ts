import { isDirectorySettingKey, validateDirectorySetting } from '../../directory/settings/directory-settings';
import { isAiSettingKey, validateAiSetting } from '../../ai-studio/settings/ai-settings';
import { isBillingSettingKey, validateBillingSetting } from '../../plan-billing/settings/billing-settings';
import { isDomainSettingKey, validateDomainSetting } from '../../site-domains/settings/domain-settings';
import { isB3SettingKey, validateB3Setting } from '../../b3-settings/b3-settings';
import { isWalletSettingKey, validateWalletSetting } from '../../v3-wallet/settings/wallet-settings';
import { isWebsiteSettingKey, validateWebsiteSetting } from '../../v3-website/settings/website-settings';
import { isAutomationSettingKey, validateAutomationSetting } from '../../v3-domain-automation/settings/automation-settings';
import { isRegistrarSettingKey, validateRegistrarSetting } from '../../v3-registrar/settings/registrar-settings';
import { isStorageSettingKey, validateStorageSetting } from '../../v3-storage/settings/storage-settings';
import { isMailSettingKey, validateMailSetting } from '../../v3-mail/settings/mail-settings';
import { isSmsSettingKey, validateSmsSetting } from '../../v3-mail/settings/sms-settings';
import { isSupportSettingKey, validateSupportSetting } from '../../v3-support/settings/support-settings';
import { isAdminActionsSettingKey, validateAdminActionsSetting } from '../../v3-admin-actions/settings/admin-actions-settings';
import { validateProvisioningSetting } from '../../provisioning/settings/provisioning-settings';

/**
 * The plan-settings vocabulary that lives outside the plans slice. Each slice registers its keys here, so the one editing API (PUT /v3/admin/plan-settings/:key)
 * validates all of them and still refuses any key nobody registered. Add a slice = add one line.
 */
const EXTRA: Array<{ owns: (key: string) => boolean; validate: (key: string, value: unknown) => void }> = [
  { owns: isDomainSettingKey, validate: validateDomainSetting },   // slice 5.6
  { owns: isDirectorySettingKey, validate: validateDirectorySetting },   // slice 5.7
  { owns: isBillingSettingKey, validate: validateBillingSetting },   // slice 5.1b
  { owns: isAiSettingKey, validate: validateAiSetting },   // slice 5.11
  // batch 3 (5.1d to 5.14). seededSiteIndexingMode is NOT owned here: it can only be changed by its own SUPER_ADMIN route with a required reason (SeededSettingsService)
  { owns: (k: string) => isB3SettingKey(k) && k !== 'seededSiteIndexingMode', validate: validateB3Setting },
  // batch 4 (5.16a onwards): wallet limits, credit validity and the settings of the services built on it. Editing needs SUPER_ADMIN like every plan setting.
  { owns: isWalletSettingKey, validate: validateWalletSetting },
  // batch 9 (5.5b onwards): the Website manager's media caps and the limits of the slices built on it; every number starts unset
  { owns: isWebsiteSettingKey, validate: validateWebsiteSetting },
  // batch 11 (5.6c): own-domain automation; every value starts unset
  { owns: isAutomationSettingKey, validate: validateAutomationSetting },
  // batch 11 (5.6d): domain sales; every value starts unset and a feature that needs one stays off until staff set it
  { owns: isRegistrarSettingKey, validate: validateRegistrarSetting },
  // block 4b (Amendment 12 Q2): storage endpoints, buckets, media domain and limits; keys stay in the environment; every value starts unset
  { owns: isStorageSettingKey, validate: validateStorageSetting },
  // block 4b (Amendment 12 Q3 and Q5): lane 1 sender and the enquiry inbox limits; every value starts unset
  { owns: isMailSettingKey, validate: validateMailSetting },
  // block 4b (Amendment 12 Q7): DLT entity id, sender id and the registered templates; every value starts unset
  { owns: isSmsSettingKey, validate: validateSmsSetting },
  // block 4b (Amendment 08 B5): support ticket creation limits; every value starts unset
  { owns: isSupportSettingKey, validate: validateSupportSetting },
  // block 4b (Amendment 09 A4): merging listings stays off until the undo window is set; unset by default
  { owns: isAdminActionsSettingKey, validate: validateAdminActionsSetting },
];

export function validateExtraSetting(key: string, value: unknown): void {
  const hit = EXTRA.find((e) => e.owns(key));
  if (hit) { hit.validate(key, value); return; }
  validateProvisioningSetting(key, value);   // slices 5.3 and 5.4; an unknown key is refused there: "<key>: is not a known plan setting"
}
