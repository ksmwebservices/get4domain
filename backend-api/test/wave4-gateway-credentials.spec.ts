import { randomBytes } from 'crypto';
import { ForbiddenException, Logger } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { checkCredentials, CREDENTIAL_CATEGORY, lastFour } from '../src/plan-billing/gateway/gateway-credentials-core';
import { GatewayCredentialsService } from '../src/plan-billing/gateway/gateway-credentials.service';
import { PaymentGatewaySettingsService } from '../src/plan-billing/gateway/gateway-settings.service';
import { BILLING_ERROR_CODES } from '../src/plan-billing/plan-billing.errors';
import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { BillingSettings, DEFAULT_BILLING_SETTINGS } from '../src/plan-billing/settings/billing-settings';

/**
 * Wave 4 W6: the gateway keys the SUPER_ADMIN enters in the admin app. Every secret in this file is made at run time. The point of the file is what must NEVER happen: a value coming back out.
 */
const secret = (): string => randomBytes(18).toString('hex');
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };
const ADMIN = { id: 'super-1', ip: '10.0.0.1' };

interface Row { category: string; key: string; value: string; encrypted: boolean; status: string; updatedAt: Date; updatedBy: string | null }
function fakePrisma() {
  const rows: Row[] = []; let tick = 0;
  const api = {
    rows,
    platformSetting: {
      findMany: async (q: { where: { category: string; key?: { startsWith?: string } } }) => rows.filter((r) => r.category === q.where.category && (!q.where.key?.startsWith || r.key.startsWith(q.where.key.startsWith))).map((r) => ({ ...r })),
      upsert: async (a: { where: { category_key: { category: string; key: string } }; update: Partial<Row>; create: Row }) => {
        const ex = rows.find((r) => r.category === a.where.category_key.category && r.key === a.where.category_key.key); tick++;
        if (ex) Object.assign(ex, a.update, { updatedAt: new Date(1_700_000_000_000 + tick * 1000) }); else rows.push({ ...a.create, updatedAt: new Date(1_700_000_000_000 + tick * 1000) });
      },
      deleteMany: async (a: { where: { category: string; key: { in: string[] } } }) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].category === a.where.category && a.where.key.in.includes(rows[i].key)) rows.splice(i, 1); },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
  };
  return api;
}
function make() {
  const prisma = fakePrisma(); const recorded: Array<Record<string, unknown>> = [];
  const svc = new GatewayCredentialsService(prisma as never, { record: async (r: Record<string, unknown>) => { recorded.push(r); } } as never);
  return { prisma, svc, recorded };
}
const RZ = () => ({ keyId: `rzp_test_${secret().slice(0, 14)}`, keySecret: secret(), webhookSecret: secret() });
const CF = () => ({ appId: secret().slice(0, 16), secretKey: secret() });

