import { runBannerLoad } from '../src/v3-website/media/banner-loader';
import { actionFor, vendorOf } from '../src/v3-activity/core/action-table';
import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice 5.5b: pictures and the Banner Library through the real services over memory twins and the fake storage and image ports. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const PNG = (extra = 'a') => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(extra)]);
const JPG = (extra = 'a') => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(extra)]);
const file = (buffer: Buffer, mimetype = 'image/png') => ({ buffer, mimetype, size: buffer.length });
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
let w: WebsiteWorld;
const configure = () => { w.wsettings.v = { mediaMaxBytes: 10_000, mediaAllowedTypes: ['image/png', 'image/jpeg'], mediaMaxPixels: 5_000_000, testimonialMaxCount: null, actOnBehalfMaxMinutes: null }; };
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); });

describe('uploads', () => {
  it('are refused until staff set the caps (nothing is stored)', async () => {
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG()), 'A tap'))).toBe('MEDIA_NOT_CONFIGURED'); expect(w.storage.puts).toEqual([]);
  });
  it('need alt text, and promises in it are refused', async () => {
    configure(); expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG()), ''))).toBe('ALT_REQUIRED');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG()), 'Guaranteed number 1 ranking'))).toBe('WORDING_NOT_ALLOWED'); expect(w.storage.puts).toEqual([]);
  });
  it('store a good picture under the vendor\'s own folder, with its size, alt text and who uploaded it', async () => {
    configure(); const r = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG()), 'A fitted tap');
    expect(r).toMatchObject({ altText: 'A fitted tap', width: 1200, height: 600, contentType: 'image/png' }); expect(r.url).toMatch(/^https:\/\/media\.example\.test\/vendors\/v-plumber\/media\/[a-f0-9]{64}\.png$/);
    expect(w.mstore.pictures[0]).toMatchObject({ vendorId: 'v-plumber', uploadedByType: 'VENDOR', uploadedById: 'owner-1' }); expect(w.image.calls).toBe(1);
  });
  it('reject a file over the byte cap, a type outside the list, an SVG, a renamed file, and an unreadable picture', async () => {
    configure();
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('x'.repeat(10_001))), 'Big'))).toBe('MEDIA_TOO_LARGE');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]), 'image/webp'), 'Webp'))).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'), 'Svg'))).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(JPG(), 'image/png'), 'Renamed'))).toBe('MEDIA_TYPE_MISMATCH');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(Buffer.from('not a picture at all'), 'image/png'), 'Text'))).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, undefined, 'Missing'))).toBe('MEDIA_INVALID');
    expect(w.storage.puts).toEqual([]); expect(w.mstore.pictures).toEqual([]);
  });
  it('a picture that decodes badly is refused and nothing is stored', async () => {
    configure(); const bad = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('CORRUPT')]);
    w.image.reencode = async () => { throw new Error('unreadable'); };
    expect(await code(w.media.upload(w.vendorId, OWNER_ACTOR, file(bad), 'Broken'))).toBe('MEDIA_INVALID'); expect(w.storage.puts).toEqual([]);
  });
  it('the same picture twice is one row; a removed picture comes back with the new description', async () => {
    configure(); const a = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('same')), 'First'); const b = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('same')), 'Second');
    expect(b.id).toBe(a.id); expect(w.mstore.pictures).toHaveLength(1);
    await w.media.remove(w.vendorId, a.id); expect(await w.media.list(w.vendorId)).toEqual([]);
    const c = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('same')), 'Third'); expect(c).toMatchObject({ id: a.id, altText: 'Third' });
  });
  it('staff upload for a vendor with the same rules, recorded as STAFF', async () => {
    configure(); expect(await code(w.media.upload(w.vendorId, STAFF, file(PNG()), ''))).toBe('ALT_REQUIRED');
    await w.media.upload(w.vendorId, STAFF, file(PNG('s')), 'Shop front'); expect(w.mstore.pictures[0]).toMatchObject({ uploadedByType: 'STAFF', uploadedById: 'staff-1' });
  });
  it('the activity log records the staff upload route against THAT vendor with the staff member as the actor', () => {
    const a = actionFor('POST', '/v3/admin/vendors/:id/site/media', ['alt']); expect(a).toEqual({ actionKey: 'vendors.site_media', entityType: 'vendors' });
    expect(vendorOf('/v3/admin/vendors/:id/site/media', { id: 'v-plumber' }, null)).toBe('v-plumber');
    expect(actionFor('POST', '/v3/admin/vendors/:id/site/banner', ['bannerId'])).toMatchObject({ actionKey: 'vendors.site_banner' }); expect(actionFor('POST', '/v3/me/site/media', ['alt'])).not.toBeNull();
  });
});

