import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UseGuards } from '@nestjs/common';
import { resolveTenant } from './resolve-tenant';
import { TenantContext } from './tenant.types';

/** Opt-in guard: resolves the tenant from the verified principal and attaches it to the request. Runs after the global JwtAuthGuard. */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.tenant = resolveTenant(req.user);
    return true;
  }
}

/** `@UseTenant()` on a controller or handler = reject (401/403) anything that is not a vendor owner or team member. */
export const UseTenant = (): MethodDecorator & ClassDecorator => UseGuards(TenantGuard);

/** `@Tenant() tenant: TenantContext` — the caller's tenant. Works with or without `@UseTenant()`. */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest();
  return (req.tenant as TenantContext | undefined) ?? resolveTenant(req.user);
});
