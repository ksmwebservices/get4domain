#!/usr/bin/env node
'use strict';
/**
 * Set up Step N Rock as a Workspace shop (handover dispatch 08-Oct-2026, Addendum A) — KSM runs this on the VM.
 *
 *   node scripts/set-vendor-access.js                  # DRY RUN (default): read-only, writes NOTHING
 *   SET_VENDOR_ACCESS_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/set-vendor-access.js --apply
 *
 * Changes ONLY the vendor with subdomain "stepnrock" (there is deliberately no option to name another vendor):
 *   addon workspace_menu ON · module website_manager ON · module telecrm ON · checkout mode ORDER_REQUEST
 * Payment keys, the Razorpay switch, every other module/addon and every other vendor are left untouched. Idempotent.
 * Run `set -a; . ./.env; set +a` first (or the script reads DATABASE_URL from backend-api/.env). Needs `npx nest build`.
 */
const path = require('path');
const fs = require('fs');
const { planAccess, applyAccess, readCurrent, ONLY_SUBDOMAIN, CONFIRM } = require('./set-vendor-access-lib');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));

const APPLY = process.argv.slice(2).includes('--apply');
const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 70 - s.length))}`); };

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

(async () => {
  if (process.argv.slice(2).some((a) => a.startsWith('--vendor') || a.startsWith('--subdomain'))) { console.error('This script only ever changes the "stepnrock" vendor; it takes no vendor argument.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (export it from backend-api/.env first).'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  line(`Step N Rock access setup — ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'} — database host: ${host}`);
  const { PrismaService } = dist('prisma/prisma.service');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const vendor = await prisma.vendor.findUnique({ where: { subdomain: ONLY_SUBDOMAIN }, select: { id: true, businessName: true, status: true, isSandbox: true } });
    if (!vendor) { console.error(`No vendor with subdomain "${ONLY_SUBDOMAIN}". Aborting.`); process.exitCode = 1; return; }
    head('Vendor');
    line(`${vendor.businessName} · ${vendor.status} · ${vendor.isSandbox ? 'SANDBOX' : 'live'} · id ${vendor.id}`);

    const plan = planAccess(await readCurrent(prisma, vendor.id));
    head('Plan');
    for (const c of plan.changes) line(`${c.needed ? '→ CHANGE ' : '  ok     '} ${c.kind.padEnd(12)} ${c.key.padEnd(18)} ${String(c.from)}  →  ${String(c.to)}`);
    line(plan.pending.length ? `\n${plan.pending.length} change(s) pending.` : '\nAlready set up — nothing to change.');

    if (!APPLY) {
      head('DRY RUN COMPLETE');
      line('Nothing was written.');
      if (plan.pending.length) line(`To apply:  SET_VENDOR_ACCESS_CONFIRM=${CONFIRM} node scripts/set-vendor-access.js --apply`);
      return;
    }
    if (process.env.SET_VENDOR_ACCESS_CONFIRM !== CONFIRM) { console.error(`\nABORT: set SET_VENDOR_ACCESS_CONFIRM=${CONFIRM} to confirm.`); process.exitCode = 2; return; }
    if (!plan.pending.length) { head('NOTHING TO DO'); return; }

    head('APPLY');
    await applyAccess(prisma, vendor.id, plan);
    const after = planAccess(await readCurrent(prisma, vendor.id));
    head('Result (read back from the database)');
    for (const c of after.changes) line(`${c.needed ? 'FAIL' : 'PASS'}  ${c.kind} ${c.key}`);
    if (after.pending.length) { process.exitCode = 1; line('\nCHECK FAILED.'); } else line('\nDONE — Suresh sees the Workspace menu after his next page load (sign out/in if it still shows the old one).');
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
