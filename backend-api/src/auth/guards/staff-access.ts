import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { StaffRole, staffRolesFor } from './admin-role-matrix';

const STAFF_ROLES: ReadonlySet<string> = new Set<StaffRole>(['SUPER_ADMIN', 'OPERATIONS', 'MARKETING']);

/** The one definition of "is Get4Domain staff" (a staff member, or the seeded admin vendor row). Replaces the `role === 'ADMIN' || ...` copies. */
export function isStaffPrincipal(user: AuthenticatedUser): boolean {
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
}

/** The principal's Get4Domain staff role. JwtStrategy sets it from the staff member's row (or SUPER_ADMIN for the seeded admin vendor). */
export function staffRoleOf(user: AuthenticatedUser): StaffRole | undefined {
  const role = user.adminRole ?? (user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : undefined);
  return role && STAFF_ROLES.has(role) ? (role as StaffRole) : undefined;
}

/** "METHOD /route/pattern" as Express reports it, e.g. "DELETE /vendors/:id" (a trailing slash does not change the answer). */
export function routeKeyOf(request: { method?: string; route?: { path?: string } }): string {
  const method = String(request.method ?? 'GET').toUpperCase();
  let path = request.route?.path ?? '';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return `${method} ${path}`;
}

/**
 * May this staff member act on a vendor's data (or, for the AI routes, use the free internal allowance) on THIS route?
 * Asks the STAFF_VENDOR_ACCESS_MATRIX; a route with no entry is SUPER_ADMIN only. A vendor owner or team member is never "staff".
 */
export function staffMayUse(user: AuthenticatedUser, routeKey: string): boolean {
  if (!isStaffPrincipal(user)) return false;
  const role = staffRoleOf(user);
  return role !== undefined && staffRolesFor(routeKey).includes(role);
}

/** Passes for the vendor's own principal, or for staff the matrix allows on this route. Everything else gets `message` with a 403. */
export function assertOwnerOrStaff(user: AuthenticatedUser, vendorId: string, routeKey: string, message: string): void {
  if (user.sub === vendorId || staffMayUse(user, routeKey)) return;
  throw new ForbiddenException(message);
}
