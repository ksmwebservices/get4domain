import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice B4: testimonials through the real build and publish pipeline over memory twins: Pro only, the staff cap, consent, the owner label, no rating or review markup anywhere, downgrade, projection. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const t = (over: Record<string, unknown> = {}) => ({ name: 'Anita R.', text: 'They explained the work before they started and kept the house clean.', date: '2026-09', consent: true, ...over });
const save = (w: WebsiteWorld, items: unknown) => w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'testimonials', items });
const home = async (w: WebsiteWorld): Promise<string> => (await w.pub.byHost(HOST, '/', 'en'))?.html ?? '';
let w: WebsiteWorld;
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); });
const setCap = (n: number | null) => { w.wsettings.v = { ...w.wsettings.v, testimonialMaxCount: n }; };

describe('the cap and the plan', () => {
  it('nothing can be saved until staff set the cap; clearing is always allowed', async () => {
    expect(await code(save(w, [t()]))).toBe('TESTIMONIALS_NOT_CONFIGURED'); expect(await code(save(w, []))).toBe('OK');
    setCap(2); expect(await code(save(w, [t()]))).toBe('OK');
  });
  it('more than the cap is refused with the limit named', async () => { setCap(2); expect(await code(save(w, [t({ text: 'First visit went well.' }), t({ text: 'Second visit went well.' }), t({ text: 'Third visit went well.' })]))).toBe('LIMIT_REACHED'); });
  it('a Free vendor cannot write testimonials (Pro only, owner rule 2)', async () => { w = websiteWorld({ level: 'FREE' }); w.wsettings.v = { ...w.wsettings.v, testimonialMaxCount: 5 }; expect(await code(save(w, [t()]))).toBe('FEATURE_LOCKED'); });
});

describe('what a testimonial must be', () => {
  beforeEach(() => setCap(5));
  it('a first name or initials, the vendor\'s confirmation of consent, plain words without promises; no ratings', async () => {
    expect(await code(save(w, [t({ name: 'Anita Rajan Kumar' })]))).toBe('NAME_NOT_ALLOWED'); expect(await code(save(w, [t({ consent: false })]))).toBe('CONSENT_REQUIRED');
    expect(await code(save(w, [t({ text: 'Guaranteed first page of Google' })]))).toBe('WORDING_NOT_ALLOWED'); expect(await code(save(w, [t({ text: '<b>x</b>' })]))).toBe('FIELD_INVALID');
    for (const k of ['rating', 'stars', 'score']) expect(await code(save(w, [t({ [k]: 5 })]))).toBe('FIELD_LOCKED');
    expect((await w.web.draft(w.vendorId)).doc.testimonials).toBeUndefined();
  });
  it('the draft keeps the items with consent recorded; the view carries the owner label and the cap', async () => {
    const d = await save(w, [t()]); expect(d.doc.testimonials).toEqual([{ name: 'Anita R.', text: t().text, date: '2026-09', consent: true }]);
    expect(await w.testimonials.view(w.vendorId)).toMatchObject({ label: 'Words shared by the business owner', maxCount: 5, pro: true, limits: { name: 40, text: 300 } });
  });
});

