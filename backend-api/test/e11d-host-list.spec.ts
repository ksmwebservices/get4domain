import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { PublicHostsController } from '../src/site-domains/api/public-hosts.controller';
import { HOST_LIST_CACHE_MS, HostListService, routableLabel } from '../src/site-domains/host-list.service';
import { DEFAULT_DOMAIN_SETTINGS, resolveDomainSettings, SUBDOMAIN_HARD_MAX } from '../src/site-domains/settings/domain-settings';
import { confusableKeys } from '../src/site-domains/core/hostname';
import { VendorsService } from '../src/vendors/vendors.service';

/** E11d backend: the public host list (names only) and the 40 character cap. The database is a fake that applies the filters it is given. */
interface V { id: string; subdomain: string | null; removed?: boolean; publications: string[] }
interface R { vendorId: string; fromHost: string; active: boolean }

function world(vendors: V[], redirects: R[] = [], over: Partial<typeof DEFAULT_DOMAIN_SETTINGS> = {}) {
  const calls = { vendor: 0, redirect: 0 };
  type Live = { v3SiteRemoval: { is: null }; v3SitePublications: { some: { status: string } } };
  const isLive = (v: V, f: Live): boolean => {
    if (!('v3SiteRemoval' in f) || !('v3SitePublications' in f)) throw new Error('a filter is missing');
    return !v.removed && v.publications.includes(f.v3SitePublications.some.status);
  };
  const prisma = {
    vendor: { findMany: async ({ where, select }: { where: Live & { subdomain: { not: null } }; select: Record<string, true> }) => {
      calls.vendor++; expect(Object.keys(select)).toEqual(['subdomain']);
      return vendors.filter((v) => v.subdomain !== where.subdomain.not && isLive(v, where)).map((v) => ({ subdomain: v.subdomain }));
    } },
    v3Redirect: { findMany: async ({ where, select }: { where: { active: boolean; vendor: Live }; select: Record<string, true> }) => {
      calls.redirect++; expect(Object.keys(select)).toEqual(['fromHost']);
      return redirects.filter((r) => r.active === where.active && isLive(vendors.find((v) => v.id === r.vendorId)!, where.vendor)).map((r) => ({ fromHost: r.fromHost }));
    } },
  };
  const settings = { get: async () => resolveDomainSettings(new Map(Object.entries(over))) };
  const svc = new HostListService(prisma as never, settings as never);
  const clock = { t: new Date('2026-11-27T10:00:00Z') }; svc.clock = () => clock.t;
  return { svc, calls, clock };
}
const live = (id: string, subdomain: string | null = id, extra: Partial<V> = {}): V => ({ id, subdomain, publications: ['PUBLISHED'], ...extra });

describe('E11d: which names are listed', () => {
  it('the free address of every business with a published site, sorted, and nothing about the business', async () => {
    const w = world([live('zebra'), live('plumberboy')]);
    expect(await w.svc.list()).toEqual({ hosts: ['plumberboy.get4domain.com', 'zebra.get4domain.com'], generatedAt: '2026-11-27T10:00:00.000Z' });
  });
  it('leaves out a business with nothing published, a removed one and one with no address', async () => {
    const w = world([live('ok'), live('draft', 'draft', { publications: ['DRAFT_PREVIEW'] }), live('old', 'old', { publications: ['SUPERSEDED'] }), live('gone', 'gone', { removed: true }), live('noaddress', null)]);
    expect((await w.svc.list()).hosts).toEqual(['ok.get4domain.com']);
  });
  it('keeps an older address that still redirects, for a live business only, and only under the platform domain', async () => {
    const w = world([live('newname'), live('gone', 'gone', { removed: true })], [
      { vendorId: 'newname', fromHost: 'oldname.get4domain.com', active: true }, { vendorId: 'newname', fromHost: 'switched-off.get4domain.com', active: false },
      { vendorId: 'newname', fromHost: 'shop.example.in', active: true }, { vendorId: 'gone', fromHost: 'was-gone.get4domain.com', active: true }, { vendorId: 'newname', fromHost: 'NewName.get4domain.com', active: true },
    ]);
    expect((await w.svc.list()).hosts).toEqual(['newname.get4domain.com', 'oldname.get4domain.com']);
  });
  it('never lists a reserved name, a look-alike of one, a Version 2 client name or a platform-style prefix', async () => {
    const names = ['admin', 'adm1n', 'mr-travels', 's2travels', 'stepnrock', 'v3site', 'v3admin', 't3-shop', 'good'];
    expect((await world(names.map((n) => live(n))).svc.list()).hosts).toEqual(['good.get4domain.com']);
  });
  it('also leaves out a name the owner added to the reserved setting (the Version 2 export)', async () => {
    const w = world([live('oldclient'), live('good')], [], { reservedSubdomains: ['oldclient'] });
    expect((await w.svc.list()).hosts).toEqual(['good.get4domain.com']);
  });
  it('never lists a name longer than 40 characters, or one that is not a plain label', async () => {
    const names = ['a'.repeat(40), 'b'.repeat(41), '-edge', 'edge-', 'two.parts', 'semi;colon', 'sp ace', 'under_score', '{brace}'];
    expect((await world(names.map((n) => live(n))).svc.list()).hosts).toEqual([`${'a'.repeat(40)}.get4domain.com`]);
  });
  it('uses the platform domain from the settings', async () => {
    expect((await world([live('good')], [], { baseDomain: 'example.test' }).svc.list()).hosts).toEqual(['good.example.test']);
  });
  it('reuses one answer for ten seconds, then reads again', async () => {
    const w = world([live('good')]);
    await w.svc.list(); await w.svc.list(); expect(w.calls.vendor).toBe(1);
    w.clock.t = new Date(w.clock.t.getTime() + HOST_LIST_CACHE_MS); await w.svc.list(); expect(w.calls.vendor).toBe(2);
  });
  it('routableLabel is the single rule', () => {
    const reserved = new Set(confusableKeys('mail'));
    expect([routableLabel('shop', reserved), routableLabel('ma1l', reserved), routableLabel('x'.repeat(41), reserved), routableLabel('v3x', reserved), routableLabel('', reserved)]).toEqual([true, false, false, false, false]);
  });
});

