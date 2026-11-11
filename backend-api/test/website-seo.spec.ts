import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice B1: per-page SEO through the real build and publish pipeline over memory twins: draft, publish, the page head, the staff projection and reports, Free review, locked fields. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const seo = (w: WebsiteWorld, pageKey: string, edit: Record<string, unknown>) => w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'seo', pageKey, edit });
const page = async (w: WebsiteWorld, path = '/'): Promise<string> => (await w.pub.byHost(HOST, path, 'en'))?.html ?? '';
const GALLERY = 'https://cdn.example.test/g1.jpg';
let w: WebsiteWorld;
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); });

describe('writing a page\'s SEO', () => {
  it('stores the custom text in the draft for a page the site has', async () => {
    const d = await seo(w, 'about', { seoTitle: 'About Sri Ganesh Plumbing', seoDescription: 'A family plumbing business in Chennai.' }); expect(d.doc.seo.about).toEqual({ seoTitle: 'About Sri Ganesh Plumbing', seoDescription: 'A family plumbing business in Chennai.' });
    expect(d.dirty).toBe(true);
  });
  it('refuses a page the site does not have: an unknown extra page, an unknown item, a made-up key', async () => {
    for (const k of ['page:nope', 'item:zzz', 'checkout', 'seo']) expect(await code(seo(w, k, { seoTitle: 'x' }))).toBe('FIELD_LOCKED');
    expect(await code(seo(w, 'item:i1', { seoTitle: 'Tap repair' }))).toBe('OK');
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'list', name: 'pages', items: [{ slug: 'warranty', title: 'Warranty', intro: '', body: 'Text', enabled: true }] });
    expect(await code(seo(w, 'page:warranty', { seoTitle: 'Our warranty' }))).toBe('OK');
  });
  it('the share picture must be one of the site\'s own: a gallery image, or an uploaded picture', async () => {
    expect(await code(seo(w, 'home', { shareImageRef: GALLERY }))).toBe('OK');
    expect(await code(seo(w, 'home', { shareImageRef: 'https://elsewhere.example.test/a.png' }))).toBe('IMAGE_NOT_ALLOWED');
    const pic = await w.mstore.createPicture({ vendorId: w.vendorId, storagePath: 'p', url: 'https://media.example.test/vendors/v-plumber/media/x.png', contentType: 'image/png', bytes: 1, width: 1, height: 1, altText: 'x', sha256: 'abc123', uploadedByType: 'VENDOR', uploadedById: 'o' });
    expect(await code(seo(w, 'home', { shareImageRef: pic.url }))).toBe('OK');
  });
  it('promises, prices and markup are refused with the field named; the draft stays as it was', async () => {
    await seo(w, 'home', { seoTitle: 'Kept' });
    for (const bad of ['We guarantee the number 1 ranking', 'Taps from ₹300', '<b>x</b>']) expect(await code(seo(w, 'home', { seoTitle: bad }))).toMatch(/WORDING_NOT_ALLOWED|FIELD_INVALID/);
    expect((await w.web.draft(w.vendorId)).doc.seo.home).toEqual({ seoTitle: 'Kept' });
  });
  it('the slug and the platform-written parts cannot be written', async () => {
    for (const k of ['slug', 'canonical', 'structuredData', 'robots']) expect(await code(seo(w, 'about', { [k]: 'x' }))).toBe('FIELD_LOCKED');
  });
  it('a saved document with an unsafe SEO text is refused again at publish (a rule can change after the edit)', async () => {
    const doc = (await w.web.draft(w.vendorId)).doc;
    await w.store.saveDraft(w.vendorId, { ...doc, seo: { home: { seoTitle: 'Guaranteed first page of Google' } } }, { expectedRev: null, baseVersion: null, by: 'x' });
    expect(await code(w.web.publish(w.vendorId, OWNER_ACTOR))).toBe('WORDING_NOT_ALLOWED');
  });
});

describe('what the page head shows', () => {
  it('a page without custom text shows the platform default; a page with custom text shows it in the title, the description and the share picture', async () => {
    await seo(w, 'about', { seoTitle: 'About our family firm', seoDescription: 'Three generations of plumbers serving Chennai homes with clear explanations.', shareImageRef: GALLERY });
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'hero.title', value: 'Plumbing you can trust' }); await w.web.publish(w.vendorId, OWNER_ACTOR);
    const about = await page(w, '/about'); expect(about).toContain('<title>About our family firm</title>'); expect(about).toContain('Three generations of plumbers serving Chennai homes with clear explanations.'); expect(about).toContain(`<meta property="og:image" content="${GALLERY}">`);
    const home = await page(w); expect(home).not.toContain('About our family firm'); expect(home).toMatch(/<title>[^<]+<\/title>/);
  });
  it('the sitemap lists the published pages of the canonical host only', async () => {
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'list', name: 'pages', items: [{ slug: 'warranty', title: 'Warranty', intro: '', body: 'Text', enabled: true }] });
    await seo(w, 'page:warranty', { seoTitle: 'Our warranty' }); await w.web.publish(w.vendorId, OWNER_ACTOR);
    const sm = await page(w, '/sitemap.xml'); const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.some((l) => l.endsWith('/warranty'))).toBe(true); expect(new Set(locs.map((l) => new URL(l).origin)).size).toBe(1);
    expect(await page(w, '/warranty')).toContain('<title>Our warranty</title>');
  });
  it('the view shows the default until the vendor edits, with the limits, and the slug as read only for the standard pages', async () => {
    const before = await w.seo.view(w.vendorId); const home = before.pages.find((p) => p.pageKey === 'home')!;
    expect(home).toMatchObject({ isCustomTitle: false, isCustomDescription: false, slug: { value: '', editable: false } }); expect(home.seoTitle).toContain('Sri Ganesh Plumbing'); expect(before.limits).toEqual({ title: 60, description: 160 });
    await seo(w, 'home', { seoTitle: 'Plumber in Chennai' }); const after = (await w.seo.view(w.vendorId)).pages.find((p) => p.pageKey === 'home')!;
    expect(after).toMatchObject({ seoTitle: 'Plumber in Chennai', isCustomTitle: true, isCustomDescription: false });
    expect(before.pages.find((p) => p.pageKey === 'about')!.slug).toEqual({ value: 'about', editable: false }); expect(before.pages.some((p) => p.pageKey === 'item:i1')).toBe(true);
  });
});

