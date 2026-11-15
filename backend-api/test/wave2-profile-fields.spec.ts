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
import { AdminProfileController } from '../src/v3-profile-fields/api/profile.controllers';
import {
  buildProfileSeed, checkProfile, COMMON_FIELDS, PACK_FIELDS, PROFILE_PACKS, ProfileField, resolveMap, resolveSchema, SiteMapRow, toSiteOps,
} from '../src/v3-profile-fields/core/profile-core';
import { ProfileFieldsService } from '../src/v3-profile-fields/profile.service';
import { CategoryRef, ProfileFieldStore, ProfileValueStore } from '../src/v3-profile-fields/profile.store';
import { loadProfileFields } from '../src/v3-profile-fields/seed/profile-loader';
import { realSeed } from './support/pack-fakes';

/** Wave 2 Part E: the industry profile fields of the 16 packs, the map into the site content, the checks and the routes. Memory twins and a fake website; no database. */
jest.setTimeout(120_000);

const cats = realSeed().categories.map((c) => ({ categoryKey: c.categoryKey, packKey: c.packKey, fieldHints: c.fieldHints ?? [] }));
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; details?: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; details?: Record<string, unknown> }; return { status: e.getStatus(), code: b.code, details: b.details }; } throw e; }
  throw new Error('expected a refusal');
};

describe('the seed: all 16 packs and all 196 categories', () => {
  const seed = buildProfileSeed(cats);
  it('has no problems, covers every pack the catalog uses, and every category resolves to a schema', () => {
    expect(seed.problems).toEqual([]); expect(new Set(cats.map((c) => c.packKey))).toEqual(new Set(PROFILE_PACKS)); expect(cats).toHaveLength(196);
    for (const c of cats) { const s = resolveSchema(seed.fields, c.packKey, c.categoryKey); expect(s.length).toBeGreaterThanOrEqual(COMMON_FIELDS.length); }
  });
  it('every category carries the common set (business name, tagline, about, services, opening hours, address with locality and pincode, contact, social links, banner, gallery)', () => {
    const keys = resolveSchema(seed.fields, 'RETAIL', 'jewellery-shop').map((f) => f.fieldKey).concat(resolveSchema(seed.fields, 'RETAIL', '').map((f) => f.fieldKey));
    for (const k of ['business_name', 'tagline', 'about', 'services', 'opening_hours', 'address_line', 'locality', 'pincode', 'phone', 'email', 'social_instagram', 'banner_image', 'gallery_images']) expect(keys).toContain(k);
  });
  it('a pack\'s industry fields are inherited by all its categories; a category has fields of its own only where the catalog gave hints', () => {
    const withHints = cats.filter((c) => c.fieldHints.length > 0); const without = cats.filter((c) => c.fieldHints.length === 0);
    expect(withHints.length).toBeGreaterThan(100); expect(without.length).toBeGreaterThan(0);
    for (const c of without) expect(resolveSchema(seed.fields, c.packKey, c.categoryKey).every((f) => f.categorySlug === '')).toBe(true);
    const c = withHints[0]; const own = resolveSchema(seed.fields, c.packKey, c.categoryKey).filter((f) => f.categorySlug !== '');
    expect(own.length).toBeGreaterThan(0); expect(own.every((f) => f.fieldKey.startsWith('hint_'))).toBe(true);
    for (const pack of PROFILE_PACKS) for (const f of PACK_FIELDS[pack]) expect(resolveSchema(seed.fields, pack, '').some((x) => x.fieldKey === f[0])).toBe(true);
  });
  it('the examples in the brief are there: field service areas and call-out note, retail product categories and delivery note, clinic specialisations and doctors', () => {
    const k = (pack: string) => resolveSchema(seed.fields, pack, '').map((f) => f.fieldKey);
    expect(k('FIELD_SERVICE')).toEqual(expect.arrayContaining(['service_areas', 'callout_note'])); expect(k('RETAIL')).toEqual(expect.arrayContaining(['product_categories', 'delivery_note'])); expect(k('CLINIC')).toEqual(expect.arrayContaining(['specialisations', 'doctors']));
  });
  it('no label uses an internal product word or promises a timeframe, and no field is a price', () => {
    for (const f of seed.fields) { expect(f.label).not.toMatch(/workspace|\bbos\b|leadspace|\bleads?\b/i); expect(f.label).not.toMatch(/within \d|turnaround/i); expect(f.type).not.toBe('money'); }
  });
  it('every industry and category field goes to a map row; the common fields have their own rows', () => {
    for (const f of seed.fields.filter((x) => x.fieldKey !== 'business_name' && !COMMON_FIELDS.some((c) => c[0] === x.fieldKey))) expect(resolveMap(seed.maps, f.packKey, f.categorySlug, f.fieldKey)).not.toBeNull();
    for (const f of COMMON_FIELDS) expect(resolveMap(seed.maps, 'RETAIL', '', f[0])).not.toBeNull();
  });
  it('a category override replaces a pack field by key, and an inactive override hides it', () => {
    const rows: ProfileField[] = [
      { packKey: 'P', categorySlug: '', fieldKey: 'a', label: 'A', type: 'text', required: false, options: [], sortOrder: 10, siteSection: 'details', active: true },
      { packKey: 'P', categorySlug: '', fieldKey: 'b', label: 'B', type: 'text', required: false, options: [], sortOrder: 20, siteSection: 'details', active: true },
      { packKey: 'P', categorySlug: 'c1', fieldKey: 'a', label: 'A for c1', type: 'text', required: true, options: [], sortOrder: 10, siteSection: 'details', active: true },
      { packKey: 'P', categorySlug: 'c1', fieldKey: 'b', label: 'B', type: 'text', required: false, options: [], sortOrder: 20, siteSection: 'details', active: false },
    ];
    expect(resolveSchema(rows, 'P', 'c1').map((f) => [f.fieldKey, f.label, f.required])).toEqual([['a', 'A for c1', true]]); expect(resolveSchema(rows, 'P', 'c2').map((f) => f.fieldKey)).toEqual(['a', 'b']);
  });
  it('the most specific map row wins: the category, then the pack, then every business', () => {
    const m = (packKey: string, categorySlug: string, targetKey: string): SiteMapRow => ({ packKey, categorySlug, fieldKey: 'x', targetKind: 'FIELD', targetKey, itemMap: {}, active: true });
    const maps = [m('', '', 'all.x'), m('P', '', 'pack.x'), m('P', 'c1', 'cat.x')];
    expect(resolveMap(maps, 'P', 'c1', 'x')!.targetKey).toBe('cat.x'); expect(resolveMap(maps, 'P', 'c2', 'x')!.targetKey).toBe('pack.x'); expect(resolveMap(maps, 'Q', 'c3', 'x')!.targetKey).toBe('all.x'); expect(resolveMap(maps, 'Q', 'c3', 'nope')).toBeNull();
  });
});

