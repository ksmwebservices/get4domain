/* Deletes synthetic test tenants (and everything the tests created for them) from the STAGING database.
 * A vendor is only ever deleted when BOTH markers match: email ends with @v3test.invalid AND businessName starts with V3TEST.
 * Pure module: the caller supplies the Prisma client (tests use the guarded staging client; the CLI below goes through the guard).
 * Order matters: children before parents (default FK behaviour is RESTRICT). Add a model here when a test starts creating it.
 */
const TEST_EMAIL_SUFFIX = '@v3test.invalid';
const TEST_NAME_PREFIX = 'V3TEST';
/** Provisioning tests (slice 5.3) key their jobs `v3test-<runId>-...`, so a job whose vendor step never ran is still found. */
const TEST_JOB_KEY_PREFIX = 'v3test-';

/** Slice 5.13a: a seeded vendor has a placeholder login (site+seed-<hex>@sites.get4domain.invalid), so it carries no run id in its e-mail; the run id is in its name. */
const SEEDED_EMAIL_SUFFIX = '@sites.get4domain.invalid';

/**
 * A vendor is a synthetic one only when BOTH markers match: a business name that starts with V3TEST, and either the test e-mail suffix (the run id, when given, in the e-mail) or the
 * seeded placeholder suffix (the run id, when given, in the name). A real seeded business never starts with V3TEST.
 */
