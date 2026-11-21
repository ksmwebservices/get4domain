import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirectoryRepository } from '../../directory/directory.repository';
import { VendorDirectoryFacts, VendorDirectoryFactsPort } from '../../site-publish/seo/vendor-directory-facts';
import { SeoKeywordStore } from '../keywords/seo-keyword.store';
import { loadPlaces, Places } from '../pages/places';
import { SeoBacklinkService } from './seo-backlink.service';

type PlaceFacts = Omit<VendorDirectoryFacts, 'directoryLinks'>;
interface Listing { categoryId: string; locationId: string | null; pincode?: string | null }

/**
 * The directory facts of a vendor for the site build and the staff SEO report (see site-publish/seo/vendor-directory-facts.ts). Read only. The place comes from the listing's location chain
 * (a LOCALITY and a CITY or DISTRICT); the keywords are the category's own words. Nothing is guessed: a vendor with no listing is simply absent.
 */
@Injectable()
export class SeoVendorDirectoryFacts extends VendorDirectoryFactsPort {
  constructor(private readonly prisma: PrismaService, private readonly repo: DirectoryRepository, private readonly keywords: SeoKeywordStore, private readonly backlinks: SeoBacklinkService) { super(); }

  private async facts(rows: readonly Listing[]): Promise<PlaceFacts[]> {
    const [pl, kws] = await Promise.all([loadPlaces(this.repo, this.keywords), this.keywords.all()]);
    const bySlug = new Map(kws.map((k) => [k.categorySlug, k]));
    return rows.map((r) => this.one(pl, bySlug, r));
  }

  private one(pl: Places, bySlug: ReadonlyMap<string, { synonyms: string[] }>, r: Listing): PlaceFacts {
    let cur = r.locationId ? pl.locs.find((l) => l.id === r.locationId) : undefined; let g = 0; let locality: string | null = null; let city: string | null = null;
    while (cur && g++ < 10) {
      if (!locality && cur.kind === 'LOCALITY') locality = cur.name;
      if (!city && (cur.kind === 'CITY' || cur.kind === 'DISTRICT')) city = cur.name;
      cur = cur.parentId ? pl.locs.find((l) => l.id === cur!.parentId) : undefined;
    }
    const info = pl.catInfo.get(r.categoryId);
    const terms = info ? [info.row.name, info.singular, info.plural, ...(bySlug.get(info.row.slug)?.synonyms ?? [])] : [];
    return { locality, city, pincode: r.pincode ?? null, keywords: [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))] };
  }

  async forVendor(vendorId: string): Promise<VendorDirectoryFacts | null> {
    const b = await this.backlinks.listedOfVendor(vendorId);
    if (!b) return null;
    const [f] = await this.facts([{ categoryId: b.categoryId, locationId: b.locationId, pincode: (b.address as { pin?: string }).pin ?? null }]);
    const block = await this.backlinks.blockOf(b);
    return { ...f, directoryLinks: { brand: block.brand, links: block.links } };
  }

  async forVendors(vendorIds: readonly string[]): Promise<Map<string, PlaceFacts>> {
    const out = new Map<string, PlaceFacts>();
    const ids = [...new Set(vendorIds)].slice(0, 5000);
    if (!ids.length) return out;
    const rows = await this.prisma.v3DirectoryBusiness.findMany({ where: { vendorId: { in: ids }, status: { in: ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'] } }, select: { vendorId: true, categoryId: true, locationId: true, pincode: true } });
    const facts = await this.facts(rows);
    rows.forEach((r, i) => { if (r.vendorId) out.set(r.vendorId, facts[i]); });
    return out;
  }
}
