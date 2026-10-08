'use strict';
/**
 * Dashboard v2 switch for ONE vendor (Release 1A). Called from set-vendor-access.js when --nav-v2 is given.
 *
 *   node scripts/set-vendor-access.js --nav-v2 on  --vendor <subdomain>            # DRY RUN (default, writes nothing)
 *   SET_VENDOR_ACCESS_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/set-vendor-access.js --nav-v2 on --vendor <subdomain> --apply
 *   (use "off" to put the vendor back on the previous dashboard)
 *
 * Changes ONLY the nav_v2 add-on of the named vendor: no module, payment setting, term or data is touched.
 */
const path = require('path');
const { planNavV2, readNavV2, applyNavV2, CONFIRM } = require('./set-vendor-access-lib');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));
const line = (s = '') => console.log(s);
const head = (s) => { line(); line('── ' + s + ' ' + '─'.repeat(Math.max(0, 70 - s.length))); };

async function navV2Mode(argv) {
  const APPLY = argv.includes('--apply');
  const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const want = argOf('--nav-v2');
  const sub = argOf('--vendor');
  if (want !== 'on' && want !== 'off') { console.error('--nav-v2 must be "on" or "off".'); process.exit(2); }
  if (!sub || sub.startsWith('--')) { console.error('--vendor <subdomain> is required with --nav-v2 (one vendor at a time).'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (export it from backend-api/.env first).'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  line('Dashboard v2 switch — ' + (APPLY ? 'APPLY' : 'DRY RUN (read-only)') + ' — database host: ' + host);
  const { PrismaService } = dist('prisma/prisma.service');
  const { NAV_V2_DEFAULT_FROM } = dist('addons/addons.constants');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const vendor = await prisma.vendor.findUnique({ where: { subdomain: sub }, select: { id: true, businessName: true, status: true, isSandbox: true } });
    if (!vendor) { console.error('No vendor with subdomain "' + sub + '". Aborting.'); process.exitCode = 1; return; }
    head('Vendor');
    line(vendor.businessName + ' · ' + vendor.status + ' · ' + (vendor.isSandbox ? 'SANDBOX' : 'live') + ' · id ' + vendor.id);
    const plan = planNavV2(await readNavV2(prisma, vendor.id, NAV_V2_DEFAULT_FROM), want === 'on');
    head('Plan');
    for (const c of plan.changes) line((c.needed ? '→ CHANGE ' : '  ok     ') + ' ' + c.kind.padEnd(8) + ' ' + c.key.padEnd(8) + ' ' + String(c.from) + '  →  ' + String(c.to));
    line(plan.pending.length ? '\n1 change pending. Nothing else (modules, payments, data) is touched.' : '\nAlready set — nothing to change.');
    if (!APPLY) {
      head('DRY RUN COMPLETE');
      line('Nothing was written.');
      if (plan.pending.length) line('To apply:  SET_VENDOR_ACCESS_CONFIRM=' + CONFIRM + ' node scripts/set-vendor-access.js --nav-v2 ' + want + ' --vendor ' + sub + ' --apply');
      return;
    }
    if (process.env.SET_VENDOR_ACCESS_CONFIRM !== CONFIRM) { console.error('\nABORT: set SET_VENDOR_ACCESS_CONFIRM=' + CONFIRM + ' to confirm.'); process.exitCode = 2; return; }
    if (!plan.pending.length) { head('NOTHING TO DO'); return; }
    head('APPLY');
    await applyNavV2(prisma, vendor.id, plan);
    const after = planNavV2(await readNavV2(prisma, vendor.id, NAV_V2_DEFAULT_FROM), want === 'on');
    head('Result (read back from the database)');
    line(after.pending.length ? 'FAIL  nav_v2' : 'PASS  nav_v2');
    if (after.pending.length) process.exitCode = 1;
    else line('\nDONE — ' + vendor.businessName + ' sees the ' + (want === 'on' ? 'new department dashboard' : 'previous dashboard') + ' after the next page load (sign out/in if it still shows the other one).');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { navV2Mode };
