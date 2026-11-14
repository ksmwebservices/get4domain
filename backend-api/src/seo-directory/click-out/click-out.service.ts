import { Injectable, Logger } from '@nestjs/common';
import { dayOf } from '../../directory/core/visits';
import { DirectoryVisitService } from '../../directory/directory-visit.service';
import { clickContext, safeSubdomainUrl } from './click-out';
import { SeoClickStore } from './click-store';

/**
 * GET /v3/go/{businessId}: counts the Visit-site click (the existing daily counter, no visitor data), adds the aggregate click row (page type, category, location, keyword target), and returns
 * the address to redirect to: ALWAYS the vendor's get4domain subdomain. It never consults the custom domain or the canonical switch, so the add-on cannot change where this goes (the
 * subdomain itself then 301s to the custom domain while the add-on is active: see V3_SEO_DIRECTORY.md). null = one uniform 404 (unknown, not listed, no subdomain site, unsafe address).
 */
@Injectable()
export class ClickOutService {
  private readonly log = new Logger('SeoClickOut');
  clock: () => Date = () => new Date();
  constructor(private readonly visits: DirectoryVisitService, private readonly clicks: SeoClickStore) {}

  async go(businessId: string, src: unknown, kw: unknown, ip: string | null): Promise<string | null> {
    const r = await this.visits.visitById(businessId, ip);
    if (!r) return null;
    const url = safeSubdomainUrl(r.url, process.env.SITE_BASE_DOMAIN || 'get4domain.com');
    if (!url) return null;
    const c = clickContext(src, kw);
    try { await this.clicks.increment({ day: dayOf(this.clock()), pageType: c.pageType, categoryId: r.business.categoryId, locationId: r.business.locationId, keywordTargetId: c.keywordTargetId }); }
    catch (e) { this.log.warn(`click aggregate not recorded: ${(e as Error).message.slice(0, 120)}`); }   // a failed aggregate never blocks the visitor
    return url;
  }
}
