import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { resolveTenant } from '../common/tenant/resolve-tenant';
import { isTeamMember } from '../v3-packs/core/shell-access';
import { PackEngineService } from '../v3-packs/pack-engine.service';
import { packError } from '../v3-packs/pack.errors';
import { isOwnerOnlyTab } from './core/record-core';
import { recordError } from './pack-records.errors';
import { TabLock } from './pack-records.service';

/** What the guard found, left on the request for the controller (the verified vendor, the owner key, the tab and whether the tab is a locked preview). */
export interface RecordRequestContext { lock: TabLock }

/**
 * The tab guard of the record routes. The tab is named in the URL (`/v3/me/packs/:packKey/tabs/:tabKey/records`) together with its OWNER, because tab keys repeat across packs and capabilities, so the
 * answer comes from the engine for that one tab (never from whichever tab with that key is listed first). The vendor comes from the verified principal.
 *  - ACTIVE tab: open.
 *  - LOCKED_PREVIEW (a Free trial, a plan too low, a paused plan): GET only, and the answer says it is locked. Every write is refused with TAB_LOCKED.
 *  - HIDDEN, or a tab the vendor does not have (another pack, a capability never switched on): refused even for a read.
 *  - an owner-only tab (money and contract records): a team member is refused.
 * A vendor still on the Version 2 rules (LEGACY) is never restricted, as with @RequiresTab.
 */
@Injectable()
export class PackRecordsTabGuard implements CanActivate {
  constructor(private readonly packs: PackEngineService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const ownerKey = String(req.params?.packKey ?? ''); const tabKey = String(req.params?.tabKey ?? '');
    const tenant = resolveTenant(req.user);
    if (isTeamMember(req.user ?? {}) && isOwnerOnlyTab(ownerKey, tabKey)) throw recordError(403, 'PACK_TAB_OWNER_ONLY', 'Only the account owner can open this.');
    const access = await this.packs.accessOf(tenant.vendorId, ownerKey, tabKey);
    const method = String(req.method ?? '').toUpperCase();
    const ctx: RecordRequestContext = { lock: { locked: false } };
    if (!access.allowed) {
      ctx.lock = { locked: true, state: access.state, reason: access.reason, needsTier: access.needsTier };
      if (!(access.state === 'LOCKED_PREVIEW' && method === 'GET')) {
        throw packError(403, 'TAB_LOCKED', 'This part of the dashboard is not open on your plan.', { tab: tabKey, state: access.state, reason: access.reason, needsTier: access.needsTier });
      }
    }
    req.__packRecordContext = ctx;
    return true;
  }
}
