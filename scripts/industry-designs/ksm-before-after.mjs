// Phase 6 evidence: ksm-webtech-services before and after the category is corrected and "Reset to starter" is pressed.
// The real vendor is on production and is never touched here. This builds a copy of its situation on an in-memory database (industry "retail", no site row, no items,
// the new Website Manager switched on), takes the "before" picture, runs the real set-vendor-category script logic and the real Reset to starter, publishes, and takes the "after" pictures.
//   node scripts/industry-designs/ksm-before-after.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, launchBrowser, shot } from './lib-shot.mjs';
import { startStack } from './lib-stack.mjs';

const require = createRequire(import.meta.url);
const { changeCategory } = require(path.join(ROOT, 'backend-api', 'scripts', 'industry-designs', 'set-vendor-category.js'));
const OUT = path.join(ROOT, 'evidence', 'industry-designs', 'ksm');

const stack = await startStack();
if (!stack) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR)'); process.exit(0); }
const { h, FRONT } = stack;
const browser = await launchBrowser();
const notes = [];
try {
  const admin = await h.createAdmin({ key: 'ksmadmin' });
  await h.call('POST', '/admin/category-packs/seed/starter', {}, admin.token);
  // the situation found in production on 14 Oct 2026 (evidence/website-manager/prod-readonly-raw.json): industry retail, no site row, no items
  const v = await h.createVendor({ key: 'ksmcopy', industry: 'retail', plan: 'WORKSPACE', subdomain: 'ksm-webtech-services' });
  await h.prisma.vendor.update({ where: { id: v.id }, data: { businessName: 'KSM WebTech Services', phone: '9876543210' } });
  await h.prisma.vendorAddon.create({ data: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true } });
  const url = `${FRONT}/site/ksm-webtech-services`;

  const before = await shot(browser, url, path.join(OUT, 'before-desktop.png'), { width: 1280, height: 900, maxHeight: 1800 });
  await shot(browser, url, path.join(OUT, 'before-mobile.png'), { width: 390, height: 800, maxHeight: 1800 });
  notes.push(`Before: industry "retail", no site row, no items. The page is ${before.height}px tall: the business name, an "Order now\" button (the retail flow), an empty gradient and a contact form. Nothing about IT or web services.`);

  const dry = await changeCategory(h.prisma, 'ksm-webtech-services', 'technology', false);
  const stillRetail = (await h.prisma.vendor.findUnique({ where: { id: v.id } })).industry === 'retail';
  notes.push(`Dry run changed nothing: ${stillRetail}. It would set industry "${dry.after.industry}" and site category "${dry.after.packKey}" (${dry.packName}).`);
  await changeCategory(h.prisma, 'ksm-webtech-services', 'technology', true);

  const r = await h.call('POST', '/site-doc/me/reset-starter', {}, v.token);
  notes.push(`Reset to starter: filled ${r.data?.result?.filled?.join(', ')}; created ${r.data?.result?.itemsCreated} starter items; design ${r.data?.result?.designKey}.`);
  const pub = await h.call('POST', '/site-doc/me/publish', {}, v.token);
  notes.push(`Publish: ${pub.status < 300 ? 'live' : JSON.stringify(pub.body).slice(0, 200)}.`);
  const live = (await h.call('GET', '/cms/site/ksm-webtech-services')).data;
  notes.push(`Public data: category ${live.pack?.key}; ${live.products.length} items, every sample price hidden: ${live.products.every((p) => p.price === null)}; sample quotes hidden: ${(live.cms.testimonials ?? []).length === 0}; indexable: ${live.indexable} (false until the owner writes their own About text, a real item or a real quote).`);

  const after = await shot(browser, url, path.join(OUT, 'after-desktop.png'), { width: 1280, height: 900, maxHeight: 3200 });
  await shot(browser, url, path.join(OUT, 'after-mobile.png'), { width: 390, height: 800, maxHeight: 3200 });
  const prev = (await h.call('POST', '/site-doc/me/preview-link', {}, v.token)).data.url;
  const dz = (await h.call('GET', '/site-doc/me/designs', undefined, v.token)).data;
  for (const d of dz.designs) await shot(browser, `${FRONT}${prev}&design=${d.key}`, path.join(OUT, `after-design-${d.key}-desktop.png`), { width: 1280, height: 900, maxHeight: 2400 });
  notes.push(`After: ${after.height}px tall with a hero picture, services, how-it-works, questions and a contact form, and the four designs of IT and web services: ${dz.designs.map((d) => d.name).join(', ')}.`);
  fs.writeFileSync(path.join(OUT, 'README.md'), `# ksm-webtech-services: before and after\n\nMade ${new Date().toISOString().slice(0, 10)} by \`scripts/industry-designs/ksm-before-after.mjs\` on a copy of its situation (the production vendor was not touched).\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\nPictures: \`before-desktop.png\`, \`before-mobile.png\`, \`after-desktop.png\`, \`after-mobile.png\`, \`after-design-<name>-desktop.png\`.\n`);
  console.log(notes.join('\n'));
} finally { await browser.close(); await stack.stop(); }
process.exit(0);
