import { HttpException, INestApplication } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { SeededAdminController } from '../src/seeded-sites/api/seeded-admin.controller';
import { AdminMediaUploadController } from '../src/v3-media-upload/api/media-upload.controllers';
import { isGroupToken } from '../src/v3-media-upload/core/media-upload-core';
import { MediaUploadService } from '../src/v3-media-upload/media-upload.service';
import { MediaUploadStore } from '../src/v3-media-upload/media-upload.store';
import { UPLOAD_TYPES, StorageSettingsService } from '../src/v3-storage/settings/storage-settings';
import { FakeImagePort, FakeMediaStorage, ImagePort, MediaStoragePort } from '../src/v3-website/media/media.ports';
import { MemoryMediaUploadStore } from './support/memory-media-upload-store';
import { ops, seededWorld } from './support/seeded-world';

/** Wave 2 Part G (2): draft uploads made before the listing existed follow it when it is made: by an upload group token, idempotent, and only the staff member's own drafts move. */
jest.setTimeout(120_000);

const PNG = (seed: number): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, seed)]);
const GROUP = 'form-aaaaaaaaaaaaaaaa'; const OTHER = 'form-bbbbbbbbbbbbbbbb';
const caps = { mediaUploadMaxBytes: 5000, mediaUploadMaxPixels: 4_000_000, mediaUploadAllowedTypes: [...UPLOAD_TYPES] };
const file = (b: Buffer) => ({ buffer: b, mimetype: 'image/png', size: b.length });
const staff = (id: string) => ({ type: 'STAFF' as const, id, ip: null });
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), code: (e.getResponse() as { code?: string }).code }; throw e; } throw new Error('expected a refusal'); };