describe('checking values', () => {
  const schema = resolveSchema(buildProfileSeed(cats).fields, 'FIELD_SERVICE', 'plumber');
  it('accepts good values and cleans them; the pincode, phone, links and lists are checked by type', () => {
    const r = checkProfile(schema, { business_name: '  Ranjith   Plumber ', phone: '+91 98765-43210', social_instagram: 'https://instagram.com/ranjith', service_areas: ['Aluva', 'Kakkanad', 'Aluva'], services: [{ name: 'Leak repair', description: 'Taps and pipes' }, { name: 'Bathroom fitting' }], gallery_images: [{ src: 'https://cdn.example/a.jpg', alt: 'A fitted bathroom' }] });
    expect(r.errors).toEqual({}); expect(r.value).toMatchObject({ business_name: 'Ranjith Plumber', phone: '+919876543210', service_areas: ['Aluva', 'Kakkanad'] }); expect((r.value.services as unknown[]).length).toBe(2);
  });
  it('refuses unknown fields, wrong types, markup and a gallery picture with no description, naming each', () => {
    const r = checkProfile(schema, { business_name: '<b>x</b>', mystery: 1, phone: 'abc', service_areas: 'Aluva', gallery_images: [{ src: 'http://cdn.example/a.jpg', alt: '' }], services: [{ name: 'x', price: 5 }] });
    expect(r.ok).toBe(false); expect(Object.keys(r.errors).sort()).toEqual(['business_name', 'gallery_images', 'mystery', 'phone', 'service_areas', 'services']);
  });
  it('refuses a price in free text (prices live in the price list, before GST) and wording that promises a result or a ranking', () => {
    const p = checkProfile(schema, { business_name: 'Ranjith Plumber', callout_note: 'Call-out charge Rs 500' }); expect(p.errors.callout_note).toContain('before GST');
    expect(checkProfile(schema, { business_name: 'Ranjith Plumber', tagline: 'Number one plumber in Kochi' }).errors.tagline).toContain('promises');
    expect(checkProfile(schema, { business_name: 'Ranjith Plumber', callout_note: '₹ 300 visiting charge' }).errors.callout_note).toBeDefined();
  });
  it('a required field must be present on the merged set; null clears an optional one and is refused on a required one', () => {
    expect(checkProfile(schema, {}).errors.business_name).toBeDefined();
    expect(checkProfile(schema, { tagline: null }, { business_name: 'R', tagline: 'Old' })).toMatchObject({ ok: true, value: { business_name: 'R' } });
    expect(checkProfile(schema, { business_name: null }, { business_name: 'R' }).errors.business_name).toBeDefined();
    const pharmacy = resolveSchema(buildProfileSeed(cats).fields, 'PHARMACY', ''); expect(checkProfile(pharmacy, { business_name: 'P' }).errors.drug_licence_number).toBeDefined();
  });
});

