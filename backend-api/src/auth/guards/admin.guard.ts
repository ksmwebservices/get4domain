import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { rolesFor } from './admin-role-matrix';
import { isStaffPrincipal, routeKeyOf, staffRoleOf } from './staff-access';

/**
 * Admin routes: the caller must be Get4Domain staff AND their staff role must be allowed on this route by the central matrix
 * (auth/guards/admin-role-matrix.ts). A route with no matrix entry is SUPER_ADMIN only.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !isStaffPrincipal(user)) {
      throw new ForbiddenException('Admin access required');
    }

    const staffRole = staffRoleOf(user);
    if (!staffRole || !rolesFor(routeKeyOf(request)).includes(staffRole)) {
      throw new ForbiddenException('Your staff role does not allow this action');
    }

    return true;
  }
}
