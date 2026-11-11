import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice B2: location and directions through the real build and publish pipeline over memory twins: the draft, the page, Free and Pro, the staff projection, no network. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const loc = (w: WebsiteWorld, value: Record<string, unknown>) => w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'location', value });
const page = async (w: WebsiteWorld, p = '/contact'): Promise<string> => (await w.pub.byHost(HOST, p, 'en'))?.html ?? '';
const FULL = { addressLine1: '12 Kamaraj Road', addressLine2: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', latitude: 13.0827, longitude: 80.2707 };
const MAPS = 'google.com/maps/search/?api=1&amp;query=13.0827,80.2707';
let w: WebsiteWorld;
let fetchSpy: jest.SpyInstance;
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('the network must not be used'); }); });
afterEach(() => fetchSpy.mockRestore());

describe('the draft', () => {
  it('stores the location, validates it, and reads a pasted full link', async () => {
    expect((await loc(w, FULL)).doc.location).toMatchObject({ city: 'Chennai', pincode: '600040', latitude: 13.0827 });
    expect(await code(loc(w, { ...FULL, pincode: '12' }))).toBe('FIELD_INVALID'); expect(await code(loc(w, { addressLine1: 'x', latitude: 13 }))).toBe('LOCATION_COORDS_INCOMPLETE');
    expect(await code(loc(w, { ...FULL, mapLinkInput: 'https://maps.app.goo.gl/abc' }))).toBe('SHORT_LINK_NOT_EXPANDED');
    const d = await loc(w, { addressLine1: '12 Kamaraj Road', city: 'Chennai', mapLinkInput: 'https://www.google.com/maps/@13.0827,80.2707,17z' }); expect(d.doc.location).toMatchObject({ latitude: 13.0827, longitude: 80.2707 });
  });
  it('the view carries the address as one line and the built directions link; the link reader is pure', async () => {
    await loc(w, FULL); const v = await w.location.view(w.vendorId);
    expect(v).toMatchObject({ address: '12 Kamaraj Road, Anna Nagar, Chennai, Tamil Nadu 600040', directionsUrl: 'https://www.google.com/maps/search/?api=1&query=13.0827,80.2707' });
    expect(w.location.parse('https://www.google.com/maps?q=9.9252,78.1198')).toMatchObject({ ok: true, coords: { latitude: 9.9252, longitude: 78.1198 } }); expect(w.location.parse('https://maps.app.goo.gl/x')).toMatchObject({ ok: false, code: 'SHORT_LINK_NOT_EXPANDED' });
  });
  it('no network call is made to save, read or parse a location', async () => { await loc(w, FULL); await w.location.view(w.vendorId); w.location.parse('https://www.google.com/maps/@1,2,3z'); expect(fetchSpy).not.toHaveBeenCalled(); });
});

describe('the page', () => {
  it('Pro: the address is shown and the Get directions link points at the built URL', async () => {
    await loc(w, FULL); await w.web.publish(w.vendorId, OWNER_ACTOR);
    const c = await page(w); expect(c).toContain('12 Kamaraj Road, Anna Nagar, Chennai, Tamil Nadu 600040'); expect(c).toContain(MAPS);
  });
  it('Free (after staff approval): the address is plain text and there is no directions button or link (owner rule 2)', async () => {
    w = websiteWorld({ level: 'FREE' }); await loc(w, FULL); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    expect(await page(w)).toBe(''); await w.reviews.approve(s.submission.id, STAFF);
    const c = await page(w); expect(c).toContain('12 Kamaraj Road, Anna Nagar, Chennai, Tamil Nadu 600040'); expect(c).not.toContain('google.com/maps'); expect(c).not.toMatch(/Get directions|Directions/i);
  });
  it('the structured data takes the city and pincode from the written location', async () => {
    await loc(w, FULL); await w.web.publish(w.vendorId, OWNER_ACTOR); const home = await page(w, '/');
    expect(home).toContain('"addressLocality":"Chennai"'); expect(home).toContain('"postalCode":"600040"');
  });
});

describe('the staff projection', () => {
  it('a publish writes the live location with the built directions link; a restore and a removal keep it in step', async () => {
    await loc(w, FULL); await w.web.publish(w.vendorId, OWNER_ACTOR);
    expect(await w.location.staffGet(w.vendorId)).toMatchObject({ city: 'Chennai', pincode: '600040', latitude: 13.0827, directionsUrl: 'https://www.google.com/maps/search/?api=1&query=13.0827,80.2707', version: 1 });
    await loc(w, { addressLine1: '5 Temple Street', city: 'Madurai' }); await w.web.publish(w.vendorId, OWNER_ACTOR);
    expect(await w.location.staffGet(w.vendorId)).toMatchObject({ city: 'Madurai', latitude: null, directionsUrl: 'https://www.google.com/maps/search/?api=1&query=5%20Temple%20Street%2C%20Madurai', version: 2 });
    await w.web.restore(w.vendorId, 1, OWNER_ACTOR); expect(await w.location.staffGet(w.vendorId)).toMatchObject({ city: 'Chennai', version: 3 });
    await loc(w, {}); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await w.location.staffGet(w.vendorId)).toBeNull();
  });
  it('another vendor has no row, and writing one vendor\'s row leaves the other\'s alone', async () => {
    await loc(w, FULL); await w.web.publish(w.vendorId, OWNER_ACTOR);
    expect(await w.location.staffGet('v-other')).toBeNull(); await w.locStore.replace('v-other', 1, { addressLine1: 'Theirs', addressLine2: null, city: null, state: null, pincode: null, latitude: null, longitude: null, mapLinkInput: null, directionsUrl: null });
    await w.locStore.replace('v-other', 2, null); expect(await w.location.staffGet(w.vendorId)).toMatchObject({ city: 'Chennai' });
  });
  it('a document with a location that is no longer valid is refused at publish', async () => {
    const doc = (await w.web.draft(w.vendorId)).doc; await w.store.saveDraft(w.vendorId, { ...doc, location: { pincode: 'abc' } }, { expectedRev: null, baseVersion: null, by: 'x' });
    expect(await code(w.web.publish(w.vendorId, OWNER_ACTOR))).toBe('FIELD_INVALID');
  });
});
