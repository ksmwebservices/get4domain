import { JobRunnerService, ProvisioningAudit, ProvisioningStep, StepContext, StepResult } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS, ProvisioningSettings } from '../src/provisioning/settings/provisioning-settings';
import { cancelPlan, decide, effectiveOrder, StepKey, STEP_ORDER } from '../src/provisioning/core/state-machine';
import { MemoryProvisioningRepo } from './support/memory-provisioning-repo';

/** B2 slice 5.7: the OPTIONAL step CREATE_DIRECTORY_PROFILE. With the setting off the five slice 5.3 steps behave exactly as before. */
const T0 = new Date('2026-11-05T10:00:00Z');
const st = (done: StepKey[], extra: Partial<Record<StepKey, string>> = {}) => [...STEP_ORDER, 'CREATE_DIRECTORY_PROFILE' as StepKey].map((stepKey) => ({ stepKey, status: (extra[stepKey] ?? (done.includes(stepKey) ? 'DONE' : 'PENDING')) as 'DONE' | 'PENDING' | 'FAILED' | 'SKIPPED' }));

describe('state machine with the optional step', () => {
  it('the five-step order is unchanged, and the effective order inserts the optional step right after the site draft only when enabled', () => {
    expect(STEP_ORDER).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect(effectiveOrder(false)).toEqual([...STEP_ORDER]);
    expect(effectiveOrder(true)).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
  });
  it('off (or not stated): the optional step is never chosen, even if a row for it exists', () => {
    const steps = st(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT']);
    expect(decide(steps, { hasRawToken: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' });
    expect(decide(steps, { hasRawToken: false, directoryProfile: false })).toEqual({ action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' });
  });
  it('on: it runs after the site draft and before the claim link; a FAILED one runs again; DONE or SKIPPED is passed over', () => {
    const base = ['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT'] as StepKey[];
    expect(decide(st(base), { hasRawToken: false, directoryProfile: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_DIRECTORY_PROFILE' });
    expect(decide(st(base, { CREATE_DIRECTORY_PROFILE: 'FAILED' }), { hasRawToken: false, directoryProfile: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_DIRECTORY_PROFILE' });
    for (const s of ['DONE', 'SKIPPED']) expect(decide(st(base, { CREATE_DIRECTORY_PROFILE: s }), { hasRawToken: false, directoryProfile: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_CLAIM_LINK' });
  });
  it('a job with no row for the optional step (created before it existed) simply runs it when it is enabled', () => {
    const steps = STEP_ORDER.map((stepKey) => ({ stepKey, status: (['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT'].includes(stepKey) ? 'DONE' : 'PENDING') as 'DONE' | 'PENDING' }));
    expect(decide(steps, { hasRawToken: false, directoryProfile: true })).toEqual({ action: 'RUN_STEP', step: 'CREATE_DIRECTORY_PROFILE' });
  });
  it('cancel skips the optional step only when it has a row that is not done', () => {
    expect(cancelPlan(STEP_ORDER.map((stepKey) => ({ stepKey, status: 'PENDING' as const })))).toEqual([...STEP_ORDER]);
    expect(cancelPlan(st(['CREATE_VENDOR']))).toContain('CREATE_DIRECTORY_PROFILE');
    expect(cancelPlan(st(['CREATE_VENDOR', 'CREATE_DIRECTORY_PROFILE']))).not.toContain('CREATE_DIRECTORY_PROFILE');
  });
});

describe('runner with the optional step', () => {
  function run(settings: Partial<ProvisioningSettings>, withStep = true) {
    const repo = new MemoryProvisioningRepo(); const calls: StepKey[] = [];
    const mk = (key: StepKey): ProvisioningStep => ({ key, async run(): Promise<StepResult> { calls.push(key); if (key === 'CREATE_VENDOR') return { vendorId: 'v1', outputRef: { vendorId: 'v1' } }; if (key === 'CREATE_CLAIM_LINK') return { rawToken: 't', outputRef: { id: 'x' } }; return { outputRef: { done: key } }; } });
    const audit: ProvisioningAudit = { record: async () => undefined };
    const r = new JobRunnerService(repo, STEP_ORDER.map(mk), { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS, ...settings }) } as never, audit, 'runner-A', withStep ? [mk('CREATE_DIRECTORY_PROFILE')] : []);
    r.clock = () => T0; repo.clock = () => T0; r.random = () => 0.5;
    return { repo, calls, r };
  }
  it('setting OFF: exactly the five steps run, in the 5.3 order, and the optional step is not called', async () => {
    const { repo, calls, r } = run({ provisioningDirectoryProfileEnabled: false });
    await repo.createJob({ idempotencyKey: 'k', input: {}, maxAttempts: 5, createdByType: 'STAFF', createdById: 's' });
    const rep = await r.runOne();
    expect(rep!.status).toBe('SUCCEEDED'); expect(calls).toEqual([...STEP_ORDER]); expect(rep!.stepsRun).toEqual([...STEP_ORDER]);
  });
  it('setting ON: six steps, the optional one between the site draft and the claim link, and the job still SUCCEEDS', async () => {
    const { repo, calls, r } = run({ provisioningDirectoryProfileEnabled: true });
    const { job } = await repo.createJob({ idempotencyKey: 'k', input: {}, maxAttempts: 5, createdByType: 'STAFF', createdById: 's' });
    const rep = await r.runOne();
    expect(rep!.status).toBe('SUCCEEDED'); expect(calls).toEqual(['CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_DIRECTORY_PROFILE', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect((await repo.listSteps(job.id)).find((s) => s.stepKey === 'CREATE_DIRECTORY_PROFILE')).toMatchObject({ status: 'DONE', attempts: 1 });
  });
  it('setting ON but no implementation registered is a wiring bug and says so', async () => {
    const { repo, r } = run({ provisioningDirectoryProfileEnabled: true }, false);
    await repo.createJob({ idempotencyKey: 'k', input: {}, maxAttempts: 5, createdByType: 'STAFF', createdById: 's' });
    await expect(r.runOne()).rejects.toThrow(/CREATE_DIRECTORY_PROFILE/);
  });
});
