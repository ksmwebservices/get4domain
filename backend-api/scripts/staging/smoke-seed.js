/* Staging smoke seed. STAGING ONLY, through the staging guard.
 *
 *   node scripts/staging/smoke-seed.js            creates (or refreshes) the throwaway logins and writes C:\Get4Domain\smoke\users.json
 *   node scripts/staging/smoke-seed.js --reset    removes ONLY what this seed made (the e-mails carry the fixed tag "smoke"), and the users file
 *
 * Idempotent: running it again finds the same rows and gives each login a NEW random password (the file is rewritten). Passwords are made at run time and written only to the users file, which must
 * sit outside every repository. Nothing printed here contains a password, a token or a connection string.
 * Every row is named for the existing synthetic cleanup (e-mail @v3test.invalid, business name V3TEST ...), so `npm run test:cleanup-staging` removes it too.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const lib = require('./smoke-lib');

const BACKEND = path.resolve(__dirname, '../..');
const USERS_FILE = process.env.SMOKE_USERS_FILE || path.join(lib.SMOKE_DIR, lib.USERS_FILE_NAME);

/** Staff rows (g4d_admin_team_members): one per role. */
async function upsertStaff(prisma, spec, password) {
  const email = lib.emailFor(spec.label);
  const data = { name: `${lib.TEST_NAME_PREFIX} smoke ${spec.label}`, role: spec.adminRole, status: 'active', password: await bcrypt.hash(password, 10), passwordChangedAt: null };
  const row = await prisma.adminTeamMember.upsert({ where: { email }, create: { email, ...data }, update: data });
  return { id: row.id, email };
}

/** A referral partner: the login row (role REFERRAL_PARTNER), the partner record linked to it, and one active link with a fixed code. */
async function upsertPartner(prisma, spec, password) {
  const login = await upsertStaff(prisma, spec, password);
  const email = lib.partnerRecordEmail();
  const name = `${lib.TEST_NAME_PREFIX} smoke partner`;
  const partner = await prisma.referralPartner.upsert({ where: { email }, create: { type: 'FREELANCER', name, email, staffUserId: login.id }, update: { name, status: 'ACTIVE', staffUserId: login.id } });
  const link = await prisma.referralLink.findUnique({ where: { code: lib.REFERRAL_CODE } });
  if (!link) await prisma.referralLink.create({ data: { partnerId: partner.id, code: lib.REFERRAL_CODE } });
  else if (link.partnerId === partner.id && !link.active) await prisma.referralLink.update({ where: { id: link.id }, data: { active: true, disabledAt: null } });
  return { ...login, partnerId: partner.id };
}

