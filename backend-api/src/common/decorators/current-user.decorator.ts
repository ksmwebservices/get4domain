import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: string;
  /** Internal Get4Domain staff role (SUPER_ADMIN | MARKETING | OPERATIONS). Present for admin principals. */
  adminRole?: string;
  /** Discriminates a standalone AdminTeamMember principal from a Vendor principal. */
  kind?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
