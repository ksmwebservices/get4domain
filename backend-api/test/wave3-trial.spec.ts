import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthService } from '../src/auth/auth.service';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { RegistrationHook } from '../src/plans/registration/registration.hook';
import { TrialSitePort } from '../src/plans/registration/trial-site.port';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { validateSubdomainSlug } from '../src/site-domains/core/hostname';
import { DEFAULT_DOMAIN_SETTINGS, resolveDomainSettings } from '../src/site-domains/settings/domain-settings';
import { DomainSettingsService } from '../src/site-domains/settings/domain-settings.service';
import { MANDATORY_RESERVED_SUBDOMAINS } from '../src/site-domains/settings/reserved-subdomains';
import { nextSteps } from '../src/v3-vendor-gaps/core/gaps-core';
import { NextStepsService } from '../src/v3-packs/next-steps.service';
import { availability, candidateSlug, padToMinimum, slugFromName } from '../src/v3-trial/core/trial-core';
import { ModuleTrialSite } from '../src/v3-trial/module-trial-site';
import { TrialController } from '../src/v3-trial/api/trial.controller';
import { TrialSignupPolicy } from '../src/v3-trial/trial-signup.policy';

/** Wave 3 Part G: self-service trial signup and the team that makes a business live. */
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

const V2_CLIENTS = ['allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels'];
const PLATFORM_HOSTS = ['www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'partner', 'mail', 'send'];

describe('the mandatory reserved subdomains', () => {
  it('are exactly the platform hosts and the nine Version 2 client names', () => {
    expect([...MANDATORY_RESERVED_SUBDOMAINS].sort()).toEqual([...PLATFORM_HOSTS, ...V2_CLIENTS].sort());
  });
  it('stay reserved whatever the stored setting says: an empty list, a short list or garbage', () => {
    for (const stored of [new Map<string, unknown>(), new Map<string, unknown>([['reservedSubdomains', []]]), new Map<string, unknown>([['reservedSubdomains', ['only-this']]]), new Map<string, unknown>([['reservedSubdomains', 'garbage']])]) {
      const s = resolveDomainSettings(stored);
      for (const n of MANDATORY_RESERVED_SUBDOMAINS) expect(s.reservedSubdomains).toContain(n);
    }
    expect(resolveDomainSettings(new Map([['reservedSubdomains', ['extra-name']]])).reservedSubdomains).toContain('extra-name');   // a setting may still ADD names
    expect(resolveDomainSettings(new Map()).reservedSubdomains.length).toBeGreaterThanOrEqual(DEFAULT_DOMAIN_SETTINGS.reservedSubdomains.length);
  });
  it('are refused by the slug rules, including look-alikes (digits for letters, hyphens, capitals)', () => {
    const s = resolveDomainSettings(new Map([['reservedSubdomains', []]]));
    const rules = { min: s.subdomainMinLength, max: s.subdomainMaxLength, reserved: s.reservedSubdomains, blockedWords: [] as string[] };
    for (const n of [...PLATFORM_HOSTS, ...V2_CLIENTS, 'ADMIN', 'adm1n', 'ap1', 'g4pi', 'm4il', 'dir3ctory', 'mr-travels', 'mrtrav3ls', 's2trav3ls', 'all-win-tours', 'stepn-rock', 'ksm-quantum', 'jscomputers-mobiles']) {
      const r = validateSubdomainSlug(n, rules);
      expect([n, r.ok ? 'ok' : r.code]).toEqual([n, n.length < 3 ? expect.anything() : 'RESERVED']);
    }
    expect(validateSubdomainSlug('kumar-garage', rules)).toEqual({ ok: true, slug: 'kumar-garage' });
  });
});

describe('naming (pure)', () => {
  it('makes a clean name from a business name, never empty, never too long', () => {
    expect(slugFromName('Kumar & Sons Garage!')).toBe('kumar-sons-garage');
    expect(slugFromName('  --Hello  World--  ')).toBe('hello-world');
    expect(slugFromName('!!!')).toBe('site'); expect(slugFromName(null)).toBe('site'); expect(slugFromName('é ü')).toBe('site');
    expect(slugFromName('a'.repeat(100), 40)).toHaveLength(40);
  });
  it('numbers a name inside the limit, and lengthens a name that is too short with a neutral word', () => {
    expect(candidateSlug('abc', 1)).toBe('abc'); expect(candidateSlug('abc', 2)).toBe('abc-2'); expect(candidateSlug('a'.repeat(40), 12, 40)).toHaveLength(40); expect(candidateSlug('a'.repeat(40), 12, 40).endsWith('-12')).toBe(true);
    expect(padToMinimum('ab', 3)).toBe('ab-site'); expect(padToMinimum('abc', 3)).toBe('abc');
  });
  it('one answer for a taken name and a blocked one', () => {
    expect(availability('AVAILABLE', 'x')).toMatchObject({ available: true, name: 'x' });
    expect(availability('UNAVAILABLE', null).message).toBe('That address is not available.');
    expect(availability('RESERVED', null).available).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────── a small world: vendors, hosts, settings
function world(initial: { subdomains?: string[]; hosts?: string[]; blocked?: string[] } = {}) {
  const vendors: Array<Record<string, unknown>> = (initial.subdomains ?? []).map((s, i) => ({ id: `old${i}`, email: `old${i}@x.invalid`, subdomain: s, role: 'VENDOR', status: 'ACTIVE' }));
  const hosts = new Set<string>(initial.hosts ?? []);
  const prisma = {
    vendor: { findUnique: async ({ where }: { where: { email?: string; subdomain?: string; id?: string } }) => vendors.find((v) => (where.email && v.email === where.email) || (where.subdomain && v.subdomain === where.subdomain) || (where.id && v.id === where.id)) ?? null },
    v3Domain: { findUnique: async ({ where }: { where: { hostname: string } }) => (hosts.has(where.hostname) ? { id: 'd' } : null) },
    v3PlanSetting: { findMany: async () => (initial.blocked ? [{ key: 'blockedSubdomainWords', valueJson: initial.blocked }] : []), findUnique: async () => null },
    adminTeamMember: { findUnique: async () => null }, teamMember: { findFirst: async () => null }, vendorAddon: { upsert: async () => ({}) },
  };
  const settings = new DomainSettingsService(prisma as never);
  const policy = new TrialSignupPolicy(prisma as never, settings);
  const created: Array<Record<string, unknown>> = [];
  const vendorsService = {
    create: async (dto: Record<string, unknown>) => {
      if (vendors.find((v) => v.email === dto.email)) throw new ConflictException('A vendor with this email already exists');
      const v = { id: `new${vendors.length + 1}`, role: 'VENDOR', status: 'ACTIVE', isSandbox: false, ...dto, password: await bcrypt.hash(String(dto.password), 4) };
      vendors.push(v); created.push(dto); return v;
    },
  };
  const hookCalls: unknown[][] = [];
  const hook = { afterRegister: async (...a: unknown[]) => { hookCalls.push(a); } };
  const jwt = { sign: () => 'token', decode: () => ({ sub: 'x' }) };
  const auth = new AuthService(prisma as never, jwt as never, vendorsService as never, hook as never, undefined, policy);
  return { prisma, vendors, policy, auth, created, hookCalls, hosts };
}
const body = (over: Partial<RegisterDto> = {}): RegisterDto => ({ name: 'Asha', email: 'asha@example.com', password: 'StrongPass1', businessName: 'CareWell Clinic', industry: 'clinic', track: 'professional', ...over } as RegisterDto);

describe('the public availability check', () => {
  it('says what registering would say: free, invalid, reserved, taken', async () => {
    const w = world({ subdomains: ['taken-one'], hosts: ['hosted-two.get4domain.com'] });
    expect(await w.policy.check('carewell')).toMatchObject({ available: true, name: 'carewell', reason: 'AVAILABLE' });
    expect(await w.policy.check('  CareWell ')).toMatchObject({ available: true, name: 'carewell' });
    expect(await w.policy.check('ab')).toMatchObject({ available: false, reason: 'INVALID', name: null, message: 'That name is too short.' });
    expect(await w.policy.check('Bad_Name')).toMatchObject({ reason: 'INVALID' });
    for (const n of ['admin', 'gapi', 'mrtravels', 'partner']) expect(await w.policy.check(n)).toMatchObject({ available: false, reason: 'RESERVED' });
    expect(await w.policy.check('taken-one')).toMatchObject({ available: false, reason: 'UNAVAILABLE' });
    expect(await w.policy.check('hosted-two')).toMatchObject({ available: false, reason: 'UNAVAILABLE' });
    expect(await w.policy.check(undefined)).toMatchObject({ available: false, reason: 'INVALID' });
  });
  it('does not say WHY a name is unavailable: taken and blocked read the same, and no owner is named', async () => {
    const w = world({ subdomains: ['taken-one'], blocked: ['badword'] });
    const taken = await w.policy.check('taken-one'); const blocked = await w.policy.check('my-badword-shop');
    expect(blocked).toEqual({ ...taken });
    expect(JSON.stringify(taken)).not.toMatch(/old0|vendor|owner|badword/i);
  });
  it('the route answers with no-store and passes the name to the policy', async () => {
    const w = world(); const headers: Record<string, string> = {};
    const out = await new TrialController(w.policy).check({ name: 'carewell' }, { set: (k: string, v: string) => { headers[k] = v; } } as never);
    expect(out.available).toBe(true); expect(headers['Cache-Control']).toBe('no-store');
    expect((await new TrialController(w.policy).check({}, { set: () => undefined } as never)).reason).toBe('INVALID');
  });
});

describe('registering with a chosen subdomain', () => {
  it('uses the name the business chose, and hands the business details to the registration hook', async () => {
    const w = world();
    const r = await w.auth.register(body({ subdomain: 'carewell' }));
    expect(w.created[0]).toMatchObject({ subdomain: 'carewell', businessName: 'CareWell Clinic' });
    expect(r.user.subdomain).toBe('carewell');
    expect(w.hookCalls[0]).toEqual(['new1', 'professional', { industry: 'clinic', businessName: 'CareWell Clinic', phone: null }]);
  });
  it('refuses every reserved name and every look-alike with SUBDOMAIN_RESERVED, and creates nothing', async () => {
    const w = world();
    for (const n of [...PLATFORM_HOSTS, ...V2_CLIENTS, 'adm1n', 'Admin', 'mr-travels', 'g4pi']) expect([n, code(await err(w.auth.register(body({ subdomain: n }))))]).toEqual([n, 'SUBDOMAIN_RESERVED']);
    expect(w.created).toEqual([]);
  });
  it('refuses a bad name with SUBDOMAIN_INVALID and a taken one with HOST_UNAVAILABLE', async () => {
    const w = world({ subdomains: ['taken-one'], hosts: ['hosted-two.get4domain.com'] });
    for (const n of ['ab', 'a_b_c', '-abc', 'a--b']) expect([n, code(await err(w.auth.register(body({ subdomain: n }))))]).toEqual([n, 'SUBDOMAIN_INVALID']);
    for (const n of ['taken-one', 'hosted-two']) expect([n, code(await err(w.auth.register(body({ subdomain: n }))))]).toEqual([n, 'HOST_UNAVAILABLE']);
    expect(w.created).toEqual([]);
  });
  it('a blocked word reads as unavailable, not as blocked', async () => {
    const w = world({ blocked: ['badword'] });
    expect(code(await err(w.auth.register(body({ subdomain: 'my-badword-shop' }))))).toBe('HOST_UNAVAILABLE');
  });
});

describe('registering with no chosen subdomain', () => {
  it('makes one from the business name and numbers it until it is allowed and free', async () => {
    const w = world({ subdomains: ['carewell-clinic'] });
    expect((await w.auth.register(body())).user.subdomain).toBe('carewell-clinic-2');
    expect((await w.auth.register(body({ email: 'b@example.com', businessName: 'CareWell Clinic' }))).user.subdomain).toBe('carewell-clinic-3');
  });
  it('never gives a reserved name: a business called Admin, Gapi or MR Travels gets a numbered one', async () => {
    const w = world();
    expect((await w.auth.register(body({ email: 'a@example.com', businessName: 'Admin' }))).user.subdomain).toBe('admin-2');
    expect((await w.auth.register(body({ email: 'g@example.com', businessName: 'Gapi' }))).user.subdomain).toBe('gapi-2');
    expect((await w.auth.register(body({ email: 'm@example.com', businessName: 'MR Travels' }))).user.subdomain).toBe('mr-travels-2');
    expect((await w.auth.register(body({ email: 'x@example.com', businessName: 'Ab' }))).user.subdomain).toBe('ab-site');   // too short: lengthened with a neutral word
  });
});

describe('registering twice is safe (idempotent)', () => {
  it('the same account again signs in to the account that exists and makes nothing new', async () => {
    const w = world();
    const first = await w.auth.register(body({ subdomain: 'carewell' }));
    const again = await w.auth.register(body({ subdomain: 'carewell' }));
    expect(again.user.id).toBe(first.user.id); expect(w.vendors).toHaveLength(1); expect(w.created).toHaveLength(1); expect(w.hookCalls).toHaveLength(1);
  });
  it('a wrong password, or another business name, is still the usual refusal of a taken email', async () => {
    const w = world();
    await w.auth.register(body({ subdomain: 'carewell' }));
    expect((await err(w.auth.register(body({ password: 'OtherPass1', subdomain: 'carewell-2' })))) instanceof ConflictException).toBe(true);
    expect((await err(w.auth.register(body({ businessName: 'Someone Else', subdomain: 'someone-else' })))) instanceof ConflictException).toBe(true);
    expect(w.vendors).toHaveLength(1);
  });
  it('a replay never signs in staff: the bootstrap admin row is not a self-service vendor', async () => {
    const w = world(); const hashed = await bcrypt.hash('StrongPass1', 4);
    w.vendors.push({ id: 'adm', email: 'asha@example.com', businessName: 'CareWell Clinic', role: 'ADMIN', password: hashed, status: 'ACTIVE' });
    expect((await err(w.auth.register(body()))) instanceof ConflictException).toBe(true);
  });
});

describe('the registration form fields', () => {
  it('subdomain is optional and at most 63 characters; nothing else about the DTO changed', async () => {
    const ok = await validate(plainToInstance(RegisterDto, { ...body(), subdomain: 'carewell' })); expect(ok).toHaveLength(0);
    expect(await validate(plainToInstance(RegisterDto, body()))).toHaveLength(0);
    expect((await validate(plainToInstance(RegisterDto, { ...body(), subdomain: 'x'.repeat(64) }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(RegisterDto, { ...body(), subdomain: 12 }))).length).toBeGreaterThan(0);
  });
});

describe('the Free trial site after registration', () => {
  const make = (over: { setting?: unknown; plan?: () => Promise<unknown>; site?: () => Promise<unknown> | undefined } = {}) => {
    const calls: string[] = [];
    const prisma = { v3PlanSetting: { findUnique: async () => (over.setting === undefined ? { valueJson: true } : over.setting === null ? null : { valueJson: over.setting }) } };
    const subs = { provisionFreeSubscription: async () => { calls.push('plan'); await over.plan?.(); } };
    const site: TrialSitePort = { createLiveTrialSite: async (i) => { calls.push(`site:${i.category}:${i.businessName}`); await over.site?.(); return { siteId: 's1', published: true }; } };
    return { hook: new RegistrationHook(prisma as never, subs as never, site), calls };
  };
  const info = { industry: 'clinic', businessName: 'CareWell Clinic', phone: '+919876543210' };
  it('gives the Free plan and then the live trial site, in the one switch', async () => {
    const m = make(); await m.hook.afterRegister('v1', 'professional', info);
    expect(m.calls).toEqual(['plan', 'site:clinic:CareWell Clinic']);
  });
  it('does nothing while the switch (registrationProvisioning) is off, or with no track, or with no details', async () => {
    for (const setting of [false, null, 'yes']) { const m = make({ setting }); await m.hook.afterRegister('v1', 'professional', info); expect(m.calls).toEqual([]); }
    const m = make(); await m.hook.afterRegister('v1', undefined, info); await m.hook.afterRegister('v1', 'nonsense', info); expect(m.calls).toEqual([]);
    await m.hook.afterRegister('v1', 'handyman'); expect(m.calls).toEqual(['plan']);   // an older caller with no details: the plan only
  });
  it('a failing site never fails the signup and never undoes the plan; a failing plan never blocks it either', async () => {
    const a = make({ site: () => { throw new Error('connection string postgres://secret'); } });
    await expect(a.hook.afterRegister('v1', 'professional', info)).resolves.toBeUndefined(); expect(a.calls).toEqual(['plan', 'site:clinic:CareWell Clinic']);
    const b = make({ plan: () => { throw new Error('db down'); } });
    await expect(b.hook.afterRegister('v1', 'professional', info)).resolves.toBeUndefined(); expect(b.calls).toEqual(['plan']);
  });
  it('without the trial module there is no site and no error (an older build registers as before)', async () => {
    const hook = new RegistrationHook({ v3PlanSetting: { findUnique: async () => ({ valueJson: true }) } } as never, { provisionFreeSubscription: async () => undefined } as never);
    await expect(hook.afterRegister('v1', 'professional', info)).resolves.toBeUndefined();
  });
});

describe('ModuleTrialSite', () => {
  function modules(published = false) {
    const calls: string[] = [];
    const provisioner = { createDraftSite: async (i: Record<string, unknown>) => { calls.push(`draft:${i.category}:${i.language}:${i.track}`); return { siteId: 'site-1' }; } };
    const build = { build: async (v: string, o: { actor: { type: string; id: string } }) => { calls.push(`build:${v}:${o.actor.type}`); return { publication: { id: 'pub-1', status: published ? 'PUBLISHED' : 'DRAFT' } }; } };
    const publish = { publish: async (v: string, id: string) => { calls.push(`publish:${v}:${id}`); } };
    const ref = { get: (token: unknown) => (token === SiteProvisioner ? provisioner : token === SiteBuildService ? build : token === PublishService ? publish : (() => { throw new Error('unknown token'); })()) };
    return { site: new ModuleTrialSite(ref as never), calls };
  }
  const input = { vendorId: 'v1', track: 'professional', category: 'clinic', businessName: 'CareWell Clinic', phone: '+919876543210', city: 'Chennai' };
  it('builds the draft from the industry and the details, then builds and publishes it as the registering vendor', async () => {
    const m = modules(); const r = await m.site.createLiveTrialSite(input);
    expect(r).toEqual({ siteId: 'site-1', published: true });
    expect(m.calls).toEqual(['draft:clinic:en:professional', 'build:v1:VENDOR', 'publish:v1:pub-1']);
  });
  it('does not publish a site that is already published', async () => {
    const m = modules(true); await m.site.createLiveTrialSite(input);
    expect(m.calls).toEqual(['draft:clinic:en:professional', 'build:v1:VENDOR']);
  });
  it('raises a failure to its caller, which swallows it (see the hook)', async () => {
    const site = new ModuleTrialSite({ get: () => { throw new Error('no such provider'); } } as never);
    await expect(site.createLiveTrialSite(input)).rejects.toThrow('no such provider');
  });
});

describe('the next step that moves a Free site to a paid plan', () => {
  const base = { sitePublished: true, draftStarted: true, missingDetails: [] as string[], unpaidPlanOrder: false, unconnectedDomain: null as string | null };
  it('appears for a business on a Free plan, last, with no price, number or date in it', () => {
    const steps = nextSteps({ ...base, onFreePlan: true, missingDetails: ['phone'] });
    expect(steps.map((s) => s.id)).toEqual(['site_details', 'move_to_paid_plan']);
    const t = steps.find((s) => s.id === 'move_to_paid_plan')!;
    expect(t).toMatchObject({ route: '/plan', area: 'OWNER' });
    expect(t.text).not.toMatch(/\d|₹|rs\b|price|discount|offer|month|year|day|workspace|\bbos\b|leadspace|leads\b/i);
  });
  it('does not appear for a paid business, for one with no plan facts, or while a payment is already waiting', () => {
    expect(nextSteps({ ...base, onFreePlan: false }).map((s) => s.id)).toEqual([]);
    expect(nextSteps(base).map((s) => s.id)).toEqual([]);
    expect(nextSteps({ ...base, onFreePlan: true, unpaidPlanOrder: true }).map((s) => s.id)).toEqual(['plan_payment']);
  });
  it('keeps the limit of five steps and keeps the existing steps in their order', () => {
    const all = nextSteps({ sitePublished: false, draftStarted: true, missingDetails: ['a', 'b'], unpaidPlanOrder: false, unconnectedDomain: 'x.example.com', onFreePlan: true });
    expect(all.map((s) => s.id)).toEqual(['publish_site', 'site_details', 'connect_domain', 'move_to_paid_plan']);
  });
  it('the owner sees it and a team member does not (money is the owner\'s)', async () => {
    const svc = new NextStepsService({ facts: async () => ({ ...base, onFreePlan: true }) } as never);
    expect((await svc.forCaller('v1', {})).map((s) => s.id)).toEqual(['move_to_paid_plan']);
    expect(await svc.forCaller('v1', { kind: 'team_member', modules: ['website', 'accounts', 'wallet'] })).toEqual([]);
  });
});

describe('who makes a business live', () => {
  const GO_LIVE = 'POST /v3/admin/seeded-sites/:id/go-live'; const CREATE = 'POST /v3/admin/seeded-sites';
  const principal = (role?: string) => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(role) });
  const may = (u: unknown, key: string): boolean => { const [method, ...r] = key.split(' '); try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; } };
  it('SALES, and so FIELD_EXECUTIVE and TELECALLER, create a business and put it live, like OPERATIONS, ADMIN and SUPER_ADMIN', () => {
    for (const role of ['MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN']) for (const k of [CREATE, GO_LIVE]) expect([role, k, may(principal(role), k)]).toEqual([role, k, true]);
    expect([...effectiveRolesFor(GO_LIVE)].sort()).toEqual(['ADMIN', 'MARKETING', 'OPERATIONS', 'SUPER_ADMIN']);
  });
  it('SUPPORT, a partner, a vendor and an anonymous caller cannot', () => {
    for (const u of [principal('SUPPORT'), { sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, { sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, undefined]) for (const k of [CREATE, GO_LIVE]) expect(may(u, k)).toBe(false);
  });
  it('a label holds exactly the SALES answer on both routes (no extra right)', () => {
    for (const label of ['FIELD_EXECUTIVE', 'TELECALLER']) for (const k of [CREATE, GO_LIVE, 'POST /v3/admin/billing/orders/:id/mark-paid', 'PUT /v3/admin/payment-gateway']) expect(may(principal(label), k)).toBe(may(principal('MARKETING'), k));
  });
});