describe('mapping into the site content', () => {
  const seed = buildProfileSeed(cats); const schema = resolveSchema(seed.fields, 'FIELD_SERVICE', 'plumber');
  const values = { business_name: 'Ranjith Plumber', tagline: 'Plumbing for homes', about: 'We fix taps.', address_line: '12 Lake Road', locality: 'Aluva', city: 'Kochi', state: 'Kerala', pincode: '683101', phone: '+919876543210', social_instagram: 'https://instagram.com/r', banner_image: 'https://cdn.example/b.jpg', banner_image_alt: 'Our van', service_areas: ['Aluva', 'Kakkanad'], callout_note: 'Call-out charge is set per visit', gallery_images: [{ src: 'https://cdn.example/a.jpg', alt: 'Bathroom' }], opening_hours: 'Mon to Sat 9 to 6', services: [{ name: 'Leak repair' }] };
  const ops = toSiteOps(schema, seed.maps, values, 'FIELD_SERVICE', 'plumber');
  it('writes the mapped fields, composes the address from its parts, and leaves the unmapped ones on the profile only', () => {
    const f = Object.fromEntries(ops.filter((o) => o.kind === 'field').map((o) => [(o as { key: string }).key, (o as { value: string }).value]));
    expect(f).toMatchObject({ 'site.tagline': 'Plumbing for homes', 'about.text': 'We fix taps.', 'contact.address': '12 Lake Road, Aluva, Kochi, Kerala, 683101', 'contact.phone': '+919876543210', 'social.instagram': 'https://instagram.com/r', 'hero.image': 'https://cdn.example/b.jpg', 'hero.imageAlt': 'Our van' });
    expect(Object.keys(f)).not.toContain('contact.city'); expect(JSON.stringify(ops)).not.toContain('Mon to Sat');   // opening hours: free text only on the site today, so they stay on the profile
  });
  it('adds every industry field to ONE credentials list (a list write replaces the list) and the gallery to the gallery list', () => {
    const lists = ops.filter((o) => o.kind === 'list') as Array<{ name: string; items: Array<Record<string, string>> }>;
    expect(lists.map((l) => l.name).sort()).toEqual(['credentials', 'gallery']);
    expect(lists.find((l) => l.name === 'credentials')!.items).toEqual([{ title: 'Service areas', detail: 'Aluva, Kakkanad' }, { title: 'Call-out charge note', detail: 'Call-out charge is set per visit' }]);
    expect(lists.find((l) => l.name === 'gallery')!.items).toEqual([{ src: 'https://cdn.example/a.jpg', alt: 'Bathroom' }]);
  });
  it('nothing is written for a value that was not given', () => { expect(toSiteOps(schema, seed.maps, { business_name: 'R' }, 'FIELD_SERVICE', 'plumber')).toEqual([]); });
});

