export {};
/* eslint-disable @typescript-eslint/no-require-imports */
/** Pure rules of the smoke probe (scripts/staging/smoke-probe-lib.js): which routes, what each role should get, how an answer is judged, no secret in the table. */
const lib = require('../scripts/staging/smoke-probe-lib');
const matrix = require('../src/auth/guards/admin-role-matrix');

const baseline = [
  { route: 'GET /v3/admin/payment-gateway', cls: 'admin' },
  { route: 'GET /v3/admin/gst-rate', cls: 'admin' },
  { route: 'GET /v3/admin/vendors/:id/entitlements', cls: 'admin' },
  { route: 'GET /v3/admin/partners/:id/links', cls: 'admin' },
  { route: 'POST /v3/admin/partners', cls: 'admin' },
  { route: 'GET /v3/partner/me', cls: 'authenticated' },
  { route: 'GET /v3/me/site/themes', cls: 'authenticated' },
  { route: 'GET /v3/me/domain-sales/search', cls: 'authenticated' },
  { route: 'GET /v3/public/pricing', cls: 'public' },
  { route: 'GET /v3/public/referral/:code', cls: 'public' },
  { route: 'GET /v3/public/subdomain-availability', cls: 'public' },
  { route: 'GET /vendors', cls: 'admin' },
];
const ids = { vendor: 'vend-1', referralCode: 'SMKTEST2' };

describe('smoke probe: route plan', () => {
  const plan = lib.planRoutes(baseline, matrix, ids);
  const keys = plan.routes.map((r: { key: string }) => r.key);
  it('takes only GET routes of the public, partner, vendor and admin areas, plus /health and /auth/me', () => {
    expect(keys).toEqual(expect.arrayContaining(['GET /health', 'GET /auth/me', 'GET /v3/admin/payment-gateway', 'GET /v3/partner/me', 'GET /v3/me/site/themes', 'GET /v3/public/pricing']));
    expect(keys).not.toContain('POST /v3/admin/partners');
    expect(keys).not.toContain('GET /vendors');
  });
  it('fills the vendor id and the referral code, adds known queries, and lists what it cannot fill as skipped', () => {
    const byKey = Object.fromEntries(plan.routes.map((r: { key: string; path: string }) => [r.key, r.path]));
    expect(byKey['GET /v3/admin/vendors/:id/entitlements']).toBe('/v3/admin/vendors/vend-1/entitlements');
    expect(byKey['GET /v3/public/referral/:code']).toBe('/v3/public/referral/SMKTEST2');
    expect(byKey['GET /v3/public/subdomain-availability']).toMatch(/\?name=/);
    expect(plan.skipped.map((s: { key: string }) => s.key)).toContain('GET /v3/admin/partners/:id/links');
  });
  it('never probes a route that reaches a provider', () => {
    expect(keys).not.toContain('GET /v3/me/domain-sales/search');
    expect(plan.skipped.find((s: { key: string }) => s.key === 'GET /v3/me/domain-sales/search').why).toMatch(/provider/);
  });
});

describe('smoke probe: expectations follow the role matrix', () => {
  const plan = lib.planRoutes(baseline, matrix, ids);
  const route = (k: string) => plan.routes.find((r: { key: string }) => r.key === k);
  it('payment gateway read: OPERATIONS, ADMIN and SUPER_ADMIN in; SALES, partner, vendors, anonymous out', () => {
    const r = route('GET /v3/admin/payment-gateway');
    const got = Object.fromEntries(['anon', ...lib.PRINCIPALS].map((p) => [p, lib.expectedFor(r, p)]));
    expect(got).toEqual({ anon: 'refuse', superAdmin: 'allow', admin: 'allow', sales: 'refuse', operations: 'allow', partner: 'refuse', vendorFree: 'refuse', vendorPaid: 'refuse' });
  });
  it('partner routes: only the partner; vendor routes: only the two vendors; public: everyone; /auth/me: every signed-in caller', () => {
    expect(lib.PRINCIPALS.filter((p: string) => lib.expectedFor(route('GET /v3/partner/me'), p) === 'allow')).toEqual(['partner']);
    expect(lib.PRINCIPALS.filter((p: string) => lib.expectedFor(route('GET /v3/me/site/themes'), p) === 'allow')).toEqual(['vendorFree', 'vendorPaid']);
    expect(['anon', ...lib.PRINCIPALS].every((p) => lib.expectedFor(route('GET /v3/public/pricing'), p) === 'allow')).toBe(true);
    expect(lib.expectedFor(route('GET /auth/me'), 'anon')).toBe('refuse');
    expect(lib.PRINCIPALS.every((p: string) => lib.expectedFor(route('GET /auth/me'), p) === 'allow')).toBe(true);
  });
  it('a matrix route with no entry is SUPER_ADMIN only (deny by default)', () => {
    const r = { key: 'GET /v3/admin/nothing-listed', kind: 'admin', staffRoles: [...matrix.effectiveRolesFor('GET /v3/admin/nothing-listed')] };
    expect(lib.PRINCIPALS.filter((p: string) => lib.expectedFor(r, p) === 'allow')).toEqual(['superAdmin']);
  });
});

