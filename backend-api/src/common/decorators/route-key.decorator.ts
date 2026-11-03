import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { routeKeyOf } from '../../auth/guards/staff-access';

/**
 * The "METHOD /route/pattern" of the current request, e.g. "GET /invoices/vendor/:vendorId". Pass it to `staffMayUse` / `assertOwnerOrStaff`.
 * The route scanner treats a handler that takes this parameter as one that asks the staff matrix, and the coverage test then requires an entry.
 */
export const RouteKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => routeKeyOf(ctx.switchToHttp().getRequest()));
