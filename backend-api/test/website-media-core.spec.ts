import { bannerChoices, checkAlt, checkUpload, isRegulatedFamily, planBannerLoad, storagePathFor, validateManifest } from '../src/v3-website/core/media-core';
import { validateWebsiteSetting, resolveWebsiteSettings, DEFAULT_WEBSITE_SETTINGS } from '../src/v3-website/settings/website-settings';

/** Slice 5.5b (pure): upload checks, alt text, storage paths, the banner manifest and the loader plan, the regulated-category rule, the settings. */
const S = { mediaMaxBytes: 1000, mediaAllowedTypes: ['image/png', 'image/jpeg'], mediaMaxPixels: 4_000_000 };
const code = (r: { ok: boolean; code?: string } | null): string => (r === null ? 'OK' : r.ok ? 'OK' : r.code ?? '?');

describe('settings: no invented caps', () => {
  it('every media setting starts unset, so uploads are refused until staff set them', () => {
    expect(DEFAULT_WEBSITE_SETTINGS).toMatchObject({ mediaMaxBytes: null, mediaAllowedTypes: null, mediaMaxPixels: null });
    expect(code(checkUpload({ mediaMaxBytes: null, mediaAllowedTypes: null, mediaMaxPixels: null }, { size: 10, declared: 'image/png', detected: 'image/png' }))).toBe('MEDIA_NOT_CONFIGURED');
    expect(code(checkUpload({ ...S, mediaMaxPixels: null }, { size: 10, declared: 'image/png', detected: 'image/png' }))).toBe('MEDIA_NOT_CONFIGURED');
  });
  it('the settings API accepts whole numbers and raster types only', () => {
    expect(() => validateWebsiteSetting('mediaMaxBytes', 2_000_000)).not.toThrow();
    for (const bad of [0, -1, 1.5, '5', null]) expect(() => validateWebsiteSetting('mediaMaxBytes', bad)).toThrow();
    expect(() => validateWebsiteSetting('mediaAllowedTypes', ['image/png', 'image/webp'])).not.toThrow();
    for (const bad of [['image/svg+xml'], ['image/gif'], [], 'image/png', ['image/png', 'image/png']]) expect(() => validateWebsiteSetting('mediaAllowedTypes', bad)).toThrow();
    expect(() => validateWebsiteSetting('nope', 1)).toThrow();
  });
  it('an invalid stored value falls back to unset', () => { expect(resolveWebsiteSettings(new Map<string, unknown>([['mediaMaxBytes', -5], ['mediaAllowedTypes', ['image/jpeg']]]))).toMatchObject({ mediaMaxBytes: null, mediaAllowedTypes: ['image/jpeg'] }); });
});

describe('checking an upload', () => {
  const ok = { size: 500, declared: 'image/png', detected: 'image/png' };
  it('accepts a file within the caps whose bytes match its declared type', () => { expect(code(checkUpload(S, ok))).toBe('OK'); });
  it('refuses an empty file, a file over the byte cap, a type outside the list, an SVG, and unknown bytes', () => {
    expect(code(checkUpload(S, { ...ok, size: 0 }))).toBe('MEDIA_INVALID');
    expect(code(checkUpload(S, { ...ok, size: 1001 }))).toBe('MEDIA_TOO_LARGE');
    expect(code(checkUpload(S, { size: 10, declared: 'image/webp', detected: 'image/webp' }))).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(code(checkUpload(S, { size: 10, declared: 'image/svg+xml', detected: 'image/svg+xml' }))).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(code(checkUpload(S, { size: 10, declared: 'image/png', detected: null }))).toBe('MEDIA_TYPE_NOT_ALLOWED');
  });
  it('refuses a file whose bytes say one type and whose label says another (a renamed file)', () => { expect(code(checkUpload(S, { size: 10, declared: 'image/jpeg', detected: 'image/png' }))).toBe('MEDIA_TYPE_MISMATCH'); });
  it('image/jpg is accepted as the jpeg label', () => { expect(code(checkUpload(S, { size: 10, declared: 'image/jpg', detected: 'image/jpeg' }))).toBe('OK'); });
});

describe('alt text', () => {
  it('is required, plain text, short, and free of promises', () => {
    expect(code(checkAlt(''))).toBe('ALT_REQUIRED'); expect(code(checkAlt('   '))).toBe('ALT_REQUIRED'); expect(code(checkAlt(undefined))).toBe('ALT_REQUIRED');
    expect(code(checkAlt('<b>tap</b>'))).toBe('FIELD_INVALID'); expect(code(checkAlt('x'.repeat(161)))).toBe('FIELD_INVALID');
    expect(code(checkAlt('Guaranteed number 1 ranking'))).toBe('WORDING_NOT_ALLOWED');
    const r = checkAlt('  A plumber fitting a tap  '); expect(r.ok && r.alt).toBe('A plumber fitting a tap');
  });
});

describe('storage paths are per vendor', () => {
  it('put the vendor id and the content hash in the path, with the type\'s extension', () => {
    expect(storagePathFor('v1', 'abc123', 'image/png')).toBe('vendors/v1/media/abc123.png'); expect(storagePathFor('v1', 'abc123', 'image/jpeg')).toBe('vendors/v1/media/abc123.jpg');
    expect(storagePathFor('v2', 'abc123', 'image/webp')).not.toContain('v1');
  });
  it('refuses a vendor id that could climb out of its folder', () => { expect(() => storagePathFor('../x', 'a', 'image/png')).toThrow(); expect(() => storagePathFor('a/b', 'a', 'image/png')).toThrow(); });
});

