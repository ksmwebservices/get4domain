import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { NextStepFactsPort, NextStepsService } from '../src/v3-packs/next-steps.service';
import { MePackController } from '../src/v3-packs/api/pack.controllers';
import { AppShellService } from '../src/v3-packs/app-shell.service';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { TabGuard } from '../src/v3-packs/requires-tab';
import { MeMigrationController, MePromotionDraftsController, MeSocialDraftsController, MeTeamController } from '../src/v3-vendor-gaps/api/vendor-gaps.controllers';
import { NextStepFacts } from '../src/v3-vendor-gaps/core/gaps-core';
import { VendorGapsService } from '../src/v3-vendor-gaps/vendor-gaps.service';
import { VendorGapsStore } from '../src/v3-vendor-gaps/vendor-gaps.store';
import { FakeEntitlements, makeEngine } from './support/pack-fakes';
import { MemoryVendorGapsStore } from './support/memory-vendor-gaps-store';

/**
 * Wave 2 Part B over HTTP with the real guards, pipe, filter and interceptor and the real pack engine over the in-memory stores: the move request, promotion and social drafts, the team on the v3 contract,
 * the five bar groups in the tab list and the next steps in the app shell. Vendor A (paid, Professional) and vendor B (Free trial) are different tenants throughout.
 */
jest.setTimeout(180_000);

