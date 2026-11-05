import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminPacksController, AdminServicesController, MeServicesController, PublicServicesController } from '../src/v3-services/api/services.controllers';
import { ServicesCatalogService } from '../src/v3-services/services.service';
import { postEntry } from '../src/v3-wallet/wallet-engine';
import { servicesWorld, ServicesWorld } from './support/services-world';

/** Slice 5.16b over HTTP with the real guards, pipe, filter and interceptor; the service is the real one over the in-memory twins. */
jest.setTimeout(180_000);

describe('services API', () => {
  let app: INestApplication; let w: ServicesWorld; let n = 0;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (m: 'post' | 'put', url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer())[m](url); return (role ? r.set(as(role)) : r).send(body); };
  const key = () => `http-key-${++n}-abcdefgh`;
  const future = () => new Date(w.clock().getTime() + 60_000).toISOString();

  beforeEach(async () => {
    w = servicesWorld(); await w.seed();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [PublicServicesController, MeServicesController, AdminServicesController, AdminPacksController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ServicesCatalogService, useValue: w.catalogue }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-2') req.user = { sub: 'v2', email: 'o2@x.invalid', role: 'VENDOR' };
      else if (p === 'member') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'accounts', 'wallet'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('public catalogue (/v3/public/services)', () => {
    it('is open to everyone, cacheable, and lists only approved prices in force, with nothing internal', async () => {
      await w.price('POSTER_DESIGN', 40_000); await w.catalogue.proposePrice('service', 'SEO_TASK', { amountPaise: 9_999 }, { type: 'STAFF', id: 'o', ip: null });
      const r = await get('/v3/public/services');
      expect(r.status).toBe(200); expect(r.headers['cache-control']).toBe('public, max-age=300');
      expect(r.body.data.items.map((i: { key: string }) => i.key)).toEqual(['POSTER_DESIGN']);
      expect(JSON.stringify(r.body)).not.toMatch(/9999|PROPOSED|planStateRule|trackScope|createdBy|approvedBy|vendorId/);
    });
  });

  describe('vendor routes, owner only', () => {
    beforeEach(async () => { await w.price('POSTER_DESIGN', 50_000); await w.pack('POSTERS3', [{ serviceKey: 'POSTER_DESIGN', count: 3 }], 120_000); await w.open('v1'); await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'TOPUP', amountPaise: 500_000, idempotencyKey: 'seed-api-0001', actor: { type: 'SYSTEM', id: null }, now: w.clock() })); await w.svc.setBillingProfile('v1', { stateCode: '33' }, { type: 'VENDOR', id: 'v1', ip: null }); });
    it('lists services with price, tax and the way it would be paid, and packs', async () => {
      const s = await get('/v3/me/services', 'owner'); expect(s.status).toBe(200);
      expect(s.body.data.items.find((i: { key: string }) => i.key === 'POSTER_DESIGN')).toMatchObject({ price: { amountPaise: 50_000 }, tax: { totalMinor: 59_000 }, funding: { kind: 'WALLET', amountPaise: 59_000 } });
      expect((await get('/v3/me/packs', 'owner')).body.data.items[0]).toMatchObject({ key: 'POSTERS3', items: [{ serviceKey: 'POSTER_DESIGN', count: 3, name: 'Poster design' }] });
    });
    it('buys a pack once per key', async () => {
      const k = key(); const a = await send('post', '/v3/me/packs/POSTERS3/purchase', 'owner', { idempotencyKey: k }); const b = await send('post', '/v3/me/packs/POSTERS3/purchase', 'owner', { idempotencyKey: k });
      expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ packKey: 'POSTERS3', paidPaise: 141_600, replay: false }); expect(b.body.data).toMatchObject({ id: a.body.data.id, replay: true });
      expect(w.store.ledger.filter((e) => e.kind === 'PACK_PURCHASE')).toHaveLength(1);
    });
    it('a team member and an anonymous caller are refused everywhere and nothing is spent', async () => {
      for (const [m, url] of [['get', '/v3/me/services'], ['get', '/v3/me/packs'], ['post', '/v3/me/packs/POSTERS3/purchase']] as const) {
        const r = m === 'get' ? await get(url, 'member') : await send(m, url, 'member', { idempotencyKey: key() }); expect([url, r.status]).toEqual([url, 403]);
        const a = m === 'get' ? await get(url) : await send(m, url, null, { idempotencyKey: key() }); expect([url, a.status]).toEqual([url, 401]);
      }
      expect(w.store.ledger.filter((e) => e.kind === 'PACK_PURCHASE')).toHaveLength(0);
    });
    it('DTO: a short or odd key and any extra field (vendorId, price) are 400', async () => {
      for (const bad of [{ idempotencyKey: 'short' }, { idempotencyKey: 'has spaces in it!!' }, { idempotencyKey: key(), vendorId: 'v2' }, { idempotencyKey: key(), amountPaise: 1 }, {}]) expect([JSON.stringify(bad), (await send('post', '/v3/me/packs/POSTERS3/purchase', 'owner', bad)).status]).toEqual([JSON.stringify(bad), 400]);
    });
    it('a vendor with no wallet gets the locked answer; an unknown pack is a plain conflict', async () => {
      expect((await send('post', '/v3/me/packs/POSTERS3/purchase', 'owner-2', { idempotencyKey: key() })).body.code).toBe('WALLET_NOT_ACTIVE');
      expect((await send('post', '/v3/me/packs/NOPE/purchase', 'owner', { idempotencyKey: key() })).body.code).toBe('PACK_NOT_PURCHASABLE');
    });
  });

  describe('staff routes', () => {
    const svc = (over: object = {}) => ({ key: 'LOGO_DESIGN', name: 'Logo design', shortDescription: 'A logo for your business.', includesText: 'One logo made by our team.', approvalText: 'You approve it or ask for changes.', ...over });
    it('every staff role reads the catalogue; MARKETING gets no money field, OPERATIONS and SUPER_ADMIN do', async () => {
      await w.price('POSTER_DESIGN', 40_000);
      for (const url of ['/v3/admin/services', '/v3/admin/services/POSTER_DESIGN']) for (const role of ['MARKETING', 'OPERATIONS', 'SUPER_ADMIN']) expect([url, role, (await get(url, role)).status]).toEqual([url, role, 200]);
      expect(JSON.stringify((await get('/v3/admin/services', 'MARKETING')).body)).not.toMatch(/amountPaise|priceInForce|proposedPrices|40000/);
      expect(JSON.stringify((await get('/v3/admin/services/POSTER_DESIGN', 'MARKETING')).body)).not.toMatch(/amountPaise|"prices"/);
      expect((await get('/v3/admin/services/POSTER_DESIGN', 'OPERATIONS')).body.data).toMatchObject({ priceInForce: { amountPaise: 40_000 } });
      expect((await get('/v3/admin/packs', 'MARKETING')).status).toBe(200);
    });
    it('MARKETING, a vendor and a team member cannot change anything', async () => {
      const writes: Array<['post' | 'put', string, object]> = [['post', '/v3/admin/services', svc()], ['put', '/v3/admin/services/SEO_TASK', { name: 'Renamed task' }], ['post', '/v3/admin/services/SEO_TASK/prices', { amountPaise: 1_000 }],
        ['post', '/v3/admin/packs', { key: 'P_ONE', name: 'Pack one', description: 'A small pack.', items: [{ serviceKey: 'SEO_TASK', count: 1 }] }], ['post', '/v3/admin/services/prices/x/approve', { effectiveFrom: future() }]];
      for (const role of ['MARKETING', 'owner', 'member']) for (const [m, url, body] of writes) expect([role, url, (await send(m, url, role, body)).status]).toEqual([role, url, 403]);
      expect((await w.services.serviceByKey('LOGO_DESIGN'))).toBeNull();
    });
    it('OPERATIONS adds and edits services and packs and proposes prices, but only SUPER_ADMIN approves or retires one', async () => {
      expect((await send('post', '/v3/admin/services', 'OPERATIONS', svc())).status).toBe(200);
      expect((await send('put', '/v3/admin/services/LOGO_DESIGN', 'OPERATIONS', { status: 'ACTIVE', planStateRule: 'ANY' })).body.data).toMatchObject({ status: 'ACTIVE', planStateRule: 'ANY' });
      const p = await send('post', '/v3/admin/services/LOGO_DESIGN/prices', 'OPERATIONS', { amountPaise: 25_000 }); expect(p.body.data).toMatchObject({ status: 'PROPOSED', effectiveFrom: null, amountPaise: 25_000 });
      expect((await send('put', `/v3/admin/services/prices/${p.body.data.id}`, 'OPERATIONS', { amountPaise: 26_000 })).body.data.amountPaise).toBe(26_000);
      expect((await send('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, 'OPERATIONS', { effectiveFrom: future() })).status).toBe(403);
      expect((await send('post', `/v3/admin/services/prices/${p.body.data.id}/retire`, 'OPERATIONS')).status).toBe(403);
      const ok = await send('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, 'SUPER_ADMIN', { effectiveFrom: future() });
      expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ status: 'APPROVED', amountPaise: 26_000 });
      expect((await send('post', `/v3/admin/services/prices/${p.body.data.id}/retire`, 'SUPER_ADMIN')).body.data.status).toBe('RETIRED');
    });
    it('packs follow the same rules', async () => {
      const c = await send('post', '/v3/admin/packs', 'OPERATIONS', { key: 'SEO_PACK', name: 'Search pack', description: 'Three search tasks.', items: [{ serviceKey: 'SEO_TASK', count: 3 }], validityDays: 60 });
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ status: 'DRAFT', validityDays: 60 });
      expect((await send('post', '/v3/admin/packs', 'OPERATIONS', { key: 'BAD_PACK', name: 'Bad', description: 'Bad pack.', items: [{ serviceKey: 'NOPE', count: 1 }] })).body.code).toBe('PACK_INVALID');
      const p = await send('post', '/v3/admin/packs/SEO_PACK/prices', 'OPERATIONS', { amountPaise: 20_000 });
      expect((await send('post', `/v3/admin/packs/prices/${p.body.data.id}/approve`, 'OPERATIONS', { effectiveFrom: future() })).status).toBe(403);
      expect((await send('post', `/v3/admin/packs/prices/${p.body.data.id}/approve`, 'SUPER_ADMIN', { effectiveFrom: future() })).body.data.status).toBe('APPROVED');
      expect((await get('/v3/admin/packs/SEO_PACK', 'MARKETING')).body.data.prices).toBeUndefined();
    });
    it('approval needs a real future date; a bad body, an unknown key and an extra field are refused with plain codes', async () => {
      const p = await send('post', '/v3/admin/services/SEO_TASK/prices', 'OPERATIONS', { amountPaise: 9_000 });
      expect((await send('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, 'SUPER_ADMIN', {})).status).toBe(400);
      expect((await send('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, 'SUPER_ADMIN', { effectiveFrom: 'next week' })).status).toBe(400);
      const past = await send('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, 'SUPER_ADMIN', { effectiveFrom: new Date(w.clock().getTime() - 3_600_000).toISOString() });
      expect([past.status, past.body.code, past.body.problem]).toEqual([409, 'SERVICE_PRICE_STATE', 'EFFECTIVE_DATE_IN_PAST']);
      expect((await send('post', '/v3/admin/services/NOPE/prices', 'OPERATIONS', { amountPaise: 1_000 })).status).toBe(404);
      expect((await send('post', '/v3/admin/services/SEO_TASK/prices', 'OPERATIONS', { amountPaise: 1_000, status: 'APPROVED' })).status).toBe(400);   // a price cannot be created already approved
      expect((await send('post', '/v3/admin/services/SEO_TASK/prices', 'OPERATIONS', { amountPaise: 0 })).status).toBe(400);
      expect((await send('post', '/v3/admin/services', 'OPERATIONS', svc({ key: 'bad key' }))).body.code).toBe('SERVICE_INVALID');
    });
  });
});
