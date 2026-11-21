import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { buildBacklinkBlock } from '../src/seo-directory/core/backlink-block';
import { badgeEmbedHtml, badgeTextLink } from '../src/seo-directory/core/badge';
import { Stat } from '../src/seo-directory/core/sitemap';
import { clickOutUrl, directoryBase } from '../src/seo-directory/core/url-scheme';
import { SeoBacklinkService } from '../src/seo-directory/backlinks/seo-backlink.service';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { SeoSitemapService } from '../src/seo-directory/sitemaps/seo-sitemap.service';

/**
 * Wave 4 W1 (HOSTNAMES_PLAN section (a), items A to F): the sitemap index and chunks, the robots Sitemap line, llms.txt, the badge and the backlink block, in BOTH modes.
 * Mode 1: DIRECTORY_PUBLIC_BASE_URL set, so the directory pages are on their own host and the brand stays on the main host. Mode 2: unset, one origin, the old behaviour.
 * (The page model itself is tested in seo-pages.spec.ts.)
 */
const MAIN = 'https://get4domain.com'; const DIR = 'https://directory.get4domain.com';
const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder: 0, proposed: false, active: true });
const cat = (id: string, name: string, slug: string): CategoryRow => ({ id, parentId: null, parentKey: 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder: 0, proposed: false, active: true });
const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur')];
const CATS = [cat('plm', 'Plumber', 'plumber')];
const KW: KeywordRow[] = [{ id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }];
class Kw extends SeoKeywordStore { async list() { return { items: [], total: 0 }; } async all() { return KW; } async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; } }
const stat = (locationId: string, categoryId: string, count: number): Stat => ({ locationId, categoryId, count, pincode: null, lastmod: new Date('2026-11-01T00:00:00Z') });
const settingsOf = (indexable: boolean) => ({ get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: indexable }), readPublicAppUrl: async () => 'https://www.get4domain.com' });
const repo = { listLocations: async () => LOCS, listCategories: async () => CATS };
const sitemaps = (indexable: boolean) => new SeoSitemapService({
  groupStats: async () => [stat('per', 'plm', 5), stat('chn', 'plm', 5)], indexableBusinessMeta: async () => ({ total: 1, newest: new Date('2026-11-02T00:00:00Z') }),
  indexableBusinesses: async () => [{ slug: 'ranjith-plumber', updatedAt: new Date('2026-11-02T00:00:00Z') }],
} as never, repo as never, new Kw(), settingsOf(indexable) as never, { crawlers: async () => ['GPTBot'] } as never);

const withEnv = async (v: string | undefined, fn: () => Promise<void>): Promise<void> => {
  const old = process.env.DIRECTORY_PUBLIC_BASE_URL;
  if (v === undefined) delete process.env.DIRECTORY_PUBLIC_BASE_URL; else process.env.DIRECTORY_PUBLIC_BASE_URL = v;
  try { await fn(); } finally { if (old === undefined) delete process.env.DIRECTORY_PUBLIC_BASE_URL; else process.env.DIRECTORY_PUBLIC_BASE_URL = old; }
};
const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
// A page prefix: "/directory" not preceded by "/v3" (the API route /v3/directory/badge is legitimately an asset path).
const PREFIX = /(?<!\/v3)\/directory(?![.\w-])/;

describe('sitemaps, robots and llms.txt', () => {
  it('directory host set: the index, every chunk url, the robots Sitemap line and the llms links are all on the directory host with no /directory prefix', async () => {
    await withEnv(DIR, async () => {
      const s = sitemaps(true);
      const idx = await s.index(); expect(locs(idx).length).toBeGreaterThan(0); expect(locs(idx).every((u) => u.startsWith(`${DIR}/sitemaps/`))).toBe(true);
      const chunk = (await s.chunk(1))!; const urls = locs(chunk);
      expect(urls).toContain(`${DIR}/chennai`); expect(urls).toContain(`${DIR}/business/ranjith-plumber`); expect(urls.every((u) => u.startsWith(`${DIR}/`))).toBe(true);
      const robots = await s.robots(); expect(robots).toContain(`Sitemap: ${DIR}/sitemap.xml`); expect(robots).not.toContain(MAIN);
      const llms = (await s.llms())!; expect(llms).toContain(`${DIR}/chennai`);
      for (const t of [idx, chunk, robots, llms]) expect(t).not.toMatch(PREFIX);
    });
  });
  it('unset: all of it on the one main origin, as before', async () => {
    await withEnv(undefined, async () => {
      const s = sitemaps(true);
      expect(locs(await s.index()).every((u) => u.startsWith(`${MAIN}/sitemaps/`))).toBe(true);
      expect(locs((await s.chunk(1))!).every((u) => u.startsWith(`${MAIN}/`))).toBe(true);
      expect(await s.robots()).toContain(`Sitemap: ${MAIN}/sitemap.xml`);
      expect((await s.llms())!).toContain(`${MAIN}/chennai`);
    });
  });
  it('directoryPagesIndexable OFF: empty index and chunk, no Sitemap line, no llms.txt, in either mode (the default stays off)', async () => {
    expect(DEFAULT_DIRECTORY_SETTINGS.directoryPagesIndexable).toBe(false);
    for (const v of [DIR, undefined]) {
      await withEnv(v, async () => {
        const s = sitemaps(false);
        expect(locs(await s.index())).toEqual([]); expect(locs((await s.chunk(1))!)).toEqual([]);
        expect(await s.robots()).not.toContain('Sitemap:'); expect(await s.llms()).toBeNull();
      });
    }
  });
});

