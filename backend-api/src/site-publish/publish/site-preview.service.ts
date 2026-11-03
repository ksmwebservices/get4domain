import { Injectable, NotFoundException } from '@nestjs/common';
import { siteError } from '../site.errors';
import { contentTypeFor, isPlatformFile } from './site-config';
import { SiteRepository } from './site.repository';

const notFound = (): NotFoundException => new NotFoundException(siteError('PUBLICATION_NOT_FOUND', 'That version of the site does not exist.'));

export interface PreviewPage { html: string; contentType: string }

/**
 * One stored page of one publication, for the owner's or staff's preview. A publication that belongs to another vendor, an unknown id and an unknown path
 * are the same PUBLICATION_NOT_FOUND. The controllers add the preview-only headers; nothing here is ever served publicly.
 */
@Injectable()
export class SitePreviewService {
  constructor(private readonly repo: SiteRepository) {}

  async page(vendorId: string, publicationId: string, path: string, previewBase: string): Promise<PreviewPage> {
    const pub = await this.repo.getPublication(publicationId);
    if (!pub || pub.vendorId !== vendorId) throw notFound();
    const p = `/${String(path ?? '/').replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
    if (p.length > 300 || p.includes('..')) throw notFound();
    const lang = !isPlatformFile(p) && (p === '/ta' || p.startsWith('/ta/')) ? 'ta' : 'en';
    const page = await this.repo.getPage(pub.id, p, lang);
    if (!page) throw notFound();
    const contentType = (page.seoJson.contentType as string | undefined) ?? contentTypeFor(p);
    return { html: forPreview(page.html, previewBase), contentType };
  }
}

/**
 * Pages link one shared stylesheet by a root-relative address that only exists on the vendor's own host. In a preview that address is the preview route of
 * the same publication, so the page is styled. Only that one link is rewritten; the stored snapshot is not changed.
 */
export function forPreview(html: string, previewBase: string): string {
  return html.replace('<link rel="stylesheet" href="/assets/site.css">', `<link rel="stylesheet" href="${previewBase}/${encodeURIComponent('/assets/site.css')}">`);
}
