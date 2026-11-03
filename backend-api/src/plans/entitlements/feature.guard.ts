import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { resolveTenant } from '../../common/tenant/resolve-tenant';
import { planError } from '../plans.errors';
import { can } from './entitlement-engine';
import { EntitlementsService } from './entitlements.service';
import { REQUIRES_FEATURE } from './requires-feature.decorator';

/** Runs after the global JwtAuthGuard. The vendor is taken from the verified principal, never from the URL or body. */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ key: string } | undefined>(REQUIRES_FEATURE, [context.getHandler(), context.getClass()]);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const tenant = resolveTenant(req.user);
    const resolved = await this.entitlements.resolveForRequest(req, tenant.vendorId);
    const result = can(resolved, meta.key);
    if (result.allowed) return true;
    throw new ForbiddenException(planError('FEATURE_LOCKED', 'This is not part of your plan.', { feature: meta.key, upsellText: result.upsellText }));
  }
}