describe('the backlink block and the badge', () => {
  const pages = [
    { kind: 'cityCategory' as const, path: '/chennai/plumbers', place: 'Chennai', plural: 'Plumbers', singular: 'Plumber' },
    { kind: 'city' as const, path: '/chennai', place: 'Chennai' },
  ];
  it('the brand link goes to the MAIN origin and the directory links to the DIRECTORY origin (two different origins)', () => {
    const b = buildBacklinkBlock({ origin: DIR, brandOrigin: MAIN, seed: 'b1', pages, listed: null, indexable: true });
    expect(b.brand.href).toBe(`${MAIN}/`);
    expect(b.links.length).toBe(2); expect(b.links.every((l) => l.href.startsWith(`${DIR}/`))).toBe(true);
    expect(b.html).toContain(`href="${MAIN}/"`); expect(b.html).toContain(`href="${DIR}/chennai/plumbers"`); expect(b.html).not.toMatch(PREFIX);
  });
  it('no brandOrigin: the brand link follows the one origin, exactly as before', () => {
    expect(buildBacklinkBlock({ origin: MAIN, seed: 'b1', pages, listed: null, indexable: true }).brand.href).toBe(`${MAIN}/`);
  });
  it('the badge and the text link point at the profile on the directory origin', () => {
    const html = badgeEmbedHtml({ origin: DIR, apiBase: 'https://api.get4domain.com', businessId: 'b1', slug: 'ranjith-plumber' });
    expect(html).toContain(`href="${DIR}/business/ranjith-plumber"`);
    expect(badgeTextLink({ origin: DIR, slug: 'ranjith-plumber', name: 'Ranjith Plumber' }).url).toBe(`${DIR}/business/ranjith-plumber`);
  });
  it('SeoBacklinkService: with the directory host set the block and the snippet use both origins correctly; unset, one origin; switched off, only the brand link', async () => {
    const biz = { id: 'b1', slug: 'ranjith-plumber', name: 'Ranjith Plumber', status: 'CLAIMED', categoryId: 'plm', locationId: 'per' };
    const mk = (indexable: boolean) => new SeoBacklinkService({ getBusiness: async () => biz, listLocations: async () => LOCS, listCategories: async () => CATS } as never, settingsOf(indexable) as never, sitemaps(indexable), new Kw());
    await withEnv(DIR, async () => {
      const svc = mk(true); const block = (await svc.block('b1'))!;
      expect(block.brand.href).toBe(`${MAIN}/`); expect(block.links.length).toBeGreaterThan(0); expect(block.links.every((l) => l.href.startsWith(`${DIR}/`))).toBe(true);
      const e = (await svc.embed('b1'))!; expect(e.profileUrl).toBe(`${DIR}/business/ranjith-plumber`); expect(e.html).not.toMatch(PREFIX);
    });
    await withEnv(undefined, async () => {
      const block = (await mk(true).block('b1'))!;
      expect(block.brand.href).toBe(`${MAIN}/`); expect(block.links.every((l) => l.href.startsWith(`${MAIN}/`))).toBe(true);
      expect((await mk(true).embed('b1'))!.profileUrl).toBe(`${MAIN}/business/ranjith-plumber`);
    });
    await withEnv(DIR, async () => { expect((await mk(false).block('b1'))!.links).toEqual([]); });
  });
});

describe('directoryBase and the click-out', () => {
  it('the click-out url is on the API host and does not depend on the directory host', () => {
    expect(clickOutUrl('https://api.get4domain.com', 'b1', { src: 'city' })).toBe('https://api.get4domain.com/v3/go/b1?src=city');
    expect(directoryBase({ DIRECTORY_PUBLIC_BASE_URL: DIR }, MAIN)).toEqual({ origin: DIR, homePath: '/', dedicated: true });
  });
});
