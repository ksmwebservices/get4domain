// The contact sheet: every category and design, desktop and mobile, with its starter content, written to evidence/industry-designs/contact-sheet/ plus an index.html KSM can open.
//   node scripts/industry-designs/contact-sheet.mjs                 all 24 categories x 4 designs x 2 sizes (about 10 minutes; builds the website the first time)
//   node scripts/industry-designs/contact-sheet.mjs --only=salon    one category
//   node scripts/industry-designs/contact-sheet.mjs --desktop       desktop only
// It starts the real API on an in-memory database, creates one DRAFT site per category with the admin tool, and opens each design through the private preview link.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launchBrowser, shot } from './lib-shot.mjs';
import { startStack } from './lib-stack.mjs';

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ONLY = arg('only');
const DESKTOP_ONLY = process.argv.includes('--desktop');
const OUT = path.join(ROOT, 'evidence', 'industry-designs', 'contact-sheet');

const stack = await startStack();
if (!stack) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR)'); process.exit(0); }
const { h, FRONT } = stack;
const browser = await launchBrowser();
const rows = [];
try {
  const admin = await h.createAdmin({ key: 'sheetadmin' });
  const seeded = await h.call('POST', '/admin/category-packs/seed/starter', {}, admin.token);
  console.log(`packs: ${JSON.stringify(seeded.data).slice(0, 120)}`);
  const packs = (await h.call('GET', '/admin/category-packs', undefined, admin.token)).data;
  for (const p of packs) {
    if (ONLY && p.key !== ONLY) continue;
    const cfg = p.config;
    if (!cfg.designs) continue;
    const sub = `sheet-${p.key}`;
    const created = await h.call('POST', '/admin/category-packs/sites', { categoryKey: p.key, businessName: `Sample ${p.name}`, subdomain: sub, city: 'Chennai', phone: '9876543210' }, admin.token);
    if (created.status >= 300) { console.log(`  ! ${p.key}: ${JSON.stringify(created.body).slice(0, 200)}`); continue; }
    const base = created.data.previewUrl;
    for (const d of cfg.designs.filter((x) => x.enabled !== false)) {
      const url = `${FRONT}${base}&design=${d.key}`;
      const dir = path.join(OUT, p.key);
      const rec = { category: p.key, name: p.name, family: cfg.family, design: d.name, key: d.key, theme: d.themeKey, files: {} };
      for (const [label, width] of DESKTOP_ONLY ? [['desktop', 1280]] : [['desktop', 1280], ['mobile', 390]]) {
        const file = path.join(dir, `${d.key}-${label}.webp`);
        const r = await shot(browser, url, file, { width, height: label === 'mobile' ? 800 : 900, maxHeight: label === 'mobile' ? 3600 : 3000, format: 'webp' });
        rec.files[label] = path.relative(OUT, file).split(path.sep).join('/');
        rec[`${label}Height`] = r.height;
      }
      rows.push(rec);
      console.log(`  ${p.key}/${d.key}`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const byCat = new Map();
  for (const r of rows) { if (!byCat.has(r.category)) byCat.set(r.category, []); byCat.get(r.category).push(r); }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Industry designs: contact sheet</title>
<style>body{font:14px system-ui,sans-serif;margin:0;background:#f4f5f7;color:#111}header{padding:20px 28px;background:#111;color:#fff}h1{margin:0;font-size:20px}header p{margin:6px 0 0;color:#bbb}
section{padding:18px 28px;border-bottom:1px solid #ddd}h2{margin:0 0 4px;font-size:17px}.fam{color:#666;margin:0 0 12px}.row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.card{background:#fff;border:1px solid #ddd;border-radius:10px;overflow:hidden}.card h3{margin:0;padding:10px 12px 6px;font-size:14px}.card small{display:block;padding:0 12px 8px;color:#666}
.shots{display:grid;grid-template-columns:3fr 1fr;gap:6px;padding:0 8px 8px}.shots a{display:block;height:340px;overflow:hidden;border:1px solid #eee;border-radius:6px}.shots img{width:100%;display:block}
.m img{width:100%}@media(max-width:1000px){.row{grid-template-columns:repeat(2,1fr)}}</style></head><body>
<header><h1>Industry designs: contact sheet</h1><p>${byCat.size} categories, ${rows.length} designs. Click a picture for the full page. Made ${new Date().toISOString().slice(0, 10)} by scripts/industry-designs/contact-sheet.mjs.</p></header>
${[...byCat.entries()].map(([cat, list]) => `<section id="${cat}"><h2>${list[0].name} <small style="font-weight:400;color:#888">(${cat})</small></h2><p class="fam">Flow family: ${list[0].family}</p><div class="row">${list.map((r) => `<div class="card"><h3>${r.design}</h3><small>theme ${r.theme}</small><div class="shots"><a href="${r.files.desktop}"><img loading="lazy" src="${r.files.desktop}" alt="${r.name} ${r.design}, desktop"></a>${r.files.mobile ? `<a class="m" href="${r.files.mobile}"><img loading="lazy" src="${r.files.mobile}" alt="${r.name} ${r.design}, mobile"></a>` : '<span></span>'}</div></div>`).join('')}</div></section>`).join('\n')}
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(rows, null, 1));
  console.log(`wrote ${rows.length} designs to ${OUT}`);
} finally { await browser.close(); await stack.stop(); }
process.exit(0);
