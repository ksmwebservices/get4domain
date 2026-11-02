/* Deletes synthetic test tenants (and everything the tests created for them) from the STAGING database.
 * A vendor is only ever deleted when BOTH markers match: email ends with @v3test.invalid AND businessName starts with V3TEST.
 * Pure module: the caller supplies the Prisma client (tests use the guarded staging client; the CLI below goes through the guard).
 * Order matters: children before parents (default FK behaviour is RESTRICT). Add a model here when a test starts creating it.
 */
const TEST_EMAIL_SUFFIX = '@v3test.invalid';
const TEST_NAME_PREFIX = 'V3TEST';

async function findTestVendorIds(prisma, runId) {
  const and = [{ email: { endsWith: TEST_EMAIL_SUFFIX } }, { businessName: { startsWith: TEST_NAME_PREFIX } }];
  if (runId) and.push({ email: { contains: runId } });
  const rows = await prisma.vendor.findMany({ where: { AND: and }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function cleanupTestTenants(prisma, { runId } = {}) {
  const ids = await findTestVendorIds(prisma, runId);
  const counts = { vendors: 0 };
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
    ['vendors', () => prisma.vendor.deleteMany({ where: { id: { in: ids } } })],
  ];
  for (const [name, run] of steps) counts[name] = (await run()).count;
  return counts;
}

async function countTestTenants(prisma) {
  return (await findTestVendorIds(prisma)).length;
}

module.exports = { cleanupTestTenants, countTestTenants, TEST_EMAIL_SUFFIX, TEST_NAME_PREFIX };

// CLI: node scripts/staging/test-tenant-cleanup.js [--count]   (staging only, via the guard)
if (require.main === module) {
  (async () => {
    const path = require('path');
    const { loadStagingEnv } = require('./guard');
    const env = loadStagingEnv();
    const { PrismaClient } = require(path.join(__dirname, '../../node_modules/@prisma/client'));
    const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    try {
      if (process.argv.includes('--count')) { console.log(`synthetic test tenants on staging: ${await countTestTenants(prisma)}`); return; }
      console.log('deleted:', JSON.stringify(await cleanupTestTenants(prisma)));
    } catch (e) {
      console.error('ERROR:', env.mask(e.message).split('\n').slice(-2).join(' | '));
      process.exitCode = 1;
    } finally { await prisma.$disconnect(); }
  })();
}
