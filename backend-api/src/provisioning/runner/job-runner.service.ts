import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Actor } from '../../plans/admin/audit.service';
import { JobStatus, StepKey, decide, onFailure } from '../core/state-machine';
import { StepError, classifyError, sanitisedMessage } from '../provisioning.errors';
import { JobRow, ProvisioningRepository, newRunnerId } from '../provisioning.repository';
import { ProvisioningSettings } from '../settings/provisioning-settings';
import { ProvisioningSettingsService } from '../settings/provisioning-settings.service';

/** What a step receives. `rawToken` exists only inside one run (docs/v3/V3_S3_PROVISIONING.md section 6). */
export interface StepContext {
  job: JobRow;
  input: Record<string, unknown>;
  vendorId: string | null;
  rawToken?: string;
  actor: Actor;
  settings: ProvisioningSettings;
  now: Date;
}
/** What a step returns. `outputRef` is stored: ids only. `rawToken` and `vendorId` are handed on to the later steps of this run. */
export interface StepResult { outputRef?: Record<string, string>; vendorId?: string; rawToken?: string }
export interface ProvisioningStep { readonly key: StepKey; run(ctx: StepContext): Promise<StepResult> }
export const PROVISIONING_STEPS = Symbol('PROVISIONING_STEPS');
export const PROVISIONING_RUNNER_ID = Symbol('PROVISIONING_RUNNER_ID');
/** Steps that only run when a setting enables them (slice 5.7). Kept apart from PROVISIONING_STEPS so the five slice 5.3 steps are untouched. */
export const PROVISIONING_OPTIONAL_STEPS = Symbol('PROVISIONING_OPTIONAL_STEPS');

/** Writes the audit rows of a run (no secrets, ids only). The Prisma implementation writes g4d_audit_logs; tests record in memory. */
export abstract class ProvisioningAudit {
  abstract record(actor: Actor, action: string, entityType: string, entityId: string | null, after: unknown): Promise<void>;
}

export interface RunReport { jobId: string; status: JobStatus | 'LEASE_LOST'; stepsRun: StepKey[] }

const LEASE_MS = 5 * 60_000;
const MAX_STEPS_PER_RUN = 12;   // five steps plus the occasional re-issue of the claim link; a hard stop against a loop

/**
 * Drives one claimed job at a time. Idempotence comes from three places: a DONE step is never run again, a half-done step is run again and must complete
 * without duplicating work (each step guarantees that), and the job is claimed atomically with a lease so two runners never work on the same job.
 */
