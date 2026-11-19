import { randomBytes } from 'crypto';
import { ForbiddenException, Logger } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { INTEGRATION_CATEGORY, checkSet, INTEGRATION_ERROR_CODES, PROVIDER_KEYS } from '../src/v3-integrations/integrations-core';
import { IntegrationSettingsService } from '../src/v3-integrations/integration-settings.service';
import { IntegrationProbe, LiveIntegrationProbe, stateOfRegistrarError, FetchFn } from '../src/v3-integrations/integration-probe';
import { RegistrarError } from '../src/v3-registrar/registrar.port';

/**
 * R1.1: the integration settings. Every secret in this file is made at run time. The point is what must NEVER happen: a secret in a response, an audit row, a log line or an error.
 * No test here calls any real provider: the probe is a fake, or the live probe is given a fake fetch.
 */
const secret = (): string => randomBytes(18).toString('hex');
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.())?.code ?? '';
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
class FakeProbe extends IntegrationProbe { calls: Array<{ provider: string; values: Record<string, string> }> = []; answer: 'OK' | 'ACCESS_DENIED' | 'REJECTED' | 'TIMEOUT' = 'OK'; async probe(provider: never, values: never) { this.calls.push({ provider, values }); return this.answer; } }
function make() {
  const prisma = fakePrisma(); const recorded: Array<Record<string, unknown>> = []; const probe = new FakeProbe();
  const svc = new IntegrationSettingsService(prisma as never, probe, { record: async (r: Record<string, unknown>) => { recorded.push(r); } } as never);
  return { prisma, svc, recorded, probe };
}
const RC = () => ({ resellerId: '12345678', apiKey: secret(), mode: 'demo' });
const EM = () => ({ apiKey: `re_${secret()}`, sender: 'Get4Domain <hello@example.com>' });
const CL = () => ({ apiKey: `sk-ant-${secret()}`, monthlyCapRupees: 5000 });

