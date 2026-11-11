import { canMove, reasonProblem } from '../src/v3-website/core/review-core';
import { HOST, OWNER_ACTOR, WebsiteWorld, websiteWorld } from './support/website-world';

/** Slice 5.5c (amendment 06): a Free vendor's edits are submissions; nothing is live until staff approve; Pro edits go live at once. Through the real services over memory twins. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const STAFF2 = { type: 'STAFF' as const, id: 'staff-2', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const edit = (w: WebsiteWorld, key: string, value: string) => w.web.save(w.vendorId, OWNER_ACTOR, { kind: 'field', key, value });
const home = async (w: WebsiteWorld): Promise<string> => (await w.pub.byHost(HOST, '/', 'en'))?.html ?? '';
let w: WebsiteWorld;

describe('the states (pure)', () => {
  it('SUBMITTED can become APPROVED or REJECTED; nothing leaves a decided state; DRAFT only becomes SUBMITTED', () => {
    expect(canMove('SUBMITTED', 'APPROVED')).toBe(true); expect(canMove('SUBMITTED', 'REJECTED')).toBe(true); expect(canMove('DRAFT', 'SUBMITTED')).toBe(true);
    for (const from of ['APPROVED', 'REJECTED'] as const) for (const to of ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const) expect(canMove(from, to)).toBe(false);
    expect(canMove('SUBMITTED', 'DRAFT')).toBe(false); expect(canMove('DRAFT', 'APPROVED')).toBe(false);
  });
  it('a rejection needs a reason of plain text', () => {
    for (const bad of ['', '  ', 'ab', 'x'.repeat(501), '<b>no</b>', undefined, 5]) expect(reasonProblem(bad)).not.toBeNull();
    expect(reasonProblem('The photo shows another business.')).toBeNull();
  });
});

describe('a Free vendor', () => {
  beforeEach(() => { w = websiteWorld({ level: 'FREE' }); });
  it('publishing is a submission: nothing goes live, the site is not public, staff are told, the prohibited-term scan runs at submit time', async () => {
    await edit(w, 'hero.title', 'Waiting for review'); const r = await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR);
    expect(r.mode).toBe('SUBMITTED'); expect(await w.repo.currentPublication(w.vendorId)).toBeNull(); expect(await home(w)).toBe('');
    expect(w.scans.length).toBe(1); expect(w.scans[0].join(' ')).toContain('Waiting for review'); expect(w.scanSources).toEqual(['SUBMIT']);
    expect(w.notices.filter((n) => n.kind === 'CONTENT_SUBMITTED').map((n) => n.role).sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']);
  });
  it('only one submission can wait at a time, and an unchanged draft is not a submission', async () => {
    expect(await code(w.reviews.submit(w.vendorId, OWNER_ACTOR))).toBe('NOTHING_TO_PUBLISH');
    await edit(w, 'hero.title', 'One'); await w.reviews.submit(w.vendorId, OWNER_ACTOR); expect(await code(w.reviews.submit(w.vendorId, OWNER_ACTOR))).toBe('SUBMISSION_PENDING');
  });
  it('an invalid or promising draft cannot be submitted', async () => {
    await edit(w, 'hero.title', 'Fine'); w.web.save = w.web.save.bind(w.web);
    const doc = (await w.web.draft(w.vendorId)).doc; await w.store.saveDraft(w.vendorId, { ...doc, fields: { ...doc.fields, 'about.text': 'We guarantee the number 1 ranking' } }, { expectedRev: (await w.store.getDraft(w.vendorId))!.rev, baseVersion: null, by: 'x' });
    expect(await code(w.reviews.submit(w.vendorId, OWNER_ACTOR))).toBe('WORDING_NOT_ALLOWED'); expect(w.rstore.rows).toHaveLength(0);
  });
  it('the vendor lists its own submissions with status, and staff approval puts the content live with the vendor told', async () => {
    await edit(w, 'hero.title', 'Approved headline'); const sub = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    const mine = await w.reviews.mine(w.vendorId); expect(mine.map((s) => [s.id, s.status])).toEqual([[sub.submission.id, 'SUBMITTED']]);
    const done = await w.reviews.approve(sub.submission.id, STAFF);
    expect(done).toMatchObject({ status: 'APPROVED', reviewerId: 'staff-1' }); expect(done.decidedAt).toBeTruthy();
    expect(await home(w)).toContain('Approved headline'); expect((await w.repo.currentPublication(w.vendorId))?.version).toBe(1);
    expect(w.notices).toContainEqual({ userId: w.vendorId, role: null, kind: 'CONTENT_APPROVED', refId: sub.submission.id });
    expect(w.activity.map((a) => a.actionKey)).toEqual(expect.arrayContaining(['content_submission.submitted', 'content_submission.approved'])); expect(w.activity.every((a) => a.vendorId === w.vendorId)).toBe(true);
    expect(await code(w.reviews.approve(sub.submission.id, STAFF2))).toBe('SUBMISSION_NOT_OPEN'); expect(await code(w.reviews.reject(sub.submission.id, STAFF2, 'Too late'))).toBe('SUBMISSION_NOT_OPEN');
  });
  it('a Free site stays listing-only after approval: no call to action is drawn whatever the content says', async () => {
    await edit(w, 'hero.title', 'Listing'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } }; await w.reviews.approve(s.submission.id, STAFF);
    expect(await home(w)).not.toMatch(/data-g4d-slot="action"|href="\/enquire"|href="\/book"/);
  });
  it('a rejection keeps the old content live, records the reason and tells the vendor; the vendor can then submit again', async () => {
    await edit(w, 'hero.title', 'First version'); const a = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } }; await w.reviews.approve(a.submission.id, STAFF);
    await edit(w, 'hero.title', 'Second version'); const b = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    expect(await code(w.reviews.reject(b.submission.id, STAFF, ''))).toBe('REASON_REQUIRED');
    const rej = await w.reviews.reject(b.submission.id, STAFF, 'The headline names another business.');
    expect(rej).toMatchObject({ status: 'REJECTED', reason: 'The headline names another business.' });
    const page = await home(w); expect(page).toContain('First version'); expect(page).not.toContain('Second version');
    expect((await w.reviews.mineOne(w.vendorId, b.submission.id)).reason).toBe('The headline names another business.');
    expect(w.notices).toContainEqual({ userId: w.vendorId, role: null, kind: 'CONTENT_REJECTED', refId: b.submission.id });
    await edit(w, 'hero.title', 'Third version'); expect(((await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { mode: string }).mode).toBe('SUBMITTED');
  });
  it('approving builds from the submitted payload, not from a later edit in the draft', async () => {
    await edit(w, 'hero.title', 'Submitted text'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    await edit(w, 'hero.title', 'Edited after submitting'); await w.reviews.approve(s.submission.id, STAFF);
    const page = await home(w); expect(page).toContain('Submitted text'); expect(page).not.toContain('Edited after submitting');
    expect((await w.web.draft(w.vendorId)).doc.fields['hero.title']).toBe('Edited after submitting');
  });
  it('a failed approval (the site cannot be built) leaves the submission waiting', async () => {
    await edit(w, 'hero.title', 'Needs a build'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    w.build.build = async () => { throw new Error('build failed'); };
    await expect(w.reviews.approve(s.submission.id, STAFF)).rejects.toBeDefined(); expect((await w.reviews.adminGet(s.submission.id)).status).toBe('SUBMITTED');
  });
});

describe('a Pro vendor', () => {
  beforeEach(() => { w = websiteWorld({ level: 'PRO' }); });
  it('goes live at once with no submission row', async () => {
    await edit(w, 'hero.title', 'Live now'); const r = await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR);
    expect(r.mode).toBe('LIVE'); expect(await home(w)).toContain('Live now'); expect(w.rstore.rows).toHaveLength(0);
  });
});

describe('staff lists, and tenant separation', () => {
  beforeEach(() => { w = websiteWorld({ level: 'FREE' }); });
  it('staff filter by status and vendor; the detail shows the payload and what changed', async () => {
    await edit(w, 'hero.title', 'Listed'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    expect((await w.reviews.adminList({ status: 'SUBMITTED', page: 1, pageSize: 20 })).items.map((i) => i.id)).toEqual([s.submission.id]);
    expect((await w.reviews.adminList({ status: 'APPROVED', page: 1, pageSize: 20 })).items).toEqual([]); expect((await w.reviews.adminList({ vendorId: 'v-other', page: 1, pageSize: 20 })).items).toEqual([]);
    const d = await w.reviews.adminGet(s.submission.id); expect(d.changed.fields).toEqual(['hero.title']); expect(d.payload.fields['hero.title']).toBe('Listed');
    expect(await code(w.reviews.adminGet('nope'))).toBe('SUBMISSION_NOT_FOUND');
  });
  it('another vendor never sees or opens this vendor\'s submission', async () => {
    await edit(w, 'hero.title', 'Private'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    expect(await w.reviews.mine('v-other')).toEqual([]); expect(await code(w.reviews.mineOne('v-other', s.submission.id))).toBe('SUBMISSION_NOT_FOUND');
  });
  it('two staff deciding at once: one wins, the other is told it is no longer open', async () => {
    await edit(w, 'hero.title', 'Race'); const s = (await w.reviews.publishOrSubmit(w.vendorId, OWNER_ACTOR)) as { submission: { id: string } };
    const r = await Promise.all([code(w.reviews.approve(s.submission.id, STAFF)), code(w.reviews.reject(s.submission.id, STAFF2, 'Not this one'))]);
    expect(r.sort()).toEqual(['OK', 'SUBMISSION_NOT_OPEN']); expect((await w.reviews.adminGet(s.submission.id)).status).toMatch(/APPROVED|REJECTED/);
  });
});
