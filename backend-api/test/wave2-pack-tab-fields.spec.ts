import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { AdminPackTabFieldsController } from '../src/v3-pack-records/api/pack-tab-fields-admin.controller';
import { PackRecordsService } from '../src/v3-pack-records/pack-records.service';
import { PackTabFieldsAdminService } from '../src/v3-pack-records/pack-tab-fields-admin.service';
import { PackTabFieldStore } from '../src/v3-pack-records/pack-records.store';
import { loadedRefStore } from './support/pack-fakes';
import { MemoryRecordStore, seededFieldStore } from './support/memory-pack-records-store';

/** Wave 2 Part G (3): staff edit the record fields of a pack tab. ADMIN and SUPER_ADMIN, audited, role matrix as data; nothing deleted, a type frozen once records exist. */
jest.setTimeout(120_000);
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; details?: { fields?: Record<string, string> } }> => { try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; details?: never }; return { status: e.getStatus(), code: b.code, details: b.details }; } throw e; } throw new Error('expected a refusal'); };

describe('pack tab record fields, edited by staff', () => {
  let fields: PackTabFieldStore; let records: MemoryRecordStore; let svc: PackTabFieldsAdminService; let activity: Array<{ actionKey: string; vendorId: unknown }>;
  const staff = { id: 'staff-1', ip: null };
  beforeEach(async () => {
    const refs = await loadedRefStore(); fields = seededFieldStore([...refs.tabs.values()]); records = new MemoryRecordStore(); activity = [];
    svc = new PackTabFieldsAdminService(fields, records, { adminTabs: async () => [...refs.tabs.values()] } as unknown as PackEngineService, { record: async (i: { actionKey: string; vendorId: unknown }) => { activity.push(i); return null; } } as never);
  });
  const J = { ownerKey: 'FIELD_SERVICE', tabKey: 'jobs' };

  it('lists the fields of a tab, hidden ones too, with the types on offer', async () => {
    const r = await svc.list(J.ownerKey, J.tabKey);
    expect(r.fields.length).toBeGreaterThan(3); expect(r.types).toContain('money'); expect(r.fields.every((f) => f.active)).toBe(true);
  });
  it('adds a field, audited, and a business\'s schema picks it up at once', async () => {
    const f = await svc.edit({ ...J, fieldKey: 'warranty_note', label: 'Warranty note', type: 'text', listColumn: true, searchable: true }, staff);
    expect(f).toMatchObject({ key: 'warranty_note', type: 'text', required: false, active: true, listColumn: true }); expect(activity).toEqual([{ actionKey: 'pack.tab_field_edited', vendorId: null, actor: expect.anything(), entityType: 'pack_tab_field', entityId: 'FIELD_SERVICE:jobs:warranty_note', summary: expect.objectContaining({ created: true }) }]);
    const recs = new PackRecordsService(fields, records);
    expect((await recs.schema(J.ownerKey, J.tabKey, { locked: false })).fields.map((x) => x.key)).toContain('warranty_note');
    const made = await recs.create('v1', J.ownerKey, J.tabKey, { data: { title: 'Fix tap', warranty_note: 'One year parts' } }, { type: 'VENDOR', id: 'v1' }, { locked: false }); expect(made.data.warranty_note).toBe('One year parts');
  });
  it('changes a label, order and the switches; an edit keeps what it does not name', async () => {
    const before = (await svc.list(J.ownerKey, J.tabKey)).fields.find((f) => f.key === 'title')!;
    const f = await svc.edit({ ...J, fieldKey: 'title', label: 'Job title', type: before.type }, staff);
    expect(f).toMatchObject({ label: 'Job title', required: false, sortOrder: before.sortOrder, listColumn: before.listColumn, searchable: before.searchable }); expect(activity[0]).toMatchObject({ actionKey: 'pack.tab_field_edited' });
  });
  it('hiding a field is the only removal: it leaves the form and stops being required, and a record keeps its value', async () => {
    const recs = new PackRecordsService(fields, records);
    const old = await recs.create('v1', J.ownerKey, J.tabKey, { data: { title: 'Old job', note: 'kept' } }, { type: 'VENDOR', id: 'v1' }, { locked: false });
    await svc.edit({ ...J, fieldKey: 'note', label: 'Note', type: 'longtext', active: false }, staff);
    expect((await svc.list(J.ownerKey, J.tabKey)).fields.find((f) => f.key === 'note')!.active).toBe(false);
    expect((await recs.schema(J.ownerKey, J.tabKey, { locked: false })).fields.map((x) => x.key)).not.toContain('note');
    expect((await recs.get('v1', J.ownerKey, J.tabKey, old.id)).data.note).toBe('kept');
    expect((await svc.edit({ ...J, fieldKey: 'note', label: 'Note', type: 'longtext', active: true }, staff)).active).toBe(true);   // and it comes back
  });
  it('a type is not changed once any business has records on the tab; with none it can be', async () => {
    const t = await svc.edit({ ...J, fieldKey: 'scratch', label: 'Scratch', type: 'text' }, staff);
    expect((await svc.edit({ ...J, fieldKey: 'scratch', label: 'Scratch', type: 'number' }, staff)).type).toBe('number'); expect(t.type).toBe('text');
    await new PackRecordsService(fields, records).create('v1', J.ownerKey, J.tabKey, { data: { title: 'A job' } }, { type: 'VENDOR', id: 'v1' }, { locked: false });
    expect(await codeOf(svc.edit({ ...J, fieldKey: 'scratch', label: 'Scratch', type: 'text' }, staff))).toMatchObject({ status: 409, code: 'PACK_FIELD_IN_USE' });
    expect((await svc.edit({ ...J, fieldKey: 'scratch', label: 'Renamed scratch', type: 'number' }, staff)).label).toBe('Renamed scratch');   // a label is still free to change
  });
  it('refuses a bad field naming each problem: key, type, label with markup, choices missing, order, switches', async () => {
    const e = await codeOf(svc.edit({ ...J, fieldKey: 'Bad Key', label: '<b>x</b>', type: 'blob', sortOrder: -1, required: 'yes' }, staff));
    expect(e).toMatchObject({ status: 400, code: 'PACK_FIELD_INVALID' }); expect(Object.keys(e.details!.fields!).sort()).toEqual(['_', 'fieldKey', 'required', 'sortOrder', 'type']);
    expect((await codeOf(svc.edit({ ...J, fieldKey: 'pick', label: 'Pick', type: 'select' }, staff))).details!.fields!._).toContain('choices');
    expect((await svc.edit({ ...J, fieldKey: 'pick', label: 'Pick', type: 'select', options: ['A', 'B'] }, staff)).options).toEqual(['A', 'B']);
  });
  it('a tab has one status field and at most forty fields', async () => {
    await svc.edit({ ...J, fieldKey: 'stage', label: 'Stage', type: 'status' }, staff);
    expect(await codeOf(svc.edit({ ...J, fieldKey: 'stage2', label: 'Stage 2', type: 'status' }, staff))).toMatchObject({ code: 'PACK_FIELD_INVALID' });
    const have = (await svc.list(J.ownerKey, J.tabKey)).fields.length;
    for (let i = have; i < 40; i++) await svc.edit({ ...J, fieldKey: `extra_${i}`, label: `Extra ${i}`, type: 'text' }, staff);
    expect(await codeOf(svc.edit({ ...J, fieldKey: 'one_too_many', label: 'One too many', type: 'text' }, staff))).toMatchObject({ code: 'PACK_FIELD_INVALID' });
  });
  it('only a real record tab can be edited: an unknown tab, another pack\'s tab key and a COMMON tab with its own contract are a plain 404', async () => {
    expect(await codeOf(svc.list('FIELD_SERVICE', 'nope'))).toMatchObject({ status: 404, code: 'PACK_TAB_UNKNOWN' });
    expect(await codeOf(svc.edit({ ownerKey: 'CLINIC', tabKey: 'jobs', fieldKey: 'x', label: 'X', type: 'text' }, staff))).toMatchObject({ code: 'PACK_TAB_UNKNOWN' });
    expect(await codeOf(svc.edit({ ownerKey: 'COMMON', tabKey: 'website', fieldKey: 'x', label: 'X', type: 'text' }, staff))).toMatchObject({ code: 'PACK_TAB_UNKNOWN' });
    expect(activity).toEqual([]);
  });
  it('the new error codes are registered', () => { expect(BUSINESS_ERROR_CODES).toEqual(expect.arrayContaining(['PACK_FIELD_INVALID', 'PACK_FIELD_IN_USE', 'PACK_TAB_UNKNOWN'])); });

  describe('over HTTP with the real AdminGuard', () => {
    let app: INestApplication; const as = (r: string) => ({ 'x-test-role': r });
    beforeEach(async () => {
      const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [AdminPackTabFieldsController], providers: [throttlerGuardProvider, AdminGuard, { provide: PackTabFieldsAdminService, useValue: svc }] }).compile();
      app = mod.createNestApplication();
      app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const r = req.headers['x-test-role']; if (r) req.user = { sub: `staff-${r}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: r }; next(); });
      app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    });
    afterEach(async () => { await app.close(); });
    it('ADMIN and SUPER_ADMIN edit; OPERATIONS may only read; SALES and SUPPORT are refused', async () => {
      const body = { ...J, fieldKey: 'warranty_note', label: 'Warranty note', type: 'text' };
      for (const role of ['ADMIN', 'SUPER_ADMIN']) expect((await request(app.getHttpServer()).put('/v3/admin/pack-engine/tab-fields').set(as(role)).send(body)).status).toBe(200);
      for (const role of ['OPERATIONS', 'MARKETING', 'SUPPORT']) expect((await request(app.getHttpServer()).put('/v3/admin/pack-engine/tab-fields').set(as(role)).send(body)).status).toBe(403);
      for (const role of ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS']) expect((await request(app.getHttpServer()).get('/v3/admin/pack-engine/tab-fields?ownerKey=FIELD_SERVICE&tabKey=jobs').set(as(role))).status).toBe(200);
      for (const role of ['MARKETING', 'SUPPORT']) expect((await request(app.getHttpServer()).get('/v3/admin/pack-engine/tab-fields?ownerKey=FIELD_SERVICE&tabKey=jobs').set(as(role))).status).toBe(403);
    });
    it('a bad field comes back with each problem named in the error data; a type change over records is a 409', async () => {
      const bad = await request(app.getHttpServer()).put('/v3/admin/pack-engine/tab-fields').set(as('ADMIN')).send({ ...J, fieldKey: 'Bad Key', label: 'x', type: 'text' });
      expect(bad.status).toBe(400); expect(JSON.stringify(bad.body)).toContain('PACK_FIELD_INVALID'); expect(bad.body.data.fields.fieldKey).toBeDefined();
      await new PackRecordsService(fields, records).create('v1', J.ownerKey, J.tabKey, { data: { title: 'A job' } }, { type: 'VENDOR', id: 'v1' }, { locked: false });
      const t = await request(app.getHttpServer()).put('/v3/admin/pack-engine/tab-fields').set(as('ADMIN')).send({ ...J, fieldKey: 'title', label: 'Title', type: 'number' });
      expect(t.status).toBe(409); expect(JSON.stringify(t.body)).toContain('PACK_FIELD_IN_USE');
    });
  });
});
