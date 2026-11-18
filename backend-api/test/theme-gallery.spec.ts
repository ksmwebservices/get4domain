import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import demo from '../src/v3-packs/pack-demo/pack-demo-content.json';
import { PACK_KIT_FALLBACK } from '../src/directory/core/listable-categories';
import { isPremium, packCategoriesWithKit, previewRef, themesForPack, ThemeLite } from '../src/v3-theme-catalog/core/theme-catalog-core';
import { KIT_ONLY_PACK } from '../src/directory/core/listable-categories';
import { stripPrices } from '../src/v3-theme-catalog/theme-catalog.service';

/** Dispatch G1 B6: the theme gallery script's output shape, the pack demo content, and the catalogue rules for kit-only categories and neighbouring-trade packs. */
jest.setTimeout(240_000);
const ROOT = path.resolve(__dirname, '..');
const run = (args: string[]) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-theme-gallery.js'), ...args], { encoding: 'utf8', cwd: ROOT });
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-gallery-'));
const PACKS = Object.keys((demo as { packs: Record<string, unknown> }).packs);

describe('the pack demo content', () => {
  it('has all 16 packs, each with services, people and questions, and no price anywhere', () => {
    expect(PACKS).toHaveLength(16); expect(PACKS.sort()).toEqual(Object.keys(PACK_KIT_FALLBACK).sort());
    for (const k of PACKS) {
      const p = (demo as unknown as { packs: Record<string, { business: { name: string }; services: unknown[]; people: unknown[]; faqs: unknown[]; kitCategory: string }> }).packs[k];
      expect(p.business.name.length).toBeGreaterThan(3); expect(p.services.length).toBeGreaterThanOrEqual(5); expect(p.people.length).toBe(3); expect(p.faqs.length).toBeGreaterThanOrEqual(3); expect(p.kitCategory).toBe(PACK_KIT_FALLBACK[k]);
    }
    expect(JSON.stringify(demo)).not.toMatch(/₹|\bRs\.?\s?\d|"price"|\bdiscount\b|% off/i);
  });
  it('a clinic shows clinic services and an accountant shows accounting services; the four neighbouring-trade packs have their own business', () => {
    const d = (demo as unknown as { packs: Record<string, { business: { name: string }; services: Array<{ name: string }> }> }).packs;
    expect(d.CLINIC.services.map((s) => s.name).join(' ')).toMatch(/consultation|clinic|health/i); expect(d.PRACTICE_LEGAL_FINANCE.services.map((s) => s.name).join(' ')).toMatch(/tax|GST|company/i);
    expect(d.PHARMACY.business.name).toBe('Sri Lakshmi Medicals'); expect(d.B2B_DEALER.business.name).toBe('Vel Industrial Supplies'); expect(d.RENTAL_FLEET.business.name).toBe('Kaveri Cabs and Rentals'); expect(d.MEMBERSHIP_WELLNESS.business.name).toBe('Fitwell Gym and Yoga Studio');
    expect(new Set(PACKS.map((k) => d[k].business.name)).size).toBeGreaterThanOrEqual(15);   // one business per pack (the two that share a kit category are the only repeat)
  });
  it('is exactly what the generator produces (so nobody edits it by hand)', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-pack-demo-content.js'), '--check'], { encoding: 'utf8', cwd: ROOT });
    expect({ status: r.status, err: r.stderr }).toEqual({ status: 0, err: '' });
  });
});

