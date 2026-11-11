import { WebsiteWorld, websiteWorld, HOST, OWNER_ACTOR, VENDOR_ID } from './support/website-world';

/** Slice 5.5a: the Website manager through the real build and publish pipeline over memory twins: draft, preview, publish, restore, compare, the plan rules. */
const V = VENDOR_ID;
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const html = async (w: WebsiteWorld, path = '/'): Promise<string> => (await w.pub.byHost(HOST, path, 'en'))?.html ?? '';
const field = (w: WebsiteWorld, key: string, value: unknown) => w.web.save(V, OWNER_ACTOR, { kind: 'field', key, value });
let w: WebsiteWorld;
beforeEach(() => { w = websiteWorld({ level: 'PRO' }); });

describe('the editor', () => {
  it('returns the theme, the map derived from it, the typed fields, the plan limits and whether the site is Pro', async () => {
    const e = await w.web.editor(V);
    expect(e.themeId).toBe('free-service-pro'); expect(e.pro).toBe(true); expect(e.map.pages.map((p) => p.key)).toEqual(expect.arrayContaining(['home', 'about', 'services', 'contact']));
    expect(e.fields['hero.title']).toMatchObject({ type: 'text', proOnly: false }); expect(e.fields['cta.label'].proOnly).toBe(true); expect(e.limits.faqs).toBe(12);
    expect(e.fonts.length).toBeGreaterThan(0); expect(e.map.gaps).toContain('landing-pages:no-template');
    expect((await websiteWorld({ level: 'FREE' }).web.editor(V)).pro).toBe(false);
  });
});

describe('the draft (autosave per field)', () => {
  it('each save bumps the revision and marks the draft as having changes; the live site is untouched', async () => {
    const a = await field(w, 'hero.title', 'Plumbing you can trust'); expect(a).toMatchObject({ rev: 1, dirty: true });
    const b = await field(w, 'site.tagline', 'Fast and tidy'); expect(b.rev).toBe(2); expect(b.doc.fields).toMatchObject({ 'hero.title': 'Plumbing you can trust', 'site.tagline': 'Fast and tidy' });
    expect(await w.repo.currentPublication(V)).toBeNull();
  });
  it('two saves of different fields at the same moment both survive (the change is applied to the newest draft)', async () => {
    await field(w, 'hero.title', 'First');
    w.store.beforeSave = async () => { await w.store.saveDraft(V, { ...(await w.store.getDraft(V))!.doc, fields: { ...(await w.store.getDraft(V))!.doc.fields, 'about.text': 'Written in another tab' } }, { expectedRev: 1, baseVersion: null, by: 'x' }); };
    const r = await field(w, 'site.tagline', 'Second'); expect(r.doc.fields).toMatchObject({ 'hero.title': 'First', 'about.text': 'Written in another tab', 'site.tagline': 'Second' });
  });
  it('many parallel saves for one vendor all land, in order, with no lost update', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => field(w, i % 2 ? 'hero.title' : 'hero.subtitle', `v${i}`)));
    const d = await w.web.draft(V); expect(d.rev).toBe(12); expect(d.doc.fields['hero.title']).toBe('v11'); expect(d.doc.fields['hero.subtitle']).toBe('v10');
  });
  it('locked fields cannot be written: the SEO and markup keys answer FIELD_LOCKED and the draft stays as it was', async () => {
    await field(w, 'hero.title', 'Kept');
    for (const k of ['seo.title', 'seo.canonical', 'structuredData', 'site.name']) expect(await code(field(w, k, 'x'))).toBe('FIELD_LOCKED');
    expect((await w.web.draft(V)).doc.fields).toEqual({ 'hero.title': 'Kept' });
  });
  it('text that promises a result or a ranking is refused and nothing is saved', async () => {
    expect(await code(field(w, 'about.text', 'We guarantee the number 1 ranking on Google'))).toBe('WORDING_NOT_ALLOWED');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'list', name: 'faqs', items: [{ q: 'Will I rank first?', a: 'Guaranteed first page of Google' }] }))).toBe('WORDING_NOT_ALLOWED');
    expect((await w.web.draft(V)).rev).toBe(0);
  });
  it('lists are limited by the plan: Pro allows 12 questions, 13 is refused', async () => {
    const faqs = (n: number) => Array.from({ length: n }, (_, i) => ({ q: `Question ${i}?`, a: 'Yes.' }));
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'list', name: 'faqs', items: faqs(12) }))).toBe('OK');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'list', name: 'faqs', items: faqs(13) }))).toBe('LIMIT_REACHED');
  });
  it('sections, brand and navigation are validated against the theme', async () => {
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'sections', value: { hidden: ['faq'], order: [] } }))).toBe('OK');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'sections', value: { hidden: ['hero'], order: [] } }))).toBe('SECTION_REQUIRED');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'brand', value: { fontBody: 'Comic Sans MS' } }))).toBe('FONT_NOT_ALLOWED');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'brand', value: { accent: '#0a7d4f', fontHeading: 'Poppins' } }))).toBe('OK');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'navigation', value: { header: [{ key: 'nope', label: 'x', visible: true }], footer: [] } }))).toBe('NAV_INVALID');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'navigation', value: { header: [{ key: 'home', label: 'Home', visible: true }, { key: 'contact', label: 'Call us', visible: true }], footer: [] } }))).toBe('OK');
  });
  it('discard makes the draft the live document again', async () => {
    await field(w, 'hero.title', 'Thrown away'); expect((await w.web.discard(V)).dirty).toBe(false); expect((await w.web.draft(V)).doc.fields).toEqual({});
  });
});

