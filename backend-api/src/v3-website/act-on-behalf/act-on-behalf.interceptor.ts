import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { isStaffPrincipal } from '../../common/tenant/resolve-tenant';
import { wmBody } from '../website.errors';
import { isForbiddenInSession, SESSION_HEADER } from './act-on-behalf-core';
import { ActOnBehalfService } from './act-on-behalf.service';

interface Req { method: string; route?: { path?: unknown }; params?: Record<string, unknown>; user?: AuthenticatedUser; headers?: Record<string, string | string[] | undefined>; actOnBehalf?: { sessionId: string } }

/**
 * Applies an act-on-behalf session to a staff request (slice 5.13b). Only a staff request that carries the session header is touched; everything else passes unchanged. The header is accepted only on
 * `/v3/admin/vendors/:id/...` routes (acting on behalf means acting on one vendor), the session must be this staff member's, live and for that vendor, and a change to a payment method, bank detail,
 * UPI id, payee or password is refused (and logged for the vendor). On success the request carries the session id, which the activity interceptor writes into the vendor's activity row.
 */
@Injectable()
export class ActOnBehalfInterceptor implements NestInterceptor {
  constructor(private readonly svc: ActOnBehalfService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Req>();
    const raw = req.headers?.[SESSION_HEADER];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (!sessionId || !req.user || !isStaffPrincipal(req.user)) return next.handle();   // only staff can hold a session
    return from(this.check(req, req.user, sessionId)).pipe(mergeMap(() => next.handle()));
  }

  private async check(req: Req, user: AuthenticatedUser, sessionId: string): Promise<void> {
    const pattern = typeof req.route?.path === 'string' ? req.route.path : '';
    if (!/^\/v3\/admin\/vendors\/:(?:id|vendorId)(?:\/|$)/.test(pattern)) throw new ForbiddenException(wmBody('ACT_ON_BEHALF_WRONG_ROUTE', 'A session applies to one vendor\'s routes only.'));
    const params = req.params ?? {};
    const vendorId = String(params.id ?? params.vendorId ?? '');
    const session = await this.svc.resolve(user.sub, sessionId.slice(0, 64), vendorId);
    if (isForbiddenInSession(req.method, pattern)) {
      await this.svc.recordRefused(session, user.sub, req.method, pattern);
      throw new ForbiddenException(wmBody('ACT_ON_BEHALF_FORBIDDEN', 'Staff cannot change payment methods, bank details, UPI ids or passwords on behalf of a vendor.'));
    }
    req.actOnBehalf = { sessionId: session.id };
  }
}