async function findTestVendorIds(prisma, runId) {
  const named = { businessName: { startsWith: TEST_NAME_PREFIX } };
  const tenant = { AND: [{ email: { endsWith: TEST_EMAIL_SUFFIX } }, named, ...(runId ? [{ email: { contains: runId } }] : [])] };
  const seeded = { AND: [{ email: { endsWith: SEEDED_EMAIL_SUFFIX } }, { businessName: { startsWith: TEST_NAME_PREFIX, ...(runId ? { contains: runId } : {}) } }] };
  const rows = await prisma.vendor.findMany({ where: { OR: [tenant, seeded] }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function cleanupTestTenants(prisma, { runId } = {}) {
  const counts = { vendors: 0 };
  // Synthetic Get4Domain staff (S7 tests): not tied to any vendor, so they are removed first, by the same email marker.
  const staffWhere = { email: { endsWith: TEST_EMAIL_SUFFIX, ...(runId ? { contains: runId } : {}) } };
  const ids = await findTestVendorIds(prisma, runId);
  // S13 security ledgers (reset links, refresh tokens) point at accounts by id with no foreign key: remove them before the accounts.
  const staffIds = (await prisma.adminTeamMember.findMany({ where: staffWhere, select: { id: true } })).map((r) => r.id);
  const memberIds = ids.length ? (await prisma.teamMember.findMany({ where: { vendorId: { in: ids } }, select: { id: true } })).map((r) => r.id) : [];
  const accountIds = [...ids, ...staffIds, ...memberIds];
  if (accountIds.length) {
    counts.passwordResets = (await prisma.accountPasswordReset.deleteMany({ where: { accountId: { in: accountIds } } })).count;
    counts.refreshTokens = (await prisma.authRefreshToken.deleteMany({ where: { accountId: { in: accountIds } } })).count;
  }
  // Slice 5.11: AI providers and prompt versions have no foreign key; the synthetic staff that created them are known here, so they are matched by who created them.
  if (staffIds.length) {
    counts.v3AiProvider = (await prisma.v3AiProvider.deleteMany({ where: { createdByStaffId: { in: staffIds } } })).count;
    counts.v3AiPrompt = (await prisma.v3AiPrompt.deleteMany({ where: { createdByStaffId: { in: staffIds } } })).count;
  }
  counts.adminTeamMembers = (await prisma.adminTeamMember.deleteMany({ where: staffWhere })).count;
  await cleanupProvisioning(prisma, ids, runId, counts);
  if (!ids.length) return counts;
  const byVendor = { vendorId: { in: ids } };
  const steps = [
    ['callLogs', () => prisma.callLog.deleteMany({ where: byVendor })],
    ['campaignLeads', () => prisma.campaignLead.deleteMany({ where: byVendor })],
    ['campaignPages', () => prisma.campaignPage.deleteMany({ where: byVendor })],
    ['campaigns', () => prisma.campaign.deleteMany({ where: byVendor })],
    ['walletTransactions', () => prisma.walletTransaction.deleteMany({ where: byVendor })],
    ['wallets', () => prisma.wallet.deleteMany({ where: byVendor })],
    ['genericInvoices', () => prisma.genericInvoice.deleteMany({ where: byVendor })],
    ['records', () => prisma.record.deleteMany({ where: byVendor })],
    ['stockMovements', () => prisma.stockMovement.deleteMany({ where: byVendor })],
    ['vendorProducts', () => prisma.vendorProduct.deleteMany({ where: byVendor })],
    ['catalogItems', () => prisma.catalogItem.deleteMany({ where: byVendor })],
    ['contacts', () => prisma.contact.deleteMany({ where: byVendor })],
    ['notifications', () => prisma.notification.deleteMany({ where: { recipientId: { in: ids } } })],
    ['teamMembers', () => prisma.teamMember.deleteMany({ where: byVendor })],
    ['vendorPaymentConfigs', () => prisma.vendorPaymentConfig.deleteMany({ where: byVendor })],
    // the draft site the provisioning tests create (Vendor -> VendorCMS is RESTRICT, so it goes before the vendor)
    ['vendorCMS', () => prisma.vendorCMS.deleteMany({ where: byVendor })],
    ['vendors', () => prisma.vendor.deleteMany({ where: { id: { in: ids } } })],
  ];
  for (const [name, run] of steps) counts[name] = (await run()).count;
  return counts;
}

/** Slice 5.3: jobs (their steps cascade), invites and claim tokens of the test vendors, and the audit rows the tests caused. Audit rows have no foreign key, so they are matched by entity id. */
async function cleanupProvisioning(prisma, vendorIds, runId, counts) {
  const jobs = await prisma.v3ProvisioningJob.findMany({
    where: { OR: [...(vendorIds.length ? [{ vendorId: { in: vendorIds } }] : []), { idempotencyKey: { startsWith: `${TEST_JOB_KEY_PREFIX}${runId ?? ''}` } }] },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const tokens = vendorIds.length ? await prisma.v3ClaimToken.findMany({ where: { vendorId: { in: vendorIds } }, select: { id: true } }) : [];
  const tokenIds = tokens.map((t) => t.id);
  const directoryIds = await cleanupDirectory(prisma, vendorIds, tokenIds, runId, counts);
  const orderIds = await cleanupBilling(prisma, vendorIds, runId, counts);
  const entityIds = [...jobIds, ...tokenIds, ...vendorIds, ...directoryIds, ...orderIds];
  if (entityIds.length) counts.v3AuditLog = (await prisma.v3AuditLog.deleteMany({ where: { entityId: { in: entityIds } } })).count;
  if (vendorIds.length) {
    counts.v3Invite = (await prisma.v3Invite.deleteMany({ where: { vendorId: { in: vendorIds } } })).count;
    counts.v3ClaimToken = (await prisma.v3ClaimToken.deleteMany({ where: { vendorId: { in: vendorIds } } })).count;
  }
  if (jobIds.length) counts.v3ProvisioningJob = (await prisma.v3ProvisioningJob.deleteMany({ where: { id: { in: jobIds } } })).count;
}

/**
 * Slice 5.7: the synthetic directory data. Businesses are found by their vendor, or by a V3TEST name carrying the run id (a business made by staff has no vendor). Their services, media,
 * placements, removal requests and claim overrides cascade. OTP challenges point at claim tokens by id (no foreign key), and tests may add V3TEST places and categories, removed here
 * deepest first because the tree restricts deletes. Returns the ids whose audit rows must go too. Never touches the seeded (proposed) places and categories.
 */
async function cleanupDirectory(prisma, vendorIds, tokenIds, runId, counts) {
  const nameMatch = { name: { startsWith: TEST_NAME_PREFIX, ...(runId ? { contains: runId } : {}) } };
  const businesses = await prisma.v3DirectoryBusiness.findMany({ where: { OR: [...(vendorIds.length ? [{ vendorId: { in: vendorIds } }] : []), nameMatch] }, select: { id: true } });
  const businessIds = businesses.map((b) => b.id);
  const removals = businessIds.length ? await prisma.v3DirectoryRemovalRequest.findMany({ where: { businessId: { in: businessIds } }, select: { id: true } }) : [];
  if (tokenIds.length) counts.v3OtpChallenge = (await prisma.v3OtpChallenge.deleteMany({ where: { subjectType: 'CLAIM', subjectId: { in: tokenIds } } })).count;
  if (businessIds.length) counts.v3DirectoryBusiness = (await prisma.v3DirectoryBusiness.deleteMany({ where: { id: { in: businessIds } } })).count;
  counts.v3DirectoryCategory = 0; counts.v3DirectoryLocation = 0;
  for (let pass = 0; pass < 4; pass++) {
    const c = (await prisma.v3DirectoryCategory.deleteMany({ where: { ...nameMatch, children: { none: {} }, businesses: { none: {} } } })).count;
    const l = (await prisma.v3DirectoryLocation.deleteMany({ where: { ...nameMatch, children: { none: {} }, businesses: { none: {} } } })).count;
    counts.v3DirectoryCategory += c; counts.v3DirectoryLocation += l;
    if (!c && !l) break;
  }
  return [...businessIds, ...removals.map((r) => r.id)];
}

/**
 * Slice 5.1b: the payment events the tests caused (matched by their order, or by the run id they carry in the event id), and the audit rows of the test orders. The orders, invoices and reminder
 * log cascade from the vendor. NOTE: the invoice counter of the financial year is NOT rolled back (a gap-free counter must never go backwards); synthetic orders use up numbers on STAGING only.
 */
async function cleanupBilling(prisma, vendorIds, runId, counts) {
  const orders = vendorIds.length ? await prisma.v3PlanOrder.findMany({ where: { vendorId: { in: vendorIds } }, select: { id: true } }) : [];
  const orderIds = orders.map((o) => o.id);
  const or = [...(orderIds.length ? [{ orderId: { in: orderIds } }] : []), ...(runId ? [{ providerEventId: { contains: runId } }] : [])];
  if (or.length) counts.v3PaymentEvent = (await prisma.v3PaymentEvent.deleteMany({ where: { OR: or } })).count;
  return orderIds;
}

async function countTestTenants(prisma) {
  return (await findTestVendorIds(prisma)).length;
}

module.exports = { cleanupTestTenants, countTestTenants, findTestVendorIds, SEEDED_EMAIL_SUFFIX, TEST_EMAIL_SUFFIX, TEST_NAME_PREFIX, TEST_JOB_KEY_PREFIX };

// CLI: node scripts/staging/test-tenant-cleanup.js [--count]   (staging only, via the guard)
if (require.main === module) {
  (async () => {
    const path = require('path');
    const { loadStagingEnv } = require('./guard');
    const env = loadStagingEnv();
    const { PrismaClient } = require(path.join(__dirname, '../../node_modules/@prisma/client'));
    const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    try {
      if (process.argv.includes('--count')) { console.log(`synthetic test tenants on staging (includes seeded V3TEST vendors): ${await countTestTenants(prisma)}`); return; }
      console.log('deleted:', JSON.stringify(await cleanupTestTenants(prisma)));
    } catch (e) {
      console.error('ERROR:', env.mask(e.message).split('\n').slice(-2).join(' | '));
      process.exitCode = 1;
    } finally { await prisma.$disconnect(); }
  })();
}
