import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { entitlements, doc } from './support/site-fixtures';
import { OWNER, STAFF, siteWorld } from './support/site-world';

/** S54.6 (publish, rollback, settings, public read): the rules around PUBLISHED, under a per-vendor lock, with audit and events. */
jest.setTimeout(120_000);
const V = 'v-plumber';
const code = (e: unknown): string => String(((e as { getResponse?: () => { code?: string } }).getResponse?.() ?? {}).code);
async function twoVersions(w: ReturnType<typeof siteWorld>) {
  const a = (await w.build.build(V, { actor: STAFF })).publication;
  w.state.doc = doc('plumber', { claimed: w.state.doc?.claimed, cms: { tagline: 'Second version tagline.' } });
  const b = (await w.build.build(V, { actor: STAFF })).publication;
  return { a, b };
}

describe('publish', () => {
  it('makes the preview PUBLISHED, supersedes the previous one, sets the single-current marker, and writes an event and an audit row', async () => {
    const w = siteWorld();
    const { a, b } = await twoVersions(w);
    const p1 = await w.publish.publish(V, a.id, STAFF);
    expect(p1).toMatchObject({ status: 'PUBLISHED', currentVendorId: V }); expect(p1.publishedAt).not.toBeNull();
    const p2 = await w.publish.publish(V, b.id, OWNER);
    expect(p2.status).toBe('PUBLISHED');
    expect((await w.repo.getPublication(a.id))!).toMatchObject({ status: 'SUPERSEDED', currentVendorId: null });
    expect([...w.repo.pubs.values()].filter((x) => x.status === 'PUBLISHED')).toHaveLength(1);
    expect(w.repo.events.filter((e) => e.type === 'PUBLISHED')).toHaveLength(2);
    expect(w.audit.filter((x) => x === 'site.publish')).toHaveLength(2);
  });

  it('publishing the one already PUBLISHED is a no-op that returns it', async () => {
    const w = siteWorld(); const { a } = await twoVersions(w);
    await w.publish.publish(V, a.id, STAFF);
    const again = await w.publish.publish(V, a.id, STAFF);
    expect(again.status).toBe('PUBLISHED'); expect(w.repo.events.filter((e) => e.type === 'PUBLISHED')).toHaveLength(1);
  });

  it('another vendor\'s publication, and an unknown one, are the same PUBLICATION_NOT_FOUND', async () => {
    const w = siteWorld(); const { a } = await twoVersions(w);
    for (const [vendor, id] of [['someone-else', a.id], [V, 'nope']] as const) {
      let err: unknown; try { await w.publish.publish(vendor, id, STAFF); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(NotFoundException); expect(code(err)).toBe('PUBLICATION_NOT_FOUND');
    }
    expect([...w.repo.pubs.values()].some((x) => x.status === 'PUBLISHED')).toBe(false);
  });

  it('a publication that no longer matches the plan is refused with PUBLISH_BLOCKED: Tamil after a downgrade, a theme the plan lost', async () => {
    const w = siteWorld({ level: 'PRO' }); await w.repo.upsertSettings(V, { language: 'en,ta' });
    const p = (await w.build.build(V, { actor: STAFF })).publication;
    w.state.ent = entitlements('FREE', 'handyman');
    let err: unknown; try { await w.publish.publish(V, p.id, STAFF); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ConflictException); expect(code(err)).toBe('PUBLISH_BLOCKED');
    expect(JSON.stringify((err as ConflictException).getResponse())).toContain('LANGUAGE_LOCKED');
  });

  it('a build with blocking warnings can be previewed but not published', async () => {
    const w = siteWorld();
    const p = (await w.build.build(V, { actor: STAFF })).publication;
    w.repo.pubs.get(p.id)!.warningsJson = ['missing-template:services'];
    let err: unknown; try { await w.publish.publish(V, p.id, STAFF); } catch (e) { err = e; }
    expect(code(err)).toBe('PUBLISH_BLOCKED'); expect(JSON.stringify((err as ConflictException).getResponse())).toContain('missing-template:services');
  });

  it('a snapshot built before staff switched the site to noindex cannot be published as indexable', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true });
    const p = (await w.build.build(V, { actor: STAFF })).publication;
    expect(p.indexable).toBe(true);
    await w.repo.upsertSettings(V, { forceNoindex: true });
    let err: unknown; try { await w.publish.publish(V, p.id, STAFF); } catch (e) { err = e; }
    expect(code(err)).toBe('PUBLISH_BLOCKED'); expect(JSON.stringify((err as ConflictException).getResponse())).toContain('FORCE_NOINDEX');
  });

  it('CONCURRENCY: two different previews published at once leave exactly one PUBLISHED; the same one twice is fine', async () => {
    const w = siteWorld(); const { a, b } = await twoVersions(w);
    w.repo.duringPublish = async () => { await new Promise((r) => setTimeout(r, 15)); };
    const results = await Promise.allSettled([w.publish.publish(V, a.id, STAFF), w.publish.publish(V, b.id, OWNER)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const published = [...w.repo.pubs.values()].filter((x) => x.vendorId === V && x.status === 'PUBLISHED');
    expect(published).toHaveLength(1); expect(published[0].currentVendorId).toBe(V);
    expect([...w.repo.pubs.values()].filter((x) => x.status === 'SUPERSEDED')).toHaveLength(1);
    const w2 = siteWorld(); const { a: a2 } = await twoVersions(w2);
    await Promise.all([w2.publish.publish(V, a2.id, STAFF), w2.publish.publish(V, a2.id, STAFF)]);
    expect([...w2.repo.pubs.values()].filter((x) => x.status === 'PUBLISHED')).toHaveLength(1);
  });
});

