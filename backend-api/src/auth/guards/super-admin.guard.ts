import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.adminRole === 'SUPER_ADMIN';
    if (!user || !isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
