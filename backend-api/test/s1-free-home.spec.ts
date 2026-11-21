import { ModuleTrialSite } from '../src/v3-trial/module-trial-site';
import { FreeHomeContentService } from '../src/v3-trial/free-home-content.service';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFreeHomeContent, placeLine, TRACK_SERVICES } from '../src/site-publish/content/free-home-content';
import { doc as makeDoc } from './support/site-fixtures';
import { OWNER, siteWorld } from './support/site-world';

/**
 * S1: a published Free site must show something. Live fact: a Free handyman vendor (category text typed, not in the list) had a PUBLISHED V3 site v1 with no about, no tagline, no services, and its address
 * answered 404 because the site app reads GET /cms/site/<sub>, which refuses any VendorCMS row that is not LIVE (the V3 publish never set it).
 */
jest.setTimeout(120_000);
const CATEGORY = 'Home repair and trades';
const details = { businessName: 'Plumber Boy', categoryText: CATEGORY, track: 'handyman', city: 'Madurai', area: 'Anna Nagar', pincode: '625020' };

describe('S1.2 the content built from the registration details', () => {
  it('states what the vendor typed and nothing invented, and never the e-mail', () => {
    const c = buildFreeHomeContent(details);
    expect(c.tagline).toBe('Home repair and trades in Madurai');
    expect(c.about).toContain('Plumber Boy'); expect(c.about).toContain('home repair and trades business'); expect(c.about).toContain('Anna Nagar, Madurai 625020');
    expect(c.services.map((s) => s.name)).toEqual(TRACK_SERVICES.handyman.map((s) => s.name));
    expect(JSON.stringify(c)).not.toMatch(/@|\d{10}|₹|rating|years|24x7|emergency|best|trusted/i);
  });
  it('is the same text on every run, and copes with missing parts and markup', () => {
    expect(buildFreeHomeContent(details)).toEqual(buildFreeHomeContent(details));
    const bare = buildFreeHomeContent({ businessName: '  <b>Raj</b> Works ', categoryText: null, track: 'banking' });
    expect(bare.tagline).toBe('bRaj/b Works'); expect(bare.about).toContain('a local business'); expect(bare.services).toHaveLength(4);
    expect(placeLine({ city: 'Madurai', area: null, pincode: '62' })).toBe('Madurai');   // a pincode that is not six digits is dropped
  });
  it('gives each track its own general services', () => {
    expect(buildFreeHomeContent({ ...details, track: 'professional' }).services[0].name).toBe('Consultation');
    expect(buildFreeHomeContent({ ...details, track: 'ecommerce' }).services[0].name).toBe('Our products');
  });
});

function fakeDb(over: { cms?: Record<string, unknown> | null; products?: number } = {}) {
  const state = { cms: over.cms === undefined ? { vendorId: 'v1', businessName: 'Plumber Boy', tagline: null, about: null, extras: null, draft: null } : over.cms, products: over.products ?? 0, created: [] as unknown[], updates: [] as unknown[] };
  const prisma = {
    vendor: { findUnique: async () => ({ businessName: 'Plumber Boy', industry: CATEGORY }) },
    vendorCMS: { findUnique: async () => (state.cms ? { ...state.cms } : null), update: async ({ data }: { data: Record<string, unknown> }) => { state.updates.push(data); state.cms = { ...(state.cms as object), ...data }; return state.cms; } },
    vendorProduct: { count: async () => state.products, createMany: async ({ data }: { data: unknown[] }) => { state.created.push(...data); state.products += data.length; return { count: data.length }; } },
  };
  return { svc: new FreeHomeContentService(prisma as never), state };
}

