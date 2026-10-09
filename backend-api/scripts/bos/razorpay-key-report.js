#!/usr/bin/env node
'use strict';
// READ-ONLY report (Full BOS, Bug B2): which vendors have a Razorpay Key ID that is not shaped like rzp_test_... / rzp_live_...
// Writes NOTHING and edits NOTHING. KSM decides what to do with the list. Run on the VM:
//   node scripts/bos/razorpay-key-report.js
// Needs `npx nest build` and DATABASE_URL (reads backend-api/.env if it is not exported).
const path = require('path');
const fs = require('fs');

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
const KEY_SHAPE = /^rzp_(test|live)_[A-Za-z0-9]{6,}$/;

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
  const { PrismaService } = require(path.join(__dirname, '..', '..', 'dist', 'src', 'prisma', 'prisma.service'));
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const rows = await prisma.vendorPaymentConfig.findMany({ where: { razorpayKeyId: { not: null } }, select: { vendorId: true, razorpayKeyId: true, enabled: true, checkoutMode: true } });
    const bad = [];
    for (const r of rows) {
      if (KEY_SHAPE.test(String(r.razorpayKeyId))) continue;
      const v = await prisma.vendor.findUnique({ where: { id: r.vendorId }, select: { businessName: true, subdomain: true, email: true } });
      const val = String(r.razorpayKeyId);
      // Show the SHAPE, not the value: an e-mail is masked, anything else is shown as its first 6 characters.
      const looksLikeEmail = val.includes('@');
      bad.push({ vendor: v?.businessName ?? r.vendorId, subdomain: v?.subdomain ?? '', whatItLooksLike: looksLikeEmail ? 'an e-mail address' : `${val.slice(0, 6)}… (${val.length} characters)`, onlinePaymentSwitchedOn: r.enabled });
    }
    console.log(`Vendors with a Razorpay Key ID saved: ${rows.length}`);
    console.log(`Not shaped like rzp_test_… / rzp_live_…: ${bad.length}`);
    for (const b of bad) console.log(` - ${b.vendor} (${b.subdomain}): ${b.whatItLooksLike}; online payment switched on: ${b.onlinePaymentSwitchedOn}`);
    console.log('\nNothing was changed. Decide per vendor; the Payments screen now refuses a wrong value and stops the browser filling it in.');
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
