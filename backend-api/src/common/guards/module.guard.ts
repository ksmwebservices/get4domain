import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { TeamArea, memberHasArea } from '../../team/team-access';

/**
 * Global guard (registered after JwtAuthGuard). It is a NO-OP for everything except
 * a vendor team-member hitting a route/controller marked with @RequireModule():
 *   - no @RequireModule metadata  → allow (undecorated routes unaffected)
 *   - no user / not a team_member → allow (vendor owners + admins + public routes)
 *   - team_member WITH the area   → allow
 *   - team_member WITHOUT the area → 403
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TeamArea | undefined>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user || user.kind !== 'team_member') return true;

    if (memberHasArea(user.modules, required)) return true;
    throw new ForbiddenException(`Your team access does not include this area (${required}).`);
  }
}
