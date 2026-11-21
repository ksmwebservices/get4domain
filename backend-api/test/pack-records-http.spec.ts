import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { MePackRecordsController } from '../src/v3-pack-records/api/pack-records.controller';
import { PackRecordsTabGuard } from '../src/v3-pack-records/pack-records.guard';
import { PackRecordsService } from '../src/v3-pack-records/pack-records.service';
import { PackRecordStore, PackTabFieldStore } from '../src/v3-pack-records/pack-records.store';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { FakeEntitlements, makeEngine, MemoryRefStore } from './support/pack-fakes';
import { MemoryRecordStore, seededFieldStore } from './support/memory-pack-records-store';

/**
 * Pack records (Wave 2 Part A) over HTTP with the real guards, pipe, filter and interceptor and the real pack engine over the in-memory stores. Vendor A (paid, Professional) and vendor B (Free trial) are
 * different tenants throughout.
 */
jest.setTimeout(180_000);

describe('pack records over HTTP', () => {
  let app: INestApplication; let plans: FakeEntitlements; let svc: PackEngineService; let refs: MemoryRefStore; let records: MemoryRecordStore;
  const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });
  const as = (p: string) => ({ 'x-test-principal': p });
  const base = (pack: string, tab: string) => `/v3/me/packs/${pack}/tabs/${tab}`;
  const get = (url: string, p: string) => request(app.getHttpServer()).get(url).set(as(p));
  const send = (m: 'post' | 'put', url: string, p: string, body: object = {}) => request(app.getHttpServer())[m](url).set(as(p)).send(body);
  let pack = ''; let tab = '';

  beforeEach(async () => {
    const e = await makeEngine(); plans = e.plans; svc = e.svc; refs = e.refs;
    plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); plans.states.set('b', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    await svc.register('a', { categoryKey: 'plumber' }, owner('a')); await svc.register('b', { categoryKey: 'plumber' }, owner('b'));
    const nav = await svc.navigation('a');
    const t = nav.tabs.find((x) => x.scope === 'PACK' && x.state === 'ACTIVE' && x.key === 'jobs') ?? nav.tabs.find((x) => x.scope === 'PACK' && x.state === 'ACTIVE')!;
    pack = t.ownerKey; tab = t.key;
    records = new MemoryRecordStore();
    const fields = seededFieldStore([...refs.tabs.values()]);
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MePackRecordsController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, PackRecordsTabGuard, PackRecordsService,
        { provide: PackEngineService, useValue: svc }, { provide: PackTabFieldStore, useValue: fields }, { provide: PackRecordStore, useValue: records },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'a', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'b', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'member-a') req.user = { sub: 'a', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['website'] };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  const job = { title: 'Fix kitchen tap', customer: 'Asha', phone: '+91 98765 43210', scheduled_at: '2026-11-20T10:00:00+05:30', address: 'Flat 4, Park Road', note: 'Bring a washer' };

  it('has a pack tab to test with and the registered error codes', () => {
    expect(pack).toBeTruthy(); expect(tab).toBeTruthy();
    for (const c of ['PACK_RECORD_INVALID', 'PACK_RECORD_NOT_FOUND', 'PACK_TAB_NO_RECORDS', 'PACK_TAB_OWNER_ONLY', 'TAB_LOCKED']) expect(BUSINESS_ERROR_CODES).toContain(c);
  });

  describe('schema', () => {
    it('serves the form: fields in order, money marked as paise before GST, list columns, statuses', async () => {
      const r = await get(`${base(pack, tab)}/schema`, 'owner-a');
      expect(r.status).toBe(200);
      expect(r.body.data.fields.length).toBeGreaterThan(2); expect(r.body.data.statuses).toEqual(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']); expect(r.body.data.locked).toBe(false);
      const m = (r.body.data.fields as Array<{ type: string; unit?: string; taxNote?: string }>).find((f) => f.type === 'money');
      if (m) expect(m).toMatchObject({ unit: 'MINOR', taxNote: 'Before GST' });
    });
    it('a tab with no record store answers PACK_TAB_NO_RECORDS (a COMMON tab with its own contract)', async () => {
      const r = await get(`${base('COMMON', 'website')}/schema`, 'owner-a');
      expect(r.status).toBe(404); expect(r.body.code ?? r.body.error?.code ?? JSON.stringify(r.body)).toContain('PACK_TAB_NO_RECORDS');
    });
  });

  describe('create, read, update, archive, restore', () => {
    it('round trips a record and derives the title from the first required text field', async () => {
      const c = await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job });
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ packKey: pack, tabKey: tab, status: 'OPEN', title: 'Fix kitchen tap', archived: false });
      expect(c.body.data.data.phone).toBe('+919876543210'); expect(c.body.data.data.scheduled_at).toBe('2026-11-20T04:30:00.000Z');
      const id = c.body.data.id as string;
      expect((await get(`${base(pack, tab)}/records/${id}`, 'owner-a')).body.data.id).toBe(id);
      const u = await send('put', `${base(pack, tab)}/records/${id}`, 'owner-a', { data: { note: 'Washer fitted' }, status: 'DONE' });
      expect(u.status).toBe(200); expect(u.body.data).toMatchObject({ status: 'DONE', title: 'Fix kitchen tap' }); expect(u.body.data.data.note).toBe('Washer fitted'); expect(u.body.data.data.customer).toBe('Asha');
      const list = await get(`${base(pack, tab)}/records?status=DONE`, 'owner-a');
      expect(list.body.data.items.map((x: { id: string }) => x.id)).toEqual([id]); expect(list.body.data.total).toBe(1); expect(list.body.data.locked).toBe(false);
      expect((await get(`${base(pack, tab)}/records?status=OPEN`, 'owner-a')).body.data.total).toBe(0);
    });
    it('search finds by a searchable field and pages', async () => {
      for (const t of ['Fix tap', 'Fix drain', 'Paint wall']) await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: { ...job, title: t } });
      const r = await get(`${base(pack, tab)}/records?q=fix&pageSize=1&page=2`, 'owner-a');
      expect(r.body.data.total).toBe(2); expect(r.body.data.items).toHaveLength(1); expect(r.body.data.page).toBe(2);
    });
    it('archive is a soft delete: gone from the list, listed with archived=true, still readable, restorable, never deleted', async () => {
      const id = (await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job })).body.data.id as string;
      const a = await send('post', `${base(pack, tab)}/records/${id}/archive`, 'owner-a'); expect(a.status).toBe(200); expect(a.body.data.archived).toBe(true);
      expect((await get(`${base(pack, tab)}/records`, 'owner-a')).body.data.total).toBe(0);
      expect((await get(`${base(pack, tab)}/records?archived=true`, 'owner-a')).body.data.total).toBe(1);
      expect((await get(`${base(pack, tab)}/records/${id}`, 'owner-a')).body.data.archived).toBe(true);
      expect((await send('put', `${base(pack, tab)}/records/${id}`, 'owner-a', { data: { note: 'x' } })).status).toBe(404);   // an archived record is not edited until it is restored
      const r = await send('post', `${base(pack, tab)}/records/${id}/restore`, 'owner-a'); expect(r.body.data.archived).toBe(false);
      expect(records.rows.size).toBe(1);   // the row is still there throughout
      expect((await get(`${base(pack, tab)}/records`, 'owner-a')).body.data.total).toBe(1);
    });
  });

  describe('validation', () => {
    it('refuses unknown fields, wrong types, oversize values and markup, naming each field', async () => {
      const r = await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: { title: '<script>x</script>', customer: 'x'.repeat(300), phone: 'abc', hacked: 1, scheduled_at: 'soon' } });
      expect(r.status).toBe(400);
      const text = JSON.stringify(r.body); expect(text).toContain('PACK_RECORD_INVALID');
      const fields = r.body.data?.fields as Record<string, string>;
      for (const k of ['customer', 'hacked', 'phone', 'scheduled_at', 'title']) expect(text).toContain(`"${k}"`);   // the filter passes `details` through as data, so the screen learns which field to fix
      expect(Object.keys(fields).sort()).toEqual(['customer', 'hacked', 'phone', 'scheduled_at', 'title']);
      expect(records.rows.size).toBe(0);
    });
    it('a required field is required, and a bad status is refused', async () => {
      expect((await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: { note: 'no title' } })).status).toBe(400);
      expect((await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job, status: 'ARCHIVED' })).status).toBe(400);
      expect((await get(`${base(pack, tab)}/records?status=NOPE`, 'owner-a')).status).toBe(400);
    });
    it('money is stored as a whole number of paise and a decimal or string is refused', async () => {
      const t = (await svc.navigation('a')).tabs.find((x) => x.scope === 'PACK' && x.state === 'ACTIVE' && x.key === 'quotes');
      if (!t) return;   // the pack under test has no quotes tab
      const ok = await send('post', `${base(t.ownerKey, 'quotes')}/records`, 'owner-a', { data: { customer_name: 'Asha', amount: 250000 } });
      expect(ok.status).toBe(200); expect(ok.body.data.data.amount).toBe(250000);
      expect((await send('post', `${base(t.ownerKey, 'quotes')}/records`, 'owner-a', { data: { customer_name: 'Asha', amount: 2500.5 } })).status).toBe(400);
      expect((await send('post', `${base(t.ownerKey, 'quotes')}/records`, 'owner-a', { data: { customer_name: 'Asha', amount: '2500' } })).status).toBe(400);
    });
  });

  describe('tenant isolation', () => {
    it('vendor B cannot read, change, archive or list vendor A records, even by guessing the id', async () => {
      const id = (await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job })).body.data.id as string;
      plans.states.set('b', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); svc['entitlements'].invalidate?.('b');
      expect((await get(`${base(pack, tab)}/records`, 'owner-b')).body.data.total).toBe(0);
      expect((await get(`${base(pack, tab)}/records/${id}`, 'owner-b')).status).toBe(404);
      expect((await send('put', `${base(pack, tab)}/records/${id}`, 'owner-b', { data: { note: 'stolen' } })).status).toBe(404);
      expect((await send('post', `${base(pack, tab)}/records/${id}/archive`, 'owner-b')).status).toBe(404);
      expect(records.rows.get(id)!.data.note).toBe('Bring a washer'); expect(records.rows.get(id)!.deletedAt).toBeNull();
    });
    it('the vendor comes from the principal: a vendorId in the body is refused', async () => {
      const r = await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job, vendorId: 'b' });
      expect(r.status).toBe(400); expect(records.rows.size).toBe(0);
    });
    it('a record of one pack tab cannot be read through another tab path', async () => {
      const id = (await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job })).body.data.id as string;
      const other = (await svc.navigation('a')).tabs.find((x) => x.scope === 'PACK' && x.state === 'ACTIVE' && x.key !== tab)!;
      expect((await get(`${base(other.ownerKey, other.key)}/records/${id}`, 'owner-a')).status).toBe(404);
    });
  });

  describe('locked tabs and paused plans', () => {
    it('a locked preview (Free trial) can be read but never written', async () => {
      const schema = await get(`${base(pack, tab)}/schema`, 'owner-b'); expect(schema.status).toBe(200); expect(schema.body.data.locked).toBe(true);
      const list = await get(`${base(pack, tab)}/records`, 'owner-b'); expect(list.status).toBe(200); expect(list.body.data.locked).toBe(true); expect(list.body.data.lock.reason).toBe('FREE_TRIAL');
      const w = await send('post', `${base(pack, tab)}/records`, 'owner-b', { data: job });
      expect(w.status).toBe(403); expect(JSON.stringify(w.body)).toContain('TAB_LOCKED'); expect(records.rows.size).toBe(0);
    });
    it('a paused plan keeps its records readable and refuses every write; resuming opens it again', async () => {
      const id = (await send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job })).body.data.id as string;
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
      const list = await get(`${base(pack, tab)}/records`, 'owner-a'); expect(list.status).toBe(200); expect(list.body.data.total).toBe(1); expect(list.body.data.lock.reason).toBe('PLAN_PAUSED');
      const writes: Array<() => request.Test> = [
        () => send('post', `${base(pack, tab)}/records`, 'owner-a', { data: job }),
        () => send('put', `${base(pack, tab)}/records/${id}`, 'owner-a', { data: { note: 'x' } }),
        () => send('post', `${base(pack, tab)}/records/${id}/archive`, 'owner-a'),
      ];
      for (const w of writes) { const r = await w(); expect(r.status).toBe(403); expect(JSON.stringify(r.body)).toContain('TAB_LOCKED'); }
      expect(records.rows.get(id)!.data.note).toBe('Bring a washer'); expect(records.rows.get(id)!.deletedAt).toBeNull();
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
      expect((await send('put', `${base(pack, tab)}/records/${id}`, 'owner-a', { data: { note: 'y' } })).status).toBe(200);
    });
    it('a tab the vendor does not have (another pack) is refused even for a read', async () => {
      const r = await get(`${base('CLINIC', 'patients')}/records`, 'owner-a');
      expect(r.status).toBe(403); expect(JSON.stringify(r.body)).toContain('TAB_LOCKED');
    });
    it('a made-up tab is refused', async () => {
      expect((await get(`${base(pack, 'no_such_tab')}/records`, 'owner-a')).status).toBe(403);
    });
  });

  describe('team members', () => {
    it('may use a work tab but not an owner-only tab', async () => {
      expect((await get(`${base(pack, tab)}/records`, 'member-a')).status).toBe(200);
      const money = (await svc.navigation('a')).tabs.find((x) => x.scope === 'PACK' && x.key === 'amc_contracts');
      if (money) { const r = await get(`${base(money.ownerKey, money.key)}/records`, 'member-a'); expect(r.status).toBe(403); expect(JSON.stringify(r.body)).toContain('PACK_TAB_OWNER_ONLY'); }
    });
    it('the record shows who wrote it', async () => {
      const r = await send('post', `${base(pack, tab)}/records`, 'member-a', { data: job });
      expect(r.status).toBe(200); expect(records.rows.get(r.body.data.id)!.createdByType).toBe('TEAM_MEMBER'); expect(records.rows.get(r.body.data.id)!.createdById).toBe('m1');
    });
  });
});