let savedKey: string | undefined;
beforeAll(() => { savedKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = secret(); });
afterAll(() => { if (savedKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = savedKey; });

describe('checkCredentials (pure)', () => {
  it('accepts a full set for each gateway', () => {
    const rz = RZ(); expect(checkCredentials('razorpay', 'test', rz)).toEqual({ ok: true, values: rz });
    const cf = CF(); expect(checkCredentials('cashfree', 'live', cf)).toEqual({ ok: true, values: cf });
  });
  it('names every missing field, and nothing but the field', () => {
    const r = checkCredentials('razorpay', 'test', {});
    expect(r).toEqual({ ok: false, fields: { keyId: 'required', keySecret: 'required', webhookSecret: 'required' } });
  });
  it('refuses short, long, spaced and non-text values, and unknown fields, without ever repeating a value', () => {
    const bad = secret();
    for (const v of ['abc', 'x'.repeat(201), `${bad} ${bad}`, `${bad}\n`.replace(/\n$/, '\nx'), 12345678, null, {}]) {
      const r = checkCredentials('cashfree', 'test', { appId: v, secretKey: secret() });
      expect(r.ok).toBe(false); expect(JSON.stringify(r)).not.toContain(bad);
    }
    const extra = checkCredentials('cashfree', 'test', { ...CF(), apiKey: secret() });
    expect(extra).toMatchObject({ ok: false, fields: { apiKey: expect.any(String) } });
    expect(checkCredentials('cashfree', 'test', 'a string')).toMatchObject({ ok: false });
    expect(checkCredentials('cashfree', 'test', [1])).toMatchObject({ ok: false });
  });
  it('a Razorpay key id carries the prefix of its mode, so a live key cannot be saved as a test key', () => {
    const live = { ...RZ(), keyId: `rzp_live_${secret().slice(0, 14)}` };
    expect(checkCredentials('razorpay', 'test', live)).toMatchObject({ ok: false, fields: { keyId: expect.stringContaining('rzp_test_') } });
    expect(checkCredentials('razorpay', 'live', live).ok).toBe(true);
    expect(checkCredentials('razorpay', 'live', RZ())).toMatchObject({ ok: false, fields: { keyId: expect.any(String) } });
  });
  it('trims the outside of a pasted value but never the inside', () => { const c = CF(); expect(checkCredentials('cashfree', 'test', { appId: `  ${c.appId} `, secretKey: c.secretKey })).toEqual({ ok: true, values: c }); });
  it('shows at most the last 4 characters of an identifier, and nothing for a short one', () => { expect(lastFour('rzp_test_abcdef123456')).toBe('3456'); expect(lastFour('short')).toBeNull(); expect(lastFour(null)).toBeNull(); expect(lastFour(undefined)).toBeNull(); });
  it('the registered error codes exist', () => { for (const c of ['GATEWAY_CREDENTIALS_INVALID', 'GATEWAY_CREDENTIALS_UNAVAILABLE']) expect(BILLING_ERROR_CODES).toContain(c); });
});

describe('GatewayCredentialsService: stored encrypted, write-only', () => {
  it('stores every value encrypted: nothing readable is in the table', async () => {
    const m = make(); const rz = RZ();
    await m.svc.set('razorpay', 'test', rz, ADMIN);
    expect(m.prisma.rows).toHaveLength(3); expect(m.prisma.rows.every((r) => r.category === CREDENTIAL_CATEGORY && r.encrypted && r.status === 'CONFIGURED' && r.updatedBy === 'super-1')).toBe(true);
    const table = JSON.stringify(m.prisma.rows);
    for (const v of Object.values(rz)) expect(table).not.toContain(v);
    expect(m.prisma.rows.every((r) => r.value.split(':').length === 3)).toBe(true);   // iv:tag:ciphertext, the platform settings format
  });

  it('the answer and the status carry only present, who, when and at most the last 4 of the key id', async () => {
    const m = make(); const rz = RZ(); const cf = CF();
    const a = await m.svc.set('razorpay', 'test', rz, ADMIN); await m.svc.set('cashfree', 'live', cf, ADMIN);
    expect(a).toEqual({ gateway: 'razorpay', mode: 'test', present: true, setBy: 'super-1', setAt: expect.any(Date), keyIdLast4: rz.keyId.slice(-4) });
    const all = await m.svc.status();
    expect(all).toHaveLength(4);
    expect(all.find((s) => s.gateway === 'razorpay' && s.mode === 'live')).toEqual({ gateway: 'razorpay', mode: 'live', present: false, setBy: null, setAt: null, keyIdLast4: null });
    expect(all.find((s) => s.gateway === 'cashfree' && s.mode === 'live')).toMatchObject({ present: true, keyIdLast4: cf.appId.slice(-4) });
    const text = JSON.stringify(all);
    for (const v of [...Object.values(rz), ...Object.values(cf)]) expect(text).not.toContain(v);
    expect(text).not.toContain(rz.keyId.slice(0, 12));   // no more than the last 4 characters of the key id
    expect(Object.keys(all[0]).sort()).toEqual(['gateway', 'keyIdLast4', 'mode', 'present', 'setAt', 'setBy']);   // no length, no hash, no webhook hint
  });

  it('setting again replaces the whole set; clearing removes it; clearing nothing changes nothing and is not audited', async () => {
    const m = make(); const first = RZ(); const second = RZ();
    await m.svc.set('razorpay', 'test', first, ADMIN); await m.svc.set('razorpay', 'test', second, ADMIN);
    expect(m.prisma.rows).toHaveLength(3);
    expect((await m.svc.resolve('razorpay', 'test'))).toEqual(second);
    const c = await m.svc.clear('razorpay', 'test', ADMIN); expect(c.present).toBe(false); expect(m.prisma.rows).toHaveLength(0);
    const before = m.recorded.length; await m.svc.clear('razorpay', 'test', ADMIN); expect(m.recorded.length).toBe(before);
    expect(await m.svc.resolve('razorpay', 'test')).toBeNull();
  });

  it('audits set and clear with the FIELD NAMES only, as the staff member, and never a value', async () => {
    const m = make(); const rz = RZ();
    await m.svc.set('razorpay', 'test', rz, ADMIN); await m.svc.clear('razorpay', 'test', ADMIN);
    expect(m.recorded.map((r) => r.actionKey)).toEqual(['billing.gateway.credentials.set', 'billing.gateway.credentials.cleared']);
    expect(m.recorded[0]).toMatchObject({ actor: { type: 'STAFF', id: 'super-1', ip: '10.0.0.1' }, entityType: 'PaymentGatewayCredentials', entityId: 'razorpay:test', summary: { fields: ['keyId', 'keySecret', 'webhookSecret'] } });
    for (const v of Object.values(rz)) expect(JSON.stringify(m.recorded)).not.toContain(v);
  });

  it('refuses a bad set with the registered code and fields, stores nothing, and echoes no value', async () => {
    const m = make(); const rz = RZ(); const long = secret();
    const e = await err(m.svc.set('razorpay', 'test', { ...rz, keySecret: `${long} ${long}` }, ADMIN));
    expect(code(e)).toBe('GATEWAY_CREDENTIALS_INVALID');
    const text = JSON.stringify((e as { getResponse: () => unknown }).getResponse());
    expect(text).toContain('keySecret'); for (const v of [...Object.values(rz), long]) expect(text).not.toContain(v);
    expect(m.prisma.rows).toHaveLength(0); expect(m.recorded).toHaveLength(0);
    expect(code(await err(m.svc.set('stripe', 'test', rz, ADMIN)))).toBe('GATEWAY_CREDENTIALS_INVALID');
    expect(code(await err(m.svc.set('razorpay', 'sandbox', rz, ADMIN)))).toBe('GATEWAY_CREDENTIALS_INVALID');
    expect(code(await err(m.svc.clear('razorpay', 'sandbox', ADMIN)))).toBe('GATEWAY_CREDENTIALS_INVALID');
  });

  it('with no master key the set is refused plainly (503, GATEWAY_CREDENTIALS_UNAVAILABLE) and nothing is stored', async () => {
    const m = make(); const k = process.env.PLATFORM_SETTINGS_KEY; delete process.env.PLATFORM_SETTINGS_KEY;
    try { const e = await err(m.svc.set('cashfree', 'test', CF(), ADMIN)); expect(code(e)).toBe('GATEWAY_CREDENTIALS_UNAVAILABLE'); expect((e as { getStatus: () => number }).getStatus()).toBe(503); expect(m.prisma.rows).toHaveLength(0); }
    finally { process.env.PLATFORM_SETTINGS_KEY = k; }
  });

  it('a tampered or unreadable row reads as "not set" (the environment then applies) and leaks nothing', async () => {
    const m = make(); await m.svc.set('cashfree', 'test', CF(), ADMIN);
    m.prisma.rows[0].value = 'AAAA:BBBB:CCCC'; m.svc['cache'].clear();
    expect(await m.svc.resolve('cashfree', 'test')).toBeNull();
    const s = (await m.svc.status()).find((x) => x.gateway === 'cashfree' && x.mode === 'test')!;
    expect(s).toMatchObject({ present: true, keyIdLast4: null });   // the row exists, but nothing can be read from it
  });

  it('an incomplete set (a row missing) is not present and not used', async () => {
    const m = make(); await m.svc.set('razorpay', 'test', RZ(), ADMIN);
    m.prisma.rows.splice(1, 1); m.svc['cache'].clear();
    expect(await m.svc.resolve('razorpay', 'test')).toBeNull();
    expect((await m.svc.status()).find((x) => x.gateway === 'razorpay' && x.mode === 'test')!.present).toBe(false);
  });

  it('the legacy settings screen does not know this category, so it cannot list or write it', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CATEGORY_MAP } = require('../src/platform-settings/platform-settings.constants') as { CATEGORY_MAP: Map<string, unknown> };
    expect(CATEGORY_MAP.has(CREDENTIAL_CATEGORY)).toBe(false);
  });
});

