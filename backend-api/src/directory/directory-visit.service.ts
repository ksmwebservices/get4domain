import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { dayOf, daysBetween, dedupeKey, fillDays, hashVisitRef, looksLikeVisitRef, newVisitRef, siteUrlOf, visitUrl } from './core/visits';
import { DirectoryRepository } from './directory.repository';
import { OtpPepper } from './pepper';

export interface VisitResult { ref: string; expiresAt: string; url: string }
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DEDUPE_MAX = 20_000;

/**
 * The directory has ONE action: Visit site (owner rule 1). This service counts it (a daily counter per business: no visitor data, no cookie) and hands out the short-lived reference
 * the Visit link appends (?src=dir&ref=...) so a later request on a Pro site can be attributed to the Directory (slice 5.14). Only the reference HASH is stored; it expires; it
 * attributes ONE request. A repeat click from the same network on the same business within a few seconds (setting) is not counted twice: the dedupe key uses a keyed hash of the address,
 * is held in process memory only, and is never written anywhere.
 */
@Injectable()
export class DirectoryVisitService {
  clock: () => Date = () => new Date();
  newRef: () => string = () => newVisitRef();
  private readonly seen = new Map<string, number>();

  constructor(private readonly repo: DirectoryRepository, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>, private readonly pepper: OtpPepper) {}

  /** The business a visitor may be sent to: public (claimed or unclaimed) and with a site address; anything else is null (one uniform 404 for the caller). */
  private async target(slug: string) {
    const key = String(slug ?? '').trim().toLowerCase().slice(0, 80);
    if (!SLUG.test(key)) return null;
    const b = await this.repo.getBusinessBySlug(key);
    if (!b || (b.status !== 'CLAIMED' && b.status !== 'UNCLAIMED') || !b.vendorId) return null;
    const f = (await this.repo.siteFacts([b.vendorId], this.clock())).get(b.vendorId) ?? null;
    const siteUrl = siteUrlOf(f, process.env.SITE_BASE_DOMAIN || 'get4domain.com');
    return siteUrl ? { business: b, siteUrl } : null;
  }

  async visit(slug: string, ip: string | null, fromSearch: boolean): Promise<VisitResult | null> {
    const t = await this.target(slug);
    if (!t) return null;
    const s = await this.b3.get(); const now = this.clock();
    const day = dayOf(now); const key = dedupeKey(this.pepper.hashIp(ip), t.business.id, day);
    const until = this.seen.get(key);
    if (s.directoryVisitDedupeSeconds === 0 || until === undefined || until <= now.getTime()) {
      await this.repo.incrementVisit(t.business.id, day, fromSearch === true);
      if (s.directoryVisitDedupeSeconds > 0) {
        if (this.seen.size >= DEDUPE_MAX) { for (const [k, v] of this.seen) if (v <= now.getTime()) this.seen.delete(k); if (this.seen.size >= DEDUPE_MAX) this.seen.clear(); }
        this.seen.set(key, now.getTime() + s.directoryVisitDedupeSeconds * 1000);
      }
    }
    const ref = this.newRef(); const expiresAt = new Date(now.getTime() + s.directoryVisitRefExpiryMinutes * 60_000);
    await this.repo.createVisitRef({ refHash: hashVisitRef(ref), businessId: t.business.id, expiresAt });
    return { ref, expiresAt: expiresAt.toISOString(), url: visitUrl(t.siteUrl, ref) };
  }

  /** Used by the requests slice: is this reference a live, unused one issued for THIS business? Consumes it (a reference attributes one request). Unknown, expired, used and foreign are the same false. */
  async attribute(rawRef: unknown, businessId: string): Promise<boolean> {
    if (!looksLikeVisitRef(rawRef)) return false;
    return this.repo.consumeVisitRef(hashVisitRef(rawRef), businessId, this.clock());
  }

  /** The owner own counts (Free and Pro both). */
  async stats(vendorId: string, daysIn: unknown) {
    const days = Math.min(90, Math.max(1, Number.isInteger(Number(daysIn)) ? Number(daysIn) : 30));
    const b = await this.repo.getBusinessByVendor(vendorId);
    const to = dayOf(this.clock()); const from = dayOf(new Date(this.clock().getTime() - (days - 1) * 86_400_000));
    if (!b) return { hasProfile: false, from, to, days: fillDays([], from, to).days, total: 0, searchTotal: 0 };
    const rows = await this.repo.visitDays(b.id, from, to);
    return { hasProfile: true, from, to, ...fillDays(rows, from, to) };
  }

  /** Staff report across vendors: counts per business, busiest first. No visitor data exists to show. */
  async report(q: { from?: string; to?: string; vendorId?: string; skip: number; take: number }) {
    const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to ?? '') ? q.to! : dayOf(this.clock());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from ?? '') ? q.from! : dayOf(new Date(this.clock().getTime() - 29 * 86_400_000));
    if (daysBetween(from, to).length === 0) throw new BadRequestException(b3Error('REQUEST_INVALID', 'The date range is not valid.'));
    return { from, to, ...(await this.repo.visitTotals(from, to, { vendorId: q.vendorId, skip: q.skip, take: q.take })) };
  }
}