describe('wave 2 part B over HTTP', () => {
  let app: INestApplication; let plans: FakeEntitlements; let svc: PackEngineService; let store: MemoryVendorGapsStore; let facts: NextStepFacts;
  const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p: string) => request(app.getHttpServer()).get(url).set(as(p));
  const send = (m: 'post' | 'put', url: string, p: string, body: object = {}) => request(app.getHttpServer())[m](url).set(as(p)).send(body);
  const text = (r: { body: unknown }): string => JSON.stringify(r.body);

  beforeEach(async () => {
    const e = await makeEngine(); plans = e.plans; svc = e.svc; store = new MemoryVendorGapsStore();
    facts = { sitePublished: false, draftStarted: true, missingDetails: ['Phone'], unpaidPlanOrder: true, unconnectedDomain: 'acme.example' };
    plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); plans.states.set('b', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    await svc.register('a', { categoryKey: 'plumber' }, owner('a')); await svc.register('b', { categoryKey: 'plumber' }, owner('b'));
    const steps = new NextStepsService({ facts: async () => facts } as NextStepFactsPort);
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MePackController, MeMigrationController, MePromotionDraftsController, MeSocialDraftsController, MeTeamController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, TabGuard,
        { provide: PackEngineService, useValue: svc }, { provide: AppShellService, useValue: new AppShellService(svc, { badge: async () => ({ waiting: 0, unread: 0 }) } as never, steps) },
        { provide: VendorGapsStore, useValue: store }, VendorGapsService,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'a', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'b', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'member-site') req.user = { sub: 'a', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['website'] };
      else if (p === 'member-campaigns') req.user = { sub: 'a', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm2', modules: ['campaigns'] };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('registers the new error codes', () => { for (const c of ['VENDOR_GAP_INVALID', 'MIGRATION_REQUEST_OPEN', 'PROMO_DRAFT_NOT_FOUND', 'TEAM_MEMBER_NOT_FOUND', 'TEAM_MEMBER_EXISTS', 'PLAN_INVOICE_NOT_FOUND']) expect(BUSINESS_ERROR_CODES).toContain(c); });

  describe('B4: the group of every tab', () => {
    it('each tab carries one of the five groups beside its scope, and Business holds the pack tabs', async () => {
      const r = await get('/v3/me/navigation', 'owner-a');
      expect(r.status).toBe(200);
      const tabs = r.body.data.tabs as Array<{ key: string; scope: string; group: string }>;
      for (const t of tabs) expect(['home', 'business', 'grow', 'money', 'more']).toContain(t.group);
      expect(tabs.filter((t) => t.scope === 'PACK').every((t) => t.group === 'business')).toBe(true);
      expect(tabs.find((t) => t.key === 'domain')!.group).toBe('grow'); expect(tabs.find((t) => t.key === 'plan')!.group).toBe('more'); expect(tabs.find((t) => t.key === 'accounting')!.group).toBe('money');
    });
  });

  describe('B5: next steps in the app shell', () => {
    it('the owner gets every step from real state, each with an id, a sentence and a route', async () => {
      const r = await get('/v3/me/app-shell', 'owner-a');
      expect(r.status).toBe(200); expect(r.body.data.sections).toContain('nextSteps');
      expect((r.body.data.nextSteps as Array<{ id: string }>).map((s) => s.id)).toEqual(['publish_site', 'site_details', 'plan_payment', 'connect_domain']);
      for (const s of r.body.data.nextSteps) expect(Object.keys(s).sort()).toEqual(['id', 'route', 'text']);
    });
    it('a team member only gets the steps of an area they hold, never the plan or domain steps', async () => {
      const w = await get('/v3/me/app-shell', 'member-site'); expect((w.body.data.nextSteps as Array<{ id: string }>).map((s) => s.id)).toEqual(['publish_site', 'site_details']);
      const c = await get('/v3/me/app-shell', 'member-campaigns'); expect(c.body.data.nextSteps).toEqual([]);
    });
    it('nothing to do is an empty list', async () => {
      facts = { sitePublished: true, draftStarted: true, missingDetails: [], unpaidPlanOrder: false, unconnectedDomain: null };
      expect((await get('/v3/me/app-shell', 'owner-a')).body.data.nextSteps).toEqual([]);
    });
  });

  describe('B3: move an existing site (a record only)', () => {
    it('the owner on a paid plan asks once; a second ask while one is open is refused; the list shows it', async () => {
      const a = await send('post', '/v3/me/migration-requests', 'owner-a', { siteUrl: 'old-shop.example.com' });
      expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ siteUrl: 'https://old-shop.example.com', status: 'RECEIVED' });
      const again = await send('post', '/v3/me/migration-requests', 'owner-a', { siteUrl: 'another.example.com' });
      expect(again.status).toBe(409); expect(text(again)).toContain('MIGRATION_REQUEST_OPEN');
      expect((await get('/v3/me/migration-requests', 'owner-a')).body.data.items).toHaveLength(1);
    });
    it('a bad address is refused naming the field', async () => {
      const r = await send('post', '/v3/me/migration-requests', 'owner-a', { siteUrl: 'http://127.0.0.1' });
      expect(r.status).toBe(400); expect(text(r)).toContain('VENDOR_GAP_INVALID'); expect(r.body.data.fields.siteUrl).toBeDefined(); expect(store.migrations).toHaveLength(0);
    });
    it('on a Free trial the list reads (a locked preview) and a request is refused with TAB_LOCKED', async () => {
      expect((await get('/v3/me/migration-requests', 'owner-b')).status).toBe(200);
      const w = await send('post', '/v3/me/migration-requests', 'owner-b', { siteUrl: 'old.example.com' });
      expect(w.status).toBe(403); expect(text(w)).toContain('TAB_LOCKED'); expect(store.migrations).toHaveLength(0);
    });
    it('is owner only, and one vendor never sees another\'s requests', async () => {
      expect((await send('post', '/v3/me/migration-requests', 'member-site', { siteUrl: 'x.example.com' })).status).toBe(403);
      await send('post', '/v3/me/migration-requests', 'owner-a', { siteUrl: 'a.example.com' });
      plans.states.set('b', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
      expect((await get('/v3/me/migration-requests', 'owner-b')).body.data.items).toEqual([]);
    });
  });

  describe('B8: promotion and social drafts (never posted)', () => {
    const draft = { channel: 'INSTAGRAM', title: 'New arrivals', body: 'Fresh stock is in.' };
    it('saves, lists and archives a social draft; promotion and social are separate lists', async () => {
      const c = await send('post', '/v3/me/social/drafts', 'owner-a', draft);
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ kind: 'SOCIAL', channel: 'INSTAGRAM', status: 'DRAFT' });
      expect((await get('/v3/me/social/drafts', 'owner-a')).body.data.total).toBe(1); expect((await get('/v3/me/promotion/drafts', 'owner-a')).body.data.total).toBe(0);
      const p = await send('post', '/v3/me/promotion/drafts', 'owner-a', { channel: 'OFFER', title: 'Festival offer', body: 'Special prices.' }); expect(p.body.data.kind).toBe('PROMOTION');
      const a = await send('post', `/v3/me/social/drafts/${c.body.data.id}/archive`, 'owner-a'); expect(a.body.data.status).toBe('ARCHIVED');
      expect((await get('/v3/me/social/drafts', 'owner-a')).body.data.total).toBe(0); expect((await get('/v3/me/social/drafts?archived=true', 'owner-a')).body.data.total).toBe(1);
      expect(store.drafts).toHaveLength(2);   // nothing is deleted
    });
    it('refuses markup, a wrong channel and a missing body, naming each field; stores nothing', async () => {
      const r = await send('post', '/v3/me/social/drafts', 'owner-a', { channel: 'OFFER', title: '<b>x</b>', body: '' });
      expect(r.status).toBe(400); expect(text(r)).toContain('VENDOR_GAP_INVALID'); expect(Object.keys(r.body.data.fields).sort()).toEqual(['body', 'channel', 'title']); expect(store.drafts).toHaveLength(0);
    });
    it('a Free trial reads but cannot write; a team member needs the campaigns area', async () => {
      expect((await get('/v3/me/social/drafts', 'owner-b')).status).toBe(200);
      const w = await send('post', '/v3/me/social/drafts', 'owner-b', draft); expect(w.status).toBe(403); expect(text(w)).toContain('TAB_LOCKED');
      expect((await get('/v3/me/promotion/drafts', 'member-site')).status).toBe(403);
      expect((await send('post', '/v3/me/promotion/drafts', 'member-campaigns', { channel: 'OFFER', title: 'T', body: 'B' })).status).toBe(200);
    });
    it('one vendor cannot archive another vendor\'s draft', async () => {
      const id = (await send('post', '/v3/me/social/drafts', 'owner-a', draft)).body.data.id as string;
      plans.states.set('b', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
      expect((await send('post', `/v3/me/social/drafts/${id}/archive`, 'owner-b')).status).toBe(404);
      expect(store.drafts[0].status).toBe('DRAFT');
    });
    it('a paused plan keeps drafts readable and refuses writes', async () => {
      await send('post', '/v3/me/social/drafts', 'owner-a', draft);
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
      expect((await get('/v3/me/social/drafts', 'owner-a')).body.data.total).toBe(1);
      expect((await send('post', '/v3/me/social/drafts', 'owner-a', draft)).status).toBe(403);
    });
  });

  describe('B9: the team on the v3 contract', () => {
    const invite = { name: 'Ravi Kumar', role: 'Counter staff', email: 'ravi@example.com', department: 'Sales' };
    it('the owner records an invite, changes the role and areas, deactivates and reactivates; nothing is deleted', async () => {
      const c = await send('post', '/v3/me/team/invites', 'owner-a', invite);
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ name: 'Ravi Kumar', role: 'Counter staff', department: 'Sales', status: 'invited', areas: ['telecrm', 'communication', 'reports'] });
      expect(Object.keys(c.body.data).sort()).toEqual(['areas', 'department', 'id', 'name', 'role', 'status']);   // never an email, phone or token
      const id = c.body.data.id as string;
      const u = await send('put', `/v3/me/team/${id}`, 'owner-a', { role: 'Senior counter', areas: ['telecrm', 'campaigns'] }); expect(u.body.data).toMatchObject({ role: 'Senior counter', areas: ['telecrm', 'campaigns'] });
      const d = await send('post', `/v3/me/team/${id}/deactivate`, 'owner-a'); expect(d.body.data.status).toBe('deactivated');
      const r = await send('post', `/v3/me/team/${id}/reactivate`, 'owner-a'); expect(r.body.data.status).toBe('invited');   // never signed in, so back to invited
      expect(store.team).toHaveLength(1);
    });
    it('an active member who signed in comes back active on reactivate', async () => {
      const id = (await send('post', '/v3/me/team/invites', 'owner-a', invite)).body.data.id as string;
      store.team[0].status = 'active'; store.team[0].password = 'hash';
      await send('post', `/v3/me/team/${id}/deactivate`, 'owner-a');
      expect((await send('post', `/v3/me/team/${id}/reactivate`, 'owner-a')).body.data.status).toBe('active');
    });
    it('the list is readable by a team member (with the department list) but every change is owner only', async () => {
      const id = (await send('post', '/v3/me/team/invites', 'owner-a', invite)).body.data.id as string;
      const l = await get('/v3/me/team', 'member-site'); expect(l.status).toBe(200); expect(l.body.data.departments).toEqual(['Sales', 'Support', 'Accounts', 'Marketing']); expect(l.body.data.items).toHaveLength(1);
      expect(text(l)).not.toContain('ravi@example.com');
      expect((await send('post', '/v3/me/team/invites', 'member-site', invite)).status).toBe(403);
      expect((await send('put', `/v3/me/team/${id}`, 'member-site', { role: 'Boss' })).status).toBe(403);
      expect((await send('post', `/v3/me/team/${id}/deactivate`, 'member-site')).status).toBe(403);
      expect(store.team[0].role).toBe('Counter staff');
    });
    it('refuses a department that is a staff role, wallet as an area, and a duplicate email', async () => {
      const bad = await send('post', '/v3/me/team/invites', 'owner-a', { ...invite, department: 'SUPPORT_STAFF', areas: ['wallet'] });
      expect(bad.status).toBe(400); expect(Object.keys(bad.body.data.fields).sort()).toEqual(['areas', 'department']);
      await send('post', '/v3/me/team/invites', 'owner-a', invite);
      const dup = await send('post', '/v3/me/team/invites', 'owner-a', invite); expect(dup.status).toBe(409); expect(text(dup)).toContain('TEAM_MEMBER_EXISTS');
    });
    it('one vendor cannot see or change another vendor\'s people', async () => {
      const id = (await send('post', '/v3/me/team/invites', 'owner-a', invite)).body.data.id as string;
      expect((await get('/v3/me/team', 'owner-b')).body.data.items).toEqual([]);
      expect((await send('put', `/v3/me/team/${id}`, 'owner-b', { role: 'x' })).status).toBe(404);
      expect((await send('post', `/v3/me/team/${id}/deactivate`, 'owner-b')).status).toBe(404);
      expect(store.team[0].status).toBe('invited');
    });
  });
});
