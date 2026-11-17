/* Pure parts of the staging smoke kit (seed, local API launcher, probe). No database, no network, no file reads here, so unit tests can pin every rule.
 *
 * What the kit is for: front-end lanes need a REAL local API on STAGING with throwaway logins (vendor, admin, partner apps and the public site with mocks off).
 * Every row it makes is named so the existing synthetic cleanup (scripts/staging/test-tenant-cleanup.js) removes it: e-mail ends @v3test.invalid, business name starts V3TEST.
 * Passwords are random, made at run time, and written ONLY to a file outside every repository. Nothing in this module prints or returns a password except `makePassword` and `buildUsersFile`.
 */
const crypto = require('crypto');
const path = require('path');

const TEST_EMAIL_SUFFIX = '@v3test.invalid';
const TEST_NAME_PREFIX = 'V3TEST';
/** A fixed tag in every smoke e-mail: `--reset` hands it to the cleanup as the run id, so it removes only what the seed made (the cleanup matches `email contains <tag>`). */
const SMOKE_TAG = 'smoke';
const SMOKE_DIR = 'C:\\Get4Domain\\smoke';
const USERS_FILE_NAME = 'users.json';
const REFERRAL_CODE = 'SMKTEST2';

/** role key -> how it is made. `kind`: staff (admin-team row), partner (admin-team login + partner row), vendor (vendor row with a site). */
const USER_SPECS = Object.freeze([
  { key: 'superAdmin', kind: 'staff', adminRole: 'SUPER_ADMIN', label: 'super-admin' },
  { key: 'admin', kind: 'staff', adminRole: 'ADMIN', label: 'admin' },
  { key: 'sales', kind: 'staff', adminRole: 'MARKETING', label: 'sales' },       // SALES is stored as MARKETING
  { key: 'operations', kind: 'staff', adminRole: 'OPERATIONS', label: 'operations' },
  { key: 'partner', kind: 'partner', adminRole: 'REFERRAL_PARTNER', label: 'partner' },
  { key: 'vendorFree', kind: 'vendor', plan: 'handyman_free', subdomain: 'smoke-free-site', label: 'vendor-free' },
  { key: 'vendorPaid', kind: 'vendor', plan: 'handyman_pro', subdomain: 'smoke-paid-site', label: 'vendor-paid' },
]);

const emailFor = (label) => `${SMOKE_TAG}-${label}${TEST_EMAIL_SUFFIX}`;
/** The partner's own record carries a second address (the login row and the partner row are separate, and each e-mail is unique). */
const partnerRecordEmail = () => `${SMOKE_TAG}-partner-record${TEST_EMAIL_SUFFIX}`;
const businessNameFor = (label) => `${TEST_NAME_PREFIX} ${SMOKE_TAG} ${label}`;

/** Every address the seed owns (used by --reset's own check and by tests). */
function allSmokeEmails() {
  const out = USER_SPECS.map((u) => emailFor(u.label));
  out.push(partnerRecordEmail());
  return out;
}

/** True only for an address the seed itself would make. */
const isSmokeEmail = (email) => typeof email === 'string' && email.endsWith(TEST_EMAIL_SUFFIX) && email.startsWith(`${SMOKE_TAG}-`);

