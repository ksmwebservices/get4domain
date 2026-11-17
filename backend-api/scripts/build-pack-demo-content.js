#!/usr/bin/env node
/* eslint-disable */
/**
 * Dispatch G1 B3: the per-pack demo content set (src/v3-packs/pack-demo/pack-demo-content.json).
 *
 * For each of the 16 industry packs it takes the theme kit's sample content for that pack's kit category (the same category the site falls back to, PACK_KIT_FALLBACK) and keeps what a demo needs:
 * the business, what it does, the people, the questions, the areas, the hours. NO price is kept: the kit's sample prices are placeholders for a preview, and a demo must never show a number the
 * owner did not choose. No network, no database. Usage:
 *   node scripts/build-pack-demo-content.js           write the file
 *   node scripts/build-pack-demo-content.js --check   fail (exit 1) when the committed file differs from what the kit produces
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'src', 'v3-packs', 'pack-demo', 'pack-demo-content.json');

function packKitFallback() {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'directory', 'core', 'listable-categories.ts'), 'utf8');
  const body = /export const PACK_KIT_FALLBACK[^=]*=\s*\{([\s\S]*?)\};/.exec(src);
  if (!body) throw new Error('PACK_KIT_FALLBACK not found in listable-categories.ts');
  const map = {};
  for (const m of body[1].matchAll(/([A-Z0-9_]+):\s*'([a-z0-9-]+)'/g)) map[m[1]] = m[2];
  return map;
}

function packNames() {
  const csv = fs.readFileSync(path.resolve(__dirname, '..', 'prisma', 'seed', 'pack-engine', 'PACK_SUMMARY_V1.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const out = {};
  for (const line of csv) { const i = line.indexOf(','); const j = line.indexOf(',', i + 1); out[line.slice(0, i)] = line.slice(i + 1, j); }
  return out;
}

const OVERRIDES_FILE = path.resolve(__dirname, '..', 'prisma', 'seed', 'pack-demo', 'pack-demo-overrides.json');
function applyOverride(entry, o) {
  return {
    ...entry, business: o.business, terms: o.terms, services: o.services.map(([name, description]) => ({ name, description, badge: null })), people: o.people.map(([name, role]) => ({ name, role })),
    faqs: o.faqs.map(([question, answer]) => ({ question, answer })), areas: o.areas, sections: o.sections.map(([key, title, items]) => ({ key, title, items: items.map(([t, d]) => ({ title: t, detail: d })) })),
  };
}

async function build() {
  const fixtures = await import(pathToFileURL(path.join(ROOT, 'themes', 'fixtures', 'index.mjs')).href);
  const fallback = packKitFallback(); const names = packNames(); const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8')).packs;
  const packs = {};
  for (const pack of Object.keys(fallback).sort()) {
    const category = fallback[pack];
    const c = fixtures.sampleContent(category, { lang: 'en' });
    packs[pack] = {
      packName: names[pack] ?? pack, kitCategory: category,
      business: { name: c.site.name, tagline: c.site.tagline, city: c.contact.city, about: c.about.text },
      terms: { items: c.terms.items, itemOne: c.terms.itemOne, team: c.terms.team, teamOne: c.terms.teamOne },
      services: c.items.map((i) => ({ name: i.name, description: i.description, badge: i.badge || null })),
      people: c.team.map((t) => ({ name: t.name, role: t.role })),
      faqs: c.faqs.map((f) => ({ question: f.q, answer: f.a })),
      areas: c.areas.map((a) => a.name),
      hours: c.hours.map((h) => ({ day: h.day, open: h.open, close: h.close, closed: h.closed })),
      steps: c.steps.map((s) => ({ title: s.title, description: s.desc })),
      sections: c.blocks.map((b) => ({ key: b.key, title: b.title, items: b.items.map((i) => ({ title: i.title, detail: i.detail })) })),
      isSample: true,
    };
    if (overrides[pack]) packs[pack] = applyOverride(packs[pack], overrides[pack]);
  }
  return { version: 1, note: 'Sample content for demos. Every business, name and number is invented. No price is included: prices are the owner\'s to set.', packs };
}

(async () => {
  const text = JSON.stringify(await build(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (have !== text) { console.error('pack-demo-content.json is out of date: run node scripts/build-pack-demo-content.js'); process.exit(1); }
    console.log('pack-demo-content.json is up to date'); return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${Object.keys(JSON.parse(text).packs).length} packs)`);
})().catch((e) => { console.error(e); process.exit(1); });
