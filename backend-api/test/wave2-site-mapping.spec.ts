import { HttpException } from '@nestjs/common';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { applyToSource, emptyDoc, hashDoc, normaliseDoc, writeHours } from '../src/v3-website/core/managed-doc';
import { hoursText, parseHoursText, validateHours } from '../src/v3-website/core/hours-core';
import { buildProfileSeed, checkProfile, COMMON_FIELDS, resolveSchema, SiteMapRow, toSiteOps } from '../src/v3-profile-fields/core/profile-core';
import { PrismaOfferingsPort } from '../src/v3-profile-fields/prisma-profile.store';
import { ProfileFieldsService } from '../src/v3-profile-fields/profile.service';
import { CategoryRef, OfferingsPort, ProfileFieldStore, ProfileValueStore } from '../src/v3-profile-fields/profile.store';
import { loadProfileFields } from '../src/v3-profile-fields/seed/profile-loader';
import { realSeed } from './support/pack-fakes';
import { doc, YEAR } from './support/site-fixtures';

/** Wave 2 Part G (1): what staff enter in create-on-behalf and the import reaches the draft site: services in the Offerings, opening hours in the site's hours rows, the address parts in the site location. */
jest.setTimeout(120_000);
const cats = realSeed().categories.map((c) => ({ categoryKey: c.categoryKey, packKey: c.packKey, fieldHints: c.fieldHints ?? [] }));

describe('opening hours rows (pure)', () => {
  it('reads the compact text staff type: a range shares one time, a day can be closed, full and short day names in any case', () => {
    const r = parseHoursText('Mon-Sat 9:00-18:00; Sunday closed');
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.rows).toHaveLength(7); expect(r.rows[0]).toEqual({ day: 'Mon', open: '09:00', close: '18:00', closed: false }); expect(r.rows[5]).toEqual({ day: 'Sat', open: '09:00', close: '18:00', closed: false }); expect(r.rows[6]).toEqual({ day: 'Sun', open: '', close: '', closed: true });
    expect(hoursText(r.rows)).toBe('Mon 09:00-18:00, Tue 09:00-18:00, Wed 09:00-18:00, Thu 09:00-18:00, Fri 09:00-18:00, Sat 09:00-18:00, Sun closed');
    expect(parseHoursText('fri to sat 10:00 to 14:00')).toMatchObject({ ok: true }); expect(parseHoursText('')).toEqual({ ok: true, rows: [] });
  });
  it('refuses what it cannot read, a day twice, a close before the open and a bad time, naming the problem', () => {
    for (const bad of ['Mon-Sat nine to six', 'Mon 9-18', 'Funday 09:00-18:00', 'Sat-Mon 09:00-18:00']) expect(parseHoursText(bad).ok).toBe(false);
    expect(parseHoursText('Mon 09:00-18:00; Mon 10:00-12:00')).toMatchObject({ ok: false, message: 'Mon is given twice.' });
    expect(validateHours([{ day: 'Mon', open: '18:00', close: '09:00', closed: false }])).toMatchObject({ ok: false });
    expect(validateHours([{ day: 'Mon', open: '25:00', close: '26:00', closed: false }])).toMatchObject({ ok: false });
    expect(validateHours([{ day: 'Mon', open: '09:00', close: '18:00', closed: false, extra: 1 }])).toMatchObject({ ok: false }); expect(validateHours('x')).toMatchObject({ ok: false });
    expect(validateHours(Array.from({ length: 8 }, () => ({ day: 'Mon', closed: true })))).toMatchObject({ ok: false });
  });
  it('sorts the rows in week order and accepts the row form the screens send', () => {
    expect(validateHours([{ day: 'sunday', closed: true }, { day: 'Mon', open: '09:00', close: '17:00', closed: false }])).toEqual({ ok: true, rows: [{ day: 'Mon', open: '09:00', close: '17:00', closed: false }, { day: 'Sun', open: '', close: '', closed: true }] });
  });
});

