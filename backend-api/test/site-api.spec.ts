import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { MeSiteController } from '../src/site-publish/api/me-site.controller';
import { PublicSiteController } from '../src/site-publish/api/public-site.controller';
import { SitesAdminController } from '../src/site-publish/api/sites-admin.controller';
import { SitePreviewService } from '../src/site-publish/publish/site-preview.service';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { SitePublicService } from '../src/site-publish/publish/site-public.service';
import { SiteSettingsService } from '../src/site-publish/publish/site-settings.service';
import { SiteRepository } from '../src/site-publish/publish/site.repository';
import { RegistrationHook } from '../src/plans/registration/registration.hook';
import { SiteProvisionFacts } from '../src/site-publish/publish/site-provision-facts.service';
import { doc } from './support/site-fixtures';
import { STAFF, siteWorld } from './support/site-world';

/** S54.7: vendor, staff and public routes over HTTP with the real guards, pipe, filter and interceptor; the services are the real ones over the in-memory repository. */
jest.setTimeout(180_000);
const V = 'v-plumber';
const HOST = 'sri-ganesh-plumbing.get4domain.com';

describe('site API', () => {
  let app: INestApplication; let w: ReturnType<typeof siteWorld>;

  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role: string) => request(app.getHttpServer()).get(url).set(as(role));
  const send = (m: 'post' | 'put', url: string, role: string, body: object = {}) => request(app.getHttpServer())[m](url).set(as(role)).send(body);

  beforeEach(async () => {
    w = siteWorld({ level: 'PRO', claimed: true });
    w.state.vendorHosts.set(HOST, { vendorId: V, removed: false });
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [MeSiteController, SitesAdminController, PublicSiteController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, SitePreviewService,
        { provide: SiteRepository, useValue: w.repo }, { provide: SiteBuildService, useValue: w.build }, { provide: PublishService, useValue: w.publish },
        { provide: SiteSettingsService, useValue: w.settings }, { provide: SitePublicService, useValue: w.pub },
        // the controller asks the plans module (global in the app) for the registration hook, used only by POST /v3/me/site/create, which this spec does not call
        { provide: SiteProvisionFacts, useValue: { provision: async () => ({ siteProvisionStatus: null, siteProvisionCode: null, siteProvisionFailedAt: null }), forAdmin: async () => ({ status: null, subdomain: null, address: null, siteProvisionStatus: null, siteProvisionCode: null, siteProvisionFailedAt: null }) } },
        { provide: RegistrationHook, useValue: { createMySite: async () => ({ status: 'LIVE', published: true, subdomain: null, url: null }) } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: V, email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-other') req.user = { sub: 'v-other', email: 'x@x.invalid', role: 'VENDOR' };
      else if (p === 'member-website') req.user = { sub: V, email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website'] };
      else if (p === 'member-crm') req.user = { sub: V, email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['telecrm'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  const buildAndPublish = async (): Promise<string> => {
    const r = await send('post', '/v3/me/site/build', 'owner');
    const pub = await send('post', '/v3/me/site/publish', 'owner', { publicationId: r.body.data.publication.id });
    expect(pub.status).toBe(200);
    return r.body.data.publication.id as string;
  };

  describe('vendor routes (/v3/me/site)', () => {
    it('GET: settings, current and preview summaries, missing fields and allowed themes; no html', async () => {
      const r = await get('/v3/me/site', 'owner');
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ themeId: 'free-service-pro', current: null, preview: null, missing: [], allowedThemes: ['free-service-pro'] });
      expect(JSON.stringify(r.body)).not.toContain('<!doctype');
    });
    it('a team member needs the website area; with it they may read and build, but theme, publish and rollback are owner-only', async () => {
      expect((await get('/v3/me/site', 'member-crm')).status).toBe(403);
      expect((await get('/v3/me/site', 'member-website')).status).toBe(200);
      expect((await send('post', '/v3/me/site/build', 'member-website')).status).toBe(200);
      for (const [m, url, body] of [['put', '/v3/me/site/theme', { themeId: 'free-service-pro' }], ['post', '/v3/me/site/publish', { publicationId: 'x' }], ['post', '/v3/me/site/rollback', { toVersion: 1 }]] as const) {
        expect((await send(m, url, 'member-website', body)).status).toBe(403);
      }
    });
    it('build -> publish -> the public read serves it; the preview is not public', async () => {
      const id = await buildAndPublish();
      const status = await get('/v3/me/site', 'owner');
      expect(status.body.data.current).toMatchObject({ id, status: 'PUBLISHED', indexable: true });
      const pubRes = await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: HOST, path: '/' });
      expect(pubRes.status).toBe(200); expect(pubRes.text.startsWith('<!doctype html>')).toBe(true);
    });
    it('rollback needs the plan feature and an owner; it returns the new PUBLISHED version', async () => {
      await buildAndPublish();
      const again = await send('post', '/v3/me/site/build', 'owner');   // unchanged: reused
      expect(again.body.data.reused).toBe(true);
      const r = await send('post', '/v3/me/site/rollback', 'owner', { toVersion: 1 });
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ version: 2, status: 'PUBLISHED', rolledBackFromVersion: 1 });
    });
    it('theme: Pro may pick a theme of their track; a Free vendor gets 403 FEATURE_LOCKED with the upsell text; DTO and unknown theme are 400', async () => {
      expect((await send('put', '/v3/me/site/theme', 'owner', { themeId: 'free-service-pro' })).status).toBe(200);
      const bad = await send('put', '/v3/me/site/theme', 'owner', { themeId: 'Bad Id!' }); expect(bad.status).toBe(400);
      const unknown = await send('put', '/v3/me/site/theme', 'owner', { themeId: 'nope-theme' }); expect(unknown.status).toBe(400); expect(unknown.body.code).toBe('THEME_INVALID');
      expect((await send('put', '/v3/me/site/theme', 'owner', { themeId: 'free-service-pro', extra: 1 })).status).toBe(400);
      const free = siteWorld({ kind: 'dentist' });
      let err: unknown; try { await free.settings.setTheme('v-dentist', 'free-studio', STAFF); } catch (e) { err = e; }
      expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe('FEATURE_LOCKED');
    });
    it('CROSS-TENANT: another vendor cannot publish, roll back to, or preview this vendor\'s publication, and gets the same 404 as for an unknown one', async () => {
      const id = await buildAndPublish();
      const other = await send('post', '/v3/me/site/publish', 'owner-other', { publicationId: id }); expect(other.status).toBe(404); expect(other.body.code).toBe('PUBLICATION_NOT_FOUND');
      const unknown = await send('post', '/v3/me/site/publish', 'owner-other', { publicationId: 'nope' }); expect(unknown.body.code).toBe('PUBLICATION_NOT_FOUND');
      expect((await send('post', '/v3/me/site/rollback', 'owner-other', { toVersion: 1 })).status).toBe(404);
      const prev = await get(`/v3/me/site/preview/${id}/${encodeURIComponent('/')}`, 'owner-other'); expect(prev.status).toBe(404); expect(prev.body.code).toBe('PUBLICATION_NOT_FOUND');
      expect([...w.repo.pubs.values()].filter((p) => p.vendorId === 'v-other')).toHaveLength(0);
    });
    it('preview: the stored page with a preview-only, never-indexable header and the stylesheet link pointing at the preview; unknown path 404', async () => {
      const id = await buildAndPublish();
      const r = await get(`/v3/me/site/preview/${id}/${encodeURIComponent('/about')}`, 'owner');
      expect(r.status).toBe(200);
      expect(r.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive'); expect(r.headers['cache-control']).toBe('no-store'); expect(r.headers['x-preview']).toBe('1');
      expect(r.headers['content-type']).toContain('text/html');
      expect(r.text).toContain(`/v3/me/site/preview/${id}/${encodeURIComponent('/assets/site.css')}`); expect(r.text).not.toContain('href="/assets/site.css"');
      const css = await get(`/v3/me/site/preview/${id}/${encodeURIComponent('/assets/site.css')}`, 'owner');
      expect(css.headers['content-type']).toContain('text/css');
      expect((await get(`/v3/me/site/preview/${id}/${encodeURIComponent('/nope')}`, 'owner')).status).toBe(404);
    });
  });

  describe('staff routes (/v3/admin)', () => {
    it('E9b: every row of the sites list carries indexable and publishedIndexable, equal to the one-vendor route, before and after the facts change', async () => {
      const both = async () => {
        const row = (await get('/v3/admin/sites', 'OPERATIONS')).body.data.items.find((i: { vendorId: string }) => i.vendorId === V);
        const one = (await get(`/v3/admin/vendors/${V}/site`, 'OPERATIONS')).body.data;
        expect({ indexable: row.indexable, publishedIndexable: row.publishedIndexable }).toEqual({ indexable: one.indexable, publishedIndexable: one.publishedIndexable });
        return row as { indexable: boolean; publishedIndexable: boolean | null };
      };
      await buildAndPublish();
      expect(await both()).toMatchObject({ indexable: true, publishedIndexable: true });
      expect((await send('put', `/v3/admin/vendors/${V}/site/noindex`, 'OPERATIONS', { forceNoindex: true })).status).toBe(200);
      expect(await both()).toMatchObject({ indexable: false, publishedIndexable: false });
    });
    it('E9b: a site with a preview only has publishedIndexable null; a business whose check fails gets indexable null and the list still answers', async () => {
      expect((await send('post', '/v3/me/site/build', 'owner')).status).toBe(200);
      const draft = (await get('/v3/admin/sites', 'MARKETING')).body.data.items[0];
      expect(draft).toMatchObject({ vendorId: V, publishedIndexable: null }); expect(typeof draft.indexable).toBe('boolean');
      const spy = jest.spyOn(w.settings as unknown as { context: () => Promise<unknown> }, 'context').mockRejectedValue(new Error('broken record'));
      const r = await get('/v3/admin/sites', 'OPERATIONS'); expect(r.status).toBe(200); expect(r.body.data.items[0].indexable).toBeNull();
      spy.mockRestore();
    });
    it('MARKETING reads summaries (list and one site) but never html, and writes nothing', async () => {
      await buildAndPublish();
      const list = await get('/v3/admin/sites', 'MARKETING'); expect(list.status).toBe(200);
      expect(list.body.data.items[0]).toMatchObject({ vendorId: V, current: { status: 'PUBLISHED' } }); expect(JSON.stringify(list.body)).not.toContain('<!doctype');
      expect((await get(`/v3/admin/vendors/${V}/site`, 'MARKETING')).status).toBe(200);
      const id = [...w.repo.pubs.keys()][0];
      expect((await get(`/v3/admin/vendors/${V}/site/preview/${id}/${encodeURIComponent('/')}`, 'MARKETING')).status).toBe(403);
      for (const [m, url, body] of [
        ['put', `/v3/admin/vendors/${V}/site/theme`, { themeId: 'free-service-pro' }], ['post', `/v3/admin/vendors/${V}/site/build`, {}], ['post', `/v3/admin/vendors/${V}/site/publish`, { publicationId: id }],
        ['put', `/v3/admin/vendors/${V}/site/noindex`, { forceNoindex: true }],
      ] as const) expect((await send(m, url, 'MARKETING', body)).status).toBe(403);
    });
    it('a vendor token is refused on every staff route', async () => {
      for (const url of ['/v3/admin/sites', `/v3/admin/vendors/${V}/site`]) expect((await get(url, 'owner')).status).toBe(403);
      expect((await send('post', `/v3/admin/vendors/${V}/site/build`, 'owner')).status).toBe(403);
    });
    // going back to an earlier version moved to the website module (E11a): its staff cases are in e11a-site-versions.spec.ts
    it('OPERATIONS builds, publishes, previews html and switches noindex on behalf of a vendor', async () => {
      const b = await send('post', `/v3/admin/vendors/${V}/site/build`, 'OPERATIONS'); expect(b.status).toBe(200);
      const id = b.body.data.publication.id as string;
      const prev = await get(`/v3/admin/vendors/${V}/site/preview/${id}/${encodeURIComponent('/')}`, 'OPERATIONS'); expect(prev.status).toBe(200); expect(prev.headers['x-robots-tag']).toContain('noindex');
      expect((await send('post', `/v3/admin/vendors/${V}/site/publish`, 'OPERATIONS', { publicationId: id })).status).toBe(200);
      const off = await send('put', `/v3/admin/vendors/${V}/site/noindex`, 'SUPER_ADMIN', { forceNoindex: true });
      expect(off.status).toBe(200); expect(off.body.data.published).toMatchObject({ indexable: false });
    });
    it('PUBLISH_BLOCKED carries the missing list through the error filter', async () => {
      const id = (await send('post', `/v3/admin/vendors/${V}/site/build`, 'OPERATIONS')).body.data.publication.id as string;
      w.repo.pubs.get(id)!.warningsJson = ['missing-template:home'];
      const blocked = await send('post', `/v3/admin/vendors/${V}/site/publish`, 'OPERATIONS', { publicationId: id });
      expect(blocked.status).toBe(409); expect(blocked.body.code).toBe('PUBLISH_BLOCKED'); expect(blocked.body.missing).toEqual([{ code: 'RENDER_WARNING', label: 'missing-template:home' }]);
    });
  });

  describe('public read (/v3/public/site/by-host)', () => {
    it('serves the published page with an ETag from its sha256, cache headers, the language and (for a noindex site) the robots header; 304 on a matching If-None-Match', async () => {
      w.state.doc = doc('plumber', { claimed: false });   // unclaimed: the site is noindex
      await buildAndPublish();
      const r = await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: HOST, path: '/about', lang: 'en' });
      expect(r.status).toBe(200); expect(r.headers.etag).toMatch(/^"[0-9a-f]{64}"$/); expect(r.headers['cache-control']).toMatch(/max-age=\d+/);
      expect(r.headers['x-robots-tag']).toBe('noindex, nofollow'); expect(r.headers['content-language']).toBe('en'); expect(r.headers['content-type']).toContain('text/html');
      const again = await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: HOST, path: '/about' }).set('If-None-Match', r.headers.etag);
      expect(again.status).toBe(304);
    });
    it('one identical 404 for an unknown host, a removed business, nothing published and an unknown path; bad input is the same 404; it needs no login', async () => {
      await buildAndPublish();
      const norm = (r: request.Response) => `${r.status}|${r.headers['content-type']}|${r.text}`;
      const unknownHost = norm(await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: 'nobody.get4domain.com', path: '/' }));
      const unknownPath = norm(await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: HOST, path: '/nope' }));
      w.state.vendorHosts.get(HOST)!.removed = true;
      const removed = norm(await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: HOST, path: '/' }));
      const noHost = norm(await request(app.getHttpServer()).get('/v3/public/site/by-host'));
      for (const x of [unknownPath, removed, noHost]) expect(x).toBe(unknownHost);
      expect(unknownHost.startsWith('404|')).toBe(true);
    });
    it('is rate limited per IP', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 340; i++) codes.push((await request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host: 'nobody.get4domain.com', path: '/' })).status);
      expect(codes).toContain(429);
    });
  });
});
