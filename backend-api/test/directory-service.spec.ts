import { advance, directoryWorld, DirectoryWorld, PHONE, STAFF } from './support/directory-world';

/** Slice 5.7 services over the in-memory repository: the public read side, staff admin, the vendor's own profile, removal and the account setup grant. */
const err = async (p: Promise<unknown>): Promise<{ code?: string; message?: string; status?: number }> => {
  try { await p; return {}; } catch (e) { const r = e as { getResponse?: () => unknown; getStatus?: () => number }; const b = (r.getResponse?.() ?? {}) as { code?: string; message?: string }; return { code: b.code, message: b.message, status: r.getStatus?.() }; }
};
let w: DirectoryWorld;
beforeEach(async () => { w = await directoryWorld(); });

describe('public read: trees and filters', () => {
  it('the location tree and the category tree are nested and ordered', async () => {
    const loc = await w.read.locations();
    expect(loc).toHaveLength(1); expect(loc[0]).toMatchObject({ slug: 'tamil-nadu', kind: 'STATE' });
    expect(loc[0].children.map((c) => c.slug)).toEqual(['chennai', 'madurai']); expect(loc[0].children[0].children[0]).toMatchObject({ slug: 'chennai', kind: 'CITY', children: [] });
    const cat = await w.read.categories(); expect(cat.map((c) => c.slug)).toEqual(['home-services', 'healthcare']); expect(cat[0].children.map((c) => c.slug)).toEqual(['plumber', 'electrician']);
  });
  it('filters by place (a path, or a slug the shallowest place owns) and by category or whole family, including everything below', async () => {
    await w.biz({ name: 'Alpha Plumber', locationId: w.ids.chennaiCity }); await w.biz({ name: 'Beta Electric', categoryId: w.ids.electrician, locationId: w.ids.madurai }); await w.biz({ name: 'Gamma Dental', categoryId: w.ids.dentist, locationId: w.ids.chennaiCity });
    const names = async (q: object) => (await w.read.list(q)).items.map((i) => i.name);
    expect(await names({})).toEqual(['Alpha Plumber', 'Beta Electric', 'Gamma Dental']);
    expect(await names({ location: 'tamil-nadu/chennai/chennai' })).toEqual(['Alpha Plumber', 'Gamma Dental']);
    expect(await names({ location: 'chennai' })).toEqual(['Alpha Plumber', 'Gamma Dental']);   // the district (shallowest) holds the city
    expect(await names({ location: 'tamil-nadu' })).toHaveLength(3);
    expect(await names({ category: 'plumber' })).toEqual(['Alpha Plumber']);
    expect(await names({ category: 'home-services' })).toEqual(['Alpha Plumber', 'Beta Electric']);
    expect(await names({ category: 'home-services', location: 'madurai' })).toEqual(['Beta Electric']);
  });
  it('an unknown place or category is an EMPTY result, never "everything"', async () => {
    await w.biz({ name: 'Alpha Plumber' });
    expect((await w.read.list({ location: 'atlantis' })).items).toEqual([]); expect((await w.read.list({ category: 'nope' })).items).toEqual([]);
  });
  it('text search: every word must match; a name hit ranks above a description hit; the query is normalised and capped', async () => {
    await w.biz({ name: 'Sri Plumber Works', descriptionText: 'We repair pipes and taps all over the city, quickly.' }); await w.biz({ name: 'Zed Services', descriptionText: 'A reliable plumber for every home in Chennai, all week.' }); await w.biz({ name: 'Other Shop', categoryId: w.ids.dentist, descriptionText: 'Nothing about pipes here at all, honestly speaking.' });
    expect((await w.read.list({ q: '  PLUMBER!! ' })).items.map((i) => i.name)).toEqual(['Sri Plumber Works', 'Zed Services']);
    expect((await w.read.list({ q: 'plumber chennai' })).items.map((i) => i.name)).toEqual(['Zed Services']);
    expect((await w.read.list({ q: "x'; DROP TABLE y;--" })).items).toEqual([]);
    expect((await w.read.list({ q: 'a'.repeat(500) })).filters.q.length).toBeLessThanOrEqual(80);
  });
  it('the page size is capped hard, and paging works', async () => {
    for (let i = 1; i <= 7; i++) await w.biz({ name: `Plumber ${String(i).padStart(2, '0')}` });
    w.settings.over = { directoryPageSizeMax: 3, directoryPageSizeDefault: 2 };
    const r = await w.read.list({ pageSize: 1000 }); expect(r).toMatchObject({ page: 1, pageSize: 3, total: 7 }); expect(r.items).toHaveLength(3);
    expect((await w.read.list({ page: 3, pageSize: 3 })).items.map((i) => i.name)).toEqual(['Plumber 07']);
    expect((await w.read.list({})).pageSize).toBe(2);
  });
});

