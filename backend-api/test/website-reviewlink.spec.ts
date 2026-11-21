import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice B3: the Google review link through the real build and publish pipeline over memory twins: Pro only, the host allow-list, the kit's Write a review button, downgrade, the staff projection, no call to Google. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const link = (w: WebsiteWorld, url: unknown) => w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'reviewLink', value: url });
const home = async (w: WebsiteWorld): Promise<string> => (await w.pub.byHost(HOST, '/', 'en'))?.html ?? '';
const URL1 = 'https://g.page/r/CabcDEF123/review';
let w: WebsiteWorld; let fetchSpy: jest.SpyInstance;
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('the network must not be used'); }); });
afterEach(() => fetchSpy.mockRestore());

describe('writing the link', () => {
  it('Pro stores a link on an allowed host; a host outside the list and a look-alike are refused; an empty value removes it', async () => {
    expect((await link(w, URL1)).doc.reviewUrl).toBe(URL1);
    expect(await code(link(w, 'https://evil.example.test/review'))).toBe('REVIEW_HOST_NOT_ALLOWED'); expect(await code(link(w, 'https://google.com.evil.test/x'))).toBe('REVIEW_HOST_NOT_ALLOWED'); expect(await code(link(w, 'http://g.page/r/abc'))).toBe('FIELD_INVALID');
    expect((await link(w, '')).doc.reviewUrl).toBeUndefined();
  });
  it('a Free vendor cannot write it (Pro only, owner rule 2) and is told what Pro adds', async () => {
    w = websiteWorld({ level: 'FREE' }); expect(await code(link(w, URL1))).toBe('FEATURE_LOCKED'); expect((await w.web.draft(w.vendorId)).doc.reviewUrl).toBeUndefined();
  });
  it('the view says whether the plan shows the button', async () => {
    await link(w, URL1); expect(await w.reviewLink.view(w.vendorId)).toEqual({ url: URL1, pro: true }); expect((await websiteWorld({ level: 'FREE' }).reviewLink.view('v-plumber')).pro).toBe(false);
  });
});

describe('the page', () => {
  it('Pro: the kit\'s Write a review on Google button opens the vendor\'s link; no Google review content or rating is drawn', async () => {
    await link(w, URL1); await w.web.publish(w.vendorId, OWNER_ACTOR); const h = await home(w);
    expect(h).toContain(`class="g4d-reviews__write" href="${URL1}" rel="noopener noreferrer"`); expect(h).toContain('Write a review on Google'); expect(h).not.toMatch(/g4d-reviews__google|g4d-reviews__summary|aggregateRating/);
  });
  it('without a link there is no button', async () => { await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: 'Fast and tidy' }); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await home(w)).not.toContain('g4d-reviews__write'); });
  it('a downgrade keeps the stored link (owner rule 6), never blocks a Free edit, and draws no button; Pro brings the button back', async () => {
    await link(w, URL1); await w.web.publish(w.vendorId, OWNER_ACTOR); const pro = w.state.ent; w.state.ent = websiteWorld({ level: 'FREE' }).state.ent;
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: 'After the downgrade' });
    const r = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { mode: string; submission: { id: string } }; expect(r.mode).toBe('SUBMITTED');
    await w.reviews.approve(r.submission.id, STAFF); expect(await home(w)).not.toContain('g4d-reviews__write'); expect((await w.content.load(w.vendorId))?.managed?.reviewUrl).toBe(URL1);
    w.state.ent = pro; await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: 'Back on Pro' }); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await home(w)).toContain(`href="${URL1}"`);
  });
  it('nothing is sent to Google: saving, publishing and reading make no network call', async () => { await link(w, URL1); await w.web.publish(w.vendorId, OWNER_ACTOR); await w.reviewLink.view(w.vendorId); expect(fetchSpy).not.toHaveBeenCalled(); });
});

describe('the staff projection', () => {
  it('a publish writes the live link and its host; removing it removes the row; a restore keeps it in step', async () => {
    await link(w, URL1); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await w.reviewLink.staffGet(w.vendorId)).toEqual({ vendorId: w.vendorId, url: URL1, host: 'g.page', version: 1 });
    await link(w, ''); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await w.reviewLink.staffGet(w.vendorId)).toBeNull();
    await w.web.restore(w.vendorId, 1, OWNER_ACTOR); expect(await w.reviewLink.staffGet(w.vendorId)).toMatchObject({ url: URL1, version: 3 });
  });
  it('another vendor has no row, and a row for another vendor never changes this vendor\'s', async () => {
    await link(w, URL1); await w.web.publish(w.vendorId, OWNER_ACTOR); await w.rlStore.replace('v-other', 1, 'https://g.page/r/other'); await w.rlStore.replace('v-other', 2, null);
    expect(await w.reviewLink.staffGet('v-other')).toBeNull(); expect(await w.reviewLink.staffGet(w.vendorId)).toMatchObject({ url: URL1 });
  });
  it('a saved document whose link is no longer allowed is refused at publish', async () => {
    const doc = (await w.web.draft(w.vendorId)).doc; await w.store.saveDraft(w.vendorId, { ...doc, reviewUrl: 'https://evil.example.test/x' }, { expectedRev: null, baseVersion: null, by: 'x' });
    expect(await code(w.web.publish(w.vendorId, OWNER_ACTOR))).toBe('REVIEW_HOST_NOT_ALLOWED');
  });
});