let savedKey: string | undefined;
beforeAll(() => { savedKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = secret(); });
afterAll(() => { if (savedKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = savedKey; });

describe('checkSet (pure)', () => {
  it('accepts a full set for ResellerClub, e-mail and Claude', () => {
    expect(checkSet('resellerclub', RC()).ok).toBe(true); expect(checkSet('email', EM()).ok).toBe(true); expect(checkSet('claude', CL()).ok).toBe(true);
  });
  it('names every missing field and nothing but the field', () => {
    expect(checkSet('resellerclub', {})).toEqual({ ok: false, fields: { resellerId: 'required', apiKey: 'required', mode: 'required' } });
  });
  it('refuses a bad reseller id, mode, key shape, sender and cap, without repeating a value', () => {
    const bad = secret();
    const r = checkSet('resellerclub', { resellerId: 'abc', apiKey: 'short', mode: 'prod' });
    expect(r).toMatchObject({ ok: false, fields: { resellerId: 'must be the numeric reseller id', apiKey: 'must be 8 to 300 characters', mode: 'must be demo or live' } });
    expect(checkSet('email', { apiKey: `${bad}`, sender: 'nobody' })).toMatchObject({ ok: false, fields: { apiKey: 'must be a Resend key (it starts with re_)', sender: 'must be an address or "Name <address>"' } });
    expect(checkSet('claude', { apiKey: `sk-${bad}`, monthlyCapRupees: '12.5' })).toMatchObject({ ok: false, fields: { monthlyCapRupees: expect.stringContaining('whole number') } });
    expect(checkSet('claude', { apiKey: `sk ${bad}`, monthlyCapRupees: 1 })).toMatchObject({ ok: false, fields: { apiKey: 'must not contain spaces or line breaks' } });
    expect(JSON.stringify([r, checkSet('email', { apiKey: bad })])).not.toContain(bad);
  });
  it('WhatsApp and SMS accept nothing', () => { for (const p of ['whatsapp', 'sms'] as const) expect(checkSet(p, { apiKey: secret() })).toEqual({ ok: false, fields: { provider: 'not available' } }); });
});

describe('the settings service: set, read, clear', () => {
  it('stores each field encrypted under its own category, and the read says set with the date (never the value)', async () => {
    const { svc, prisma } = make(); const v = RC();
    const s = await svc.set('resellerclub', v, ADMIN);
    expect(s).toMatchObject({ provider: 'resellerclub', state: 'SET', setBy: 'super-1' }); expect(s.setAt).toBeInstanceOf(Date);
    expect(s.fields.find((f) => f.field === 'apiKey')).toEqual({ field: 'apiKey', label: 'API key', secret: true, state: 'set' });
    expect(s.fields.find((f) => f.field === 'mode')).toMatchObject({ secret: false, state: 'set', value: 'demo' });
    expect(s.fields.find((f) => f.field === 'resellerId')).toMatchObject({ hint: '5678' });
    expect(prisma.rows.every((r) => r.category === INTEGRATION_CATEGORY && r.encrypted && !r.value.includes(v.apiKey) && !r.value.includes(v.resellerId))).toBe(true);
    expect(JSON.stringify(s)).not.toContain(v.apiKey);
  });
  it('the list covers every provider; WhatsApp and SMS read NOT_AVAILABLE and cannot be saved or tested into existence', async () => {
    const { svc } = make();
    const all = await svc.status();
    expect(all.map((p) => p.provider)).toEqual([...PROVIDER_KEYS]);
    expect(all.find((p) => p.provider === 'whatsapp')).toMatchObject({ state: 'NOT_AVAILABLE', available: false, fields: [] });
    expect(all.find((p) => p.provider === 'resellerclub')!.state).toBe('NOT_SET');
    expect(code(await err(svc.set('sms', { apiKey: secret() }, ADMIN)))).toBe('INTEGRATION_NOT_AVAILABLE');
    expect((await svc.test('whatsapp', ADMIN)).state).toBe('NOT_AVAILABLE');
  });
  it('a refusal carries the registered code and names the field, never a value', async () => {
    const { svc } = make(); const bad = secret();
    const e = await err(svc.set('claude', { apiKey: bad, monthlyCapRupees: 'many' }, ADMIN));
    expect(code(e)).toBe('INTEGRATION_INVALID'); expect(JSON.stringify((e as { getResponse: () => unknown }).getResponse())).not.toContain(bad);
    expect(code(await err(svc.set('nope', {}, ADMIN)))).toBe('INTEGRATION_UNKNOWN');
  });
  it('resolve gives the decrypted set to an adapter, only when complete; a replace is whole; clear removes it', async () => {
    const { svc, prisma } = make(); const v = RC();
    expect(await svc.resolve('resellerclub')).toBeNull();
    await svc.set('resellerclub', v, ADMIN);
    expect(await svc.resolve('resellerclub')).toEqual(v);
    const v2 = { ...RC(), mode: 'live' }; await svc.set('resellerclub', v2, ADMIN);
    expect(await svc.resolve('resellerclub')).toEqual(v2);
    prisma.rows.splice(prisma.rows.findIndex((r) => r.key === 'resellerclub.apiKey'), 1); svc['cache'].clear();
    expect(await svc.resolve('resellerclub')).toBeNull();   // incomplete = not set
    expect((await svc.statusOf('resellerclub')).state).toBe('NOT_SET');
    await svc.set('resellerclub', v, ADMIN); await svc.clear('resellerclub', ADMIN);
    expect(prisma.rows).toHaveLength(0); expect(await svc.resolve('resellerclub')).toBeNull();
  });
  it('an unreadable value (wrong master key) reads as not set, not as an error', async () => {
    const { svc } = make(); await svc.set('email', EM(), ADMIN);
    const was = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = secret(); svc['cache'].clear();
    try { expect(await svc.resolve('email')).toBeNull(); expect((await svc.statusOf('email')).state).toBe('NOT_SET'); } finally { process.env.PLATFORM_SETTINGS_KEY = was; }
  });
  it('without a master key nothing is stored and the answer says so plainly', async () => {
    const { svc, prisma } = make(); const was = process.env.PLATFORM_SETTINGS_KEY; delete process.env.PLATFORM_SETTINGS_KEY;
    try { expect(code(await err(svc.set('claude', CL(), ADMIN)))).toBe('INTEGRATION_UNAVAILABLE'); expect(prisma.rows).toHaveLength(0); } finally { process.env.PLATFORM_SETTINGS_KEY = was; }
  });
});

describe('the audit and the test route', () => {
  it('every change is audited with field NAMES only: set, clear (only when something was there), and each test with its state', async () => {
    const { svc, recorded } = make(); const v = EM();
    await svc.set('email', v, ADMIN); await svc.clear('email', ADMIN); await svc.clear('email', ADMIN);
    expect(recorded.map((r) => r.actionKey)).toEqual(['integration.set', 'integration.cleared']);
    expect(recorded[0]).toMatchObject({ vendorId: null, entityType: 'Integration', entityId: 'email', actor: { type: 'STAFF', id: 'super-1', ip: '10.0.0.1' }, summary: { fields: ['apiKey', 'sender'] } });
    expect(JSON.stringify(recorded)).not.toContain(v.apiKey); expect(JSON.stringify(recorded)).not.toContain('hello@example.com');
  });
  it('a failing audit never undoes the change', async () => {
    const prisma = fakePrisma(); const svc = new IntegrationSettingsService(prisma as never, new FakeProbe(), { record: async () => { throw new Error('audit down'); } } as never);
    expect((await svc.set('claude', CL(), ADMIN)).state).toBe('SET');
  });
  it('TEST: not configured makes no call; configured passes the SAVED set to the probe once; the result is a state and a sentence, audited with the state', async () => {
    const { svc, probe, recorded } = make();
    expect(await svc.test('resellerclub', ADMIN)).toMatchObject({ state: 'NOT_CONFIGURED' }); expect(probe.calls).toHaveLength(0);
    const v = RC(); await svc.set('resellerclub', v, ADMIN);
    for (const answer of ['OK', 'ACCESS_DENIED', 'REJECTED', 'TIMEOUT'] as const) {
      probe.answer = answer; const r = await svc.test('resellerclub', ADMIN);
      expect(r.state).toBe(answer); expect(r.message.length).toBeGreaterThan(20); expect(JSON.stringify(r)).not.toContain(v.apiKey);
    }
    expect(probe.calls).toHaveLength(4); expect(probe.calls[0]).toEqual({ provider: 'resellerclub', values: v });
    expect(recorded.filter((r) => r.actionKey === 'integration.tested').map((r) => (r.summary as { state: string }).state)).toEqual(['NOT_CONFIGURED', 'OK', 'ACCESS_DENIED', 'REJECTED', 'TIMEOUT']);
  });
  it('a probe that throws reads as UNKNOWN, never as an error with detail', async () => {
    const { svc, probe } = make(); await svc.set('claude', CL(), ADMIN);
    probe.probe = async () => { throw new Error('connect ECONNREFUSED with key sk-ant-leak'); };
    const r = await svc.test('claude', ADMIN); expect(r.state).toBe('UNKNOWN'); expect(JSON.stringify(r)).not.toContain('sk-ant-leak');
  });
});

describe('no secret in any response, error, audit row or log line', () => {
  it('runs every operation and searches everything that came out', async () => {
    const lines: string[] = [];
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation(((...x: unknown[]) => { lines.push(x.map(String).join(' ')); }) as never));
    const spyOut = jest.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.join(' ')); });
    const { svc, recorded, probe } = make(); const secrets: string[] = []; const out: unknown[] = [];
    try {
      for (const [p, v] of [['resellerclub', RC()], ['email', EM()], ['claude', CL()]] as const) {
        secrets.push(v.apiKey as string);
        out.push(await svc.set(p, v, ADMIN), await svc.statusOf(p), await svc.test(p, ADMIN));
        probe.answer = 'REJECTED'; out.push(await svc.test(p, ADMIN));
      }
      out.push(await svc.status());
      const e1 = await err(svc.set('email', { apiKey: `bad ${secrets[1]}`, sender: 'x' }, ADMIN)); out.push((e1 as { getResponse: () => unknown }).getResponse());
      await svc.clear('claude', ADMIN); out.push(await svc.status());
    } finally { spies.forEach((s) => s.mockRestore()); spyOut.mockRestore(); }
    const everything = JSON.stringify([out, recorded, lines]);
    for (const s of secrets) expect(everything).not.toContain(s);
    expect(everything).not.toContain(process.env.PLATFORM_SETTINGS_KEY as string);
  });
});

