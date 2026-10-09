#!/usr/bin/env node
'use strict';
/**
 * Full BOS spine backfill - KSM runs this on the VM.
 *
 *   node scripts/bos-spine-backfill.js                         # DRY RUN for every vendor: reads only, writes NOTHING
 *   node scripts/bos-spine-backfill.js --vendor <subdomain>    # dry run for one vendor
 *   node scripts/bos-spine-backfill.js --vendor <subdomain> --apply     # write it for that one vendor
 *   node scripts/bos-spine-backfill.js --apply                 # write it for every vendor (do one vendor at a time first)
 *
 * Opening balances only: opening stock at cost, and what customers still owe on old invoices. It invents no old invoices,
 * changes no product, quantity or contact detail, and is safe to run twice. Order of rollout: ksm-webtech-services, then stepnrock.
 * Reads DATABASE_URL from the environment or backend-api/.env. Needs `npx nest build` first.
 */
const path = require('path');
const fs = require('fs');
const { planVendor, applyVendor, pickVendors } = require('./bos-spine-backfill-lib');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const vi = args.indexOf('--vendor');
const SLUG = vi >= 0 ? args[vi + 1] : undefined;
if (vi >= 0 && (!SLUG || SLUG.startsWith('--'))) { console.error('--vendor needs a subdomain, for example: --vendor stepnrock'); process.exit(2); }

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }

const inr = (p) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let code = 0;
  try {
    const vendors = await pickVendors(prisma, SLUG);
    if (!vendors.length) { console.log(SLUG ? `No vendor with the subdomain "${SLUG}".` : 'No vendors to backfill.'); return; }
    console.log(APPLY ? 'APPLY: writing opening balances.' : 'DRY RUN: nothing is written. Add --apply to write.');
    for (const v of vendors) {
      const plan = await planVendor(prisma, v);
      console.log(`\n${v.subdomain ?? v.id}`);
      console.log(`  BOS settings: ${plan.hasSettings ? 'already there' : 'will be created'}`);
      console.log(`  Opening stock: ${plan.stockAlreadyPosted ? 'already posted' : `${plan.stockItems} item(s) worth Rs ${inr(plan.stockPaise)} at cost${plan.trackedWithoutCost ? ` (${plan.trackedWithoutCost} tracked item(s) have no purchase price and are skipped)` : ''}`}`);
      console.log(`  Customers owing on old invoices: ${plan.receivables.length} totalling Rs ${inr(plan.receivablesPaise)}`);
      if (APPLY) {
        const r = await applyVendor(prisma, plan);
        console.log(`  Written: settings ${r.settingsCreated ? 'created' : 'unchanged'}, stock entry ${r.stockEntry ? 'posted' : 'none'}, ${r.receivableEntries} customer opening balance(s).`);
      }
    }
  } catch (e) {
    console.error(`Backfill stopped: ${e instanceof Error ? e.message : e}`);
    code = 1;
  } finally {
    await prisma.$disconnect();
  }
  setTimeout(() => process.exit(code), 300);
})();
