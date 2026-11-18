/* eslint-disable @typescript-eslint/no-require-imports */
import * as path from 'path';
import { createHash } from 'crypto';
import { loadKit, rendererDir } from '../src/site-publish/renderer/renderer-loader';
import { ADDON_KEYS, CAPABILITY_KEYS, COMBINATION_TAGS, PACK_KEYS, contentProblems, inspectPackage, marketplaceProblems, PackageProblem } from '../src/v3-theme-market/core/theme-package-core';
import { CATALOGUE_CATEGORIES } from '../src/directory/core/catalogue-categories';
import { PACK_KIT_FALLBACK } from '../src/directory/core/listable-categories';

/**
 * Theme package specification v1: the backend half of the validator, against real packages. The good package is a real library theme repacked with a marketplace block (so the content-free rules are also
 * checked against real templates for false alarms); the bad packages each break exactly one rule and the test names the file and rule.
 */
jest.setTimeout(180_000);
const kit = loadKit();
type Pack = { packFiles(files: Record<string, Buffer>): { zip: Buffer; manifest: Record<string, unknown>; files: Record<string, Buffer> } };
const { packFiles } = require(path.join(rendererDir(), 'lib', 'pack.cjs')) as Pack;
const { readZip, writeZip } = require(path.join(rendererDir(), 'lib', 'zip.cjs')) as { readZip(b: Buffer): { entries: Array<{ path: string; read(n: number): Buffer; size: number }> }; writeZip(e: Array<{ path: string; data: Buffer }>, o?: { allowUnsafePaths?: boolean }): Buffer };
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const buf = (s: string): Buffer => Buffer.from(s, 'utf8');

const MARKET = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [], tags: ['restaurant-plus-delivery'], catalogueCategories: ['restaurant-cafe'].filter((id) => CATALOGUE_CATEGORIES.some((c) => c.id === id)), licence: 'Built by the Get4Domain team for the marketplace.', starter: true, sourceVendorId: null };

/** a real library theme as a file map, re-id'd, with the marketplace block */
function base(over: Record<string, unknown> = {}, id = 'tm1-test-hospitality'): Record<string, Buffer> {
  const dir = path.join(rendererDir(), 'library', 'free-hospitality');
  const files = kit.readThemeDir(dir);
  const m = JSON.parse(files['theme.json'].toString('utf8')) as Record<string, unknown>;
  delete m.contentHash; delete m.assets;
  Object.assign(m, { id, name: 'TM1 test hospitality', marketplace: MARKET, ...over });
  return { ...files, 'theme.json': buf(JSON.stringify(m, null, 2)) };
}
const zipOf = (files: Record<string, Buffer>): Buffer => packFiles(files).zip;
const run = (files: Record<string, Buffer>, ctx: { vendorId: string | null; skipLint?: boolean; forbiddenText?: Array<{ label: string; value: string }>; forbiddenAssetHashes?: Set<string> } = { vendorId: null, skipLint: true }) => inspectPackage(kit, zipOf(files), ctx, sha);
const rules = (ps: PackageProblem[]): string[] => ps.map((p) => `${p.file}|${p.rule}`);

