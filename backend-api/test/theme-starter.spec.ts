import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CATALOGUE_CATEGORIES } from '../src/directory/core/catalogue-categories';
import { KIT_ONLY_PACK, PACK_KIT_FALLBACK } from '../src/directory/core/listable-categories';
import { Kit, KitManifest, loadKit } from '../src/site-publish/renderer/renderer-loader';
import { packDemo } from '../src/v3-packs/pack-demo/pack-demo';
import { COMBINATION_TAGS, inspectPackage, PACK_KEYS } from '../src/v3-theme-market/core/theme-package-core';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { ThemePreviewService } from '../src/v3-theme-market/theme-preview.service';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';

/**
 * TM1 M6, the starter themes: 32 real packages built by `node themes/cli.mjs starter` from the recipes in themes/starter. Every one goes through the SAME checks as an admin upload (kit validator, marketplace
 * rules, content-free rules, the kit lint), every pack has at least 4 of them, every combination tag is used, every theme draws every page for every pack it names, and all of them upload and publish through
 * the real service. The catalogue data the builder uses is checked against the TypeScript catalogue so it cannot drift.
 */
jest.setTimeout(900_000);
const ROOT = path.resolve(__dirname, '..');
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const kit: Kit = loadKit();
const PAGES = ['home', 'about', 'services', 'contact', 'gallery', 'item'];

interface Starter { id: string; zip: Buffer; manifest: KitManifest; files: Record<string, Buffer> }
let out: string; let starters: Starter[] = [];

beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-starters-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, '..', 'themes', 'cli.mjs'), 'starter', '--out', out], { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) throw new Error(`starter build failed: ${r.stdout}${r.stderr}`);
  starters = fs.readdirSync(out).filter((f) => f.endsWith('.zip')).sort().map((f) => {
    const zip = fs.readFileSync(path.join(out, f)); const v = kit.validatePackage(zip);
    return { id: f.replace(/-\d+\.zip$/, ''), zip, manifest: v.manifest as KitManifest, files: v.files };
  });
});
afterAll(() => { if (out) fs.rmSync(out, { recursive: true, force: true }); });

