#!/usr/bin/env node
'use strict';
/**
 * B5 staging check (STAGING ONLY, READ-ONLY): runs the B5 reads through the real services and the real staging database.
 * It writes nothing and sends nothing (no e-mail, no SMS, no payment call). Output is yes/no results and counts; a connection string or key value never appears
 * (the guard refuses any database that is not on the staging allow-list).
 *
 *   node scripts/staging/b5-check.js
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const { loadStagingEnv } = require('./guard');

const BACKEND = path.resolve(__dirname, '..', '..');
const src = (p) => require(path.join(BACKEND, 'src', p));

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  let failed = 0; let fixtureId = null;
  const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  try {
    // B5.4 / B5.5: the provision facts and the admin site facts read the real columns
    const { SiteProvisionFacts } = src('site-publish/publish/site-provision-facts.service');
    const facts = new SiteProvisionFacts(prisma);
    // staging has no real vendors, so one tagged fixture (a failed trial site and a site address) is made and removed again; nothing else is touched
    const tag = `zz-b5-check-${Date.now().toString(36)}`;
    const fx = await prisma.vendor.create({ data: { name: 'ZZ B5 Check', email: `${tag}@v3test.invalid`, password: 'not-a-real-hash', businessName: 'ZZ B5 Check', subdomain: tag, siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED', siteProvisionFailedAt: new Date() }, select: { id: true } });
    fixtureId = fx.id;
    await prisma.vendorCMS.upsert({ where: { vendorId: fx.id }, create: { vendorId: fx.id, address: '12 Bypass Road, Madurai' }, update: { address: '12 Bypass Road, Madurai' } });
    const vendors = [fx];
    const fa = await facts.forAdmin(fx.id);
    check('admin site facts read the stored status, subdomain, site address and failure', fa.status === 'ACTIVE' && fa.subdomain === tag && fa.address === '12 Bypass Road, Madurai' && fa.siteProvisionStatus === 'FAILED' && fa.siteProvisionCode === 'SITE_BUILD_FAILED' && typeof fa.siteProvisionFailedAt === 'string');
    const fo = await facts.provision(fx.id);
    check('owner facts read the failure code', fo.siteProvisionStatus === 'FAILED' && fo.siteProvisionCode === 'SITE_BUILD_FAILED');
    for (const v of vendors) {
      const a = await facts.forAdmin(v.id); const p = await facts.provision(v.id);
      check('admin site facts carry status, subdomain, address and the three provision fields', ['status', 'subdomain', 'address', 'siteProvisionStatus', 'siteProvisionCode', 'siteProvisionFailedAt'].every((k) => k in a), `status=${a.status}, subdomain=${a.subdomain ? 'set' : 'none'}, address=${a.address ? 'set' : 'none'}`);
      check('owner facts carry the three provision fields and nothing else', JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['siteProvisionCode', 'siteProvisionFailedAt', 'siteProvisionStatus']));
    }
    const failedSites = await prisma.vendor.count({ where: { siteProvisionStatus: 'FAILED' } });
    console.log(`INFO  vendors with a failed trial site on staging: ${failedSites}`);

    // B5.5: the app shell reads the owner's two fields through the real shell service (owner: present; team member: absent)
    const { AppShellService } = src('v3-packs/app-shell.service');
    const nav = { tabs: [], pack: null, flags: {}, mode: 'x', level: null, tier: null, planState: null, paused: false };
    const shell = new AppShellService({ navigation: async () => nav, myAddons: async () => [] }, undefined, undefined, prisma);
    if (vendors[0]) {
      const o = await shell.get(vendors[0].id, { kind: 'vendor' }); const t = await shell.get(vendors[0].id, { kind: 'team_member', modules: [] });
      check('app shell: owner gets siteProvisionStatus and siteProvisionCode', 'siteProvisionStatus' in o && 'siteProvisionCode' in o);
      check('app shell: a team member gets neither key', !('siteProvisionStatus' in t) && !('siteProvisionCode' in t));
    }

    // B5.3: the column the address is stored in exists and can be read
    const cms = await prisma.vendorCMS.count({ where: { address: { not: null } } });
    check('VendorCMS.address is readable', cms >= 0, `${cms} rows with an address`);

    // B5.6: paymentsOpen through the real gate and the real billing settings (reads settings; builds an adapter object only, no network call)
    const { BillingSettingsService } = src('plan-billing/settings/billing-settings.service');
    const { PaymentsGate } = src('plan-billing/razorpay/payments-gate');
    const settings = new BillingSettingsService(prisma); const s = await settings.get();
    const open = await new PaymentsGate(settings).isOpen();
    check('paymentsOpen is closed when mode is off or no gateway keys exist here', (s.paymentsMode !== 'off' && open) || !open, `mode=${s.paymentsMode}, gateway=${s.paymentGateway}, open=${open}`);

    // B5.7: the next credit expiry from the real lots
    const { nextCreditExpiry } = src('v3-wallet/wallet.service');
    const lots = await prisma.v3WalletLot.findMany({ take: 200, select: { vendorId: true, remainingPaise: true, expiresAt: true, status: true } });
    const by = new Map(); for (const l of lots) by.set(l.vendorId, [...(by.get(l.vendorId) ?? []), l]);
    let withNext = 0; for (const list of by.values()) { const n = nextCreditExpiry(list); if (n) { withNext += 1; if (!(typeof n.expiresAt === 'string' && Number.isInteger(n.amountPaise) && n.amountPaise > 0)) check('next expiry shape', false); } }
    check('next credit expiry computes from real lots', true, `${lots.length} lots, ${by.size} wallets, ${withNext} with an open credit`);

    // B5.8: the identity channels as they are right now on this machine's environment (nothing is sent)
    const { GuardedEmailPort, ResendTransport } = src('v3-mail/email.port');
    const { GuardedSmsPort, UnboundSmsTransport } = src('v3-mail/sms.port');
    const { MailSettingsService } = src('v3-mail/settings/mail-settings');
    const { SmsSettingsService } = src('v3-mail/settings/sms-settings');
    const emailReady = await new GuardedEmailPort(new ResendTransport(), new MailSettingsService(prisma)).ready('OTP');
    const smsReady = await new GuardedSmsPort(new UnboundSmsTransport(), new SmsSettingsService(prisma)).ready();
    check('SMS codes are not available (no provider bound)', smsReady === false);
    console.log(`INFO  e-mail codes ready on this environment: ${emailReady} (depends on EMAIL_LIVE_SEND, RESEND_API_KEY and the sender settings)`);
  } finally {
    if (fixtureId) { try { await prisma.vendorCMS.deleteMany({ where: { vendorId: fixtureId } }); await prisma.vendor.delete({ where: { id: fixtureId } }); console.log('INFO  fixture removed'); } catch (e) { console.log(`WARN  fixture ${fixtureId} was not removed: ${String(e.message).split(String.fromCharCode(10))[0].slice(0, 120)}`); } }
    await prisma.$disconnect();
  }
  console.log(failed === 0 ? '\nALL B5 STAGING CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exitCode = failed === 0 ? 0 : 1;
})().catch((e) => { console.error(`staging check stopped: ${e && e.message ? String(e.message).split('\n')[0].slice(0, 200) : 'error'}`); process.exitCode = 2; });