describe('S1.2 the service fills only what is empty and is idempotent', () => {
  it('fills tagline, about and the services of the track, marked as sample', async () => {
    const { svc, state } = fakeDb();
    const p = await svc.ensure('v1', { track: 'handyman', city: 'Madurai' });
    expect(p!.fill).toEqual(['tagline', 'about', 'services']);
    const cms = state.cms as Record<string, unknown>;
    expect(cms.tagline).toBe('Home repair and trades in Madurai'); expect(String(cms.about)).toContain('Plumber Boy');
    expect(cms.extras).toEqual({ sample: { tagline: true, about: true } });
    expect(state.created).toHaveLength(4); expect(state.created[0]).toMatchObject({ vendorId: 'v1', active: true, price: null, customFields: { sample: 'true', samplePrice: 'true' } });
  });
  it('a second run (retry or republish) writes nothing', async () => {
    const { svc, state } = fakeDb();
    await svc.ensure('v1', { track: 'handyman' });
    const writes = state.updates.length; const made = state.created.length;
    const again = await svc.ensure('v1', { track: 'handyman' });
    expect(again!.fill).toEqual([]); expect(state.updates.length).toBe(writes); expect(state.created.length).toBe(made);
  });
  it('never replaces the vendor\'s own words or catalogue', async () => {
    const { svc, state } = fakeDb({ cms: { vendorId: 'v1', businessName: 'Plumber Boy', tagline: 'Fast taps', about: 'Our own story.', extras: null, draft: null }, products: 2 });
    const p = await svc.ensure('v1', { track: 'handyman' });
    expect(p!.fill).toEqual([]); expect(state.updates).toHaveLength(0); expect(state.created).toHaveLength(0);
  });
  it('a draft that holds the key empty is filled too, so the text is not hidden', async () => {
    const { svc, state } = fakeDb({ cms: { vendorId: 'v1', businessName: 'Plumber Boy', tagline: null, about: 'Own.', extras: null, draft: { tagline: '' } } });
    await svc.ensure('v1', { track: 'handyman' });
    expect((state.cms as { draft: { tagline: string } }).draft.tagline).toBe('Home repair and trades');
  });
  it('starter text that sits only in the draft is copied to the live column the legacy route reads, not replaced and not overwritten with generic text', async () => {
    const { svc, state } = fakeDb({ cms: { vendorId: 'v1', businessName: 'Plumber Boy', tagline: null, about: null, extras: null, draft: { tagline: 'Starter tagline', about: 'Starter about text for the trade.' } }, products: 3 });
    const p = await svc.ensure('v1', { track: 'handyman' });
    expect(p!.fill).toEqual([]); expect(p!.promote).toEqual(['tagline', 'about']);
    expect(state.cms).toMatchObject({ tagline: 'Starter tagline', about: 'Starter about text for the trade.' });
    expect((state.cms as { draft: { tagline: string } }).draft.tagline).toBe('Starter tagline');
    expect((await svc.ensure('v1', { track: 'handyman' }))!.promote).toEqual([]);
  });
  it('an unknown vendor does nothing', async () => {
    const svc = new FreeHomeContentService({ vendor: { findUnique: async () => null } } as never);
    expect(await svc.ensure('x')).toBeNull();
  });
});

/** The live vendor's document: published, no pack, no address, nothing written, category text typed. */
const thin = () => makeDoc('plumber', { vendor: { industry: CATEGORY, businessName: 'Plumber Boy' }, cms: { businessName: 'Plumber Boy', tagline: null, about: null, address: null, banner: null, portfolio: [], testimonials: [], pages: [], extras: null, packKey: null, whatsapp: null, facebook: null, googleMaps: null, businessHours: null }, items: [] });
const withContent = () => {
  const c = buildFreeHomeContent(details);
  const d = thin();
  d.cms!.tagline = c.tagline; d.cms!.about = c.about;
  d.items = c.services.map((s, i) => ({ id: `s${i}`, name: s.name, description: s.description, price: null, image: null, category: null, active: true, sample: true, samplePrice: true }));
  return d;
};
const homeHtml = async (w: ReturnType<typeof siteWorld>, id: string) => (await w.repo.pagesOf(id)).find((p) => p.path === '/')!.html;