describe('the managed document and the renderer carry the hours', () => {
  const rows = [{ day: 'Mon', open: '09:00', close: '18:00', closed: false }, { day: 'Sun', open: '', close: '', closed: true }];
  it('writeHours keeps the rows, an empty list removes them, and the document hash changes with them', () => {
    const w = writeHours(emptyDoc(), rows); expect(w.ok).toBe(true); if (!w.ok) return;
    expect(normaliseDoc(w.doc).hours).toEqual(rows); expect(hashDoc(w.doc)).not.toBe(hashDoc(emptyDoc()));
    const gone = writeHours(w.doc, []); expect(gone.ok && gone.doc.hours).toBeUndefined(); expect(writeHours(emptyDoc(), [{ day: 'Mon' }]).ok).toBe(false);
  });
  it('applyToSource lays the rows over the source and keeps the one-line text in step (for the search file and the chat bot)', () => {
    const w = writeHours(emptyDoc(), rows); if (!w.ok) throw new Error('x');
    const out = applyToSource(doc('plumber'), w.doc);
    expect(out.cms!.hours).toEqual(rows); expect(out.cms!.businessHours).toBe('Mon 09:00-18:00, Sun closed');
    expect(applyToSource(doc('plumber'), emptyDoc()).cms!.businessHours).toBe('Mon-Sat 9am-8pm');   // no rows written: the older text stays
  });
  it('the renderer input draws the rows as the hours table reads them, and none when there are none', () => {
    const w = writeHours(emptyDoc(), rows); if (!w.ok) throw new Error('x');
    const c = toRendererInput(applyToSource(doc('plumber'), w.doc), { categoryId: 'plumber', lang: 'en', year: YEAR, siteBase: 'get4domain.com' }).content as { hours: unknown[] };
    expect(c.hours).toEqual(rows);
    expect((toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'en', year: YEAR, siteBase: 'get4domain.com' }).content as { hours: unknown[] }).hours).toEqual([]);
  });
});

describe('the profile mapping', () => {
  const seed = buildProfileSeed(cats); const schema = resolveSchema(seed.fields, 'FIELD_SERVICE', 'plumber');
  it('the seed maps services to the Offerings, hours to the hours rows and the address parts to the location, and opening hours is an hours field', () => {
    const m = (k: string): SiteMapRow | undefined => seed.maps.find((x) => x.packKey === '' && x.categorySlug === '' && x.fieldKey === k);
    expect(m('services')).toMatchObject({ targetKind: 'OFFERINGS' }); expect(m('opening_hours')).toMatchObject({ targetKind: 'HOURS' });
    expect(['address_line', 'locality', 'city', 'state', 'pincode'].map((k) => m(k)?.targetKey)).toEqual(['addressLine1', 'addressLine2', 'city', 'state', 'pincode']);
    expect(COMMON_FIELDS.find((f) => f[0] === 'opening_hours')![2]).toBe('hours');
    expect(seed.maps.filter((x) => x.targetKind === 'NONE').map((x) => x.fieldKey)).toEqual(['business_name']);
  });
  it('opening hours are checked: the text or the rows both pass, a bad one is refused; the pincode is six digits', () => {
    expect(checkProfile(schema, { business_name: 'R', opening_hours: 'Mon-Fri 09:00-17:00' }).value.opening_hours).toHaveLength(5);
    expect(checkProfile(schema, { business_name: 'R', opening_hours: 'whenever' }).errors.opening_hours).toContain('Could not read');
    expect(checkProfile(schema, { business_name: 'R', pincode: '012345' }).errors.pincode).toContain('six digits'); expect(checkProfile(schema, { business_name: 'R', pincode: '683101' }).ok).toBe(true);
  });
  it('text values may not carry a tel, mailto or wa.me link (a Free site is informational), or a price', () => {
    for (const bad of ['Call tel:+919876543210', 'Write mailto:a@b.in', 'Chat on https://wa.me/919876543210', 'Chat api.whatsapp.com/send']) expect(checkProfile(schema, { business_name: 'R', tagline: bad }).errors.tagline).toContain('contact links');
    expect(checkProfile(schema, { business_name: 'R', services: [{ name: 'Leak repair', description: 'From Rs 300' }] }).errors.services).toContain('before GST');
    expect(checkProfile(schema, { business_name: 'R', services: [{ name: 'Leak repair', description: 'Taps and pipes' }] }).ok).toBe(true);
  });
  it('toSiteOps builds one location, the hours, and the Offerings, and nothing for a part not given', () => {
    const v = { business_name: 'R', city: 'Kochi', pincode: '683101', opening_hours: [{ day: 'Mon', open: '09:00', close: '18:00', closed: false }], services: [{ name: 'Leak repair', description: 'Taps' }, { name: 'Fitting' }] };
    const ops = toSiteOps(schema, seed.maps, v, 'FIELD_SERVICE', 'plumber');
    expect(ops.map((o) => o.kind).sort()).toEqual(['hours', 'location', 'offerings']); expect(ops.find((o) => o.kind === 'location')).toEqual({ kind: 'location', value: { city: 'Kochi', pincode: '683101' } });
    expect(ops.find((o) => o.kind === 'offerings')).toEqual({ kind: 'offerings', items: [{ name: 'Leak repair', description: 'Taps' }, { name: 'Fitting' }] });
  });
});

