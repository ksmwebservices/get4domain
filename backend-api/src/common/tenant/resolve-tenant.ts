import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { TenantContext } from './tenant.types';

/** Get4Domain staff: the bootstrap ADMIN/SUPER_ADMIN vendor rows and invited admin-team members. */
export function isStaffPrincipal(user: AuthenticatedUser): boolean {
  return user.kind === 'admin_member' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
}

/**
 * Derive the tenant from the verified principal (the JWT strategy already re-loaded it from the database).
 * - no principal / empty id        -> 401
 * - staff                          -> 403 (staff must name a vendor explicitly: see resolveTenantForStaff)
 * - vendor owner / team member     -> that vendor
 * The tenant is NEVER read from a URL, body or header, so a caller cannot choose another tenant.
 */
export function resolveTenant(user: AuthenticatedUser | null | undefined): TenantContext {
  if (!user || typeof user.sub !== 'string' || user.sub.length === 0) throw new UnauthorizedException('Sign in required');
  if (isStaffPrincipal(user)) {
    throw new ForbiddenException('This action needs a vendor account. Staff must act on a specific vendor explicitly.');
  }
  if (user.role !== 'VENDOR') throw new ForbiddenException('A vendor account is required');
  const actor = user.kind === 'team_member' ? 'team_member' : user.kind === 'sandbox' ? 'sandbox' : 'owner';
  return { vendorId: user.sub, actor, memberId: user.memberId };
}

/** Staff acting on one named vendor. The vendor id is an explicit argument chosen by the caller's code path (and should be audited). */
export function resolveTenantForStaff(user: AuthenticatedUser | null | undefined, vendorId: string): TenantContext {
  if (!user || typeof user.sub !== 'string' || user.sub.length === 0) throw new UnauthorizedException('Sign in required');
  if (!isStaffPrincipal(user)) throw new ForbiddenException('Staff access required');
  if (typeof vendorId !== 'string' || vendorId.length === 0) throw new ForbiddenException('A vendor must be named');
  return { vendorId, actor: 'staff', memberId: user.kind === 'admin_member' ? user.sub : undefined };
}
