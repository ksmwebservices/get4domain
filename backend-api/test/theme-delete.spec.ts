import { HttpException, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { AdminThemeMarketController } from '../src/v3-theme-market/api/theme-market.controllers';
import { THEME_DELETE_BLOCK_MESSAGES, versionsDeleteBlock } from '../src/v3-theme-market/core/theme-delete-core';
import { PrismaThemeMarketStore } from '../src/v3-theme-market/prisma-theme-market.store';
import { THEME_MARKET_ERROR_CODES } from '../src/v3-theme-market/theme-market.errors';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { ThemeMarketStore } from '../src/v3-theme-market/theme-market.store';
import { goodZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';

/**
 * Deleting a theme: every version and package file together, only for a theme that was never published and is not, and never was, a business's, only by SUPER_ADMIN and ADMIN, with one audit row. The records are kept.
 * Three layers: the service over the in-memory store, the route over HTTP with the real guards, and the real Prisma adapter's query conditions (the in-memory store cannot prove those).
 */
jest.setTimeout(240_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: '127.0.0.1' };
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
const fail = async (p: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), body: e.getResponse() as Record<string, unknown> }; throw e; }
  throw new Error('expected a refusal');
};
const KEY = 'tm1-delete-me';
const privateZip = (key: string) => goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'One customer.', sourceVendorId: 'vendor-aaaa' } }, key);

function make() {
  const store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier(); let told = 0; notifier.subscribe(() => { told += 1; });
  store.vendors.set('vendor-aaaa', { name: 'Acme', email: null, phone: null, subdomain: 'acme', customDomain: null, mediaHashes: [] });
  const svc = new ThemeMarketService(store, notifier); svc.clock = () => new Date('2026-12-03T10:00:00Z');
  const upload = async (version = 1, key = KEY) => (await svc.upload(staff, file(goodZip({ version }, key)))).theme;
  return { store, svc, notifier, upload, told: () => told };
}

describe('theme delete: the rule over the stored versions', () => {
  const clean = { status: 'DRAFT', publishedAt: null, privateVendorId: null, sourceVendorId: null };
  it('drafts, reviews and archived versions that never went live and belong to nobody are not blocked', () => {
    expect(versionsDeleteBlock([clean, { ...clean, status: 'REVIEW' }, { ...clean, status: 'ARCHIVED' }])).toBeNull();
  });
  it('one published version, or one with a publish stamp, blocks the whole theme', () => {
    expect(versionsDeleteBlock([clean, { ...clean, status: 'PUBLISHED' }])).toBe('PUBLISHED_BEFORE');
    expect(versionsDeleteBlock([{ ...clean, status: 'ARCHIVED', publishedAt: new Date() }, clean])).toBe('PUBLISHED_BEFORE');
  });
  it('a version made for a business blocks the whole theme, also after it was shared (the source stays on the row)', () => {
    expect(versionsDeleteBlock([clean, { ...clean, privateVendorId: 'v' }])).toBe('MADE_FOR_BUSINESS');
    expect(versionsDeleteBlock([{ ...clean, sourceVendorId: 'v' }])).toBe('MADE_FOR_BUSINESS');
  });
  it('published is the reason given when both apply', () => expect(versionsDeleteBlock([{ ...clean, privateVendorId: 'v' }, { ...clean, status: 'PUBLISHED' }])).toBe('PUBLISHED_BEFORE'));
});

