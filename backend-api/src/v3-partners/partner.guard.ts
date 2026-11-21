import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { partnerError } from './partners.errors';

/** Route guard of /v3/partner/*: the caller must be a signed-in referral partner (a vendor, a team member and staff are refused). */
@Injectable()
export class PartnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (user?.kind === 'referral_partner' && user.role === 'PARTNER') return true;
    throw partnerError(403, 'PARTNER_ONLY', 'This area is for referral partners.');
  }
}