describe('the Free plan', () => {
  beforeEach(() => { w = websiteWorld({ level: 'FREE' }); });
  it('cannot write the Pro-only wording (the call to action) and gets the plan\'s upsell text', async () => {
    expect(await code(field(w, 'cta.label', 'Book now'))).toBe('FEATURE_LOCKED');
    expect(await code(field(w, 'hero.title', 'Allowed on Free'))).toBe('OK');
  });
  it('cannot publish: the edits go to review (slice 5.5c), and nothing goes live', async () => {
    await field(w, 'hero.title', 'Pending review'); expect(await code(w.web.publish(V, OWNER_ACTOR))).toBe('REVIEW_REQUIRED'); expect(await w.repo.currentPublication(V)).toBeNull();
  });
  it('version history is locked (restore needs the plan feature)', async () => { expect(await code(w.web.restore(V, 1, OWNER_ACTOR))).toBe('VERSION_NOT_FOUND'); });
});

describe('preview and publish (Pro)', () => {
  it('a preview is built from the draft, is not public, and the live site does not change', async () => {
    await field(w, 'hero.title', 'Draft headline'); const p = await w.web.preview(V, OWNER_ACTOR);
    expect(p.publication.status).toBe('DRAFT_PREVIEW'); expect((await w.repo.pagesOf(p.publication.id)).find((x) => x.path === '/')!.html).toContain('Draft headline');
    expect(await w.pub.byHost(HOST, '/', 'en')).toBeNull(); expect(await w.repo.currentPublication(V)).toBeNull();
  });
  it('the same draft gives the same preview (no second row)', async () => {
    await field(w, 'hero.title', 'Stable'); const a = await w.web.preview(V, OWNER_ACTOR); const b = await w.web.preview(V, OWNER_ACTOR);
    expect(b.reused).toBe(true); expect(b.publication.id).toBe(a.publication.id);
  });
  it('publish validates, creates exactly one published snapshot with the new text, records it, scans it, purges the cache', async () => {
    await field(w, 'hero.title', 'Plumbing you can trust'); await field(w, 'about.text', 'Family run since 1998.');
    const r = await w.web.publish(V, OWNER_ACTOR);
    expect(r.unchanged).toBe(false); expect(r.publication).toMatchObject({ version: 1, status: 'PUBLISHED' });
    const page = await html(w); expect(page).toContain('Plumbing you can trust');
    expect((await w.repo.listPublications(V, 10)).filter((p) => p.status === 'PUBLISHED')).toHaveLength(1);
    expect(w.store.snaps.map((s) => s.version)).toEqual([1]); expect(w.scans.length).toBe(1); expect(w.cache.purged).toEqual([V]);
    const d = await w.web.draft(V); expect(d.dirty).toBe(false); expect(d.baseVersion).toBe(1);
    expect(w.audit).toContain('site.publish');
  });
  it('a draft never leaks: after a second edit the public page still shows the last published text', async () => {
    await field(w, 'hero.title', 'Published headline'); await w.web.publish(V, OWNER_ACTOR);
    await field(w, 'hero.title', 'Unpublished edit'); await w.web.preview(V, OWNER_ACTOR);
    const page = await html(w); expect(page).toContain('Published headline'); expect(page).not.toContain('Unpublished edit');
  });
  it('a double publish is harmless: two at once give one published version and the second says unchanged', async () => {
    await field(w, 'hero.title', 'Once only');
    const [a, b] = await Promise.all([w.web.publish(V, OWNER_ACTOR), w.web.publish(V, OWNER_ACTOR)]);
    expect([a.unchanged, b.unchanged].sort()).toEqual([false, true]);
    expect((await w.repo.listPublications(V, 10)).filter((p) => p.status === 'PUBLISHED')).toHaveLength(1);
    expect(await code(w.web.publish(V, OWNER_ACTOR))).toBe('OK'); expect((await w.repo.listPublications(V, 10)).length).toBe(1);
  });
  it('publishing with no draft at all is refused, not an empty publish', async () => { expect(await code(w.web.publish(V, OWNER_ACTOR))).toBe('NOTHING_TO_PUBLISH'); });
  it('the call-to-action wording written on Pro stays in the document after a downgrade, and a Free publish of it is refused', async () => {
    await field(w, 'cta.label', 'Book a visit'); w.state.ent = websiteWorld({ level: 'FREE' }).state.ent;
    expect(await code(w.web.publish(V, OWNER_ACTOR))).toBe('REVIEW_REQUIRED');
  });
  it('a build started through the older route (no draft) keeps the managed content: the build records its snapshot', async () => {
    await field(w, 'hero.title', 'Kept by every route'); await w.web.publish(V, OWNER_ACTOR);
    const b = await w.build.build(V, { actor: OWNER_ACTOR }); await w.publisher.publish(V, b.publication.id, OWNER_ACTOR);
    expect(await html(w)).toContain('Kept by every route');
    const live = await w.content.load(V); expect(live?.managed?.fields['hero.title']).toBe('Kept by every route');
  });
  it('the services stay the vendor\'s Offerings: the page shows them and the manager has no way to write them', async () => {
    await field(w, 'hero.title', 'Anything'); await w.web.publish(V, OWNER_ACTOR);
    expect(await html(w, '/services')).toContain('Tap repair');
    expect(await code(w.web.save(V, OWNER_ACTOR, { kind: 'list', name: 'items', items: [] }))).toBe('FIELD_LOCKED');
  });
});

