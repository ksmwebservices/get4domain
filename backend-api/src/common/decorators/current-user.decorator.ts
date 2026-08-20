import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  /** For a vendor OR a vendor's team member this is the (parent) vendorId — so every
   *  existing vendorId-scoped endpoint works unchanged. For admin_member it's the
   *  member's own id. */
  sub: string;
  email: string;
  role: string;
  /** Internal Get4Domain staff role (SUPER_ADMIN | MARKETING | OPERATIONS). Present for admin principals. */
  adminRole?: string;
  /** Discriminates principal kind: 'admin_member' | 'team_member' | 'sandbox' | undefined(vendor). */
  kind?: string;
  /** Present only for kind==='team_member': the vendor team-member's own id. */
  memberId?: string;
  /** Present only for kind==='team_member': canonical access areas they're granted (see team-access.ts). */
  modules?: string[];
  /** Present only for kind==='team_member': department label. */
  department?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
