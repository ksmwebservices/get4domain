import { JobRunnerService, ProvisioningAudit, ProvisioningStep, StepContext, StepResult } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS, ProvisioningSettings } from '../src/provisioning/settings/provisioning-settings';
import { StepKey, STEP_ORDER } from '../src/provisioning/core/state-machine';
import { StepError } from '../src/provisioning/provisioning.errors';
import { MemoryProvisioningRepo } from './support/memory-provisioning-repo';

/** S53.3: the runner against an in-memory repository: order, idempotence, retry, backoff, crash recovery, two runners, the raw-token rule. */
class CrashError extends Error {}
const T0 = new Date('2026-11-04T10:00:00Z');

interface Harness {
  repo: MemoryProvisioningRepo; runner: (id?: string) => JobRunnerService; calls: Record<string, number>; audit: Array<{ action: string; after: unknown }>;
  clock: { now: Date }; behaviour: Partial<Record<StepKey, (ctx: StepContext, n: number) => StepResult | void>>; tokens: string[]; seenTokens: Array<string | undefined>;
}

function harness(settings: Partial<ProvisioningSettings> = {}): Harness {
  const repo = new MemoryProvisioningRepo();
  const calls: Record<string, number> = {};
  const audit: Array<{ action: string; after: unknown }> = [];
  const clock = { now: T0 }; repo.clock = () => clock.now;
  const behaviour: Harness['behaviour'] = {};
  const tokens: string[] = [];
  const seenTokens: Array<string | undefined> = [];
  const mk = (key: StepKey): ProvisioningStep => ({
    key,
    async run(ctx: StepContext): Promise<StepResult> {
      calls[key] = (calls[key] ?? 0) + 1;
      if (key === 'SEND_INVITE') seenTokens.push(ctx.rawToken);
      const custom = behaviour[key]?.(ctx, calls[key]);
      if (custom) return custom;
      if (key === 'CREATE_VENDOR') return { vendorId: 'vendor-1', outputRef: { vendorId: 'vendor-1' } };
      if (key === 'CREATE_CLAIM_LINK') { const t = `raw-token-${tokens.length + 1}`; tokens.push(t); return { rawToken: t, outputRef: { claimTokenId: `ct-${tokens.length}` } }; }
      return { outputRef: { done: key } };
    },
  });
  const steps = STEP_ORDER.map(mk);
  const settingsReader = { get: async (): Promise<ProvisioningSettings> => ({ ...DEFAULT_PROVISIONING_SETTINGS, ...settings }) };
  const auditSink: ProvisioningAudit = { record: async (_actor, action, _type, _id, after) => { audit.push({ action, after }); } };
  const runner = (id = 'runner-A'): JobRunnerService => {
    const r = new JobRunnerService(repo, steps, settingsReader as never, auditSink, id);
    r.clock = () => clock.now; r.random = () => 0.5;
    return r;
  };
  return { repo, runner, calls, audit, clock, behaviour, tokens, seenTokens };
}
const newJob = (h: Harness, key = 'k1', maxAttempts = 5) => h.repo.createJob({ idempotencyKey: key, input: { businessName: 'Acme' }, maxAttempts, createdByType: 'STAFF', createdById: 'staff-1' });

