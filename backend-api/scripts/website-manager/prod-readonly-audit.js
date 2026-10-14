#!/usr/bin/env node
'use strict';
/**
 * Website Manager Phase 0: what does every vendor's site read today? SELECT ONLY.
 * Every statement runs inside a READ ONLY transaction, so a write is impossible even by mistake.
 *   node scripts/website-manager/prod-readonly-audit.js              (reads DATABASE_URL from the environment or backend-api/.env.local)
 * Prints field presence (yes/no), never the values, so no personal data leaves the database.
 */
const fs = require('fs');
const path = require('path');

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
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const vendors = await tx.$queryRawUnsafe(`
        SELECT v.id, v.subdomain, v."industry", v."isSandbox", v.status::text AS status,
          (c."vendorId" IS NOT NULL) AS has_cms,
          c."themeId" AS theme_id,
          (coalesce(c."businessName",'') <> '') AS name, (coalesce(c.tagline,'') <> '') AS tagline, (coalesce(c.about,'') <> '') AS about,
          (coalesce(c.logo,'') <> '') AS logo, (coalesce(c.banner,'') <> '') AS banner, (coalesce(c.favicon,'') <> '') AS favicon,
          (coalesce(c.phone,'') <> '') AS phone, (coalesce(c.whatsapp,'') <> '') AS whatsapp, (coalesce(c.email,'') <> '') AS email, (coalesce(c.address,'') <> '') AS address,
          (coalesce(c."seoTitle",'') <> '') AS seo_title, (coalesce(c."seoDesc",'') <> '') AS seo_desc,
          (c.portfolio IS NOT NULL) AS portfolio,
          (SELECT count(*) FROM "VendorProduct" p WHERE p."vendorId" = v.id AND p.active) AS products,
          (SELECT count(*) FROM g4d_leadspace_profiles lp WHERE lp."vendorId" = v.id) AS leadspace_pages
        FROM "Vendor" v LEFT JOIN "VendorCMS" c ON c."vendorId" = v.id
        WHERE v.subdomain IS NOT NULL ORDER BY v.subdomain`);
      const themes = await tx.$queryRawUnsafe(`SELECT t.id, t.name, t.industry, (t.pages IS NOT NULL) AS raw_html, (t.layout IS NOT NULL) AS kit_layout, (SELECT count(*) FROM "VendorCMS" c WHERE c."themeId" = t.id) AS vendors FROM g4d_website_themes t ORDER BY vendors DESC LIMIT 40`);
      const plans = await tx.$queryRawUnsafe(`SELECT "planKey"::text AS plan, status::text AS status, count(*)::int AS n FROM g4d_billing_terms WHERE "isCurrent" = true GROUP BY 1,2 ORDER BY 1,2`);
      return { vendors, themes, plans };
    });
    console.log(JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('audit failed:', e.message); process.exit(1); });
