export {};
/* eslint-disable @typescript-eslint/no-require-imports */
/** Pure rules of the staging smoke kit (scripts/staging/smoke-lib.js): names fit the synthetic cleanup, refusals, no secret in anything printed. No database, no network. */
const lib = require('../scripts/staging/smoke-lib');
const cleanup = require('../scripts/staging/test-tenant-cleanup');

describe('smoke kit: names match the existing synthetic cleanup', () => {
  it('every e-mail ends with the cleanup suffix and carries the tag the reset passes as the run id', () => {
    expect(lib.TEST_EMAIL_SUFFIX).toBe(cleanup.TEST_EMAIL_SUFFIX);
    expect(lib.TEST_NAME_PREFIX).toBe(cleanup.TEST_NAME_PREFIX);
    for (const e of lib.allSmokeEmails()) { expect(e.endsWith(cleanup.TEST_EMAIL_SUFFIX)).toBe(true); expect(e).toContain(lib.SMOKE_TAG); expect(lib.isSmokeEmail(e)).toBe(true); }
  });
  it('every business name starts with V3TEST, and e-mails are unique', () => {
    for (const s of lib.USER_SPECS.filter((u: { kind: string }) => u.kind === 'vendor')) expect(lib.businessNameFor(s.label).startsWith('V3TEST')).toBe(true);
    const all = lib.allSmokeEmails(); expect(new Set(all).size).toBe(all.length);
  });
  it('a real address is never taken for a smoke one', () => {
    for (const e of ['admin@get4domain.com', 'smoke-x@example.com', 'someone@v3test.invalid', '']) expect(lib.isSmokeEmail(e)).toBe(false);
    expect(lib.isSmokeEmail(undefined)).toBe(false);
  });
  it('covers the roles asked for: SUPER_ADMIN, ADMIN, SALES (MARKETING), OPERATIONS, partner with a code, a free and a paid vendor', () => {
    const roles = lib.USER_SPECS.map((u: { adminRole?: string; plan?: string }) => u.adminRole ?? u.plan);
    expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'ADMIN', 'MARKETING', 'OPERATIONS', 'REFERRAL_PARTNER', 'handyman_free', 'handyman_pro']));
    expect(lib.REFERRAL_CODE).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  });
});

describe('smoke kit: passwords', () => {
  it('are 24 characters with every class, and differ on every call', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) { const p = lib.makePassword(); expect(p).toHaveLength(24); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[0-9]/); seen.add(p); }
    expect(seen.size).toBe(50);
  });
});

describe('smoke kit: refusal rules', () => {
  const ok = { stagingGuardPassed: true, argv: [] as string[], env: {}, usersFile: 'C:\\Get4Domain\\smoke\\users.json', repoRoot: 'C:\\Get4Domain\\get4domain-w2' };
  it('runs when everything is in order, with or without --reset', () => {
    expect(lib.seedRefusal(ok)).toBeNull();
    expect(lib.seedRefusal({ ...ok, argv: ['--reset'] })).toBeNull();
  });
  it('refuses when the staging guard did not pass, in production, live, or with an unknown flag', () => {
    expect(lib.seedRefusal({ ...ok, stagingGuardPassed: false })).toMatch(/staging guard/);
    expect(lib.seedRefusal({ ...ok, env: { NODE_ENV: 'production' } })).toMatch(/production/);
    expect(lib.seedRefusal({ ...ok, env: { V3_LIVE: 'true' } })).toMatch(/V3_LIVE/);
    expect(lib.seedRefusal({ ...ok, argv: ['--database-url', 'x'] })).toMatch(/unknown argument/);
  });
  it('refuses a users file inside the repository, with the wrong name, or under .git', () => {
    expect(lib.seedRefusal({ ...ok, usersFile: 'C:\\Get4Domain\\get4domain-w2\\backend-api\\users.json' })).toMatch(/outside the repository/);
    expect(lib.seedRefusal({ ...ok, usersFile: 'C:\\Get4Domain\\smoke\\creds.json' })).toMatch(/named users\.json/);
    expect(lib.outputPathRefusal('C:\\x\\.git\\users.json', undefined)).toMatch(/\.git/);
    expect(lib.outputPathRefusal('', undefined)).toMatch(/no users file/);
  });
  it('the API launcher refuses without the guard, in production, live, or when an env file exists', () => {
    const a = { stagingGuardPassed: true, env: {}, existingEnvFiles: [] as string[] };
    expect(lib.apiRefusal(a)).toBeNull();
    expect(lib.apiRefusal({ ...a, stagingGuardPassed: false })).toMatch(/staging guard/);
    expect(lib.apiRefusal({ ...a, env: { NODE_ENV: 'production' } })).toMatch(/production/);
    expect(lib.apiRefusal({ ...a, env: { V3_LIVE: 'true' } })).toMatch(/V3_LIVE/);
    expect(lib.apiRefusal({ ...a, existingEnvFiles: ['.env.local'] })).toMatch(/\.env\.local/);
  });
});