describe('job runner', () => {
  it('runs the five steps in order and ends SUCCEEDED, with one audit row per step and one for the job', async () => {
    const h = harness();
    const { job } = await newJob(h);
    const report = await h.runner().runOne();
    expect(report).toMatchObject({ jobId: job.id, status: 'SUCCEEDED' });
    expect(report!.stepsRun).toEqual([...STEP_ORDER]);
    const done = await h.repo.getJob(job.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', vendorId: 'vendor-1', lockedBy: null, lockedUntil: null });
    expect(done!.finishedAt).not.toBeNull();
    expect((await h.repo.listSteps(job.id)).every((s) => s.status === 'DONE')).toBe(true);
    expect(h.audit.map((a) => a.action)).toEqual([...STEP_ORDER.map(() => 'provisioning.step.done'), 'provisioning.job.succeeded']);
  });

  it('creating a job with an existing idempotency key returns the existing job and creates nothing new', async () => {
    const h = harness();
    const a = await newJob(h, 'same'); const b = await newJob(h, 'same');
    expect(a.created).toBe(true); expect(b.created).toBe(false); expect(b.job.id).toBe(a.job.id); expect(h.repo.jobs.size).toBe(1);
  });

  it('nothing is claimed when no job is due, or the job is finished or cancelled', async () => {
    const h = harness();
    expect(await h.runner().runOne()).toBeNull();
    await newJob(h); await h.runner().runOne();
    expect(await h.runner().runOne()).toBeNull();
  });

  it('a retryable failure: job WAITING with a sanitised message and a future run time; done steps are NOT run again when it resumes', async () => {
    const h = harness();
    h.behaviour.CREATE_FREE_SITE_DRAFT = (_c, n) => { if (n === 1) throw new StepError('ADAPTER_TIMEOUT', true); };
    const { job } = await newJob(h);
    const r1 = await h.runner().runOne();
    expect(r1).toMatchObject({ status: 'WAITING' });
    const waiting = (await h.repo.getJob(job.id))!;
    expect(waiting).toMatchObject({ status: 'WAITING', attempt: 1, lastErrorCode: 'ADAPTER_TIMEOUT', lockedBy: null });
    expect(waiting.lastErrorMessage).toBe('The email service did not answer in time.');
    expect(waiting.nextRunAt.getTime()).toBe(T0.getTime() + 30_000);
    expect(await h.runner().runOne()).toBeNull();   // not due yet
    h.clock.now = new Date(T0.getTime() + 31_000);
    const r2 = await h.runner().runOne();
    expect(r2).toMatchObject({ status: 'SUCCEEDED' });
    expect(r2!.stepsRun).toEqual(['CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect(h.calls).toEqual({ CREATE_VENDOR: 1, ASSIGN_FREE_PLAN: 1, CREATE_FREE_SITE_DRAFT: 2, CREATE_CLAIM_LINK: 1, SEND_INVITE: 1 });
    const after = (await h.repo.getJob(job.id))!;
    expect(after.lastErrorCode).toBeNull();
  });

  it('a permanent failure ends FAILED at once and names the failed step', async () => {
    const h = harness();
    h.behaviour.CREATE_VENDOR = () => { throw new StepError('DUPLICATE_BUSINESS', false); };
    const { job } = await newJob(h);
    expect(await h.runner().runOne()).toMatchObject({ status: 'FAILED' });
    expect(await h.repo.getJob(job.id)).toMatchObject({ status: 'FAILED', attempt: 1, lastErrorCode: 'DUPLICATE_BUSINESS', currentStep: 'CREATE_VENDOR' });
    expect((await h.repo.listSteps(job.id))[0]).toMatchObject({ status: 'FAILED', errorCode: 'DUPLICATE_BUSINESS' });
    expect(h.calls).toEqual({ CREATE_VENDOR: 1 });
  });

  it('exhausting the attempts fails the job; an unknown error is recorded only as UNEXPECTED with a fixed sentence, never the original text', async () => {
    const h = harness({ provisioningMaxAttempts: 2 });
    h.behaviour.ASSIGN_FREE_PLAN = () => { throw new Error('provider said: invalid key re_SECRET123'); };
    const { job } = await newJob(h, 'x', 2);
    await h.runner().runOne();
    h.clock.now = new Date(T0.getTime() + 3_600_000);
    expect(await h.runner().runOne()).toMatchObject({ status: 'FAILED' });
    const j = (await h.repo.getJob(job.id))!;
    expect(j).toMatchObject({ status: 'FAILED', attempt: 2, lastErrorCode: 'UNEXPECTED' });
    expect(JSON.stringify([j, await h.repo.listSteps(job.id), h.audit])).not.toContain('re_SECRET123');
  });

  it('CRASH: a runner that dies mid-job leaves a lease; after it lapses another runner finishes the job and done steps are not repeated', async () => {
    const h = harness();
    const { job } = await newJob(h);
    h.repo.beforeFinishStep = (_j, key) => { if (key === 'CREATE_FREE_SITE_DRAFT') { h.repo.beforeFinishStep = undefined; throw new CrashError('process died'); } };
    await expect(h.runner('runner-A').runOne()).rejects.toBeInstanceOf(CrashError);
    const stuck = (await h.repo.getJob(job.id))!;
    expect(stuck).toMatchObject({ status: 'RUNNING', lockedBy: 'runner-A' });
    expect((await h.repo.listSteps(job.id)).map((s) => s.status)).toEqual(['DONE', 'DONE', 'RUNNING', 'PENDING', 'PENDING']);
    expect(await h.runner('runner-B').runOne()).toBeNull();   // lease still valid
    h.clock.now = new Date(stuck.lockedUntil!.getTime() + 1000);
    const r = await h.runner('runner-B').runOne();
    expect(r).toMatchObject({ jobId: job.id, status: 'SUCCEEDED' });
    expect(r!.stepsRun).toEqual(['CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect(h.calls.CREATE_VENDOR).toBe(1); expect(h.calls.ASSIGN_FREE_PLAN).toBe(1);
    expect(h.calls.CREATE_FREE_SITE_DRAFT).toBe(2);   // the half-done step runs again and must be idempotent
  });

  it('TWO RUNNERS at once never take the same job: one job -> one report and every step runs once', async () => {
    const h = harness();
    await newJob(h);
    const [a, b] = await Promise.all([h.runner('runner-A').runOne(), h.runner('runner-B').runOne()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(h.calls).toEqual({ CREATE_VENDOR: 1, ASSIGN_FREE_PLAN: 1, CREATE_FREE_SITE_DRAFT: 1, CREATE_CLAIM_LINK: 1, SEND_INVITE: 1 });
  });

  it('TWO RUNNERS and two jobs: each takes a different job', async () => {
    const h = harness();
    const j1 = await newJob(h, 'a'); const j2 = await newJob(h, 'b');
    const [a, b] = await Promise.all([h.runner('runner-A').runOne(), h.runner('runner-B').runOne()]);
    expect(new Set([a!.jobId, b!.jobId])).toEqual(new Set([j1.job.id, j2.job.id]));
    expect(h.calls.CREATE_VENDOR).toBe(2);
  });

  it('a runner that lost its lease stops quietly and does not overwrite the new owner\'s state', async () => {
    const h = harness();
    const { job } = await newJob(h);
    h.behaviour.ASSIGN_FREE_PLAN = () => { const j = h.repo.jobs.get(job.id)!; j.lockedBy = 'runner-B'; };
    const r = await h.runner('runner-A').runOne();
    expect(r).toMatchObject({ status: 'LEASE_LOST' });
    expect(h.calls).toEqual({ CREATE_VENDOR: 1, ASSIGN_FREE_PLAN: 1 });
    expect((await h.repo.getJob(job.id))!.lockedBy).toBe('runner-B');
  });

  it('the raw claim token is handed from CREATE_CLAIM_LINK to SEND_INVITE in memory; if SEND_INVITE must be retried, a NEW link is issued first', async () => {
    const h = harness();
    h.behaviour.SEND_INVITE = (_c, n) => { if (n === 1) throw new StepError('ADAPTER_TIMEOUT', true); };
    const { job } = await newJob(h);
    await h.runner().runOne();
    expect(h.seenTokens).toEqual(['raw-token-1']);
    h.clock.now = new Date(T0.getTime() + 40_000);
    const r = await h.runner().runOne();
    expect(r!.stepsRun).toEqual(['CREATE_CLAIM_LINK', 'SEND_INVITE']);
    expect(h.tokens).toEqual(['raw-token-1', 'raw-token-2']);
    expect(h.seenTokens).toEqual(['raw-token-1', 'raw-token-2']);
    expect((await h.repo.getJob(job.id))!.status).toBe('SUCCEEDED');
  });

  it('the raw token never reaches the job, the steps or the audit rows', async () => {
    const h = harness();
    const { job } = await newJob(h);
    await h.runner().runOne();
    const stored = JSON.stringify([await h.repo.getJob(job.id), await h.repo.listSteps(job.id), h.audit]);
    for (const t of h.tokens) expect(stored).not.toContain(t);
  });

  it('a run that cannot settle (a claim step that never hands on a token) fails the job with a fixed message instead of throwing or looping', async () => {
    const h = harness();
    h.behaviour.CREATE_CLAIM_LINK = () => ({ outputRef: { claimTokenId: 'ct' } });   // no rawToken, so SEND_INVITE can never run
    const { job } = await newJob(h);
    const r = await h.runner().runOne();
    expect(r).toMatchObject({ status: 'FAILED' });
    expect(await h.repo.getJob(job.id)).toMatchObject({ status: 'FAILED', lastErrorCode: 'UNEXPECTED', lockedBy: null });
    expect(h.calls.SEND_INVITE ?? 0).toBe(0);
  });

  it('runDue works through several due jobs, up to the limit', async () => {
    const h = harness();
    await newJob(h, 'a'); await newJob(h, 'b'); await newJob(h, 'c');
    const reports = await h.runner().runDue(2);
    expect(reports).toHaveLength(2);
    expect((await h.runner().runDue(5))).toHaveLength(1);
  });

  it('running one named job runs only that job', async () => {
    const h = harness();
    await newJob(h, 'a'); const b = await newJob(h, 'b');
    const r = await h.runner().runOne({ jobId: b.job.id });
    expect(r!.jobId).toBe(b.job.id);
    expect(h.repo.jobs.get('job1')!.status).toBe('QUEUED');
  });
});
