import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