describe('the Offerings port (tenant scoped, no prices, never touches the vendor\'s own services)', () => {
  interface Row { id: string; vendorId: string; name: string; description: string | null; price: string | null; active: boolean; customFields: unknown }
  const mk = () => {
    const rows: Row[] = []; let n = 0;
    const prisma = {
      vendorProduct: {
        findMany: async (a: { where: { vendorId: string } }) => rows.filter((r) => r.vendorId === a.where.vendorId),
        create: (a: { data: Omit<Row, 'id'> }) => { const r = { id: `p${++n}`, ...a.data } as Row; return Promise.resolve().then(() => { rows.push(r); return r; }); },
        update: (a: { where: { id: string }; data: Partial<Row> }) => Promise.resolve().then(() => { const r = rows.find((x) => x.id === a.where.id)!; Object.assign(r, a.data); return r; }),
      },
      $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
    };
    return { rows, port: new PrismaOfferingsPort(prisma as never) };
  };
  it('creates the services with their short description and no price; the same list again changes nothing', async () => {
    const { rows, port } = mk();
    expect(await port.sync('v1', [{ name: 'Leak repair', description: 'Taps and pipes' }, { name: 'Bathroom fitting' }])).toEqual({ created: 2, updated: 0, retired: 0 });
    expect(rows.map((r) => [r.name, r.description, r.price, r.active, r.vendorId])).toEqual([['Leak repair', 'Taps and pipes', null, true, 'v1'], ['Bathroom fitting', null, null, true, 'v1']]);
    expect(await port.sync('v1', [{ name: 'leak  repair', description: 'Taps and pipes' }, { name: 'Bathroom fitting' }])).toEqual({ created: 0, updated: 0, retired: 0 }); expect(rows).toHaveLength(2);
  });
  it('a changed description is updated, a service no longer named is retired (never deleted) and comes back when named again', async () => {
    const { rows, port } = mk(); await port.sync('v1', [{ name: 'A', description: 'one' }, { name: 'B' }]);
    expect(await port.sync('v1', [{ name: 'A', description: 'two' }])).toEqual({ created: 0, updated: 1, retired: 1 });
    expect(rows.find((r) => r.name === 'A')!.description).toBe('two'); expect(rows.find((r) => r.name === 'B')!.active).toBe(false); expect(rows).toHaveLength(2);
    expect(await port.sync('v1', [{ name: 'A' }, { name: 'B' }])).toEqual({ created: 0, updated: 1, retired: 0 }); expect(rows.find((r) => r.name === 'B')!.active).toBe(true);
  });
  it('a service the vendor made themselves is never changed, retired or duplicated; another vendor is never touched', async () => {
    const { rows, port } = mk();
    rows.push({ id: 'own', vendorId: 'v1', name: 'Tap repair', description: 'Mine', price: '300', active: true, customFields: null }); rows.push({ id: 'other', vendorId: 'v2', name: 'Tap repair', description: 'Theirs', price: null, active: true, customFields: { source: 'profile' } });
    expect(await port.sync('v1', [{ name: 'Tap repair', description: 'Changed by staff' }, { name: 'New one' }])).toEqual({ created: 1, updated: 0, retired: 0 });
    expect(rows.find((r) => r.id === 'own')).toMatchObject({ description: 'Mine', price: '300', active: true }); expect(rows.find((r) => r.id === 'other')).toMatchObject({ description: 'Theirs', active: true });
    expect(await port.sync('v1', [])).toEqual({ created: 0, updated: 0, retired: 1 }); expect(rows.find((r) => r.id === 'own')!.active).toBe(true); expect(rows.find((r) => r.id === 'other')!.active).toBe(true);
  });
});

