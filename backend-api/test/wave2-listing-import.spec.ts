import { HttpException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SeededAdminController } from '../src/seeded-sites/api/seeded-admin.controller';
import { ListingImportService } from '../src/v3-listing-import/listing-import.service';
import { importKeyOf, parseImport, parseServices, profileCell, templateColumns } from '../src/v3-listing-import/core/import-core';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { buildProfileSeed, ProfileField, resolveSchema, SiteMapRow } from '../src/v3-profile-fields/core/profile-core';
import { ProfileFieldsService } from '../src/v3-profile-fields/profile.service';
import { CategoryRef, ProfileFieldStore, ProfileValueStore } from '../src/v3-profile-fields/profile.store';
import { loadProfileFields } from '../src/v3-profile-fields/seed/profile-loader';
import { realSeed } from './support/pack-fakes';
import { seededWorld, sup, ops } from './support/seeded-world';

/** Wave 2 Part D, the listing import: the file rules, a dry run that creates nothing, an apply that is all good or nothing, and one that is safe to run twice. Memory twins; no database. */
jest.setTimeout(120_000);

const cats = realSeed().categories.map((c) => ({ categoryKey: c.categoryKey, packKey: c.packKey, fieldHints: c.fieldHints ?? [] }));
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; details?: { report?: { lines: Array<{ line: number; status: string; reasons: string[] }> } } }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; details?: never }; return { status: e.getStatus(), code: b.code, details: b.details }; } throw e; }
  throw new Error('expected a refusal');
};

const HEAD = 'category,business name,phone,email,address,city,state,locality,pincode,services (semicolon separated),source kind,source note,public facts only,tagline,service_areas';
const row = (o: Partial<Record<string, string>> = {}): string => {
  const v = { category: 'plumber', name: 'Ranjith Plumber', phone: '9811111111', email: 'ranjith@example.in', address: '12 Lake Road', city: 'Kochi', state: 'Kerala', locality: 'Aluva', pincode: '683101', services: 'Leak repair: taps and pipes; Bathroom fitting', kind: 'FIELD_VISIT', note: 'Seen on the board', facts: 'yes', tagline: 'Plumbing for homes', areas: 'Aluva; Kakkanad', ...o };
  return [v.category, v.name, v.phone, v.email, v.address, v.city, v.state, v.locality, v.pincode, `"${v.services}"`, v.kind, v.note, v.facts, v.tagline, `"${v.areas}"`].join(',');
};
const file = (...rows: string[]): string => [HEAD, ...rows].join('\n');

