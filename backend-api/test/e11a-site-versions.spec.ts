import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SiteRepository } from '../src/site-publish/publish/site.repository';
import { AdminSiteVersionsController } from '../src/v3-website/api/admin-versions.controller';
import { SiteVersionsService } from '../src/v3-website/versions/site-versions.service';
import { WebsiteService } from '../src/v3-website/website.service';
import { WebsiteStore } from '../src/v3-website/website.store';
import { entitlements } from './support/site-fixtures';
import { OWNER_ACTOR, VENDOR_ID, WebsiteWorld, websiteWorld } from './support/website-world';

/** E11a over HTTP: the real admin guard and role matrix, validation pipe, error filter, website and publish services over memory stores. */
jest.setTimeout(180_000);

const PRINCIPALS: Record<string, Record<string, unknown>> = {
  SUPER_ADMIN: { sub: 'platform-admin', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPER_ADMIN' },
  ADMIN: { sub: 'admin-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'ADMIN' },
  OPERATIONS: { sub: 'ops-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' },
  MARKETING: { sub: 'sales-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING' },
  TELECALLER: { sub: 'tele-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  SUPPORT: { sub: 'support-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPPORT' },
  OWNER: { sub: VENDOR_ID, role: 'VENDOR' },
};
const STAFF_NAMES = [{ id: 'ops-1', name: 'Meena (Operations)' }];
const VENDOR_NAMES = [{ id: 'platform-admin', name: 'Platform Admin' }];
const KNOWN_VENDORS = [VENDOR_ID, 'v-other'];

const prisma = {
  vendor: {
    findUnique: async ({ where }: { where: { id: string } }) => (KNOWN_VENDORS.includes(where.id) ? { id: where.id } : null),
    findMany: async ({ where }: { where: { id: { in: string[] } } }) => VENDOR_NAMES.filter((v) => where.id.in.includes(v.id)),
  },
  adminTeamMember: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => STAFF_NAMES.filter((m) => where.id.in.includes(m.id)) },
};

describe('E11a: staff version list and rollback', () => {
  let app: INestApplication; let w: WebsiteWorld;
  const base = `/v3/admin/vendors/${VENDOR_ID}/site`;
  const list = (who: string, query = '', url = base) => request(app.getHttpServer()).get(`${url}/revisions${query}`).set('x-test-principal', who);
  const back = (who: string, body: object, url = base) => request(app.getHttpServer()).post(`${url}/rollback`).set('x-test-principal', who).send(body);

  beforeEach(async () => {
    w = websiteWorld({ level: 'PRO' });
    const mod = await Test.createTestingModule({
      controllers: [AdminSiteVersionsController],
      providers: [
        SiteVersionsService, { provide: PrismaService, useValue: prisma }, { provide: SiteRepository, useValue: w.repo }, { provide: WebsiteStore, useValue: w.store },
        { provide: WebsiteService, useValue: w.web }, { provide: EntitlementsService, useValue: { resolve: async () => w.state.ent } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const p = req.headers['x-test-principal']; if (p) req.user = { email: 'secret-staff@x.invalid', ...PRINCIPALS[p] }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  /** Saves a headline and publishes it as the given actor: one new published version. */
  const publishTitle = async (title: string, actor: { type: 'STAFF' | 'VENDOR' | 'SYSTEM'; id: string | null; ip: null } = { type: 'STAFF', id: 'ops-1', ip: null }): Promise<number> => {
    await w.web.save(VENDOR_ID, actor, { kind: 'field', key: 'hero.title', value: title });
    const r = await w.web.publish(VENDOR_ID, actor, { staff: true });
    return r.publication!.version;
  };
  const title = async (): Promise<string | undefined> => (await w.web.draft(VENDOR_ID)).doc.fields['hero.title'];
  const liveVersion = async (): Promise<number | undefined> => (await w.repo.currentPublication(VENDOR_ID))?.version;

  describe('the list', () => {
    it('is newest first, holds published versions only, and names who published each (never an e-mail address)', async () => {
      const v1 = await publishTitle('First headline');
      const v2 = await publishTitle('Second headline', OWNER_ACTOR as never);
      const v3 = await publishTitle('Third headline', { type: 'STAFF', id: 'platform-admin', ip: null });
      const v4 = await publishTitle('Fourth headline', { type: 'STAFF', id: 'someone-gone', ip: null });
      await w.web.save(VENDOR_ID, OWNER_ACTOR, { kind: 'field', key: 'hero.title', value: 'Only a preview' });
      const preview = (await w.web.preview(VENDOR_ID, OWNER_ACTOR)).publication.version;

      const r = await list('OPERATIONS');
      expect(r.status).toBe(200);
      expect(r.body.data.items.map((i: { version: number }) => i.version)).toEqual([v4, v3, v2, v1]);
      expect(r.body.data.items.map((i: { version: number }) => i.version)).not.toContain(preview);
      expect(r.body.data.total).toBe(4);
      expect(r.body.data.items.map((i: { publishedBy: unknown }) => i.publishedBy)).toEqual([
        { type: 'STAFF', name: 'Get4Domain staff' }, { type: 'STAFF', name: 'Platform Admin' }, { type: 'VENDOR', name: 'the owner' }, { type: 'STAFF', name: 'Meena (Operations)' },
      ]);
      expect(r.body.data.items.map((i: { current: boolean }) => i.current)).toEqual([true, false, false, false]);
      expect(r.body.data.items[0]).toMatchObject({ reason: null, rolledBackFromVersion: null, hasContentSnapshot: true });
      expect(typeof r.body.data.items[0].publishedAt).toBe('string');
      expect(JSON.stringify(r.body)).not.toContain('@x.invalid');
      expect(JSON.stringify(r.body)).not.toContain('<!doctype');
    });

    it('says whether the draft holds unpublished changes and whether the plan allows a rollback', async () => {
      await publishTitle('First headline');
      expect((await list('OPERATIONS')).body.data).toMatchObject({ unpublishedChanges: false, canRollback: true });
      await w.web.save(VENDOR_ID, OWNER_ACTOR, { kind: 'field', key: 'hero.title', value: 'Not live yet' });
      w.state.ent = entitlements('FREE', 'handyman');
      expect((await list('OPERATIONS')).body.data).toMatchObject({ unpublishedChanges: true, canRollback: false });
    });

    it('pages: pageSize and page, newest first, with the total; a page size over 100 is refused', async () => {
      await publishTitle('First headline'); const v2 = await publishTitle('Second headline'); const v3 = await publishTitle('Third headline');
      const p1 = await list('OPERATIONS', '?page=1&pageSize=1'); const p2 = await list('OPERATIONS', '?page=2&pageSize=1');
      expect(p1.body.data).toMatchObject({ total: 3, page: 1, pageSize: 1 }); expect(p1.body.data.items.map((i: { version: number }) => i.version)).toEqual([v3]);
      expect(p2.body.data.items.map((i: { version: number }) => i.version)).toEqual([v2]);
      expect((await list('OPERATIONS', '?pageSize=101')).status).toBe(400);
    });

    it('a business with nothing published gives an empty list; an unknown business is 404', async () => {
      expect((await list('OPERATIONS')).body.data).toMatchObject({ items: [], total: 0 });
      const r = await list('OPERATIONS', '', '/v3/admin/vendors/nope/site');
      expect(r.status).toBe(404); expect(r.body.code).toBe('UNKNOWN_VENDOR');
    });

    it('marks a version that has no saved content of its own', async () => {
      const v1 = await publishTitle('First headline');
      w.store.snaps = w.store.snaps.filter((s) => s.version !== v1);
      expect((await list('OPERATIONS')).body.data.items[0]).toMatchObject({ version: v1, hasContentSnapshot: false });
    });

    it('roles: every staff role that reads a site reads the list; support and a vendor are refused', async () => {
      for (const who of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'MARKETING', 'TELECALLER']) expect((await list(who)).status).toBe(200);
      for (const who of ['SUPPORT', 'OWNER']) expect((await list(who)).status).toBe(403);
      expect((await request(app.getHttpServer()).get(`${base}/revisions`)).status).toBe(403);
    });
  });

  describe('the rollback', () => {
    it('publishes the old version as a new one, restores its draft, purges the cache, and keeps the reason and the staff member', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      const purged = w.cache.purged.length;
      const r = await back('OPERATIONS', { toVersion: v1, reason: '  The owner asked for the old headline  ' });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ status: 'PUBLISHED', rolledBackFromVersion: v1, draftRestored: true, replacedUnpublishedChanges: false });
      const now = r.body.data.version as number;
      expect(await liveVersion()).toBe(now);
      expect(await title()).toBe('First headline');
      expect((await w.web.draft(VENDOR_ID)).dirty).toBe(false);
      expect(w.cache.purged.length).toBe(purged + 1);
      const event = w.repo.events.filter((e) => e.type === 'ROLLED_BACK').pop();
      expect(event).toMatchObject({ actorType: 'STAFF', actorId: 'ops-1', detail: { toVersion: v1, newVersion: now, reason: 'The owner asked for the old headline' } });
      expect(w.auditDetails.filter((a) => a.action === 'site.rollback')).toEqual([{ action: 'site.rollback', actorId: 'ops-1', after: { toVersion: v1, reason: 'The owner asked for the old headline' } }]);
      const row = (await list('MARKETING')).body.data.items[0];
      expect(row).toMatchObject({ version: now, current: true, rolledBackFromVersion: v1, reason: 'The owner asked for the old headline', publishedBy: { type: 'STAFF', name: 'Meena (Operations)' } });
    });

    it('says when it replaced unpublished changes, and the next publish does not bring the undone content back', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      await w.web.save(VENDOR_ID, OWNER_ACTOR, { kind: 'field', key: 'hero.title', value: 'Half written idea' });
      const r = await back('ADMIN', { toVersion: v1, reason: 'Wrong text went live' });
      expect(r.body.data.replacedUnpublishedChanges).toBe(true);
      expect(await title()).toBe('First headline');
      expect((await w.web.publish(VENDOR_ID, OWNER_ACTOR)).unchanged).toBe(true);
    });

    it('needs a reason of 5 to 300 characters and nothing else it does not know', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      const live = await liveVersion();
      for (const body of [{ toVersion: v1 }, { toVersion: v1, reason: 'abcd' }, { toVersion: v1, reason: '          ' }, { toVersion: v1, reason: 'x'.repeat(301) }, { toVersion: v1, reason: 12345678 }, { toVersion: 0, reason: 'A good reason' }, { reason: 'A good reason' }, { toVersion: v1, reason: 'A good reason', force: true }]) {
        expect([body, (await back('OPERATIONS', body)).status]).toEqual([body, 400]);
      }
      expect(await liveVersion()).toBe(live);
      expect(await title()).toBe('Second headline');
      expect((await back('OPERATIONS', { toVersion: v1, reason: 'x'.repeat(300) })).status).toBe(200);
    });

    it('roles: only operations, admin and super admin go back; sales, telecaller, support and the vendor are refused and nothing changes', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      const live = await liveVersion();
      for (const who of ['MARKETING', 'TELECALLER', 'SUPPORT', 'OWNER']) expect([who, (await back(who, { toVersion: v1, reason: 'A good reason' })).status]).toEqual([who, 403]);
      expect((await request(app.getHttpServer()).post(`${base}/rollback`).send({ toVersion: v1, reason: 'A good reason' })).status).toBe(403);
      expect(await liveVersion()).toBe(live);
      for (const who of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']) expect([who, (await back(who, { toVersion: v1, reason: 'A good reason' })).status]).toEqual([who, 200]);
    });

    it('refuses a plan without version history and leaves the site and the draft alone', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      const live = await liveVersion();
      w.state.ent = entitlements('FREE', 'handyman');
      const r = await back('OPERATIONS', { toVersion: v1, reason: 'A good reason' });
      expect(r.status).toBe(403); expect(r.body.code).toBe('FEATURE_LOCKED');
      expect(await liveVersion()).toBe(live); expect(await title()).toBe('Second headline');
    });

    it('refuses an unknown version, a preview that was never published, a site with nothing published and an unknown business', async () => {
      expect((await back('OPERATIONS', { toVersion: 1, reason: 'A good reason' })).body.code).toBe('VERSION_NOT_FOUND');
      await publishTitle('First headline');
      const unknown = await back('OPERATIONS', { toVersion: 99, reason: 'A good reason' });
      expect(unknown.status).toBe(404); expect(unknown.body.code).toBe('VERSION_NOT_FOUND');
      await w.web.save(VENDOR_ID, OWNER_ACTOR, { kind: 'field', key: 'hero.title', value: 'Only a preview' });
      const preview = (await w.web.preview(VENDOR_ID, OWNER_ACTOR)).publication.version;
      const p = await back('OPERATIONS', { toVersion: preview, reason: 'A good reason' });
      expect(p.status).toBe(404); expect(p.body.code).toBe('PUBLICATION_NOT_FOUND');
      expect(await title()).toBe('Only a preview');
      const nobody = await back('OPERATIONS', { toVersion: 1, reason: 'A good reason' }, '/v3/admin/vendors/nope/site');
      expect(nobody.status).toBe(404); expect(nobody.body.code).toBe('UNKNOWN_VENDOR');
    });

    it('cannot reach another business\'s versions', async () => {
      const v1 = await publishTitle('First headline');
      const r = await back('OPERATIONS', { toVersion: v1, reason: 'A good reason' }, '/v3/admin/vendors/v-other/site');
      expect(r.status).toBe(404); expect(r.body.code).toBe('VERSION_NOT_FOUND');
      expect((await list('OPERATIONS', '', '/v3/admin/vendors/v-other/site')).body.data.total).toBe(0);
    });

    it('is blocked, with the missing list, when search engines were switched off after that version was published', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      await w.repo.upsertSettings(VENDOR_ID, { forceNoindex: true });
      expect(w.repo.pubs.size).toBeGreaterThan(0);
      const target = [...w.repo.pubs.values()].find((p) => p.version === v1)!;
      target.indexable = true;
      const live = await liveVersion();
      const r = await back('OPERATIONS', { toVersion: v1, reason: 'A good reason' });
      expect(r.status).toBe(409); expect(r.body.code).toBe('PUBLISH_BLOCKED'); expect(JSON.stringify(r.body)).toContain('FORCE_NOINDEX');
      expect(await liveVersion()).toBe(live); expect(await title()).toBe('Second headline');
    });

    it('the owner\'s own restore still needs no reason and records none', async () => {
      const v1 = await publishTitle('First headline'); await publishTitle('Second headline');
      await w.web.restore(VENDOR_ID, v1, OWNER_ACTOR);
      expect(w.repo.events.filter((e) => e.type === 'ROLLED_BACK').pop()!.detail).not.toHaveProperty('reason');
      expect((await list('OPERATIONS')).body.data.items[0]).toMatchObject({ reason: null, publishedBy: { type: 'VENDOR', name: 'the owner' } });
    });
  });
});
