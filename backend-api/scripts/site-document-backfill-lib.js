'use strict';
/**
 * Website Manager backfill: puts into a vendor's Website Manager row what its public site already shows, so nothing changes visually on day one.
 * Pure planning + small writes; the CLI (site-document-backfill.js) and the test suites both use this file.
 *
 *  - It only ever FILLS EMPTY fields. A value a vendor typed is never overwritten (it is reported as "kept", with a note when the old site differs).
 *  - Before it writes it keeps the row as it was in g4d_site_versions (version 0, "Before the backfill"), so a rollback is exact.
 *  - Products it adds are marked in customFields.backfill so a rollback removes exactly those and nothing a vendor created.
 */
const SEED_FIELDS = ['businessName', 'tagline', 'about', 'logo', 'banner', 'favicon', 'ogImage', 'seoTitle', 'seoDesc', 'seoKeywords', 'phone', 'whatsapp', 'email', 'address', 'businessHours', 'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps'];
const JSON_FIELDS = ['testimonials'];
const MARK = 'website-manager-backfill';
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';

// jsonb does not keep key order, so compare JSON with sorted keys
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const empty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** What would change for one vendor. `seed` is the entry from standalone-seeds.json (or undefined for a vendor on the shared renderer). Reads only. */
async function plan(prisma, vendor, seed) {
  const row = await prisma.vendorCMS.findUnique({ where: { vendorId: vendor.id } });
  const products = await prisma.vendorProduct.count({ where: { vendorId: vendor.id } });
  const out = { vendor: vendor.subdomain, hasRow: !!row, source: seed ? seed.source : 'the shared site renderer reads Website Manager directly: nothing to copy', fill: [], keep: [], differs: [], addProducts: 0, notes: [] };
  if (!seed) { out.notes.push('No hand-written public site: the public page already reads this row.'); return out; }
  for (const f of [...SEED_FIELDS, ...JSON_FIELDS]) {
    const want = seed.cms?.[f];
    if (empty(want)) continue;
    const have = row ? row[f] : null;
    if (empty(have)) out.fill.push(f);
    else { out.keep.push(f); if (!same(have, want)) out.differs.push(f); }
  }
  if (products === 0 && Array.isArray(seed.products) && seed.products.length) out.addProducts = seed.products.length;
  else if (products > 0 && Array.isArray(seed.products) && seed.products.length) out.notes.push(`Already has ${products} product(s): none added.`);
  if (!out.fill.length && !out.addProducts) out.notes.push('Nothing to fill.');
  return out;
}

/** Writes the plan. Idempotent: a second run finds nothing empty to fill. Returns what was written. */
async function apply(prisma, vendor, seed, p) {
  if (!seed || (!p.fill.length && !p.addProducts)) return { filled: [], products: 0 };
  return prisma.$transaction(async (tx) => {
    const row = await tx.vendorCMS.findUnique({ where: { vendorId: vendor.id } });
    // the row as it was, once, so a rollback is exact
    if ((await tx.siteVersion.count({ where: { vendorId: vendor.id, version: 0 } })) === 0) {
      const snap = {};
      for (const f of [...SEED_FIELDS, ...JSON_FIELDS, 'portfolio', 'pages', 'layout', 'themeId', 'packKey']) snap[f] = row ? row[f] ?? null : null;
      snap.__hadRow = !!row;
      await tx.siteVersion.create({ data: { vendorId: vendor.id, version: 0, snapshot: snap, note: 'Before the backfill', createdBy: MARK } });
    }
    const data = {};
    for (const f of p.fill) data[f] = seed.cms[f];
    if (Object.keys(data).length) {
      await tx.vendorCMS.upsert({ where: { vendorId: vendor.id }, create: { vendorId: vendor.id, ...data }, update: data });
    }
    let products = 0;
    if (p.addProducts) {
      for (const [i, sp] of seed.products.entries()) {
        let categoryId = null;
        if (sp.category) {
          const norm = sp.category.trim().toLowerCase();
          const cat = (await tx.category.findUnique({ where: { vendorId_nameNormalized: { vendorId: vendor.id, nameNormalized: norm } } }))
            ?? (await tx.category.create({ data: { vendorId: vendor.id, industry: vendor.industry ?? 'general', name: sp.category.trim(), nameNormalized: norm, sortOrder: i } }));
          categoryId = cat.id;
        }
        await tx.vendorProduct.create({ data: { vendorId: vendor.id, name: sp.name, description: sp.description ?? null, price: sp.price || null, image: sp.image ?? null, category: sp.category ?? null, categoryId, active: true, customFields: { [MARK]: true } } });
        products++;
      }
    }
    return { filled: p.fill, products };
  });
}

/** Undo exactly what apply() did for this vendor: restore the fields it filled and remove the products it added. Never touches anything else. */
async function rollback(prisma, vendor, seed) {
  const snapRow = await prisma.siteVersion.findUnique({ where: { vendorId_version: { vendorId: vendor.id, version: 0 } } });
  if (!snapRow || snapRow.createdBy !== MARK) return { restored: [], products: 0, note: 'No backfill snapshot for this vendor: nothing to undo.' };
  const snap = snapRow.snapshot;
  return prisma.$transaction(async (tx) => {
    const row = await tx.vendorCMS.findUnique({ where: { vendorId: vendor.id } });
    const { Prisma } = require('@prisma/client');
    const restored = [];
    const data = {};
    for (const f of [...SEED_FIELDS, ...JSON_FIELDS]) {
      const was = snap[f] ?? null;
      const now = row ? row[f] : null;
      // only undo a field that still holds exactly what the backfill wrote; a value the vendor has edited since is theirs
      if (seed?.cms?.[f] !== undefined && same(now, seed.cms[f]) && empty(was)) { data[f] = JSON_FIELDS.includes(f) ? Prisma.DbNull : null; restored.push(f); }
    }
    if (row && Object.keys(data).length) await tx.vendorCMS.update({ where: { vendorId: vendor.id }, data });
    const gone = await tx.vendorProduct.deleteMany({ where: { vendorId: vendor.id, customFields: { path: [MARK], equals: true } } });
    await tx.siteVersion.delete({ where: { vendorId_version: { vendorId: vendor.id, version: 0 } } });
    return { restored, products: gone.count };
  });
}

module.exports = { plan, apply, rollback, SEED_FIELDS, MARK, CONFIRM };
