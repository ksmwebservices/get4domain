import { Injectable } from '@nestjs/common';
import { defaultPageSeo, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, seoIssues, SeoIssue } from '../core/seo-core';
import { LiveProjector, ProjectionCtx } from '../projection/live-projector';
import { WebsiteService } from '../website.service';
import { NewPageSeoRow, PageSeoRow, PageSeoStore } from './page-seo.store';

/** Writes the staff projection of per-page SEO when a version goes live: the vendor's own text where there is some, the platform default everywhere else, with a flag for which is which. */
@Injectable()
export class SeoProjector extends LiveProjector {
  constructor(private readonly store: PageSeoStore) { super(); }
  async project(c: ProjectionCtx): Promise<void> {
    const rows: NewPageSeoRow[] = c.pageKeys.map((pageKey) => {
      const def = defaultPageSeo(pageKey, c.who); const own = c.doc.seo[pageKey] ?? {};
      return { pageKey, seoTitle: own.seoTitle ?? def.seoTitle, seoDescription: own.seoDescription ?? def.seoDescription, shareImageRef: own.shareImageRef ?? null, customTitle: !!own.seoTitle, customDescription: !!own.seoDescription };
    });
    await this.store.replaceForVendor(c.vendorId, c.version, rows);
  }
}

export interface SeoPageView {
  pageKey: string; label: string; seoTitle: string; seoDescription: string; shareImageRef: string | null; isCustomTitle: boolean; isCustomDescription: boolean;
  slug: { value: string; editable: boolean }; defaults: { seoTitle: string; seoDescription: string };
}

/** The vendor's SEO panel (from the draft) and the staff reports (from the live projection). */
@Injectable()
export class SeoService {
  constructor(private readonly web: WebsiteService, private readonly store: PageSeoStore) {}

  async view(vendorId: string): Promise<{ pages: SeoPageView[]; limits: { title: number; description: number } }> {
    const c = await this.web.seoContext(vendorId);
    const pages = c.pages.map((p) => {
      const def = defaultPageSeo(p.pageKey, c.who); const own = c.doc.seo[p.pageKey] ?? {};
      return { pageKey: p.pageKey, label: p.label, seoTitle: own.seoTitle ?? def.seoTitle, seoDescription: own.seoDescription ?? def.seoDescription, shareImageRef: own.shareImageRef ?? null, isCustomTitle: !!own.seoTitle, isCustomDescription: !!own.seoDescription, slug: p.slug, defaults: def };
    });
    return { pages, limits: { title: SEO_TITLE_MAX, description: SEO_DESCRIPTION_MAX } };
  }

  /** What is live for one vendor (staff). */
  staffRows(vendorId: string): Promise<PageSeoRow[]> { return this.store.listForVendor(vendorId); }

  /** Pages with something to fix, across vendors or for one (staff). Duplicates are judged within one vendor's site. */
  async staffIssues(f: { vendorId?: string; issue?: SeoIssue['issue']; page: number; pageSize: number }): Promise<{ items: Array<SeoIssue & { vendorId: string }>; page: number; pageSize: number; total: number }> {
    const rows = await this.store.listAll(f.vendorId, 5000);
    const byVendor = new Map<string, PageSeoRow[]>();
    for (const r of rows) byVendor.set(r.vendorId, [...(byVendor.get(r.vendorId) ?? []), r]);
    const all = [...byVendor.entries()].flatMap(([vendorId, rs]) => seoIssues(rs).map((i) => ({ vendorId, ...i }))).filter((i) => !f.issue || i.issue === f.issue);
    return { items: all.slice((f.page - 1) * f.pageSize, f.page * f.pageSize), page: f.page, pageSize: f.pageSize, total: all.length };
  }
}
