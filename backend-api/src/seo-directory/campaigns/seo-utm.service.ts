import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { dayOf } from '../../directory/core/visits';
import { UtmCardinalityGuard, utmVisitOf } from '../core/utm-capture';
import { seoError } from '../seo-directory.errors';
import { SeoUtmStore, UtmReportRow } from './seo-utm.store';

export interface PageVisitInput { path?: unknown; utm_source?: unknown; utm_medium?: unknown; utm_campaign?: unknown; kw?: unknown }
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * UTM capture on directory page visits. The Next.js page reports a visit that arrived with utm parameters (a small beacon after the page loads, so crawlers that do not run scripts are never
 * counted). Only the reduced, validated aggregate is stored (see core/utm-capture.ts); a visit with no campaign information is ignored; a failed write never reaches the visitor.
 */
@Injectable()
export class SeoUtmService {
  private readonly log = new Logger('SeoUtm');
  clock: () => Date = () => new Date();
  private readonly guard = new UtmCardinalityGuard();
  constructor(private readonly store: SeoUtmStore) {}

  /** true = recorded, false = ignored (no campaign information, or not a directory page) */
  async record(input: PageVisitInput): Promise<boolean> {
    const v = utmVisitOf(input);
    if (!v) return false;
    const day = dayOf(this.clock());
    try { await this.store.increment(day, this.guard.apply(day, v)); return true; }
    catch (e) { this.log.warn(`utm aggregate not recorded: ${(e as Error).message.slice(0, 120)}`); return false; }
  }

  /** Staff report: the daily rows in a date range (default: the last 30 days), newest day first. */
  async report(q: { from?: string; to?: string; skip: number; take: number }): Promise<{ items: UtmReportRow[]; total: number }> {
    const to = q.to && DAY.test(q.to) ? q.to : dayOf(this.clock());
    const from = q.from && DAY.test(q.from) ? q.from : dayOf(new Date(this.clock().getTime() - 29 * 86_400_000));
    if (from > to) throw new BadRequestException(seoError('SEO_INVALID', 'from must not be after to.'));
    return this.store.report({ from, to, skip: q.skip, take: q.take });
  }
}
