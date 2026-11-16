import { ACCOUNTS_ERROR_CODES } from '../v3-accounts/accounts.errors';
import { JOBS_ERROR_CODES } from '../v3-jobs/jobs.errors';
import { APPT_ERROR_CODES } from '../v3-appointments/appointments.errors';
import { STORE_ERROR_CODES } from '../v3-store/store.errors';
import { ADMIN_ACTION_ERROR_CODES } from '../v3-admin-actions/admin-actions.errors';
import { PARTNER_ERROR_CODES } from '../v3-partners/partners.errors';
import { THEME_CATALOG_ERROR_CODES } from '../v3-theme-catalog/theme-catalog.errors';
import { SUPPORT_ERROR_CODES } from '../v3-support/support.errors';
import { MAIL_ERROR_CODES } from '../v3-mail/mail.errors';
import { STORAGE_ERROR_CODES } from '../v3-storage/storage.errors';
import { CUSTOMER_ERROR_CODES } from '../v3-customers/customers.errors';
import { PACK_ERROR_CODES } from '../v3-packs/pack.errors';
import { FIRM_ERROR_CODES } from '../v3-firm/firm.errors';
import { HANDOFF_ERROR_CODES } from '../account-security/handoff.errors';
import { PACK_RECORD_ERROR_CODES } from '../v3-pack-records/pack-records.errors';
import { VENDOR_GAP_ERROR_CODES } from '../v3-vendor-gaps/vendor-gaps.errors';
import { ADMIN_GAP_ERROR_CODES } from '../v3-admin-gaps/admin-gaps.errors';
import { MEDIA_UPLOAD_ERROR_CODES } from '../v3-media-upload/media-upload.errors';
import { PROFILE_ERROR_CODES } from '../v3-profile-fields/profile.errors';
import { IMPORT_ERROR_CODES } from '../v3-listing-import/listing-import.errors';

/**
 * Every error code the Batch 13 business modules put in an HTTP error body, in one list. The exception filter passes a `code` through only when it is on a registered list (the lesson of the
 * Stage 13 and Stage 15 staging runs), so each slice adds its list here and `b13-wire.spec.ts` fails if a module throws a code that is not on it.
 */
export const BUSINESS_ERROR_CODES: readonly string[] = [...CUSTOMER_ERROR_CODES, ...ACCOUNTS_ERROR_CODES, ...JOBS_ERROR_CODES, ...APPT_ERROR_CODES, ...STORE_ERROR_CODES, ...PACK_ERROR_CODES, ...FIRM_ERROR_CODES, ...HANDOFF_ERROR_CODES, ...PACK_RECORD_ERROR_CODES, ...VENDOR_GAP_ERROR_CODES, ...ADMIN_GAP_ERROR_CODES, ...MEDIA_UPLOAD_ERROR_CODES, ...PROFILE_ERROR_CODES, ...IMPORT_ERROR_CODES, ...STORAGE_ERROR_CODES, ...MAIL_ERROR_CODES, ...SUPPORT_ERROR_CODES, ...ADMIN_ACTION_ERROR_CODES, ...PARTNER_ERROR_CODES, ...THEME_CATALOG_ERROR_CODES];