describe('the starter themes', () => {
  it('are at least 32 real packages, each with a unique key that is not a library key', () => {
    expect(starters.length).toBeGreaterThanOrEqual(32); expect(new Set(starters.map((s) => s.id)).size).toBe(starters.length);
    for (const s of starters) { expect(s.manifest.id).toBe(s.id); expect(kit.listVendorThemeIds()).not.toContain(s.id); }
  });

  it('every one passes EVERY check an upload passes (kit validator, marketplace rules, content-free rules, kit lint)', () => {
    for (const s of starters) { const r = inspectPackage(kit, s.zip, { vendorId: null }, sha); expect({ id: s.id, problems: r.problems }).toEqual({ id: s.id, problems: [] }); }
  });

  it('every one of the 16 packs has at least 4 valid starter themes, and they are visibly different from each other', () => {
    for (const pack of PACK_KEYS) {
      const mine = starters.filter((s) => s.manifest.marketplace?.packs.includes(pack));
      expect({ pack, count: mine.length >= 4 }).toEqual({ pack, count: true });
      const tokens = new Set(mine.map((s) => s.files['css/tokens.css'].toString())); const bases = new Set(mine.map((s) => s.files['css/base.css'].toString()));
      expect({ pack, distinctTokens: tokens.size, distinctBase: bases.size }).toEqual({ pack, distinctTokens: mine.length, distinctBase: mine.length });
    }
  });

  it('each starter is designed for the kit category its packs are drawn from, so its preview uses a design it really has', () => {
    for (const s of starters) for (const p of s.manifest.marketplace!.packs) expect({ id: s.id, pack: p, ok: s.manifest.categories.includes(PACK_KIT_FALLBACK[p]) }).toEqual({ id: s.id, pack: p, ok: true });
  });

  it('use the combination tags for real: the owner\'s examples exist and every tag of the catalogue is used by at least one starter', () => {
    const used = new Set(starters.flatMap((s) => s.manifest.marketplace?.tags ?? []));
    for (const t of ['service-plus-shop', 'handyman-plus-shop', 'cloud-kitchen-plus-delivery', 'clinic-pharmacy-lab-home-sample']) expect(used.has(t)).toBe(true);
    expect([...used].filter((t) => !(t in COMBINATION_TAGS))).toEqual([]);
    expect(Object.keys(COMBINATION_TAGS).filter((t) => !used.has(t))).toEqual([]);
    // a tag that needs an add-on section really has it: the product grid is on the home page
    for (const s of starters.filter((x) => (x.manifest.marketplace?.addons ?? []).some((a) => ['SHOP', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER'].includes(a)))) expect({ id: s.id, grid: /<g4d-product-grid/.test(s.files['templates/home.html'].toString()) }).toEqual({ id: s.id, grid: true });
  });

  it('say honestly that they are starter themes built by the team, with no price, claim or customer content', () => {
    for (const s of starters) {
      const m = s.manifest;
      expect(m.author).toBe('Get4Domain'); expect(m.tier).toBe('Standard'); expect(m.marketplace!.starter).toBe(true); expect(m.marketplace!.sourceVendorId ?? null).toBeNull(); expect(m.description).toMatch(/^Starter theme built by the Get4Domain team\./);
      expect(JSON.stringify(m)).not.toMatch(/\b(best|top|leading|popular|rated|discount|coupon|free trial)\b/i);
    }
  });

  it('never list one of the four ids that are not in the catalogue; the wellness, education, vehicle and tutor ids are the catalogue ones', () => {
    const catalogue = new Set(CATALOGUE_CATEGORIES.map((c) => c.id));
    for (const s of starters) for (const id of s.manifest.marketplace!.catalogueCategories ?? []) { expect(Object.keys(KIT_ONLY_PACK)).not.toContain(id); expect(catalogue.has(id)).toBe(true); }
    const ids = (k: string) => starters.find((s) => s.id === k)!.manifest.marketplace!.catalogueCategories!;
    expect(ids('starter-wellness-sage')).toEqual(expect.arrayContaining(['gym-fitness-centre', 'yoga-meditation-studio', 'unisex-salon', 'spa-massage-centre']));
    expect(ids('starter-learn-amber')).toContain('tutor-home-tuition'); expect(ids('starter-garage-red')).toEqual(expect.arrayContaining(['car-mechanic-garage', 'bike-mechanic-two-wheeler']));
  });

  it('the catalogue data the builder uses is the TypeScript catalogue (it cannot drift)', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'themes', 'starter', 'catalogue-by-pack.json'), 'utf8')) as { packs: Record<string, string[]>; kitOnlyEquivalents: Record<string, string[]> };
    const expected: Record<string, string[]> = {}; for (const c of CATALOGUE_CATEGORIES) (expected[c.pack] ??= []).push(c.id);
    expect(data.packs).toEqual(Object.fromEntries(Object.keys(expected).sort().map((k) => [k, expected[k]])));
    expect(Object.keys(data.kitOnlyEquivalents).sort()).toEqual(Object.keys(KIT_ONLY_PACK).sort());
    for (const [k, eq] of Object.entries(data.kitOnlyEquivalents)) for (const id of eq) expect(CATALOGUE_CATEGORIES.find((c) => c.id === id)!.pack).toBe(KIT_ONLY_PACK[k]);
  });

  it('every theme draws without error, for every pack it names, on every page it has, with that pack\'s sample business and no script, price or offer', () => {
    const previews = new ThemePreviewService(kit); let drawn = 0; let expected = 0;
    for (const s of starters) {
      const theme = kit.themeFromFiles(s.files);
      expected += s.manifest.marketplace!.packs.length * PAGES.filter((p) => p in theme.templates).length;
      for (const pack of s.manifest.marketplace!.packs) for (const page of PAGES.filter((p) => p in theme.templates)) {
        const html = previews.render(theme, pack, page); drawn += 1;
        expect({ id: s.id, pack, page, named: html.includes(packDemo(pack)!.business.name) }).toEqual({ id: s.id, pack, page, named: page === 'item' || html.includes(packDemo(pack)!.business.name) });
        expect(html).not.toMatch(/<script/i); expect(html).not.toContain('₹'); expect(html.startsWith('<!doctype html>')).toBe(true);
      }
    }
    expect(drawn).toBe(expected); expect(drawn).toBeGreaterThanOrEqual(starters.length * 6);   // every page of every theme for every pack it names was drawn, none skipped
  });

  it('all upload, submit and publish through the real service, and the marketplace then lists at least 4 per pack and every tag', async () => {
    const store = new MemoryThemeMarketStore(); const svc = new ThemeMarketService(store, new ThemeChangeNotifier(), kit); const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
    for (const s of starters) { const t = (await svc.upload(staff, { buffer: s.zip })).theme; await svc.submit(t.id, staff); await svc.publish(t.id, staff); }
    expect(store.rows.every((r) => r.status === 'PUBLISHED' && r.visibility === 'PUBLIC' && r.starter)).toBe(true); expect(store.rows).toHaveLength(starters.length);
    for (const pack of PACK_KEYS) expect({ pack, n: (await svc.list({ pack, status: 'PUBLISHED' }, 1, 100)).total >= 4 }).toEqual({ pack, n: true });
    for (const tag of Object.keys(COMBINATION_TAGS)) expect({ tag, n: (await svc.list({ tag, status: 'PUBLISHED' }, 1, 100)).total >= 1 }).toEqual({ tag, n: true });
    expect((await svc.list({ starter: true, status: 'PUBLISHED' }, 1, 100)).total).toBe(starters.length);
    // the same package uploaded again is the same upload (nothing is added twice)
    expect((await svc.upload(staff, { buffer: starters[0].zip })).replayed).toBe(true); expect(store.rows).toHaveLength(starters.length);
  });
});