describe('picture isolation', () => {
  it('vendor B cannot list, remove or reuse vendor A\'s picture', async () => {
    configure(); const a = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('mine')), 'Mine');
    expect(await w.media.list('v-other')).toEqual([]); expect(await code(w.media.remove('v-other', a.id))).toBe('MEDIA_NOT_FOUND'); expect(await w.media.list(w.vendorId)).toHaveLength(1);
    const b = await w.media.upload('v-other', OWNER_ACTOR, file(PNG('mine')), 'Theirs'); expect(b.id).not.toBe(a.id); expect(b.url).toContain('/vendors/v-other/'); expect(a.url).toContain('/vendors/v-plumber/');
  });
  it('a picture the draft uses cannot be removed until it is taken off the page', async () => {
    configure(); const a = await w.media.upload(w.vendorId, OWNER_ACTOR, file(PNG('use')), 'Use');
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'hero.image', value: a.url });
    expect(await code(w.media.remove(w.vendorId, a.id))).toBe('MEDIA_IN_USE');
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'hero.image', value: '' }); expect(await code(w.media.remove(w.vendorId, a.id))).toBe('OK');
  });
});

describe('the Banner Library', () => {
  const add = (categoryId: string, hasPeople: boolean, n: string, active = true) => w.mstore.upsertBanner({ categoryId, storagePath: `banner-library/${categoryId}/${n}.jpg`, url: `https://media.example.test/banner-library/${categoryId}/${n}.jpg`, contentType: 'image/jpeg', bytes: 100, width: 1600, height: 600, altText: `Banner ${n}`, hasPeople, sourceUrl: `https://src.example.test/${n}`, author: 'A Photographer', licenceName: 'CC0', obtainedOn: '2026-10-01', sha256: n.padEnd(8, '0') }).then(async (r) => { if (!active) await w.mstore.setBannerActive(r.row.id, false); return r.row; });
  it('a vendor sees only the active banners of its own category', async () => {
    await add('plumber', false, 'p1'); await add('plumber', true, 'p2'); await add('plumber', false, 'p3', false); await add('dentist', false, 'd1');
    expect((await w.banners.forVendor(w.vendorId)).map((b) => b.altText)).toEqual(['Banner p1', 'Banner p2']);
  });
  it('choosing a banner writes the hero picture and its description into the draft; another category\'s banner is refused', async () => {
    const p = await add('plumber', false, 'p1'); const d = await add('dentist', false, 'd1');
    const r = await w.banners.select(w.vendorId, OWNER_ACTOR, p.id); expect(r.published).toBe(false);
    const draft = await w.web.draft(w.vendorId); expect(draft.doc.fields).toMatchObject({ 'hero.image': p.url, 'hero.imageAlt': 'Banner p1' });
    expect(await code(w.banners.select(w.vendorId, OWNER_ACTOR, d.id))).toBe('BANNER_NOT_AVAILABLE'); expect(await code(w.banners.select(w.vendorId, OWNER_ACTOR, 'nope'))).toBe('BANNER_NOT_AVAILABLE');
  });
  it('a deactivated banner can no longer be chosen', async () => {
    const p = await add('plumber', false, 'p1'); await w.banners.setActive(p.id, false); expect(await code(w.banners.select(w.vendorId, OWNER_ACTOR, p.id))).toBe('BANNER_NOT_AVAILABLE');
  });
  it('healthcare shows banners without people by default; staff may use any, and a staff choice goes live with the banner in the hero', async () => {
    w = websiteWorld({ level: 'PRO', kind: 'dentist' }); const withPeople = await add('dentist', true, 'd1'); const without = await add('dentist', false, 'd2');
    expect((await w.banners.forVendor(w.vendorId)).map((b) => b.id)).toEqual([without.id]);
    expect(await code(w.banners.select(w.vendorId, OWNER_ACTOR, withPeople.id))).toBe('BANNER_NOT_AVAILABLE');
    const r = await w.banners.select(w.vendorId, STAFF, withPeople.id, { staff: true }); expect(r.published).toBe(true);
    expect((await w.pub.byHost(HOST, '/', 'en'))?.html).toContain(withPeople.url);
  });
  it('a Free vendor\'s own choice waits for review (draft only); staff acting for the vendor publish it', async () => {
    w = websiteWorld({ level: 'FREE' }); const p = await add('plumber', false, 'p1');
    await w.banners.select(w.vendorId, OWNER_ACTOR, p.id); expect(await w.repo.currentPublication(w.vendorId)).toBeNull();
    await w.banners.select(w.vendorId, STAFF, p.id, { staff: true }); expect((await w.pub.byHost(HOST, '/', 'en'))?.html).toContain(p.url);
  });
  it('the staff list carries source, author, licence and date for every banner', async () => {
    await add('plumber', false, 'p1'); const l = await w.banners.adminList({}); expect(l[0]).toMatchObject({ sourceUrl: 'https://src.example.test/p1', author: 'A Photographer', licenceName: 'CC0', obtainedOn: '2026-10-01', categoryId: 'plumber' });
    expect(await w.banners.adminList({ categoryId: 'dentist' })).toEqual([]);
  });
});