describe('the file rules (pure)', () => {
  const keys = new Set(['tagline', 'service_areas', 'about']);
  it('reads the template columns in any case or spelling, splits out the extras, and lists columns it does not know', () => {
    const r = parseImport(file(row()) + '\n', 200, keys);
    expect(r.error).toBeNull(); expect(r.rows).toHaveLength(1); expect(r.ignored).toEqual([]);
    expect(r.rows[0]).toMatchObject({ line: 2, state: 'Kerala', pincode: '683101', services: 'Leak repair: taps and pipes; Bathroom fitting', cells: { businessName: 'Ranjith Plumber', area: 'Aluva', category: 'plumber', sourceKind: 'FIELD_VISIT', publicFactsOnly: 'yes' }, profile: { tagline: 'Plumbing for homes', service_areas: 'Aluva; Kakkanad' } });
    expect(parseImport('Category,Business Name,PHONE,City,Area,Pin,Source Kind,Public Facts Only,mystery\nplumber,X Plumber,98,Kochi,Aluva,683101,FIELD_VISIT,yes,1', 10, keys).ignored).toEqual(['mystery']);
  });
  it('refuses a file with a missing required column, no rows, too many rows, or nothing at all', () => {
    expect(parseImport('category,phone\nplumber,98', 10, keys).error).toContain('Missing columns'); expect(parseImport('category,business name,phone,city,locality,pincode,source kind,public facts only\n', 10, keys).error).toContain('no rows');
    expect(parseImport(file(row(), row({ name: 'B' }), row({ name: 'C' })), 2, keys).error).toContain('most allowed'); expect(parseImport('', 10, keys).error).toContain('empty');
  });
  it('services: a semicolon list, a short description after a colon, at most thirty, each name two to eighty characters', () => {
    expect(parseServices('Leak repair: taps and pipes; Bathroom fitting')).toEqual({ ok: true, value: [{ name: 'Leak repair', description: 'taps and pipes' }, { name: 'Bathroom fitting' }] }); expect(parseServices('')).toEqual({ ok: true, value: [] });
    expect(parseServices('x').ok).toBe(false); expect(parseServices(Array.from({ length: 31 }, (_, i) => `Service ${i}`).join(';')).ok).toBe(false);
  });
  it('a profile cell becomes the value its field type expects; a picture list cannot be given in a file', () => {
    expect(profileCell({ type: 'textlist' }, 'A; B ;; C')).toEqual({ ok: true, value: ['A', 'B', 'C'] }); expect(profileCell({ type: 'bool' }, 'Yes')).toEqual({ ok: true, value: true }); expect(profileCell({ type: 'number' }, 'x').ok).toBe(false);
    expect(profileCell({ type: 'imagelist' }, 'https://x')).toMatchObject({ ok: false });
  });
  it('the import key is the phone (or the email), the business name and the pincode, normalised', () => {
    expect(importKeyOf({ phone: '+91 98111 11111', businessName: 'Ranjith  Plumber!', pincode: '683101' })).toBe('9811111111|ranjithplumber|683101');
    expect(importKeyOf({ phone: null, email: 'A@X.in', businessName: 'B', pincode: '1' })).toBe('a@x.in|b|1');
  });
  it('the template is the base columns, the staff tick columns, then the profile fields the base columns do not cover', () => {
    const t = templateColumns([{ fieldKey: 'tagline', type: 'text' }, { fieldKey: 'phone', type: 'phone' }, { fieldKey: 'gallery_images', type: 'imagelist' }, { fieldKey: 'service_areas', type: 'textlist' }]);
    expect(t.columns).toEqual(['category', 'business name', 'phone', 'email', 'address', 'city', 'state', 'locality', 'pincode', 'services (semicolon separated)', 'source kind', 'source note', 'public facts only', 'tagline', 'service_areas']); expect(t.header).toBe(t.columns.join(','));
  });
  it('the new error codes are registered', () => { expect(BUSINESS_ERROR_CODES).toEqual(expect.arrayContaining(['IMPORT_INVALID', 'IMPORT_BLOCKED'])); });
});

