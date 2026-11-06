import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityInterceptor } from '../src/v3-activity/activity.interceptor';
import { activityWorld, ActivityWorld } from './support/memory-activity-store';

/** Slice 5.20: the interceptor that logs every successful mutating signed-in request, and the coverage rule that keeps it that way. */
let w: ActivityWorld; let it_: ActivityInterceptor;
beforeEach(async () => { w = activityWorld(); await w.seedRules(); it_ = new ActivityInterceptor(w.activity); });

const OWNER = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
const MEMBER = { sub: 'v1', memberId: 'm9', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member' };
const STAFF = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' };
const ctx = (req: Record<string, unknown>, statusCode = 200, type = 'http'): ExecutionContext => ({ getType: () => type, switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode }) }) }) as unknown as ExecutionContext;
const run = async (req: Record<string, unknown>, o: { fail?: boolean; status?: number; type?: string } = {}): Promise<unknown> => {
  const next: CallHandler = { handle: () => (o.fail ? throwError(() => new Error('refused')) : of({ ok: true })) };
  return lastValueFrom(it_.intercept(ctx(req, o.status ?? 200, o.type ?? 'http'), next));
};

describe('the activity interceptor', () => {
  it('logs a successful signed-in mutation and returns the response unchanged', async () => {
    const out = await run({ method: 'POST', route: { path: '/v3/me/domains/custom' }, params: {}, body: { host: 'shop.example.in' }, user: OWNER, ip: '203.0.113.9' }, { status: 201 });
    expect(out).toEqual({ ok: true });
    expect(w.store.activity).toHaveLength(1);
    expect(w.store.activity[0]).toMatchObject({ vendorId: 'v1', actorType: 'VENDOR_USER', actorId: 'v1', actionKey: 'domain.custom_added', entityType: 'domain', entityId: null });
    expect(w.store.activity[0].summary).toMatchObject({ route: 'POST /v3/me/domains/custom', status: 201, fields: ['host'] });
  });
  it('never stores a body value, only the field names', async () => {
    await run({ method: 'POST', route: { path: '/v3/me/payment-methods' }, params: {}, body: { kind: 'UPI', upiId: 'priya@oksbi', accountNumber: '111122223333', secret: 'sk_live_x' }, user: OWNER });
    const text = JSON.stringify(w.store.activity[0]);
    for (const bad of ['priya@oksbi', '111122223333', 'sk_live_x', 'UPI"']) expect(text).not.toContain(bad);
    expect(w.store.activity[0].summary).toMatchObject({ fields: ['kind', 'upiId', 'accountNumber', 'secret'] });
  });
  it('a team member is logged under the member\'s own id, for the owner\'s vendor', async () => {
    await run({ method: 'PUT', route: { path: '/v3/me/payment-methods/:id' }, params: { id: 'pm1' }, body: {}, user: MEMBER });
    expect(w.store.activity[0]).toMatchObject({ vendorId: 'v1', actorType: 'VENDOR_USER', actorId: 'm9', entityId: 'pm1', actionKey: 'payment_method.updated' });
  });
  it('staff acting on a vendor are logged as STAFF with the vendor they named; staff acting on nobody get no vendor', async () => {
    await run({ method: 'POST', route: { path: '/v3/admin/vendors/:id/lifecycle/restore-pro' }, params: { id: 'v7' }, body: { reason: 'x' }, user: STAFF, ip: '10.0.0.1' });
    await run({ method: 'PUT', route: { path: '/v3/admin/alert-rules' }, params: {}, body: { key: 'DOMAIN_CHANGED' }, user: STAFF });
    expect(w.store.activity[0]).toMatchObject({ vendorId: 'v7', actorType: 'STAFF', actorId: 'staff-1', actionKey: 'plan.state_changed', entityId: 'v7' });
    expect(w.store.activity[1]).toMatchObject({ vendorId: null, actorType: 'STAFF', actionKey: 'alert_rules.update' });
  });
  it('a vendor id typed in the URL of a /v3/me route is never used: the row belongs to the signed-in vendor', async () => {
    await run({ method: 'DELETE', route: { path: '/v3/me/domains/:id' }, params: { id: 'd1', vendorId: 'someone-else' }, body: {}, user: OWNER });
    expect(w.store.activity[0].vendorId).toBe('v1');
  });
  it('does not log a read, a failed request, a public route, an exempt route, or a non-HTTP call', async () => {
    await run({ method: 'GET', route: { path: '/v3/me/activity' }, params: {}, user: OWNER });
    await run({ method: 'POST', route: { path: '/v3/me/domains/custom' }, params: {}, body: {}, user: OWNER }, { fail: true }).catch(() => undefined);
    await run({ method: 'POST', route: { path: '/v3/public/reports' }, params: {}, body: {} });
    await run({ method: 'POST', route: { path: '/v3/me/site/theme/preview' }, params: {}, body: {}, user: OWNER });
    await run({ method: 'POST', route: { path: '/v3/me/domains/custom' }, params: {}, body: {}, user: OWNER }, { type: 'rpc' });
    await run({ method: 'POST', params: {}, body: {}, user: OWNER });
    expect(w.store.activity).toHaveLength(0);
  });
  it('a failing log never changes the response', async () => {
    w.store.failInsert = true;
    await expect(run({ method: 'POST', route: { path: '/v3/me/domains/custom' }, params: {}, body: {}, user: OWNER })).resolves.toEqual({ ok: true });
  });
  it('a profile update that names the business or the GST number says which, by name only, and the alert rule can fire on it', async () => {
    await w.store.updateRule('BUSINESS_IDENTITY_CHANGED', { enabled: true }, 's');
    await run({ method: 'PUT', route: { path: '/v3/me/directory' }, params: {}, body: { name: 'New Name', gstNumber: '27ABCDE1234F1Z5', about: 'x' }, user: OWNER });
    expect(w.store.activity[0].summary).toMatchObject({ changed: ['name', 'gstNumber'] });
    expect(JSON.stringify(w.store.activity[0])).not.toMatch(/New Name|27ABCDE1234F1Z5/);
    expect(w.store.alerts.map((a) => [a.ruleKey, a.vendorId])).toEqual([['BUSINESS_IDENTITY_CHANGED', 'v1']]);
  });
  it('a payment method change raises the High alert once the rule is on', async () => {
    await w.store.updateRule('PAYMENT_METHOD_CHANGED', { enabled: true }, 's');
    await run({ method: 'DELETE', route: { path: '/v3/me/payment-methods/:id' }, params: { id: 'pm1' }, body: {}, user: OWNER });
    expect(w.store.alerts).toHaveLength(1); expect(w.store.alerts[0]).toMatchObject({ ruleKey: 'PAYMENT_METHOD_CHANGED', level: 'HIGH', vendorId: 'v1' });
  });
});