/** A random password of 24 characters from an unambiguous alphabet, with at least one of each class, so it passes any reasonable rule. Never derived from anything. */
function makePassword(randomBytes = crypto.randomBytes) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower = 'abcdefghijkmnpqrstuvwxyz', digit = '23456789', all = upper + lower + digit;
  const pick = (set, b) => set[b % set.length];
  const bytes = randomBytes(24);
  const chars = [];
  for (let i = 0; i < 21; i++) chars.push(pick(all, bytes[i]));
  chars.push(pick(upper, bytes[21]), pick(lower, bytes[22]), pick(digit, bytes[23]));
  // shuffle (Fisher-Yates over fresh random bytes) so the guaranteed classes are not always last
  const sh = randomBytes(chars.length);
  for (let i = chars.length - 1; i > 0; i--) { const j = sh[i] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

/** Why the seed (or --reset) must refuse to run, or null. Pure: the caller says whether the staging guard passed. */
function seedRefusal({ stagingGuardPassed, argv = [], env = {}, usersFile, repoRoot }) {
  if (!stagingGuardPassed) return 'the staging guard did not pass';
  if (env.NODE_ENV === 'production') return 'NODE_ENV is production';
  if (env.V3_LIVE === 'true') return 'V3_LIVE is true';
  const allowed = new Set(['--reset']);
  const unknown = argv.filter((a) => !allowed.has(a));
  if (unknown.length) return `unknown argument: ${unknown[0]}`;
  const out = outputPathRefusal(usersFile, repoRoot);
  if (out) return out;
  return null;
}

/** The credentials file must sit outside every repository: never inside the repo root or under a `.git` ancestor path, and it must be the fixed name. */
function outputPathRefusal(file, repoRoot) {
  if (!file) return 'no users file path';
  const resolved = path.resolve(file);
  if (path.basename(resolved) !== USERS_FILE_NAME) return `the users file must be named ${USERS_FILE_NAME}`;
  if (repoRoot) {
    const rel = path.relative(path.resolve(repoRoot), resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return 'the users file must be outside the repository';
  }
  if (resolved.split(path.sep).some((p) => p.toLowerCase() === '.git')) return 'the users file must not be inside a .git folder';
  return null;
}

/** Why the local API launcher must refuse to start, or null. */
function apiRefusal({ stagingGuardPassed, env = {}, existingEnvFiles = [] }) {
  if (!stagingGuardPassed) return 'the staging guard did not pass';
  if (env.NODE_ENV === 'production') return 'NODE_ENV is production';
  if (env.V3_LIVE === 'true') return 'V3_LIVE is true';
  if (existingEnvFiles.length) return `${existingEnvFiles.join(' and ')} exists in the backend folder: the app would load it, and it may point at a real database or real providers`;
  return null;
}

/** Variables that would let the API reach a real provider; removed from the child environment (same list as test/support/staging-env.ts, plus the gateway live flag set to false). */
const PROVIDER_ENV = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY',
  'MSG91_AUTH_KEY', 'MSG91_SENDER_ID', 'MSG91_WHATSAPP_NUMBER', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
  'FAST2SMS_API_KEY', 'FAST2SMS_SENDER_ID', 'FAST2SMS_ENTITY_ID', 'FAST2SMS_SMS_MESSAGE_ID', 'FAST2SMS_WA_MESSAGE_ID',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'STABILITY_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'META_APP_ID', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'RESELLERCLUB_API_KEY',
  'RUNWAY_API_KEY', 'HEYGEN_API_KEY', 'KLING_API_KEY', 'WHATSAPP_BSP_API_KEY', 'CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY',
  'RAZORPAY_TEST_KEY_ID', 'RAZORPAY_TEST_KEY_SECRET', 'RAZORPAY_TEST_WEBHOOK_SECRET', 'RAZORPAY_LIVE_KEY_ID', 'RAZORPAY_LIVE_KEY_SECRET', 'RAZORPAY_LIVE_WEBHOOK_SECRET',
  'CASHFREE_TEST_APP_ID', 'CASHFREE_TEST_SECRET_KEY', 'CASHFREE_LIVE_APP_ID', 'CASHFREE_LIVE_SECRET_KEY',
];
/** The legacy payment service builds its Razorpay client at start-up and the SDK refuses an empty key. The app itself treats a value starting with "placeholder" as NOT configured (assertRazorpayConfigured), so these two stand in. They are not keys. */
const PLACEHOLDER_GATEWAY_ENV = Object.freeze({ RAZORPAY_KEY_ID: 'placeholder-smoke-kit', RAZORPAY_KEY_SECRET: 'placeholder-smoke-kit' });

const DEFAULT_ORIGINS = Object.freeze(['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176']);

/**
 * The environment the local API runs with: the parent's variables minus every provider variable, plus the staging database, a random JWT secret, mail captured, gateways off, schedulers off,
 * throttling off (six sign-ins in a row), strict CORS naming the front-end dev origins. `jwtSecret` is passed in so a test can check it never leaks into the printed summary.
 */
function buildApiEnv({ parentEnv, staging, port, origins, jwtSecret }) {
  const env = { ...parentEnv };
  for (const k of PROVIDER_ENV) delete env[k];
  Object.assign(env, {
    DATABASE_URL: staging.DATABASE_URL, DIRECT_URL: staging.DIRECT_URL,
    JWT_SECRET: jwtSecret, NODE_ENV: 'development', EMAIL_MODE: 'test', THROTTLE_DISABLED: 'true', LEADSPACE_SCHEDULER: 'off',
    PLAN_PAYMENTS_LIVE_ENABLED: 'false', PORT: String(port), HOST: '127.0.0.1',
    CORS_MODE: 'strict', CORS_EXTRA_ORIGINS: origins.join(','),
    FRONTEND_URL: origins[0], PUBLIC_APP_URL: origins[0], PUBLIC_API_URL: `http://localhost:${port}`, SITE_BASE_DOMAIN: 'localhost',
  });
  Object.assign(env, PLACEHOLDER_GATEWAY_ENV);
  delete env.V3_LIVE;
  if (staging.PLATFORM_SETTINGS_KEY) env.PLATFORM_SETTINGS_KEY = staging.PLATFORM_SETTINGS_KEY; else delete env.PLATFORM_SETTINGS_KEY;
  return env;
}

/** The names (never values) of the variables the launcher sets: what SMOKE_RUN.md and the summary may show. */
const API_ENV_NAMES = Object.freeze(['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'NODE_ENV', 'EMAIL_MODE', 'THROTTLE_DISABLED', 'LEADSPACE_SCHEDULER', 'PLAN_PAYMENTS_LIVE_ENABLED', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'PORT', 'HOST', 'CORS_MODE', 'CORS_EXTRA_ORIGINS', 'FRONTEND_URL', 'PUBLIC_APP_URL', 'PUBLIC_API_URL', 'SITE_BASE_DOMAIN', 'PLATFORM_SETTINGS_KEY']);

/** Parses `--port 3008` and `--origins a,b` (the only launcher flags). Returns { port, origins } or { error }. */
function parseApiArgs(argv) {
  let port = 3008; let origins = [...DEFAULT_ORIGINS];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') { port = Number(argv[++i]); if (!Number.isInteger(port) || port < 1024 || port > 65535) return { error: 'invalid --port (1024 to 65535)' }; }
    else if (argv[i] === '--origins') {
      const list = String(argv[++i] ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
      if (!list.length || list.some((o) => !/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(o))) return { error: 'invalid --origins (comma list of http://localhost:<port>)' };
      origins = list;
    } else return { error: `unknown argument: ${argv[i]}` };
  }
  return { port, origins };
}

/** Replaces every secret in a text with ***, longest first. Used on every line the kit prints. */
function redact(text, secrets) {
  const list = [...new Set((secrets || []).filter((s) => typeof s === 'string' && s.length >= 4))].sort((a, b) => b.length - a.length);
  return list.reduce((acc, s) => acc.split(s).join('***'), String(text));
}

/** The users.json content. `created` maps spec key -> { id, email, password, ... }. The only place a password is written. */
function buildUsersFile(created, meta = {}) {
  const users = {};
  for (const spec of USER_SPECS) {
    const c = created[spec.key];
    if (!c) continue;
    users[spec.key] = { role: spec.kind === 'partner' ? 'PARTNER' : spec.kind === 'vendor' ? 'VENDOR' : spec.adminRole, kind: spec.kind, email: c.email, password: c.password, id: c.id, ...(c.subdomain ? { subdomain: c.subdomain } : {}), ...(c.plan ? { plan: c.plan } : {}) };
  }
  return { note: 'Throwaway STAGING logins made by scripts/staging/smoke-seed.js. Never commit. Removed by test:cleanup-staging.', generatedAt: meta.generatedAt || new Date().toISOString(), referralCode: meta.referralCode || null, users };
}

/** What the seed may print: roles, e-mail addresses and ids. Never a password. */
function summaryLines(created) {
  return USER_SPECS.filter((s) => created[s.key]).map((s) => `${s.key.padEnd(11)} ${created[s.key].email}  id=${created[s.key].id}${created[s.key].plan ? `  plan=${created[s.key].plan}` : ''}`);
}

module.exports = {
  TEST_EMAIL_SUFFIX, TEST_NAME_PREFIX, SMOKE_TAG, SMOKE_DIR, USERS_FILE_NAME, REFERRAL_CODE, USER_SPECS, PROVIDER_ENV, PLACEHOLDER_GATEWAY_ENV, DEFAULT_ORIGINS, API_ENV_NAMES,
  emailFor, partnerRecordEmail, businessNameFor, allSmokeEmails, isSmokeEmail, makePassword,
  seedRefusal, outputPathRefusal, apiRefusal, buildApiEnv, parseApiArgs, redact, buildUsersFile, summaryLines,
};