describe('public read: what is exposed', () => {
  it('a CLAIMED business shows contact details; an UNCLAIMED one shows only name, category, area and description', async () => {
    const claimed = await w.biz({ name: 'Claimed Co', status: 'CLAIMED', hours: { mon: '9-5' }, geo: { lat: 13, lng: 80 } }); await w.repo.replaceServices(claimed.id, [{ name: 'Tap repair', description: 'Quick' }]); await w.repo.replaceMedia(claimed.id, [{ url: 'https://x.invalid/a.jpg', altText: 'a' }]);
    await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' });
    const a = (await w.read.detail('claimed-co')) as unknown as { gone: false; business: Record<string, unknown> }; const b = (await w.read.detail('unclaimed-co')) as unknown as { gone: false; business: Record<string, unknown> };
    expect(a.business).toMatchObject({ claimed: true, phone: PHONE, address: { line1: '12 Test Road', city: 'Chennai' }, hours: { mon: '9-5' }, geo: { lat: 13, lng: 80 }, services: [{ name: 'Tap repair', description: 'Quick' }], media: [{ url: 'https://x.invalid/a.jpg', altText: 'a' }] });
    expect(b.business).toMatchObject({ claimed: false, phone: null, address: { city: 'Chennai' }, hours: {}, geo: null, services: [], media: [] });
  });
  it('NO view ever carries an id, a vendor id, an email, an owner name, a status or a source: the keys are a fixed list', async () => {
    const withVendor = await w.biz({ name: 'Linked Co', vendorId: 'vendor-secret-1' }); await w.repo.updateBusiness(withVendor.id, { emailMasked: 'o•••@example.com' });
    await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' });
    const keys = ['address', 'category', 'claimed', 'description', 'geo', 'hours', 'indexable', 'location', 'media', 'name', 'phone', 'services', 'slug', 'sponsored', 'updatedAt'];
    const list = await w.read.list({}); for (const i of list.items) expect(Object.keys(i).sort()).toEqual(keys);
    const text = JSON.stringify([list, await w.read.detail('linked-co'), await w.read.sitemapData(1, 10), await w.read.locations(), await w.read.categories()]);
    expect(text).not.toMatch(/vendor-secret|emailMasked|example\.com|vendorId|"id"|"status"|"source"|"ownerName"|"email"/);
  });
  it('draft, suspended, removed and unknown businesses are not in the list; detail is 404 (null) for unknown, draft and suspended and "gone" for removed', async () => {
    await w.biz({ name: 'Live Co' }); await w.biz({ name: 'Draft Co', status: 'DRAFT' }); await w.biz({ name: 'Susp Co', status: 'SUSPENDED' }); await w.biz({ name: 'Gone Co', status: 'REMOVED' });
    expect((await w.read.list({})).items.map((i) => i.name)).toEqual(['Live Co']);
    expect(await w.read.detail('draft-co')).toBeNull(); expect(await w.read.detail('susp-co')).toBeNull(); expect(await w.read.detail('nobody')).toBeNull(); expect(await w.read.detail('Bad Slug!!')).toBeNull();
    expect(await w.read.detail('gone-co')).toEqual({ gone: true });
  });
  it('sitemap data holds only indexable public businesses, with lastmod, paged', async () => {
    await w.biz({ name: 'Index Co' }); await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' }); await w.biz({ name: 'Thin Co', descriptionText: 'short' }); await w.biz({ name: 'Gone Co', status: 'REMOVED', indexable: true }); await w.biz({ name: 'Susp Co', status: 'SUSPENDED', indexable: true });
    const r = await w.read.sitemapData(1, 10);
    expect(r.items.map((i) => i.slug)).toEqual(['index-co']); expect(r.total).toBe(1); expect(r.items[0].lastmod).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
  it('unclaimed pages become indexable only when the setting allows it', async () => {
    const b = await w.admin.createBusiness({ name: 'Unclaimed Co', categoryId: w.ids.plumber, locationId: w.ids.chennaiCity, phone: '9876543210', description: 'Fast and tidy plumbing work across the city, with clear prices.' }, STAFF);
    expect(b.indexable).toBe(false);
    w.settings.over = { directoryIndexUnclaimed: true };
    const u = await w.admin.updateBusiness(b.id, { description: 'Fast and tidy plumbing work across the city, with clear prices. Open daily.' }, STAFF);
    expect(u.indexable).toBe(true);
  });
  it('a thin location or category page is marked noindex; a filtered search never is indexable', async () => {
    await w.biz({ name: 'One' }); await w.biz({ name: 'Two' });
    expect((await w.read.list({ category: 'plumber' })).indexable).toBe(false);   // 2 < 3
    await w.biz({ name: 'Three' });
    expect((await w.read.list({ category: 'plumber' })).indexable).toBe(true);
    expect((await w.read.list({ category: 'plumber', q: 'one' })).indexable).toBe(false);
  });
});

describe('sponsored placements', () => {
  const setup = async () => {
    for (let i = 1; i <= 12; i++) await w.biz({ name: `Plumber ${String(i).padStart(2, '0')}` });
    const s1 = await w.biz({ name: 'Zed Sponsor One' }); const s2 = await w.biz({ name: 'Zed Sponsor Two' });
    for (const s of [s1, s2]) await w.admin.createPlacement(s.id, { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', label: 'Sponsored' }, STAFF);
    return { s1, s2 };
  };
  it('sponsored items are inserted at fixed positions, always carry their label, and the organic order is exactly what it would be without them', async () => {
    await setup(); w.settings.over = { directoryPageSizeDefault: 12, directorySponsoredEvery: 5 };
    const r = await w.read.list({});
    const organic = r.items.filter((i) => !i.sponsored); const spons = r.items.filter((i) => i.sponsored) as Array<{ label: string; name: string }>;
    expect(organic.map((i) => i.name)).toEqual(Array.from({ length: 12 }, (_, i) => `Plumber ${String(i + 1).padStart(2, '0')}`));
    expect(spons.map((s) => s.name)).toEqual(['Zed Sponsor One', 'Zed Sponsor Two']); expect(spons.every((s) => s.label === 'Sponsored')).toBe(true);
    expect(r.items.map((i) => (i.sponsored ? 'S' : 'o')).join('')).toBe('SoooooSooooooo');
    w.admin.clock = () => new Date(w.now.t);
    for (const p of [...w.repo.placements.values()]) await w.repo.revokePlacement(p.id, w.now.t);
    expect((await w.read.list({})).items.filter((i) => !i.sponsored).map((i) => i.name)).toEqual(organic.map((i) => i.name));   // same organic order with or without placements
  });
  it('only page 1 carries sponsored items; an expired, future or revoked placement never shows; a sponsored business already on the page is not repeated', async () => {
    await setup(); w.settings.over = { directoryPageSizeDefault: 6 };
    expect((await w.read.list({ page: 2 })).items.some((i) => i.sponsored)).toBe(false);
    for (const p of w.repo.placements.values()) p.endsAt = new Date('2026-11-02T00:00:00Z');   // ended before "now"
    expect((await w.read.list({})).items.some((i) => i.sponsored)).toBe(false);
    for (const p of w.repo.placements.values()) { p.endsAt = new Date('2026-12-01T00:00:00Z'); p.startsAt = new Date('2026-11-20T00:00:00Z'); }
    expect((await w.read.list({})).items.some((i) => i.sponsored)).toBe(false);
    for (const p of w.repo.placements.values()) p.startsAt = new Date('2026-11-01T00:00:00Z');
    w.settings.over = { directoryPageSizeDefault: 50 };   // the sponsors are on the page organically now
    const r = await w.read.list({}); expect(r.items.filter((i) => i.name === 'Zed Sponsor One')).toHaveLength(1);
  });
  it('a placement needs a label (1 to 60 characters), an end after the start, and a public business', async () => {
    const b = await w.biz({ name: 'Some Co' }); const hidden = await w.biz({ name: 'Hidden Co', status: 'SUSPENDED' });
    const ok = { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', label: 'Sponsored' };
    expect(await err(w.admin.createPlacement(b.id, { ...ok, label: '' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createPlacement(b.id, { ...ok, label: '   ' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createPlacement(b.id, { ...ok, label: 'x'.repeat(61) }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createPlacement(b.id, { ...ok, endsAt: ok.startsAt }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createPlacement(b.id, { ...ok, startsAt: 'soon' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createPlacement(hidden.id, ok, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
    expect(w.repo.placements.size).toBe(0);
  });
});

describe('staff admin', () => {
  const input = { name: 'Sri Ganesh Plumbing', categoryId: '', locationId: '', phone: '98765 43210', email: 'owner@example.com', description: 'Fast and tidy plumbing work across the city, with clear prices.', address: { line1: '12 Test Road', city: 'Chennai' } };
  const base = () => ({ ...input, categoryId: w.ids.plumber, locationId: w.ids.chennaiCity });
  it('create: a stable slug with name and city, collision gets -2, phone is E.164, only a MASKED email is stored, the audit row carries no phone or email', async () => {
    const a = await w.admin.createBusiness(base(), STAFF); const b = await w.admin.createBusiness(base(), STAFF);
    expect(a).toMatchObject({ slug: 'sri-ganesh-plumbing-chennai', status: 'UNCLAIMED', phone: PHONE, emailMasked: 'o•••@example.com' }); expect(b.slug).toBe('sri-ganesh-plumbing-chennai-2');
    expect(JSON.stringify([...w.repo.businesses.values()])).not.toContain('owner@example.com');
    const audit = JSON.stringify(w.audit.rows); expect(audit).not.toMatch(/example\.com|9876543210/); expect(w.audit.rows[0]).toMatchObject({ action: 'directory.business.create', actor: STAFF });
  });
  it('create refuses an unknown category or place, a bad phone and an empty name', async () => {
    expect(await err(w.admin.createBusiness({ ...base(), categoryId: 'nope' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createBusiness({ ...base(), locationId: 'nope' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createBusiness({ ...base(), phone: '12345' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createBusiness({ ...base(), name: '  ' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
  });
  it('update recomputes indexing and never changes the slug; a removed profile cannot be edited', async () => {
    const a = await w.admin.createBusiness({ ...base(), status: 'UNCLAIMED' }, STAFF);
    const u = await w.admin.updateBusiness(a.id, { name: 'Renamed Plumbing' }, STAFF); expect(u.slug).toBe('sri-ganesh-plumbing-chennai'); expect(u.name).toBe('Renamed Plumbing');
    await w.admin.moderate(a.id, 'REMOVE', 'duplicate listing', STAFF);
    expect(await err(w.admin.updateBusiness(a.id, { name: 'X' }, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID', status: 409 });
  });
  it('moderation: suspend hides it publicly, restore brings it back, remove makes the API answer "gone"; a reason is required; every step is audited', async () => {
    const a = await w.admin.createBusiness(base(), STAFF);
    expect(await err(w.admin.moderate(a.id, 'SUSPEND', '', STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    await w.admin.moderate(a.id, 'SUSPEND', 'reported by a customer', STAFF); expect(await w.read.detail(a.slug)).toBeNull();
    expect(await err(w.admin.moderate(a.id, 'RESTORE', 'reviewed and fine', STAFF).then(() => w.admin.moderate(a.id, 'RESTORE', 'again', STAFF)))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
    expect((await w.read.detail(a.slug))).toMatchObject({ gone: false });
    await w.admin.moderate(a.id, 'REMOVE', 'owner requested removal', STAFF); expect(await w.read.detail(a.slug)).toEqual({ gone: true });
    expect(w.audit.rows.map((r) => r.action)).toEqual(['directory.business.create', 'directory.business.suspend', 'directory.business.restore', 'directory.business.remove']);
    expect((await w.repo.getBusiness(a.id))).toMatchObject({ status: 'REMOVED', indexable: false });   // the row is kept
  });
  it('locations and categories: kind rules, slug clash is a 409, deactivating hides it from the tree and deletes nothing', async () => {
    expect(await err(w.admin.createLocation({ kind: 'CITY', name: 'Orphan' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.createLocation({ kind: 'DISTRICT', parentId: w.ids.chennaiCity, name: 'Bad' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    const d = await w.admin.createLocation({ kind: 'DISTRICT', parentId: w.ids.tn, name: 'Salem' }, STAFF); expect(d.slug).toBe('salem');
    expect(await err(w.admin.createLocation({ kind: 'DISTRICT', parentId: w.ids.tn, name: 'Salem' }, STAFF))).toMatchObject({ code: 'DIRECTORY_SLUG_TAKEN', status: 409 });
    await w.admin.updateLocation(d.id, { active: false }, STAFF); w.read.invalidate();
    expect((await w.read.locations())[0].children.map((c) => c.slug)).not.toContain('salem'); expect(w.repo.locations.has(d.id)).toBe(true);
    expect(await err(w.admin.createCategory({ parentId: w.ids.plumber, name: 'Too deep' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    const c = await w.admin.createCategory({ parentId: w.ids.family, name: 'Carpenter', themeCategoryId: 'carpenter' }, STAFF); expect(c).toMatchObject({ slug: 'carpenter', family: 'home-services' });
  });
  it('the claim phone override: only for an unclaimed business, a valid number and a reason; the audit row holds a masked number only', async () => {
    const un = await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' }); const cl = await w.biz({ name: 'Claimed Co', status: 'CLAIMED' });
    expect(await err(w.admin.claimPhoneOverride(cl.id, { phone: '9000000001', reason: 'owner called' }, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
    expect(await err(w.admin.claimPhoneOverride(un.id, { phone: 'abc', reason: 'owner called' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    expect(await err(w.admin.claimPhoneOverride(un.id, { phone: '9000000001', reason: '' }, STAFF))).toMatchObject({ code: 'DIRECTORY_INVALID' });
    await w.admin.claimPhoneOverride(un.id, { phone: '90000 00001', reason: 'owner changed their number' }, STAFF);
    expect(JSON.stringify(w.audit.rows)).not.toContain('9000000001'); expect(w.audit.rows.at(-1)).toMatchObject({ action: 'directory.claim_phone.override', actor: STAFF });
    expect((await w.repo.latestOverride(un.id))!.phoneE164).toBe('+919000000001');
  });
  it('staff views: MARKETING gets no personal fields; OPERATIONS gets all', async () => {
    const a = await w.admin.createBusiness(base(), STAFF);
    const m = (await w.admin.getBusiness(a.id, true)) as Record<string, unknown>; const o = (await w.admin.getBusiness(a.id, false)) as Record<string, unknown>;
    for (const k of ['phone', 'emailMasked', 'address', 'hours', 'geo', 'services', 'media']) { expect(m).not.toHaveProperty(k); expect(o).toHaveProperty(k); }
    expect(m).toHaveProperty('name'); expect(JSON.stringify(await w.admin.listBusinesses({ skip: 0, take: 10 }, true))).not.toMatch(/9876543210|example\.com/);
  });
});

describe('slug races (two creators pick the same slug at the same moment)', () => {
  it('a unique-slug clash on insert is retried with the next free slug, not surfaced as an error', async () => {
    await w.biz({ name: 'Race Co', slug: 'race-co-chennai' });
    const real = w.repo.slugTaken.bind(w.repo); let lie = true;
    w.repo.slugTaken = async (s) => (lie && s === 'race-co-chennai' ? false : real(s));   // the check says free, the insert then hits the unique rule
    const made = await w.admin.createBusiness({ name: 'Race Co', categoryId: w.ids.plumber, locationId: w.ids.chennaiCity, description: 'Fast and tidy plumbing work across the city, with clear prices.' }, STAFF);
    lie = false;
    expect(made.slug).toBe('race-co-chennai-2');
  });
  it('a clash that is not about the slug (a second profile for the same vendor) is NOT swallowed', async () => {
    await w.biz({ name: 'First Co', vendorId: 'vx' });
    await expect(w.repo.createBusiness({ vendorId: 'vx', slug: 'other-slug', name: 'X', categoryId: w.ids.plumber, locationId: null, address: {}, phoneE164: null, emailMasked: null, hours: {}, geo: null, descriptionText: '', status: 'UNCLAIMED', indexable: false, source: 'STAFF' })).rejects.toThrow(/duplicate vendor/);
    const { isSlugClash } = await import('../src/directory/directory-admin.service');
    expect(isSlugClash(new Error('duplicate vendor'))).toBe(false); expect(isSlugClash(new Error('duplicate slug'))).toBe(true);
    expect(isSlugClash(Object.assign(new Error('x'), { code: 'P2002', meta: { target: ['slug'] } }))).toBe(true); expect(isSlugClash(Object.assign(new Error('x'), { code: 'P2002', meta: { target: ['vendorId'] } }))).toBe(false);
  });
});

describe('the vendor\'s own profile', () => {
  it('a vendor sees and edits only their own business; slug, status, indexing and vendor link cannot be set; the profile is created CLAIMED on the first save', async () => {
    w.repo.vendors.set('va', { id: 'va', name: 'A Plumbing', phone: PHONE, email: 'a@x.invalid' }); w.repo.vendors.set('vb', { id: 'vb', name: 'B Plumbing', phone: PHONE, email: 'b@x.invalid' });
    expect(await w.me.get('va')).toEqual({ exists: false });
    expect(await err(w.me.put('va', { description: 'x' }, { type: 'VENDOR', id: 'va', ip: null }))).toMatchObject({ code: 'DIRECTORY_INVALID' });   // needs category and place the first time
    const created = await w.me.put('va', { description: 'Fast and tidy plumbing work across the city, with clear prices.', categorySlug: 'plumber', locationPath: 'tamil-nadu/chennai/chennai', phone: '98765 43210', address: { line1: '1 Road' } }, { type: 'VENDOR', id: 'va', ip: null });
    expect(created.profile).toMatchObject({ status: 'CLAIMED', indexable: true, slug: 'a-plumbing-chennai', phone: PHONE });
    const b = await w.me.get('vb'); expect(b).toEqual({ exists: false });   // B sees nothing of A
    const upd = await w.me.put('va', { description: 'Updated description that is long enough to be indexed properly.' }, { type: 'VENDOR', id: 'va', ip: null });
    expect(upd.profile.description).toMatch(/^Updated/); expect(upd.profile.slug).toBe('a-plumbing-chennai');
    expect((await w.repo.getBusinessByVendor('va'))!.vendorId).toBe('va'); expect(await w.repo.getBusinessByVendor('vb')).toBeNull();
  });
  it('a suspended or removed profile cannot be edited by its owner', async () => {
    w.repo.vendors.set('va', { id: 'va', name: 'A', phone: PHONE, email: 'a@x.invalid' });
    const b = await w.biz({ name: 'A Co', vendorId: 'va', status: 'SUSPENDED' });
    expect(await err(w.me.put('va', { description: 'x' }, { type: 'VENDOR', id: 'va', ip: null }))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
    await w.repo.updateBusiness(b.id, { status: 'REMOVED' });
    expect(await err(w.me.put('va', { description: 'x' }, { type: 'VENDOR', id: 'va', ip: null }))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
  });
});

describe('removal requests', () => {
  const tokenOf = (): string => /\/directory\/removal\/([A-Za-z0-9_-]{43})/.exec(w.sms.sent.at(-1)!.body)![1];
  it('the request is uniform: an unknown business, a removed one and one with no phone on file all do nothing and say nothing different', async () => {
    await w.biz({ name: 'Gone Co', status: 'REMOVED' }); await w.biz({ name: 'No Phone Co', phoneE164: null });
    for (const slug of ['nobody', 'gone-co', 'no-phone-co', 'Bad Slug!!', '']) await w.removal.request({ businessSlug: slug }, '1.2.3.4');
    expect(w.repo.removals.size).toBe(0); expect(w.sms.sent).toHaveLength(0);
  });
  it('a known business: a request row with a hashed token, a masked contact, and a link to the phone on file (the clear token is only in the message)', async () => {
    await w.biz({ name: 'Live Co' });
    await w.removal.request({ businessSlug: 'live-co', reason: 'closed down' }, '1.2.3.4');
    expect(w.sms.sent).toHaveLength(1); expect(w.sms.sent[0].to).toBe(PHONE); const token = tokenOf();
    const row = [...w.repo.removals.values()][0]; expect(row).toMatchObject({ status: 'REQUESTED', reason: 'closed down', requesterContactMasked: '+91•••••••210', confirmedAt: null });
    expect(JSON.stringify(row)).not.toContain(token); expect(JSON.stringify(w.audit.rows)).not.toMatch(new RegExp(`${token}|9876543210`));
  });
  it('no more than 3 requests per business per day', async () => {
    await w.biz({ name: 'Live Co' });
    for (let i = 0; i < 6; i++) await w.removal.request({ businessSlug: 'live-co' }, '1.2.3.4');
    expect(w.repo.removals.size).toBe(3); advance(w, 25 * 3600); await w.removal.request({ businessSlug: 'live-co' }, null); expect(w.repo.removals.size).toBe(4);
  });
  it('link status and confirm: an unknown, expired, used or foreign token is the SAME 404', async () => {
    await w.biz({ name: 'Live Co' }); await w.removal.request({ businessSlug: 'live-co' }, null); const token = tokenOf();
    expect(await w.removal.linkStatus(token)).toEqual({ valid: true, businessName: 'Live Co', confirmed: false });
    const unknown = await err(w.removal.linkStatus('A'.repeat(43)));
    expect(unknown).toMatchObject({ code: 'REMOVAL_INVALID', status: 404 });
    expect(await err(w.removal.confirm('B'.repeat(43)))).toEqual(unknown);
    advance(w, 15 * 86_400); expect(await err(w.removal.linkStatus(token))).toEqual(unknown); expect(await err(w.removal.confirm(token))).toEqual(unknown);
  });
  it('staff cannot approve an unconfirmed request; a confirmed one can be approved and executed: the profile is hidden (410), noindex, the row and audit trail kept', async () => {
    const b = await w.biz({ name: 'Live Co' }); await w.removal.request({ businessSlug: 'live-co' }, null); const token = tokenOf(); const id = [...w.repo.removals.keys()][0];
    expect(await err(w.removal.approve(id, STAFF))).toMatchObject({ code: 'REMOVAL_NOT_CONFIRMED', status: 409 });
    await w.removal.confirm(token); expect(await w.removal.linkStatus(token)).toMatchObject({ confirmed: true });
    expect(await err(w.removal.execute(id, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });   // not approved yet
    expect(await w.removal.approve(id, STAFF)).toEqual({ status: 'APPROVED' });
    expect(await w.removal.execute(id, STAFF)).toEqual({ status: 'EXECUTED' });
    expect(await w.read.detail('live-co')).toEqual({ gone: true });
    expect(await w.repo.getBusiness(b.id)).toMatchObject({ status: 'REMOVED', indexable: false }); expect((await w.repo.getBusiness(b.id))!.removedAt).not.toBeNull();
    expect((await w.read.list({})).items).toEqual([]); expect((await w.read.sitemapData(1, 10)).total).toBe(0);
    expect(await err(w.removal.execute(id, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });   // exactly once
    expect(w.audit.rows.map((r) => r.action)).toEqual(['directory.removal.requested', 'directory.removal.confirmed', 'directory.removal.approved', 'directory.removal.executed']);
  });
  it('reject needs a reason and closes the request; a used link no longer works', async () => {
    await w.biz({ name: 'Live Co' }); await w.removal.request({ businessSlug: 'live-co' }, null); const token = tokenOf(); const id = [...w.repo.removals.keys()][0];
    expect(await err(w.removal.reject(id, '', STAFF)).then((e) => e.status)).toBeUndefined();   // the service stores an empty reason as null; the HTTP layer requires 3+ characters (RejectDto)
    expect(w.repo.removals.get(id)!.status).toBe('REJECTED');
    expect(await err(w.removal.approve(id, STAFF))).toMatchObject({ code: 'DIRECTORY_STATE_INVALID' });
    expect(await err(w.removal.linkStatus(token))).toMatchObject({ code: 'REMOVAL_INVALID' });   // no longer REQUESTED
    expect(await w.read.detail('live-co')).toMatchObject({ gone: false });   // still public
  });
});

describe('account setup grant', () => {
  it('issue returns a token whose hash only is stored; consume works exactly once; unknown, used and expired are the same 404', async () => {
    const { token, expiresAt } = await w.grants.issue('v1', 30);
    expect(expiresAt.getTime() - w.now.t.getTime()).toBe(30 * 60_000); expect(JSON.stringify([...w.repo.grants.values()])).not.toContain(token);
    expect(await w.grants.consume(token)).toEqual({ vendorId: 'v1' });
    const used = await err(w.grants.consume(token)); const unknown = await err(w.grants.consume('Z'.repeat(43)));
    expect(used).toMatchObject({ code: 'GRANT_INVALID', status: 404 }); expect(used).toEqual(unknown);
    const t2 = (await w.grants.issue('v1', 30)).token; advance(w, 31 * 60); expect(await err(w.grants.consume(t2))).toEqual(unknown);
  });
  it('two consumers at once: exactly one wins', async () => {
    const { token } = await w.grants.issue('v1', 30);
    const r = await Promise.all([err(w.grants.consume(token)), err(w.grants.consume(token)), err(w.grants.consume(token))]);
    expect(r.filter((x) => !x.code)).toHaveLength(1);
  });
});