describe('the banner manifest', () => {
  const cats = ['plumber', 'dentist', 'lawyer'];
  const row = (over: Record<string, unknown> = {}) => ({ file: 'plumber-1.jpg', sourceUrl: 'https://images.example.test/p1', author: 'A Photographer', licence: 'CC0', obtainedOn: '2026-10-01', category: 'plumber', alt: 'A plumber at work', hasPeople: true, ...over });
  it('accepts a complete row', () => { const r = validateManifest([row()], cats, '2026-11-11'); expect(r.errors).toEqual([]); expect(r.rows).toHaveLength(1); });
  it('requires the source URL, author, licence, date obtained, category and alt for EVERY image', () => {
    for (const k of ['sourceUrl', 'author', 'licence', 'obtainedOn', 'category', 'alt', 'file']) expect(validateManifest([row({ [k]: '' })], cats, '2026-11-11').errors.length).toBeGreaterThan(0);
    expect(validateManifest([row({ hasPeople: undefined })], cats, '2026-11-11').errors.length).toBeGreaterThan(0);
  });
  it('refuses a non-https source, an unknown category, a future or malformed date, a path in the file name, a duplicate file', () => {
    for (const bad of [row({ sourceUrl: 'http://x.test/a' }), row({ category: 'astronaut' }), row({ obtainedOn: '2027-01-01' }), row({ obtainedOn: 'yesterday' }), row({ file: '../x.jpg' }), row({ file: 'a/b.jpg' })]) expect(validateManifest([bad], cats, '2026-11-11').errors.length).toBeGreaterThan(0);
    expect(validateManifest([row(), row()], cats, '2026-11-11').errors.length).toBeGreaterThan(0);
  });
  it('a manifest that is not a list is an error', () => { expect(validateManifest({} as never, cats, '2026-11-11').errors.length).toBeGreaterThan(0); });
});

describe('the loader plan', () => {
  const rows = validateManifest([
    { file: 'a.jpg', sourceUrl: 'https://i.example.test/a', author: 'X', licence: 'CC0', obtainedOn: '2026-10-01', category: 'plumber', alt: 'A', hasPeople: false },
    { file: 'b.jpg', sourceUrl: 'https://i.example.test/b', author: 'Y', licence: 'CC0', obtainedOn: '2026-10-01', category: 'dentist', alt: 'B', hasPeople: true },
    { file: 'ghost.jpg', sourceUrl: 'https://i.example.test/g', author: 'Z', licence: 'CC0', obtainedOn: '2026-10-01', category: 'plumber', alt: 'G', hasPeople: false },
  ], ['plumber', 'dentist'], '2026-11-11').rows;
  it('REFUSES an image that has no manifest row, and reports a row that has no image', () => {
    const p = planBannerLoad([{ name: 'a.jpg', sha256: 'h1' }, { name: 'b.jpg', sha256: 'h2' }, { name: 'loose.jpg', sha256: 'h3' }], rows, []);
    expect(p.refused).toEqual([{ file: 'loose.jpg', reason: 'NO_MANIFEST_ROW' }]); expect(p.create.map((c) => c.file)).toEqual(['a.jpg', 'b.jpg']); expect(p.rowsWithoutFile).toEqual(['ghost.jpg']);
  });
  it('is idempotent: an image already loaded for the category is unchanged, and changed licence data is an update', () => {
    const p = planBannerLoad([{ name: 'a.jpg', sha256: 'h1' }], rows, [{ categoryId: 'plumber', sha256: 'h1', author: 'X', licenceName: 'CC0', sourceUrl: 'https://i.example.test/a', obtainedOn: '2026-10-01', altText: 'A', hasPeople: false }]);
    expect(p.unchanged.map((u) => u.file)).toEqual(['a.jpg']); expect(p.create).toEqual([]); expect(p.update).toEqual([]);
    const q = planBannerLoad([{ name: 'a.jpg', sha256: 'h1' }], rows, [{ categoryId: 'plumber', sha256: 'h1', author: 'OLD', licenceName: 'CC0', sourceUrl: 'https://i.example.test/a', obtainedOn: '2026-10-01', altText: 'A', hasPeople: false }]);
    expect(q.update.map((u) => u.file)).toEqual(['a.jpg']);
  });
});

describe('choosing a banner for a category', () => {
  const item = (id: string, categoryId: string, hasPeople: boolean, active = true) => ({ id, categoryId, hasPeople, active });
  const all = [item('p1', 'plumber', true), item('p2', 'plumber', false), item('p3', 'plumber', false, false), item('d1', 'dentist', true), item('d2', 'dentist', false), item('l1', 'lawyer', true)];
  it('lists the active banners of the vendor\'s own category only', () => { expect(bannerChoices(all, { categoryId: 'plumber', family: 'home-services' }).map((x) => x.id)).toEqual(['p1', 'p2']); });
  it('healthcare and legal-finance default to banners without identifiable people; staff may ask for all', () => {
    expect(isRegulatedFamily('healthcare')).toBe(true); expect(isRegulatedFamily('legal-finance')).toBe(true); expect(isRegulatedFamily('home-services')).toBe(false);
    expect(bannerChoices(all, { categoryId: 'dentist', family: 'healthcare' }).map((x) => x.id)).toEqual(['d2']);
    expect(bannerChoices(all, { categoryId: 'lawyer', family: 'legal-finance' }).map((x) => x.id)).toEqual([]);
    expect(bannerChoices(all, { categoryId: 'dentist', family: 'healthcare' }, { includePeople: true }).map((x) => x.id)).toEqual(['d1', 'd2']);
  });
});