describe('smoke kit: the local API environment', () => {
  const staging = { DATABASE_URL: 'postgresql://u:p@h:5432/d', DIRECT_URL: 'postgresql://u:p@h:5432/d' };
  const built = lib.buildApiEnv({ parentEnv: { PATH: 'x', RAZORPAY_KEY_ID: 'rzp_live_real', RESEND_API_KEY: 're_real', V3_LIVE: 'true', OPENAI_API_KEY: 'sk-real', PLATFORM_SETTINGS_KEY: 'parent' }, staging, port: 3008, origins: lib.DEFAULT_ORIGINS, jwtSecret: 'a'.repeat(64) });
  it('removes every provider variable and the live flag; gateways, mail and schedulers are off', () => {
    for (const k of lib.PROVIDER_ENV) { if (k in lib.PLACEHOLDER_GATEWAY_ENV) expect(String(built[k])).toMatch(/^placeholder/); else expect(built[k]).toBeUndefined(); }
    for (const k of ['RAZORPAY_TEST_KEY_ID', 'RAZORPAY_LIVE_KEY_ID', 'CASHFREE_LIVE_APP_ID']) expect(lib.PROVIDER_ENV).toContain(k);
    expect(built.V3_LIVE).toBeUndefined();
    expect(built.PLAN_PAYMENTS_LIVE_ENABLED).toBe('false');
    expect(built.EMAIL_MODE).toBe('test'); expect(built.NODE_ENV).toBe('development'); expect(built.LEADSPACE_SCHEDULER).toBe('off');
    expect(built.PLATFORM_SETTINGS_KEY).toBeUndefined();   // taken from the staging file or absent, never from the parent shell
  });
  it('names the four front-end dev origins in strict CORS mode', () => {
    expect(built.CORS_MODE).toBe('strict');
    expect(built.CORS_EXTRA_ORIGINS.split(',')).toEqual(lib.DEFAULT_ORIGINS);
  });
  it('the printed names never include a value', () => {
    const printed = lib.API_ENV_NAMES.join(', ');
    for (const v of [built.JWT_SECRET, staging.DATABASE_URL]) expect(printed).not.toContain(v);
  });
  it('parses flags and refuses a bad port, a non-local origin or an unknown flag', () => {
    expect(lib.parseApiArgs([])).toEqual({ port: 3008, origins: lib.DEFAULT_ORIGINS });
    expect(lib.parseApiArgs(['--port', '3100', '--origins', 'http://localhost:4000/'])).toEqual({ port: 3100, origins: ['http://localhost:4000'] });
    expect(lib.parseApiArgs(['--port', '80']).error).toMatch(/--port/);
    expect(lib.parseApiArgs(['--origins', 'https://evil.example']).error).toMatch(/--origins/);
    expect(lib.parseApiArgs(['--db', 'x']).error).toMatch(/unknown/);
  });
});

describe('smoke kit: no secret in any output', () => {
  const created: Record<string, { id: string; email: string; password: string; plan?: string; subdomain?: string }> = {};
  for (const s of lib.USER_SPECS) created[s.key] = { id: `id-${s.key}`, email: lib.emailFor(s.label), password: lib.makePassword(), ...(s.plan ? { plan: s.plan, subdomain: s.subdomain } : {}) };
  it('the summary lines carry roles, e-mails and ids, never a password', () => {
    const text = lib.summaryLines(created).join('\n');
    for (const c of Object.values(created)) { expect(text).not.toContain(c.password); expect(text).toContain(c.email); }
  });
  it('the users file holds each password once and nothing else secret', () => {
    const file = lib.buildUsersFile(created, { referralCode: lib.REFERRAL_CODE });
    expect(Object.keys(file.users)).toHaveLength(lib.USER_SPECS.length);
    expect(file.users.partner.role).toBe('PARTNER'); expect(file.users.sales.role).toBe('MARKETING');
    for (const k of Object.keys(created)) expect(file.users[k].password).toBe(created[k].password);
  });
  it('redact removes secrets, longest first, and ignores very short values', () => {
    expect(lib.redact('token abcdefgh and abcd', ['abcd', 'abcdefgh', 'x'])).toBe('token *** and ***');
    expect(lib.redact('keep x', ['x'])).toBe('keep x');
  });
});
