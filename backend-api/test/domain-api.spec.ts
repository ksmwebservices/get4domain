import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { DomainsAdminController } from '../src/site-domains/api/domains-admin.controller';
import { MeDomainsController } from '../src/site-domains/api/me-domains.controller';
import { DomainHostResolver, DomainVendorHosts } from '../src/site-domains/site-publish-adapters';
import { SiteDomainsService } from '../src/site-domains/site-domains.service';
import { PublicSiteController } from '../src/site-publish/api/public-site.controller';
import { SitePublicService } from '../src/site-publish/publish/site-public.service';
import { TabGuard } from '../src/v3-packs/requires-tab';
import { BASE, domainWorld, DomainWorld, OWNER, pro, withAddon } from './support/domain-world';
import { STAFF, siteWorld } from './support/site-world';

/** B2 slice 5.6 over HTTP with the real guards, pipe, filter and interceptor; the services are the real ones over the in-memory repositories. */
jest.setTimeout(180_000);
const V = 'v-plumber';

describe('domains API', () => {
  let app: INestApplication; let w: DomainWorld; let sw: ReturnType<typeof siteWorld>;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role: string) => request(app.getHttpServer()).get(url).set(as(role));
  const send = (m: 'post' | 'put' | 'delete', url: string, role: string, body: object = {}) => request(app.getHttpServer())[m](url).set(as(role)).send(body);
  const byHost = (host: string, path = '/') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path });

  beforeEach(async () => {
    w = domainWorld(); w.repo.addVendor(V); w.repo.addVendor('v-other'); w.ents.set(V, pro());
    const dir = w.dir;
    sw = siteWorld({ level: 'PRO', claimed: true, hosts: new DomainVendorHosts(dir) });
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [MeDomainsController, DomainsAdminController, PublicSiteController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard },
        { provide: SiteDomainsService, useValue: w.svc }, { provide: SitePublicService, useValue: new SitePublicService(sw.repo, new DomainHostResolver(dir)) },
      ],
    }).overrideGuard(TabGuard).useValue({ canActivate: () => true })   // the tab lock (B11) is tested in pack-part-b.spec.ts; here the service's own plan rules are under test
      .compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: V, email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-other') req.user = { sub: 'v-other', email: 'x@x.invalid', role: 'VENDOR' };
      else if (p === 'member-all') req.user = { sub: V, email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'telecrm', 'accounts'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('vendor routes (/v3/me/domains), owner only', () => {
    it('GET: the overview with the plan state and the change limit; PUT subdomain reserves it', async () => {
      const put = await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'Sri-Ganesh' });
      expect(put.status).toBe(200); expect(put.body.data).toMatchObject({ hostname: `sri-ganesh.${BASE}`, kind: 'SUBDOMAIN', status: 'ACTIVE', isPrimary: true });
      const r = await get('/v3/me/domains', 'owner');
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ baseDomain: BASE, primaryHost: `sri-ganesh.${BASE}`, customDomain: { allowed: true }, subdomain: { changesUsed: 0, limit: 2, periodDays: 365 } });
    });
    it('a team member is refused on EVERY route, even with every area (domains are the business identity)', async () => {
      const id = (await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' })).body.data.id as string;
      for (const [m, url, body] of [
        ['get', '/v3/me/domains'], ['put', '/v3/me/domains/subdomain', { slug: 'abc-def' }], ['post', '/v3/me/domains/custom', { hostname: 'x.example.in' }], ['get', `/v3/me/domains/${id}`],
        ['post', `/v3/me/domains/${id}/verify`], ['post', `/v3/me/domains/${id}/primary`], ['delete', `/v3/me/domains/${id}`],
      ] as Array<['get' | 'post' | 'put' | 'delete', string, object?]>) {
        const res = m === 'get' ? await get(url, 'member-all') : await send(m, url, 'member-all', body ?? {});
        expect([m, url, res.status]).toEqual([m, url, 403]);
      }
    });
    it('Free plan: a custom domain request is 403 FEATURE_LOCKED with the upsell text; nothing is created', async () => {
      w.ents.delete(V);   // back to Free
      const r = await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' });
      expect(r.status).toBe(403); expect(r.body).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.custom_domain' }); expect(typeof r.body.upsellText).toBe('string');
      expect(w.repo.rows.size).toBe(0);
    });
    it('Pro: the request returns the TXT instructions; verify with live checks off says DISABLED and queries nothing', async () => {
      const add = await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'Shop.Example.In' });
      expect(add.status).toBe(200); expect(add.body.data).toMatchObject({ hostname: 'shop.example.in', status: 'PENDING', instructions: { type: 'TXT', name: '_g4d-verify.shop.example.in' } });
      w.gate.dns = null;
      const v = await send('post', `/v3/me/domains/${add.body.data.id}/verify`, 'owner');
      expect(v.status).toBe(200); expect(v.body.data).toMatchObject({ result: 'DISABLED', domain: { status: 'VERIFYING' } });
    });
    it('CROSS-TENANT: another vendor cannot read, verify, make primary or remove this vendor\'s domain, and the answer equals the one for an unknown id', async () => {
      const id = (await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' })).body.data.id as string;
      const unknown = await get('/v3/me/domains/nope', 'owner-other');
      expect(unknown.status).toBe(404); expect(unknown.body.code).toBe('DOMAIN_NOT_FOUND');
      for (const [m, url] of [['get', `/v3/me/domains/${id}`], ['post', `/v3/me/domains/${id}/verify`], ['post', `/v3/me/domains/${id}/primary`], ['delete', `/v3/me/domains/${id}`]] as const) {
        const res = m === 'get' ? await get(url, 'owner-other') : await send(m, url, 'owner-other');
        expect([res.status, res.body.code, res.body.message]).toEqual([404, unknown.body.code, unknown.body.message]);
      }
      expect((await w.repo.findById(id))!.status).toBe('PENDING');   // untouched
    });
    it('a host already in use by another vendor, a reserved-by-other subdomain, and a blocked one: the same 409 HOST_UNAVAILABLE', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner-other', { slug: 'taken-name' });
      w.ents.set('v-other', pro()); await send('post', '/v3/me/domains/custom', 'owner-other', { hostname: 'shop.example.in' });
      w.settings.over = { blockedSubdomainWords: ['shady'] };
      const a = await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'taken-name' });
      const b = await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' });
      const c = await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'very-shady-shop' });
      expect([a.status, b.status, c.status]).toEqual([409, 409, 409]);
      expect(new Set([a.body.code, b.body.code, c.body.code])).toEqual(new Set(['HOST_UNAVAILABLE']));
      expect(new Set([a.body.message, b.body.message, c.body.message]).size).toBe(1);
    });
    it('DTO: a missing, non-string or extra field is 400; a bad slug is 400 SUBDOMAIN_INVALID; a reserved one 400 SUBDOMAIN_RESERVED', async () => {
      expect((await send('put', '/v3/me/domains/subdomain', 'owner', {})).status).toBe(400);
      expect((await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 5 })).status).toBe(400);
      expect((await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'abc-def', vendorId: 'v-other' })).status).toBe(400);   // no vendor id from the client, ever
      expect((await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'a' })).body.code).toBe('SUBDOMAIN_INVALID');
      expect((await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'login' })).body.code).toBe('SUBDOMAIN_RESERVED');
    });
    it('the change limit comes back as 429 SUBDOMAIN_CHANGE_LIMIT', async () => {
      for (const s of ['one-name', 'two-name', 'three-name']) await send('put', '/v3/me/domains/subdomain', 'owner', { slug: s });
      const r = await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'four-name' });
      expect(r.status).toBe(429); expect(r.body.code).toBe('SUBDOMAIN_CHANGE_LIMIT');
    });
    it('verification is rate limited per IP: the seventh call within a minute is 429 before the service is reached', async () => {
      const id = (await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' })).body.data.id as string;
      w.gate.dns = null;
      const codes: number[] = [];
      for (let i = 0; i < 7; i++) codes.push((await send('post', `/v3/me/domains/${id}/verify`, 'owner')).status);
      expect(codes.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]); expect(codes[6]).toBe(429);
    });
  });

  describe('staff routes (/v3/admin), OPERATIONS and SUPER_ADMIN only', () => {
    it('MARKETING is refused on every route; a vendor is not staff', async () => {
      const id = (await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' })).body.data.id as string;
      for (const [m, url, body] of [
        ['get', '/v3/admin/domains'], ['get', `/v3/admin/domains/${id}`], ['post', `/v3/admin/domains/${id}/verify`], ['put', `/v3/admin/domains/${id}/state`, { status: 'FAILED', reason: 'because' }],
        ['post', `/v3/admin/domains/${id}/primary`], ['post', `/v3/admin/domains/${id}/remove`], ['put', `/v3/admin/vendors/${V}/domains/subdomain`, { slug: 'abc-def', reason: 'because' }],
      ] as Array<['get' | 'post' | 'put', string, object?]>) {
        const res = m === 'get' ? await get(url, 'MARKETING') : await send(m, url, 'MARKETING', body ?? {});
        expect([m, url, res.status]).toEqual([m, url, 403]);
        const vend = m === 'get' ? await get(url, 'owner') : await send(m, url, 'owner', body ?? {});
        expect(vend.status).toBe(403);
      }
    });
    it('OPERATIONS and SUPER_ADMIN list with filters, read one, force a state with a reason (audited), and set a subdomain on behalf', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'mine-first' });
      const add = await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' }); const id = add.body.data.id as string;
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) {
        const list = await get(`/v3/admin/domains?vendorId=${V}&kind=CUSTOM`, role);
        expect(list.status).toBe(200); expect(list.body.data.total).toBe(1); expect(list.body.data.items[0].instructions).toBeNull();   // no TXT value in lists
        expect((await get(`/v3/admin/domains/${id}`, role)).body.data.instructions.type).toBe('TXT');
      }
      expect((await send('put', `/v3/admin/domains/${id}/state`, 'OPERATIONS', { status: 'ACTIVE' })).status).toBe(400);   // reason required
      const forced = await send('put', `/v3/admin/domains/${id}/state`, 'OPERATIONS', { status: 'ACTIVE', sslStatus: 'PENDING', reason: 'confirmed by phone' });
      expect(forced.status).toBe(200); expect(forced.body.data).toMatchObject({ status: 'ACTIVE', sslStatus: 'PENDING', isPrimary: true });
      expect(w.repo.audits.at(-1)).toMatchObject({ action: 'domain.custom.force_state', actor: { type: 'STAFF', id: 'staff-1' } });
      const sub = await send('put', `/v3/admin/vendors/${V}/domains/subdomain`, 'SUPER_ADMIN', { slug: 'staff-chosen', reason: 'owner called us' });
      expect(sub.status).toBe(200); expect(sub.body.data.hostname).toBe(`staff-chosen.${BASE}`);
    });
  });

  describe('the public by-host API follows the domain tables (same contract, plus redirects)', () => {
    const publish = async (): Promise<void> => { const r = (await sw.build.build(V, { actor: STAFF })).publication; await sw.publish.publish(V, r.id, STAFF); };
    const activeCustom = async (): Promise<void> => {
      w.settings.over = { domainDnsLiveChecks: true };
      const add = await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' });
      w.txt.answers = [[add.body.data.instructions.value]];
      expect((await send('post', `/v3/me/domains/${add.body.data.id}/verify`, 'owner')).body.data.domain.status).toBe('ACTIVE');
    };

    it('the free subdomain is served (200) and an unknown or pending host is the one plain 404', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'sri-ganesh' }); await publish();
      expect((await byHost(`sri-ganesh.${BASE}`)).status).toBe(200);
      await send('post', '/v3/me/domains/custom', 'owner', { hostname: 'shop.example.in' });
      const pending = await byHost('shop.example.in'); const unknown = await byHost('nothing.example.org');
      expect([pending.status, unknown.status]).toEqual([404, 404]); expect(pending.text).toBe(unknown.text);
    });
    // B3 slice 5.6b (owner rule 4): the subdomain is canonical unless the custom-domain promotion add-on is active
    it('verified custom domain WITHOUT the add-on: both hosts serve (200), neither redirects, and the public read says the canonical host is the subdomain', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'sri-ganesh' }); await publish(); await activeCustom();
      const custom = await byHost('shop.example.in'); const sub = await byHost(`sri-ganesh.${BASE}`);
      expect([custom.status, sub.status]).toEqual([200, 200]);
      expect(custom.headers['x-canonical-host']).toBe(`sri-ganesh.${BASE}`); expect(sub.headers['x-canonical-host']).toBe(`sri-ganesh.${BASE}`);
    });
    it('WITH the add-on the custom domain is served and canonical, and the subdomain and the www alias answer 301 to it with the path kept', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'sri-ganesh' }); await publish(); await activeCustom();
      w.ents.set(V, withAddon(pro())); w.dir.invalidate();
      const served = await byHost('shop.example.in'); expect(served.status).toBe(200); expect(served.headers['x-canonical-host']).toBe('shop.example.in');
      const r1 = await byHost(`sri-ganesh.${BASE}`, '/about'); expect(r1.status).toBe(301); expect(r1.headers.location).toBe('https://shop.example.in/about');
      const r2 = await byHost('www.shop.example.in', '/'); expect(r2.status).toBe(301); expect(r2.headers.location).toBe('https://shop.example.in/');
      expect((await byHost('www.other.example.in')).status).toBe(404);
    });
    it('after the add-on ends and the plan falls to Free the custom domain redirects to the subdomain (owner answer Q11) and the subdomain is canonical; nothing is deleted', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'sri-ganesh' }); await publish(); await activeCustom();
      w.ents.set(V, withAddon(pro())); w.dir.invalidate();
      expect((await byHost(`sri-ganesh.${BASE}`)).status).toBe(301);
      w.ents.delete(V); w.dir.invalidate();   // the override expired and the plan is Free again
      const r = await byHost('shop.example.in', '/contact'); expect(r.status).toBe(302); expect(r.headers.location).toBe(`https://sri-ganesh.${BASE}/contact`);   // Q11 replaces "keeps serving": a temporary redirect, because it comes back with Pro
      expect((await byHost(`sri-ganesh.${BASE}`)).status).toBe(200);
      expect([...w.repo.rows.values()].find((x) => x.hostname === 'shop.example.in')).toMatchObject({ status: 'ACTIVE', isPrimary: true });
    });
    it('after a subdomain change the old address redirects to the new one', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'old-name' }); await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'new-name' }); await publish();
      const r = await byHost(`old-name.${BASE}`, '/services'); expect(r.status).toBe(301); expect(r.headers.location).toBe(`https://new-name.${BASE}/services`);
      expect((await byHost(`new-name.${BASE}`)).status).toBe(200);
    });
    it('the build uses the canonical host for the canonical address; the custom domain becomes the site address only with the add-on and an ACTIVE verified domain', async () => {
      await send('put', '/v3/me/domains/subdomain', 'owner', { slug: 'sri-ganesh' }); await publish();
      const before = (await sw.repo.currentPublication(V))!;
      expect(JSON.stringify((await sw.repo.getPage(before.id, '/', 'en'))!.seoJson)).toContain(`https://sri-ganesh.${BASE}`);
      await activeCustom();
      const unchanged = (await sw.build.build(V, { actor: STAFF })).publication;
      expect(unchanged.id).toBe(before.id);   // a verified custom domain without the add-on changes nothing about the site
      w.ents.set(V, withAddon(pro())); w.dir.invalidate();
      const second = (await sw.build.build(V, { actor: STAFF })).publication;
      expect(second.id).not.toBe(before.id);   // the host change is a real change to the site
      const home = (await sw.repo.getPage(second.id, '/', 'en'))!;
      expect(home.html).toContain('https://shop.example.in');
      expect(home.html).not.toContain(`https://sri-ganesh.${BASE}`);
    });
  });
});
void OWNER;
