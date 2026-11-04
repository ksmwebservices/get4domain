import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { AdminTermsController, MeTermsController, PublicTermsController } from '../src/terms/api/terms.controllers';
import { TermsService } from '../src/terms/terms.service';
import { entitlements } from './support/site-fixtures';
import { REAL_TEXT, termsWorld, TW } from './support/terms-world';

/** Slice 5.15 over HTTP with the real guards, pipe, filter, interceptor and role checks; the service is the real one over the in-memory store. */
jest.setTimeout(120_000);

describe('terms API', () => {
  let app: INestApplication; let w: TW;
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p?: string) => { const r = request(app.getHttpServer()).get(url); return p ? r.set(as(p)) : r; };
  const send = (m: 'post' | 'put', url: string, p: string | null, b: object = {}) => { const r = request(app.getHttpServer())[m](url); return (p ? r.set(as(p)) : r).send(b); };

  beforeEach(async () => {
    w = await termsWorld();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [PublicTermsController, MeTermsController, AdminTermsController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: TermsService, useValue: w.svc }, { provide: EntitlementsService, useValue: { resolveForRequest: async () => entitlements('PRO', 'ecommerce') } }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'va', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'vb', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'member-a') req.user = { sub: 'va', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('public', () => {
    it('nothing published: a plain 404 for every kind, a draft included; once published, the text with a short public cache', async () => {
      expect((await get('/v3/public/terms/VENDOR_TERMS')).status).toBe(404); expect((await get('/v3/public/terms/NOPE')).status).toBe(404); expect((await get('/v3/public/terms/VENDOR_TERMS/versions')).status).toBe(404);
      await w.publish('VENDOR_TERMS', REAL_TEXT, 'First version');
      const r = await get('/v3/public/terms/VENDOR_TERMS');
      expect(r.status).toBe(200); expect(r.headers['cache-control']).toBe('public, max-age=300'); expect(r.body.data).toMatchObject({ kind: 'VENDOR_TERMS', version: 1, status: 'PUBLISHED', bodyMarkdown: REAL_TEXT });
      expect(JSON.stringify(r.body)).not.toMatch(/publishedBy|createdBy|staff-super/);
      const v = await get('/v3/public/terms/VENDOR_TERMS/versions'); expect(v.status).toBe(200); expect(v.body.data.versions).toHaveLength(1); expect(JSON.stringify(v.body)).not.toContain('bodyMarkdown');
    });
  });

  describe('the owner', () => {
    it('owner only: a team member and a signed-out caller are refused', async () => {
      expect((await get('/v3/me/terms')).status).toBe(401); expect((await get('/v3/me/terms', 'member-a')).status).toBe(403);
      expect((await send('post', '/v3/me/terms/accept', 'member-a', { documents: [{ kind: 'VENDOR_TERMS', version: 1 }] })).status).toBe(403);
    });
    it('status, then accept the current versions; a stale or empty body is refused; a new version asks again', async () => {
      expect((await get('/v3/me/terms', 'owner-a')).body.data).toMatchObject({ acceptanceRequired: false });
      await w.publishRequired();
      const st = await get('/v3/me/terms', 'owner-a'); expect(st.body.data.acceptanceRequired).toBe(true); expect(st.body.data.outstanding).toHaveLength(3);
      const docs = st.body.data.outstanding as Array<{ kind: string; version: number }>;
      expect((await send('post', '/v3/me/terms/accept', 'owner-a', { documents: [] })).status).toBe(400);
      expect((await send('post', '/v3/me/terms/accept', 'owner-a', { documents: [{ kind: 'VENDOR_TERMS', version: 'x' }] })).status).toBe(400);
      expect((await send('post', '/v3/me/terms/accept', 'owner-a', { documents: docs.map((d) => ({ ...d, version: 7 })) })).status).toBe(409);
      const ok = await send('post', '/v3/me/terms/accept', 'owner-a', { documents: docs }); expect(ok.status).toBe(200); expect(ok.body.data).toEqual({ accepted: 3, acceptanceRequired: false });
      const v2 = await w.svc.createDraft('VENDOR_TERMS', { bodyMarkdown: REAL_TEXT + ' more' }, { type: 'STAFF', id: 's', ip: null }); await w.svc.publish(v2.id, 'A new clause', { type: 'STAFF', id: 's', ip: null });
      expect((await get('/v3/me/terms', 'owner-a')).body.data).toMatchObject({ acceptanceRequired: true, outstanding: [{ kind: 'VENDOR_TERMS', version: 2 }] });
      expect((await get('/v3/me/terms', 'owner-b')).body.data.outstanding).toHaveLength(3);   // another vendor is unaffected by owner A's acceptances
    });
  });

  describe('staff', () => {
    it('SUPER_ADMIN only: OPERATIONS and MARKETING are refused on every route', async () => {
      const d = await w.draftOf('PRIVACY');
      for (const who of ['OPERATIONS', 'MARKETING']) {
        expect({ who, s: (await get('/v3/admin/terms', who)).status }).toEqual({ who, s: 403 }); expect((await get(`/v3/admin/terms/${d.id}`, who)).status).toBe(403);
        expect((await send('post', '/v3/admin/terms/kinds/PRIVACY/drafts', who, {})).status).toBe(403); expect((await send('put', `/v3/admin/terms/${d.id}`, who, { title: 'x' })).status).toBe(403);
        expect((await send('post', `/v3/admin/terms/${d.id}/publish`, who, { changeNote: 'First version' })).status).toBe(403);
      }
    });
    it('the full path: list, read, change a draft, publish with a note; the placeholder is a 422 with its code; a missing note is a 400', async () => {
      const list = await get('/v3/admin/terms', 'SUPER_ADMIN'); expect(list.status).toBe(200); expect(list.body.data.items).toHaveLength(8); expect(list.body.data.items[0].placeholder).toBe(true); expect(JSON.stringify(list.body)).not.toContain('bodyMarkdown');
      const d = await w.draftOf('VENDOR_TERMS');
      const one = await get(`/v3/admin/terms/${d.id}`, 'SUPER_ADMIN'); expect(one.body.data.bodyMarkdown).toBe('To be supplied by counsel');
      const blocked = await send('post', `/v3/admin/terms/${d.id}/publish`, 'SUPER_ADMIN', { changeNote: 'First version' }); expect(blocked.status).toBe(422); expect(blocked.body.code).toBe('TERMS_PLACEHOLDER');
      expect((await send('put', `/v3/admin/terms/${d.id}`, 'SUPER_ADMIN', { bodyMarkdown: REAL_TEXT, title: 'Vendor terms' })).status).toBe(200);
      expect((await send('post', `/v3/admin/terms/${d.id}/publish`, 'SUPER_ADMIN', {})).status).toBe(400); expect((await send('post', `/v3/admin/terms/${d.id}/publish`, 'SUPER_ADMIN', { changeNote: 'ok' })).status).toBe(400);
      const pub = await send('post', `/v3/admin/terms/${d.id}/publish`, 'SUPER_ADMIN', { changeNote: 'First version' }); expect(pub.status).toBe(200); expect(pub.body.data).toMatchObject({ status: 'PUBLISHED', version: 1 });
      expect((await send('put', `/v3/admin/terms/${d.id}`, 'SUPER_ADMIN', { title: 'late' })).body.code).toBe('TERMS_STATE_INVALID');
      expect((await get('/v3/public/terms/VENDOR_TERMS')).status).toBe(200);
      const next = await send('post', '/v3/admin/terms/kinds/VENDOR_TERMS/drafts', 'SUPER_ADMIN', {}); expect(next.status).toBe(200); expect(next.body.data).toMatchObject({ version: 2, status: 'DRAFT', placeholder: true });
      expect((await send('post', '/v3/admin/terms/kinds/NOPE/drafts', 'SUPER_ADMIN', {})).status).toBe(400); expect((await get('/v3/admin/terms/does-not-exist', 'SUPER_ADMIN')).status).toBe(404);
    });
    it('the guard names the waiting documents in its error body (what a screen needs to show the dialog)', async () => {
      await w.publishRequired();
      const e = await w.svc.require('va', ['VENDOR_TERMS']).catch((x) => x);
      expect(e.getResponse()).toMatchObject({ code: 'TERMS_ACCEPTANCE_REQUIRED', outstanding: [{ kind: 'VENDOR_TERMS', version: 1 }] });
    });
  });
});
