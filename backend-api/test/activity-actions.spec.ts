import { actionFor, changedIdentityFields, entityIdOf, EXEMPT_ROUTES, vendorOf } from '../src/v3-activity/core/action-table';
import baseline from './baselines/route-classification.json';

/** Slice 5.20: which request becomes which activity row. Pure rules; the interceptor that applies them is tested in activity-interceptor.spec.ts. */
describe('what is logged', () => {
  it('never a read', () => { for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(actionFor(m, '/v3/me/domains', [])).toBeNull(); });
  it('only the signed-in surfaces: /v3/me and /v3/admin (public, claim and webhook routes have no signed-in actor)', () => {
    expect(actionFor('POST', '/v3/public/reports', [])).toBeNull();
    expect(actionFor('POST', '/v3/payments/razorpay/webhook', [])).toBeNull();
    expect(actionFor('POST', '/v3/claim/:token/otp/verify', [])).toBeNull();
    expect(actionFor('POST', '/v3/directory/businesses/:slug/visit', [])).toBeNull();
    expect(actionFor('POST', '/v1/anything', [])).toBeNull();
    expect(actionFor('POST', '/v3/me/domains/custom', [])).not.toBeNull();
    expect(actionFor('PATCH', '/v3/admin/alerts/:id', [])).not.toBeNull();
  });
  it('the exempt routes are exactly those that store nothing, each with a reason, and each is a real route', () => {
    expect(EXEMPT_ROUTES.map((e) => e.route)).toEqual(['POST /v3/me/site/theme/preview']);
    for (const e of EXEMPT_ROUTES) { expect(e.reason.length).toBeGreaterThan(10); expect((baseline.routes as Array<{ route: string }>).map((r) => r.route)).toContain(e.route); expect(actionFor(e.route.split(' ')[0], e.route.split(' ')[1], [])).toBeNull(); }
  });
});

describe('the keys the alert rules look for', () => {
  const key = (m: string, p: string, body: string[] = []) => actionFor(m, p, body)?.actionKey;
  it('payment methods: created, updated, deleted (a test call is not a change)', () => {
    expect(key('POST', '/v3/me/payment-methods')).toBe('payment_method.created');
    expect(key('PUT', '/v3/me/payment-methods/:id')).toBe('payment_method.updated');
    expect(key('DELETE', '/v3/me/payment-methods/:id')).toBe('payment_method.deleted');
    expect(key('POST', '/v3/me/payment-methods/:id/test')).not.toMatch(/^payment_method\.(created|updated|deleted)$/);
  });
  it('domains: adding, the subdomain, the primary, removing (verifying is a check, not a change)', () => {
    expect(key('POST', '/v3/me/domains/custom')).toBe('domain.custom_added');
    expect(key('PUT', '/v3/me/domains/subdomain')).toBe('domain.subdomain_changed');
    expect(key('POST', '/v3/me/domains/:id/primary')).toBe('domain.primary_changed');
    expect(key('DELETE', '/v3/me/domains/:id')).toBe('domain.removed');
    expect(key('POST', '/v3/me/domains/:id/verify')).not.toMatch(/^domain\./);
    expect(key('POST', '/v3/admin/domains/:id/remove')).toBe('domain.removed');
    expect(key('PUT', '/v3/admin/vendors/:id/domains/subdomain')).toBe('domain.subdomain_changed');
  });
  it('the owner asking for the account to be removed', () => { expect(key('POST', '/v3/me/account/deletion-request')).toBe('account.deletion_requested'); });
  it('staff changing a vendor\'s plan state (convert to Free, restore Pro, extend grace)', () => {
    for (const p of ['convert-to-free', 'restore-pro', 'extend-grace']) expect(key('POST', `/v3/admin/vendors/:id/lifecycle/${p}`)).toBe('plan.state_changed');
  });
  it('the directory profile is a business identity change only when the body names the business or the GST number, and says which', () => {
    expect(key('PUT', '/v3/me/directory', ['name', 'about'])).toBe('business.identity_changed');
    expect(key('PUT', '/v3/me/directory', ['gstNumber'])).toBe('business.identity_changed');
    expect(key('PUT', '/v3/me/directory', ['about', 'hours'])).not.toBe('business.identity_changed');
    expect(changedIdentityFields(['businessName', 'about', 'gst', 'phone'])).toEqual(['name', 'gstNumber']);
    expect(changedIdentityFields(['about'])).toEqual([]);
  });
});

