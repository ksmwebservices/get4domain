import { Injectable } from '@nestjs/common';
import { contentTypeFor, isPlatformFile } from './site-config';
import { SiteRepository } from './site.repository';

/** Finds the vendor behind a host name. Today that is the vendor's subdomain; the domain tables arrive in slice 5.6 and replace the implementation. */
export abstract class HostResolver {
  /** null for an unknown host and for a suspended vendor (the caller cannot tell them apart). */
  abstract resolve(host: string): Promise<{ vendorId: string } | null>;
}

export interface PublicPage { status: 200; html: string; etag: string; robots: string; contentType: string; lang: string }

/**
 * The strictly read-only lookup used by the Next.js app and, later, the host mapper: the PUBLISHED snapshot of the vendor behind a host, one page of it.
 * Preview rows are never reachable. Everything that is not a published page (unknown host, suspended vendor, nothing published, unknown path) is the same null.
 */
@Injectable()
export class SitePublicService {
  constructor(private readonly repo: SiteRepository, private readonly hosts: HostResolver) {}

  async byHost(host: string, path: string, lang: string): Promise<PublicPage | null> {
    const h = String(host ?? '').trim().toLowerCase().split(':')[0];
    if (!h || h.length > 253) return null;
    const vendor = await this.hosts.resolve(h);
    if (!vendor) return null;
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
    return { status: 200, html: page.html, etag: `"${page.sha256}"`, robots, contentType: (page.seoJson.contentType as string | undefined) ?? contentTypeFor(p), lang: l };
  }
}
