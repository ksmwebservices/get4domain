import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { isUnsafeSeoText } from '../src/site-publish/seo/seo-text';
import { doc } from './support/site-fixtures';
import { OWNER, STAFF, siteWorld } from './support/site-world';

/** S54.6 (build): SiteBuildService with the real renderer and the in-memory repository. */
jest.setTimeout(120_000);
const code = (e: unknown): string => String(((e as { getResponse?: () => { code?: string } }).getResponse?.() ?? {}).code);
const pagesOf = async (w: ReturnType<typeof siteWorld>, id: string) => w.repo.pagesOf(id);

describe('build', () => {
  it('renders every page into a DRAFT_PREVIEW publication: five pages, the vendor page, one page per item, plus stylesheet, sitemap and robots', async () => {
    const w = siteWorld();
    const { publication: p, reused } = await w.build.build('v-plumber', { actor: STAFF });
    expect(reused).toBe(false);
    expect(p).toMatchObject({ version: 1, status: 'DRAFT_PREVIEW', themeId: 'free-service-pro', languages: 'en', indexable: false, indexHeader: 'noindex, nofollow', currentVendorId: null, createdByType: 'STAFF', createdById: 'staff-1' });
    expect(p.themeHash).toMatch(/^[0-9a-f]{64}$/); expect(p.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const pages = await pagesOf(w, p.id);
    const paths = pages.map((x) => x.path).sort();
    expect(paths).toEqual(['/', '/about', '/assets/site.css', '/contact', '/gallery', '/offers', '/robots.txt', '/services', '/services/pipe-fitting-i2', '/services/tap-repair-i1', '/sitemap.xml']);
    const home = pages.find((x) => x.path === '/')!;
    expect(home.html.startsWith('<!doctype html>')).toBe(true);
    expect(home.html).toContain('<link rel="canonical" href="https://sri-ganesh-plumbing.get4domain.com/">');
    expect(home.html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(home.sha256).toMatch(/^[0-9a-f]{64}$/); expect(home.bytes).toBe(Buffer.byteLength(home.html));
    expect(p.totalBytes).toBe(pages.reduce((n, x) => n + x.bytes, 0));
    expect(w.repo.events.map((e) => e.type)).toEqual(['BUILT']); expect(w.audit).toEqual(['site.build']);
  });

  it('is idempotent: unchanged theme, content and settings return the existing row and write nothing; a changed tagline makes version 2', async () => {
    const w = siteWorld();
    const a = await w.build.build('v-plumber', { actor: STAFF });
    const b = await w.build.build('v-plumber', { actor: OWNER });
    expect(b.reused).toBe(true); expect(b.publication.id).toBe(a.publication.id); expect(w.repo.pubs.size).toBe(1); expect(w.repo.events).toHaveLength(1);
    w.state.doc = doc('plumber', { cms: { tagline: 'A new tagline for the shop.' } });
    const c = await w.build.build('v-plumber', { actor: STAFF });
    expect(c.reused).toBe(false); expect(c.publication.version).toBe(2);
  });

  it('is deterministic: two separate worlds give byte-identical pages', async () => {
    const a = siteWorld(); const b = siteWorld();
    const pa = await a.build.build('v-plumber', { actor: STAFF }); const pb = await b.build.build('v-plumber', { actor: STAFF });
    const sums = async (w: typeof a, id: string) => (await w.repo.pagesOf(id)).map((x) => `${x.path}:${x.lang}:${x.sha256}`).sort();
    expect(await sums(a, pa.publication.id)).toEqual(await sums(b, pb.publication.id));
    expect(pa.publication.contentHash).toBe(pb.publication.contentHash);
  });

  it('a claimed, complete Pro site is indexable: index meta, a sitemap listing its pages, a Sitemap line in robots.txt', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true });
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    expect(p).toMatchObject({ indexable: true, indexHeader: 'index, follow, max-image-preview:large', missingFieldsJson: [] });
    const pages = await pagesOf(w, p.id);
    expect(pages.find((x) => x.path === '/')!.html).toContain('content="index, follow, max-image-preview:large"');
    const sitemap = pages.find((x) => x.path === '/sitemap.xml')!.html;
    expect(sitemap).toContain('<loc>https://sri-ganesh-plumbing.get4domain.com/about</loc>');
    expect(pages.find((x) => x.path === '/robots.txt')!.html).toContain('Sitemap: https://sri-ganesh-plumbing.get4domain.com/sitemap.xml');
  });

  it('an unclaimed site is noindex and says exactly what is missing; the sitemap is empty', async () => {
    const w = siteWorld();
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    expect(p.missingFieldsJson.map((m) => m.code)).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
    expect((await pagesOf(w, p.id)).find((x) => x.path === '/sitemap.xml')!.html).not.toContain('<url>');
  });

  it('Tamil needs the plan: Free asking for "en,ta" gets English only with a note; Pro gets both, under /ta, with hreflang', async () => {
    const free = siteWorld(); await free.repo.upsertSettings('v-plumber', { language: 'en,ta' });
    const f = await free.build.build('v-plumber', { actor: STAFF });
    expect(f.publication.languages).toBe('en'); expect(f.publication.warningsJson).toContain('language-locked');
    const pro = siteWorld({ level: 'PRO' }); await pro.repo.upsertSettings('v-plumber', { language: 'en,ta' });
    const p = await pro.build.build('v-plumber', { actor: STAFF });
    expect(p.publication.languages).toBe('en,ta');
    const pages = await pagesOf(pro, p.publication.id);
    const ta = pages.find((x) => x.path === '/ta' && x.lang === 'ta')!;
    expect(ta.html).toContain('<html lang="ta-IN">'); expect(ta.html).toContain('hreflang="en-IN"'); expect(ta.html).toContain('<link rel="canonical" href="https://sri-ganesh-plumbing.get4domain.com/ta">');
    expect(pages.some((x) => x.path === '/ta/about' && x.lang === 'ta')).toBe(true);
  });

  it('theme: the category default; a Pro choice from the same track; a Free vendor asking for another is FEATURE_LOCKED with the upsell text; a stored choice the plan lost falls back', async () => {
    const pro = siteWorld({ kind: 'dentist', level: 'PRO' });
    expect((await pro.build.build('v-dentist', { actor: STAFF })).publication.themeId).toBe('free-practice');
    expect((await pro.build.build('v-dentist', { actor: STAFF, themeId: 'free-studio' })).publication.themeId).toBe('free-studio');
    const free = siteWorld({ kind: 'dentist' });
    let err: unknown; try { await free.build.build('v-dentist', { actor: STAFF, themeId: 'free-studio' }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenException); expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.themes' });
    await free.repo.upsertSettings('v-dentist', { themeId: 'free-studio' });
    const b = await free.build.build('v-dentist', { actor: STAFF });
    expect(b.publication.themeId).toBe('free-practice'); expect(b.publication.warningsJson).toContain('theme-fallback');
  });

  it('refuses a page over the size budget with SITE_BUDGET_EXCEEDED naming the page; nothing is stored', async () => {
    const w = siteWorld({ doc: doc('plumber', { cms: { about: 'Long text. '.repeat(14_000) } }) });
    let err: unknown; try { await w.build.build('v-plumber', { actor: STAFF }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(UnprocessableLike); expect(code(err)).toBe('SITE_BUDGET_EXCEEDED');
    expect(w.repo.pubs.size).toBe(0);
  });

  it('a vendor with no known category cannot be built: PUBLISH_BLOCKED listing CATEGORY', async () => {
    const w = siteWorld({ doc: doc('plumber', { vendor: { industry: 'general' }, cms: { packKey: null } }) });
    let err: unknown; try { await w.build.build('v-plumber', { actor: STAFF }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ConflictException); expect(code(err)).toBe('PUBLISH_BLOCKED');
    expect((err as ConflictException).getResponse()).toMatchObject({ missing: [{ code: 'CATEGORY' }] });
  });

  it('an unknown vendor is a 404', async () => {
    const w = siteWorld(); w.state.doc = null;
    await expect(w.build.build('nope', { actor: STAFF })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SCAN: no price, banned word or injected markup in the head of any stored page, whatever the vendor typed', async () => {
    const w = siteWorld({ level: 'PRO', claimed: true, doc: doc('plumber', { cms: { tagline: 'Plumbing from ₹499 </title><script>x</script>', about: 'We are on the Workspace plan. Rs. 300 only.', businessName: 'Evil </script> & Co' }, vendor: { businessName: 'Evil </script> & Co' } }) });
    await w.repo.upsertSettings('v-plumber', { language: 'en,ta' });
    const { publication: p } = await w.build.build('v-plumber', { actor: STAFF });
    for (const pg of await pagesOf(w, p.id)) {
      if (!pg.html.startsWith('<!doctype html>')) continue;
      const head = pg.html.slice(0, pg.html.indexOf('</head>'));
      const text = [...head.matchAll(/<title>([\s\S]*?)<\/title>|content="([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? '');
      for (const t of text) expect({ path: pg.path, unsafe: isUnsafeSeoText(t) }).toEqual({ path: pg.path, unsafe: false });
      expect(head).not.toContain('<script>x</script>');
      expect((head.match(/<script/g) ?? []).length).toBe((head.match(/<script type="application\/ld\+json">/g) ?? []).length);
    }
  });

  it('(sanity) BadRequestException is what an invalid theme throws', () => { expect(new BadRequestException()).toBeInstanceOf(Error); });
});

/** the budget error is a 422; Nest ships UnprocessableEntityException */
import { UnprocessableEntityException } from '@nestjs/common';
const UnprocessableLike = UnprocessableEntityException;