describe('S1.2 and S1.5 the Free "Build a preview" page', () => {
  it('BEFORE (the live shape): no home content, so the page says nothing about the business and search engines are told HOME_CONTENT is missing', async () => {
    const w = siteWorld({ doc: thin(), level: 'FREE' });
    const { publication } = await w.build.build('v-plumber', { actor: OWNER });
    expect(publication.missingFieldsJson.map((m: { code: string }) => m.code)).toContain('HOME_CONTENT');
    expect(await homeHtml(w, publication.id)).not.toContain(CATEGORY);
  });
  it('AFTER: the preview is an information page with the business name, the category as typed, the place and the services', async () => {
    const w = siteWorld({ doc: withContent(), level: 'FREE' });
    const { publication } = await w.build.build('v-plumber', { actor: OWNER });
    const codes = publication.missingFieldsJson.map((m: { code: string }) => m.code);
    expect(codes).not.toContain('HOME_CONTENT');
    expect(codes).toEqual(expect.arrayContaining(['CLAIMED', 'VERIFIED_CONTACT']));   // still not indexable until claimed and verified
    expect(publication.indexable).toBe(false); expect(publication.indexHeader).toContain('noindex');
    const html = await homeHtml(w, publication.id);
    expect(html).toContain('Plumber Boy'); expect(html).toContain('Home repair and trades in Madurai'); expect(html).toContain('Anna Nagar, Madurai 625020');
    for (const s of TRACK_SERVICES.handyman) expect(html).toContain(s.name);
  });
  it('a Free page stays an information page: no form, button, mailto or tel link, and never the e-mail', async () => {
    const w = siteWorld({ doc: withContent(), level: 'FREE' });
    const { publication } = await w.build.build('v-plumber', { actor: OWNER });
    for (const p of await w.repo.pagesOf(publication.id)) {
      if (!p.html.startsWith('<!doctype html>')) continue;
      expect(p.html).not.toMatch(/<form\b|<button\b|href="mailto:|href="tel:|href="https:\/\/wa\.me/i);
      expect(p.html).not.toContain(w.state.doc!.vendor.email);
    }
  });
  it('rebuilding the same content is a no-op (republish creates no second version)', async () => {
    const w = siteWorld({ doc: withContent(), level: 'FREE' });
    const a = await w.build.build('v-plumber', { actor: OWNER });
    const b = await w.build.build('v-plumber', { actor: OWNER });
    expect(b.reused).toBe(true); expect(b.publication.id).toBe(a.publication.id);
  });
});

describe('S1.1 the legacy site route reads siteStatus: the trial site sets it LIVE before the build and puts it back if the site is not published', () => {
  const mk = (over: { publishFails?: boolean; status?: string } = {}) => {
    const log: string[] = [];
    const parts = new Map<unknown, unknown>([
      [SiteProvisioner, { createDraftSite: async () => { log.push('draft'); return { siteId: 's1' }; } }],
      [FreeHomeContentService, { ensure: async () => { log.push('content'); } }],
      [SiteBuildService, { build: async () => { log.push('build'); return { publication: { id: 'p', status: 'DRAFT_PREVIEW' } }; } }],
      [PublishService, { publish: async () => { log.push('publish'); if (over.publishFails) throw new Error('x'); return {}; } }],
      [PrismaService, { vendorCMS: { findUnique: async () => ({ siteStatus: over.status ?? 'DRAFT' }), update: async (a: { data: { siteStatus?: string } }) => { if (a.data.siteStatus) log.push("status:" + a.data.siteStatus); return {}; } } }],
    ]);
    return { site: new ModuleTrialSite({ get: (t: unknown) => parts.get(t) } as never), log };
  };
  const input = { vendorId: 'v1', track: 'handyman', category: CATEGORY, businessName: 'Plumber Boy', phone: null };
  it('runs draft, content, LIVE, build, publish (LIVE first: the build hashes the row, so a later change would make the next retry a second version)', async () => {
    const { site, log } = mk();
    await site.createLiveTrialSite(input);
    expect(log).toEqual(['draft', 'content', 'status:LIVE', 'build', 'publish']);
  });
  it('a row that is already LIVE is not written', async () => {
    const { site, log } = mk({ status: 'LIVE' });
    await site.createLiveTrialSite(input);
    expect(log).toEqual(['draft', 'content', 'build', 'publish']);
  });
  it('a failed publish puts the previous status back, so an unpublished site is never shown', async () => {
    const { site, log } = mk({ publishFails: true });
    await expect(site.createLiveTrialSite(input)).rejects.toThrow();
    expect(log).toEqual(['draft', 'content', 'status:LIVE', 'build', 'publish', 'status:DRAFT']);
  });
});
