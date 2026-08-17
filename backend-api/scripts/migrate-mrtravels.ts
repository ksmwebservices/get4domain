/**
 * LEGACY MIGRATION — create MR Travels as a real (non-sandbox) Get4Domain vendor
 * and populate its website content (VendorCMS + VendorProduct) + a custom theme.
 *
 * SAFE + IDEMPOTENT:
 *  - Only ADDITIVE upserts on the Get4Domain DB. Never touches MR Travels' own
 *    app / DB / containers / DNS. Never deletes anything.
 *  - Re-runnable: upserts by natural keys (vendor email, cms vendorId, theme
 *    name, product name). A second run updates content in place, no duplicates.
 *  - Does NOT cut over DNS. The new site is reachable in parallel at
 *    /site/<subdomain> on the existing Get4Domain frontend.
 *
 * RUN (on the VM, where the Get4Domain DB is reachable):
 *   cd backend-api
 *   MRTRAVELS_VENDOR_PASSWORD='<choose-a-strong-password>' \
 *   MRTRAVELS_VENDOR_EMAIL='owner@mrtravels.get4domain.com' \
 *   MRTRAVELS_SUBDOMAIN='mrtravels' \
 *   npx ts-node scripts/migrate-mrtravels.ts
 *
 * Then verify (NO cutover): open https://get4domain.com/site/mrtravels
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MRTRAVELS_CMS, MRTRAVELS_PRODUCTS, MRTRAVELS_THEME } from './mrtravels-content';

const prisma = new PrismaClient();

async function main() {
  // The MR Travels vendor shell already exists (owner Jayachandran, admin@mrtravels.com,
  // subdomain mrtravels) — this run only ADDS website content to it. The create branch
  // below is a fallback for a fresh environment.
  const email = process.env.MRTRAVELS_VENDOR_EMAIL || 'admin@mrtravels.com';
  const subdomain = process.env.MRTRAVELS_SUBDOMAIN || 'mrtravels';
  const password = process.env.MRTRAVELS_VENDOR_PASSWORD;

  // 1) Vendor — upsert by email. Password is only set on first creation; a
  //    re-run never resets it. Require a password on first create (no weak default).
  let vendor = await prisma.vendor.findUnique({ where: { email } });
  if (!vendor) {
    if (!password) {
      throw new Error('MRTRAVELS_VENDOR_PASSWORD is required to create the vendor (first run).');
    }
    // Guard against a subdomain already taken by a different vendor.
    const subTaken = await prisma.vendor.findUnique({ where: { subdomain } });
    if (subTaken) throw new Error(`Subdomain "${subdomain}" is already used by vendor ${subTaken.id}.`);
    vendor = await prisma.vendor.create({
      data: {
        name: 'M.R. Travels & Tours',
        email,
        password: await bcrypt.hash(password, 10),
        businessName: MRTRAVELS_CMS.businessName,
        phone: MRTRAVELS_CMS.phone,
        industry: 'travel',
        subdomain,
        isSandbox: false,
      },
    });
    console.log(`  + created vendor ${vendor.id} (${email})`);
  } else {
    // Existing vendor: only ensure the routing fields. Do NOT overwrite the owner's
    // account fields (name/businessName/phone/password) — the website copy lives in CMS.
    vendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { industry: 'travel', subdomain, isSandbox: false },
    });
    console.log(`  ~ using existing vendor ${vendor.id} (${email}) — account fields & password untouched`);
  }

  // 2) Ensure a wallet row exists (0 balance; real credit is a business action).
  await prisma.wallet.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id }, update: {} });

  // 3) Custom theme — find-or-create by (name, industry), then link to CMS.
  let theme = await prisma.websiteTheme.findFirst({ where: { name: MRTRAVELS_THEME.name, industry: MRTRAVELS_THEME.industry } });
  if (!theme) {
    theme = await prisma.websiteTheme.create({ data: { ...MRTRAVELS_THEME } });
    console.log(`  + created theme ${theme.id} (${theme.name})`);
  } else {
    theme = await prisma.websiteTheme.update({ where: { id: theme.id }, data: { cssVars: MRTRAVELS_THEME.cssVars } });
    console.log(`  ~ updated theme ${theme.id} (${theme.name})`);
  }

  // 4) VendorCMS — upsert by vendorId (unique), link the theme.
  const cmsData = { ...MRTRAVELS_CMS, themeId: theme.id };
  await prisma.vendorCMS.upsert({
    where: { vendorId: vendor.id },
    create: { vendorId: vendor.id, ...cmsData },
    update: { ...cmsData },
  });
  console.log('  = CMS content upserted');

  // 5) VendorProducts — idempotent per (vendorId, name): update in place or create.
  for (const p of MRTRAVELS_PRODUCTS) {
    const existing = await prisma.vendorProduct.findFirst({ where: { vendorId: vendor.id, name: p.name } });
    const data = {
      name: p.name,
      description: p.description,
      price: p.price ?? null,
      image: p.image ?? null,
      category: p.category ?? null,
      customFields: (p.customFields ?? undefined) as object | undefined,
      active: true,
    };
    if (existing) {
      await prisma.vendorProduct.update({ where: { id: existing.id }, data });
    } else {
      await prisma.vendorProduct.create({ data: { vendorId: vendor.id, ...data } });
    }
  }
  console.log(`  = ${MRTRAVELS_PRODUCTS.length} products upserted`);

  console.log('\nDONE. New site (parallel, NO cutover): /site/' + subdomain);
  console.log('Verify at https://get4domain.com/site/' + subdomain + ' before any DNS change.');
}

main()
  .catch((e) => {
    console.error('MIGRATION FAILED:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