describe('redaction: no value reaches any log', () => {
  it('nothing is logged through the Nest logger or the console while keys are set, read, refused and cleared', async () => {
    const seen: string[] = [];
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((k) => jest.spyOn(Logger.prototype, k).mockImplementation((...a: unknown[]) => { seen.push(JSON.stringify(a)); }));
    const con = (['log', 'warn', 'error', 'info', 'debug'] as const).map((k) => jest.spyOn(console, k).mockImplementation((...a: unknown[]) => { seen.push(JSON.stringify(a)); }));
    try {
      const m = make(); const rz = RZ(); const cf = CF();
      await m.svc.set('razorpay', 'test', rz, ADMIN); await m.svc.set('cashfree', 'test', cf, ADMIN);
      await m.svc.status(); await m.svc.resolve('razorpay', 'test');
      await err(m.svc.set('razorpay', 'test', { ...rz, keySecret: 'bad value' }, ADMIN));
      m.prisma.rows[0].value = 'AAAA:BBBB:CCCC'; m.svc['cache'].clear(); await m.svc.resolve('razorpay', 'test');
      await m.svc.clear('razorpay', 'test', ADMIN);
      const all = JSON.stringify(seen);
      for (const v of [...Object.values(rz), ...Object.values(cf), 'bad value']) expect(all).not.toContain(v);
    } finally { for (const s of [...spies, ...con]) s.mockRestore(); }
  });
});

