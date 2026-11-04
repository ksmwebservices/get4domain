import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { Actor } from '../plans/admin/audit.service';
import { VendorPlansAdminService } from '../plans/admin/vendor-plans-admin.service';
import { cleanReason } from '../vendor-lifecycle/core/lifecycle-core';
import { CanonicalStore, SiteRebuild } from './canonical.store';
import { HostDirectory } from './host-directory';

export const ADDON_FEATURE = 'promotion.custom_domain_addon';
const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };

/**
 * The controlled canonical switch (owner rule 4, slice 5.6b). Routing follows the pure rule at once (HostDirectory); the published pages and the sitemap follow through THIS function:
 * it compares the host the pages were built for with the host the rule gives now, and only when they differ it rebuilds and republishes, then records the change (before and after)
 * as a site event with an audit row. Running it twice is a no-op. The same function moves the canonical back when the add-on ends (cron tick, setting canonicalSwitchTickEnabled).
 */
@Injectable()
export class CanonicalSwitchService {
  private readonly logger = new Logger(CanonicalSwitchService.name);
  private busy = false;
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: CanonicalStore, private readonly dir: HostDirectory,
    @Optional() @Inject(SiteRebuild) private readonly rebuild?: SiteRebuild,
    @Optional() @Inject(B3SettingsService) private readonly b3?: Pick<B3SettingsService, 'get'>,
    @Optional() @Inject(VendorPlansAdminService) private readonly overrides?: Pick<VendorPlansAdminService, 'createOverride' | 'expireOverride'>,
  ) {}

  /** What the rule says now, what the published pages were built for, and whether the add-on is on (staff view; no personal data). */
  async state(vendorId: string) {
    this.dir.invalidate();
    const plan = await this.dir.canonicalPlan(vendorId);
    const stored = await this.store.storedCanonical(vendorId);
    return { canonicalHost: plan.canonicalHost, canonicalKind: plan.canonicalKind, subdomainHost: plan.subdomainHost, customHost: plan.customHost, promotionAddonActive: plan.addonActive, publishedFor: stored, inSync: stored === plan.canonicalHost };
  }

  /** The switch. Idempotent. `actor` is the staff member, or SYSTEM from the tick. */
  async switchFor(vendorId: string, actor: Actor = SYSTEM, reason: 'ADDON_STARTED' | 'ADDON_ENDED' | 'DOMAIN_CHANGED' = 'DOMAIN_CHANGED') {
    this.dir.invalidate();   // the answer below must come from the rows and the entitlements as they are now, not from a 30 second memory
    const plan = await this.dir.canonicalPlan(vendorId);
    const to = plan.canonicalHost;
    if (!to) return { changed: false, from: null as string | null, to: null as string | null };
    const from = await this.store.storedCanonical(vendorId);
    if (from === to) return { changed: false, from, to };
    // the first time we see a vendor on the default address there is nothing to move: remember it
    if (from === null && plan.canonicalKind === 'SUBDOMAIN') { await this.store.recordBaseline(vendorId, to); return { changed: false, from, to }; }
    if (this.rebuild) await this.rebuild.rebuildAndPublish(vendorId, actor);   // new canonical tags and sitemap first; if it fails nothing is recorded and the next call retries
    // the reason follows the transition itself: a move TO the custom domain is the add-on starting; a move away from it is the add-on ending unless the domain itself went away
    const why = plan.canonicalKind === 'CUSTOM' ? 'ADDON_STARTED' : plan.customHost && !plan.addonActive ? 'ADDON_ENDED' : reason;
    await this.store.recordSwitch({ vendorId, from, to, reason: why, actor });
    this.dir.invalidate();
    return { changed: true, from, to };
  }

  // ── staff: the add-on (an entitlement override with an end date; reason and audit come from the override service) ──

  async grantAddon(vendorId: string, actor: Actor, reasonIn: unknown, endsAtIso: unknown) {
    const reason = cleanReason(reasonIn);
    if (!reason) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
    const endsAt = typeof endsAtIso === 'string' ? new Date(endsAtIso) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= this.clock().getTime()) throw new BadRequestException(b3Error('LIFECYCLE_STATE_INVALID', 'The add-on needs an end date in the future.'));
    if (!this.overrides) throw new BadRequestException('The override service is not available.');
    const row = await this.overrides.createOverride(vendorId, { featureKey: ADDON_FEATURE, state: 'ACTIVE', reason, expiresAt: endsAt.toISOString() } as never, actor);
    const sw = await this.switchFor(vendorId, actor, 'ADDON_STARTED');
    return { overrideId: (row as { id: string }).id, endsAt, switch: sw };
  }

  async endAddon(vendorId: string, actor: Actor, reasonIn: unknown) {
    const reason = cleanReason(reasonIn);
    if (!reason) throw new BadRequestException(b3Error('LIFECYCLE_REASON_REQUIRED', 'A reason of 5 to 300 characters is required.'));
    if (!this.overrides) throw new BadRequestException('The override service is not available.');
    const ids = await this.store.activeAddonOverrideIds(vendorId, this.clock());
    for (const id of ids) await this.overrides.expireOverride(id, actor);
    const sw = await this.switchFor(vendorId, actor, 'ADDON_ENDED');
    return { ended: ids.length, switch: sw };
  }

  // ── the tick ──

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<{ checked: number; switched: number }> {
    if (this.busy) return { checked: 0, switched: 0 };
    if (!this.b3 || !(await this.b3.get()).canonicalSwitchTickEnabled) return { checked: 0, switched: 0 };   // off by default
    this.busy = true;
    let switched = 0; let checked = 0;
    try {
      for (const vendorId of await this.store.vendorsWithStoredCanonical(500)) {
        checked++;
        try { if ((await this.switchFor(vendorId, SYSTEM, 'ADDON_ENDED')).changed) switched++; } catch (e) { this.logger.error(`canonical switch failed for a vendor: ${e instanceof Error ? e.name : 'error'}`); }
      }
    } finally { this.busy = false; }
    return { checked, switched };
  }
}
