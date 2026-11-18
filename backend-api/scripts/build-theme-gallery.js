#!/usr/bin/env node
/* eslint-disable */
/**
 * Dispatch G1 B6: the THEME GALLERY. Renders every theme of the library for every industry pack, with that pack's sample business, into plain HTML files the owner can open in a browser with no server.
 *
 *   node scripts/build-theme-gallery.js                 write C:\Get4Domain\w2-theme-gallery\  (outside the repo, never committed)
 *   node scripts/build-theme-gallery.js --out <dir>     write somewhere else
 *   node scripts/build-theme-gallery.js --packs CLINIC,PHARMACY --pages home    only some packs / pages
 *   node scripts/build-theme-gallery.js --library-only  only the five library themes (the default also draws the starter themes of the marketplace)
 *
 * No network, no database, no clock, no randomness: the real renderer of the theme kit (themes/lib/render.mjs) draws each page from the pack demo content (src/v3-packs/pack-demo/pack-demo-content.json,
 * built by scripts/build-pack-demo-content.js). No price is shown: every price field is emptied. A theme that cannot draw a page (no real template, or the renderer refuses) is marked MISSING in the
 * index; nothing is ever faked. The index also says whether a theme was designed for the pack's category or is being shown with its default look.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = 'C:\\Get4Domain\\w2-theme-gallery';
const DEMO = path.resolve(__dirname, '..', 'src', 'v3-packs', 'pack-demo', 'pack-demo-content.json');
const ALL_PAGES = ['home', 'services', 'about', 'contact'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Empties every price of a content tree. */
function stripPrices(v) {
  if (Array.isArray(v)) return v.map(stripPrices);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'price' || k === 'priceFrom' || k === 'oldPrice' ? '' : stripPrices(x)]));
  return v;
}

/** Lays the pack's sample business over the kit's sample content for the pack's kit category, so a clinic shows clinic services and an accountant shows accounting services. */
function overlay(base, demo) {
  const c = stripPrices(JSON.parse(JSON.stringify(base)));
  const name = demo.business.name;
  c.site = { ...c.site, name, tagline: demo.business.tagline, logoAlt: `${name} logo` };
  c.hero = { ...c.hero, title: `${name} - ${demo.business.tagline}`, subtitle: demo.business.tagline, imageAlt: `${name} at work` };
  c.about = { ...c.about, title: `About ${name}`, text: demo.business.about };
  c.contact = { ...c.contact, city: demo.business.city, address: `12, Bazaar Street, ${demo.business.city}` };
  c.terms = { ...c.terms, ...demo.terms };
  const items = demo.services.map((s, i) => ({ id: `item-${i + 1}`, slug: `item-${i + 1}`, name: s.name, description: s.description, price: '', image: `sample:item-${i + 1}`, href: `/item-${i + 1}`, badge: s.badge || (i === 0 ? 'Popular' : ''), category: 'Popular' }));
  c.items = items;
  c.groups = [{ name: 'Popular', slug: 'popular', count: Math.min(3, items.length), items: items.slice(0, 3) }];
  c.team = demo.people.map((p, i) => ({ id: `t${i + 1}`, name: p.name, role: p.role, note: '', image: `sample:team-${i + 1}` }));
  c.faqs = demo.faqs.map((f) => ({ q: f.question, a: f.answer }));
  c.areas = demo.areas.map((a) => ({ name: a }));
  c.hours = demo.hours;
  c.steps = demo.steps.map((s, i) => ({ n: i + 1, title: s.title, desc: s.description }));
  if (Array.isArray(c.blocks)) c.blocks = c.blocks.map((b, i) => (demo.sections[i] ? { ...b, key: demo.sections[i].key, title: demo.sections[i].title, items: demo.sections[i].items.map((x) => ({ title: x.title, detail: x.detail, price: '' })) } : b));
  c.host = { ...c.host, siteUrl: `https://${slug(name)}.get4domain.example` };
  c.products = c.products && c.products.length ? items.map((i) => ({ ...i })) : c.products;   // a shop theme draws its products from here
  c.offers = [];   // no sample offer, no discount: a gallery never shows one
  c.stats = [];   // invented numbers (years, customers served, rating) could be read as claims
  if (Array.isArray(c.blocks)) c.blocks = c.blocks.map((b) => (/offer/i.test(b.key) ? { ...b, items: [] } : b));
  c.reviews = { sample: true, summary: null, writeUrl: '', google: [] };
  c.testimonials = [];   // a sample quote is not shown in a gallery: it could be mistaken for a real review
  c.sample = true;
  return c;
}

function parseArgs(argv) {
  const a = { out: DEFAULT_OUT, packs: null, pages: ALL_PAGES, starters: true };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
    else if (argv[i] === '--packs') a.packs = argv[++i].split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    else if (argv[i] === '--pages') a.pages = argv[++i].split(',').map((x) => x.trim()).filter(Boolean);
    else if (argv[i] === '--library-only') a.starters = false;   // only the five library themes, every one drawn for every pack (the G1 gallery)
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return a;
}

