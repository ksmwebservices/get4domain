import { JobFinish, JobListFilter, JobRow, NewJob, ProvisioningRepository, StepRow } from '../../src/provisioning/provisioning.repository';
import { ALL_STEP_ORDER, STEP_ORDER, StepKey, StepStatus } from '../../src/provisioning/core/state-machine';

/**
 * In-memory twin of PrismaProvisioningRepository for unit tests. It keeps the properties the runner relies on: claim is atomic (synchronous, so two
 * callers can never take the same job), a RUNNING job is claimable again once its lease has lapsed, and every write that ends a run is fenced by lockedBy.
 */
export class MemoryProvisioningRepo extends ProvisioningRepository {
  jobs = new Map<string, JobRow>();
  steps = new Map<string, StepRow>();
  /** Tests that fix the runner clock set this too, so a job created now is due at the fixed time (a real-clock createdAt made them fail once the wall clock passed the fixed date). */
  clock: () => Date = () => new Date();
  private seq = 0;
  /** test hook: called inside finishStep before it writes, to simulate a crash in the middle of a job */
  beforeFinishStep?: (jobId: string, key: StepKey, status: StepStatus) => void;

  private k = (jobId: string, key: StepKey): string => `${jobId}:${key}`;

  async createJob(d: NewJob): Promise<{ job: JobRow; created: boolean }> {
    for (const j of this.jobs.values()) if (j.idempotencyKey === d.idempotencyKey) return { job: { ...j }, created: false };
    const now = this.clock();
    const job: JobRow = {
      id: `job${++this.seq}`, kind: 'BUSINESS_FREE_SITE', status: 'QUEUED', idempotencyKey: d.idempotencyKey, vendorId: null, input: d.input, currentStep: null,
      attempt: 0, maxAttempts: d.maxAttempts, nextRunAt: now, lockedBy: null, lockedUntil: null, lastErrorCode: null, lastErrorMessage: null,
      createdByType: d.createdByType, createdById: d.createdById, finishedAt: null, createdAt: now, updatedAt: now,
    };
    this.jobs.set(job.id, job);
    for (const stepKey of STEP_ORDER) this.steps.set(this.k(job.id, stepKey), { jobId: job.id, stepKey, status: 'PENDING', attempts: 0, startedAt: null, finishedAt: null, outputRef: null, errorCode: null });
    return { job: { ...job }, created: true };
  }

  async getJob(id: string): Promise<JobRow | null> { const j = this.jobs.get(id); return j ? { ...j } : null; }

  async listJobs(f: JobListFilter): Promise<{ items: JobRow[]; total: number }> {
    const all = [...this.jobs.values()].filter((j) => (!f.status || j.status === f.status) && (!f.from || j.createdAt >= f.from) && (!f.to || j.createdAt <= f.to));
    return { items: all.slice(f.skip, f.skip + f.take).map((j) => ({ ...j })), total: all.length };
  }

  async listSteps(jobId: string): Promise<StepRow[]> { return ALL_STEP_ORDER.filter((k) => this.steps.has(this.k(jobId, k))).map((k) => ({ ...this.steps.get(this.k(jobId, k))! })); }

  async claimNext(runnerId: string, now: Date, leaseMs: number, onlyJobId?: string): Promise<JobRow | null> {
    const due = [...this.jobs.values()]
      .filter((j) => (!onlyJobId || j.id === onlyJobId))
      .filter((j) => ((j.status === 'QUEUED' || j.status === 'WAITING') && j.nextRunAt <= now) || (j.status === 'RUNNING' && j.lockedUntil !== null && j.lockedUntil < now))
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());
    const j = due[0];
    if (!j) return null;
    j.status = 'RUNNING'; j.lockedBy = runnerId; j.lockedUntil = new Date(now.getTime() + leaseMs); j.updatedAt = now;
    return { ...j };
  }

  async extendLease(jobId: string, runnerId: string, now: Date, leaseMs: number): Promise<boolean> {
    const j = this.jobs.get(jobId);
    if (!j || j.lockedBy !== runnerId || j.status !== 'RUNNING') return false;
    j.lockedUntil = new Date(now.getTime() + leaseMs);
    return true;
  }

  async markStepRunning(jobId: string, key: StepKey, now: Date): Promise<void> {
    let s = this.steps.get(this.k(jobId, key));
    if (!s) { s = { jobId, stepKey: key, status: 'PENDING', attempts: 0, startedAt: null, finishedAt: null, outputRef: null, errorCode: null }; this.steps.set(this.k(jobId, key), s); }   // the optional step has no row until it runs
    s.status = 'RUNNING'; s.startedAt = now; s.attempts += 1; s.errorCode = null;
    this.jobs.get(jobId)!.currentStep = key;
  }

  async finishStep(jobId: string, key: StepKey, status: StepStatus, now: Date, outputRef: Record<string, string> | null, errorCode: string | null): Promise<void> {
    this.beforeFinishStep?.(jobId, key, status);
    const s = this.steps.get(this.k(jobId, key))!;
    s.status = status; s.finishedAt = now; s.errorCode = errorCode; if (outputRef) s.outputRef = outputRef;
  }

  async setVendor(jobId: string, vendorId: string): Promise<void> { this.jobs.get(jobId)!.vendorId = vendorId; }

  async finishRun(jobId: string, runnerId: string, p: JobFinish): Promise<boolean> {
    const j = this.jobs.get(jobId);
    if (!j || j.lockedBy !== runnerId || j.status !== 'RUNNING') return false;
    j.status = p.status; j.lockedBy = null; j.lockedUntil = null;
    if (p.currentStep !== undefined) j.currentStep = p.currentStep;
    if (p.attempt !== undefined) j.attempt = p.attempt;
    if (p.nextRunAt) j.nextRunAt = p.nextRunAt;
    if (p.lastErrorCode !== undefined) j.lastErrorCode = p.lastErrorCode;
    if (p.lastErrorMessage !== undefined) j.lastErrorMessage = p.lastErrorMessage;
    if (p.finishedAt !== undefined) j.finishedAt = p.finishedAt;
    return true;
  }

  async makeDue(jobId: string, now: Date): Promise<void> {
    const j = this.jobs.get(jobId);
    if (j && (j.status === 'QUEUED' || j.status === 'WAITING')) j.nextRunAt = now;
  }

  async resetForRetry(jobId: string, now: Date): Promise<void> {
    for (const k of STEP_ORDER) { const s = this.steps.get(this.k(jobId, k))!; if (s.status === 'FAILED') { s.status = 'PENDING'; s.errorCode = null; } }
    Object.assign(this.jobs.get(jobId)!, { status: 'QUEUED', attempt: 0, nextRunAt: now, lastErrorCode: null, lastErrorMessage: null, finishedAt: null, lockedBy: null, lockedUntil: null });
  }

  async cancel(jobId: string, now: Date, skipKeys: StepKey[]): Promise<void> {
    for (const k of skipKeys) { const s = this.steps.get(this.k(jobId, k))!; s.status = 'SKIPPED'; s.finishedAt = now; }
    Object.assign(this.jobs.get(jobId)!, { status: 'CANCELLED', finishedAt: now, lockedBy: null, lockedUntil: null });
  }
}
