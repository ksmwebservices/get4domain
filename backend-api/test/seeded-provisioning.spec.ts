import { decide, effectiveOrder, STEP_ORDER, StepKey } from '../src/provisioning/core/state-machine';
import { JobRunnerService, ProvisioningAudit, ProvisioningStep, StepContext, StepResult } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS } from '../src/provisioning/settings/provisioning-settings';
import { parseBusinessInput } from '../src/provisioning/steps/business-input';
import { PrismaSiteLifecycle } from '../src/seeded-sites/prisma-site-lifecycle';
import { MemoryProvisioningRepo } from './support/memory-provisioning-repo';

/** Slice 5.13a: the SEEDED mode of the slice 5.3 runner. The five-step flow is unchanged (the existing provisioning suites pass untouched); a SEEDED job has no owner, so no claim link and no invite. */
const T0 = new Date('2026-11-04T10:00:00Z');
const seededInput = { mode: 'SEEDED', businessName: 'Acme Plumbing', track: 'handyman', category: 'plumber', city: 'Chennai', language: 'en', phone: '98765 43210', placeholderEmail: 'site+seed-abc@sites.get4domain.invalid', area: 'Adyar', addressLine: '12 Main Road', description: 'Plumbers' };

describe('the pure order', () => {
  it('a normal job still has exactly the five steps, and the optional directory step only when enabled (unchanged)', () => {
    expect(effectiveOrder(false)).toEqual(STEP_ORDER); expect(effectiveOrder(true)).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
  });
  it('a SEEDED job has four steps: vendor, free plan, site draft, directory profile (always); no claim link, no invite', () => {
    expect(effectiveOrder(false, true)).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE']);
    const done = (keys: StepKey[]) => effectiveOrder(false, true).map((k) => ({ stepKey: k, status: keys.includes(k) ? ('DONE' as const) : ('PENDING' as const) }));
    expect(decide(done([]), { hasRawToken: false, seeded: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_VENDOR' });
    expect(decide(done(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT']), { hasRawToken: false, seeded: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_DIRECTORY_PROFILE' });
    expect(decide(done(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE']), { hasRawToken: false, seeded: true })).toEqual({ action: 'COMPLETE' });
  });
});

describe('parseBusinessInput in SEEDED mode', () => {
  it('needs no owner name and no public email: the placeholder login is used; the facts are carried', () => {
    expect(parseBusinessInput(seededInput)).toMatchObject({ seeded: true, ownerName: 'Business owner', email: 'site+seed-abc@sites.get4domain.invalid', phone: '+919876543210', area: 'Adyar', addressLine: '12 Main Road', description: 'Plumbers' });
  });
  it('a public email in the input is never used as the login; a missing placeholder or a bad phone is refused', () => {
    expect(parseBusinessInput({ ...seededInput, email: 'public@example.in' }).email).toBe('site+seed-abc@sites.get4domain.invalid');
    expect(() => parseBusinessInput({ ...seededInput, placeholderEmail: undefined })).toThrow(); expect(() => parseBusinessInput({ ...seededInput, phone: '123' })).toThrow();
  });
  it('a normal job still requires owner name and email, exactly as before', () => {
    const normal = { businessName: 'Acme', track: 'handyman', category: 'plumber', ownerName: 'Meena', phone: '9876543210', email: 'm@example.in', city: 'Chennai', language: 'en' };
    expect(parseBusinessInput(normal)).toMatchObject({ ownerName: 'Meena', email: 'm@example.in' }); expect(parseBusinessInput(normal).seeded).toBeUndefined();
    expect(() => parseBusinessInput({ ...normal, ownerName: undefined })).toThrow(); expect(() => parseBusinessInput({ ...normal, email: undefined })).toThrow();
    expect(() => parseBusinessInput({ ...normal, placeholderEmail: 'x@sites.get4domain.invalid', email: undefined })).toThrow();   // the placeholder only counts in SEEDED mode
  });
});

describe('the real runner on a SEEDED job', () => {
  it('runs vendor, plan, site draft and directory profile in order, never the claim link or the invite, and ends SUCCEEDED', async () => {
    const repo = new MemoryProvisioningRepo(); repo.clock = () => T0;
    const ran: StepKey[] = [];
    const mk = (key: StepKey): ProvisioningStep => ({ key, run: async (ctx: StepContext): Promise<StepResult> => { ran.push(key); return key === 'CREATE_VENDOR' ? { vendorId: 'v1', outputRef: { vendorId: 'v1' } } : { outputRef: { ok: key } }; } });
    const audit: ProvisioningAudit = { record: async () => undefined };
    const runner = new JobRunnerService(repo, STEP_ORDER.map(mk), { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS }) } as never, audit, 'r1', [mk('CREATE_DIRECTORY_PROFILE')]);
    runner.clock = () => T0;
    const { job } = await repo.createJob({ idempotencyKey: 'seeded:abc', input: seededInput, maxAttempts: 3, createdByType: 'STAFF', createdById: 's1' });
    const report = await runner.runOne({ jobId: job.id });
    expect(report).toMatchObject({ status: 'SUCCEEDED' }); expect(ran).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE']);
    expect((await repo.getJob(job.id))!.vendorId).toBe('v1');
  });
  it('the same idempotency key is the same job (a retry of a batch row never makes a second vendor)', async () => {
    const repo = new MemoryProvisioningRepo();
    const a = await repo.createJob({ idempotencyKey: 'seeded:abc', input: seededInput, maxAttempts: 3, createdByType: 'STAFF', createdById: 's1' });
    const b = await repo.createJob({ idempotencyKey: 'seeded:abc', input: seededInput, maxAttempts: 3, createdByType: 'STAFF', createdById: 's1' });
    expect(b.created).toBe(false); expect(b.job.id).toBe(a.job.id);
  });
});

describe('PrismaSiteLifecycle (the port the site build reads)', () => {
  const fake = (row: unknown, sub: unknown, onRegister = 0) => ({
    v3SeededSite: { findUnique: async () => row }, v3PlanSubscription: { findFirst: async () => sub }, v3DncRegister: { count: async () => onRegister },
  });
  const base = { lifecycle: 'SEEDED', sourceKind: 'FIELD_VISIT', publicFactsConfirmed: true, phoneHash: 'h', business: { status: 'UNCLAIMED', name: 'Acme', categoryId: 'c1', phoneE164: '+919876543210', addressJson: { city: 'Chennai', line2: 'Adyar' } } };
  it('never seeded = null; seeded = its derived state; a claimed profile follows the running paid plan; a removal wins', async () => {
    expect(await new PrismaSiteLifecycle(fake(null, null) as never).lifecycleOf('v')).toBeNull();
    expect(await new PrismaSiteLifecycle(fake(base, null) as never).lifecycleOf('v')).toBe('SEEDED');
    expect(await new PrismaSiteLifecycle(fake({ ...base, lifecycle: 'INVITED' }, null) as never).lifecycleOf('v')).toBe('INVITED');
    const claimed = { ...base, business: { ...base.business, status: 'CLAIMED' } };
    expect(await new PrismaSiteLifecycle(fake(claimed, null) as never).lifecycleOf('v')).toBe('CLAIMED_FREE');
    expect(await new PrismaSiteLifecycle(fake(claimed, { endsAt: new Date(Date.now() + 86_400_000) }) as never).lifecycleOf('v')).toBe('PRO');
    expect(await new PrismaSiteLifecycle(fake(claimed, { endsAt: new Date(Date.now() - 86_400_000) }) as never).lifecycleOf('v')).toBe('CLAIMED_FREE');
    expect(await new PrismaSiteLifecycle(fake({ ...claimed, lifecycle: 'REMOVED' }, null) as never).lifecycleOf('v')).toBe('REMOVED');
  });
  it('quality: complete facts pass; a missing area, a business on the register, a removed site or an unrecorded source fail', async () => {
    expect(await new PrismaSiteLifecycle(fake(base, null) as never).qualityOk('v')).toBe(true);
    expect(await new PrismaSiteLifecycle(fake({ ...base, business: { ...base.business, addressJson: { city: 'Chennai' } } }, null) as never).qualityOk('v')).toBe(false);
    expect(await new PrismaSiteLifecycle(fake(base, null, 1) as never).qualityOk('v')).toBe(false);
    expect(await new PrismaSiteLifecycle(fake({ ...base, lifecycle: 'REMOVED' }, null) as never).qualityOk('v')).toBe(false);
    expect(await new PrismaSiteLifecycle(fake({ ...base, publicFactsConfirmed: false }, null) as never).qualityOk('v')).toBe(false);
    expect(await new PrismaSiteLifecycle(fake(null, null) as never).qualityOk('v')).toBe(false);
  });
});