describe('E11d over HTTP: GET /v3/public/site/hosts', () => {
  let app: INestApplication; let fail = false;
  beforeEach(async () => {
    fail = false;
    const w = world([live('plumberboy')]);
    const list = w.svc.list.bind(w.svc);
    w.svc.list = async () => { if (fail) throw new Error('database down: secret-detail'); return list(); };
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [PublicHostsController], providers: [{ provide: HostListService, useValue: w.svc }, throttlerGuardProvider] }).compile();
    app = mod.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });
  const get = () => request(app.getHttpServer()).get('/v3/public/site/hosts');

  it('answers without a sign-in, in the standard envelope, with host names only', async () => {
    const r = await get();
    expect(r.status).toBe(200); expect(r.body.success).toBe(true);
    expect(Object.keys(r.body.data).sort()).toEqual(['generatedAt', 'hosts']);
    expect(r.body.data.hosts).toEqual(['plumberboy.get4domain.com']);
    expect(r.headers['cache-control']).toBe('public, max-age=30');
  });
  it('has an ETag made from the names, and answers 304 with no body to a matching one', async () => {
    const first = await get(); expect(first.headers.etag).toMatch(/^"[0-9a-f]{64}"$/);
    const again = await get().set('If-None-Match', first.headers.etag);
    expect(again.status).toBe(304); expect(again.text).toBeFalsy();
    expect((await get().set('If-None-Match', '"0"')).status).toBe(200);
  });
  it('a fault is an error status, never an empty list the script could act on, and leaks nothing', async () => {
    fail = true;
    const r = await get();
    expect(r.status).toBe(500); expect(r.body.data?.hosts).toBeUndefined(); expect(JSON.stringify(r.body)).not.toContain('secret-detail');
  });
});

describe('E11d: the 40 character cap', () => {
  it('the setting cannot go above 40, and a stored higher value falls back to 40', () => {
    expect(SUBDOMAIN_HARD_MAX).toBe(40);
    expect(resolveDomainSettings(new Map([['subdomainMaxLength', 63]])).subdomainMaxLength).toBe(40);
    expect(resolveDomainSettings(new Map([['subdomainMaxLength', 20]])).subdomainMaxLength).toBe(20);
  });
  const vendors = (current: string | null) => {
    const writes: unknown[] = [];
    const prisma = { vendor: { findUnique: async ({ where }: { where: { id?: string; email?: string } }) => (where.id ? { id: where.id, role: 'VENDOR', status: 'ACTIVE', subdomain: current } : null), update: async (a: unknown) => { writes.push(a); return {}; } } };
    return { svc: new VendorsService(prisma as never, {} as never, {} as never, {} as never, {} as never), writes };
  };
  const long = 'a'.repeat(41);
  it('the staff create route refuses a longer address before anything is made', async () => {
    const w = vendors(null);
    await expect(w.svc.create({ name: 'A', email: 'a@x.invalid', password: 'x', businessName: 'A', subdomain: long })).rejects.toMatchObject({ status: 400, response: { code: 'SUBDOMAIN_INVALID' } });
    expect(w.writes).toHaveLength(0);
  });
  it('the staff update route refuses a new longer address, and accepts the stored one sent back unchanged', async () => {
    const changed = vendors('short');
    await expect(changed.svc.update('v', { subdomain: long })).rejects.toMatchObject({ status: 400 });
    expect(changed.writes).toHaveLength(0);
    const echoed = vendors(long);
    await expect(echoed.svc.update('v', { subdomain: long, businessName: 'B' })).resolves.toBeDefined();
    const ok = vendors('short');
    await expect(ok.svc.update('v', { subdomain: 'a'.repeat(40) })).resolves.toBeDefined();
    await expect(ok.svc.update('v', { businessName: 'B' })).resolves.toBeDefined();
  });
});

