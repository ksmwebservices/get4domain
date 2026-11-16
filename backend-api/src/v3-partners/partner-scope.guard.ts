import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { partnerMayReach } from './core/partner-core';
import { partnerError } from './partners.errors';

/**
 * Global guard, registered after the JWT guard (Wave 3 Part A). A referral-partner principal (kind "referral_partner", role PARTNER) may reach /v3/partner/* and the two token routes and NOTHING else:
 * every other route answers 403 before its own guards run, including routes that have no role check at all. Everyone else passes untouched (the partner routes then check that the caller IS a partner).
 */
@Injectable()
export class PartnerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string; user?: AuthenticatedUser }>();
    if (req.user?.kind !== 'referral_partner') return true;
    if (partnerMayReach(req.path ?? req.url ?? '')) return true;
    throw partnerError(403, 'PARTNER_SCOPE_REFUSED', 'This login can only use the partner area.');
  }
}
