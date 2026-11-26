import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as path from 'path';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { ActivityInterceptor } from '../src/v3-activity/activity.interceptor';
import { AdminDraftController } from '../src/v3-admin-draft/admin-draft.controller';
import { AdminDraftService } from '../src/v3-admin-draft/admin-draft.service';
import { buildProfileSeed } from '../src/v3-profile-fields/core/profile-core';
import { ProfileFieldsService } from '../src/v3-profile-fields/profile.service';
import { mayActForVendor } from '../src/v3-website/act-on-behalf/act-on-behalf-core';
import { ActOnBehalfInterceptor } from '../src/v3-website/act-on-behalf/act-on-behalf.interceptor';
import { ActOnBehalfService } from '../src/v3-website/act-on-behalf/act-on-behalf.service';
import { ActOnBehalfStore } from '../src/v3-website/act-on-behalf/act-on-behalf.store';
import { AdminActOnBehalfController } from '../src/v3-website/api/act-on-behalf.controllers';
import { OnboardingQueueService } from '../src/v3-website/onboarding/onboarding-queue.service';
import { WebsiteService } from '../src/v3-website/website.service';
import { AobWorld, aobWorld } from './support/act-on-behalf-world';
import { realSeed } from './support/pack-fakes';
import { scanRoutes } from './support/route-scan';
import { VENDOR_ID, WebsiteWorld, websiteWorld } from './support/website-world';

/** E9a over HTTP: the real admin guard and role matrix, the real act-on-behalf and activity interceptors, the real website and profile services over memory stores. */
jest.setTimeout(180_000);