describe('the service writes location, hours and Offerings for a business', () => {
  class MemFields extends ProfileFieldStore {
    fields = [] as Awaited<ReturnType<ProfileFieldStore['listFields']>>; maps: SiteMapRow[] = [];
    async listFields() { return this.fields; } async listMaps() { return this.maps; } async createFields(r: typeof this.fields) { this.fields.push(...r); } async createMaps(r: SiteMapRow[]) { this.maps.push(...r); }
    async upsertField(r: never) { return r; } async upsertMap(r: never) { return r; }
    async categoryByKey(k: string): Promise<CategoryRef | null> { const c = cats.find((x) => x.categoryKey === k); return c ? { categoryKey: c.categoryKey, packKey: c.packKey } : null; }
    async categoryOfVendor(): Promise<CategoryRef | null> { return { categoryKey: 'plumber', packKey: 'FIELD_SERVICE' }; }
  }
  class MemValues extends ProfileValueStore {
    v = new Map<string, Record<string, unknown>>(); async get(id: string) { return { ...(this.v.get(id) ?? {}) }; } async replace(id: string, x: Record<string, unknown>) { this.v.set(id, { ...x }); } async vendorOfListing() { return 'v1'; }
  }
  let saves: Array<{ vendorId: string; change: { kind: string; value?: unknown; key?: string } }>; let synced: Array<{ vendorId: string; items: unknown }>; let svc: ProfileFieldsService; let existingLocation: Record<string, string>; let refuse: string | null;
  beforeEach(async () => {
    saves = []; synced = []; existingLocation = {}; refuse = null; const f = new MemFields(); await loadProfileFields(f, cats, { apply: true });
    const website = {
      save: async (vendorId: string, _a: unknown, change: { kind: string }) => { if (change.kind === refuse) throw new HttpException({ code: 'LIMIT_REACHED' }, 403); saves.push({ vendorId, change }); return {}; },
      seoContext: async () => ({ doc: { location: existingLocation } }),
    };
    const offerings: OfferingsPort = { sync: async (vendorId, items) => { synced.push({ vendorId, items }); return { created: items.length, updated: 0, retired: 0 }; } };
    svc = new ProfileFieldsService(f, new MemValues(), { packGate: async () => ({ counselGated: false, open: true }) } as unknown as PackEngineService, website as never, undefined, offerings);
  });
  const owner = { type: 'VENDOR' as const, id: 'v1', ip: null };

  it('writes the location (merged over what the owner already has), the hours rows and the Offerings, and reports each', async () => {
    existingLocation = { mapLinkInput: 'https://www.google.com/maps/@9.9,76.3,15z', latitude: '9.9' } as never;
    const r = await svc.save('v1', owner, { business_name: 'Ranjith Plumber', locality: 'Aluva', city: 'Kochi', state: 'Kerala', pincode: '683101', opening_hours: 'Mon-Sat 09:00-18:00; Sun closed', services: [{ name: 'Leak repair', description: 'Taps and pipes' }] });
    expect(r.site.skipped).toEqual([]); expect(r.site.written).toEqual(expect.arrayContaining(['location', 'hours', 'offerings']));
    const loc = saves.find((s) => s.change.kind === 'location')!; expect(loc.vendorId).toBe('v1'); expect(loc.change.value).toEqual({ mapLinkInput: 'https://www.google.com/maps/@9.9,76.3,15z', latitude: '9.9', addressLine2: 'Aluva', city: 'Kochi', state: 'Kerala', pincode: '683101' });
    expect((saves.find((s) => s.change.kind === 'hours')!.change.value as unknown[]).length).toBe(7); expect(synced).toEqual([{ vendorId: 'v1', items: [{ name: 'Leak repair', description: 'Taps and pipes' }] }]);
  });
  it('a refused site write is reported, never silent, and the others still go through', async () => {
    refuse = 'hours';
    const r = await svc.save('v1', owner, { business_name: 'R', city: 'Kochi', opening_hours: 'Mon 09:00-18:00', services: [{ name: 'Leak repair' }] });
    expect(r.site.skipped).toEqual([{ target: 'hours', reason: 'LIMIT_REACHED' }]); expect(r.site.written).toEqual(expect.arrayContaining(['location', 'offerings']));
  });
  it('without the Offerings port or the website the parts are reported as not available, and the profile is still saved', async () => {
    const bare = new ProfileFieldsService(new MemFields(), new MemValues(), { packGate: async () => ({ counselGated: false, open: true }) } as unknown as PackEngineService);
    await loadProfileFields((bare as unknown as { fields: MemFields }).fields, cats, { apply: true });
    const r = await bare.save('v1', owner, { business_name: 'R', services: [{ name: 'Leak repair' }], opening_hours: 'Mon 09:00-18:00' });
    expect(r.saved).toBe(true); expect(r.site.skipped.map((s) => s.reason).sort()).toEqual(['OFFERINGS_NOT_AVAILABLE', 'WEBSITE_NOT_AVAILABLE']);
  });
});
