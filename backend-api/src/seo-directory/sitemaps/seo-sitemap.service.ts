import { Injectable } from '@nestjs/common';
import { DirectoryRepository } from '../../directory/directory.repository';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { SeoKeywordStore } from '../keywords/seo-keyword.store';
import { buildDirectoryRobots } from '../core/robots';
import { buildDirectoryLlms } from '../core/llms-directory';
import { buildSitemapIndex, buildUrlset, chunkCount, chunkFile, enumerateListingPaths, ListingPath, SITEMAP_CHUNK, SitemapEntry } from '../core/sitemap';
import { canonicalOrigin, directoryBase } from '../core/url-scheme';
import { SeoSettingsService } from '../settings/seo-settings.service';
import { loadPlaces } from '../pages/places';
import { SeoDirectoryData } from '../pages/seo-directory.data';

const TTL_MS = 300_000;

/**
 * The directory sitemaps (an index plus chunks of at most 10,000 urls) and the robots.txt of the main site. While directoryPagesIndexable is OFF the index and every chunk are empty and
 * the robots.txt has no Sitemap line. Listing pages come first (sorted by path), then the indexable business profiles (sorted by slug); a chunk is a slice of that one ordered list.
 */
@Injectable()
export class SeoSitemapService {
  clock: () => number = () => Date.now();
  private listingCache: { at: number; v: ListingPath[] } | null = null;

  constructor(
    private readonly data: SeoDirectoryData, private readonly repo: DirectoryRepository, private readonly keywords: SeoKeywordStore, private readonly settings: DirectorySettingsService,
    private readonly seo: SeoSettingsService,
  ) {}

  invalidate(): void { this.listingCache = null; }

  private async listingPaths(min: number): Promise<ListingPath[]> {
    const now = this.clock();
    if (this.listingCache && now - this.listingCache.at < TTL_MS) return this.listingCache.v;
    const [places, stats] = await Promise.all([loadPlaces(this.repo, this.keywords), this.data.groupStats()]);
    const v = enumerateListingPaths(places, stats, min);
    this.listingCache = { at: now, v };
    return v;
  }

  /** The listing pages that qualify for the sitemap (not thin, not empty), whether or not the directory pages are switched on: the keyword plan and the backlink block read this list. */
  async listing(): Promise<ListingPath[]> { return this.listingPaths((await this.settings.get()).directoryThinPageMinBusinesses); }

  private async origin(): Promise<string> { return directoryBase(process.env, canonicalOrigin(await this.settings.readPublicAppUrl())).origin; }   // Wave 3 Part J: the sitemap, robots and llms use the directory's own host when DIRECTORY_PUBLIC_BASE_URL is set

  /** The sitemap index. Empty (a valid empty index) while the directory pages are not indexable. */
  async index(): Promise<string> {
    const s = await this.settings.get();
    if (!s.directoryPagesIndexable) return buildSitemapIndex([]);
    const [paths, meta, origin] = await Promise.all([this.listingPaths(s.directoryThinPageMinBusinesses), this.data.indexableBusinessMeta(), this.origin()]);
    const total = paths.length + meta.total;
    const newest = [...paths.map((p) => p.lastmod), ...(meta.newest ? [meta.newest] : [])].reduce<Date | null>((a, d) => (!a || d > a ? d : a), null) ?? new Date(0);
    const entries: SitemapEntry[] = Array.from({ length: chunkCount(total) }, (_, i) => ({ loc: `${origin}/sitemaps/${chunkFile(i + 1)}`, lastmod: newest }));
    return buildSitemapIndex(entries);
  }

  /** One chunk, 1-based. Empty urlset while not indexable; null (404) for a chunk beyond the last. */
  async chunk(n: number): Promise<string | null> {
    const s = await this.settings.get();
    if (!s.directoryPagesIndexable) return buildUrlset([]);
    const [paths, meta, origin] = await Promise.all([this.listingPaths(s.directoryThinPageMinBusinesses), this.data.indexableBusinessMeta(), this.origin()]);
    const total = paths.length + meta.total;
    if (n < 1 || n > Math.max(1, chunkCount(total))) return null;
    const from = (n - 1) * SITEMAP_CHUNK; const to = Math.min(total, from + SITEMAP_CHUNK);
    const entries: SitemapEntry[] = paths.slice(from, to).map((p) => ({ loc: `${origin}${p.path}`, lastmod: p.lastmod }));
    if (to > paths.length) {
      const skip = Math.max(0, from - paths.length);
      const rows = await this.data.indexableBusinesses(skip, to - Math.max(from, paths.length));
      entries.push(...rows.map((r) => ({ loc: `${origin}/business/${r.slug}`, lastmod: r.updatedAt })));
    }
    return buildUrlset(entries);
  }

  /** The robots.txt text of the main site. The Sitemap line only while the directory pages are indexable. */
  async robots(): Promise<string> {
    const [s, crawlers, origin] = await Promise.all([this.settings.get(), this.seo.crawlers(), this.origin()]);
    return buildDirectoryRobots({ crawlers, indexable: s.directoryPagesIndexable, sitemapUrl: origin ? `${origin}/sitemap.xml` : '' });
  }

  /** The global llms.txt: what the directory is, the categories and cities that have a page, the sitemap link. null (404) while the directory pages are not indexable. */
  async llms(): Promise<string | null> {
    const s = await this.settings.get();
    if (!s.directoryPagesIndexable) return null;
    const [paths, origin] = await Promise.all([this.listingPaths(s.directoryThinPageMinBusinesses), this.origin()]);
    const top = (type: 'category' | 'city') => paths.filter((p) => p.ctx.type === type).sort((a, b) => b.count - a.count || (a.path < b.path ? -1 : 1));
    return buildDirectoryLlms({
      origin, sitemapUrl: origin ? `${origin}/sitemap.xml` : '',
      categories: top('category').map((p) => ({ name: p.ctx.cat?.plural ?? '', path: p.path })), cities: top('city').map((p) => ({ name: p.ctx.cityName ?? '', path: p.path })),
    });
  }

  /** Staff monitoring: the live, indexable vendor subdomain home URLs. */
  async vendorSites(skip: number, take: number): Promise<{ items: Array<{ url: string; publishedAt: string | null }>; total: number }> {
    const base = (process.env.SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();
    const r = await this.data.publishedIndexableSites(skip, take);
    return { items: r.items.map((i) => ({ url: `https://${i.subdomain.toLowerCase()}.${base}/`, publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null })), total: r.total };
  }
}
