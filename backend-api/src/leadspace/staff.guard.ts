import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Get4Domain staff of any role, including MARKETING. For the non-money LeadSpace admin work: page review, abuse reports, the promotion queue.
 * Prices, disputes, refunds, refills and settings use CommercialAdminGuard instead, which refuses MARKETING.
 */
@Injectable()
export class LeadspaceStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new ForbiddenException('Staff access required');
    const staff = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!staff || user.kind === 'team_member' || user.kind === 'sandbox') throw new ForbiddenException('Staff access required');
    return true;
  }
}