describe('rollback', () => {
  async function published(w: ReturnType<typeof siteWorld>) {
    const { a, b } = await twoVersions(w);
    await w.publish.publish(V, a.id, STAFF); await w.publish.publish(V, b.id, STAFF);
    return { a, b };
  }

  it('Free plans cannot roll back (site.revisions is a locked preview): FEATURE_LOCKED with the upsell text', async () => {
    const w = siteWorld(); const { a } = await published(w);
    let err: unknown; try { await w.publish.rollback(V, a.version, STAFF); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.revisions', upsellText: 'Go back to an earlier version of your site with Pro.' });
  });

  it('republishes an older snapshot as a NEW version with the rollback lineage, copies its pages exactly, supersedes the current one', async () => {
    const w = siteWorld({ level: 'PRO' }); const { a, b } = await published(w);
    const r = await w.publish.rollback(V, a.version, OWNER);
    expect(r).toMatchObject({ version: 3, status: 'PUBLISHED', rolledBackFromVersion: 1, currentVendorId: V, contentHash: a.contentHash, createdByType: 'VENDOR' });
    expect((await w.repo.getPublication(b.id))!.status).toBe('SUPERSEDED');
    const original = (await w.repo.pagesOf(a.id)).map((x) => `${x.path}:${x.sha256}`).sort();
    expect((await w.repo.pagesOf(r.id)).map((x) => `${x.path}:${x.sha256}`).sort()).toEqual(original);
    expect(w.repo.events.filter((e) => e.type === 'ROLLED_BACK')).toHaveLength(1); expect(w.audit).toContain('site.rollback');
    expect([...w.repo.pubs.values()].filter((x) => x.status === 'PUBLISHED')).toHaveLength(1);
  });

  it('a rollback copy that is later replaced is marked ROLLED_BACK, keeping the lineage readable', async () => {
    const w = siteWorld({ level: 'PRO' }); const { a } = await published(w);
    const r = await w.publish.rollback(V, a.version, STAFF);
    w.state.doc = doc('plumber', { cms: { tagline: 'Third version.' } });
    const c = (await w.build.build(V, { actor: STAFF })).publication;
    await w.publish.publish(V, c.id, STAFF);
    expect((await w.repo.getPublication(r.id))!.status).toBe('ROLLED_BACK');
  });

  it('only a once-published version can be rolled back to: an unknown version, a never-published preview and another vendor are PUBLICATION_NOT_FOUND', async () => {
    const w = siteWorld({ level: 'PRO' }); await published(w);
    w.state.doc = doc('plumber', { cms: { tagline: 'Preview only.' } });
    const preview = (await w.build.build(V, { actor: STAFF })).publication;
    for (const [vendor, version] of [[V, 99], [V, preview.version], ['someone-else', 1]] as const) {
      let err: unknown; try { await w.publish.rollback(vendor, version, STAFF); } catch (e) { err = e; }
      expect(code(err)).toBe('PUBLICATION_NOT_FOUND');
    }
  });

  it('while staff hold the site on noindex, a rollback to an indexable snapshot is blocked', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true }); const { a } = await published(w);
    expect(a.indexable).toBe(true);
    await w.repo.upsertSettings(V, { forceNoindex: true });
    let err: unknown; try { await w.publish.rollback(V, a.version, STAFF); } catch (e) { err = e; }
    expect(code(err)).toBe('PUBLISH_BLOCKED'); expect(JSON.stringify((err as ConflictException).getResponse())).toContain('FORCE_NOINDEX');
  });
});