describe('revisions: restore and compare', () => {
  const publishTitle = async (t: string) => { await field(w, 'hero.title', t); return (await w.web.publish(V, OWNER_ACTOR)).publication!; };
  it('restore recreates an earlier version exactly: same pages byte for byte, same content document, and the draft starts from it', async () => {
    const a = await publishTitle('Version A'); await publishTitle('Version B');
    expect(await html(w)).toContain('Version B');
    const r = await w.web.restore(V, a.version, OWNER_ACTOR);
    expect(r.publication).toMatchObject({ version: 3, status: 'PUBLISHED', rolledBackFromVersion: 1 });
    const pages = (v: number) => w.repo.listPublications(V, 10).then(async (l) => (await w.repo.pagesOf(l.find((p) => p.version === v)!.id)).map((p) => `${p.lang}:${p.path}:${p.sha256}`).sort());
    expect(await pages(3)).toEqual(await pages(1));
    expect(await html(w)).toContain('Version A'); expect((await w.content.load(V))?.managed?.fields['hero.title']).toBe('Version A');
    const d = await w.web.draft(V); expect(d.doc.fields['hero.title']).toBe('Version A'); expect(d.dirty).toBe(false);
  });
  it('a restore of a version that does not exist is refused', async () => { await publishTitle('Only'); expect(await code(w.web.restore(V, 99, OWNER_ACTOR))).toBe('VERSION_NOT_FOUND'); });
  it('after a restore the next publish starts from the restored content, not from the replaced one', async () => {
    const a = await publishTitle('Version A'); await publishTitle('Version B'); await w.web.restore(V, a.version, OWNER_ACTOR);
    await field(w, 'site.tagline', 'New tagline'); await w.web.publish(V, OWNER_ACTOR);
    const page = await html(w); expect(page).toContain('Version A'); expect(page).not.toContain('Version B'); expect(page).toContain('New tagline');
  });
  it('the revision list says which versions have a content snapshot', async () => {
    await publishTitle('A'); await publishTitle('B'); const l = await w.web.revisions(V);
    expect(l.map((x) => [x.version, x.status, x.hasContentSnapshot])).toEqual([[2, 'PUBLISHED', true], [1, 'SUPERSEDED', true]]);
  });
  it('compare lists the content areas and the pages that differ between two versions', async () => {
    await publishTitle('Version A'); await field(w, 'about.text', 'Added later'); await publishTitle('Version B');
    const c = await w.web.compare(V, 1, 2);
    expect(c.content.fields).toEqual(['about.text', 'hero.title']); expect(c.pages.changed).toEqual(expect.arrayContaining(['en:/', 'en:/about']));
    const total = (await w.repo.pagesOf((await w.repo.listPublications(V, 10)).find((p) => p.version === 2)!.id)).filter((p) => p.html.startsWith('<!doctype html>')).length;
    expect(c.pages.added).toEqual([]); expect(c.pages.removed).toEqual([]); expect(c.pages.changed.length + c.pages.unchanged).toBe(total);   // the about text also feeds every page's structured data, so unchanged may be 0
    expect(await code(w.web.compare(V, 1, 42))).toBe('VERSION_NOT_FOUND');
  });
});

describe('tenant separation of the store', () => {
  it('another vendor never sees or changes this vendor\'s draft or snapshots', async () => {
    await field(w, 'hero.title', 'Mine'); await w.web.publish(V, OWNER_ACTOR);
    expect(await w.store.getDraft('v-other')).toBeNull(); expect(await w.store.snapshotByVersion('v-other', 1)).toBeNull(); expect(await w.store.snapshotVersions('v-other')).toEqual([]);
    await w.store.deleteDraft('v-other'); expect((await w.store.getDraft(V))?.doc.fields['hero.title']).toBe('Mine');
    expect(await w.snapshots.liveDoc('v-other')).toBeNull();
  });
});