describe('the service', () => {
  let store: MemoryMediaUploadStore; let storage: FakeMediaStorage; let svc: MediaUploadService; let activity: string[];
  beforeEach(() => {
    store = new MemoryMediaUploadStore(); storage = new FakeMediaStorage(); activity = []; store.listings.set('seed1', 'v1'); store.listings.set('seed2', 'v2');
    svc = new MediaUploadService(store, storage, new FakeImagePort(), { get: async () => caps } as unknown as StorageSettingsService, { record: async (i: { actionKey: string }) => { activity.push(i.actionKey); return null; } } as never);
  });
  const draft = (id: string, b: Buffer, g?: string) => svc.upload({ kind: 'DRAFT', staffId: id }, staff(id), file(b), 'A picture', g);

  it('the token format: 16 to 64 letters, digits, dashes and underscores', () => {
    expect(isGroupToken(GROUP)).toBe(true); for (const bad of ['short', 'has space 0000000000', 'x'.repeat(65), '../../etc/passwd0000', 5, null]) expect(isGroupToken(bad)).toBe(false);
  });
  it('a draft upload keeps its group; a bad token, or a token on a vendor upload, is refused before anything is stored', async () => {
    const d = await draft('s1', PNG(1), GROUP); expect(store.rows.find((r) => r.id === d.id)!.groupToken).toBe(GROUP);
    expect(await codeOf(draft('s1', PNG(2), 'short'))).toMatchObject({ status: 422, code: 'UPLOAD_INVALID' });
    expect(await codeOf(svc.upload({ kind: 'VENDOR', vendorId: 'v1' }, staff('s1'), file(PNG(3)), 'x', GROUP))).toMatchObject({ code: 'UPLOAD_INVALID' }); expect(store.rows).toHaveLength(1);
  });
  it('attaches the staff member\'s drafts of that group to the listing: they leave the drafts, join the business library, keep their storage object, and the move is audited', async () => {
    await draft('s1', PNG(1), GROUP); await draft('s1', PNG(2), GROUP); await draft('s1', PNG(3), OTHER); await draft('s1', PNG(4));
    const r = await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' });
    expect(r).toMatchObject({ attached: 2, skipped: 0, alreadyAttached: 0 });
    expect(store.rows.filter((x) => x.scopeKey === 'vendor:v1')).toHaveLength(2); expect(store.rows.filter((x) => x.scopeKey === 'vendor:v1').every((x) => x.vendorId === 'v1' && x.ownerKind === 'VENDOR_SITE')).toBe(true);
    expect((await svc.list({ kind: 'DRAFT', staffId: 's1' })).total).toBe(2);   // the other group and the ungrouped draft stay draft
    expect((await svc.list({ kind: 'VENDOR', vendorId: 'v1' })).total).toBe(2); expect((await svc.list({ kind: 'VENDOR', vendorId: 'v2' })).total).toBe(0);
    expect(storage.files.size).toBe(4); expect(activity).toContain('media.attached');
  });
  it('is idempotent: a second call moves nothing and says what is already there', async () => {
    await draft('s1', PNG(1), GROUP); await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' });
    activity.length = 0; const again = await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' });
    expect(again).toMatchObject({ attached: 0, skipped: 0, alreadyAttached: 1, items: [] }); expect(activity).toEqual([]); expect(store.rows).toHaveLength(1);
  });
  it('is tenant safe: another staff member with the same token moves nothing, a token alone moves nothing for another listing, and an unknown or removed listing is a 404', async () => {
    await draft('s1', PNG(1), GROUP);
    expect(await svc.attachGroup(GROUP, staff('s2'), { seededSiteId: 'seed1' })).toMatchObject({ attached: 0, alreadyAttached: 0 }); expect(store.rows[0].scopeKey).toBe('draft:s1');
    await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' });
    expect(await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed2' })).toMatchObject({ attached: 0, alreadyAttached: 0 }); expect(store.rows[0].vendorId).toBe('v1');   // already attached to the first listing: it cannot be taken to another
    expect(await codeOf(svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'nope' }))).toMatchObject({ status: 404, code: 'UPLOAD_LISTING_NOT_FOUND' });
    expect(await codeOf(svc.attachGroup('short', staff('s1'), { seededSiteId: 'seed1' }))).toMatchObject({ code: 'UPLOAD_INVALID' });
    expect(await codeOf(svc.attachGroup(GROUP, { type: 'VENDOR', id: 'v1', ip: null }, { seededSiteId: 'seed1' }))).toMatchObject({ code: 'UPLOAD_NOT_FOUND' });   // a vendor never attaches
  });
  it('a file the business already has is not copied: the draft is dropped (and its stored object removed) and counted as skipped', async () => {
    await svc.upload({ kind: 'VENDOR', vendorId: 'v1' }, staff('s1'), file(PNG(1)), 'Already there'); await draft('s1', PNG(1), GROUP); await draft('s1', PNG(2), GROUP);
    const r = await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' });
    expect(r).toMatchObject({ attached: 1, skipped: 1 }); expect(store.rows.filter((x) => x.scopeKey === 'vendor:v1' && x.status === 'ACTIVE')).toHaveLength(2); expect(storage.files.size).toBe(2);
  });
  it('the same file uploaded again under a new group follows the new group', async () => {
    await draft('s1', PNG(1), GROUP); await draft('s1', PNG(1), OTHER); expect(store.rows).toHaveLength(1);
    expect(await svc.attachGroup(GROUP, staff('s1'), { seededSiteId: 'seed1' })).toMatchObject({ attached: 0 }); expect(await svc.attachGroup(OTHER, staff('s1'), { seededSiteId: 'seed1' })).toMatchObject({ attached: 1 });
  });
});

