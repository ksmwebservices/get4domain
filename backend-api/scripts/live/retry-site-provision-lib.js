'use strict';
/**
 * B6.4: the parts of the site-provision retry that can be tested without a database or a terminal.
 * `decide` says whether one named vendor may be retried and why not; `run` re-runs the site build through the SAME service the vendor's own retry route uses (RegistrationHook.createMySite,
 * behind POST /v3/me/site/create): the plan step is idempotent, the draft site and its address are reused, the build is reused when nothing changed, and a published site is not published twice.
 */

/** The provider keys that must never be present while a retry runs: a retry sends nothing, so every provider is made unreachable before the app starts. */
const PROVIDER_ENV = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY', 'MSG91_AUTH_KEY', 'MSG91_SENDER_ID', 'MSG91_WHATSAPP_NUMBER',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'FAST2SMS_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'STABILITY_API_KEY',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'META_ACCESS_TOKEN', 'RESELLERCLUB_API_KEY', 'WHATSAPP_BSP_API_KEY',
];

/** Removes every provider key and sets inert placeholders so the services can be constructed (some refuse to start without a key). Nothing can be sent with a placeholder. */
function makeProvidersInert(env) {
  for (const k of PROVIDER_ENV) delete env[k];
  env.EMAIL_MODE = 'test';
  env.RESEND_API_KEY = 're_inert_placeholder';
  env.RAZORPAY_KEY_ID = 'rzp_inert_placeholder';
  env.RAZORPAY_KEY_SECRET = 'inert_placeholder';
  return env;
}

/** The vendor may be retried only when it is a vendor account whose trial site is recorded as failed. Returns { ok, problem }. */
function decide(v) {
  if (!v) return { ok: false, problem: 'no vendor matches that e-mail or id' };
  if (v.role !== 'VENDOR') return { ok: false, problem: `that account is a ${String(v.role).toLowerCase()} account, not a vendor` };
  if (v.status === 'SUSPENDED') return { ok: false, problem: 'that vendor is suspended' };
  if (v.siteProvisionStatus !== 'FAILED') return { ok: false, problem: 'no failed site is recorded for that vendor (siteProvisionStatus is not FAILED), so there is nothing to retry' };
  return { ok: true, problem: null };
}

/** The dry-run lines: what a retry would do, without doing it. */
function dryLines(v, category) {
  return [
    `Vendor ${v.id}: site failed with code ${v.siteProvisionCode ?? '(none)'}${v.siteProvisionFailedAt ? ` at ${v.siteProvisionFailedAt.toISOString()}` : ''}.`,
    `Category "${v.industry ?? ''}": ${category === 'own' ? 'a kit design exists' : category === 'track-default' ? 'not a kit design; the neutral design of the track would be used' : category === 'none' ? 'NO design can be chosen: the build would fail again with PUBLISH_BLOCKED / CATEGORY' : 'not checked (the kit could not be loaded here)'}.`,
    'A retry would, in this order and reusing what exists: keep the free plan, keep the draft site and its address, build the site (reused if nothing changed), publish it if it is not already published.',
  ];
}

/**
 * Runs the retry. `hook` is the RegistrationHook; `prisma` reads the vendor's record afterwards. Returns { status, siteProvisionStatus, siteProvisionCode }.
 * The call is the one the vendor's own route makes; nothing is written here directly.
 */
async function run({ hook, prisma, vendorId }) {
  const answer = await hook.createMySite(vendorId);
  const after = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { siteProvisionStatus: true, siteProvisionCode: true } });
  return { status: answer.status, published: answer.published, siteProvisionStatus: after?.siteProvisionStatus ?? null, siteProvisionCode: after?.siteProvisionCode ?? null };
}

/** Builds the app context the retry needs from the compiled code: the registration hook with the real plan, provisioning, trial-site and site-publish services. No HTTP server is started. */
async function bootSiteApp(requireDist, requireNode) {
  const { Test } = requireNode('@nestjs/testing');
  const m = (p, n) => requireDist(p)[n];
  const globals = [
    ['b3-settings/b3-settings.module', 'B3SettingsModule'], ['v3-duplicates/duplicate-check.module', 'DuplicateCheckModule'], ['terms/terms.module', 'TermsModule'], ['v3-trust/trust.module', 'V3TrustModule'],
    ['v3-storage/storage.module', 'V3StorageModule'], ['seo-directory/seo-vendor-facts.module', 'SeoVendorFactsModule'], ['v3-mail/mail.module', 'V3MailModule'], ['v3-firm/firm.module', 'V3FirmModule'],
    ['v3-activity/activity.module', 'V3ActivityModule'], ['v3-admin-actions/admin-actions.module', 'V3AdminActionsModule'], ['v3-referrals/referrals.module', 'V3ReferralsModule'],
    ['messaging/messaging.module', 'MessagingModule'], ['v3-wallet/wallet.module', 'V3WalletModule'], ['plan-billing/payments-open.module', 'PaymentsOpenModule'],
  ].map(([p, n]) => m(p, n));
  const imports = [m('prisma/prisma.module', 'PrismaModule'), m('plans/plans.module', 'PlansModule'), m('v3-trial/trial.module', 'V3TrialModule'), m('provisioning/provisioning.module', 'ProvisioningModule'), m('site-publish/site-publish.module', 'SitePublishModule'), ...globals];
  const mod = await Test.createTestingModule({ imports }).compile();
  const app = mod.createNestApplication();
  await app.init();   // initialises the modules; it opens no port
  return { app, hook: app.get(m('plans/registration/registration.hook', 'RegistrationHook')), prisma: app.get(m('prisma/prisma.service', 'PrismaService')) };
}

module.exports = { PROVIDER_ENV, makeProvidersInert, decide, dryLines, run, bootSiteApp };
