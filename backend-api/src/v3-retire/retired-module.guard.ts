import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { can } from '../plans/entitlements/entitlement-engine';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { featureKeyOf, retiredModuleOf } from './core/retire-core';

/**
 * Global guard, registered after the JWT guard (slice 5.25). The per-industry modules of Version 2 answer a plain 404 to a V3 vendor and are untouched for everyone else:
 *   - not an industry route                     -> allow, nothing is read
 *   - no principal, or staff                    -> allow (the route's own guards judge them)
 *   - a vendor (or team member) on LEGACY mode  -> allow (the engine is asked once per request, only on an industry route, to learn the mode)
 *   - a V3 vendor whose `industry.<module>` feature is not allowed (HIDDEN on every plan) -> 404
 * The decision is the entitlement state, so staff can switch one vendor back on with an override. The guard reads no table and writes nothing: the data of a retired module is kept.
 * The 404 is the same answer a route that does not exist gives, and says nothing about plans.
 */
@Injectable()
export class RetiredModuleGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string; user?: AuthenticatedUser }>();
    const module = retiredModuleOf(req.path ?? req.url ?? '');
    if (!module) return true;
    const user = req.user;
    if (!user || user.role !== 'VENDOR' || typeof user.sub !== 'string' || !user.sub) return true;
    const resolved = await this.entitlements.resolveForRequest(req as unknown as Record<string, unknown>, user.sub);
    if (resolved.mode === 'LEGACY') return true;
    if (can(resolved, featureKeyOf(module)).allowed) return true;
    throw new NotFoundException();
  }
}
