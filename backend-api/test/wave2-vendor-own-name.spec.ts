import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { SEEDED_OWNER_PLACEHOLDER, parseBusinessInput } from '../src/provisioning/steps/business-input';
import { AdminGapsController } from '../src/v3-admin-gaps/api/admin-gaps.controllers';
import { AdminGapsService } from '../src/v3-admin-gaps/admin-gaps.service';
import { AdminGapsStore, AdminVendorRow } from '../src/v3-admin-gaps/admin-gaps.store';
import { ownNameOf } from '../src/v3-admin-gaps/core/admin-gaps-core';

/** Job K4: the vendors list row names the vendor's OWN name in `name`, and the business in `businessName`; a name that is only a placeholder or a copy of the business name is null. */
jest.setTimeout(120_000);

describe('ownNameOf (pure)', () => {
  it('a person\'s name on its own is kept (trimmed, inner spaces tidied)', () => {
    expect(ownNameOf('Asha Rao', 'Asha Plumbing')).toBe('Asha Rao'); expect(ownNameOf('  Ganesh   Kumar ', 'Sri Ganesh Plumbing')).toBe('Ganesh Kumar'); expect(ownNameOf('Meena', 'Meena Sweets')).toBe('Meena');
  });
  it('null when nothing tells the person from the business: empty, the seeded placeholder, or a copy of the business name', () => {
    for (const n of ['', '   ', null, undefined, 5, {}]) expect(ownNameOf(n, 'Asha Plumbing')).toBeNull();
    expect(ownNameOf(SEEDED_OWNER_PLACEHOLDER, 'Asha Plumbing')).toBeNull(); expect(ownNameOf('business  OWNER', 'Asha Plumbing')).toBeNull();
    expect(ownNameOf('Asha Plumbing', 'Asha Plumbing')).toBeNull(); expect(ownNameOf(' asha  plumbing ', 'Asha Plumbing')).toBeNull();
  });
  it('the business name being unknown does not hide a real name', () => { expect(ownNameOf('Asha Rao', null)).toBe('Asha Rao'); expect(ownNameOf('Asha Rao', undefined)).toBe('Asha Rao'); });
  it('the placeholder is the one the seeded provisioning really gives an owner-less business', () => {
    const b = parseBusinessInput({ mode: 'SEEDED', businessName: 'Sri Ganesh Plumbing', track: 'handyman', category: 'plumber', phone: '9811111111', placeholderEmail: 'site+x@sites.get4domain.invalid', city: 'Chennai', language: 'en' });
    expect(b.ownerName).toBe(SEEDED_OWNER_PLACEHOLDER); expect(ownNameOf(b.ownerName, b.businessName)).toBeNull();
  });
});

describe('the vendors list row over HTTP', () => {
  const row = (over: Partial<AdminVendorRow>): AdminVendorRow => ({ id: 'v1', name: 'Asha Rao', businessName: 'Asha Plumbing', email: 'a@x.invalid', phone: '+919800000001', industry: 'plumber', status: 'ACTIVE', subdomain: 'asha', createdAt: new Date('2026-11-01T00:00:00Z'), plan: null, listingState: null, ...over });
  class MemoryAdminStore extends AdminGapsStore {
    vendors: AdminVendorRow[] = [];
    async listVendors() { return { items: this.vendors, total: this.vendors.length }; }
    async vendorExists() { return true; } async heldCount() { return 0; } async listNotes() { return { items: [], total: 0 }; } async addNote(): Promise<never> { throw new Error('unused'); } async staffName() { return null; }
  }
  let app: INestApplication; let store: MemoryAdminStore;
  beforeEach(async () => {
    store = new MemoryAdminStore();
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [AdminGapsController], providers: [throttlerGuardProvider, AdminGuard, { provide: AdminGapsService, useFactory: () => new AdminGapsService(store, undefined) }] }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const r = req.headers['x-test-role']; if (r) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: r }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
  });
  afterEach(async () => { await app.close(); });
  const list = async () => (await request(app.getHttpServer()).get('/v3/admin/vendors').set({ 'x-test-role': 'OPERATIONS' })).body.data.items as Array<Record<string, unknown>>;

  it('a business with its owner on record: name is the person, businessName is the business, both on the row', async () => {
    store.vendors = [row({})]; const [r] = await list(); expect(r).toMatchObject({ id: 'v1', name: 'Asha Rao', businessName: 'Asha Plumbing' });
  });
  it('a seeded business nobody has claimed (placeholder owner), and one whose name is only the business name: name is null, businessName still there; nothing is invented', async () => {
    store.vendors = [row({ id: 'v2', name: 'Business owner', businessName: 'Sri Ganesh Plumbing' }), row({ id: 'v3', name: 'Moon Traders', businessName: 'Moon Traders' })];
    const rows = await list(); expect(rows.map((r) => [r.id, r.name, r.businessName])).toEqual([['v2', null, 'Sri Ganesh Plumbing'], ['v3', null, 'Moon Traders']]);
  });
  it('the other fields of the row are untouched (plan, listing state, contact, dates) and the same row shape comes back for every row', async () => {
    store.vendors = [row({ plan: { key: 'handyman_pro', name: 'Pro', level: 'PRO', track: 'HANDYMAN', status: 'ACTIVE' }, listingState: 'LIVE' }), row({ id: 'v2', name: 'Business owner' })];
    const rows = await list(); expect(rows[0]).toMatchObject({ plan: { key: 'handyman_pro', level: 'PRO' }, listingState: 'LIVE', email: 'a@x.invalid', phone: '+919800000001', subdomain: 'asha', createdAt: '2026-11-01T00:00:00.000Z' });
    expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rows[1]).sort());
  });
  it('the route is still for OPERATIONS, ADMIN and SUPER_ADMIN only', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']) expect([role, (await request(app.getHttpServer()).get('/v3/admin/vendors').set({ 'x-test-role': role })).status]).toEqual([role, 200]);
    for (const role of ['MARKETING', 'SUPPORT']) expect([role, (await request(app.getHttpServer()).get('/v3/admin/vendors').set({ 'x-test-role': role })).status]).toEqual([role, 403]);
  });
});