describe('theme package core: vocabularies are data and agree with the platform', () => {
  it('lists the 16 packs, 4 add-ons and 14 capabilities that the seed and the catalogue name', () => {
    expect(PACK_KEYS).toHaveLength(16); expect([...new Set(CATALOGUE_CATEGORIES.map((c) => c.pack))].sort()).toEqual([...PACK_KEYS].sort());
    expect(ADDON_KEYS).toEqual(['SHOP', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER', 'HOME_SAMPLE_COLLECTION']); expect(CAPABILITY_KEYS).toHaveLength(14);
    expect(Object.keys(PACK_KIT_FALLBACK).sort()).toEqual([...PACK_KEYS].sort());
  });
  it('every combination tag names real packs, add-ons and capabilities, and the owner examples exist', () => {
    for (const [k, t] of Object.entries(COMBINATION_TAGS)) {
      expect(k).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const p of t.packsAny) expect(PACK_KEYS).toContain(p); for (const a of t.addons) expect(ADDON_KEYS).toContain(a); for (const c of t.capabilities) expect(CAPABILITY_KEYS).toContain(c);
    }
    for (const k of ['service-plus-shop', 'handyman-plus-shop', 'cloud-kitchen-plus-delivery', 'clinic-pharmacy-lab-home-sample']) expect(COMBINATION_TAGS[k]).toBeDefined();
    expect(COMBINATION_TAGS['clinic-pharmacy-lab-home-sample'].addons).toEqual(['PHARMACY_COUNTER', 'HOME_SAMPLE_COLLECTION']); expect(COMBINATION_TAGS['clinic-pharmacy-lab-home-sample'].capabilities).toEqual(['LAB']);
  });
});

describe('theme package core: a good package', () => {
  it('passes every group, including the kit lint, and reports the content hash', () => {
    const r = run(base(), { vendorId: null });
    expect(r.problems).toEqual([]); expect(r.ok).toBe(true); expect(r.manifest?.id).toBe('tm1-test-hospitality'); expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('the five served library themes are content-free by these rules (no false alarm on real templates)', () => {
    for (const id of ['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']) {
      const files = kit.readThemeDir(path.join(rendererDir(), 'library', id));
      expect(rules(contentProblems(files, {}, sha))).toEqual([]);
    }
  });
  it('a private theme may name its own vendor as the source', () => {
    expect(run(base({ marketplace: { ...MARKET, sourceVendorId: 'v-1' } }), { vendorId: 'v-1', skipLint: true }).problems).toEqual([]);
  });
});

describe('theme package core: each bad package is refused with the file and the rule named', () => {
  const one = (files: Record<string, Buffer>, ctx?: Parameters<typeof run>[1]) => rules(run(files, ctx).problems);

  it('the zip itself: an unsafe path, a script file, an unknown file, a missing required file', () => {
    const f = base();
    const evil = zipFrom({ ...f, '../evil.html': buf('x') }); expect(rules(inspectPackage(kit, evil, { vendorId: null, skipLint: true }, sha).problems)).toContain('../evil.html|path-traversal');
    expect(one({ ...f, 'assets/run.js': buf('alert(1)') })).toContain('assets/run.js|executable-file');
    expect(one({ ...f, 'readme.txt': buf('hello') })).toContain('readme.txt|unknown-file');
    const noHome = { ...f }; delete noHome['templates/home.html']; expect(one(noHome)).toContain('templates/home.html|missing-file');
  });
  it('a script tag or an inline handler in a template is a lint finding on that file', () => {
    const f = base(); const home = f['templates/home.html'].toString('utf8');
    const withScript = run({ ...f, 'templates/home.html': buf(`${home}\n<script>alert(1)</script>`) }, { vendorId: null });
    expect(withScript.problems.some((p) => p.rule === 'no-script-tag' && p.file === 'templates/home.html')).toBe(true);
    const withHandler = run({ ...f, 'templates/home.html': buf(home.replace('<main', '<main onclick="x()"')) }, { vendorId: null });
    expect(withHandler.problems.some((p) => p.rule === 'no-inline-handler')).toBe(true);
  });
  it('an outside address, an e-mail and a phone number in a template are content problems', () => {
    const f = base(); const home = f['templates/home.html'].toString('utf8');
    const r = rules(run({ ...f, 'templates/home.html': buf(`${home}\n<p>Mail owner@example.com or call +91 98765 43210 or see https://shop.example.org/x</p>`) }).problems);
    expect(r).toEqual(expect.arrayContaining(['templates/home.html|content-email', 'templates/home.html|content-phone', 'templates/home.html|content-outside-address']));
  });
  it('the platform placeholders and the allowed map and video hosts are not content', () => {
    const f = base(); const home = f['templates/home.html'].toString('utf8');
    expect(rules(run({ ...f, 'templates/home.html': buf(`${home}\n<a href="tel:{{contact.phoneHref}}">{{contact.phone}}</a><a href="mailto:{{contact.email}}">{{contact.email}}</a><iframe src="https://www.google.com/maps/embed?x=1"></iframe>`) }).problems)).not.toContain('templates/home.html|content-phone');
  });
  it('the marketplace block: missing, unknown names, an incoherent tag, a foreign category and a wrong track', () => {
    const f = base(); const m = (marketplace: unknown) => { const t = JSON.parse(f['theme.json'].toString('utf8')); t.marketplace = marketplace; return { ...f, 'theme.json': buf(JSON.stringify(t)) }; };
    const noBlock = { ...f }; const t = JSON.parse(f['theme.json'].toString('utf8')); delete t.marketplace; noBlock['theme.json'] = buf(JSON.stringify(t));
    expect(one(noBlock)).toEqual(['theme.json|marketplace-required']);
    expect(one(m({ ...MARKET, packs: ['NOT_A_PACK'] }))).toContain('theme.json|marketplace-pack-unknown');
    expect(one(m({ ...MARKET, addons: ['NOT_AN_ADDON'] }))).toContain('theme.json|marketplace-addon-unknown');
    expect(one(m({ ...MARKET, capabilities: ['NOPE'] }))).toContain('theme.json|marketplace-capability-unknown');
    expect(one(m({ ...MARKET, tags: ['made-up-tag'] }))).toContain('theme.json|marketplace-tag-unknown');
    expect(one(m({ ...MARKET, addons: [], tags: ['restaurant-plus-delivery'] }))).toContain('theme.json|marketplace-tag-incoherent');     // the tag needs the add-on listed
    expect(one(m({ ...MARKET, packs: ['CLINIC'], tags: ['restaurant-plus-delivery'] }))).toContain('theme.json|marketplace-tag-incoherent'); // the tag needs a food pack
    expect(one(m({ ...MARKET, catalogueCategories: ['not-a-category'] }))).toContain('theme.json|marketplace-category-unknown');
    const clinicCat = CATALOGUE_CATEGORIES.find((c) => c.pack === 'CLINIC')!.id;
    expect(one(m({ ...MARKET, catalogueCategories: [clinicCat] }))).toContain('theme.json|marketplace-category-pack');
    expect(one(m({ ...MARKET, packs: ['FIELD_SERVICE'], tags: [], addons: [] }))).toContain('theme.json|marketplace-pack-track');           // a professional-track theme is not offered to a handyman pack
    expect(one(m({ ...MARKET, licence: undefined }))).toContain('theme.json|marketplace-licence-missing');
  });
  it('a bad shape is the kit\'s manifest-invalid on theme.json', () => {
    const f = base(); const t = JSON.parse(f['theme.json'].toString('utf8')); t.marketplace = { packs: ['clinic'], price: 5 };
    const r = run({ ...f, 'theme.json': buf(JSON.stringify(t)) }).problems;
    expect(r.filter((p) => p.rule === 'manifest-invalid').every((p) => p.file === 'theme.json')).toBe(true); expect(r.length).toBeGreaterThanOrEqual(2);
  });
  it('a preview that is not in the package, and a source vendor that is not the upload\'s vendor', () => {
    const f = base(); const t = JSON.parse(f['theme.json'].toString('utf8'));
    t.marketplace = { ...MARKET, previews: [{ path: 'assets/previews/home.png', alt: 'Home page of the theme' }] };
    expect(one({ ...f, 'theme.json': buf(JSON.stringify(t)) })).toContain('assets/previews/home.png|marketplace-preview-missing');
    expect(one(base({ marketplace: { ...MARKET, sourceVendorId: 'v-1' } }))).toContain('theme.json|marketplace-source-vendor');                        // marketplace upload: must be empty
    expect(one(base({ marketplace: { ...MARKET, sourceVendorId: 'v-2' } }), { vendorId: 'v-1', skipLint: true })).toContain('theme.json|marketplace-source-vendor');   // private upload: must be the same vendor
  });
  it('a package marked internal is refused', () => { expect(one(base({ internal: true }))).toContain('theme.json|marketplace-internal'); });
  it('forbidden text (a business detail) and a forbidden media hash are content problems (used by M4)', () => {
    const f = base(); const home = f['templates/home.html'].toString('utf8');
    const r = rules(run({ ...f, 'templates/home.html': buf(`${home}\n<p>Sharma Plumbing Works</p>`) }, { vendorId: null, skipLint: true, forbiddenText: [{ label: 'name', value: 'Sharma Plumbing Works' }] }).problems);
    expect(r).toContain('templates/home.html|content-vendor-detail');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
    const withMedia = run({ ...f, 'assets/logo.png': png }, { vendorId: null, skipLint: true, forbiddenAssetHashes: new Set([sha(png)]) });
    expect(rules(withMedia.problems)).toContain('assets/logo.png|content-vendor-media');
  });
  it('every problem has a file, a rule and a plain message, and never echoes file content', () => {
    const f = base(); const r = run({ ...f, 'readme.txt': buf('SECRET-BODY-TEXT') }).problems;
    for (const p of r) { expect(typeof p.file).toBe('string'); expect(p.rule).toMatch(/^[a-z0-9-]+$/); expect(p.message.length).toBeGreaterThan(5); expect(p.message).not.toContain('SECRET-BODY-TEXT'); }
  });
  it('marketplaceProblems alone never throws on a sparse manifest', () => {
    expect(() => marketplaceProblems({ id: 'x', name: 'x', tier: 'Standard', tracks: [], families: [], categories: [], version: 1, marketplace: { packs: [] } }, {}, { vendorId: null })).not.toThrow();
  });
});

/** a zip with entries the kit's own writer would not make (an unsafe path): written with the kit's test-only allowUnsafePaths flag */
function zipFrom(files: Record<string, Buffer>): Buffer { return writeZip(Object.entries(files).map(([p, data]) => ({ path: p, data })), { allowUnsafePaths: true }); }
void readZip;