describe('the routes', () => {
  let app: INestApplication; let store: MemoryMediaUploadStore;
  const as = (r: string) => ({ 'x-test-role': r });
  beforeEach(async () => {
    store = new MemoryMediaUploadStore(); store.listings.set('seed1', 'v1');
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [AdminMediaUploadController],
      providers: [throttlerGuardProvider, AdminGuard, { provide: MediaUploadStore, useValue: store }, { provide: MediaStoragePort, useValue: new FakeMediaStorage() }, { provide: ImagePort, useValue: new FakeImagePort() }, { provide: StorageSettingsService, useValue: { get: async () => caps } }, MediaUploadService],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const r = req.headers['x-test-role']; if (r) req.user = { sub: `staff-${r}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: r }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('SALES uploads a draft under a group and attaches it to the listing; SUPPORT may not; a bad token is a 400/422', async () => {
    const up = await request(app.getHttpServer()).post('/v3/admin/media/drafts').set(as('MARKETING')).field('alt', 'Front').field('group', GROUP).attach('file', PNG(1), { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect((await request(app.getHttpServer()).post('/v3/admin/seeded-sites/seed1/media/attach').set(as('SUPPORT')).send({ group: GROUP })).status).toBe(403);
    const ok = await request(app.getHttpServer()).post('/v3/admin/seeded-sites/seed1/media/attach').set(as('MARKETING')).send({ group: GROUP });
    expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ attached: 1, skipped: 0, alreadyAttached: 0 }); expect(store.rows[0]).toMatchObject({ vendorId: 'v1', scopeKey: 'vendor:v1' });
    expect((await request(app.getHttpServer()).post('/v3/admin/seeded-sites/seed1/media/attach').set(as('MARKETING')).send({ group: GROUP })).body.data).toMatchObject({ attached: 0, alreadyAttached: 1 });
    expect((await request(app.getHttpServer()).post('/v3/admin/seeded-sites/seed1/media/attach').set(as('MARKETING')).send({ group: 'x' })).status).toBe(422);
    expect((await request(app.getHttpServer()).post('/v3/admin/media/drafts').set(as('MARKETING')).field('alt', 'x').field('group', 'bad').attach('file', PNG(2), { filename: 'a.png', contentType: 'image/png' })).status).toBe(422);
  });
});

describe('create on behalf with an upload group', () => {
  it('attaches the group to the new listing in the same call; where the media module is absent the listing is still made', async () => {
    const w = seededWorld(); const store = new MemoryMediaUploadStore();
    store.vendorOfListing = async (id: string) => [...w.store.rows.values()].find((r) => r.id === id)?.vendorId ?? null;
    const media = new MediaUploadService(store, new FakeMediaStorage(), new FakeImagePort(), { get: async () => caps } as unknown as StorageSettingsService);
    await media.upload({ kind: 'DRAFT', staffId: 'staff-1' }, staff('staff-1'), file(PNG(7)), 'Front', GROUP);
    const ctrl = new SeededAdminController(w.svc, {} as never, { get: (c: unknown) => { if (c === MediaUploadService) return media; throw new Error('absent'); } } as unknown as ModuleRef);
    const user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' }; const req = { ip: null } as never;
    const body = { businessName: 'Ranjith Plumber', category: 'plumber', city: 'Kochi', area: 'Aluva', phone: '9811111111', sourceKind: 'FIELD_VISIT', publicFactsOnly: true };
    const out = await ctrl.create({ ...body, uploadGroup: GROUP } as never, user, req) as unknown as { uploads: { attached: number } };
    expect(out.uploads).toMatchObject({ attached: 1 }); const vendorId = [...w.store.rows.values()][0].vendorId; expect((await media.list({ kind: 'VENDOR', vendorId })).total).toBe(1);
    const noMedia = new SeededAdminController(w.svc, {} as never, { get: () => { throw new Error('absent'); } } as unknown as ModuleRef);
    const plain = await noMedia.create({ ...body, businessName: 'Plain Plumber', phone: '9822222222', uploadGroup: OTHER } as never, user, req) as unknown as { uploads?: unknown };
    expect(plain.uploads).toBeUndefined(); expect(w.store.rows.size).toBe(2); expect(ops.role).toBe('OPERATIONS');
  });
});
