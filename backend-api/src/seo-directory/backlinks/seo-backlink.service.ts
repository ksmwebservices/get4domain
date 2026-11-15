import { Injectable } from '@nestjs/common';
import { BusinessRow, DirectoryRepository } from '../../directory/directory.repository';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { badgeEmbedHtml, badgeSvg, badgeTextLink } from '../core/badge';
import { BacklinkBlock, BacklinkPage, buildBacklinkBlock } from '../core/backlink-block';
import { canonicalOrigin } from '../core/url-scheme';
import { SeoKeywordStore } from '../keywords/seo-keyword.store';
import { loadPlaces } from '../pages/places';
import { SeoSitemapService } from '../sitemaps/seo-sitemap.service';

const LISTED = new Set(['CLAIMED', 'UNCLAIMED', 'SUSPENDED']);

/**
 * The backlink block and the badge of ONE listed business. Both answer null (one uniform 404) for a business that is unknown, removed, a draft, or has no stable id shape: a removed
 * business must stop showing either at once. Nothing is stored and nothing is written.
 */
@Injectable()
export class SeoBacklinkService {
  constructor(
    private readonly repo: DirectoryRepository, private readonly settings: DirectorySettingsService, private readonly sitemaps: SeoSitemapService, private readonly keywords: SeoKeywordStore,
  ) {}

  private async listed(id: string) {
    const key = String(id ?? '').trim().slice(0, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) return null;
    const b = await this.repo.getBusiness(key);
    return b && LISTED.has(b.status) ? b : null;
  }

  /** The block for a business: one brand link and up to four directory links with rotating anchors. The directory links appear only while the directory pages are switched on. */
  async block(id: string): Promise<BacklinkBlock | null> {
    const b = await this.listed(id);
    return b ? this.blockOf(b) : null;
  }

  /** The business of a vendor, when it is listed (the vendor's own badge and the site build use this). */
  async listedOfVendor(vendorId: string): Promise<BusinessRow | null> {
    const b = await this.repo.getBusinessByVendor(vendorId);
    return b && LISTED.has(b.status) ? b : null;
  }

  async blockOf(b: BusinessRow): Promise<BacklinkBlock> {
    const [s, appUrl, listing, places] = await Promise.all([this.settings.get(), this.settings.readPublicAppUrl(), this.sitemaps.listing(), loadPlaces(this.repo, this.keywords)]);
    const origin = canonicalOrigin(appUrl);
    const chain: Array<{ id: string; kind: string }> = []; let cur = b.locationId ? places.locs.find((l) => l.id === b.locationId) : undefined; let g = 0;
    while (cur && g++ < 10) { chain.push({ id: cur.id, kind: cur.kind }); cur = cur.parentId ? places.locs.find((l) => l.id === cur!.parentId) : undefined; }
    const localityIds = new Set(chain.filter((c) => c.kind === 'LOCALITY').map((c) => c.id));
    const cityIds = new Set(chain.filter((c) => c.kind === 'CITY' || c.kind === 'DISTRICT').map((c) => c.id));
    const pages: BacklinkPage[] = [];
    for (const l of listing) {
      const c = l.ctx; const cat = c.cat;
      if (!cat || c.catId !== b.categoryId) continue;   // only pages about this business's own category
      if (c.type === 'cityCategory' && c.cityId && cityIds.has(c.cityId)) pages.push({ kind: 'cityCategory', path: l.path, place: c.cityName, plural: cat.plural, singular: cat.singular });
      else if (c.type === 'localityCategory' && c.localityId && localityIds.has(c.localityId)) pages.push({ kind: 'localityCategory', path: l.path, place: c.localityName, city: c.cityName, plural: cat.plural, singular: cat.singular });
      else if (c.type === 'localityCategory' && c.cityId && cityIds.has(c.cityId)) pages.push({ kind: 'nearbyLocality', path: l.path, place: c.localityName, city: c.cityName, plural: cat.plural, singular: cat.singular });   // another neighbourhood of the same city
      else if (c.type === 'category') pages.push({ kind: 'category', path: l.path, plural: cat.plural, singular: cat.singular });
    }
    for (const l of listing) if (l.ctx.type === 'city' && l.ctx.cityId && cityIds.has(l.ctx.cityId)) pages.push({ kind: 'city', path: l.path, place: l.ctx.cityName });
    return buildBacklinkBlock({ origin, seed: b.id, pages, listed: null, indexable: s.directoryPagesIndexable });
  }

  /** The badge picture for a listed business. The picture is the same for everyone; the business only decides whether it may be shown. */
  async badge(id: string): Promise<string | null> { return (await this.listed(id)) ? badgeSvg() : null; }

  /** The snippet the business pastes into its own page, and the plain text link for a bio or profile that cannot hold an image. */
  async embed(id: string): Promise<EmbedSnippet | null> {
    const b = await this.listed(id);
    return b ? this.embedOf(b) : null;
  }

  async embedOf(b: BusinessRow): Promise<EmbedSnippet> {
    const origin = canonicalOrigin(await this.settings.readPublicAppUrl());
    const apiBase = process.env.PUBLIC_API_URL ?? '';
    return {
      html: badgeEmbedHtml({ origin, apiBase, businessId: b.id, slug: b.slug }), imageUrl: `${apiBase.replace(/\/+$/, '')}/v3/directory/badge/${encodeURIComponent(b.id)}.svg`, profileUrl: `${origin}/business/${b.slug}`,
      text: badgeTextLink({ origin, slug: b.slug, name: b.name }),
    };
  }
}

export interface EmbedSnippet { html: string; imageUrl: string; profileUrl: string; text: { label: string; url: string; plain: string; html: string } }