describe('the live probe (given a fake fetch: no real provider is ever called here)', () => {
  const probeWith = (status: number, body: unknown = {}, throws?: { name: string }) => {
    const p = new LiveIntegrationProbe(); const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    p.fetchFn = (async (url: string, init: { headers: Record<string, string> }) => { seen.push({ url, headers: init.headers }); if (throws) throw throws; return { status, json: async () => body }; }) as unknown as FetchFn;
    return { p, seen };
  };
  it('e-mail: GET /domains, OK on 200, OK for a sending-only key, REJECTED on 401 or 400, TIMEOUT on abort, UNREACHABLE otherwise; the key is only in the header', async () => {
    const k = `re_${secret()}`;
    expect(await probeWith(200).p.probe('email', { apiKey: k, sender: 'a@b.co' })).toBe('OK');
    expect(await probeWith(401, { name: 'restricted_api_key' }).p.probe('email', { apiKey: k, sender: 'a@b.co' })).toBe('OK');
    expect(await probeWith(401, { name: 'invalid_api_key' }).p.probe('email', { apiKey: k, sender: 'a@b.co' })).toBe('REJECTED');
    expect(await probeWith(200, {}, { name: 'AbortError' }).p.probe('email', { apiKey: k, sender: 'a@b.co' })).toBe('TIMEOUT');
    expect(await probeWith(200, {}, { name: 'TypeError' }).p.probe('email', { apiKey: k, sender: 'a@b.co' })).toBe('UNREACHABLE');
    const { p, seen } = probeWith(200); await p.probe('email', { apiKey: k, sender: 'a@b.co' });
    expect(seen[0].url).toBe('https://api.resend.com/domains'); expect(seen[0].url).not.toContain(k); expect(seen[0].headers.authorization).toBe(`Bearer ${k}`);
  });
  it('Claude: GET /v1/models; 200 OK, 401 REJECTED, 403 ACCESS_DENIED', async () => {
    const k = `sk-ant-${secret()}`;
    expect(await probeWith(200).p.probe('claude', { apiKey: k, monthlyCapRupees: '1' })).toBe('OK');
    expect(await probeWith(401).p.probe('claude', { apiKey: k, monthlyCapRupees: '1' })).toBe('REJECTED');
    expect(await probeWith(403).p.probe('claude', { apiKey: k, monthlyCapRupees: '1' })).toBe('ACCESS_DENIED');
    const { p, seen } = probeWith(200); await p.probe('claude', { apiKey: k, monthlyCapRupees: '1' }); expect(seen[0].url).toBe('https://api.anthropic.com/v1/models'); expect(seen[0].url).not.toContain(k);
  });
  it('ResellerClub: with the domain-search switch off no call is made at all', async () => {
    const p = new LiveIntegrationProbe(); let called = 0; p.fetchFn = (async () => { called += 1; return { status: 200, json: async () => ({}) }; }) as unknown as FetchFn;
    p.env = () => ({});
    expect(await p.probe('resellerclub', RC())).toBe('REGISTRAR_OFF'); expect(called).toBe(0);
  });
  it('the registrar failure codes map to distinct states', () => {
    const m = (c: string) => stateOfRegistrarError(new RegistrarError(c, false));
    expect([m('REGISTRAR_KEYS_MISSING'), m('REGISTRAR_NOT_AUTHORISED'), m('REGISTRAR_BAD_KEYS'), m('REGISTRAR_TIMEOUT'), m('REGISTRAR_LIVE_DISABLED'), m('REGISTRAR_UNREACHABLE'), m('REGISTRAR_SERVER_ERROR'), m('REGISTRAR_BAD_ANSWER')])
      .toEqual(['NOT_CONFIGURED', 'ACCESS_DENIED', 'REJECTED', 'TIMEOUT', 'REGISTRAR_OFF', 'UNREACHABLE', 'UNREACHABLE', 'UNKNOWN']);
    expect(stateOfRegistrarError(new Error('x'))).toBe('UNKNOWN');
  });
});

describe('who may touch the integrations: SUPER_ADMIN only, in every method; the codes are registered', () => {
  const ROUTES = ['GET /v3/admin/integrations', 'GET /v3/admin/integrations/:provider', 'PUT /v3/admin/integrations/:provider', 'DELETE /v3/admin/integrations/:provider', 'POST /v3/admin/integrations/:provider/test'];
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
  it('every integration error code is on the exception filter list', () => { for (const c of INTEGRATION_ERROR_CODES) expect(BUSINESS_ERROR_CODES.includes(c)).toBe(true); });
});