describe('the theme gallery script', () => {
  it('writes an index and one folder per pack and theme, with plain HTML and a machine-readable summary; no price, no offer', () => {
    const out = tmp();
    try {
      const r = run(['--out', out, '--packs', 'CLINIC,PHARMACY', '--pages', 'home,about', '--library-only']);
      expect(r.status).toBe(0); expect(r.stdout).toMatch(/5 themes x 2 packs, 10 rendered, 0 MISSING/);
      const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
      expect(index).toContain('Clinic and patient care'); expect(index).toContain('Sri Lakshmi Medicals'); expect(index).toContain('noindex'); expect(index).toContain('href="CLINIC/free-practice/home.html"');
      for (const pack of ['CLINIC', 'PHARMACY']) for (const theme of ['free-practice', 'free-shop-lite', 'free-studio', 'free-hospitality', 'free-service-pro']) for (const page of ['home', 'about']) {
        const html = fs.readFileSync(path.join(out, pack, theme, `${page}.html`), 'utf8');
        expect(html.startsWith('<!doctype html>')).toBe(true); expect(html).toContain('<style>'); expect(html).not.toMatch(/₹|% off|Free delivery/);
      }
      expect(fs.readFileSync(path.join(out, 'PHARMACY', 'free-shop-lite', 'home.html'), 'utf8')).toContain('Sri Lakshmi Medicals');
      const g = JSON.parse(fs.readFileSync(path.join(out, 'gallery.json'), 'utf8'));
      expect(g.packs.map((p: { pack: string }) => p.pack)).toEqual(['CLINIC', 'PHARMACY']); expect(g.packs[0].themes).toHaveLength(5);
      expect(g.packs[0].themes.find((t: { id: string }) => t.id === 'free-practice')).toMatchObject({ state: 'RENDERED', designedFor: true });
      expect(g.packs[0].themes.find((t: { id: string }) => t.id === 'free-shop-lite')).toMatchObject({ state: 'RENDERED', designedFor: false });
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  it('a theme folder with no real template is marked MISSING and nothing is drawn for it', () => {
    const out = tmp(); const bad = path.join(tmp(), 'broken-theme');
    try {
      fs.mkdirSync(path.join(bad, 'templates'), { recursive: true }); fs.mkdirSync(path.join(bad, 'css'), { recursive: true });
      fs.writeFileSync(path.join(bad, 'theme.json'), JSON.stringify({ id: 'broken-theme', version: 1, name: 'Broken', tier: 'Standard', tracks: ['professional'], families: ['healthcare'], categories: ['doctor-clinic'] }));
      const script = `const g=require(${JSON.stringify(path.join(ROOT, 'scripts', 'build-theme-gallery.js'))});g.buildGallery({out:${JSON.stringify(out)},packs:['CLINIC'],pages:['home'],starters:false,extraDirs:[${JSON.stringify(bad)}]}).then(r=>{console.log(JSON.stringify(r));process.exit(0)}).catch(e=>{console.error(e);process.exit(1)});`;
      const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', cwd: ROOT }); expect(r.status).toBe(0);
      const sum = JSON.parse(r.stdout.trim().split('\n').pop()!); expect(sum).toMatchObject({ themes: 6, rendered: 5, missing: 1 });
      const g = JSON.parse(fs.readFileSync(path.join(out, 'gallery.json'), 'utf8')); expect(g.packs[0].themes.find((t: { id: string }) => t.id === 'broken-theme')).toMatchObject({ state: 'MISSING', pages: [] });
      expect(fs.existsSync(path.join(out, 'CLINIC', 'broken-theme'))).toBe(false); expect(fs.readFileSync(path.join(out, 'index.html'), 'utf8')).toContain('MISSING');
    } finally { fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(path.dirname(bad), { recursive: true, force: true }); }
  });
  it('by default also draws the starter themes, only for the packs they name, and lists their add-ons and combinations (TM1 M6)', () => {
    const out = tmp();
    try {
      const r = run(['--out', out, '--packs', 'CLINIC,PHARMACY', '--pages', 'home']);
      expect(r.status).toBe(0); expect(r.stdout).toMatch(/37 themes x 2 packs, \d+ rendered, 0 MISSING/);
      const g = JSON.parse(fs.readFileSync(path.join(out, 'gallery.json'), 'utf8'));
      type Row = { id: string; state: string; designedFor: boolean | null; starter: boolean; tags: string[]; addons: string[]; pages: string[] };
      const clinic = g.packs.find((p: { pack: string }) => p.pack === 'CLINIC').themes as Row[]; const pharmacy = g.packs.find((p: { pack: string }) => p.pack === 'PHARMACY').themes as Row[];
      expect(clinic.filter((t) => !t.starter)).toHaveLength(5); expect(clinic.filter((t) => t.starter).length).toBeGreaterThanOrEqual(4); expect(pharmacy.filter((t) => t.starter).length).toBeGreaterThanOrEqual(4);
      for (const t of [...clinic, ...pharmacy].filter((x) => x.starter)) expect(t).toMatchObject({ state: 'RENDERED', designedFor: true });
      expect(clinic.find((t) => t.id === 'starter-clinic-teal')).toMatchObject({ addons: ['PHARMACY_COUNTER', 'HOME_SAMPLE_COLLECTION'], tags: expect.arrayContaining(['clinic-pharmacy-lab-home-sample']) });
      expect(g.combinations['clinic-pharmacy-lab-home-sample']).toEqual(['starter-clinic-teal']); expect(Object.keys(g.combinations).sort()).toEqual(['clinic-pharmacy-lab-home-sample', 'clinic-plus-lab', 'clinic-plus-pharmacy', 'lab-plus-home-sample', 'pharmacy-plus-delivery']);   // only the combinations of the packs drawn
      expect(fs.existsSync(path.join(out, 'PHARMACY', 'starter-shop-fresh', 'home.html'))).toBe(true); expect(fs.existsSync(path.join(out, 'CLINIC', 'starter-shop-fresh'))).toBe(false);   // drawn only for the packs it names
      const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
      expect(index).toContain('Combinations'); expect(index).toContain('clinic pharmacy lab home sample'); expect(index).toContain('starter theme</strong> built by the team'); expect(index).toContain('pharmacy + delivery'); expect(index).not.toMatch(/₹|% off/);
      expect(fs.readFileSync(path.join(out, 'CLINIC', 'starter-clinic-teal', 'home.html'), 'utf8')).toContain('<style>');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  it('the full gallery lists at least 4 starter themes for each of the 16 packs, and every combination, and every page of every one is drawn', () => {
    const out = tmp();
    try {
      const r = run(['--out', out]);
      expect(r.status).toBe(0); expect(r.stdout).toMatch(/37 themes x 16 packs, \d+ rendered, 0 MISSING/);
      const g = JSON.parse(fs.readFileSync(path.join(out, 'gallery.json'), 'utf8'));
      type Row = { id: string; state: string; starter: boolean; pages: string[] };
      expect(g.packs).toHaveLength(16); expect(g.starters).toBeGreaterThanOrEqual(32);
      for (const pk of g.packs as Array<{ pack: string; themes: Row[] }>) { const st = pk.themes.filter((t) => t.starter); expect({ pack: pk.pack, starters: st.length >= 4 }).toEqual({ pack: pk.pack, starters: true }); expect(pk.themes.every((t) => t.state === 'RENDERED' && t.pages.length === 4)).toBe(true); }
      expect(Object.keys(g.combinations).sort()).toEqual(['clinic-pharmacy-lab-home-sample', 'clinic-plus-lab', 'clinic-plus-pharmacy', 'cloud-kitchen-plus-delivery', 'education-plus-shop', 'handyman-plus-shop', 'hospitality-plus-shop', 'lab-plus-home-sample', 'pharmacy-plus-delivery', 'restaurant-plus-delivery', 'service-plus-shop', 'shop-plus-delivery', 'vehicle-service-plus-shop', 'wellness-plus-shop']);
      expect(fs.readFileSync(path.join(out, 'index.html'), 'utf8')).toContain('37 themes (5 library, 32 starter) by 16 packs');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  it('refuses an unknown argument', () => { const r = run(['--nope']); expect(r.status).toBe(1); });
});

describe('the theme catalogue per pack', () => {
  const T = (id: string, categories: string[], tracks = ['professional'], tier = 'Standard'): ThemeLite => ({ id, name: id, tier, tracks, categories });
  const themes = [T('studio', ['coaching-centre', 'tutor', 'salon-spa', 'gym-yoga']), T('practice', ['doctor-clinic', 'it-consultant', 'ca-tax-consultant']), T('shop', ['grocery-kirana', 'electronics-mobile'], ['ecommerce']), T('hospitality', ['travel-agency', 'hotel-homestay', 'restaurant-cafe'])];
  it('the four kit-only categories count toward their pack (MEMBERSHIP_WELLNESS now finds the studio theme by category)', () => {
    expect(packCategoriesWithKit(['spa-wellness-x'], 'MEMBERSHIP_WELLNESS', KIT_ONLY_PACK)).toEqual(['spa-wellness-x', 'gym-yoga', 'salon-spa']);
    expect(packCategoriesWithKit(['a'], 'CLINIC', KIT_ONLY_PACK)).toEqual(['a']);
    expect(packCategoriesWithKit([], 'VEHICLE_SERVICE', KIT_ONLY_PACK)).toEqual(['auto-mechanic']); expect(packCategoriesWithKit([], 'EDUCATION', KIT_ONLY_PACK)).toEqual(['tutor']);
    const keys = packCategoriesWithKit(['wellness-centre'], 'MEMBERSHIP_WELLNESS', KIT_ONLY_PACK);
    expect(themesForPack(themes, keys, ['professional'], PACK_KIT_FALLBACK.MEMBERSHIP_WELLNESS)).toMatchObject({ matchedBy: 'CATEGORY', themes: [{ id: 'studio' }] });
  });
  it('a pack with no designed category uses the theme of its kit category (PHARMACY the shop, B2B_DEALER the practice, RENTAL_FLEET the hospitality), marked KIT_FALLBACK; only then the track', () => {
    expect(themesForPack(themes, ['pharmacy-x'], ['ecommerce'], PACK_KIT_FALLBACK.PHARMACY)).toMatchObject({ matchedBy: 'KIT_FALLBACK', themes: [{ id: 'shop' }] });
    expect(themesForPack(themes, ['dealer-x'], ['ecommerce'], PACK_KIT_FALLBACK.B2B_DEALER)).toMatchObject({ matchedBy: 'KIT_FALLBACK', themes: [{ id: 'practice' }] });
    expect(themesForPack(themes, ['fleet-x'], ['professional'], PACK_KIT_FALLBACK.RENTAL_FLEET)).toMatchObject({ matchedBy: 'KIT_FALLBACK', themes: [{ id: 'hospitality' }] });
    expect(themesForPack(themes, ['x'], ['ecommerce'], null).matchedBy).toBe('TRACK'); expect(themesForPack(themes, ['x'], ['nothing'], 'no-such-category').matchedBy).toBe('NONE');
  });
  it('the premium flag reads the tier; the preview reference is a generated path with the theme and pack encoded', () => {
    expect(isPremium('Premium')).toBe(true); expect(isPremium('Standard')).toBe(false);
    expect(previewRef('free-studio', 'CLINIC')).toEqual({ kind: 'GENERATED', path: '/v3/public/themes/free-studio/preview?pack=CLINIC' });
    expect(previewRef('a b', 'X&Y').path).toBe('/v3/public/themes/a%20b/preview?pack=X%26Y');
  });
  it('a preview never carries a price', () => {
    expect(JSON.stringify(stripPrices({ items: [{ name: 'a', price: '₹300' }], groups: [{ items: [{ price: '₹1' }] }], offers: [{ price: '₹2', title: 't' }] }))).not.toMatch(/₹/);
  });
});
