import { ManagedDoc } from '../core/managed-doc';
import { SeoWho } from '../core/seo-core';

/**
 * A projector copies something out of a vendor's LIVE content document into a table staff can query (per-page SEO, location, the review link, testimonials). The published document stays
 * the only source of truth; a projection is rebuilt, never edited, and runs after a version goes live (a publish, an approval, a restore). A projector fault is logged and never undoes
 * the publish: the next publish rebuilds the rows.
 */
export interface ProjectionCtx {
  vendorId: string;
  /** the publication version that just went live */
  version: number;
  /** the live managed content document */
  doc: ManagedDoc;
  who: SeoWho;
  /** every page key of the live site: the standard pages the theme has, the enabled extra pages (page:<slug>) and the active items (item:<id>) */
  pageKeys: string[];
}

export abstract class LiveProjector {
  abstract project(c: ProjectionCtx): Promise<void>;
}

export const LIVE_PROJECTORS = 'WEBSITE_LIVE_PROJECTORS';
