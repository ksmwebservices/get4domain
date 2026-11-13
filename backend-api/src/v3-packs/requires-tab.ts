import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { resolveTenant } from '../common/tenant/resolve-tenant';
import { packError } from './pack.errors';
import { PackEngineService } from './pack-engine.service';

export const REQUIRES_TAB = 'packs:requires-tab';

type Access = Awaited<ReturnType<PackEngineService['access']>>;

/**
 * Runs after the global JWT guard. The tab of the route must be ACTIVE for the vendor, otherwise 403 with the registered code TAB_LOCKED (and the state, the reason and the tier that opens it).
 * The vendor comes from the verified principal, never from the URL or body. A vendor still on the Version 2 rules (LEGACY) is never restricted by this guard. The module using it imports V3PacksModule.
 */
@Injectable()
export class TabGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly packs: PackEngineService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ key: string } | undefined>(REQUIRES_TAB, [context.getHandler(), context.getClass()]);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const tenant = resolveTenant(req.user);
    const memo = (req.__tabAccess ??= new Map<string, Access>()) as Map<string, Access>;
    const key = `${tenant.vendorId}:${meta.key}`;
    const access = memo.get(key) ?? await this.packs.access(tenant.vendorId, meta.key);
    memo.set(key, access);
    if (access.allowed) return true;
    throw new ForbiddenException(packError(403, 'TAB_LOCKED', 'This part of the dashboard is not open on your plan.', { tab: meta.key, state: access.state, reason: access.reason, needsTier: access.needsTier }).getResponse());
  }
}

/** `@RequiresTab('crm')` on a vendor route or controller: the tab must be ACTIVE for the caller (see TabGuard). */
export const RequiresTab = (key: string): MethodDecorator & ClassDecorator => applyDecorators(SetMetadata(REQUIRES_TAB, { key }), UseGuards(TabGuard));