describe('theme delete: service', () => {
  it('registers its refusal code', () => expect(THEME_MARKET_ERROR_CODES).toContain('THEME_DELETE_BLOCKED'));

  it('deletes every version and every file of the theme: the records are kept and stamped, one audit row says who and what, and the runtime cache is told', async () => {
    const { store, svc, upload, told } = make(); const a = await upload(1); const b = await upload(2);
    expect(await svc.remove(a.id, staff)).toEqual({ deleted: true, id: a.id, key: KEY, versions: [1, 2] });
    expect(store.rows).toHaveLength(2);
    for (const r of store.rows) { expect(r.deletedAt).toEqual(new Date('2026-12-03T10:00:00Z')); expect(r.bytes).toHaveLength(0); }
    const deletes = store.audits.filter((x) => x.action === 'theme.delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({ entityId: b.id, actor: staff, before: { key: KEY, versions: [{ id: a.id, version: 1, status: 'DRAFT' }, { id: b.id, version: 2, status: 'DRAFT' }] }, after: { deleted: true, versions: [1, 2], filesRemoved: 2 } });
    expect(told()).toBe(1);
  });

  it('leaves every other theme as it was', async () => {
    const { store, svc, upload } = make(); const a = await upload(1); const other = await upload(1, 'tm1-keep-me');
    await svc.remove(a.id, staff);
    expect((await svc.list({})).items.map((x) => x.id)).toEqual([other.id]);
    const kept = store.rows.find((r) => r.id === other.id);
    expect(kept?.deletedAt).toBeNull(); expect(kept?.bytes.length).toBeGreaterThan(0);
  });

  it('a version in review and an archived draft that never went live can be deleted', async () => {
    const { svc, upload } = make();
    const review = await upload(1, 'tm1-in-review'); await svc.submit(review.id, staff);
    const old = await upload(1, 'tm1-old-draft'); await svc.archive(old.id, staff);
    await expect(svc.remove(review.id, staff)).resolves.toMatchObject({ deleted: true });
    await expect(svc.remove(old.id, staff)).resolves.toMatchObject({ deleted: true });
  });

  it('a deleted theme is gone everywhere: not listed, not readable, no step possible, and deleting twice is 404', async () => {
    const { svc, upload } = make(); const t = await upload(); await svc.remove(t.id, staff);
    expect((await svc.list({})).total).toBe(0);
    for (const step of [() => svc.get(t.id), () => svc.submit(t.id, staff), () => svc.publish(t.id, staff), () => svc.archive(t.id, staff), () => svc.previewStored(t.id, undefined, undefined), () => svc.remove(t.id, staff)]) {
      expect((await fail(step())).body.code).toBe('THEME_NOT_FOUND');
    }
  });

  const snapshot = (w: ReturnType<typeof make>) => JSON.stringify([w.store.rows.map((x) => [x.id, x.status, x.deletedAt, x.bytes.length]), w.store.audits.length, w.told()]);
  const refused = async (w: ReturnType<typeof make>, id: string, reason: keyof typeof THEME_DELETE_BLOCK_MESSAGES) => {
    const before = snapshot(w);
    const r = await fail(w.svc.remove(id, staff));
    expect([r.status, r.body.code, r.body.reason, r.body.message]).toEqual([409, 'THEME_DELETE_BLOCKED', reason, THEME_DELETE_BLOCK_MESSAGES[reason]]);
    expect(snapshot(w)).toBe(before);
  };

  it('refuses a published theme, and the same theme after it is archived', async () => {
    const w = make(); const t = await w.upload(); await w.svc.submit(t.id, staff); await w.svc.publish(t.id, staff);
    await refused(w, t.id, 'PUBLISHED_BEFORE');
    await w.svc.archive(t.id, staff);
    await refused(w, t.id, 'PUBLISHED_BEFORE');
  });

  it('refuses the whole theme through a newer draft when an earlier version was published: no version and no file goes', async () => {
    const w = make(); const a = await w.upload(1); await w.svc.submit(a.id, staff); await w.svc.publish(a.id, staff);
    const b = await w.upload(2);
    await refused(w, b.id, 'PUBLISHED_BEFORE');
    await w.svc.archive(a.id, staff);
    await refused(w, b.id, 'PUBLISHED_BEFORE');
  });

  it('refuses a theme assigned to one business (made for it), in every state', async () => {
    const w = make(); const t = (await w.svc.upload(staff, file(privateZip('tm1-del-private')), { vendorId: 'vendor-aaaa' })).theme;
    await refused(w, t.id, 'MADE_FOR_BUSINESS');
    await w.svc.archive(t.id, staff);
    await refused(w, t.id, 'MADE_FOR_BUSINESS');
  });

  it('refuses a theme a business has on its site, had, or bought, even though it never went live', async () => {
    const w = make(); const t = await w.upload(); w.store.usedKeys.add(KEY);
    await refused(w, t.id, 'USED_BY_BUSINESS');
  });

  it('a change by someone else between the check and the delete is a plain refusal with no audit row', async () => {
    const { store, svc, upload } = make(); const t = await upload();
    store.softDeleteTheme = async () => false;
    const audits = store.audits.length; const r = await fail(svc.remove(t.id, staff));
    expect([r.status, r.body.code]).toEqual([409, 'THEME_STATE_INVALID']); expect(store.audits).toHaveLength(audits);
  });

  it('a deleted version number stays taken, also for the same bytes; a higher version uploads', async () => {
    const { svc, upload } = make(); const zip = goodZip({ version: 1 }, KEY);
    const t = (await svc.upload(staff, file(zip))).theme; await svc.remove(t.id, staff);
    const again = await fail(svc.upload(staff, file(zip)));
    expect([again.status, again.body.code]).toEqual([409, 'THEME_VERSION_EXISTS']); expect(String(again.body.message)).toContain('was deleted');
    expect(await upload(2)).toMatchObject({ version: 2, status: 'DRAFT' });
  });

  it('the site renderer stops drawing an archived draft once it is deleted', async () => {
    const store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier(); const kit = loadKit();
    const svc = new ThemeMarketService(store, notifier, kit); const renderer = new ThemeRenderService(kit, store, notifier); await renderer.onModuleInit();
    try {
      const t = (await svc.upload(staff, file(goodZip({}, KEY)))).theme; await svc.archive(t.id, staff);
      expect(renderer.getTheme(KEY)).toBeTruthy();
      await svc.remove(t.id, staff);
      expect(() => renderer.getTheme(KEY)).toThrow();
    } finally { renderer.onModuleDestroy(); }
  });
});

describe('theme delete: route', () => {
  let app: INestApplication; let store: MemoryThemeMarketStore; let svc: ThemeMarketService;
  const del = (id: string, p?: string) => { const r = request(app.getHttpServer()).delete(`/v3/admin/theme-market/themes/${id}`); return p ? r.set({ 'x-test-principal': p }) : r; };

  beforeEach(async () => {
    store = new MemoryThemeMarketStore();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [AdminThemeMarketController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ThemeMarketStore, useValue: store }, ThemeChangeNotifier, ThemeMarketService],
    }).compile();
    svc = mod.get(ThemeMarketService);
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

  it('the matrix gives the route to SUPER_ADMIN and ADMIN and to nobody else', () => {
    expect([...effectiveRolesFor('DELETE /v3/admin/theme-market/themes/:id')].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
  });

  it('every other team role, a vendor and a signed-out caller are refused, and nothing changes', async () => {
    const t = (await svc.upload(staff, file(goodZip({}, KEY)))).theme; const audits = store.audits.length;
    for (const who of [undefined, 'vendor', 'OPERATIONS', 'SUPPORT', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER']) expect([who, (await del(t.id, who)).status]).toEqual([who, 403]);
    expect(store.rows[0].deletedAt).toBeNull(); expect(store.audits).toHaveLength(audits);
  });

  it.each([['SUPER_ADMIN'], ['ADMIN']])('%s deletes a theme: the standard envelope, then 404', async (role) => {
    const t = (await svc.upload(staff, file(goodZip({}, KEY)))).theme;
    const r = await del(t.id, role);
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ success: true, data: { deleted: true, id: t.id, key: KEY, versions: [1] } });
    expect(store.audits[store.audits.length - 1]).toMatchObject({ action: 'theme.delete', actor: expect.objectContaining({ id: 'staff-1' }) });
    expect((await del(t.id, role)).status).toBe(404);
  });

  it('a published theme answers 409 THEME_DELETE_BLOCKED with a plain reason and stays', async () => {
    const t = (await svc.upload(staff, file(goodZip({}, KEY)))).theme; await svc.submit(t.id, staff); await svc.publish(t.id, staff);
    const r = await del(t.id, 'SUPER_ADMIN');
    expect([r.status, r.body.code, r.body.success, r.body.message]).toEqual([409, 'THEME_DELETE_BLOCKED', false, THEME_DELETE_BLOCK_MESSAGES.PUBLISHED_BEFORE]);
    expect(store.rows[0].deletedAt).toBeNull(); expect(store.rows[0].bytes.length).toBeGreaterThan(0);
  });

  it.each([['MADE_FOR_BUSINESS'], ['USED_BY_BUSINESS']] as const)('an assigned theme answers 409 with the plain reason (%s) and stays', async (reason) => {
    const priv = reason === 'MADE_FOR_BUSINESS';
    if (priv) store.vendors.set('vendor-aaaa', { name: 'Acme', email: null, phone: null, subdomain: 'acme', customDomain: null, mediaHashes: [] });
    const t = (await svc.upload(staff, file(priv ? privateZip(KEY) : goodZip({}, KEY)), priv ? { vendorId: 'vendor-aaaa' } : {})).theme;
    if (!priv) store.usedKeys.add(KEY);
    const r = await del(t.id, 'ADMIN');
    expect([r.status, r.body.code, r.body.message]).toEqual([409, 'THEME_DELETE_BLOCKED', THEME_DELETE_BLOCK_MESSAGES[reason]]);
    expect(store.rows[0].deletedAt).toBeNull();
  });
});

describe('theme delete: the database adapter', () => {
  type Found = Partial<Record<'site' | 'publication' | 'change' | 'bought', boolean>>;
  function adapter(found: Found = {}, updated = 2, left = 0) {
    const calls: Array<{ model: string; op: string; args: any }> = [];   // eslint-disable-line @typescript-eslint/no-explicit-any
    const audits: unknown[][] = [];
    const model = (name: string, hit?: boolean) => new Proxy({}, { get: (_t, op: string) => async (args: unknown) => { calls.push({ model: name, op, args }); if (op === 'updateMany') return { count: updated }; if (op === 'findMany') return []; if (op === 'count') return left; return hit ? { id: 'x' } : null; } });
    const db = { v3ThemeMarketPackage: model('theme'), v3SiteSettings: model('site', found.site), v3SitePublication: model('publication', found.publication), v3ThemeSwitch: model('change', found.change), themeEntitlement: model('bought', found.bought) };
    const prisma = { ...db, $transaction: async (fn: (tx: unknown) => unknown) => fn({ ...db, inTransaction: true }) };
    const audit = { record: async (...a: unknown[]) => { audits.push(a); } };
    return { store: new PrismaThemeMarketStore(prisma as never, audit as never), calls, audits };
  }
  const stamp = { deletedAt: new Date(), deletedById: 'staff-1' };
  const spec = { actor: staff, action: 'theme.delete', before: { a: 1 }, after: { b: 2 } };

  it('every read of themes leaves deleted rows out', async () => {
    const { store, calls } = adapter({}, 0);   // updateMany matches nothing, so transition stops after its conditional update
    await store.find('id'); await store.findWithBytes('id'); await store.list({ key: 'k' }, 0, 10); await store.loadServable(); await store.servableMeta();
    await expect(store.transition('id', ['DRAFT'], { status: 'REVIEW' }, spec)).resolves.toBeNull();
    expect(calls.map((c) => c.op)).toEqual(['findFirst', 'findFirst', 'findMany', 'count', 'findMany', 'findMany', 'updateMany']);
    for (const c of calls) expect([c.op, c.args.where.deletedAt]).toEqual([c.op, null]);
  });

  it('the version lookup does not hide deleted rows', async () => {
    const { store, calls } = adapter();
    await store.findByKeyVersion('k', 1);
    expect(JSON.stringify(calls[0].args.where)).not.toContain('deletedAt');
  });

  it.each([['site'], ['publication'], ['change'], ['bought']] as const)('a theme named by a business %s counts as used', async (where) => {
    await expect(adapter({ [where]: true }).store.keyUsedByVendor('k')).resolves.toBe(true);
  });

  it('asks the sites, the publications, both ends of a theme change and the bought years, by key', async () => {
    const { store, calls } = adapter();
    await expect(store.keyUsedByVendor('k')).resolves.toBe(false);
    expect(calls.map((c) => [c.model, c.args.where])).toEqual([['site', { themeId: 'k' }], ['publication', { themeId: 'k' }], ['change', { OR: [{ toThemeKey: 'k' }, { fromThemeKey: 'k' }] }], ['bought', { themeKey: 'k' }]]);
  });

  it('stamps and empties only unpublished, unowned, not yet deleted versions, never removes a row, and writes one audit row in the same transaction', async () => {
    const { store, calls, audits } = adapter();
    await expect(store.softDeleteTheme('k', ['id-1', 'id-2'], stamp, spec)).resolves.toBe(true);
    expect(calls[0]).toEqual({ model: 'theme', op: 'updateMany', args: { where: { key: 'k', id: { in: ['id-1', 'id-2'] }, deletedAt: null, publishedAt: null, status: { not: 'PUBLISHED' }, privateVendorId: null, sourceVendorId: null }, data: { ...stamp, bytes: new Uint8Array(0) } } });
    expect(calls.filter((c) => c.op.startsWith('delete'))).toEqual([]);
    expect(audits).toEqual([[expect.objectContaining({ inTransaction: true }), staff, 'theme.delete', 'theme', 'id-2', { a: 1 }, { b: 2 }]]);
  });

  it.each<[string, Found, number, number]>([
    ['a version no longer qualifies', {}, 1, 0], ['a version was added', {}, 2, 1], ['a business took the theme', { site: true }, 2, 0],
  ])('%s meanwhile: false and no audit row', async (_why, found, updated, left) => {
    const { store, audits } = adapter(found, updated, left);
    await expect(store.softDeleteTheme('k', ['id-1', 'id-2'], stamp, spec)).resolves.toBe(false);
    expect(audits).toHaveLength(0);
  });

  it('a database error is not swallowed', async () => {
    const prisma = { $transaction: async () => { throw new Error('database down'); } };
    await expect(new PrismaThemeMarketStore(prisma as never, {} as never).softDeleteTheme('k', ['id-1'], stamp, spec)).rejects.toThrow('database down');
  });

  it('the migration only adds two nullable columns and the check', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20270112100000_v3_theme_delete/migration.sql'), 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n');
    expect(sql).toContain('ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;');
    expect(sql).toContain('"g4d_theme_market_packages_deleted_check"');
    expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE FROM|NOT NULL;/);
  });
});
