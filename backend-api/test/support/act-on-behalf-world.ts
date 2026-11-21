import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ActOnBehalfInterceptor } from '../../src/v3-website/act-on-behalf/act-on-behalf.interceptor';
import { ActOnBehalfService } from '../../src/v3-website/act-on-behalf/act-on-behalf.service';
import { ActOnBehalfStore, NewSession, SessionRow } from '../../src/v3-website/act-on-behalf/act-on-behalf.store';
import { DEFAULT_WEBSITE_SETTINGS } from '../../src/v3-website/settings/website-settings';
import { ActivityInterceptor } from '../../src/v3-activity/activity.interceptor';
import { activityWorld, ActivityWorld } from './memory-activity-store';
import { RecordingNotifier } from './website-world';

/** In-memory twin of PrismaActOnBehalfStore: at most one active session per staff member (the database's nullable unique), a compare-and-set end, vendors by id. */
export class MemoryActOnBehalfStore extends ActOnBehalfStore {
  vendors = new Set<string>(['v1', 'v2']); rows: SessionRow[] = []; private n = 0;
  async vendorExists(id: string) { return this.vendors.has(id); }
  async createIfNoneActive(s: NewSession) {
    if (this.rows.some((r) => r.staffId === s.staffId && r.endedAt === null)) return null;
    const row: SessionRow = { ...s, id: `aob${++this.n}`, endedAt: null, endedBy: null, vendorNotifiedAt: null }; this.rows.push(row); return { ...row };
  }
  async get(id: string) { const r = this.rows.find((x) => x.id === id); return r ? { ...r } : null; }
  async markNotified(id: string, at: Date) { const r = this.rows.find((x) => x.id === id); if (r) r.vendorNotifiedAt = at; }
  async end(id: string, at: Date, by: 'STAFF' | 'SUPER_ADMIN' | 'AUTO') { const r = this.rows.find((x) => x.id === id && x.endedAt === null); if (!r) return null; r.endedAt = at; r.endedBy = by; return { ...r }; }
  async listDue(now: Date) { return this.rows.filter((r) => r.endedAt === null && r.expiresAt.getTime() <= now.getTime()).map((r) => ({ ...r })); }
  async list(f: { vendorId?: string; active?: boolean }, skip: number, take: number) {
    const all = this.rows.filter((r) => (!f.vendorId || r.vendorId === f.vendorId) && (f.active === undefined || (r.endedAt === null) === f.active)).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length };
  }
  async listForVendor(vendorId: string, take: number) { return this.rows.filter((r) => r.vendorId === vendorId).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, take).map((r) => ({ ...r })); }
}

export const STAFF1 = { sub: 'staff-1', email: 's1@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' };
export const STAFF2 = { sub: 'staff-2', email: 's2@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' };
export const SUPER = { sub: 'staff-9', email: 's9@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPER_ADMIN' };
export const OWNER1 = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };

export interface AobWorld {
  svc: ActOnBehalfService; store: MemoryActOnBehalfStore; notices: RecordingNotifier['items']; clock: { t: Date }; aw: ActivityWorld;
  /** runs a request through the act-on-behalf interceptor and then the activity interceptor, as the application does; `handled` counts how often the route's handler ran */
  run(req: Record<string, unknown>): Promise<{ value: unknown; handled: number }>;
}

export async function aobWorld(minutes: number | null = 30): Promise<AobWorld> {
  const aw = activityWorld(); await aw.seedRules();
  const store = new MemoryActOnBehalfStore(); const notifier = new RecordingNotifier(); const clock = { t: new Date('2026-11-11T10:00:00Z') };
  const settings = { get: async () => ({ ...DEFAULT_WEBSITE_SETTINGS, actOnBehalfMaxMinutes: minutes }) };
  const svc = new ActOnBehalfService(store, notifier, settings as never, aw.activity); svc.clock = () => clock.t;
  const aobI = new ActOnBehalfInterceptor(svc); const actI = new ActivityInterceptor(aw.activity);
  const ctx = (req: Record<string, unknown>): ExecutionContext => ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 200 }) }) }) as unknown as ExecutionContext;
  const run = async (req: Record<string, unknown>) => {
    let handled = 0;
    const handler: CallHandler = { handle: () => { handled++; return of({ ok: true }); } };
    const value = await lastValueFrom(aobI.intercept(ctx(req), { handle: () => actI.intercept(ctx(req), handler) }));
    return { value, handled };
  };
  return { svc, store, notices: notifier.items, clock, aw, run };
}