/** "clinic-pharmacy-lab-home-sample" shown as words: a tag is a short id, the gallery shows it readably. */
const tagWords = (t) => String(t).replace(/-plus-/g, ' + ').replace(/-/g, ' ');

/**
 * TM1 M6: the gallery now lists EVERY theme per pack: the library themes (drawn for every pack, marked "designed for this category" or "default look") and the starter themes, which are drawn only for the packs
 * they name and show their add-ons and combination tags. A starter is built in memory from themes/starter/recipes.json by the same builder the marketplace packages come from (themes/lib/starter-build.mjs).
 * @returns {Promise<{ out: string, packs: number, themes: number, files: number, rendered: number, missing: number }>}
 */
async function buildGallery({ out, packs: only = null, pages = ALL_PAGES, extraDirs = [], starters = true } = {}) {
  const lib = await import(pathToFileURL(path.join(REPO, 'themes', 'lib', 'theme.mjs')).href);
  const render = await import(pathToFileURL(path.join(REPO, 'themes', 'lib', 'render.mjs')).href);
  const doc = await import(pathToFileURL(path.join(REPO, 'themes', 'lib', 'document.mjs')).href);
  const fixtures = await import(pathToFileURL(path.join(REPO, 'themes', 'fixtures', 'index.mjs')).href);
  const demo = JSON.parse(fs.readFileSync(DEMO, 'utf8')).packs;
  const packKeys = Object.keys(demo).filter((k) => !only || only.includes(k)).sort();
  const sources = new Map(lib.listVendorThemeIds().map((id) => [id, id]));
  for (const dir of extraDirs) sources.set(path.basename(dir), dir);   // a folder outside the library (a candidate theme, or a test)

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let files = 0; let rendered = 0; let missing = 0;
  const sections = [];
  const themes = new Map();
  for (const id of sources.keys()) { try { themes.set(id, { theme: lib.loadTheme(sources.get(id)) }); } catch (e) { themes.set(id, { error: String(e && e.message || e).slice(0, 200) }); } }
  if (starters) {
    const sb = await import(pathToFileURL(path.join(REPO, 'themes', 'lib', 'starter-build.mjs')).href);
    for (const b of await sb.buildAllStarters()) themes.set(b.recipe.id, { theme: lib.themeFromFiles(b.files), starter: b.manifest.marketplace });
  }
  const themeIds = [...themes.keys()].sort();
  const starterCount = [...themes.values()].filter((t) => t.starter).length;
  const combinations = new Map();   // tag -> [theme ids]

  for (const pack of packKeys) {
    const d = demo[pack];
    const content = overlay(fixtures.sampleContent(d.kitCategory, { lang: 'en' }), d);
    const rows = [];
    for (const id of themeIds) {
      const t = themes.get(id);
      if (t.starter && !t.starter.packs.includes(pack)) continue;   // a starter is drawn only for the packs it names
      if (t.error) { rows.push({ id, name: id, tier: '-', state: 'MISSING', why: `could not be loaded: ${t.error}`, links: [] }); missing += 1; continue; }
      const m = t.theme.manifest;
      const designedFor = m.categories.includes(d.kitCategory);
      const links = []; const problems = [];
      for (const page of pages) {
        if (!t.theme.templates || !t.theme.templates[page]) { problems.push(`no ${page} template`); continue; }
        try {
          const r = render.renderPage({ theme: t.theme, page: { slug: page }, content, settings: {}, vendor: { id: 'gallery' }, host: { siteUrl: content.host.siteUrl }, entitlements: fixtures.ENTITLEMENTS_OFF });
          const html = doc.pageDocument({ theme: t.theme, rendered: r });
          const rel = `${pack}/${id}/${page}.html`;
          fs.mkdirSync(path.join(out, pack, id), { recursive: true });
          fs.writeFileSync(path.join(out, rel), html);
          files += 1; links.push({ page, rel });
        } catch (e) { problems.push(`${page}: ${String(e && e.message || e).slice(0, 120)}`); }
      }
      const extra = t.starter ? { starter: true, addons: t.starter.addons ?? [], capabilities: t.starter.capabilities ?? [], tags: t.starter.tags ?? [] } : { starter: false, addons: [], capabilities: [], tags: [] };
      for (const tag of extra.tags) { if (!combinations.has(tag)) combinations.set(tag, new Set()); combinations.get(tag).add(id); }
      if (!links.length) { rows.push({ id, name: m.name, tier: m.tier, state: 'MISSING', why: problems.join('; ') || 'no page could be drawn', links, ...extra }); missing += 1; }
      else { rows.push({ id, name: m.name, tier: m.tier, state: 'RENDERED', designedFor, why: problems.join('; '), links, ...extra }); rendered += 1; }
    }
    sections.push({ pack, d, rows });
  }

  const combo = (r) => (r.starter ? `${r.tags.length ? `Combinations: ${r.tags.map(tagWords).join('; ')}.` : 'Works on its own (no add-on section).'}${r.addons.length ? ` Add-on sections: ${r.addons.join(', ')}.` : ''}` : '');
  const state = (r) => (r.state === 'MISSING' ? `<strong>MISSING</strong> ${esc(r.why)}` : `RENDERED${r.starter ? ', <strong>starter theme</strong> built by the team for this pack' : r.designedFor ? ', designed for this category' : ', default look (not designed for this category)'}${r.why ? ` <em>${esc(r.why)}</em>` : ''}${r.starter ? `<br>${esc(combo(r))}` : ''}`);
  const body = sections.map((s) => `<section id="${esc(s.pack)}"><h2>${esc(s.d.packName)} <small>(${esc(s.pack)})</small></h2><p>Sample business: <strong>${esc(s.d.business.name)}</strong>, ${esc(s.d.business.city)}. Kit category: ${esc(s.d.kitCategory)}. ${s.rows.length} themes: ${s.rows.filter((r) => r.starter).length} starter, ${s.rows.filter((r) => !r.starter).length} library.</p><table><thead><tr><th>Theme</th><th>Tier</th><th>State</th><th>Pages</th></tr></thead><tbody>${s.rows.map((r) => `<tr class="${r.state === 'MISSING' ? 'missing' : ''}"><td>${esc(r.name)} <code>${esc(r.id)}</code></td><td>${esc(r.tier)}${r.tier === 'Premium' ? ' (premium)' : ''}</td><td>${state(r)}</td><td>${r.links.map((l) => `<a href="${esc(l.rel)}">${esc(l.page)}</a>`).join(' | ')}</td></tr>`).join('')}</tbody></table></section>`).join('\n');
  const nav = sections.map((s) => `<a href="#${esc(s.pack)}">${esc(s.pack)}</a>`).join(' · ');
  const comboList = [...combinations.keys()].sort().map((tag) => `<li><strong>${esc(tagWords(tag))}</strong> <code>${esc(tag)}</code>: ${[...combinations.get(tag)].sort().map((id) => `<code>${esc(id)}</code>`).join(' ')}</li>`).join('');
  const comboBlock = starterCount ? `<h2 id="combinations">Combinations</h2><p>Themes that also draw an add-on section (a shop, delivery, a pharmacy or lab counter, home sample collection). Each is drawn on the pack pages below.</p><ul>${comboList}</ul>` : '';
  const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Theme gallery</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px}table{border-collapse:collapse;width:100%;margin:8px 0 28px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}tr.missing td{background:#fff1f0}nav{margin:12px 0 24px;line-height:2}small{color:#666}code{background:#eee;padding:0 4px}</style></head><body><h1>Theme gallery</h1><p>${themeIds.length} themes (${themeIds.length - starterCount} library, ${starterCount} starter) by ${packKeys.length} packs. Every page is drawn by the real renderer with the sample business of the pack. Sample content only: every business and name is invented, and no price is shown. A theme that cannot draw a page is marked MISSING. A library theme is drawn for every pack; a starter theme only for the packs it names.</p><p><strong>${rendered}</strong> rendered, <strong>${missing}</strong> missing.</p><nav>${nav}</nav>\n${comboBlock}\n${body}\n</body></html>\n`;
  fs.writeFileSync(path.join(out, 'index.html'), index); files += 1;
  fs.writeFileSync(path.join(out, 'gallery.json'), JSON.stringify({
    generatedBy: 'scripts/build-theme-gallery.js', themes: themeIds, starters: starterCount,
    combinations: Object.fromEntries([...combinations.keys()].sort().map((tag) => [tag, [...combinations.get(tag)].sort()])),
    packs: sections.map((s) => ({ pack: s.pack, business: s.d.business.name, kitCategory: s.d.kitCategory, themes: s.rows.map((r) => ({ id: r.id, state: r.state, designedFor: r.designedFor ?? null, starter: r.starter, addons: r.addons, capabilities: r.capabilities, tags: r.tags, pages: r.links.map((l) => l.rel), note: r.why || null })) })),
  }, null, 2));
  return { out, packs: packKeys.length, themes: themeIds.length, files, rendered, missing };
}

module.exports = { buildGallery, overlay, stripPrices };

if (require.main === module) {
  const a = parseArgs(process.argv);
  buildGallery({ out: a.out, packs: a.packs, pages: a.pages, starters: a.starters }).then((r) => {
    console.log(`theme gallery: ${r.themes} themes x ${r.packs} packs, ${r.rendered} rendered, ${r.missing} MISSING, ${r.files} files`);
    console.log(`open ${path.join(r.out, 'index.html')}`);
    process.exit(0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
