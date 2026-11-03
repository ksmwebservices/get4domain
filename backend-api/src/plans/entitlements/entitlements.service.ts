import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { planError } from '../plans.errors';
import {
  assertWithinLimitResult, can, CanResult, RenderEntitlements, resolveEntitlements, ResolvedEntitlements, toRenderEntitlements,
} from './entitlement-engine';
import { Catalogue, PlansRepository, VendorState } from './plans.repository';

export const PLANS_CLOCK = 'PLANS_CLOCK';
export const ENTITLEMENT_CACHE_TTL_MS = 30_000;

/**
 * What may this vendor do? The rules live in the pure core (entitlement-engine.ts); this service loads the data, keeps it for 30 seconds in process memory,
 * and is told to forget it (invalidate / invalidateAll) by every write that could change an answer: plan, feature, matrix, setting, override, flag, subscription.
 */
@Injectable()
export class EntitlementsService {
  private catalogue: { at: number; data: Catalogue } | null = null;
  private vendors = new Map<string, { at: number; data: VendorState }>();

  constructor(private readonly repo: PlansRepository, @Optional() @Inject(PLANS_CLOCK) private readonly clock: () => Date = () => new Date()) {}

  invalidate(vendorId: string): void { this.vendors.delete(vendorId); }
  invalidateAll(): void { this.catalogue = null; this.vendors.clear(); }

  private async loadCatalogue(now: number): Promise<Catalogue> {
    if (!this.catalogue || now - this.catalogue.at >= ENTITLEMENT_CACHE_TTL_MS) this.catalogue = { at: now, data: await this.repo.loadCatalogue() };
    return this.catalogue.data;
  }

  private async loadVendor(vendorId: string, now: number): Promise<VendorState> {
    const hit = this.vendors.get(vendorId);
    if (hit && now - hit.at < ENTITLEMENT_CACHE_TTL_MS) return hit.data;
    const data = await this.repo.loadVendorState(vendorId);
    this.vendors.set(vendorId, { at: now, data });
    return data;
  }

  async resolve(vendorId: string, opts: { usage?: Record<string, number> } = {}): Promise<ResolvedEntitlements> {
    const now = this.clock();
    const [cat, state] = await Promise.all([this.loadCatalogue(now.getTime()), this.loadVendor(vendorId, now.getTime())]);
    return resolveEntitlements({
      now, flagOn: state.flagOn, subscription: state.subscription, plans: cat.plans, matrix: cat.matrix, featureKeys: cat.featureKeys,
      overrides: state.overrides, settings: cat.settings, usage: opts.usage,
    });
  }

  /** Same as resolve, but a request asks the engine once: the answer is kept on the request object. */
  async resolveForRequest(req: Record<string, unknown>, vendorId: string): Promise<ResolvedEntitlements> {
    const memo = (req.__entitlements ??= new Map<string, ResolvedEntitlements>()) as Map<string, ResolvedEntitlements>;
    const hit = memo.get(vendorId);
    if (hit) return hit;
    const resolved = await this.resolve(vendorId);
    memo.set(vendorId, resolved);
    return resolved;
  }

  async can(vendorId: string, key: string, currentCount?: number): Promise<CanResult> {
    return can(await this.resolve(vendorId), key, currentCount);
  }

  /** Throws 403 with the stable code LIMIT_REACHED or FEATURE_LOCKED and the upsell text. */
  async assertWithinLimit(vendorId: string, key: string, currentCount: number): Promise<void> {
    const err = assertWithinLimitResult(await this.resolve(vendorId), key, currentCount);
    if (!err) return;
    throw new ForbiddenException(planError(
      err.code,
      err.code === 'LIMIT_REACHED' ? `Your plan allows ${err.limit} here and you have reached it.` : 'This is not part of your plan.',
      { feature: key, upsellText: err.upsellText, limit: err.limit },
    ));
  }

  /** The four booleans the theme kit asks the platform for (see toRenderEntitlements for the pinned mapping). */
  async renderEntitlements(vendorId: string, hasVerifiedDomain = false): Promise<RenderEntitlements> {
    return toRenderEntitlements(await this.resolve(vendorId), hasVerifiedDomain);
  }
}
