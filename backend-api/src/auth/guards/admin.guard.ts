import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { rolesFor, StaffRole } from './admin-role-matrix';

const STAFF_ROLES: ReadonlySet<string> = new Set<StaffRole>(['SUPER_ADMIN', 'OPERATIONS', 'MARKETING']);

/** The principal's Get4Domain staff role. JwtStrategy sets it from the staff member's row (or SUPER_ADMIN for the seeded admin vendor). */
function staffRoleOf(user: AuthenticatedUser): StaffRole | undefined {
  const role = user.adminRole ?? (user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : undefined);
  return role && STAFF_ROLES.has(role) ? (role as StaffRole) : undefined;
}

/** "METHOD /route/pattern" as Express reports it, e.g. "DELETE /vendors/:id" (a trailing slash does not change the answer). */
function routeKeyOf(request: { method?: string; route?: { path?: string } }): string {
  const method = String(request.method ?? 'GET').toUpperCase();
  let path = request.route?.path ?? '';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return `${method} ${path}`;
}

/**
 * Admin routes: the caller must be Get4Domain staff AND their staff role must be allowed on this route by the central matrix
 * (auth/guards/admin-role-matrix.ts). A route with no matrix entry is SUPER_ADMIN only.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw new ForbiddenException('Admin access required');
    }

    const staffRole = staffRoleOf(user);
    if (!staffRole || !rolesFor(routeKeyOf(request)).includes(staffRole)) {
      throw new ForbiddenException('Your staff role does not allow this action');
    }

    return true;
  }
}