describe('coverage: no mutating route can be left out of the log', () => {
  const src = path.resolve(__dirname, '../src');
  const read = (p: string): string => fs.readFileSync(path.join(src, p), 'utf8');
  it('the interceptor is registered for the whole app and writes through ActivityService.record()', () => {
    expect(read('v3-activity/activity.module.ts')).toMatch(/provide:\s*APP_INTERCEPTOR,\s*useClass:\s*ActivityInterceptor/);
    expect(read('v3-activity/activity.interceptor.ts')).toMatch(/this\.activity\.record\(/);
  });
  it('the interceptor is not skipped by a route list of its own: the only exemptions live in the action table, each with a reason', () => {
    expect(read('v3-activity/activity.interceptor.ts')).not.toMatch(/EXEMPT|skip|exclude/i);
  });
  it('every controller with a mutating handler under /v3/me or /v3/admin is covered (this lists the controllers; a new one is covered by the interceptor with no change)', () => {
    const files: string[] = [];
    const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.ts$/.test(e.name)) files.push(f); } };
    walk(src);
    const controllers = files.filter((f) => { const c = fs.readFileSync(f, 'utf8'); return /@Controller\(\s*'v3\/(me|admin)/.test(c) && /@(Post|Put|Patch|Delete)\(/.test(c); });
    expect(controllers.length).toBeGreaterThan(15);
    // a controller that opts out of interceptors would escape the log; none may
    for (const f of controllers) expect([path.relative(src, f), /@UseInterceptors\(/.test(fs.readFileSync(f, 'utf8')) && /ActivityInterceptor/.test(fs.readFileSync(f, 'utf8'))]).toEqual([path.relative(src, f), false]);
  });
  it('the module that owns the log is global, so a module built later can inject ActivityService without importing anything', () => {
    expect(read('v3-activity/activity.module.ts')).toMatch(/@Global\(\)\s*@Module/);
    expect(read('app.module.ts')).toMatch(/V3ActivityModule/);
  });
});
