import { LISTING_STATES, publicStateOf } from '../src/directory/core/listing-state';
import { publicBusinessView } from '../src/directory/directory-views';
import { directoryWorld } from './support/directory-world';

/** Wave 2, public site gap G4 on the directory's own public view (the page model's side is in seo-pages.spec.ts). */
describe('the public listing state', () => {
  it('the word list is the four the public site expects, and the rule is: not claimed, claimed, claimed with a published site', () => {
    expect([...LISTING_STATES]).toEqual(['UNCLAIMED_LISTING', 'DRAFT_SITE', 'CLAIMED', 'LIVE']);
    expect(publicStateOf(false, false)).toBe('UNCLAIMED_LISTING'); expect(publicStateOf(false, true)).toBe('UNCLAIMED_LISTING');   // a site never makes an unclaimed listing live
    expect(publicStateOf(true, false)).toBe('CLAIMED'); expect(publicStateOf(true, true)).toBe('LIVE');
    for (const a of [true, false]) for (const b of [true, false]) expect(publicStateOf(a, b)).not.toBe('DRAFT_SITE');
  });
  it('PublicBusinessView carries listingState: unclaimed, claimed with no site address, claimed with one', async () => {
    const w = await directoryWorld();
    const un = await w.biz({ name: 'Un Co', status: 'UNCLAIMED' }); const cl = await w.biz({ name: 'Cl Co' });
    const ctx = (siteUrl: string | null) => ({ category: null, location: [], services: [], media: [], site: { siteUrl, siteState: siteUrl ? 'PRO' : 'CLAIMED_FREE', badges: [] } }) as never;
    expect(publicBusinessView(un, ctx(null)).listingState).toBe('UNCLAIMED_LISTING'); expect(publicBusinessView(un, ctx('https://x.get4domain.com')).listingState).toBe('UNCLAIMED_LISTING');
    expect(publicBusinessView(cl, ctx(null)).listingState).toBe('CLAIMED'); expect(publicBusinessView(cl, ctx('https://x.get4domain.com')).listingState).toBe('LIVE');
    expect(publicBusinessView(cl, { category: null, location: [], services: [], media: [] } as never).listingState).toBe('CLAIMED');
  });
  it('the read service sends it on the list and the detail', async () => {
    const w = await directoryWorld(); const b = await w.biz({ name: 'Read Co' });
    const list = await w.read.list({}); expect(list.items.map((i) => i.listingState)).toEqual(['CLAIMED']);
    const d = await w.read.detail(b.slug); expect(d && !d.gone && d.business.listingState).toBe('CLAIMED');
  });
});
