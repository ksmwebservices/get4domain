#!/usr/bin/env node
'use strict';
/**
 * Test-campaign kit for KSM's manual Phase 0 ads: one landing page per trade, the UTM links to paste into the ads, and an empty sheet to fill.
 *
 *   node scripts/leadspace-test-campaign-kit.js --city Chennai --phone 98xxxxxxxx                 # DRY RUN: lists what it would make and the links
 *   node scripts/leadspace-test-campaign-kit.js --city Chennai --phone 98xxxxxxxx --apply         # makes twelve internal test vendors with a draft page each
 *   ... --apply --publish                                                                          # also publishes them (verification of the number is still yours to do)
 *
 * UTM convention: utm_source = meta | google | other, utm_medium = paid, utm_campaign = <trade>-<city>-<yyyymm> (lower case), utm_content = the creative number.
 * When you record the spend of a boost in Admin > LeadSpace > Cost per lead, write the utm_campaign in the note. The sheet at
 * Admin > LeadSpace (API: /admin/leadspace/test-campaign-sheet.csv) then lists spend, verified leads and cost per verified lead per campaign.
 * Every test page belongs to its own internal vendor (test-<trade>-<city>@get4domain.com) with an empty wallet, so leads are captured and held: nothing is charged to anyone.
 * Reads DATABASE_URL from the environment or backend-api/.env. Needs `npx nest build` first.
 */
const path = require('path');
const fs = require('fs');
const { onboardOne } = require('./leadspace-onboard-lib');

const NAMES = {
  'home-services': 'Home Services', 'builders-interiors': 'Builders and Interiors', 'real-estate': 'Real Estate', freelancer: 'Freelancer', startup: 'Startup',
  'photography-events': 'Photography and Events', tutor: 'Tutor', 'salon-beauty': 'Salon and Beauty', 'shop-retail': 'Shop', 'restaurant-food': 'Food and Catering', advocate: 'Advocate', clinic: 'Clinic',
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const yyyymm = (d = new Date()) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

async function buildKit(prisma, o, log = console.log) {
  const { CATEGORIES } = require(path.join(__dirname, '..', 'dist', 'src', 'leadspace', 'leadspace.types'));
  const { pageUrl } = require(path.join(__dirname, '..', 'dist', 'src', 'leadspace', 'page-builder'));
  log(o.apply ? 'APPLY: making the test pages.' : 'DRY RUN: nothing is written. Add --apply to make them.');
  const rows = [];
  for (const c of CATEGORIES) {
    const email = `test-${c.id}-${slug(o.city)}@get4domain.com`;
    const campaign = `${c.id}-${slug(o.city)}-${yyyymm()}`;
    const r = await onboardOne(prisma, { name: `Test ${NAMES[c.id]}`, email, phone: o.phone, businessName: `Test ${NAMES[c.id]} ${o.city}`, category: c.id, city: o.city, goal: c.goal, services: [{ name: `${NAMES[c.id]} service`, price: 0 }] }, o.apply);
    let url = null;
    if (o.apply && r.slug) {
      url = pageUrl(r.slug);
      if (o.publish) await prisma.leadspaceProfile.update({ where: { vendorId: r.vendorId }, data: { status: 'PUBLISHED' } });
    }
    const link = `${url ?? '<page address after --apply>'}?utm_source=meta&utm_medium=paid&utm_campaign=${campaign}&utm_content=1`;
    rows.push({ trade: c.id, campaign, email, link, status: r.status, problems: r.problems });
    log(`${c.id.padEnd(20)} ${r.status.padEnd(18)} ${link}`);
  }
  return rows;
}

const SHEET_HEAD = 'Trade,Campaign (utm_campaign),Ad platform,Creative,Start date,Spend (Rs),Clicks,Verified leads,Cost per verified lead (Rs),Notes';

module.exports = { buildKit, SHEET_HEAD, yyyymm };

if (require.main === module) {
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const city = val('--city'); const phone = val('--phone');
  if (!city || !phone) { console.error('Give --city and --phone (your own mobile number, used for the test pages): --city Chennai --phone 98xxxxxxxx'); process.exit(2); }
  if (!process.env.DATABASE_URL) {
    for (const name of ['.env', '.env.local']) {
      const file = path.join(__dirname, '..', name);
      if (!fs.existsSync(file)) continue;
      for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
    }
  }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }
  (async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    let code = 0;
    try {
      const rows = await buildKit(prisma, { city, phone, apply: args.includes('--apply'), publish: args.includes('--publish') });
      const NL = String.fromCharCode(10);
      const out = path.join(process.cwd(), `leadspace-test-campaigns-${yyyymm()}.csv`);
      fs.writeFileSync(out, [SHEET_HEAD, ...rows.map((r) => `${r.trade},${r.campaign},meta,1,,,,,,`)].join(NL));
      console.log(`\nSheet to fill in: ${out}`);
      if (rows.some((r) => r.problems.length)) code = 1;
    } catch (e) { console.error(`Kit stopped: ${e instanceof Error ? e.message : e}`); code = 1; } finally { await prisma.$disconnect(); }
    process.exit(code);
  })();
}
