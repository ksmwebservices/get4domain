import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminThemeMarketController } from '../src/v3-theme-market/api/theme-market.controllers';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { ThemeMarketStore } from '../src/v3-theme-market/theme-market.store';
import { goodZip, scriptZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';

/**
 * The theme marketplace admin routes over HTTP with the real guards, pipe, filter and interceptor: who may call what (the role matrix), a real multipart upload, the refusal body that carries every
 * problem with its file and rule, and the state flow. Roles are the real staff roles of the AdminGuard.
 */
jest.setTimeout(240_000);
describe('theme market admin routes over HTTP', () => {
  let app: INestApplication; let store: MemoryThemeMarketStore;
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p?: string) => { const r = request(app.getHttpServer()).get(url); return p ? r.set(as(p)) : r; };
  const post = (url: string, p?: string) => { const r = request(app.getHttpServer()).post(url); return p ? r.set(as(p)) : r; };
  const upload = (url: string, p: string | undefined, zip: Buffer, fields: Record<string, string> = {}) => { let r = post(url, p); for (const [k, v] of Object.entries(fields)) r = r.field(k, v); return r.attach('file', zip, { filename: 'theme.zip', contentType: 'application/zip' }); };

  beforeEach(async () => {
    store = new MemoryThemeMarketStore(); store.vendors.set('vendor-aaaa', { name: 'Acme', email: null, phone: null, subdomain: null, customDomain: null, mediaHashes: [] });
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [AdminThemeMarketController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ThemeMarketStore, useValue: store }, ThemeChangeNotifier, ThemeMarketService],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'vendor') req.user = { sub: 'v1', email: 'v@x.invalid', role: 'VENDOR' };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('a signed-out caller and a vendor are refused on every route', async () => {
    // This test module has no global JWT guard (the real app answers 401 for a signed-out caller before AdminGuard runs), so AdminGuard itself answers 403 for both: refused, nothing stored.
    for (const who of [undefined, 'vendor']) {
      expect((await get('/v3/admin/theme-market/themes', who)).status).toBe(403);
      expect((await upload('/v3/admin/theme-market/themes', who, goodZip())).status).toBe(403);
    }
    expect(store.rows).toHaveLength(0);
  });

  it('role matrix: OPERATIONS reads and checks only; ADMIN and SUPER_ADMIN change; SALES and SUPPORT are refused everywhere', async () => {
    const zip = goodZip();
    expect((await get('/v3/admin/theme-market/themes', 'OPERATIONS')).status).toBe(200);
    expect((await upload('/v3/admin/theme-market/validate', 'OPERATIONS', zip)).status).toBe(200);
    expect((await upload('/v3/admin/theme-market/themes', 'OPERATIONS', zip)).status).toBe(403);
    for (const role of ['MARKETING', 'SUPPORT', 'FIELD_EXECUTIVE', 'TELECALLER']) {
      expect((await get('/v3/admin/theme-market/themes', role)).status).toBe(403);
      expect((await upload('/v3/admin/theme-market/validate', role, zip)).status).toBe(403);
      expect((await upload('/v3/admin/theme-market/themes', role, zip)).status).toBe(403);
    }
    expect(store.rows).toHaveLength(0);
    for (const role of ['ADMIN', 'SUPER_ADMIN']) expect((await upload('/v3/admin/theme-market/validate', role, zip)).status).toBe(200);
  });

  it('ADMIN uploads, submits, publishes and archives; the answer is the standard envelope and carries no file bytes', async () => {
    const up = await upload('/v3/admin/theme-market/themes', 'ADMIN', goodZip());
    expect(up.status).toBe(200); expect(up.body.success).toBe(true); expect(up.body.data.theme).toMatchObject({ status: 'DRAFT', visibility: 'PUBLIC', key: 'tm1-test-hospitality' }); expect(JSON.stringify(up.body)).not.toContain('"bytes"');
    const id = up.body.data.theme.id as string;
    expect((await post(`/v3/admin/theme-market/themes/${id}/publish`, 'SUPER_ADMIN')).status).toBe(409);   // not reviewed yet
    expect((await post(`/v3/admin/theme-market/themes/${id}/submit`, 'ADMIN')).body.data.status).toBe('REVIEW');
    expect((await post(`/v3/admin/theme-market/themes/${id}/publish`, 'SUPER_ADMIN')).body.data.status).toBe('PUBLISHED');
    expect((await get(`/v3/admin/theme-market/themes/${id}`, 'OPERATIONS')).body.data.status).toBe('PUBLISHED');
    expect((await post(`/v3/admin/theme-market/themes/${id}/archive`, 'ADMIN')).body.data.status).toBe('ARCHIVED');
    expect(store.audits.map((a) => a.action)).toEqual(['theme.upload', 'theme.submit', 'theme.publish', 'theme.archive']);
  });

  it('a refused package answers 422 with the registered code and EVERY problem as { file, rule, message }, and stores nothing', async () => {
    const r = await upload('/v3/admin/theme-market/themes', 'ADMIN', scriptZip());
    expect(r.status).toBe(422); expect(r.body.success).toBe(false); expect(r.body.code).toBe('THEME_PACKAGE_INVALID');
    const problems = r.body.problems as Array<{ file: string; rule: string; message: string }>;
    expect(problems.length).toBeGreaterThan(0); for (const p of problems) { expect(typeof p.file).toBe('string'); expect(typeof p.rule).toBe('string'); expect(typeof p.message).toBe('string'); }
    expect(problems.some((p) => p.file === 'templates/home.html' && p.rule === 'no-script-tag')).toBe(true); expect(r.body.problemCount).toBe(problems.length);
    expect(store.rows).toHaveLength(0);
  });

  it('a missing file is 400 THEME_PACKAGE_MISSING; garbage bytes are 422, never a crash', async () => {
    const none = await request(app.getHttpServer()).post('/v3/admin/theme-market/themes').set(as('ADMIN')).field('vendorId', 'vendor-aaaa');
    expect([none.status, none.body.code]).toEqual([400, 'THEME_PACKAGE_MISSING']);
    const junk = await upload('/v3/admin/theme-market/themes', 'ADMIN', Buffer.from('this is not a zip file at all'));
    expect(junk.status).toBe(422); expect(junk.body.code).toBe('THEME_PACKAGE_INVALID'); expect(JSON.stringify(junk.body)).not.toContain('this is not a zip file at all');
  });

  it('a private upload needs a real business id; a malformed id is a plain 400 validation error', async () => {
    const ok = await upload('/v3/admin/theme-market/themes', 'ADMIN', goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'One customer.', sourceVendorId: 'vendor-aaaa' } }, 'tm1-private-http'), { vendorId: 'vendor-aaaa' });
    expect(ok.status).toBe(200); expect(ok.body.data.theme).toMatchObject({ visibility: 'PRIVATE', privateVendorId: 'vendor-aaaa' });
    expect((await upload('/v3/admin/theme-market/themes', 'ADMIN', goodZip({}, 'tm1-private-http2'), { vendorId: 'x y!' })).status).toBe(400);
  });

  it('list filters work over HTTP and a value that is not recognised is 400 THEME_FILTER_INVALID', async () => {
    await upload('/v3/admin/theme-market/themes', 'ADMIN', goodZip());
    expect((await get('/v3/admin/theme-market/themes?pack=FOOD_SERVICE&status=DRAFT', 'OPERATIONS')).body.data.total).toBe(1);
    expect((await get('/v3/admin/theme-market/themes?pack=CLINIC', 'OPERATIONS')).body.data.total).toBe(0);
    const bad = await get('/v3/admin/theme-market/themes?pack=NOPE', 'OPERATIONS'); expect([bad.status, bad.body.code]).toEqual([400, 'THEME_FILTER_INVALID']);
  });
});
