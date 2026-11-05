import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminServiceRequestsController, AdminVendorServiceRequestsController, MeServiceRequestsController } from '../src/v3-service-requests/api/requests.controllers';
import { ServiceRequestsService } from '../src/v3-service-requests/service-requests.service';
import { POSTER_TOTAL, requestsWorld, RequestsWorld } from './support/service-requests-world';

/** Slice 5.16c over HTTP with the real guards, pipe, filter and interceptor; the service is the real one over the in-memory twins. */
jest.setTimeout(180_000);

describe('service requests API', () => {
  let app: INestApplication; let w: RequestsWorld;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer()).post(url); return (role ? r.set(as(role)) : r).send(body); };
  const body = (over: object = {}) => ({ serviceKey: 'POSTER_DESIGN', brief: w.brief(), idempotencyKey: w.key(), ...over });

  beforeEach(async () => {
    w = requestsWorld(); await w.seed(); await w.price('POSTER_DESIGN', 50_000);
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeServiceRequestsController, AdminServiceRequestsController, AdminVendorServiceRequestsController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ServiceRequestsService, useValue: w.svcReq }],
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
    await app.init(); await w.vendor('v1', 400_000); await w.vendor('v2', 400_000);
  });
  afterEach(async () => { await app.close(); });

  describe('vendor routes (/v3/me/service-requests), owner only', () => {
    it('create holds the amount; the list and the detail show it; approving charges once and issues the invoice', async () => {
      const c = await send('/v3/me/service-requests', 'owner', body()); expect(c.status).toBe(200);
      expect(c.body.data).toMatchObject({ status: 'REQUESTED', funding: { kind: 'WALLET', amountPaise: POSTER_TOTAL, heldPaise: POSTER_TOTAL } }); expect(JSON.stringify(c.body)).not.toMatch(/vendorId|holdLedgerId|idempotency/);
      const id = c.body.data.id as string;
      expect((await get('/v3/me/service-requests', 'owner')).body.data.items).toHaveLength(1);
      await w.svcReq.setStatus(id, { to: 'ACCEPTED' }, { type: 'STAFF', id: 't', ip: null }); await w.svcReq.setStatus(id, { to: 'IN_PRODUCTION' }, { type: 'STAFF', id: 't', ip: null });
      await w.svcReq.addDeliverable(id, { kind: 'TEXT', text: 'Finished work.' }, { type: 'STAFF', id: 't', ip: null }); await w.svcReq.setStatus(id, { to: 'READY_FOR_REVIEW' }, { type: 'STAFF', id: 't', ip: null });
      const a = await send(`/v3/me/service-requests/${id}/approve`, 'owner'); expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ status: 'APPROVED', invoice: { invoiceNumber: 'INV/2026-27/000001' } });
      expect((await send(`/v3/me/service-requests/${id}/approve`, 'owner')).body.data.replay).toBe(true);
      expect((await get('/v3/me/service-requests/invoices', 'owner')).body.data.total).toBe(1); expect((await get(`/v3/me/service-requests/${id}`, 'owner')).body.data.deliverables).toHaveLength(1);
    });
    it('cancel releases; a revision needs a note; an unknown request is a 404', async () => {
      const c = await send('/v3/me/service-requests', 'owner', body()); expect((await send(`/v3/me/service-requests/${c.body.data.id}/cancel`, 'owner')).body.data.status).toBe('CANCELLED');
      expect((await send(`/v3/me/service-requests/${c.body.data.id}/revision`, 'owner', { note: 'x' })).status).toBe(400); expect((await get('/v3/me/service-requests/nope', 'owner')).status).toBe(404);
    });
    it('a team member and an anonymous caller are refused on every route and nothing is held', async () => {
      const routes: Array<['get' | 'post', string]> = [['post', '/v3/me/service-requests'], ['get', '/v3/me/service-requests'], ['get', '/v3/me/service-requests/invoices'], ['get', '/v3/me/service-requests/x'], ['post', '/v3/me/service-requests/x/cancel'], ['post', '/v3/me/service-requests/x/approve'], ['post', '/v3/me/service-requests/x/revision']];
      for (const [m, url] of routes) {
        const r = m === 'get' ? await get(url, 'member') : await send(url, 'member', body()); expect([url, r.status]).toEqual([url, 403]);
        const a = m === 'get' ? await get(url) : await send(url, null, body()); expect([url, a.status]).toEqual([url, 401]);
      }
      expect(w.requests.requests).toHaveLength(0); expect((await w.store.wallet('v1'))!.heldPaise).toBe(0);
    });
    it('DTO: a missing brief, a short key, an unknown field (vendorId, price, status) and a bad brief are 400', async () => {
      for (const bad of [{ brief: undefined }, { idempotencyKey: 'short' }, { vendorId: 'v2' }, { priceSnapshotPaise: 1 }, { status: 'APPROVED' }, { brief: { details: 'short' } }, { brief: 'text' }, { attachmentRefs: ['bad ref!'] }]) {
        expect([JSON.stringify(bad), (await send('/v3/me/service-requests', 'owner', body(bad))).status]).toEqual([JSON.stringify(bad), 400]);
      }
      expect(w.requests.requests).toHaveLength(0);
    });
    it('vendor 2 cannot touch vendor 1\'s request: the same 404 as for one that does not exist', async () => {
      const c = await send('/v3/me/service-requests', 'owner', body()); const id = c.body.data.id;
      const missing = await get('/v3/me/service-requests/nope', 'owner-2');
      for (const r of [await get(`/v3/me/service-requests/${id}`, 'owner-2'), await send(`/v3/me/service-requests/${id}/cancel`, 'owner-2'), await send(`/v3/me/service-requests/${id}/approve`, 'owner-2')]) expect([r.status, r.body.code]).toEqual([missing.status, missing.body.code]);
      expect((await get('/v3/me/service-requests', 'owner-2')).body.data.total).toBe(0);
    });
    it('a short wallet reaches the client as INSUFFICIENT_WALLET with the numbers', async () => {
      const r = await send('/v3/me/service-requests', 'owner', body({ serviceKey: 'POSTER_DESIGN' })); expect(r.status).toBe(200);
      await w.svc.adjust('v1', { amountPaise: -(400_000 - POSTER_TOTAL - 1_000), reason: 'test trim of the wallet', idempotencyKey: 'trim-key-0001' }, { type: 'STAFF', id: 's', ip: null });
      const short = await send('/v3/me/service-requests', 'owner', body()); expect([short.status, short.body.code]).toEqual([409, 'INSUFFICIENT_WALLET']); expect(short.body).toMatchObject({ shortfallPaise: POSTER_TOTAL - 1_000, requiredPaise: POSTER_TOTAL });
    });
  });

  describe('staff routes', () => {
    const TEAM = ['/v3/admin/service-requests'];
    it('MARKETING, a vendor and a team member are refused on every staff route', async () => {
      const rs: Array<['get' | 'post', string]> = [['get', '/v3/admin/service-requests'], ['post', '/v3/admin/service-requests/sla-sweep'], ['post', '/v3/admin/service-requests/auto-approve-run'], ['get', '/v3/admin/service-requests/x'],
        ['post', '/v3/admin/service-requests/x/assign'], ['post', '/v3/admin/service-requests/x/status'], ['post', '/v3/admin/service-requests/x/deliverables'], ['post', '/v3/admin/service-requests/x/reject'], ['post', '/v3/admin/service-requests/x/retry-grant'], ['post', '/v3/admin/vendors/v1/service-requests']];
      for (const role of ['MARKETING', 'owner', 'member']) for (const [m, url] of rs) { const r = m === 'get' ? await get(url, role) : await send(url, role, {}); expect([role, url, r.status]).toEqual([role, url, 403]); }
      void TEAM;
    });
    it('OPERATIONS runs the queue: assign, accept, work, deliver, send for review, reject', async () => {
      const c = await send('/v3/me/service-requests', 'owner', body()); const id = c.body.data.id; const q = `/v3/admin/service-requests/${id}`;
      expect((await get('/v3/admin/service-requests?status=REQUESTED&fundingKind=WALLET', 'OPERATIONS')).body.data.items.map((i: { id: string }) => i.id)).toEqual([id]);
      expect((await send(`${q}/assign`, 'OPERATIONS', { staffId: 'staff-7', slaDueAt: new Date(Date.now() + 86_400_000).toISOString() })).body.data).toMatchObject({ assignedStaffId: 'staff-7' });
      expect((await send(`${q}/status`, 'OPERATIONS', { to: 'ACCEPTED' })).body.data.status).toBe('ACCEPTED'); expect((await send(`${q}/status`, 'OPERATIONS', { to: 'IN_PRODUCTION' })).body.data.status).toBe('IN_PRODUCTION');
      expect((await send(`${q}/status`, 'OPERATIONS', { to: 'READY_FOR_REVIEW' })).body.code).toBe('DELIVERABLE_REQUIRED');
      expect((await send(`${q}/deliverables`, 'OPERATIONS', { kind: 'LINK', fileRef: 'https://files.example.com/poster.pdf' })).status).toBe(200);
      expect((await send(`${q}/status`, 'OPERATIONS', { to: 'READY_FOR_REVIEW' })).body.data.status).toBe('READY_FOR_REVIEW');
      expect((await get(q, 'OPERATIONS')).body.data).toMatchObject({ vendorId: 'v1', deliverables: [{ kind: 'LINK' }] });
      expect((await send(`${q}/reject`, 'SUPER_ADMIN', { reason: 'We cannot deliver this.' })).body.data.status).toBe('REJECTED_BY_TEAM'); expect((await w.store.wallet('v1'))!.heldPaise).toBe(0);
    });
    it('DTO: the team cannot set APPROVED or CANCELLED through the status route, and a reject needs a reason', async () => {
      const c = await send('/v3/me/service-requests', 'owner', body()); const q = `/v3/admin/service-requests/${c.body.data.id}`;
      for (const to of ['APPROVED', 'CANCELLED', 'REQUESTED', 'nope']) expect([to, (await send(`${q}/status`, 'OPERATIONS', { to })).status]).toEqual([to, 400]);
      expect((await send(`${q}/reject`, 'OPERATIONS', { reason: 'no' })).status).toBe(400); expect((await send(`${q}/deliverables`, 'OPERATIONS', { kind: 'TEXT', vendorId: 'v2' })).status).toBe(400);
    });
    it('staff raise a request on behalf of a vendor with a reason; the vendor sees it', async () => {
      expect((await send('/v3/admin/vendors/v1/service-requests', 'OPERATIONS', body({ reason: 'no' }))).status).toBe(400);
      const r = await send('/v3/admin/vendors/v1/service-requests', 'OPERATIONS', body({ reason: 'The vendor asked us on a call.' })); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ createdBy: 'OUR_TEAM', funding: { heldPaise: POSTER_TOTAL } });
      expect((await get('/v3/me/service-requests', 'owner')).body.data.items[0]).toMatchObject({ id: r.body.data.id, createdBy: 'OUR_TEAM' });
      const nobody = await send('/v3/admin/vendors/nobody/service-requests', 'OPERATIONS', body({ reason: 'A reason that is long enough.' }));
      expect([nobody.status, nobody.body.code]).toEqual([403, 'WALLET_NOT_ACTIVE']);   // a vendor with no wallet cannot be given a request: no hold, nothing written
      expect(w.requests.requests.every((x) => x.vendorId === 'v1')).toBe(true);
    });
    it('the sweep and the auto-approval run are safe to call: nothing due, nothing switched on', async () => {
      expect((await send('/v3/admin/service-requests/sla-sweep', 'OPERATIONS')).body.data).toEqual({ marked: 0 });
      expect((await send('/v3/admin/service-requests/auto-approve-run', 'SUPER_ADMIN')).body.data).toEqual({ approved: 0, failed: 0, enabled: false });
    });
  });
});