describe('the page', () => {
  beforeEach(() => setCap(5));
  it('Pro: the words, the first name and the owner label are drawn in the kit\'s testimonial list', async () => {
    await save(w, [t()]); await w.web.publish(w.vendorId, OWNER_ACTOR); const h = await home(w);
    expect(h).toContain(`<blockquote>${t().text}</blockquote>`); expect(h).toContain('Anita R.'); expect(h).toContain('Words shared by the business owner (2026-09)'); expect(h).toContain('Customer testimonials');
  });
  it('no star rating, no aggregate rating and no review structured data is generated, on any page', async () => {
    await save(w, [t(), t({ name: 'S', text: 'On time and tidy.', date: undefined })]); await w.web.publish(w.vendorId, OWNER_ACTOR);
    for (const p of ['/', '/about', '/services', '/contact', '/gallery']) {
      const h = (await w.pub.byHost(HOST, p, 'en'))?.html ?? '';
      expect(h).not.toMatch(/aggregateRating|ratingValue|reviewRating|"@type":"Review"|itemprop="review|g4d-reviews__summary|g4d-review__stars|★/);
      for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) expect(m[1]).not.toMatch(/Review|Rating|review/);
    }
  });
  it('a downgrade keeps the stored words (owner rule 6), never blocks a Free edit, and draws none of them; Pro brings them back', async () => {
    await save(w, [t()]); await w.web.publish(w.vendorId, OWNER_ACTOR); const pro = w.state.ent; w.state.ent = websiteWorld({ level: 'FREE' }).state.ent;
    await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: 'After the downgrade' });
    const r = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { mode: string; submission: { id: string } }; expect(r.mode).toBe('SUBMITTED'); await w.reviews.approve(r.submission.id, STAFF);
    expect(await home(w)).not.toContain(t().text); expect((await w.content.load(w.vendorId))?.managed?.testimonials).toHaveLength(1);
    w.state.ent = pro; await w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key: 'site.tagline', value: 'Back on Pro' }); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await home(w)).toContain(t().text);
  });
  it('a saved document whose words are no longer allowed, or that has no consent, is refused at publish', async () => {
    const doc = (await w.web.draft(w.vendorId)).doc;
    await w.store.saveDraft(w.vendorId, { ...doc, testimonials: [{ name: 'Anita', text: 'Guaranteed number 1 ranking', consent: true }] }, { expectedRev: null, baseVersion: null, by: 'x' }); expect(await code(w.web.publish(w.vendorId, OWNER_ACTOR))).toBe('WORDING_NOT_ALLOWED');
    const row = await w.store.getDraft(w.vendorId); await w.store.saveDraft(w.vendorId, { ...doc, testimonials: [{ name: 'Anita', text: 'Kind and quick.', consent: false as never }] }, { expectedRev: row!.rev, baseVersion: null, by: 'x' }); expect(await code(w.web.publish(w.vendorId, OWNER_ACTOR))).toBe('CONSENT_REQUIRED');
  });
});

describe('the staff projection', () => {
  beforeEach(() => setCap(5));
  it('a publish writes the live testimonials in order, without any rating; clearing removes them; a restore keeps them in step', async () => {
    await save(w, [t(), t({ name: 'S', text: 'On time and tidy.', date: undefined })]); await w.web.publish(w.vendorId, OWNER_ACTOR);
    expect((await w.testimonials.staffList(w.vendorId)).map((r) => [r.position, r.name, r.date, r.version])).toEqual([[0, 'Anita R.', '2026-09', 1], [1, 'S', null, 1]]);
    expect(Object.keys((await w.testimonials.staffList(w.vendorId))[0]).sort()).toEqual(['date', 'name', 'position', 'text', 'vendorId', 'version']);
    await save(w, []); await w.web.publish(w.vendorId, OWNER_ACTOR); expect(await w.testimonials.staffList(w.vendorId)).toEqual([]);
    await w.web.restore(w.vendorId, 1, OWNER_ACTOR); expect((await w.testimonials.staffList(w.vendorId)).map((r) => r.name)).toEqual(['Anita R.', 'S']);
  });
  it('another vendor has no rows, and replacing one vendor\'s rows leaves the other\'s alone', async () => {
    await save(w, [t()]); await w.web.publish(w.vendorId, OWNER_ACTOR); await w.tmStore.replaceForVendor('v-other', 1, [{ position: 0, name: 'Theirs', text: 'Fine.', date: null }]); await w.tmStore.replaceForVendor('v-other', 2, []);
    expect(await w.testimonials.staffList('v-other')).toEqual([]); expect(await w.testimonials.staffList(w.vendorId)).toHaveLength(1);
  });
});