describe('every other mutation still gets a key', () => {
  it('is derived from the route: resource, then the action words, without parameters', () => {
    expect(actionFor('POST', '/v3/me/invoices/:id/void', [])).toMatchObject({ actionKey: 'invoices.void', entityType: 'invoices' });
    expect(actionFor('POST', '/v3/admin/vendors/:id/lifecycle/delete-empty-listing', [])).toMatchObject({ actionKey: 'vendors.lifecycle_delete_empty_listing', entityType: 'vendors' });
    expect(actionFor('DELETE', '/v3/admin/blocklist/:id', [])).toMatchObject({ actionKey: 'blocklist.delete' });
    expect(actionFor('POST', '/v3/me/offers', [])).toMatchObject({ actionKey: 'offers.create' });
    expect(actionFor('PUT', '/v3/me/directory', ['about'])).toMatchObject({ actionKey: 'directory.update' });
  });
  it('every mutating signed-in route of the reviewed route baseline resolves to a key (nothing slips past the log)', () => {
    const routes = (baseline.routes as Array<{ route: string }>).map((r) => r.route.split(' ') as [string, string]).filter(([m, p]) => m !== 'GET' && /^\/v3\/(me|admin)\//.test(p));
    expect(routes.length).toBeGreaterThan(150);
    const missing = routes.filter(([m, p]) => !actionFor(m, p, [])).map(([m, p]) => `${m} ${p}`);
    expect(missing).toEqual(['POST /v3/me/site/theme/preview']);   // the one exemption
    for (const [m, p] of routes) { const a = actionFor(m, p, []); if (a) expect(a.actionKey).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/); }
  });
  it('a derived key can never be mistaken for an alert key by accident', () => {
    for (const [m, p] of (baseline.routes as Array<{ route: string }>).map((r) => r.route.split(' ') as [string, string]).filter(([mm, pp]) => mm !== 'GET' && /^\/v3\/(me|admin)\//.test(pp))) {
      const k = actionFor(m, p, [])?.actionKey; if (!k) continue;
      const explicit = /^(payment_method\.(created|updated|deleted)|business\.identity_changed|domain\.[a-z_]+|plan\.state_changed|account\.deletion_requested)$/.test(k);
      if (explicit) expect(['POST /v3/me/payment-methods', 'PUT /v3/me/payment-methods/:id', 'DELETE /v3/me/payment-methods/:id', 'POST /v3/me/domains/custom', 'PUT /v3/me/domains/subdomain', 'POST /v3/me/domains/:id/primary', 'DELETE /v3/me/domains/:id', 'POST /v3/admin/domains/:id/primary', 'POST /v3/admin/domains/:id/remove', 'PUT /v3/admin/domains/:id/state', 'PUT /v3/admin/vendors/:id/domains/subdomain', 'POST /v3/me/account/deletion-request', 'POST /v3/admin/vendors/:id/lifecycle/convert-to-free', 'POST /v3/admin/vendors/:id/lifecycle/restore-pro', 'POST /v3/admin/vendors/:id/lifecycle/extend-grace']).toContain(`${m} ${p}`);
    }
  });
});

describe('which vendor and which entity', () => {
  it('a /v3/me route belongs to the signed-in vendor (the interceptor passes the principal; the route never names one)', () => { expect(vendorOf('/v3/me/domains/custom', {}, 'v1')).toBe('v1'); expect(vendorOf('/v3/me/domains/:id', { id: 'd9' }, 'v1')).toBe('v1'); });
  it('a staff route belongs to the vendor it names: /vendors/:id or :vendorId; any other :id is not a vendor', () => {
    expect(vendorOf('/v3/admin/vendors/:id/lifecycle/restore-pro', { id: 'v7' }, null)).toBe('v7');
    expect(vendorOf('/v3/admin/wallets/:vendorId/adjustments', { vendorId: 'v8' }, null)).toBe('v8');
    expect(vendorOf('/v3/admin/domains/:id/remove', { id: 'dom1' }, null)).toBeNull();
    expect(vendorOf('/v3/admin/alert-rules', {}, null)).toBeNull();
  });
  it('the entity id is the last parameter of the route, and a vendor id is capped in length', () => {
    expect(entityIdOf('/v3/admin/vendors/:id/lifecycle/restore-pro', { id: 'v7' })).toBe('v7');
    expect(entityIdOf('/v3/me/domains/:id/primary', { id: 'd1' })).toBe('d1');
    expect(entityIdOf('/v3/me/domains/custom', {})).toBeNull();
    expect(entityIdOf('/v3/me/x/:id', { id: 'z'.repeat(500) })!.length).toBeLessThanOrEqual(120);
  });
});