const PRINCIPALS: Record<string, Record<string, unknown>> = {
  SUPER_ADMIN: { sub: 'super-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPER_ADMIN' },
  ADMIN: { sub: 'admin-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'ADMIN' },
  OPERATIONS: { sub: 'ops-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' },
  TELECALLER: { sub: 'tele-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  OTHER_TELECALLER: { sub: 'tele-2', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  SALES: { sub: 'sales-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING' },
  FIELD_EXECUTIVE: { sub: 'field-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'FIELD_EXECUTIVE' },
  SUPPORT: { sub: 'support-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPPORT' },
  OWNER: { sub: VENDOR_ID, role: 'VENDOR' },
};
const ALLOWED = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'TELECALLER'];
const REFUSED = ['SALES', 'FIELD_EXECUTIVE', 'SUPPORT', 'OWNER'];

type Doc = { fields: Record<string, string>; lists: Record<string, unknown[]>; seo: Record<string, unknown>; location?: unknown; hours?: unknown[]; reviewUrl?: string; testimonials?: unknown[] };
/** Every write route: the path after /site/draft/, a body the rules accept, and proof that it reached the draft. */
const WRITES: Array<[string, object, (d: Doc) => unknown]> = [
  ['field', { key: 'hero.title', value: 'Pipes fixed today' }, (d) => expect(d.fields['hero.title']).toBe('Pipes fixed today')],
  ['list/faqs', { items: [{ q: 'Do you come on Sunday?', a: 'Yes, on request.' }] }, (d) => expect(d.lists.faqs).toHaveLength(1)],
  ['sections', { hidden: [], order: [] }, (d) => expect(d).toBeDefined()],
  ['brand', { brand: {} }, (d) => expect(d).toBeDefined()],
  ['navigation', { header: [], footer: [] }, (d) => expect(d).toBeDefined()],
  ['seo/home', { seoTitle: 'Plumber in Aluva', seoDescription: 'Leak repair and bathroom fitting for homes in Aluva.' }, (d) => expect(d.seo.home).toMatchObject({ seoTitle: 'Plumber in Aluva' })],
  ['location', { addressLine1: '12 Lake Road', city: 'Aluva', state: 'Kerala', pincode: '683101' }, (d) => expect(d.location).toMatchObject({ city: 'Aluva' })],
  ['review-link', { url: 'https://g.page/r/abc123/review' }, (d) => expect(d.reviewUrl).toContain('g.page')],
  ['testimonials', { items: [] }, (d) => expect(d).toBeDefined()],
  ['hours', { hours: [{ day: 'Mon', open: '09:00', close: '18:00', closed: false }] }, (d) => expect(d.hours).toHaveLength(1)],
  ['profile', { values: { business_name: 'Sri Ganesh Plumbing', tagline: 'Plumbing for homes' } }, (d) => expect(d.fields['site.tagline']).toBe('Plumbing for homes')],
];

const profileService = (w: WebsiteWorld, a: AobWorld): ProfileFieldsService => {
  const seed = buildProfileSeed(realSeed().categories.map((c) => ({ categoryKey: c.categoryKey, packKey: c.packKey, fieldHints: c.fieldHints ?? [] })));
  const values = new Map<string, Record<string, unknown>>();
  const fields = { listFields: async () => seed.fields, listMaps: async () => seed.maps, categoryByKey: async (k: string) => ({ categoryKey: k, packKey: 'FIELD_SERVICE' }), categoryOfVendor: async () => ({ categoryKey: 'plumber', packKey: 'FIELD_SERVICE' }) };
  const store = { get: async (v: string) => values.get(v) ?? {}, replace: async (v: string, x: Record<string, unknown>) => { values.set(v, x); }, vendorOfListing: async () => null };
  const packs = { packGate: async () => ({ counselGated: false, open: true }) };
  return new ProfileFieldsService(fields as never, store as never, packs as never, w.web, a.aw.activity);
};

describe('E9a: staff draft edits', () => {
  let app: INestApplication; let w: WebsiteWorld; let a: AobWorld;

  beforeEach(async () => {
    w = websiteWorld({ level: 'PRO' }); w.wsettings.v.testimonialMaxCount = 5;
    a = await aobWorld(30); a.store.vendors.add(VENDOR_ID); a.store.createdBy.set(VENDOR_ID, 'tele-1');
    const mod = await Test.createTestingModule({
      controllers: [AdminDraftController, AdminActOnBehalfController],
      providers: [
        AdminDraftService, { provide: ActOnBehalfService, useValue: a.svc }, { provide: ActOnBehalfStore, useValue: a.store }, { provide: WebsiteService, useValue: w.web },
        { provide: ProfileFieldsService, useValue: profileService(w, a) }, { provide: OnboardingQueueService, useValue: {} }, { provide: PrismaService, useValue: {} },
        { provide: APP_INTERCEPTOR, useValue: new ActOnBehalfInterceptor(a.svc) }, { provide: APP_INTERCEPTOR, useValue: new ActivityInterceptor(a.aw.activity) },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const p = req.headers['x-test-principal']; if (p) req.user = { email: 's@x.invalid', ...PRINCIPALS[p] }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  const call = (method: 'get' | 'put' | 'post', url: string, who: string, session?: string, body?: object) => {
    let r = request(app.getHttpServer())[method](url).set('x-test-principal', who);
    if (session) r = r.set('x-act-on-behalf-session', session);
    return r.send(body ?? {});
  };
  const base = `/v3/admin/vendors/${VENDOR_ID}`;
  const REASON = 'The owner asked on the phone for help with the website.';
  const start = async (who: string, vendorId = VENDOR_ID): Promise<string> => {
    const r = await call('post', `/v3/admin/vendors/${vendorId}/act-on-behalf`, who, undefined, { reason: REASON });
    expect([who, r.status]).toEqual([who, 200]);
    return r.body.data.id as string;
  };
  const code = (r: { body: unknown }): string => JSON.stringify(r.body);

  it('has a staff twin for every PUT /v3/me/site/draft route (a new owner route without one fails here)', () => {
    const routes = scanRoutes(path.resolve(__dirname, '../src')).map((r) => r.route);
    const owner = routes.filter((r) => r.startsWith('PUT /v3/me/site/draft/'));
    expect(owner.length).toBeGreaterThanOrEqual(9);
    for (const r of owner) expect(routes).toContain(r.replace('/v3/me/site/', '/v3/admin/vendors/:id/site/'));
    const covered = WRITES.map(([p]) => p.replace(/^list\/.*/, 'list/:name').replace(/^seo\/.*/, 'seo/:pageKey')).sort();
    expect(routes.filter((r) => r.startsWith('PUT /v3/admin/vendors/:id/site/draft/')).map((r) => r.split('/site/draft/')[1]).sort()).toEqual(covered);   // every staff route is tested below
  });

  describe.each(WRITES)('PUT .../site/draft/%s', (route, body, proof) => {
    const url = `${base}/site/draft/${route}`;

    it.each(ALLOWED)('%s saves it inside a session, and the audit trail says who and why', async (who) => {
      const session = await start(who);
      const r = await call('put', url, who, session, body);
      expect([who, r.status, r.status === 200 ? '' : code(r)]).toEqual([who, 200, '']);
      proof((await w.web.draft(VENDOR_ID)).doc as unknown as Doc);
      const staffId = String(PRINCIPALS[who].sub);
      const row = a.aw.store.activity.find((x) => (x.summary as { route?: string } | null)?.route?.startsWith('PUT /v3/admin/vendors/:id/site/draft/'));
      expect(row).toMatchObject({ vendorId: VENDOR_ID, actorType: 'STAFF', actorId: staffId });                       // who
      expect(row!.summary).toMatchObject({ actOnBehalfSessionId: session });                                       // why: the session ...
      expect((await a.store.get(session))!).toMatchObject({ staffId, vendorId: VENDOR_ID, reason: REASON });         // ... holds the written reason
    });

    it.each(REFUSED)('%s is refused (403) and nothing is saved', async (who) => {
      const r = await call('put', url, who, undefined, body);
      expect([who, r.status]).toEqual([who, 403]);
      expect(w.store.drafts.size).toBe(0);
    });

    it('without a session even OPERATIONS is refused, with a plain code, and nothing is saved', async () => {
      const r = await call('put', url, 'OPERATIONS', undefined, body);
      expect(r.status).toBe(403); expect(code(r)).toContain('ACT_ON_BEHALF_REQUIRED'); expect(w.store.drafts.size).toBe(0);
    });

    it('a telecaller who did not create the business gets the same 404 as for a business that does not exist', async () => {
      const theirs = await call('put', url, 'OTHER_TELECALLER', undefined, body);
      const ghost = await call('put', url.replace(VENDOR_ID, 'v-ghost'), 'OTHER_TELECALLER', undefined, body);
      expect([theirs.status, ghost.status]).toEqual([404, 404]); expect(theirs.body.message).toBe(ghost.body.message); expect(w.store.drafts.size).toBe(0);
    });
  });

  describe('sessions', () => {
    it('a telecaller starts and ends a session only for a business they created', async () => {
      const session = await start('TELECALLER');
      expect((await call('post', `/v3/admin/act-on-behalf/${session}/end`, 'TELECALLER')).status).toBe(200);
      for (const vendorId of ['v2', 'v-ghost']) expect((await call('post', `/v3/admin/vendors/${vendorId}/act-on-behalf`, 'TELECALLER', undefined, { reason: REASON })).status).toBe(404);
      expect((await call('post', `${base}/act-on-behalf`, 'OTHER_TELECALLER', undefined, { reason: REASON })).status).toBe(404);
    });
    it('plain sales, a field executive and support cannot start one', async () => {
      for (const who of ['SALES', 'FIELD_EXECUTIVE', 'SUPPORT']) expect([who, (await call('post', `${base}/act-on-behalf`, who, undefined, { reason: REASON })).status]).toEqual([who, 403]);
      expect(a.store.rows).toEqual([]);
    });
    it('a telecaller cannot list sessions or end someone else\'s', async () => {
      const other = await start('OPERATIONS');
      expect((await call('get', '/v3/admin/act-on-behalf', 'TELECALLER')).status).toBe(403);
      expect((await call('post', `/v3/admin/act-on-behalf/${other}/end`, 'TELECALLER')).status).toBe(403);
    });
    it('a session for one business does not open another, and an ended session saves nothing', async () => {
      const session = await start('OPERATIONS', 'v2');
      const wrong = await call('put', `${base}/site/draft/brand`, 'OPERATIONS', session, { brand: {} });
      expect(wrong.status).toBe(403); expect(code(wrong)).toContain('ACT_ON_BEHALF_WRONG_VENDOR');
      await a.svc.end({ id: 'ops-1', role: 'OPERATIONS' }, session);
      const ended = await call('put', '/v3/admin/vendors/v2/site/draft/brand', 'OPERATIONS', session, { brand: {} });
      expect(ended.status).toBe(403); expect(code(ended)).toContain('ACT_ON_BEHALF_EXPIRED'); expect(w.store.drafts.size).toBe(0);
    });
  });

  describe('reading', () => {
    it.each(['draft', 'editor/map'])('GET .../site/%s: allowed roles read it without a session; the others and a foreign telecaller do not', async (what) => {
      for (const who of ALLOWED) expect([who, (await call('get', `${base}/site/${what}`, who)).status]).toEqual([who, 200]);
      for (const who of REFUSED) expect([who, (await call('get', `${base}/site/${what}`, who)).status]).toEqual([who, 403]);
      expect((await call('get', `${base}/site/${what}`, 'OTHER_TELECALLER')).status).toBe(404);
      expect((await call('get', `/v3/admin/vendors/v-ghost/site/${what}`, 'OPERATIONS')).status).toBe(404);
    });
  });

  it('an item page (itemDetails) and its picture link are saved like any list', async () => {
    const session = await start('OPERATIONS');
    const itemId = w.state.doc.items[0].id;
    const r = await call('put', `${base}/site/draft/list/itemDetails`, 'OPERATIONS', session, { items: [{ itemId, title: 'Leak repair', images: 'https://cdn.example/leak.jpg | A repaired joint' }] });
    expect([r.status, r.status === 200 ? '' : code(r)]).toEqual([200, '']);
    expect((await w.web.draft(VENDOR_ID)).doc.lists.itemDetails).toHaveLength(1);
  });

  it('the field rules are the owner\'s rules: a locked field and promising words are refused for staff too', async () => {
    const session = await start('SUPER_ADMIN');
    expect((await call('put', `${base}/site/draft/field`, 'SUPER_ADMIN', session, { key: 'seo.canonical', value: 'x' })).status).toBeGreaterThanOrEqual(400);
    expect((await call('put', `${base}/site/draft/field`, 'SUPER_ADMIN', session, { key: 'hero.title', value: 'Number one plumber in Kochi' })).status).toBeGreaterThanOrEqual(400);
    expect(w.store.drafts.size).toBe(0);
  });
});

describe('E9a: the role rule on its own', () => {
  const tele = { id: 't1', role: 'MARKETING', label: 'TELECALLER' };
  it('narrows SALES only: the telecaller who created the business, nobody else', () => {
    expect(mayActForVendor(tele, 't1')).toBe('ALLOWED'); expect(mayActForVendor(tele, 't2')).toBe('NOT_THEIR_BUSINESS'); expect(mayActForVendor(tele, null)).toBe('NOT_THEIR_BUSINESS');
    expect(mayActForVendor({ id: 't1', role: 'MARKETING' }, 't1')).toBe('ROLE_REFUSED'); expect(mayActForVendor({ id: 't1', role: 'MARKETING', label: 'FIELD_EXECUTIVE' }, 't1')).toBe('ROLE_REFUSED');
    for (const role of ['OPERATIONS', 'ADMIN', 'SUPER_ADMIN']) expect(mayActForVendor({ id: 'x', role }, null)).toBe('ALLOWED');
  });
});
