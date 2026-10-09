#!/usr/bin/env node
'use strict';
/**
 * Campaigns and DomainCampaign became LeadSpace. This copies what vendors already have into the new tables, without losing anything. KSM runs it on the VM.
 *
 *   node scripts/leadspace-migrate-campaigns.js                        # DRY RUN for every vendor that has campaigns, landing pages or campaign leads
 *   node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours  # dry run for one vendor (subdomain or id)
 *   node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --apply
 *   node scripts/leadspace-migrate-campaigns.js --apply                # every vendor (do one vendor first)
 *   node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --rollback           # what a rollback would remove (dry run)
 *   node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --rollback --apply   # remove what the import created
 *
 * It is a COPY: the old campaign, landing page, lead and DomainCampaign rows are never changed or deleted. The landing page becomes a DRAFT LeadSpace page, so
 * the old /go/<slug> address keeps serving until the vendor publishes the new one. Safe to run twice. Reads DATABASE_URL from the environment or backend-api/.env.
 * Needs `npx nest build` first, and the LeadSpace migrations applied (npx prisma migrate deploy).
 *
 * ROLLBACK NOTE: only rows the import made are removed: the draft page (marker createdIpHash = migrated-campaign-page; kept if it was published, verified or has
 * real requests), the history entries on the Promote tab, and the imported leads (idempotency key legacy:<id>, never charged). The originals are untouched.
 */
const path = require('path');
const fs = require('fs');
const { runMigration } = require('./leadspace-migrate-lib');

const args = process.argv.slice(2);
const vi = args.indexOf('--vendor');
const VENDOR = vi >= 0 ? args[vi + 1] : undefined;
if (vi >= 0 && (!VENDOR || VENDOR.startsWith('--'))) { console.error('--vendor needs a subdomain, for example: --vendor allwin-tours'); process.exit(2); }

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

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let code = 0;
  try {
    await runMigration(prisma, { apply: args.includes('--apply'), rollback: args.includes('--rollback'), vendor: VENDOR });
  } catch (e) {
    console.error(`Migration stopped: ${e instanceof Error ? e.message : e}`);
    code = 1;
  } finally {
    await prisma.$disconnect();
  }
  process.exit(code);
})();
