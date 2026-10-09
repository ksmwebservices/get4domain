'use strict';
// Shared by scripts/leadspace-onboard-pilots.js (the CLI KSM runs) and the verify suite. Needs `npx nest build` first.
const path = require('path');
const crypto = require('crypto');

const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));
const phone10 = (v) => { const d = String(v ?? '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : null; };

/** Pure: what is wrong with one pilot entry, in plain sentences (empty = fine). */
function problems(e, categories) {
  const out = [];
  if (!e.name || String(e.name).trim().length < 2) out.push('name is missing');
  if (!/^\S+@\S+\.\S+$/.test(String(e.email ?? ''))) out.push('e-mail is not valid');
  if (!phone10(e.phone)) out.push('phone must be a 10-digit Indian mobile number');
  if (!e.businessName || String(e.businessName).trim().length < 2) out.push('businessName is missing');
  if (!categories.includes(e.category)) out.push(`category must be one of: ${categories.join(', ')}`);
  if (!e.city || !String(e.city).trim()) out.push('city is missing');
  return out;
}

/**
 * Onboard one pilot vendor: the vendor account (LeadSpace-only mode), the draft page generated from their details, an inactive promotion plan.
 * What only the vendor can do (prove the phone with a code, pay the first refill, press Publish) is returned as the checklist. Idempotent on e-mail.
 */
async function onboardOne(prisma, e, apply) {
  const { CATEGORIES, categoryOf, slugify } = dist('leadspace/leadspace.types');
  const cats = CATEGORIES.map((c) => c.id);
  const bad = problems(e, cats);
  const base = { email: e.email, businessName: e.businessName, problems: bad };
  if (bad.length) return { ...base, status: 'SKIPPED', checklist: [] };
  const existing = await prisma.vendor.findUnique({ where: { email: e.email }, select: { id: true } });
  const cat = categoryOf(e.category);
  const goal = e.goal ?? cat.goal;
  const checklist = [
    'Send the vendor their login and ask them to set a new password',
    'Vendor: open the Page tab, check the services and prices, press "Send code" under Verify your WhatsApp number and enter the code',
    'Vendor: press Publish',
    'Vendor: open the Wallet tab and make the first refill (Razorpay); held customers are released on their own',
    'Vendor: open the Promote tab and switch promotion on; KSM approves the first posts in Admin > LeadSpace > Promotion',
  ];
  if (!apply) return { ...base, status: existing ? 'EXISTS (would add the page if missing)' : 'WOULD CREATE', goal, checklist };

  const { AuthService } = dist('auth/auth.service');
  const { LeadspaceSettingsService } = dist('leadspace/settings.service');
  const { LeadspaceProfileService } = dist('leadspace/profile.service');
  let vendorId = existing?.id; let tempPassword = null;
  if (!vendorId) {
    tempPassword = `Pilot-${crypto.randomBytes(6).toString('base64url')}1A`;
    const sub = `${slugify(e.businessName)}-${crypto.randomBytes(2).toString('hex')}`.slice(0, 40);
    const v = await prisma.vendor.create({ data: { name: e.name.trim(), email: e.email, password: await AuthService.hashPassword(tempPassword), businessName: e.businessName.trim(), industry: 'general', phone: phone10(e.phone), subdomain: sub } });
    vendorId = v.id;
  }
  for (const addonKey of ['leadspace', 'leadspace_only']) {
    if (!(await prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId, addonKey } } }))) await prisma.vendorAddon.create({ data: { vendorId, addonKey, enabled: true } });
  }
  const profiles = new LeadspaceProfileService(prisma, null, new LeadspaceSettingsService(prisma));
  let page = await prisma.leadspaceProfile.findUnique({ where: { vendorId } });
  if (!page) {
    page = await profiles.create(vendorId, { category: e.category, city: e.city, businessName: e.businessName, goal, services: e.services, tagline: e.tagline, about: e.about, address: e.address });
    await prisma.leadspaceProfile.update({ where: { id: page.id }, data: { phone: phone10(e.phone), alertWhatsapp: phone10(e.alertWhatsapp ?? e.phone) } });
  }
  await prisma.promotionPlan.upsert({ where: { vendorId }, create: { vendorId, channels: ['FACEBOOK_PAGE', 'TELEGRAM'], schedule: { perWeek: 2 }, status: 'DRAFT' }, update: {} });
  return { ...base, status: existing ? 'UPDATED' : 'CREATED', vendorId, slug: page.slug, goal, tempPassword, checklist };
}

async function onboard(prisma, entries, apply, log = console.log) {
  log(apply ? 'APPLY: creating the pilot vendors and their draft pages.' : 'DRY RUN: nothing is written. Add --apply to create them.');
  const results = [];
  for (const e of entries) {
    const r = await onboardOne(prisma, e, apply);
    results.push(r);
    log(`\n${r.businessName} <${r.email}>: ${r.status}${r.problems.length ? ` - ${r.problems.join('; ')}` : ''}`);
    if (r.slug) log(`  page /ls/${r.slug} (draft), goal ${r.goal}${r.tempPassword ? `, temporary password ${r.tempPassword}` : ''}`);
    if (!r.problems.length) for (const c of r.checklist) log(`  [ ] ${c}`);
  }
  return results;
}

module.exports = { onboard, onboardOne, problems };