describe('PaymentsGate reads the stored keys first, then the environment', () => {
  const settingsOf = (over: Partial<BillingSettings>) => ({ get: async () => ({ ...DEFAULT_BILLING_SETTINGS, ...over }) }) as never;
  const envRz = () => ({ RAZORPAY_TEST_KEY_ID: 'rzp_test_envkey123456', RAZORPAY_TEST_KEY_SECRET: secret(), RAZORPAY_TEST_WEBHOOK_SECRET: secret() });

  it('stored keys win over the environment keys', async () => {
    const m = make(); const rz = RZ(); await m.svc.set('razorpay', 'test', rz, ADMIN);
    const g = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'razorpay' }), m.svc); g.env = envRz();
    expect((await g.gatewayPort()).publicKeyId()).toBe(rz.keyId);
  });
  it('with nothing stored the environment keys are used, exactly as before', async () => {
    const m = make(); const env = envRz();
    const g = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'razorpay' }), m.svc); g.env = env;
    expect((await g.gatewayPort()).publicKeyId()).toBe(env.RAZORPAY_TEST_KEY_ID);
    const none = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'cashfree' }), m.svc); none.env = {};
    expect(code(await err(none.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
  });
  it('stored keys alone are enough: checkout and the webhook adapter both work with an empty environment, on either gateway', async () => {
    const m = make(); await m.svc.set('cashfree', 'test', CF(), ADMIN); await m.svc.set('razorpay', 'test', RZ(), ADMIN);
    const g = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'cashfree' }), m.svc); g.env = {};
    expect((await g.gatewayPort()).gateway).toBe('cashfree');
    expect((await g.webhookGatewayPort('razorpay'))!.gateway).toBe('razorpay');
    expect((await g.portFor('cashfree')).mode).toBe('test');
  });
  it('clearing the keys reaches the gate at once on this server: the cached adapter is dropped', async () => {
    const m = make(); await m.svc.set('cashfree', 'test', CF(), ADMIN);
    const g = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'cashfree' }), m.svc); g.env = {};
    expect((await g.gatewayPort()).gateway).toBe('cashfree');
    await m.svc.clear('cashfree', 'test', ADMIN);
    expect(code(await err(g.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
    const fresh = CF(); await m.svc.set('cashfree', 'test', fresh, ADMIN);
    expect((await g.gatewayPort()).gateway).toBe('cashfree');
  });
  it('going live still needs the setting, the flag AND the live keys: stored live keys alone, or the flag alone, are not enough', async () => {
    const m = make(); const live = { ...RZ(), keyId: `rzp_live_${secret().slice(0, 14)}` };
    await m.svc.set('razorpay', 'live', live, ADMIN);
    const noFlag = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: 'razorpay' }), m.svc); noFlag.env = {};
    expect(code(await err(noFlag.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED'); expect(await noFlag.webhookGatewayPort('razorpay')).toBeNull();
    const flag = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: 'razorpay' }), m.svc); flag.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true' };
    const p = await flag.gatewayPort(); expect(p.mode).toBe('live'); expect(p.publicKeyId()).toBe(live.keyId);
    const noKeys = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: 'cashfree' }), m.svc); noKeys.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true' };
    expect(code(await err(noKeys.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
    const off = new PaymentsGate(settingsOf({ paymentsMode: 'off' }), m.svc); off.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true' };
    expect(code(await err(off.gatewayPort()))).toBe('PAYMENTS_DISABLED');
  });
});