describe('settings: theme and the staff noindex switch', () => {
  it('a Pro vendor can pick a theme of their track; the choice is stored with its derived layout variant, with an event and an audit row', async () => {
    const w = siteWorld({ kind: 'dentist', level: 'PRO' });
    const s = await w.settings.setTheme('v-dentist', 'free-studio', OWNER);
    expect(s).toMatchObject({ themeId: 'free-studio' }); expect(s.variant).toBeTruthy();
    expect(w.repo.events.map((e) => e.type)).toContain('THEME_CHANGED'); expect(w.audit).toContain('site.theme');
  });
  it('a Free vendor cannot: FEATURE_LOCKED; a track mismatch is THEME_LOCKED; an unknown theme is THEME_INVALID', async () => {
    const free = siteWorld({ kind: 'dentist' });
    await expect(free.settings.setTheme('v-dentist', 'free-studio', OWNER)).rejects.toBeInstanceOf(ForbiddenException);
    const pro = siteWorld({ kind: 'dentist', level: 'PRO' });
    let a: unknown; try { await pro.settings.setTheme('v-dentist', 'free-shop-lite', OWNER); } catch (e) { a = e; }
    expect(code(a)).toBe('THEME_LOCKED');
    let b: unknown; try { await pro.settings.setTheme('v-dentist', 'nope', OWNER); } catch (e) { b = e; }
    expect(code(b)).toBe('THEME_INVALID');
  });
  it('status shows the settings, the current and newest publication, the live missing-field list and the allowed themes', async () => {
    const w = siteWorld({ kind: 'dentist', level: 'PRO' });
    const before = await w.settings.status('v-dentist');
    expect(before).toMatchObject({ current: null, preview: null, themeId: 'free-practice' });
    expect(before.missing.map((m) => m.code)).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
    expect(before.allowedThemes.sort()).toEqual(['free-hospitality', 'free-practice', 'free-studio']);
    const free = await siteWorld({ kind: 'dentist' }).settings.status('v-dentist');
    expect(free.allowedThemes).toEqual(['free-practice']);
  });
  it('the staff noindex switch changes the setting and, when a site is live, publishes a rebuilt noindex version', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true });
    const p = (await w.build.build(V, { actor: STAFF })).publication; await w.publish.publish(V, p.id, STAFF);
    expect((await w.repo.currentPublication(V))!.indexable).toBe(true);
    await w.settings.setForceNoindex(V, true, STAFF);
    const cur = (await w.repo.currentPublication(V))!;
    expect(cur).toMatchObject({ indexable: false, version: 2 });
    expect(cur.missingFieldsJson.map((m) => m.code)).toEqual(['FORCE_NOINDEX']);
    expect(w.repo.events.map((e) => e.type)).toContain('NOINDEX_CHANGED');
    await w.settings.setForceNoindex(V, false, STAFF);
    expect((await w.repo.currentPublication(V))!.indexable).toBe(true);
  });
});

describe('public read by host', () => {
  async function live() {
    const w = siteWorld({ level: 'PRO', claimed: true });
    w.state.vendorHosts.set('sri-ganesh-plumbing.get4domain.com', { vendorId: V, suspended: false });
    const p = (await w.build.build(V, { actor: STAFF })).publication; await w.publish.publish(V, p.id, STAFF);
    return w;
  }
  it('returns the PUBLISHED page with its sha256 as the ETag, the stored robots value, and the content type', async () => {
    const w = await live();
    const r = (await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/', 'en'))!;
    expect(r.status).toBe(200); expect(r.html.startsWith('<!doctype html>')).toBe(true); expect(r.etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(r.robots).toBe('index, follow, max-image-preview:large'); expect(r.contentType).toBe('text/html; charset=utf-8');
    expect((await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/assets/site.css', 'en'))!.contentType).toBe('text/css; charset=utf-8');
    expect((await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/sitemap.xml', 'en'))!.contentType).toBe('application/xml; charset=utf-8');
  });
  it('the same answer (null) for an unknown host, a suspended vendor, an unpublished site and an unknown path', async () => {
    const w = await live();
    expect(await w.pub.byHost('nobody.get4domain.com', '/', 'en')).toBeNull();
    expect(await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/nope', 'en')).toBeNull();
    w.state.vendorHosts.get('sri-ganesh-plumbing.get4domain.com')!.suspended = true;
    expect(await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/', 'en')).toBeNull();
    const draftOnly = siteWorld(); draftOnly.state.vendorHosts.set('x.get4domain.com', { vendorId: V, suspended: false });
    await draftOnly.build.build(V, { actor: STAFF });
    expect(await draftOnly.pub.byHost('x.get4domain.com', '/', 'en')).toBeNull();   // a preview is never public
  });
  it('after a newer preview is built, the public site still serves the PUBLISHED version', async () => {
    const w = await live(); const before = (await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/', 'en'))!;
    w.state.doc = doc('plumber', { claimed: true, cms: { tagline: 'Not published yet.' } });
    await w.build.build(V, { actor: STAFF });
    expect((await w.pub.byHost('sri-ganesh-plumbing.get4domain.com', '/', 'en'))!.etag).toBe(before.etag);
  });
  it('serves the Tamil page by language and path', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true }); await w.repo.upsertSettings(V, { language: 'en,ta' });
    w.state.vendorHosts.set('h.get4domain.com', { vendorId: V, suspended: false });
    const p = (await w.build.build(V, { actor: STAFF })).publication; await w.publish.publish(V, p.id, STAFF);
    const ta = (await w.pub.byHost('h.get4domain.com', '/ta/about', 'ta'))!;
    expect(ta.html).toContain('<html lang="ta-IN">'); expect(ta.lang).toBe('ta');
  });
});
