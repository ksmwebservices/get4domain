/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * MUST be the first import of every *.int.spec.ts. It:
 *  1. runs the staging guard (exits with code 3 unless the connection is the allow-listed staging project, never production),
 *  2. points DATABASE_URL / DIRECT_URL at staging for this process,
 *  3. sets a throw-away JWT secret and REMOVES every third-party provider credential from the environment, so a test can
 *     never send an email/SMS/WhatsApp message or call a payment/AI provider by accident.
 * The tests build a slim Nest module (no ConfigModule), so `.env.local` (which points at production) is never loaded.
 */
import * as crypto from 'crypto';

const guard = require('../../scripts/staging/guard');

const staging = guard.loadStagingEnv();
process.env.DATABASE_URL = staging.DATABASE_URL;
process.env.DIRECT_URL = staging.DIRECT_URL;
process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'test';        // EmailService captures mail in EmailService.outbox instead of calling the provider
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const PROVIDER_ENV = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY',
  'MSG91_AUTH_KEY', 'MSG91_SENDER_ID', 'MSG91_WHATSAPP_NUMBER', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
  'FAST2SMS_API_KEY', 'FAST2SMS_SENDER_ID', 'FAST2SMS_ENTITY_ID', 'FAST2SMS_SMS_MESSAGE_ID', 'FAST2SMS_WA_MESSAGE_ID',
  'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'STABILITY_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'META_APP_ID', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'RESELLERCLUB_API_KEY',
  'RUNWAY_API_KEY', 'HEYGEN_API_KEY', 'KLING_API_KEY', 'WHATSAPP_BSP_API_KEY',
];
for (const k of PROVIDER_ENV) delete process.env[k];

/** One id per jest process; appears in every synthetic tenant's email so cleanup can target exactly this run. */
export const RUN_ID = `r${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
export const mask: (text: string) => string = staging.mask;
