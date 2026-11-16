import { randomBytes } from 'crypto';
import { CampaignPagesService } from '../src/campaign-pages/campaign-pages.service';
import { campaignSlugSafe, CLICK_OUT_ID, isClickOutId } from '../src/seo-directory/click-out/click-out';
import { buildPath, parsePath, RESERVED_SEGMENTS } from '../src/seo-directory/core/url-scheme';

/** Wave 2, public site gaps G3 (the click-out id format, and a campaign slug that can never look like one) and G7 (reserved first segments). */
const cuid = (): string => `c${randomBytes(12).toString('hex')}`;   // c + 24 lower case hex characters: inside the cuid shape the database makes
const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c7d5e9a1b34';

describe('the click-out id format (G3)', () => {
  it('a business id (cuid: c and 24 lower case letters or digits) and a uuid are click-out ids', () => {
    for (let i = 0; i < 50; i++) expect(isClickOutId(cuid())).toBe(true);
    expect(isClickOutId('cm1abcdefghijklmnopqrstuv')).toBe(true); expect(isClickOutId(UUID)).toBe(true); expect(CLICK_OUT_ID.test(UUID.toUpperCase())).toBe(false);
  });
  it('anything else is not: a normal campaign slug, a short or long cuid, upper case, other letters, odd types', () => {
    for (const s of ['spring-sale', 'sri-ganesh-plumbing', 'c123', `c${'a'.repeat(23)}`, `c${'a'.repeat(25)}`, `d${'a'.repeat(24)}`, `c${'A'.repeat(24)}`, `c${'a'.repeat(23)}-`, '', UUID.slice(0, 35), `${UUID}-1`]) expect([s, isClickOutId(s)]).toEqual([s, false]);
    for (const v of [null, undefined, 5, {}, []]) expect(isClickOutId(v)).toBe(false);
  });
  it('a campaign slug with the shape of an id gets a fixed suffix; every other slug is left alone', () => {
    const c = cuid(); expect(campaignSlugSafe(c)).toBe(`${c}-page`); expect(isClickOutId(campaignSlugSafe(c))).toBe(false);
    expect(campaignSlugSafe(UUID)).toBe(`${UUID}-page`); expect(isClickOutId(campaignSlugSafe(UUID))).toBe(false);
    expect(campaignSlugSafe('spring-sale')).toBe('spring-sale');
  });
  it('the campaign page service never stores a click-out shaped slug, whether it is chosen or comes from a title, and still makes the slug unique', async () => {
    const taken = new Set<string>(); const created: string[] = [];
    const prisma = { campaignPage: { findUnique: async ({ where }: { where: { slug: string } }) => (taken.has(where.slug) ? { id: where.slug } : null), create: async ({ data }: { data: { slug: string } }) => { created.push(data.slug); taken.add(data.slug); return data; } } };
    const svc = new CampaignPagesService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    const id = cuid();
    await svc.create('v1', { title: 'Any title', slug: id } as never); await svc.create('v1', { title: 'Any title', slug: id } as never); await svc.create('v1', { title: UUID } as never);
    expect(created).toEqual([`${id}-page`, `${id}-page-1`, `${UUID}-page`]);
    for (const s of created) expect(isClickOutId(s)).toBe(false);
  });
});

describe('reserved first segments (G7)', () => {
  it('legal, claim, account, directory and sitemaps are reserved, next to the ones that already were', () => {
    for (const s of ['legal', 'claim', 'account', 'directory', 'sitemaps', 'go', 'business', 'state', 'category', 'pincode']) expect(RESERVED_SEGMENTS).toContain(s);
  });
  it('a city page cannot be made at a reserved address: /legal, /claim, /account and /directory are no directory page', () => {
    for (const s of ['legal', 'claim', 'account', 'directory']) { expect([s, parsePath(`/${s}/plumbers`)]).toEqual([s, null]); expect([s, parsePath(`/${s}/page/2`)]).toEqual([s, null]); }
    expect(parsePath('/chennai')).toEqual({ type: 'city', city: 'chennai', page: 1 }); expect(parsePath('/chennai/plumbers')).toMatchObject({ type: 'cityRest', city: 'chennai' });
  });
  it('the paths of the pages that already existed are unchanged', () => {
    expect(buildPath({ type: 'city', city: 'chennai', page: 1 })).toBe('/chennai'); expect(buildPath({ type: 'business', slug: 'acme' })).toBe('/business/acme');
  });
});