describe('the loader', () => {
  const manifest = [{ file: 'a.png', sourceUrl: 'https://i.example.test/a', author: 'X', licence: 'CC0', obtainedOn: '2026-10-01', category: 'plumber', alt: 'A tap', hasPeople: false }];
  const run = (over: Record<string, unknown> = {}) => runBannerLoad({ store: w.mstore, storage: w.storage, image: w.image }, { files: [{ name: 'a.png', bytes: PNG('one') }], manifest, categories: ['plumber', 'dentist'], today: '2026-11-11', maxPixels: 1_000_000, apply: false, ...over } as never);
  it('a dry run writes nothing; apply writes once and a second apply changes nothing', async () => {
    const dry = await run(); expect(dry.created).toEqual(['a.png']); expect(w.mstore.banners).toEqual([]); expect(w.storage.puts).toEqual([]);
    await run({ apply: true }); expect(w.mstore.banners).toHaveLength(1); expect(w.mstore.banners[0]).toMatchObject({ categoryId: 'plumber', author: 'X', licenceName: 'CC0', sourceUrl: 'https://i.example.test/a', obtainedOn: '2026-10-01', hasPeople: false });
    const again = await run({ apply: true }); expect(again.unchanged).toEqual(['a.png']); expect(w.mstore.banners).toHaveLength(1); expect(w.storage.puts).toHaveLength(1);
  });
  it('REFUSES an image with no manifest row, and loads the rest', async () => {
    const r = await run({ apply: true, files: [{ name: 'a.png', bytes: PNG('one') }, { name: 'loose.png', bytes: PNG('two') }] });
    expect(r.refused).toEqual([{ file: 'loose.png', reason: 'NO_MANIFEST_ROW' }]); expect(w.mstore.banners).toHaveLength(1);
  });
  it('a manifest with any error loads nothing at all', async () => {
    const r = await run({ apply: true, manifest: [{ ...manifest[0] }, { ...manifest[0], file: 'b.png', licence: '' }] }); expect(r.errors.length).toBeGreaterThan(0); expect(w.mstore.banners).toEqual([]); expect(w.storage.puts).toEqual([]);
  });
  it('is refused until mediaMaxPixels is set', async () => { const r = await run({ maxPixels: null, apply: true }); expect(r.errors[0]).toMatch(/mediaMaxPixels/); expect(w.mstore.banners).toEqual([]); });
  it('a changed licence in the manifest updates the row without a second upload', async () => {
    await run({ apply: true }); await run({ apply: true, manifest: [{ ...manifest[0], licence: 'CC BY 4.0' }] });
    expect(w.mstore.banners).toHaveLength(1); expect(w.mstore.banners[0].licenceName).toBe('CC BY 4.0'); expect(w.storage.puts).toHaveLength(1);
  });
});
