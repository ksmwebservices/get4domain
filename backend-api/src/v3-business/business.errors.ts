import { ACCOUNTS_ERROR_CODES } from '../v3-accounts/accounts.errors';
import { JOBS_ERROR_CODES } from '../v3-jobs/jobs.errors';
import { APPT_ERROR_CODES } from '../v3-appointments/appointments.errors';
import { STORE_ERROR_CODES } from '../v3-store/store.errors';
import { SUPPORT_ERROR_CODES } from '../v3-support/support.errors';
import { MAIL_ERROR_CODES } from '../v3-mail/mail.errors';
import { STORAGE_ERROR_CODES } from '../v3-storage/storage.errors';
import { CUSTOMER_ERROR_CODES } from '../v3-customers/customers.errors';

/**
 * Every error code the Batch 13 business modules put in an HTTP error body, in one list. The exception filter passes a `code` through only when it is on a registered list (the lesson of the
 * Stage 13 and Stage 15 staging runs), so each slice adds its list here and `b13-wire.spec.ts` fails if a module throws a code that is not on it.
 */
export const BUSINESS_ERROR_CODES: readonly string[] = [...CUSTOMER_ERROR_CODES, ...ACCOUNTS_ERROR_CODES, ...JOBS_ERROR_CODES, ...APPT_ERROR_CODES, ...STORAGE_ERROR_CODES, ...MAIL_ERROR_CODES, ...SUPPORT_ERROR_CODES, ...STORE_ERROR_CODES];
