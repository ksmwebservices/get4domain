import { expiryFor, isForbiddenInSession, SESSION_HEADER, stateOf } from '../src/v3-website/act-on-behalf/act-on-behalf-core';
import { mergeQueue, QueueItem } from '../src/v3-website/onboarding/onboarding-core';
import { validateWebsiteSetting, DEFAULT_WEBSITE_SETTINGS } from '../src/v3-website/settings/website-settings';

/** Slice 5.13b (pure): what staff may not do inside an act-on-behalf session, when a session is live, the expiry, the settings, and the onboarding queue merge. */
describe('what is forbidden inside a session', () => {
  it('changing a payment method, a bank detail, a UPI id, a payee or a password is refused whatever the verb', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const route of [
      '/v3/admin/vendors/:vendorId/payment-methods', '/v3/admin/vendors/:vendorId/payment-methods/:id', '/v3/admin/vendors/:id/upi', '/v3/admin/vendors/:id/upi-id', '/v3/admin/vendors/:id/bank-details',
      '/v3/admin/vendors/:id/bank', '/v3/admin/vendors/:id/password', '/v3/admin/vendors/:id/reset-password', '/v3/admin/vendors/:id/password-reset', '/v3/admin/vendors/:id/payee', '/v3/admin/vendors/:id/payment-requests',
    ]) expect([method, route, isForbiddenInSession(method, route)]).toEqual([method, route, true]);
  });
  it('reading them (the masked staff view) and every other vendor action is allowed', () => {
    expect(isForbiddenInSession('GET', '/v3/admin/vendors/:vendorId/payment-methods')).toBe(false); expect(isForbiddenInSession('HEAD', '/v3/admin/vendors/:id/bank')).toBe(false);
    for (const [m, r] of [['PUT', '/v3/admin/vendors/:id/site/theme'], ['POST', '/v3/admin/vendors/:id/site/banner'], ['POST', '/v3/admin/vendors/:id/site/media'], ['POST', '/v3/admin/vendors/:id/lifecycle/restore-pro'], ['PUT', '/v3/admin/vendors/:id/site/noindex']] as const) expect(isForbiddenInSession(m, r)).toBe(false);
  });
  it('a route parameter that happens to be named like one of those words does not trigger it, and the check is case-blind', () => {
    expect(isForbiddenInSession('POST', '/v3/admin/vendors/:upi/site/banner')).toBe(false); expect(isForbiddenInSession('POST', '/v3/admin/vendors/:id/Payment-Methods')).toBe(true);
  });
  it('the header name is fixed', () => { expect(SESSION_HEADER).toBe('x-act-on-behalf-session'); });
});

describe('a session\'s life', () => {
  const at = (iso: string) => new Date(iso);
  it('is ACTIVE until it is ended or its time is up; the moment of expiry counts as expired', () => {
    const s = { endedAt: null, expiresAt: at('2026-11-11T10:30:00Z') };
    expect(stateOf(s, at('2026-11-11T10:29:59Z'))).toBe('ACTIVE'); expect(stateOf(s, at('2026-11-11T10:30:00Z'))).toBe('EXPIRED'); expect(stateOf(s, at('2026-11-11T11:00:00Z'))).toBe('EXPIRED');
    expect(stateOf({ ...s, endedAt: at('2026-11-11T10:10:00Z') }, at('2026-11-11T10:11:00Z'))).toBe('ENDED');
  });
  it('the expiry is the start plus the staff setting, in minutes', () => { expect(expiryFor(at('2026-11-11T10:00:00Z'), 45).toISOString()).toBe('2026-11-11T10:45:00.000Z'); });
});

describe('the session length is a staff setting with no default', () => {
  it('starts unset; the settings API takes a whole number above zero', () => {
    expect(DEFAULT_WEBSITE_SETTINGS).toMatchObject({ actOnBehalfMaxMinutes: null });
    expect(() => validateWebsiteSetting('actOnBehalfMaxMinutes', 30)).not.toThrow(); for (const bad of [0, -5, 1.5, '30', null]) expect(() => validateWebsiteSetting('actOnBehalfMaxMinutes', bad)).toThrow();
  });
});

describe('the onboarding queue merge', () => {
  const item = (kind: QueueItem['kind'], vendorId: string, since: string): QueueItem => ({ kind, vendorId, businessName: `B ${vendorId}`, state: 'X', since: new Date(since), detail: {} });
  const all = [item('SEEDED', 'a', '2026-11-01T00:00:00Z'), item('CLAIM', 'b', '2026-11-05T00:00:00Z'), item('NEW_VENDOR', 'c', '2026-11-03T00:00:00Z'), item('SEEDED', 'd', '2026-11-04T00:00:00Z')];
  it('lists the oldest waiting first, so the longest wait is on top', () => { expect(mergeQueue(all, 1, 10).items.map((i) => i.vendorId)).toEqual(['a', 'c', 'd', 'b']); });
  it('filters by kind and pages', () => {
    expect(mergeQueue(all, 1, 10, 'SEEDED').items.map((i) => i.vendorId)).toEqual(['a', 'd']);
    const p = mergeQueue(all, 2, 3); expect(p).toMatchObject({ page: 2, pageSize: 3, total: 4 }); expect(p.items.map((i) => i.vendorId)).toEqual(['b']);
  });
  it('counts each kind for the screen header', () => { expect(mergeQueue(all, 1, 10).counts).toEqual({ SEEDED: 2, CLAIM: 1, NEW_VENDOR: 1 }); });
  it('a vendor that appears under more than one kind is shown once, as its most advanced kind (CLAIM over SEEDED over NEW_VENDOR)', () => {
    const dup = [item('NEW_VENDOR', 'x', '2026-11-01T00:00:00Z'), item('SEEDED', 'x', '2026-11-02T00:00:00Z'), item('CLAIM', 'x', '2026-11-03T00:00:00Z'), item('SEEDED', 'y', '2026-11-02T00:00:00Z')];
    const m = mergeQueue(dup, 1, 10); expect(m.items.map((i) => `${i.vendorId}:${i.kind}`).sort()).toEqual(['x:CLAIM', 'y:SEEDED']);
  });
});