describe('the import over memory twins', () => {
  class MemFields extends ProfileFieldStore {
    fields: ProfileField[] = []; maps: SiteMapRow[] = [];
    async listFields() { return this.fields; } async listMaps() { return this.maps; }
    async createFields(rows: ProfileField[]) { this.fields.push(...rows); } async createMaps(rows: SiteMapRow[]) { this.maps.push(...rows); }
    async upsertField(r: ProfileField) { return r; } async upsertMap(r: SiteMapRow) { return r; }
    async categoryByKey(k: string): Promise<CategoryRef | null> { const c = cats.find((x) => x.categoryKey === k); return c ? { categoryKey: c.categoryKey, packKey: c.packKey } : null; }
    async categoryOfVendor(): Promise<CategoryRef | null> { return { categoryKey: 'plumber', packKey: 'FIELD_SERVICE' }; }
  }
  class MemValues extends ProfileValueStore {
    byVendor = new Map<string, Record<string, unknown>>(); vendorOf: (id: string) => string | null = () => null;
    async get(v: string) { return { ...(this.byVendor.get(v) ?? {}) }; } async replace(v: string, values: Record<string, unknown>) { this.byVendor.set(v, { ...values }); }
    async vendorOfListing(id: string) { return this.vendorOf(id); }
  }
  let w: ReturnType<typeof seededWorld>; let values: MemValues; let svc: ListingImportService; let profilesSvc: ProfileFieldsService; let siteWrites: Array<{ vendorId: string; kind: string }>; let activity: string[]; let gated: boolean;
  beforeEach(async () => {
    w = seededWorld(); values = new MemValues(); siteWrites = []; activity = []; gated = false;
    const fields = new MemFields(); await loadProfileFields(fields, cats, { apply: true });
    w.facts.categories.add('plumber'); w.facts.categories.add(clinicCategory);
    values.vendorOf = (seededId) => [...w.store.rows.values()].find((r) => r.id === seededId)?.vendorId ?? null;
    const profiles = new ProfileFieldsService(fields, values, { packGate: async (p: string) => ({ counselGated: p === 'CLINIC', open: !gated }) } as unknown as PackEngineService, { save: async (vendorId: string, _a: unknown, c: { kind: string }) => { siteWrites.push({ vendorId, kind: c.kind }); return {}; } } as never);
    profilesSvc = profiles;
    svc = new ListingImportService(w.svc, profiles, { record: async (i: { actionKey: string }) => { activity.push(i.actionKey); return null; } } as never);
  });
  const made = (): number => w.provisioner.calls.length;
  const clinicCategory = cats.find((c) => c.packKey === 'CLINIC')!.categoryKey;

  it('a DRY RUN is the default: it reports what would be created and creates nothing', async () => {
    const r = await svc.dryRun(file(row(), row({ name: 'Anand Plumber', phone: '9822222222', email: 'anand@example.in' })), ops);
    expect(r).toMatchObject({ mode: 'DRY_RUN', applied: false, blocked: false, counts: { total: 2, wouldCreate: 2, created: 0, skipped: 0, failed: 0 } });
    expect(r.lines.map((l) => l.status)).toEqual(['WILL_CREATE', 'WILL_CREATE']); expect(r.lines[0].importKey).toBe('9811111111|ranjithplumber|683101'); expect(made()).toBe(0); expect(w.store.rows.size).toBe(0);
  });
  it('an APPLY creates each listing and draft site on behalf, then its profile, and reports created rows', async () => {
    const r = await svc.apply(file(row(), row({ name: 'Anand Plumber', phone: '9822222222', email: 'anand@example.in' })), ops);
    expect(r).toMatchObject({ mode: 'APPLY', applied: true, blocked: false, counts: { total: 2, created: 2, failed: 0 } }); expect(r.lines.every((l) => l.status === 'CREATED' && !!l.listingId)).toBe(true);
    expect(made()).toBe(2); expect(w.store.rows.size).toBe(2); expect(w.publisher.published).toHaveLength(2);
    const vendor = [...w.store.rows.values()][0].vendorId; const p = values.byVendor.get(vendor)!;
    expect(p).toMatchObject({ business_name: 'Ranjith Plumber', locality: 'Aluva', city: 'Kochi', state: 'Kerala', pincode: '683101', tagline: 'Plumbing for homes', service_areas: ['Aluva', 'Kakkanad'], services: [{ name: 'Leak repair', description: 'taps and pipes' }, { name: 'Bathroom fitting' }] });
    expect(siteWrites.length).toBeGreaterThan(0); expect(activity).toContain('listing.import_applied');
  });
  it('the listing state of an imported row is the first of the four: an unclaimed listing', async () => {
    await svc.apply(file(row()), ops);
    expect([...w.store.rows.values()][0]).toMatchObject({ lifecycle: 'SEEDED', outreachStatus: 'NOT_CONTACTED', ownerAgreedToContact: false });
  });
  it('applying the same file twice makes nothing twice: the second run skips every row', async () => {
    const f = file(row(), row({ name: 'Anand Plumber', phone: '9822222222', email: 'anand@example.in' }));
    await svc.apply(f, ops); const second = await svc.apply(f, ops);
    expect(second.counts).toMatchObject({ created: 0, skipped: 2, failed: 0 }); expect(second.lines.every((l) => l.status === 'SKIPPED')).toBe(true); expect(made()).toBe(2); expect(w.store.rows.size).toBe(2);
    expect((await svc.dryRun(f, ops)).counts).toMatchObject({ skipped: 2, wouldCreate: 0 });
  });
  it('ONE bad row blocks the whole apply: nothing is created, and the report names every bad row and why', async () => {
    const f = file(row(), row({ name: 'Bad Pin', phone: '9833333333', email: 'b@example.in', pincode: '012345' }), row({ name: 'No Facts', phone: '9844444444', email: 'n@example.in', facts: 'no' }), row({ name: 'Anand Plumber', phone: '9822222222', email: 'a@example.in' }));
    const e = await codeOf(svc.apply(f, ops));
    expect(e).toMatchObject({ status: 409, code: 'IMPORT_BLOCKED' }); const lines = e.details!.report!.lines;
    expect(lines.map((l) => [l.line, l.status])).toEqual([[2, 'WILL_CREATE'], [3, 'FAILED'], [4, 'FAILED'], [5, 'WILL_CREATE']]);
    expect(lines[1].reasons.join(' ')).toContain('pincode'); expect(lines[2].reasons.join(' ')).toContain('publicFactsOnly'); expect(made()).toBe(0); expect(w.store.rows.size).toBe(0);
    expect((await svc.dryRun(f, ops)).blocked).toBe(true);
  });
  it('a row repeated in the same file, a phone on the do-not-contact register and an unknown category each block the file', async () => {
    await w.svc.addToRegister('9899999999', 'Asked not to be listed', ops);
    const r = await svc.dryRun(file(row({ name: 'Registered Plumber', phone: '9899999999', email: 'r2@example.in' }), row(), row({ phone: '9811111111' }), row({ category: 'spaceship', name: 'Z', phone: '9866666666', email: 'z@example.in' })), ops);
    expect(r.lines.map((l) => l.status)).toEqual(['FAILED', 'WILL_CREATE', 'FAILED', 'FAILED']); expect(r.lines[0].reasons.join(' ')).toContain('do-not-contact'); expect(r.lines[2].reasons.join(' ')).toContain('repeated in this file'); expect(r.lines[3].reasons.join(' ')).toContain('category'); expect(r.blocked).toBe(true);
  });
  it('a business that was removed is never made again: its row is skipped, not created', async () => {
    await w.svc.create({ businessName: 'Old One', category: 'plumber', city: 'Kochi', area: 'Aluva', phone: '9855555555', sourceKind: 'FIELD_VISIT', publicFactsOnly: true }, ops);
    const [seeded] = [...w.store.rows.values()]; await w.svc.remove(seeded.id, 'Asked to be removed', sup);
    const r = await svc.apply(file(row({ name: 'Old One', phone: '9855555555', email: 'old@example.in' })), ops);
    expect(r.lines[0]).toMatchObject({ status: 'SKIPPED' }); expect(r.lines[0].reasons.join(' ')).toContain('removed before'); expect(w.store.rows.size).toBe(1);
  });
  it('profile columns are checked against the category: an unknown column value, markup, a ranking claim and a picture list are refused with the field named', async () => {
    const bad = await svc.dryRun(file(row({ tagline: 'Number one plumber in Kochi' })), ops); expect(bad.lines[0]).toMatchObject({ status: 'FAILED' }); expect(bad.lines[0].reasons.join(' ')).toContain('tagline');
    const markup = await svc.dryRun(file(row({ tagline: '<b>Best</b>' })), ops); expect(markup.lines[0].status).toBe('FAILED');
    const unknown = await svc.dryRun('category,business name,phone,city,locality,pincode,source kind,public facts only,drug_licence_number\nplumber,X Plumber,9877777777,Kochi,Aluva,683101,FIELD_VISIT,yes,KL-123', ops);
    expect(unknown.lines[0].reasons.join(' ')).toContain('drug_licence_number');
    const pics = await svc.dryRun('category,business name,phone,city,locality,pincode,source kind,public facts only,gallery_images\nplumber,X Plumber,9877777777,Kochi,Aluva,683101,FIELD_VISIT,yes,https://x.example/a.jpg', ops);
    expect(pics.lines[0].reasons.join(' ')).toContain('gallery_images');
  });
  it('a health pack that is not open refuses its rows', async () => {
    gated = true;
    const f = `category,business name,phone,city,locality,pincode,source kind,public facts only\n${clinicCategory},Dr Clinic,9888888888,Kochi,Aluva,683101,FIELD_VISIT,yes`;
    const r = await svc.dryRun(f, ops); expect(r.lines[0]).toMatchObject({ status: 'FAILED' }); expect(r.lines[0].reasons.join(' ')).toContain('not open');
  });
  it('a row that fails while being made is reported failed, the rows before it stay, and applying the file again skips them and retries it', async () => {
    const f = file(row(), row({ name: 'Anand Plumber', phone: '9822222222', email: 'anand@example.in' }));
    const original = w.provisioner.provision.bind(w.provisioner); let calls = 0;
    w.provisioner.provision = async (i) => { calls += 1; if (calls === 2) throw new HttpException({ code: 'SEEDED_INVALID', message: 'The site could not be created.' }, 422); return original(i); };
    const r = await svc.apply(f, ops);
    expect(r.lines.map((l) => l.status)).toEqual(['CREATED', 'FAILED']); expect(r.lines[1].reasons[0]).toContain('could not be created'); expect(w.store.rows.size).toBe(1);
    w.provisioner.provision = original; const again = await svc.apply(f, ops);
    expect(again.lines.map((l) => l.status)).toEqual(['SKIPPED', 'CREATED']); expect(w.store.rows.size).toBe(2);
  });
  it('create on behalf with a profile (C9): a bad detail is refused BEFORE anything is made; a good one makes the listing and keeps the profile', async () => {
    const ctrl = new SeededAdminController(w.svc, {} as never, { get: () => profilesSvc } as unknown as ModuleRef);
    const user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' }; const req = { ip: null } as never;
    const body = { businessName: 'Ranjith Plumber', category: 'plumber', city: 'Kochi', area: 'Aluva', phone: '9811111111', sourceKind: 'FIELD_VISIT', publicFactsOnly: true };
    expect(await codeOf(ctrl.create({ ...body, profile: { tagline: 'Number one plumber', mystery: 1 } } as never, user, req))).toMatchObject({ status: 400, code: 'PROFILE_INVALID' });
    expect(w.store.rows.size).toBe(0); expect(made()).toBe(0);
    const ok = await ctrl.create({ ...body, profile: { business_name: 'Ranjith Plumber', pincode: '683101', service_areas: ['Aluva'] } } as never, user, req) as unknown as { id: string; profile: { saved: boolean } };
    expect(ok.profile.saved).toBe(true); expect(w.store.rows.size).toBe(1); expect([...values.byVendor.values()][0]).toMatchObject({ pincode: '683101', service_areas: ['Aluva'] });
    const none = new SeededAdminController(w.svc, {} as never, { get: () => { throw new Error('no profile module'); } } as unknown as ModuleRef);
    const plain = await none.create({ ...body, businessName: 'Plain Plumber', phone: '9822222222', profile: { tagline: 'x' } } as never, user, req) as unknown as { id: string; profile?: unknown };
    expect(plain.profile).toBeUndefined(); expect(w.store.rows.size).toBe(2);   // where the profile module is not loaded the listing is still made, as before
  });
  it('the template for a category lists its profile columns', async () => {
    const t = await svc.template('plumber'); expect(t.columns.slice(0, 3)).toEqual(['category', 'business name', 'phone']); expect(t.columns).toEqual(expect.arrayContaining(['tagline', 'service_areas', 'callout_note'])); expect(t.columns).not.toContain('gallery_images');
    expect((await svc.template()).columns).toHaveLength(13);
    expect(resolveSchema(buildProfileSeed(cats).fields, 'FIELD_SERVICE', 'plumber').length).toBeGreaterThan(20);
  });
});
