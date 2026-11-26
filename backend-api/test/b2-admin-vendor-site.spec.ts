import { CATALOGUE_CATEGORIES, } from '../src/directory/core/catalogue-categories';
import { listableCategories } from '../src/directory/core/listable-categories';
import { buildCategoryTree } from '../src/v3-admin-vendor-site/category-tree';
import { AdminVendorSiteService } from '../src/v3-admin-vendor-site/admin-vendor-site.service';
import { ModuleTrialSite } from '../src/v3-trial/module-trial-site';
import { FreeHomeContentService } from '../src/v3-trial/free-home-content.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { PublishService } from '../src/site-publish/publish/publish.service';

/** B2.2: the category picker tree and staff creating a business with its site. */
const listable = listableCategories([{ id: 'plumber', label: 'Plumber', family: 'Home services' }]);
const packs = new Map(CATALOGUE_CATEGORIES.map((c) => [c.id, { minTier: 'PROFESSIONAL', starterServices: [c.name.split(' ')[0]] }]));

describe('category tree', () => {
  it('lists all 196 catalogue categories, each exactly once, grouped by family', () => {
    const t = buildCategoryTree(listable, packs);
    const keys = t.families.flatMap((f) => f.categories.map((c) => c.key));
    expect(CATALOGUE_CATEGORIES).toHaveLength(196);
    for (const c of CATALOGUE_CATEGORIES) expect(keys).toContain(c.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(t.matched).toBe(t.total);
  });
  it('searches by name: "Driving school" is found, with its family and sub categories; no match returns nothing', () => {
    const t = buildCategoryTree(listable, new Map([['driving-school', { minTier: 'PROFESSIONAL', starterServices: ['Driving School'] }]]), 'driving school');
    expect(t.families).toHaveLength(1);
    expect(t.families[0].family).toBe('Education and training');
    expect(t.families[0].categories[0]).toMatchObject({ key: 'driving-school', name: 'Driving school', subCategories: ['Driving School'] });
    expect(buildCategoryTree(listable, packs, 'zzzz nothing').matched).toBe(0);
  });
  it('a family word shows the whole family; search ignores case and punctuation', () => {
    const t = buildCategoryTree(listable, packs, 'EDUCATION & training');
    expect(t.matched).toBeGreaterThan(5);
    expect(t.families.every((f) => f.family === 'Education and training')).toBe(true);
  });
});

describe('AdminVendorSiteService.create', () => {
  const make = () => {
    const calls: string[] = [];
    const vendors = { create: jest.fn(async (dto: Record<string, unknown>, o: Record<string, unknown>) => { calls.push(`create:${o.path}:${(o.actor as { role: string }).role}`); return { id: 'v1', ...dto }; }) };
    const registration = { createMySite: jest.fn(async (_id: string, source: string) => { calls.push(`site:${source}`); return { status: 'LIVE', published: true, subdomain: 'murugan', url: 'https://murugan.get4domain.com' }; }) };
    const trial = { resolveSubdomain: jest.fn(async (s: string) => { calls.push('subdomain'); return s; }) };
    const prisma = { vendor: { update: jest.fn(async () => { calls.push('provenance'); }) }, v3PackCategory: { findMany: async () => [] } };
    const seeded = { listableCategories: async () => ({ items: listable }) };
    return { svc: new AdminVendorSiteService(vendors as never, registration as never, trial as never, prisma as never, seeded as never, { run: async (_s: string, f: () => Promise<unknown>) => f() } as never), calls, vendors };
  };
  const dto = { category: 'driving-school', businessName: 'Sri Murugan Driving School', ownerName: 'Murugan', phone: '+919876543210', email: 'M@x.invalid', city: 'Madurai', subdomain: 'murugan' };
  it('checks the address, creates through the shared duplicate check, records provenance, makes the plan and live site, returns the url', async () => {
    const m = make();
    const out = await m.svc.create(dto, { id: 's1', role: 'MARKETING' });
    expect(m.calls).toEqual(['subdomain', 'create:ADMIN_VENDOR:MARKETING', 'provenance', 'site:STAFF']);
    expect(out).toMatchObject({ vendorId: 'v1', subdomain: 'murugan', siteUrl: 'https://murugan.get4domain.com' });
    const sent = m.vendors.create.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.industry).toBe('driving-school');
    expect(sent.email).toBe('m@x.invalid');
    expect(String(sent.password).length).toBeGreaterThanOrEqual(16);
    expect(JSON.stringify(out)).not.toContain(String(sent.password));
  });
  it('an unknown category is refused before anything is created', async () => {
    const m = make();
    await expect(m.svc.create({ ...dto, category: 'no-such-thing' }, { id: 's1', role: 'MARKETING' })).rejects.toMatchObject({ response: { code: 'CATEGORY_UNKNOWN' } });
    expect(m.calls).toEqual([]);
  });
});

describe('the trial site banner (never a placeholder)', () => {
  const run = async (row: { banner: string; draft: unknown } | null) => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = { vendorCMS: { findUnique: async () => (row === null ? null : { siteStatus: 'LIVE', ...row }),   /* siteStatus LIVE: the S1.1 go-live step then changes nothing, so only the banner writes are recorded */ update: async (a: { data: Record<string, unknown> }) => { updates.push(a.data); } } };
    const ref = { get: (t: unknown) => (t === SiteProvisioner ? { createDraftSite: async () => ({ siteId: 's' }) } : t === SiteBuildService ? { build: async () => ({ publication: { id: 'p', status: 'PUBLISHED' } }) } : t === PublishService ? { publish: async () => undefined } : t === FreeHomeContentService ? { ensure: async () => undefined } : t === PrismaService ? prisma : (() => { throw new Error('x'); })()) };
    await new ModuleTrialSite(ref as never).createLiveTrialSite({ vendorId: 'v', track: 'professional', category: 'driving-school', businessName: 'B' });
    return updates;
  };
  it('an empty banner stays empty: the theme draws its hero scene until the vendor or staff set hero.image', async () => {
    expect(await run({ banner: '', draft: { tagline: 't' } })).toEqual([]);
  });
  it('a pack picture already there is kept, and a missing cms row changes nothing', async () => {
    expect(await run({ banner: '', draft: { banner: '/starter/clinic/hero.webp' } })).toEqual([]);
    expect(await run({ banner: '/x.webp', draft: null })).toEqual([]);
    expect(await run(null)).toEqual([]);
  });
});