/** A vendor with a draft trial site on a subdomain and a plan subscription. The paid one is a staff-source Pro subscription row: no gateway, no order, no invoice. */
async function upsertVendor(prisma, spec, password, notes) {
  const email = lib.emailFor(spec.label);
  const businessName = lib.businessNameFor(spec.label);
  const hash = await bcrypt.hash(password, 10);
  const base = { name: `${lib.TEST_NAME_PREFIX} smoke ${spec.label}`, businessName, industry: 'plumber', subdomain: spec.subdomain, phone: '+919876500000', status: 'ACTIVE', source: 'STAFF', isSandbox: false };
  const vendor = await prisma.vendor.upsert({ where: { email }, create: { email, password: hash, ...base }, update: { password: hash, passwordChangedAt: null, status: 'ACTIVE' } });
  if (!(await prisma.vendorCMS.findUnique({ where: { vendorId: vendor.id } }))) {
    await prisma.vendorCMS.create({ data: { vendorId: vendor.id, siteStatus: 'DRAFT', businessName, tagline: 'Leaks fixed fast, every time.', about: 'We explain the work before we start. Fair and on time.', address: '12 Test Road, Chennai 600001', phone: '+919876500000' } });
  }
  if (!(await prisma.vendorProduct.findFirst({ where: { vendorId: vendor.id } }))) {
    await prisma.vendorProduct.create({ data: { vendorId: vendor.id, name: `${lib.TEST_NAME_PREFIX} tap repair`, description: 'Fix a leaking tap.', price: '300', active: true } });
  }
  // a business category (the vendor's pack), so the profile and tab routes have something to answer: a plumber-like handyman category, else the first handyman-tier one
  const cat = (await prisma.v3PackCategory.findFirst({ where: { minTier: 'HANDYMAN', categoryKey: { contains: 'plumb' } } })) || (await prisma.v3PackCategory.findFirst({ where: { minTier: 'HANDYMAN' }, orderBy: { categoryKey: 'asc' } }));
  if (!cat) notes.push(`${spec.key}: no handyman category on staging, so the vendor has no category`);
  else await prisma.v3VendorPack.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id, packKey: cat.packKey, categoryKey: cat.categoryKey, setByType: 'STAFF' }, update: {} });
  const plan = await prisma.v3Plan.findUnique({ where: { key: spec.plan } });
  let planUsed = null;
  if (!plan) notes.push(`${spec.key}: plan ${spec.plan} is not on staging, so the vendor has no plan subscription`);
  else if (plan.status === 'RETIRED') notes.push(`${spec.key}: plan ${spec.plan} is retired, no subscription made`);
  else if (!(await prisma.v3PlanSubscription.findFirst({ where: { vendorId: vendor.id } }))) {
    const pro = plan.level !== 'FREE'; const now = new Date();
    await prisma.$transaction(async (tx) => {
      const sub = await tx.v3PlanSubscription.create({ data: { vendorId: vendor.id, planId: plan.id, status: 'ACTIVE', termMonths: pro ? 3 : null, startsAt: now, endsAt: pro ? new Date(now.getTime() + 92 * 86_400_000) : null, source: pro ? 'STAFF' : 'REGISTRATION', createdByType: 'SYSTEM', currentVendorId: vendor.id, priceSnapshotJson: { planKey: plan.key, termMonths: pro ? 3 : null, amountPaise: 0, currency: 'INR', capturedAt: now.toISOString(), note: 'smoke kit: no payment' } } });
      await tx.v3SubscriptionEvent.create({ data: { subscriptionId: sub.id, vendorId: vendor.id, type: pro ? 'ASSIGNED' : 'FREE_PROVISIONED', toPlanId: plan.id, reason: 'smoke kit seed', actorType: 'SYSTEM' } });
    });
    planUsed = plan.key;
  } else {
    const cur = await prisma.v3PlanSubscription.findFirst({ where: { vendorId: vendor.id }, include: { plan: true } });
    planUsed = cur?.plan?.key ?? null;
  }
  return { id: vendor.id, email, subdomain: spec.subdomain, plan: planUsed };
}

async function seed(prisma) {
  const created = {}; const notes = [];
  for (const spec of lib.USER_SPECS) {
    const password = lib.makePassword();
    const r = spec.kind === 'staff' ? await upsertStaff(prisma, spec, password) : spec.kind === 'partner' ? await upsertPartner(prisma, spec, password) : await upsertVendor(prisma, spec, password, notes);
    created[spec.key] = { ...r, password };
  }
  return { created, notes };
}

async function main() {
  const argv = process.argv.slice(2);
  // The guard exits with code 3 for anything but the allow-listed staging project; a plain "not passed" is reported by the refusal rule for the cases it can see.
  const { loadStagingEnv, REPO_ROOT } = require('./guard');
  const refusalBefore = lib.seedRefusal({ stagingGuardPassed: true, argv, env: process.env, usersFile: USERS_FILE, repoRoot: REPO_ROOT });
  if (refusalBefore) { console.error(`SMOKE SEED REFUSED: ${refusalBefore}`); process.exit(2); }
  const env = loadStagingEnv();
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    if (argv.includes('--reset')) {
      const cleanup = require('./test-tenant-cleanup');
      const counts = await cleanup.cleanupTestTenants(prisma, { runId: lib.SMOKE_TAG });
      if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
      console.log(`smoke users removed. vendors=${counts.vendors ?? 0} staff=${counts.adminTeamMembers} partners=${counts.referralPartners ?? 0}; users file removed.`);
      return;
    }
    const { created, notes } = await seed(prisma);
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(lib.buildUsersFile(created, { referralCode: lib.REFERRAL_CODE }), null, 2) + '\n', { mode: 0o600 });
    const secrets = Object.values(created).map((c) => c.password);
    for (const line of lib.summaryLines(created)) console.log(env.mask(lib.redact(line, secrets)));
    for (const n of notes) console.log(`note: ${n}`);
    console.log(`referral code: ${lib.REFERRAL_CODE}`);
    console.log(`logins written to ${USERS_FILE} (outside every repo; passwords are not printed).`);
  } catch (e) {
    console.error('SMOKE SEED ERROR:', env.mask(lib.redact(String(e && e.message ? e.message : e), [])).split('\n').slice(-3).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}

module.exports = { seed, upsertStaff, upsertPartner, upsertVendor };
if (require.main === module) main();