describe('the service and the routes', () => {
  class MemFields extends ProfileFieldStore {
    fields: ProfileField[] = []; maps: SiteMapRow[] = [];
    async listFields() { return this.fields; } async listMaps() { return this.maps; }
    async createFields(rows: ProfileField[]) { for (const r of rows) if (!this.fields.some((x) => x.packKey === r.packKey && x.categorySlug === r.categorySlug && x.fieldKey === r.fieldKey)) this.fields.push(r); }
    async createMaps(rows: SiteMapRow[]) { for (const r of rows) if (!this.maps.some((x) => x.packKey === r.packKey && x.categorySlug === r.categorySlug && x.fieldKey === r.fieldKey)) this.maps.push(r); }
    async upsertField(row: ProfileField) { const i = this.fields.findIndex((x) => x.packKey === row.packKey && x.categorySlug === row.categorySlug && x.fieldKey === row.fieldKey); if (i >= 0) this.fields[i] = row; else this.fields.push(row); return row; }
    async upsertMap(row: SiteMapRow) { const i = this.maps.findIndex((x) => x.packKey === row.packKey && x.categorySlug === row.categorySlug && x.fieldKey === row.fieldKey); if (i >= 0) this.maps[i] = row; else this.maps.push(row); return row; }
    async categoryByKey(k: string): Promise<CategoryRef | null> { const c = cats.find((x) => x.categoryKey === k); return c ? { categoryKey: c.categoryKey, packKey: c.packKey } : null; }
    registered = new Map<string, string>();
    async categoryOfVendor(v: string): Promise<CategoryRef | null> { return this.registered.has(v) ? this.categoryByKey(this.registered.get(v)!) : null; }
  }
  class MemValues extends ProfileValueStore {
    byVendor = new Map<string, Record<string, unknown>>(); listings = new Map<string, string>();
    async get(v: string) { return { ...(this.byVendor.get(v) ?? {}) }; }
    async replace(v: string, values: Record<string, unknown>) { this.byVendor.set(v, { ...values }); }
    async vendorOfListing(id: string) { return this.listings.get(id) ?? null; }
  }
  let fields: MemFields; let values: MemValues; let svc: ProfileFieldsService; let saved: Array<{ vendorId: string; change: { kind: string } }>; let activity: Array<{ actionKey: string }>; let gate = { counselGated: false, open: false }; let refuseList: string | null;
  const owner = { type: 'VENDOR' as const, id: 'v1', ip: null }; const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
  beforeEach(async () => {
    fields = new MemFields(); values = new MemValues(); saved = []; activity = []; gate = { counselGated: false, open: false }; refuseList = null;
    await loadProfileFields(fields, cats, { apply: true });
    fields.registered.set('v1', 'plumber'); fields.registered.set('v2', 'plumber'); values.listings.set('seed1', 'v1');
    const website = { save: async (vendorId: string, _a: unknown, change: { kind: string; name?: string }) => { if (change.kind === 'list' && change.name === refuseList) throw new HttpException({ code: 'LIMIT_REACHED' }, 403); saved.push({ vendorId, change }); return {}; } };
    svc = new ProfileFieldsService(fields, values, { packGate: async () => gate } as unknown as PackEngineService, website as never, { record: async (i: { actionKey: string }) => { activity.push(i); return null; } } as never);
  });

  it('the loader is a dry run by default, idempotent, and never touches an edited row', async () => {
    const empty = new MemFields(); const dry = await loadProfileFields(empty, cats, { apply: false });
    expect(dry).toMatchObject({ applied: false, packs: 16, fieldsToCreate: 1263 }); expect(empty.fields).toHaveLength(0);
    const k = fields.fields.findIndex((f) => f.fieldKey === 'tagline' && f.packKey === 'RETAIL'); fields.fields[k] = { ...fields.fields[k], label: 'Edited by staff' };
    const again = await loadProfileFields(fields, cats, { apply: true }); expect(again).toMatchObject({ fieldsToCreate: 0, mapsToCreate: 0 }); expect(fields.fields[k].label).toBe('Edited by staff');
  });
  it('a vendor sees the schema of their category; one who has not picked a category is told so', async () => {
    expect((await svc.schemaForVendor('v1')).fields.map((f) => f.key)).toEqual(expect.arrayContaining(['business_name', 'service_areas']));
    expect(await codeOf(svc.schemaForVendor('v9'))).toMatchObject({ status: 409, code: 'PROFILE_NO_CATEGORY' }); expect(await codeOf(svc.schemaFor('spaceship'))).toMatchObject({ status: 404, code: 'PROFILE_CATEGORY_UNKNOWN' });
  });
  it('a vendor saves: the values are checked, kept, and written into the site content once each; the profile is the vendor\'s own', async () => {
    const r = await svc.save('v1', owner, { business_name: 'Ranjith Plumber', tagline: 'Plumbing for homes', service_areas: ['Aluva'] });
    expect(r.saved).toBe(true); expect(r.site.skipped).toEqual([]); expect(r.site.written).toEqual(expect.arrayContaining(['site.tagline', 'list:credentials']));
    expect(values.byVendor.get('v1')).toMatchObject({ business_name: 'Ranjith Plumber' }); expect(values.byVendor.has('v2')).toBe(false); expect(saved.every((s) => s.vendorId === 'v1')).toBe(true); expect(activity).toEqual([]);   // a vendor's own save is not a staff write
    const more = await svc.save('v1', owner, { about: 'We fix taps.' }); expect(Object.keys(values.byVendor.get('v1')!).sort()).toEqual(['about', 'business_name', 'service_areas', 'tagline']); expect(more.fields).toContain('tagline');
  });
  it('a bad value is refused naming each field, and nothing is kept or written', async () => {
    const e = await codeOf(svc.save('v1', owner, { business_name: 'R', tagline: 'Number one plumber', mystery: 'x' }));
    expect(e).toMatchObject({ status: 400, code: 'PROFILE_INVALID' }); expect(Object.keys((e.details as { fields: Record<string, string> }).fields).sort()).toEqual(['mystery', 'tagline']);
    expect(values.byVendor.size).toBe(0); expect(saved).toHaveLength(0);
  });
  it('a site write the plan does not allow is reported, never silent, and does not undo the saved profile', async () => {
    refuseList = 'credentials';
    const r = await svc.save('v1', owner, { business_name: 'R', tagline: 'Plumbing for homes', service_areas: ['Aluva'] });
    expect(r.site.skipped).toEqual([{ target: 'list:credentials', reason: 'LIMIT_REACHED' }]); expect(r.site.written).toContain('site.tagline'); expect(values.byVendor.get('v1')).toMatchObject({ service_areas: ['Aluva'] });
  });
  it('a health, legal or finance pack that is not open serves no fields and accepts no values; once opened it works', async () => {
    fields.registered.set('v3', 'general-physician'); gate = { counselGated: true, open: false };
    const cat = cats.find((c) => c.packKey === 'CLINIC')!; fields.registered.set('v3', cat.categoryKey);
    expect(await svc.schemaFor(cat.categoryKey)).toMatchObject({ gated: true, fields: [] }); expect(await codeOf(svc.save('v3', owner, { business_name: 'Clinic' }))).toMatchObject({ status: 403, code: 'PROFILE_GATED' });
    gate = { counselGated: true, open: true }; expect((await svc.schemaFor(cat.categoryKey)).gated).toBe(false); expect((await svc.save('v3', owner, { business_name: 'Clinic' })).saved).toBe(true);
  });
  it('staff fill a listing made on behalf (audited), validate a category before creating anything, and an unknown listing is a plain 404', async () => {
    expect((await svc.saveForListing('seed1', staff, { business_name: 'Ranjith Plumber' })).saved).toBe(true); expect(activity.map((a) => a.actionKey)).toEqual(['profile.saved_on_behalf']);
    expect((await svc.forListing('seed1')).values).toMatchObject({ business_name: 'Ranjith Plumber' });
    expect(await codeOf(svc.saveForListing('nope', staff, { business_name: 'x' }))).toMatchObject({ status: 404, code: 'PROFILE_LISTING_NOT_FOUND' });
    expect(await svc.validateForCategory('plumber', { business_name: 'R' })).toMatchObject({ business_name: 'R' }); expect(await codeOf(svc.validateForCategory('plumber', { nope: 1 }))).toMatchObject({ code: 'PROFILE_INVALID' });
  });
  it('staff edit a field and a map row: checked, audited, and a bad one is named', async () => {
    const f = await svc.editField({ packKey: 'RETAIL', fieldKey: 'warranty_note', label: 'Warranty note', type: 'text', siteSection: 'details' }, { id: 'staff-1', ip: null });
    expect(f).toMatchObject({ packKey: 'RETAIL', categorySlug: '', fieldKey: 'warranty_note', active: true }); expect(fields.fields.some((x) => x.fieldKey === 'warranty_note')).toBe(true); expect(activity.map((a) => a.actionKey)).toContain('profile.field_edited');
    const bad = await codeOf(svc.editField({ packKey: 'NOPE', fieldKey: 'Bad Key', label: '<b>', type: 'select' as never, siteSection: 'nowhere' }, { id: 's', ip: null }));
    expect(bad).toMatchObject({ status: 400, code: 'PROFILE_FIELD_INVALID' }); expect(Object.keys((bad.details as { fields: Record<string, string> }).fields).sort()).toEqual(expect.arrayContaining(['fieldKey', 'packKey', 'siteSection']));
    const m = await svc.editMap({ packKey: 'RETAIL', fieldKey: 'warranty_note', targetKind: 'LIST', targetKey: 'credentials', itemMap: { title: '@label', detail: '@value' } }, { id: 'staff-1', ip: null }); expect(m.targetKind).toBe('LIST'); expect(activity.map((a) => a.actionKey)).toContain('profile.map_edited');
    expect(await codeOf(svc.editMap({ fieldKey: 'x', targetKind: 'FIELD', targetKey: 'not a key' }, { id: 's', ip: null }))).toMatchObject({ code: 'PROFILE_FIELD_INVALID' });
  });

  describe('over HTTP with the real AdminGuard', () => {
    let app: INestApplication;
    const as = (r: string) => ({ 'x-test-role': r });
    beforeEach(async () => {
      const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [AdminProfileController], providers: [throttlerGuardProvider, AdminGuard, { provide: ProfileFieldsService, useValue: svc }] }).compile();
      app = mod.createNestApplication();
      app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const r = req.headers['x-test-role']; if (r) req.user = { sub: `staff-${r}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: r }; next(); });
      app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    });
    afterEach(async () => { await app.close(); });
    it('every role that creates on behalf reads the schema and fills a listing (SALES included); SUPPORT may not', async () => {
      for (const role of ['MARKETING', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN']) {
        expect((await request(app.getHttpServer()).get('/v3/admin/categories/plumber/profile-schema').set(as(role))).body.data.fields.length).toBeGreaterThan(20);
        expect((await request(app.getHttpServer()).put('/v3/admin/seeded-sites/seed1/profile').set(as(role)).send({ values: { business_name: 'Ranjith Plumber' } })).status).toBe(200);
      }
      expect((await request(app.getHttpServer()).get('/v3/admin/categories/plumber/profile-schema').set(as('SUPPORT'))).status).toBe(403);
    });
    it('only ADMIN and SUPER_ADMIN edit the field sets and the map; OPERATIONS may read them, SALES and SUPPORT may not', async () => {
      const body = { packKey: 'RETAIL', fieldKey: 'warranty_note', label: 'Warranty note', type: 'text' };
      for (const role of ['ADMIN', 'SUPER_ADMIN']) expect((await request(app.getHttpServer()).put('/v3/admin/profile-fields').set(as(role)).send(body)).status).toBe(200);
      for (const role of ['OPERATIONS', 'MARKETING', 'SUPPORT']) expect((await request(app.getHttpServer()).put('/v3/admin/profile-fields').set(as(role)).send(body)).status).toBe(403);
      expect((await request(app.getHttpServer()).put('/v3/admin/profile-fields/map').set(as('OPERATIONS')).send({ fieldKey: 'x', targetKind: 'NONE' })).status).toBe(403);
      expect((await request(app.getHttpServer()).get('/v3/admin/profile-fields?packKey=RETAIL').set(as('OPERATIONS'))).status).toBe(200); expect((await request(app.getHttpServer()).get('/v3/admin/profile-fields').set(as('MARKETING'))).status).toBe(403);
    });
    it('a bad value comes back with each field named, in the error data', async () => {
      const r = await request(app.getHttpServer()).put('/v3/admin/seeded-sites/seed1/profile').set(as('MARKETING')).send({ values: { business_name: '<b>x</b>' } });
      expect(r.status).toBe(400); expect(JSON.stringify(r.body)).toContain('PROFILE_INVALID'); expect(r.body.data.fields.business_name).toBeDefined();
    });
  });

  it('the new error codes are registered', () => { for (const c of ['PROFILE_INVALID', 'PROFILE_CATEGORY_UNKNOWN', 'PROFILE_NO_CATEGORY', 'PROFILE_GATED', 'PROFILE_LISTING_NOT_FOUND', 'PROFILE_FIELD_INVALID']) expect(BUSINESS_ERROR_CODES).toContain(c); });
});
