import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Allows the vendor owner (and admins) but blocks a vendor's team member. Used on
 * owner-only actions — e.g. managing the team itself — so an invited member can't
 * invite/modify/remove other members (their `sub` is the parent vendorId, which
 * would otherwise let them). Opt-in via @UseGuards(VendorOwnerGuard).
 */
@Injectable()
export class VendorOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (user?.kind === 'team_member') {
      throw new ForbiddenException('Only the account owner can manage the team.');
    }
    return true;
  }
}