describe('plan rules', () => {
  it('a Free vendor\'s SEO text goes to review: nothing is live until staff approve, then it is', async () => {
    w = websiteWorld({ level: 'FREE' }); await seo(w, 'home', { seoTitle: 'Plumber in Chennai' });
    const r = await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR); expect(r.mode).toBe('SUBMITTED'); expect(await page(w)).toBe('');
    await w.reviews.approve((r as { submission: { id: string } }).submission.id, STAFF); expect(await page(w)).toContain('<title>Plumber in Chennai</title>');
  });
});

describe('the staff projection and reports', () => {
  const publishWith = async (edit: Record<string, unknown> | null) => { if (edit) await seo(w, 'about', edit); await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: `T${Math.random()}`.slice(0, 12) }); return w.web.publish(w.vendorId, OWNER_ACTOR); };
  it('a publish writes the effective SEO of every page with flags for custom text; the next publish replaces them', async () => {
    await publishWith({ seoTitle: 'About our family firm', seoDescription: 'Three generations of plumbers serving Chennai homes with clear explanations.' });
    const rows = await w.seoStore.listForVendor(w.vendorId); const about = rows.find((r) => r.pageKey === 'about')!; const home = rows.find((r) => r.pageKey === 'home')!;
    expect(about).toMatchObject({ seoTitle: 'About our family firm', customTitle: true, customDescription: true, version: 1 }); expect(home).toMatchObject({ customTitle: false, customDescription: false });
    expect(rows.map((r) => r.pageKey)).toEqual(expect.arrayContaining(['home', 'about', 'services', 'gallery', 'contact', 'item:i1']));
    await seo(w, 'about', { seoTitle: '', seoDescription: '' }); await publishWith(null);
    expect((await w.seoStore.listForVendor(w.vendorId)).find((r) => r.pageKey === 'about')).toMatchObject({ customTitle: false, version: 2 });
  });
  it('a restore puts the earlier version\'s SEO back in the projection', async () => {
    await publishWith({ seoTitle: 'First title' }); await seo(w, 'about', { seoTitle: 'Second title' }); await publishWith(null);
    await w.web.restore(w.vendorId, 1, OWNER_ACTOR); expect((await w.seoStore.listForVendor(w.vendorId)).find((r) => r.pageKey === 'about')).toMatchObject({ seoTitle: 'First title', version: 3 });
  });
  it('the report names the pages still on a default, sharing a title, or with a short description; it can be filtered', async () => {
    await publishWith({ seoTitle: 'Same title', seoDescription: 'short' }); await seo(w, 'contact', { seoTitle: 'Same title' }); await publishWith(null);
    const all = await w.seo.staffIssues({ page: 1, pageSize: 100 }); const kinds = all.items.map((i) => `${i.pageKey}:${i.issue}`);
    expect(kinds).toEqual(expect.arrayContaining(['about:SHORT_DESCRIPTION', 'about:DUPLICATE_TITLE', 'contact:DUPLICATE_TITLE', 'home:DEFAULT_TITLE']));
    const only = await w.seo.staffIssues({ issue: 'DUPLICATE_TITLE', page: 1, pageSize: 100 }); expect(only.items.every((i) => i.issue === 'DUPLICATE_TITLE')).toBe(true); expect(only.items.every((i) => i.vendorId === w.vendorId)).toBe(true);
    expect((await w.seo.staffIssues({ vendorId: 'v-other', page: 1, pageSize: 100 })).items).toEqual([]);
  });
  it('another vendor has no rows, and replacing one vendor\'s rows leaves another\'s alone', async () => {
    await publishWith({ seoTitle: 'Mine' });
    await w.seoStore.replaceForVendor('v-other', 1, [{ pageKey: 'home', seoTitle: 'Theirs', seoDescription: 'd'.repeat(60), shareImageRef: null, customTitle: true, customDescription: true }]);
    await w.seoStore.replaceForVendor(w.vendorId, 9, []); expect(await w.seoStore.listForVendor(w.vendorId)).toEqual([]); expect((await w.seoStore.listForVendor('v-other')).map((r) => r.seoTitle)).toEqual(['Theirs']);
  });
  it('a projection fault never undoes a publish', async () => {
    w.seoStore.failNext = true; const r = await publishWith({ seoTitle: 'Still live' }); expect(r.unchanged).toBe(false); expect(await page(w, '/about')).toContain('<title>Still live</title>');
  });
});
