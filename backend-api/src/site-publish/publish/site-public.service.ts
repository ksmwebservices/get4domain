import { Inject, Injectable, Optional } from '@nestjs/common';
import { B3SettingsService } from '../../b3-settings/b3-settings.service';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { ThemeRenderService } from '../renderer/theme-render.service';
import { contentTypeFor, isPlatformFile, sha256 } from './site-config';
import { SiteRepository } from './site.repository';

/** Finds the vendor behind a host name (slice 5.6: the domain tables; a non-primary host also carries the redirect to the canonical one). */
export abstract class HostResolver {
  /** null for an unknown host and for a suspended vendor (the caller cannot tell them apart). */
  abstract resolve(host: string): Promise<{ vendorId: string; /** the one canonical host of the site (slice 5.6b) */ canonicalHost?: string; redirect?: { host: string; status: 301 | 302 } } | null>;
}

export interface PublicRedirect { status: 301 | 302; location: string }
export interface PublicPage { status: 200; html: string; etag: string; robots: string; contentType: string; lang: string; /** the canonical host of the site the page belongs to (owner rule 4) */ canonicalHost: string | null }

/**
 * The strictly read-only lookup used by the Next.js app and, later, the host mapper: the PUBLISHED snapshot of the vendor behind a host, one page of it.
 * Preview rows are never reachable. Everything that is not a published page (unknown host, suspended vendor, nothing published, unknown path) is the same null.
 */
@Injectable()
export class SitePublicService {
  constructor(
    private readonly repo: SiteRepository, private readonly hosts: HostResolver,
    /** slice 5.1d / 5.4b: when present, a page is served listing-only whenever the vendor's CURRENT entitlements have no site.cta (plan lapsed, suspended), whatever was published */
    @Optional() @Inject(EntitlementsService) private readonly ents?: Pick<EntitlementsService, 'resolve'>,
    @Optional() @Inject(B3SettingsService) private readonly b3?: Pick<B3SettingsService, 'get'>,
    @Optional() private readonly themes?: Pick<ThemeRenderService, 'kitApi'>,
  ) {}

  /** The page, or null: exactly as before slice 5.6 (a redirect is not a page). */
  async byHost(host: string, path: string, lang: string): Promise<PublicPage | null> {
    const r = await this.lookup(host, path, lang);
    return r && r.status === 200 ? r : null;
  }

  /** A page, a redirect to the vendor's canonical host (the path is kept), or null. */
  async lookup(host: string, path: string, lang: string): Promise<PublicPage | PublicRedirect | null> {
    const h = String(host ?? '').trim().toLowerCase().split(':')[0];
    if (!h || h.length > 253) return null;
    const vendor = await this.hosts.resolve(h);
    if (!vendor) return null;
    if (vendor.redirect) {
      const keep = `/${String(path ?? '/').split('?')[0].replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
      if (keep.length > 300 || keep.includes('..')) return null;
      return { status: vendor.redirect.status, location: `https://${vendor.redirect.host}${keep === '/' ? '/' : keep}` };
    }
    const current = await this.repo.currentPublication(vendor.vendorId);
    if (!current) return null;
    let p = `/${String(path ?? '/').split('?')[0].replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
    if (p.length > 300 || p.includes('..')) return null;
    let l: 'en' | 'ta' = lang === 'ta' || p === '/ta' || p.startsWith('/ta/') ? 'ta' : 'en';
    if (isPlatformFile(p)) l = 'en';
    else if (l === 'ta' && !(p === '/ta' || p.startsWith('/ta/'))) p = `/ta${p === '/' ? '' : p}`;
    const page = await this.repo.getPage(current.id, p, l);
    if (!page) return null;
    const robots = isPlatformFile(p) ? '' : current.indexHeader;
    const contentType = (page.seoJson.contentType as string | undefined) ?? contentTypeFor(p);
    let html = page.html; let etag = `"${page.sha256}"`;
    if (this.ents && this.themes && contentType.startsWith('text/html')) {
      // The stored page is never changed or deleted. If the vendor can no longer have calls to action (plan lapsed, suspended), the SAME stored page is served as a listing
      // from this moment; when Pro is active again the stored Pro page is served untouched. The entitlement answer is the engine's own (kept 30 seconds, dropped on every write).
      const e = await this.ents.resolve(vendor.vendorId);
      if (e.features['site.cta']?.state !== 'ACTIVE') {
        const t = this.b3 ? await this.b3.get() : null;
        const out = this.themes.kitApi.listingOnlyHtml(html, t ? { listedOn: t.listedOnLineText, footerBridge: t.siteFooterBridgeText } : {});
        if (out !== html) { html = out; etag = `"${sha256(out)}"`; }
      }
    }
    return { status: 200, html, etag, robots, contentType, lang: l, canonicalHost: vendor.canonicalHost ?? null };
  }
}