describe('the admin gateway setting counts stored keys as keys', () => {
  it('test mode can be chosen with stored keys and an empty environment; without either it is refused GATEWAY_NOT_READY', async () => {
    const m = make(); await m.svc.set('cashfree', 'test', CF(), ADMIN);
    const stored: Partial<BillingSettings> = {};
    const prisma = { v3PlanSetting: { upsert: async (a: { where: { key: string }; update: { valueJson: unknown } }) => { (stored as Record<string, unknown>)[a.where.key] = a.update.valueJson; } } };
    const settings = { get: async () => ({ ...DEFAULT_BILLING_SETTINGS, ...stored }), invalidate: () => undefined };
    const svc = new PaymentGatewaySettingsService(prisma as never, settings as never, undefined, m.svc); svc.env = {};
    const v = await svc.update({ gateway: 'cashfree', mode: 'test' }, { id: 'a' });
    expect(v).toMatchObject({ gateway: 'cashfree', mode: 'test', configured: { cashfree: { test: true, live: false }, razorpay: { test: false, live: false } } });
    expect(code(await err(svc.update({ gateway: 'razorpay', mode: 'test' }, { id: 'a' })))).toBe('GATEWAY_NOT_READY');
    expect(code(await err(svc.update({ gateway: 'cashfree', mode: 'live' }, { id: 'a' })))).toBe('LIVE_NOT_ENABLED');
  });
});

describe('who may touch the keys: SUPER_ADMIN only, in every method', () => {
  const ROUTES = ['GET /v3/admin/payment-gateway/credentials', 'PUT /v3/admin/payment-gateway/credentials/:gateway/:mode', 'DELETE /v3/admin/payment-gateway/credentials/:gateway/:mode'];
  const principal = (adminRole?: string, over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(adminRole), ...over });
  const may = (u: AuthenticatedUser | undefined, key: string): boolean => {
    const [method, ...r] = key.split(' ');
    try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };
  it('exactly SUPER_ADMIN, by the data and by the guard', () => { for (const k of ROUTES) { expect([...effectiveRolesFor(k)]).toEqual(['SUPER_ADMIN']); expect(may(principal('SUPER_ADMIN'), k)).toBe(true); } });
  it('ADMIN, OPERATIONS, SALES, SUPPORT, the field labels, a vendor, a partner and anonymous are refused', () => {
    for (const role of ['ADMIN', 'OPERATIONS', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) for (const k of ROUTES) expect([role, k, may(principal(role), k)]).toEqual([role, k, false]);
    for (const u of [{ sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, { sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, undefined] as Array<AuthenticatedUser | undefined>) for (const k of ROUTES) expect(may(u, k)).toBe(false);
  });
});
