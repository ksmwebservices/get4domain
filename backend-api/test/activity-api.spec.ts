import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { ActivityService, AlertsService } from '../src/v3-activity/activity.service';
import { AdminAlertsController, MeActivityController } from '../src/v3-activity/api/activity.controllers';
import { activityWorld, ActivityWorld } from './support/memory-activity-store';

/** Slice 5.20 over HTTP with the real guards, pipe, filter and interceptor; the services are the real ones over the in-memory store. */
jest.setTimeout(180_000);

describe('activity and alerts API', () => {
  let app: INestApplication; let w: ActivityWorld;
  const as = (role: string) => ({ 'x-test-principal': role });
  const call = (method: 'get' | 'post' | 'put' | 'patch', url: string, role: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); return (role ? r.set(as(role)) : r).send(body ?? {}); };
  const STAFF_ROUTES: Array<['get' | 'put' | 'patch', string]> = [['get', '/v3/admin/alerts'], ['get', '/v3/admin/alerts/x'], ['patch', '/v3/admin/alerts/x'], ['get', '/v3/admin/alert-rules'], ['put', '/v3/admin/alert-rules'], ['get', '/v3/admin/vendors/v1/activity'], ['get', '/v3/admin/attention']];

  beforeEach(async () => {
    w = activityWorld(); await w.seedRules();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeActivityController, AdminAlertsController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ActivityService, useValue: w.activity }, { provide: AlertsService, useValue: w.alerts }],
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

  const rec = (vendorId: string, o: object = {}) => w.activity.record({ vendorId, actor: { type: 'VENDOR', id: vendorId, ip: '203.0.113.9' }, actionKey: 'domain.custom_added', entityType: 'domain', entityId: 'd1', summary: { host: 'a.example.in', phone: '9876543210' }, ...o });

  describe('GET /v3/me/activity (owner only, own rows)', () => {
    it('returns the owner\'s own rows, masked, with no address hash, in the API envelope', async () => {
      await rec('v1'); await rec('v2', { summary: { note: 'only v2' } });
      const r = await call('get', '/v3/me/activity', 'owner');
      expect(r.status).toBe(200); expect(r.body).toMatchObject({ success: true, data: { total: 1, page: 1, pageSize: 25 } });
      const text = JSON.stringify(r.body); expect(text).not.toMatch(/ipHash|only v2|9876543210|203\.0\.113\.9/);
    });
    it('another vendor never sees these rows, whatever they ask for', async () => {
      await rec('v1');
      const r = await call('get', '/v3/me/activity', 'owner-2'); expect(r.status).toBe(200); expect(r.body.data.total).toBe(0);
      expect((await call('get', '/v3/me/activity?vendorId=v1', 'owner-2')).status).toBe(400);   // a vendor id in the query is not part of the contract: the vendor is always the signed-in one
    });
    it('a team member is refused (403) and an anonymous caller is refused (401)', async () => {
      expect((await call('get', '/v3/me/activity', 'member')).status).toBe(403);
      expect((await call('get', '/v3/me/activity', null)).status).toBe(401);
    });
    it('paging is validated', async () => { expect((await call('get', '/v3/me/activity?pageSize=1000', 'owner')).status).toBe(400); expect((await call('get', '/v3/me/activity?page=0', 'owner')).status).toBe(400); });
  });

  describe('staff routes: role matrix', () => {
    it('MARKETING is refused on every one of them (403)', async () => { for (const [m, u] of STAFF_ROUTES) expect([u, (await call(m, u, 'MARKETING', m === 'patch' ? { expectedStatus: 'NEW' } : {})).status]).toEqual([u, 403]); });
    it('an anonymous caller and a vendor owner are refused on every one of them (the slim app has no JWT guard, so the admin guard answers 403; the real app answers 401 first)', async () => {
      for (const [m, u] of STAFF_ROUTES) { expect([u, [401, 403]]).toEqual([u, expect.arrayContaining([(await call(m, u, null)).status])]); expect([u, (await call(m, u, 'owner')).status]).toEqual([u, 403]); }
    });
    it('OPERATIONS and SUPER_ADMIN can read and work alerts, a vendor\'s activity and the board; only SUPER_ADMIN reads the rules', async () => {
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) for (const u of ['/v3/admin/alerts', '/v3/admin/vendors/v1/activity', '/v3/admin/attention']) expect([role, u, (await call('get', u, role)).status]).toEqual([role, u, 200]);
      expect((await call('get', '/v3/admin/alert-rules', 'OPERATIONS')).status).toBe(403); expect((await call('get', '/v3/admin/alert-rules', 'SUPER_ADMIN')).status).toBe(200);
    });
    it('only SUPER_ADMIN changes a rule: OPERATIONS gets 403 and nothing changes', async () => {
      const body = { key: 'DOMAIN_CHANGED', enabled: true };
      expect((await call('put', '/v3/admin/alert-rules', 'OPERATIONS', body)).status).toBe(403);
      expect((await w.store.getRule('DOMAIN_CHANGED'))!.enabled).toBe(false);
      const ok = await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', body);
      expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ key: 'DOMAIN_CHANGED', enabled: true, level: 'MEDIUM' });
    });
  });

  describe('alerts over HTTP', () => {
    const raise = async (): Promise<string> => { await w.store.updateRule('DOMAIN_CHANGED', { enabled: true }, 's'); await rec('v1'); return w.store.alerts[0].id; };
    it('lists with filters, shows one with its activity, and the activity is masked', async () => {
      const id = await raise();
      const list = await call('get', '/v3/admin/alerts?level=MEDIUM&status=NEW&vendorId=v1', 'OPERATIONS'); expect(list.body.data.total).toBe(1);
      expect((await call('get', '/v3/admin/alerts?level=HIGH', 'OPERATIONS')).body.data.total).toBe(0);
      const d = await call('get', `/v3/admin/alerts/${id}`, 'OPERATIONS'); expect(d.body.data.activity).toHaveLength(1); expect(JSON.stringify(d.body)).not.toContain('9876543210');
      expect((await call('get', '/v3/admin/alerts/missing', 'OPERATIONS')).body).toMatchObject({ success: false, statusCode: 404 });
    });
    it('bad filters are refused (400)', async () => { expect((await call('get', '/v3/admin/alerts?level=URGENT', 'OPERATIONS')).status).toBe(400); expect((await call('get', '/v3/admin/alerts?status=DONE', 'OPERATIONS')).status).toBe(400); });
    it('PATCH changes status, owner and note; a stale change is 409 with ALERT_STALE; a wrong move is 400 with ALERT_INVALID', async () => {
      const id = await raise();
      const a = await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { expectedStatus: 'NEW', status: 'LOOKING', ownerStaffId: 'staff-1', note: 'Looking now' });
      expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ status: 'LOOKING', ownerStaffId: 'staff-1', note: 'Looking now' });
      const stale = await call('patch', `/v3/admin/alerts/${id}`, 'SUPER_ADMIN', { expectedStatus: 'NEW', status: 'RESOLVED' }); expect(stale.status).toBe(409); expect(stale.body.code ?? stale.body.data?.code ?? stale.body.error?.code ?? JSON.stringify(stale.body)).toMatch(/ALERT_STALE/);
      await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { expectedStatus: 'LOOKING', status: 'RESOLVED' });
      const bad = await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { expectedStatus: 'RESOLVED', status: 'NEW' }); expect(bad.status).toBe(400); expect(JSON.stringify(bad.body)).toMatch(/ALERT_INVALID/);
    });
    it('PATCH needs the status the caller saw, and refuses unknown statuses and a field that is not part of the contract', async () => {
      const id = await raise();
      expect((await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { status: 'LOOKING' })).status).toBe(400);
      expect((await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { expectedStatus: 'NEW', status: 'DELETED' })).status).toBe(400);
      expect((await call('patch', `/v3/admin/alerts/${id}`, 'OPERATIONS', { expectedStatus: 'NEW', vendorId: 'other', level: 'LOW' })).status).toBe(400);
      expect(w.store.alerts[0]).toMatchObject({ vendorId: 'v1', level: 'MEDIUM', status: 'NEW' });
    });
    it('the vendor\'s activity for staff is the same masked rows', async () => {
      await rec('v1'); await rec('v2');
      const r = await call('get', '/v3/admin/vendors/v1/activity', 'OPERATIONS'); expect(r.body.data.total).toBe(1); expect(JSON.stringify(r.body)).not.toContain('9876543210');
    });
  });

  describe('rules over HTTP', () => {
    it('the key and level are fixed: a level in the body is refused, an unknown key is 404, a rule that needs numbers is refused without them', async () => {
      expect((await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', { key: 'DOMAIN_CHANGED', level: 'LOW' })).status).toBe(400);
      expect((await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', { key: 'MADE_UP', enabled: true })).status).toBe(404);
      const needs = await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', { key: 'LARGE_IMPORT', enabled: true }); expect(needs.status).toBe(400); expect(JSON.stringify(needs.body)).toMatch(/ALERT_RULE_NEEDS_THRESHOLD/);
      const ok = await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', { key: 'LARGE_IMPORT', enabled: true, thresholdJson: { rows: 300 } }); expect(ok.status).toBe(200);
    });
    it('roles must be staff roles of the alert board', async () => { expect((await call('put', '/v3/admin/alert-rules', 'SUPER_ADMIN', { key: 'DOMAIN_CHANGED', notifyRoles: ['MARKETING'] })).status).toBe(400); });
    it('the rules list shows all eleven', async () => { expect((await call('get', '/v3/admin/alert-rules', 'SUPER_ADMIN')).body.data).toHaveLength(11); });
  });

  describe('the attention board over HTTP', () => {
    it('returns the roles and the queues', async () => {
      const r = await call('get', '/v3/admin/attention', 'OPERATIONS');
      expect(r.body.data).toMatchObject({ roles: { SUPER_ADMIN: { unreadNotifications: 0 }, OPERATIONS: { unreadNotifications: 0 } }, queues: { serviceRequestsOpen: 0 } });
    });
  });
});
