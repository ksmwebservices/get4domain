import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { isStaffPrincipal } from '../common/tenant/resolve-tenant';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ActivityActor, ActivityService } from './activity.service';
import { actionFor, changedIdentityFields, entityIdOf, vendorOf } from './core/action-table';

interface Req { method: string; route?: { path?: unknown }; params?: Record<string, unknown>; body?: unknown; user?: AuthenticatedUser; ip?: string; /** slice 5.13b: set when a staff request runs inside an act-on-behalf session */ actOnBehalf?: { sessionId: string } }
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Writes one activity row for every SUCCESSFUL mutating request on /v3/me and /v3/admin (slice 5.20), so no mutating route can be left out of the log and a route added later is logged the day it exists.
 * It stores the route, the status, the ids in the route and the NAMES of the body's fields; it never stores a body value (a body can carry a secret or personal data). A request that fails is not logged:
 * the action did not happen. `record()` never throws, so a logging fault cannot change the response. Events that carry more than a route (the wallet, services, service requests and theme switches) arrive
 * through the bus listener instead.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp(); const req = http.getRequest<Req>();
    const pattern = typeof req.route?.path === 'string' ? req.route.path : null;
    const fields = isObject(req.body) ? Object.keys(req.body).slice(0, 60) : [];
    const action = pattern ? actionFor(req.method, pattern, fields) : null;
    if (!pattern || !action) return next.handle();
    return next.handle().pipe(mergeMap(async (value) => {
      const user = req.user; const staff = !!user && isStaffPrincipal(user);
      const params = req.params ?? {};
      const actor: ActivityActor = staff ? { type: 'STAFF', id: user?.sub ?? null, ip: req.ip ?? null } : { type: 'VENDOR', id: user?.memberId ?? user?.sub ?? null, ip: req.ip ?? null };
      const ids: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) if (typeof v === 'string') ids[k] = v.slice(0, 120);
      const changed = action.actionKey === 'business.identity_changed' ? changedIdentityFields(fields) : undefined;
      await this.activity.record({
        vendorId: vendorOf(pattern, params, staff ? null : user?.sub ?? null), actor, actionKey: action.actionKey, entityType: action.entityType, entityId: entityIdOf(pattern, params),
        summary: { route: `${req.method.toUpperCase()} ${pattern}`, status: http.getResponse<{ statusCode?: number }>().statusCode ?? null, params: ids, fields, ...(changed ? { changed } : {}), ...(req.actOnBehalf ? { actOnBehalfSessionId: req.actOnBehalf.sessionId } : {}) },
      });
      return value;
    }));
  }
}
