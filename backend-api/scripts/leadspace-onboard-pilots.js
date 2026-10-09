#!/usr/bin/env node
'use strict';
/**
 * Pilot onboarding: ten vendors, one command. KSM runs it on the VM.
 *
 *   node scripts/leadspace-onboard-pilots.js --file pilots.json            # DRY RUN: checks every entry, writes nothing
 *   node scripts/leadspace-onboard-pilots.js --file pilots.json --apply    # creates vendor + LeadSpace-only mode + draft page + promotion plan (inactive)
 *
 * pilots.json is a list of { "name", "email", "phone", "businessName", "category", "city", "goal"?, "services"?: [{ "name", "price"? }], "tagline"?, "about"?, "address"?, "alertWhatsapp"? }.
 * `category` is one of the twelve trades (home-services, builders-interiors, real-estate, freelancer, startup, photography-events, tutor, salon-beauty, shop-retail,
 * restaurant-food, advocate, clinic). Run it again after a mistake: an e-mail that exists is not created twice. What only the vendor can do (prove their WhatsApp
 * number, pay the first refill, press Publish) is printed as a checklist per vendor. See docs/v2/LEADSPACE_PILOT.md.
 * Reads DATABASE_URL from the environment or backend-api/.env. Needs `npx nest build` first.
 */
const path = require('path');
const fs = require('fs');
const { onboard } = require('./leadspace-onboard-lib');

const args = process.argv.slice(2);
const fi = args.indexOf('--file');
const FILE = fi >= 0 ? args[fi + 1] : undefined;
if (!FILE || FILE.startsWith('--')) { console.error('Give the list of pilot vendors: --file pilots.json'); process.exit(2); }
if (!fs.existsSync(FILE)) { console.error(`I could not find ${FILE}.`); process.exit(2); }

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
    const entries = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(entries) || entries.length === 0) throw new Error('The file must hold a list with at least one vendor.');
    const results = await onboard(prisma, entries, args.includes('--apply'));
    if (results.some((r) => r.problems.length)) code = 1;
  } catch (e) {
    console.error(`Onboarding stopped: ${e instanceof Error ? e.message : e}`);
    code = 1;
  } finally {
    await prisma.$disconnect();
  }
  process.exit(code);
})();