@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);
  /** overridable in tests */
  clock: () => Date = () => new Date();
  random: () => number = Math.random;

  constructor(
    private readonly repo: ProvisioningRepository,
    @Inject(PROVISIONING_STEPS) private readonly steps: ProvisioningStep[],
    @Inject(ProvisioningSettingsService) private readonly settingsService: Pick<ProvisioningSettingsService, 'get'>,
    private readonly audit: ProvisioningAudit,
    @Optional() @Inject(PROVISIONING_RUNNER_ID) private readonly runnerId: string = newRunnerId(),
    @Optional() @Inject(PROVISIONING_OPTIONAL_STEPS) private readonly optionalSteps: ProvisioningStep[] = [],
  ) {}

  async runOne(opts: { jobId?: string } = {}): Promise<RunReport | null> {
    const job = await this.repo.claimNext(this.runnerId, this.clock(), LEASE_MS, opts.jobId);
    return job ? this.drive(job) : null;
  }

  /** Works through up to `max` due jobs, one after the other. */
  async runDue(max: number): Promise<RunReport[]> {
    const out: RunReport[] = [];
    for (let i = 0; i < max; i++) {
      const r = await this.runOne();
      if (!r) break;
      out.push(r);
    }
    return out;
  }

  private async drive(claimed: JobRow): Promise<RunReport> {
    const settings = await this.settingsService.get();
    const actor: Actor = { type: claimed.createdByType, id: claimed.createdById, ip: null };
    const ctx: StepContext = { job: claimed, input: claimed.input, vendorId: claimed.vendorId, actor, settings, now: this.clock() };
    const stepsRun: StepKey[] = [];

    for (let guard = 0; guard < MAX_STEPS_PER_RUN; guard++) {
      const states = await this.repo.listSteps(claimed.id);
      const decision = decide(states, { hasRawToken: ctx.rawToken !== undefined, directoryProfile: settings.provisioningDirectoryProfileEnabled === true, seeded: (claimed.input as { mode?: unknown } | null)?.mode === 'SEEDED' });

      if (decision.action === 'COMPLETE') {
        const ok = await this.repo.finishRun(claimed.id, this.runnerId, { status: 'SUCCEEDED', currentStep: null, lastErrorCode: null, lastErrorMessage: null, finishedAt: this.clock() });
        if (!ok) return { jobId: claimed.id, status: 'LEASE_LOST', stepsRun };
        await this.audit.record(actor, 'provisioning.job.succeeded', 'provisioning_job', claimed.id, { vendorId: ctx.vendorId });
        return { jobId: claimed.id, status: 'SUCCEEDED', stepsRun };
      }

      const step = this.steps.find((s) => s.key === decision.step) ?? this.optionalSteps.find((s) => s.key === decision.step);
      if (!step) throw new Error(`no implementation registered for step ${decision.step}`);   // a wiring bug, not a runtime condition
      ctx.now = this.clock();
      await this.repo.markStepRunning(claimed.id, step.key, ctx.now);
      stepsRun.push(step.key);

      let result: StepResult;
      try {
        result = await step.run(ctx);
      } catch (e) {
        const cls = classifyError(e);
        const message = sanitisedMessage(cls.code);
        const now = this.clock();
        const outcome = onFailure({ attempt: claimed.attempt, maxAttempts: claimed.maxAttempts }, cls, now, settings.provisioningBackoffSeconds, this.random);
        const extra = e instanceof StepError && Object.keys(e.extra).length ? e.extra : null;   // ids only (for example the existing vendor of a duplicate)
        await this.repo.finishStep(claimed.id, step.key, 'FAILED', now, extra, cls.code);
        const ok = await this.repo.finishRun(claimed.id, this.runnerId, {
          status: outcome.status, currentStep: step.key, attempt: outcome.attempt, ...(outcome.nextRunAt ? { nextRunAt: outcome.nextRunAt } : {}),
          lastErrorCode: cls.code, lastErrorMessage: message, ...(outcome.status === 'FAILED' ? { finishedAt: now } : {}),
        });
        if (!ok) return { jobId: claimed.id, status: 'LEASE_LOST', stepsRun };
        await this.audit.record(actor, 'provisioning.step.failed', 'provisioning_job', claimed.id, { step: step.key, code: cls.code, retryable: cls.retryable, willRetry: outcome.status === 'WAITING' });
        this.logger.warn(`job ${claimed.id} step ${step.key} failed: ${cls.code}${outcome.status === 'WAITING' ? ' (will retry)' : ''}`);
        return { jobId: claimed.id, status: outcome.status, stepsRun };
      }

      // outside the try: an infrastructure failure here is not a step failure; it leaves the lease to lapse and the job is picked up again
      await this.repo.finishStep(claimed.id, step.key, 'DONE', this.clock(), result.outputRef ?? null, null);
      if (result.vendorId && result.vendorId !== ctx.vendorId) { ctx.vendorId = result.vendorId; await this.repo.setVendor(claimed.id, result.vendorId); }
      if (result.rawToken !== undefined) ctx.rawToken = result.rawToken;
      await this.audit.record(actor, 'provisioning.step.done', 'provisioning_job', claimed.id, { step: step.key, ...(result.outputRef ?? {}) });
      if (!(await this.repo.extendLease(claimed.id, this.runnerId, this.clock(), LEASE_MS))) return { jobId: claimed.id, status: 'LEASE_LOST', stepsRun };
    }
    // The loop did not settle (for example a step that never hands on what the next one needs). Fail the job with a fixed message instead of throwing:
    // an exception here would leave the lease to lapse and the job would be picked up and spin again every few minutes.
    const now = this.clock();
    const ok = await this.repo.finishRun(claimed.id, this.runnerId, { status: 'FAILED', attempt: claimed.attempt + 1, lastErrorCode: 'UNEXPECTED', lastErrorMessage: sanitisedMessage('UNEXPECTED'), finishedAt: now });
    if (!ok) return { jobId: claimed.id, status: 'LEASE_LOST', stepsRun };
    await this.audit.record(actor, 'provisioning.step.failed', 'provisioning_job', claimed.id, { code: 'UNEXPECTED', reason: 'did not settle', willRetry: false });
    this.logger.error(`job ${claimed.id} did not settle in ${MAX_STEPS_PER_RUN} steps and was failed`);
    return { jobId: claimed.id, status: 'FAILED', stepsRun };
  }
}