describe('smoke probe: judging an answer', () => {
  it('a refused caller must get 401 or 403; a 200 is a leak and a 500 is a bug', () => {
    expect(lib.judge('refuse', 403)).toBe('PASS'); expect(lib.judge('refuse', 401)).toBe('PASS');
    expect(lib.judge('refuse', 200)).toBe('FAIL'); expect(lib.judge('refuse', 500)).toBe('FAIL'); expect(lib.judge('refuse', 404)).toBe('FAIL');
  });
  it('an allowed caller: 2xx passes; a plan gate is GATED; input errors are REACH; a bare 403 or a 5xx fails', () => {
    expect(lib.judge('allow', 200)).toBe('PASS');
    expect(lib.judge('allow', 403, 'FEATURE_LOCKED')).toBe('GATED');
    expect(lib.judge('allow', 403, 'PLAN_REQUIRED')).toBe('GATED');
    for (const s of [400, 404, 409, 422]) expect(lib.judge('allow', s)).toBe('REACH');
    expect(lib.judge('allow', 403)).toBe('FAIL'); expect(lib.judge('allow', 403, 'FORBIDDEN')).toBe('FAIL');
    expect(lib.judge('allow', 500)).toBe('FAIL'); expect(lib.judge('allow', 0, 'NETWORK')).toBe('FAIL');
  });
});

describe('smoke probe: the table', () => {
  const plan = lib.planRoutes(baseline, matrix, ids);
  const answers: Array<{ r: { key: string }; p: string; status: number; code: string | null }> = [];
  for (const r of plan.routes) for (const p of ['anon', ...lib.PRINCIPALS]) answers.push({ r, p, status: lib.expectedFor(r, p) === 'allow' ? 200 : p === 'anon' ? 401 : 403, code: null });
  it('a clean run has no failures and names every route and column', () => {
    const rows = lib.collect(plan.routes, answers);
    expect(rows.every((x: { verdict: string }) => x.verdict === 'PASS')).toBe(true);
    const md = lib.renderMarkdown(rows, plan, { api: 'http://localhost:3008' });
    expect(md).toContain('0 FAIL'); expect(md).toContain('| route | anon | superAdmin | admin | sales | operations | partner | vendorFree | vendorPaid |');
    expect(md).toContain('/v3/admin/payment-gateway');
  });
  it('a leak is shown as WANT-OUT in the failure list and in the console summary', () => {
    const leaked = answers.map((a: { r: { key: string }; p: string; status: number; code: string | null }) => (a.r.key === 'GET /v3/admin/payment-gateway' && a.p === 'sales' ? { ...a, status: 200 } : a));
    const rows = lib.collect(plan.routes, leaked);
    const md = lib.renderMarkdown(rows, plan, {});
    expect(md).toContain('1 FAIL'); expect(md).toMatch(/\| `GET \/v3\/admin\/payment-gateway` \| sales \| refused \| 200 \|/);
    expect(lib.renderConsole(rows)).toContain('sales=200 WANT-OUT');
  });
  it('redactAll removes a token or password that slipped into a text', () => {
    expect(lib.redactAll('Bearer eyJabc.def and Passw0rdXyz', ['eyJabc.def', 'Passw0rdXyz'])).toBe('Bearer *** and ***');
  });
});
